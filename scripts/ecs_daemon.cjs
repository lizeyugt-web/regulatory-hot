/**
 * ECS 守护进程 v1.0 — 阿里云全自动采集+分析+同步
 *
 * 与 local_daemon.cjs 的区别：
 *   1. 微信文章不需要 git pull — watcher.cjs 在同一台机器上，直读本地文件
 *   2. 无 SQLite 文件锁问题（Linux）— 不需要 --assume-unchanged
 *   3. 内置内存保护 — 可用内存 < 200MB 时跳过 FDA Playwright，降级为 RSS-only
 *   4. git push 轻量化 — 只推送 regulatory.db + events.json
 *
 * 用法：
 *   node scripts/ecs_daemon.cjs              # 常驻模式（PM2 托管）
 *   node scripts/ecs_daemon.cjs --once        # 单次全流程
 *   node scripts/ecs_daemon.cjs --fda-only    # 仅 FDA 采集 + AI 分析
 *   node scripts/ecs_daemon.cjs --ai-only     # 仅 AI 分析
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

// ============================================================
// 配置
// ============================================================
const PROJECT_ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'regulatory-hot', 'public', 'data');
const DB_FILE = path.join(PROJECT_ROOT, 'regulatory-hot', 'regulatory.db');
const WECHAT_FILE = path.join(DATA_DIR, 'wechat-articles.json');
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');

const CYCLE_INTERVAL_MIN = parseInt(process.env.ECS_DAEMON_INTERVAL || '30');
const FDA_INTERVAL_CYCLES = parseInt(process.env.ECS_FDA_INTERVAL || '4');
const ANALYZE_LIMIT = parseInt(process.env.ECS_ANALYZE_LIMIT || '100');
const MEMORY_FLOOR_MB = parseInt(process.env.ECS_MEMORY_FLOOR || '200');

// ============================================================
// 日志
// ============================================================
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, 'ecs-daemon.log');
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
// 内存检测
// ============================================================
function getFreeMemoryMB() {
  try {
    const total = os.totalmem();
    const free = os.freemem();
    return Math.floor(free / 1024 / 1024);
  } catch {
    return 9999; // fallback
  }
}

function hasEnoughMemory(threshold = MEMORY_FLOOR_MB) {
  const free = getFreeMemoryMB();
  if (free < threshold) {
    log(`内存不足: 可用 ${free}MB < ${threshold}MB，跳过重资源操作`, 'WARN');
    return false;
  }
  return true;
}

// ============================================================
// Git 操作（ECS 版：轻量化，只推送数据文件）
// ============================================================
function gitPull() {
  try {
    // 拉取 watcher 可能推送的配置更新
    const out = execSync('git pull --rebase origin main', {
      cwd: PROJECT_ROOT, timeout: 60000, encoding: 'utf-8',
    });
    const lines = out.trim().split('\n');
    const status = lines[lines.length - 1] || 'up to date';
    log(`git pull: ${status}`);
    return true;
  } catch (e) {
    const errMsg = String(e.message || e).split('\n')[0];
    log(`git pull: ${errMsg}`, 'WARN');
    try {
      execSync('git fetch origin main', { cwd: PROJECT_ROOT, timeout: 30000, stdio: 'pipe' });
      execSync('git reset --hard origin/main', { cwd: PROJECT_ROOT, timeout: 10000, stdio: 'pipe' });
      log('git pull 降级为 fetch + reset');
      return true;
    } catch {
      return false;
    }
  }
}

function gitPush() {
  try {
    const filesToAdd = [
      'regulatory-hot/public/data/',
      'regulatory-hot/regulatory.db',
      'regulatory-hot/prisma/',
      'config/mp_fakeid_cache.json',
    ];
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
    execSync(`git commit -m "🔄 ECS同步 [${ts}]"`, { cwd: PROJECT_ROOT });
    execSync('git push origin main', { cwd: PROJECT_ROOT, timeout: 120000 });
    log(`git push 成功 (${diff.split('\n').length} 个文件)`);
    return true;
  } catch (e) {
    const msg = e.message || String(e);
    log(`git push 失败: ${msg.split('\n')[0]}`, 'WARN');
    // 冲突 → rebase 重试
    if (msg.includes('rejected') || msg.includes('non-fast-forward')) {
      gitPull();
      try {
        execSync('git push origin main', { cwd: PROJECT_ROOT, timeout: 120000 });
        log('git push 重试成功');
        return true;
      } catch {}
    }
    return false;
  }
}

// ============================================================
// 微信文章导入（本地文件，不需要 git pull）
// ============================================================
async function importWechatArticles() {
  if (!fs.existsSync(WECHAT_FILE)) {
    log('wechat-articles.json 不存在，跳过微信导入');
    return { inserted: 0, skipped: 0 };
  }

  // 检查文件是否被 watcher 更新过（> 30 分钟内）
  try {
    const stat = fs.statSync(WECHAT_FILE);
    const ageMin = (Date.now() - stat.mtimeMs) / 60000;
    if (ageMin < 5) log(`wechat-articles.json 最近 ${ageMin.toFixed(0)} 分钟前更新`);
  } catch {}

  let articles;
  try {
    articles = JSON.parse(fs.readFileSync(WECHAT_FILE, 'utf-8'));
  } catch (e) {
    log(`wechat-articles.json 解析失败: ${e.message}`, 'ERROR');
    return { inserted: 0, skipped: 0 };
  }

  if (!Array.isArray(articles) || articles.length === 0) {
    return { inserted: 0, skipped: 0 };
  }

  const valid = articles.filter(a => a.link && a.title);
  if (valid.length === 0) return { inserted: 0, skipped: 0 };

  try {
    const { wechatToDb, insertEvents, disconnectPrisma } = require('./db_writer.cjs');
    const dbEvents = valid.map(a => wechatToDb(a));
    const result = await insertEvents(dbEvents);
    await disconnectPrisma();
    log(`微信导入: +${result.inserted}, 跳过 ${result.skipped} (共 ${articles.length} 篇)`);
    return result;
  } catch (e) {
    log(`微信导入失败: ${e.message}`, 'ERROR');
    return { inserted: 0, skipped: 0 };
  }
}

// ============================================================
// FDA 采集（支持内存保护降级）
// ============================================================
async function runFdaCollect() {
  const memOK = hasEnoughMemory(MEMORY_FLOOR_MB);
  // 内存不足时用 RSS-only 模式（跳过 Playwright Chromium）
  const args = memOK ? ['scripts/collect_fda.cjs', '--no-ai'] : ['scripts/collect_fda.cjs', '--rss-only', '--no-ai'];

  if (!memOK) log('FDA 降级为 RSS-only（内存保护）', 'WARN');
  else log('=== FDA 采集 ===');

  return new Promise((resolve) => {
    const child = spawn('node', args, {
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
      const keyLines = stdout.split('\n').filter(l =>
        l.includes('✓') || l.includes('完成') || l.includes('新增') || l.includes('DB') || l.includes('跳过')
      );
      for (const l of keyLines.slice(-6)) log(`  ${l.trim()}`);

      if (code !== 0) {
        const errPreview = stderr.slice(-500);
        log(`FDA 采集异常 (exit ${code})${errPreview ? ': ' + errPreview.split('\n')[0] : ''}`, 'ERROR');

        // Chromium 崩溃 → 自动降级重试
        if (!memOK === false && (errPreview.includes('chromium') || errPreview.includes('browser') || errPreview.includes('playwright'))) {
          log('Chromium 不可用，降级为 RSS-only 重试...', 'WARN');
          resolve(runFdaCollectRssOnly());
          return;
        }
      } else {
        log('FDA 采集完成');
      }
      resolve(code);
    });

    child.on('error', (err) => {
      log(`FDA 采集启动失败: ${err.message}`, 'ERROR');
      resolve(-1);
    });
  });
}

async function runFdaCollectRssOnly() {
  return new Promise((resolve) => {
    const child = spawn('node', ['scripts/collect_fda.cjs', '--rss-only', '--no-ai'], {
      cwd: PROJECT_ROOT, stdio: 'pipe', shell: true, env: { ...process.env },
    });
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.on('close', (code) => {
      const keyLines = stdout.split('\n').filter(l => l.includes('完成') || l.includes('DB') || l.includes('新增') || l.includes('跳过'));
      for (const l of keyLines.slice(-4)) log(`  ${l.trim()}`);
      log(`FDA RSS 降级完成 (exit ${code})`);
      resolve(code);
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
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stdout += d.toString(); });

    child.on('close', (code) => {
      const keyLines = stdout.split('\n').filter(l =>
        l.includes('分析') || l.includes('完成') || l.includes('跳过') || l.includes('费用') || l.includes('pending') || l.includes('total')
      );
      for (const l of keyLines.slice(-5)) log(`  ${l.trim()}`);

      if (code !== 0 && !stdout.includes('所有事件已完成分析')) {
        log(`AI 分析异常 (exit ${code})`, 'WARN');
      } else {
        log('AI 分析完成');
      }
      resolve(code);
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
  const freeMem = getFreeMemoryMB();

  log(`\n${'='.repeat(60)}`);
  log(`第 ${cycleNum} 轮 | 可用内存 ${freeMem}MB | FDA: ${isFdaRound ? '✅' : '⏭️(下次第'+nextFdaRound+'轮)'}`);
  log(`${'='.repeat(60)}`);

  // 1. git pull（同步配置更新）
  log('[1/5] git pull...');
  gitPull();

  // 2. 微信导入（本地直读，不需要 pull）
  log('[2/5] 微信文章导入...');
  const wxResult = await importWechatArticles();

  // 3. FDA 采集
  if (isFdaRound) {
    log('[3/5] FDA 采集...');
    await runFdaCollect();
  } else {
    log(`[3/5] FDA 跳过`);
  }

  // 4. AI 分析
  log('[4/5] AI 分析...');
  await runAiAnalysis();

  // 5. git push（备份）
  log('[5/5] git push...');
  gitPush();

  const elapsed = Date.now() - startTime;
  log(`本轮完成: 微信 +${wxResult.inserted || 0} | FDA ${isFdaRound ? '已采集' : '跳过'} | 耗时 ${timeStr(elapsed)}`);
  log(`${'='.repeat(60)}\n`);
}

// ============================================================
// 环境检查
// ============================================================
function checkEnvironment() {
  const checks = [];

  try { execSync('git status', { cwd: PROJECT_ROOT, timeout: 5000, stdio: 'pipe' }); checks.push('✅ Git'); }
  catch { checks.push('❌ Git'); }

  checks.push(fs.existsSync(DB_FILE) ? `✅ regulatory.db (${(fs.statSync(DB_FILE).size/1024/1024).toFixed(1)}MB)` : '⚠️ DB 待创建');

  checks.push(process.env.SILICONFLOW_API_KEY ? '✅ API Key' : '❌ API Key 未配');

  const freeMem = getFreeMemoryMB();
  checks.push(`✅ 可用内存 ${freeMem}MB` + (freeMem < MEMORY_FLOOR_MB ? ' ⚠️低于安全线' : ''));

  log('环境检查:');
  for (const c of checks) log(`  ${c}`);
  log('');

  if (!process.env.SILICONFLOW_API_KEY) {
    log('❌ 缺少 SILICONFLOW_API_KEY', 'ERROR');
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
  log('║  ECS 守护进程 v1.0 — 全自动采集+分析+同步         ║');
  log('╚══════════════════════════════════════════════════╝');
  log(`周期: ${CYCLE_INTERVAL_MIN}min | FDA: 每 ${FDA_INTERVAL_CYCLES} 轮 | AI: ${ANALYZE_LIMIT} 条/轮 | 内存底线: ${MEMORY_FLOOR_MB}MB`);

  // 加载 .env
  try {
    const envFile = path.join(PROJECT_ROOT, 'regulatory-hot', '.env');
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

  if (!checkEnvironment()) {
    log('环境检查未通过', 'ERROR');
    process.exit(1);
  }

  const args = process.argv.slice(2);

  // 单次模式
  if (args.includes('--once') || args.includes('--fda-only') || args.includes('--ai-only')) {
    if (args.includes('--fda-only')) {
      log('模式: FDA Only');
      gitPull();
      await runFdaCollect();
      await runAiAnalysis();
      gitPush();
    } else if (args.includes('--ai-only')) {
      log('模式: AI Only');
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

  // 常驻模式
  log('模式: 常驻 (PM2)');
  let cycleNum = 0;
  await mainCycle(cycleNum);
  cycleNum++;

  const intervalMs = CYCLE_INTERVAL_MIN * 60 * 1000;
  setInterval(async () => {
    await mainCycle(cycleNum);
    cycleNum++;
  }, intervalMs);

  log(`✅ ECS 守护进程已启动，每 ${CYCLE_INTERVAL_MIN} 分钟一轮`);
  log(`   下一轮: ${new Date(Date.now() + intervalMs).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`);
}

process.on('uncaughtException', (e) => {
  log(`未捕获异常: ${e.message}`, 'ERROR');
  log(e.stack, 'ERROR');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log(`未处理 Promise 拒绝: ${reason}`, 'ERROR');
});

main().catch((e) => {
  log(`启动失败: ${e.message}`, 'ERROR');
  process.exit(1);
});
