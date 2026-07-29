/**
 * 本地守护进程 v1.0 — 全自动采集 + 分析 + 同步
 *
 * 不依赖 GitHub Actions，所有采集、导入、AI 分析均在本地完成。
 * ECS 上的 watcher.cjs 保留不变（负责拉取微信文章 + git push wechat-articles.json）。
 *
 * 架构：
 *   ECS watcher → git push (wechat-articles.json)
 *     ↓ git pull
 *   本地 daemon → FDA 采集 + 微信导入 + AI 分析 → git push (regulatory.db)
 *
 * 用法：
 *   node scripts/local_daemon.cjs              # 常驻模式（PM2 托管）
 *   node scripts/local_daemon.cjs --once        # 单次全流程
 *   node scripts/local_daemon.cjs --fda-only    # 仅 FDA 采集 + AI 分析
 *   node scripts/local_daemon.cjs --ai-only     # 仅 AI 分析
 *
 * 环境变量（可选，均有默认值）：
 *   LOCAL_DAEMON_INTERVAL=30    # 主循环间隔（分钟）
 *   LOCAL_FDA_INTERVAL=4        # FDA 采集间隔（轮数）
 *   LOCAL_ANALYZE_LIMIT=100     # 每次 AI 分析上限
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// ============================================================
// 配置
// ============================================================
const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'regulatory-hot', 'public', 'data');
const DB_FILE = path.join(PROJECT_ROOT, 'regulatory-hot', 'regulatory.db');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');

const CYCLE_INTERVAL_MIN = parseInt(process.env.LOCAL_DAEMON_INTERVAL || '30');
const FDA_INTERVAL_CYCLES = parseInt(process.env.LOCAL_FDA_INTERVAL || '4');
const ANALYZE_LIMIT = parseInt(process.env.LOCAL_ANALYZE_LIMIT || '100');

// ============================================================
// 日志
// ============================================================
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, 'local-daemon.log');
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function log(msg, level = 'INFO') {
  const ts = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  const line = `[${ts}] [${level}] ${msg}`;
  if (level === 'ERROR') console.error(line);
  else console.log(line);
  logStream.write(line + '\n');
}

function timeStr(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

// ============================================================
// 文件备份 & 恢复 — 防止 git rebase 覆盖数据
// ============================================================
const BAK_DIR = path.join(DATA_DIR, '.bak');

function backupDataFiles() {
  if (!fs.existsSync(BAK_DIR)) fs.mkdirSync(BAK_DIR, { recursive: true });
  const files = ['events.json', 'wechat-articles.json', '.watcher-state.json'];
  for (const f of files) {
    const src = path.join(DATA_DIR, f);
    const dst = path.join(BAK_DIR, f);
    if (fs.existsSync(src)) {
      try { fs.copyFileSync(src, dst); } catch {}
    }
  }
  // 备份 DB
  if (fs.existsSync(DB_FILE)) {
    try { fs.copyFileSync(DB_FILE, path.join(BAK_DIR, 'regulatory.db.bak')); } catch {}
  }
}

function restoreBackups() {
  if (!fs.existsSync(BAK_DIR)) return;

  // 恢复 JSON 数据文件
  const files = ['events.json', 'wechat-articles.json', '.watcher-state.json'];
  for (const f of files) {
    const bak = path.join(BAK_DIR, f);
    const dst = path.join(DATA_DIR, f);
    if (fs.existsSync(bak) && fs.existsSync(dst)) {
      try {
        const bakSize = fs.statSync(bak).size;
        const curSize = fs.statSync(dst).size;
        if (bakSize > curSize * 1.3) {  // 备份明显更大 → 被覆盖了
          log(`git rebase 覆盖了 ${f}，从备份恢复 (${curSize} → ${bakSize} 字节)`, 'WARN');
          fs.copyFileSync(bak, dst);
        }
      } catch {}
    }
  }

  // 恢复 DB：如果当前 DB 比备份小很多，说明被覆盖
  const bakDb = path.join(BAK_DIR, 'regulatory.db.bak');
  if (fs.existsSync(bakDb) && fs.existsSync(DB_FILE)) {
    try {
      const bakSize = fs.statSync(bakDb).size;
      const curSize = fs.statSync(DB_FILE).size;
      if (curSize < bakSize * 0.5) {
        log(`git rebase 覆盖了 regulatory.db，从备份恢复 (${curSize} → ${bakSize} 字节)`, 'WARN');
        fs.copyFileSync(bakDb, DB_FILE);
      }
    } catch {}
  }
}

// ============================================================
// Git 操作
// ============================================================
function gitPull() {
  backupDataFiles();

  // ============ Windows SQLite 文件锁解决方案 ============
  // SQLite WAL 模式在 Windows 上会锁定 regulatory.db，
  // 导致 git checkout/unlink 全部失败（"Invalid argument"）。
  // 策略：用 --assume-unchanged 骗过 git，让它不检测 DB 文件变更

  // 1. 标记 DB 为"假干净"（git 不再检查它的变更状态）
  try {
    execSync('git update-index --assume-unchanged regulatory-hot/regulatory.db', {
      cwd: PROJECT_ROOT, timeout: 5000, stdio: 'pipe',
    });
  } catch {}

  // 2. Stash 非 DB 文件变更（JSON + config）
  let hadStash = false;
  try {
    const out = execSync('git stash push -m "daemon-auto" -- regulatory-hot/public/data/ config/mp_fakeid_cache.json', {
      cwd: PROJECT_ROOT, timeout: 10000, encoding: 'utf-8', stdio: 'pipe',
    });
    hadStash = !out.includes('No local changes');
  } catch {}

  // 3. Pull（DB 对 git 而言是"干净"的，不会触发冲突）
  try {
    const out = execSync('git pull --rebase origin main', {
      cwd: PROJECT_ROOT, timeout: 60000, encoding: 'utf-8',
    });
    const lines = out.trim().split('\n');
    const status = lines[lines.length - 1] || 'up to date';
    log(`git pull: ${status}`);
  } catch (e) {
    const errMsg = String(e.message || e).split('\n')[0];
    log(`git pull 异常: ${errMsg}`, 'WARN');
    // 中止可能的 rebase
    try { execSync('git rebase --abort', { cwd: PROJECT_ROOT, stdio: 'pipe' }); } catch {}
    // 降级：fetch + reset hard
    try {
      execSync('git fetch origin main', { cwd: PROJECT_ROOT, timeout: 30000, stdio: 'pipe' });
      execSync('git reset --hard origin/main', { cwd: PROJECT_ROOT, timeout: 10000, stdio: 'pipe' });
      log('git pull 降级为 fetch + reset --hard', 'WARN');
    } catch {
      log('git pull 所有策略均失败，继续使用本地数据', 'WARN');
    }
  }

  // 4. 恢复 stash
  if (hadStash) {
    try {
      execSync('git stash pop', { cwd: PROJECT_ROOT, timeout: 10000, stdio: 'pipe' });
    } catch {
      log('git stash pop 冲突（本地数据优先）', 'WARN');
    }
  }

  // 5. 恢复 DB tracking（否则 git add 也加不上）
  try {
    execSync('git update-index --no-assume-unchanged regulatory-hot/regulatory.db', {
      cwd: PROJECT_ROOT, timeout: 5000, stdio: 'pipe',
    });
  } catch {}

  // 6. 恢复数据备份（覆盖 pull 可能刷掉的内容）
  restoreBackups();

  return true;
}

function gitPush() {
  try {
    // 添加数据文件
    const filesToAdd = [
      'regulatory-hot/public/data/',
      'regulatory-hot/regulatory.db',
      'regulatory-hot/prisma/',
      'config/mp_fakeid_cache.json',
    ];
    // 只添加实际存在的文件/目录
    for (const f of filesToAdd) {
      const full = path.join(PROJECT_ROOT, f);
      if (fs.existsSync(full)) {
        execSync(`git add "${f}"`, { cwd: PROJECT_ROOT });
      }
    }

    const diff = execSync('git diff --staged --name-only', {
      cwd: PROJECT_ROOT, encoding: 'utf-8',
    }).trim();

    if (!diff) {
      log('git: 无变更，跳过 push');
      return true;
    }

    const ts = new Date().toISOString();
    execSync(`git commit -m "🔄 本地同步 [${ts}]"`, { cwd: PROJECT_ROOT });
    execSync('git push origin main', { cwd: PROJECT_ROOT, timeout: 120000 });
    log(`git push 成功 (${diff.split('\n').length} 个文件)`);
    return true;
  } catch (e) {
    const msg = e.message || String(e);
    log(`git push 失败: ${msg}`, 'ERROR');

    // push 冲突 → rebase 后重试
    if (msg.includes('rejected') || msg.includes('non-fast-forward') || msg.includes('fetch first')) {
      log('检测到 push 冲突，尝试 rebase 后重推...', 'WARN');
      gitPull();
      try {
        execSync('git push origin main', { cwd: PROJECT_ROOT, timeout: 120000 });
        log('git push 重试成功');
        return true;
      } catch (e2) {
        log(`git push 重试也失败: ${e2.message}`, 'ERROR');
      }
    }
    return false;
  }
}

// ============================================================
// 微信文章导入 → regulatory.db
// ============================================================
async function importWechatArticles() {
  const wechatFile = path.join(DATA_DIR, 'wechat-articles.json');
  if (!fs.existsSync(wechatFile)) {
    log('wechat-articles.json 不存在，跳过微信导入');
    return { imported: 0, skipped: 0 };
  }

  let articles;
  try {
    articles = JSON.parse(fs.readFileSync(wechatFile, 'utf-8'));
  } catch (e) {
    log(`wechat-articles.json 解析失败: ${e.message}`, 'ERROR');
    return { imported: 0, skipped: 0 };
  }

  if (!Array.isArray(articles) || articles.length === 0) {
    log('wechat-articles.json 为空');
    return { imported: 0, skipped: 0 };
  }

  // 只导入有 link 和 title 的有效文章
  const valid = articles.filter(a => a.link && a.title);
  if (valid.length === 0) {
    log('微信文章中无有效条目');
    return { imported: 0, skipped: 0 };
  }

  log(`微信文章 ${articles.length} 篇 (有效 ${valid.length})，导入数据库...`);

  try {
    const { wechatToDb, insertEvents, disconnectPrisma } = require('./db_writer.cjs');
    const dbEvents = valid.map(a => wechatToDb(a));
    const result = await insertEvents(dbEvents);
    await disconnectPrisma();
    log(`微信导入完成: +${result.inserted}, 跳过 ${result.skipped}`);
    return result;
  } catch (e) {
    log(`微信导入失败: ${e.message}`, 'ERROR');
    return { imported: 0, skipped: 0, error: e.message };
  }
}

// ============================================================
// FDA 采集
// ============================================================
async function runFdaCollect() {
  log('=== FDA 采集 ===');
  return new Promise((resolve) => {
    // --no-ai: 跳过 collect_fda.cjs 自带的旧版 analyze.cjs，统一由本 daemon 调用 analyze_v3.cjs
    const child = spawn('node', ['scripts/collect_fda.cjs', '--no-ai'], {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      shell: true,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      // 提取关键行
      const lines = stdout.split('\n').filter(l => l.includes('✓') || l.includes('完成') || l.includes('新增') || l.includes('DB') || l.includes('跳过'));
      for (const l of lines) log(`  ${l.trim()}`);

      if (code !== 0) {
        log(`FDA 采集异常 (exit ${code}): ${stderr.slice(-500)}`, 'ERROR');
        resolve(code);
      } else {
        log('FDA 采集完成');
        resolve(code);
      }
    });

    child.on('error', (err) => {
      log(`FDA 采集启动失败: ${err.message}`, 'ERROR');
      resolve(-1);
    });
  });
}

// ============================================================
// AI 分析
// ============================================================
async function runAiAnalysis() {
  log(`=== AI 分析 (limit=${ANALYZE_LIMIT}) ===`);
  return new Promise((resolve) => {
    const child = spawn('node', ['scripts/analyze_v3.cjs', '--limit', String(ANALYZE_LIMIT)], {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      shell: true,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      // 提取摘要信息
      const summaryLines = stdout.split('\n').filter(l =>
        l.includes('分析') || l.includes('完成') || l.includes('跳过') || l.includes('费用') || l.includes('pending') || l.includes('total')
      );
      for (const l of summaryLines.slice(-5)) log(`  ${l.trim()}`);

      if (code !== 0) {
        const errPreview = stderr.slice(-300);
        log(`AI 分析异常 (exit ${code})${errPreview ? ': ' + errPreview : ''}`, 'ERROR');
        resolve(code);
      } else {
        log('AI 分析完成');
        resolve(code);
      }
    });

    child.on('error', (err) => {
      log(`AI 分析启动失败: ${err.message}`, 'ERROR');
      resolve(-1);
    });
  });
}

// ============================================================
// 主循环
// ============================================================
async function mainCycle(cycleNum) {
  const startTime = Date.now();
  const isFdaRound = (cycleNum % FDA_INTERVAL_CYCLES === 0);
  const nextFdaRound = cycleNum + (FDA_INTERVAL_CYCLES - (cycleNum % FDA_INTERVAL_CYCLES));

  log(`\n${'='.repeat(60)}`);
  log(`第 ${cycleNum} 轮  |  FDA: ${isFdaRound ? '✅ 本轮执行' : `⏭️ 跳过(下次第${nextFdaRound}轮)`}  |  间隔: ${CYCLE_INTERVAL_MIN}min`);
  log(`${'='.repeat(60)}`);

  // ---- 第一步: git pull ----
  log('[1/5] git pull — 拉取 ECS 微信文章...');
  const pullOk = gitPull();
  if (!pullOk) log('⚠️ git pull 失败，继续使用本地数据', 'WARN');

  // ---- 第二步: 微信导入 ----
  log('[2/5] 微信文章导入...');
  const wxResult = await importWechatArticles();

  // ---- 第三步: FDA 采集 ----
  if (isFdaRound) {
    log('[3/5] FDA 采集 (本轮触发)...');
    await runFdaCollect();
  } else {
    log(`[3/5] FDA 采集跳过 — 下次第 ${nextFdaRound} 轮`);
  }

  // ---- 第四步: AI 分析 ----
  log('[4/5] AI 分析...');
  await runAiAnalysis();

  // ---- 第五步: git push ----
  log('[5/5] git push...');
  const pushOk = gitPush();
  if (!pushOk) log('⚠️ git push 失败，将在下轮重试', 'WARN');

  // ---- 统计 ----
  const elapsed = Date.now() - startTime;
  log(`本轮完成: 微信 +${wxResult.inserted || 0} | FDA ${isFdaRound ? '已采集' : '跳过'} | 耗时 ${timeStr(elapsed)}`);
  log(`${'='.repeat(60)}\n`);
}

// ============================================================
// 启动检查 — 验证环境
// ============================================================
function checkEnvironment() {
  const checks = [];

  // 1. Git 仓库
  try {
    execSync('git status', { cwd: PROJECT_ROOT, timeout: 5000, stdio: 'pipe' });
    checks.push('✅ Git 仓库');
  } catch {
    checks.push('❌ Git 仓库不可用');
  }

  // 2. .env
  const envFile = path.join(PROJECT_ROOT, 'regulatory-hot', '.env');
  if (fs.existsSync(envFile)) {
    // 尝试加载 env
    try {
      const content = fs.readFileSync(envFile, 'utf8');
      for (const line of content.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq === -1) continue;
        const k = t.slice(0, eq).trim();
        if (!process.env[k]) process.env[k] = t.slice(eq + 1).trim();
      }
    } catch {}
  }

  // 统一 AI 配置检查（config/ai-models.json → WorkBuddy 积分反代）
  let aiConfigOK = false;
  try {
    const { getModuleConfig } = require('./ai_config.cjs');
    const cfg = getModuleConfig('analyze');
    aiConfigOK = !!cfg.apiKey;
    checks.push(cfg.apiKey ? `✅ AI 反代 (${cfg.baseUrl}, analyze=${cfg.model})` : '❌ AI 反代 apiKey 为空');
  } catch (e) {
    checks.push(`❌ ai-models.json 读取失败: ${e.message}`);
  }

  // 3. regulatory.db
  if (fs.existsSync(DB_FILE)) {
    const sizeMB = (fs.statSync(DB_FILE).size / 1024 / 1024).toFixed(1);
    checks.push(`✅ regulatory.db (${sizeMB}MB)`);
  } else {
    checks.push('⚠️ regulatory.db 尚未生成（首次 FDA 采集后自动创建）');
  }

  // 4. Node modules
  if (fs.existsSync(path.join(PROJECT_ROOT, 'regulatory-hot', 'node_modules', '@prisma', 'client'))) {
    checks.push('✅ Prisma Client');
  } else {
    checks.push('⚠️ Prisma 未安装 (需 cd regulatory-hot && npm install)');
  }

  // 5. Playwright (FDA 采集需要)
  try {
    execSync('npx playwright --version', { cwd: PROJECT_ROOT, timeout: 5000, stdio: 'pipe' });
    checks.push('✅ Playwright');
  } catch {
    checks.push('⚠️ Playwright 未安装 (FDA 网页采集需要: npx playwright install chromium)');
  }

  log('环境检查:');
  for (const c of checks) log(`  ${c}`);
  log('');

  // 致命错误
  if (!aiConfigOK) {
    log('❌ AI 反代配置无效（config/ai-models.json），AI 分析无法运行', 'ERROR');
    return false;
  }
  return true;
}

// ============================================================
// 入口
// ============================================================
async function main() {
  log('');
  log('╔══════════════════════════════════════════════════╗');
  log('║  本地守护进程 v1.0 — 全自动采集+分析+同步        ║');
  log('╚══════════════════════════════════════════════════╝');
  log(`周期: ${CYCLE_INTERVAL_MIN}min | FDA: 每 ${FDA_INTERVAL_CYCLES} 轮 | AI 上限: ${ANALYZE_LIMIT} 条/轮`);

  if (!checkEnvironment()) {
    log('环境检查未通过，退出', 'ERROR');
    process.exit(1);
  }

  const args = process.argv.slice(2);

  // ---- 单次模式 ----
  if (args.includes('--once') || args.includes('--fda-only') || args.includes('--ai-only')) {
    if (args.includes('--fda-only')) {
      log('模式: FDA Only (采集 + 分析)');
      gitPull();
      await runFdaCollect();
      await runAiAnalysis();
      gitPush();
    } else if (args.includes('--ai-only')) {
      log('模式: AI Only (仅分析)');
      gitPull();
      await runAiAnalysis();
      gitPush();
    } else {
      log('模式: 单次全流程');
      await mainCycle(0);
    }
    log('单次模式结束');
    logStream.end();
    process.exit(0);
  }

  // ---- 常驻模式 ----
  log('模式: 常驻 (PM2 管理)\n');

  let cycleNum = 0;
  await mainCycle(cycleNum);
  cycleNum++;

  const intervalMs = CYCLE_INTERVAL_MIN * 60 * 1000;
  setInterval(async () => {
    await mainCycle(cycleNum);
    cycleNum++;
  }, intervalMs);

  log(`✅ 守护进程已启动，每 ${CYCLE_INTERVAL_MIN} 分钟执行一轮`);
  log(`   下一轮: ${new Date(Date.now() + intervalMs).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`);
}

// ---- 保活 ----
process.on('uncaughtException', (e) => {
  log(`未捕获异常: ${e.message}`, 'ERROR');
  log(e.stack, 'ERROR');
  // PM2 会自动重启
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log(`未处理 Promise 拒绝: ${reason}`, 'ERROR');
});

main().catch((e) => {
  log(`启动失败: ${e.message}`, 'ERROR');
  process.exit(1);
});
