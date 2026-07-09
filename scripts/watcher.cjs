/**
 * 微信公众号轮询守护进程 v1.0
 *
 * 部署在阿里云 ECS，每 30 分钟轮询一次 wechat-article-exporter，
 * 发现新文章自动写入数据库并推送到 GitHub。
 *
 * 用法：
 *   node scripts/watcher.cjs                # 常驻模式（每30分钟轮询+每日发现）
 *   node scripts/watcher.cjs --once          # 单次模式（手动触发）
 *   node scripts/watcher.cjs --discover      # 仅发现模式（扫描新公众号）
 *   node scripts/watcher.cjs --interval=5    # 自定义间隔（分钟）
 *
 * 增加公众号（自动发现 + 手动两种方式）：
 *   【自动发现】在 wechat-exporter 后台搜索并关注新公众号后，
 *              watcher 的下一次发现扫描（每周期/每日）会自动检测到
 *              并添加到 mp_watch.json + mp_fakeid_cache.json
 *   【手动添加】编辑 config/mp_watch.json + mp_fakeid_cache.json
 *              git push → watcher 下个周期自动生效
 *
 * 环境变量：
 *   WX_EXPORTER_URL    - wechat-exporter 地址（默认 https://127.0.0.1:3443）
 *   WX_AUTH_KEY        - 认证密钥
 *   GITHUB_TOKEN       - GitHub Personal Access Token（用于 push）
 *   WATCHER_INTERVAL   - 轮询间隔（分钟，默认 30）
 *   WATCHER_ARTICLE_LIMIT - 每次拉取篇数（默认 5）
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============ 配置 ============
const PROJECT_ROOT = path.join(__dirname, '..');
const EXPORTER_URL = process.env.WX_EXPORTER_URL || 'https://127.0.0.1:3443';
const WATCH_INTERVAL_MIN = parseInt(process.env.WATCHER_INTERVAL || '30');
const ARTICLE_LIMIT = parseInt(process.env.WATCHER_ARTICLE_LIMIT || '5');
const CONTENT_CONCURRENCY = parseInt(process.env.CONTENT_CONCURRENCY || '3');
const CONTENT_MAX_CHARS = parseInt(process.env.CONTENT_MAX_CHARS || '30000');

const AUTH_KEY = process.env.WX_AUTH_KEY || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

const MP_WATCH_FILE = path.join(PROJECT_ROOT, 'config', 'mp_watch.json');
const FAKEID_CACHE_FILE = path.join(PROJECT_ROOT, 'config', 'mp_fakeid_cache.json');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'regulatory-hot', 'public', 'data', 'wechat-articles.json');
const STATE_FILE = path.join(PROJECT_ROOT, 'regulatory-hot', 'public', 'data', '.watcher-state.json');

// 解析 URL
const urlObj = new URL(EXPORTER_URL);
const EXPORTER_PROTOCOL = urlObj.protocol.replace(':', '');
const EXPORTER_HOST = urlObj.hostname;
const EXPORTER_PORT = parseInt(urlObj.port) || (EXPORTER_PROTOCOL === 'https' ? 443 : 80);

// ============ 日志 ============
function log(level, ...args) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level}]`;
  const msg = args.join(' ');
  if (level === 'ERROR') console.error(prefix, msg);
  else console.log(prefix, msg);
}

// ============ HTTP ============
function httpRequest({ path, method = 'GET', timeout = 30000 }) {
  return new Promise((resolve, reject) => {
    const transport = EXPORTER_PROTOCOL === 'https' ? https : http;
    const rejectUnauthorized = process.env.WX_TLS_REJECT_UNAUTHORIZED === '1';
    const req = transport.request(
      { host: EXPORTER_HOST, port: EXPORTER_PORT, path, method, headers: { 'Accept': 'application/json, */*', 'Cookie': `auth-key=${AUTH_KEY}`, 'X-Auth-Key': AUTH_KEY }, timeout, rejectUnauthorized: rejectUnauthorized !== false },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode, data }));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${path}`)); });
    req.end();
  });
}

async function apiGet(endpoint, params = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const p = qs ? `${endpoint}?${qs}` : endpoint;
  const res = await httpRequest({ path: p, method: 'GET' });
  try { return { status: res.status, data: JSON.parse(res.data) }; }
  catch { return { status: res.status, data: null, error: 'parse_error' }; }
}

// ============ 文件 I/O ============
function readJson(filePath, fallback = null) {
  try { if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch (e) { log('WARN', `读取失败: ${filePath} — ${e.message}`); }
  return fallback;
}

function writeJson(filePath, obj) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

// ============ 公众号列表加载 ============
function loadWatchList() {
  const cfg = readJson(MP_WATCH_FILE);
  if (!cfg || !cfg.accounts) {
    log('ERROR', 'config/mp_watch.json 不存在或格式错误');
    process.exit(1);
  }
  return cfg.accounts;
}

function loadFakeidCache() {
  return readJson(FAKEID_CACHE_FILE, {});
}

function saveFakeidCache(cache) {
  writeJson(FAKEID_CACHE_FILE, cache);
}

async function resolveFakeids(accounts, cache) {
  const resolved = [];
  const missing = [];

  for (const a of accounts) {
    const fakeid = cache[a.name] || null;
    resolved.push({ ...a, fakeid });
    if (!fakeid) missing.push(a);
  }

  if (missing.length === 0) return resolved;

  log('INFO', `${missing.length} 个公众号缺少 fakeid，尝试 API 搜索...`);
  const keywords = ['a', '医', '药', '健', '中', '监', '保', '政', '局', '审'];
  let allResults = [];

  for (const kw of keywords) {
    if (allResults.length >= 50) break;
    const result = await apiGet('/api/public/v1/account', { keyword: kw, begin: 0, size: 20 });
    if (result.data?.ret === 200003) { log('ERROR', 'Auth-key 已过期'); process.exit(2); }
    const list = result.data?.list || [];
    for (const item of list) {
      if (item.fakeid && !allResults.find(r => r.fakeid === item.fakeid)) {
        allResults.push(item);
      }
    }
  }

  let found = 0;
  for (const a of resolved) {
    if (a.fakeid) continue;
    const matched = allResults.find(r => {
      const n = (r.nickname || r.name || '').trim();
      return n === a.name || n.includes(a.name) || a.name.includes(n);
    });
    if (matched) {
      a.fakeid = matched.fakeid;
      cache[a.name] = matched.fakeid;
      found++;
    }
  }

  if (found > 0) {
    saveFakeidCache(cache);
    log('INFO', `自动解析 ${found} 个 fakeid，已写入缓存`);
  }

  const stillMissing = resolved.filter(a => !a.fakeid);
  if (stillMissing.length > 0) {
    log('WARN', `${stillMissing.length} 个公众号仍无 fakeid: ${stillMissing.map(a => a.name).join(', ')}`);
  }

  return resolved;
}

// ============ 公众号自动发现 ============
const DISCOVERY_KEYWORDS = [
  // 药监官方
  '国家药监局', '药监局', '药品监管', '医疗器械', '药品审评', '药审中心',
  // 医保
  '医保', '国家医保', '医疗保障',
  // 医药行业
  '医药', '制药', '药企', '药企动态', '创新药', '仿制药', '生物药',
  '中药', '化药', '疫苗', '基因治疗', '细胞治疗', 'ADC',
  // 器械
  '医疗器械', 'IVD', '体外诊断', '影像设备', '高值耗材',
  // 合规/法规
  'GMP', 'GSP', 'GLP', 'GCP', '飞行检查', '药品召回',
  // 行业媒体/平台
  '医药经济', '医药政策', '药闻', '蒲公英', '赛柏蓝', '医药魔方',
  '识林', '健识局', '医药经理人',
  // 国际监管
  'FDA', 'EMA', 'NMPA', 'ICH', 'PIC/S', 'WHO',
  // 泛医疗
  '医院', '临床', '处方', '药店', '医药流通',
];

// 黑名单：明显不相关的公众号（按昵称关键词过滤）
const DISCOVERY_BLACKLIST = [
  '美食', '旅游', '电影', '音乐', '游戏', '体育', '汽车', '房产',
  '教育', '培训', '招聘', '保险', '理财', '股票',
];

function isPharmaRelated(name) {
  if (!name) return false;
  const lower = name.toLowerCase();
  for (const kw of DISCOVERY_BLACKLIST) {
    if (lower.includes(kw)) return false;
  }
  // 检查是否包含医药相关关键词
  const pharmaKeywords = ['药', '医', '健', '疗', '临床', '制药', '器械', '监管', '审批'];
  return pharmaKeywords.some(k => lower.includes(k));
}

async function discoverAccounts() {
  log('INFO', '======== 开始公众号发现扫描 ========');
  const watchList = loadWatchList();
  const fakeidCache = loadFakeidCache();
  const trackedNames = new Set(watchList.map(a => a.name));
  let discovered = [];
  const seen = new Set();

  for (const kw of DISCOVERY_KEYWORDS) {
    try {
      const result = await apiGet('/api/public/v1/account', { keyword: kw, begin: 0, size: 20 });
      if (result.data?.ret === 200003) {
        log('ERROR', 'Auth-key 已过期，停止发现');
        break;
      }
      const list = result.data?.list || [];
      for (const item of list) {
        if (!item.fakeid || seen.has(item.fakeid)) continue;
        seen.add(item.fakeid);
        const name = (item.nickname || item.name || '').trim();
        if (!name || trackedNames.has(name)) continue;
        if (!isPharmaRelated(name)) continue;

        discovered.push({
          name,
          fakeid: item.fakeid,
          roundHeadImg: item.round_head_img || '',
          keyword: kw,
        });
      }
    } catch (e) {
      // 单个关键词失败不影响整体
    }
  }

  if (discovered.length === 0) {
    log('INFO', `发现扫描完成: 0 个新公众号`);
    return { added: 0, discovered: [] };
  }

  log('INFO', `发现 ${discovered.length} 个候选公众号`);

  // 去重：按名称去重，保留第一个
  const unique = [];
  const namesSeen = new Set();
  for (const d of discovered) {
    if (namesSeen.has(d.name)) continue;
    namesSeen.add(d.name);
    unique.push(d);
  }

  // 自动添加到配置
  const newAccounts = [];
  for (const d of unique) {
    fakeidCache[d.name] = d.fakeid;
    newAccounts.push({
      name: d.name,
      category: 'insight',  // 默认分类，用户可手动调整
      level: 'T3',          // 默认等级，用户可手动调整
      country: 'CN',
      desc: `自动发现 (关键词: ${d.keyword})`,
    });
  }

  // 写入配置
  const existing = readJson(MP_WATCH_FILE);
  existing.accounts.push(...newAccounts);
  writeJson(MP_WATCH_FILE, existing);
  saveFakeidCache(fakeidCache);

  log('INFO', `自动添加 ${newAccounts.length} 个新公众号:`);
  for (const a of newAccounts) {
    log('INFO', `  + ${a.name} [${fakeidCache[a.name]}]`);
  }

  return { added: newAccounts.length, discovered: newAccounts };
}
function extractPublishTime(item) {
  const ts = item.create_time || item.update_time || item.send_time;
  if (typeof ts === 'number' && ts > 0) {
    if (ts > 1e12) return new Date(ts);
    if (ts > 1e9) return new Date(ts * 1000);
  }
  if (typeof ts === 'string') { const d = new Date(ts); if (!isNaN(d.getTime())) return d; }
  return null;
}

async function fetchArticles(fakeid) {
  const result = await apiGet('/api/public/v1/article', { fakeid, begin: 0, size: ARTICLE_LIMIT });
  if (result.data?.ret === 200003) { log('ERROR', 'Session 过期'); process.exit(2); }

  let items = result.data?.articles
    || result.data?.data?.articles
    || result.data?.app_msg_list
    || result.data?.data?.app_msg_list
    || [];

  if (!Array.isArray(items)) return [];

  // 拆 multi_app_msg_item_list
  const flat = [];
  for (const it of items) {
    flat.push({ ...it, _is_main: true });
    const subs = it.multi_app_msg_item_list || [];
    for (const sub of subs) flat.push({ ...sub, msg_id: sub.aid || sub.appmsgid, _is_main: false });
  }
  return flat;
}

function normalizeArticle(item, mp) {
  const articleId = String(item.msg_id || item.aid || item.appmsgid || '');
  const pubTime = extractPublishTime(item);
  return {
    id: articleId,
    title: (item.title || '').trim(),
    link: item.link || (articleId ? `https://mp.weixin.qq.com/s/${articleId}` : ''),
    publishTime: pubTime ? pubTime.toISOString() : new Date().toISOString(),
    source: 'wechat',
    contentType: 'article',
    sourceName: mp.name,
    sourceId: mp.fakeid,
    sourceLevel: mp.level,
    sourceCategory: mp.category,
    sourceCountry: mp.country,
    sourceDesc: mp.desc || '',
    digest: (item.digest || '').trim(),
    coverUrl: item.cover || item.pic_url || '',
    readCount: item.read_num || 0,
    likeCount: item.like_num || 0,
    contentMarkdown: '',
    contentMarkdownStatus: 'pending',
    _collectedAt: new Date().toISOString(),
    _collectionMode: 'watcher',
  };
}

// ============ 正文抓取 ============
async function fetchContent(url) {
  try {
    const res = await apiGet('/api/public/v1/download', { url, format: 'markdown' });
    if (res.status === 200 && typeof res.data === 'string') {
      let md = res.data;
      if (md.length > CONTENT_MAX_CHARS) md = md.slice(0, CONTENT_MAX_CHARS) + '\n\n...(截断)...';
      return md;
    }
    return null;
  } catch { return null; }
}

async function concurrentMap(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) break;
      results[i] = await mapper(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

// ============ 状态管理 ============
function loadState() {
  return readJson(STATE_FILE, { version: 1, accounts: {} });
}

function saveState(state) {
  writeJson(STATE_FILE, state);
}

// ============ 合并输出 ============
function mergeOutput(newArticles) {
  let existing = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    try { existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8')); } catch {}
  }
  if (!Array.isArray(existing)) existing = [];

  const existingLinks = new Set(existing.map(a => a.link).filter(Boolean));
  const trulyNew = newArticles.filter(a => a.link && !existingLinks.has(a.link));

  return [...trulyNew, ...existing]
    .sort((a, b) => new Date(b.publishTime || 0) - new Date(a.publishTime || 0))
    .slice(0, 1000);
}

// ============ Git 操作 ============
function gitPull() {
  try {
    const out = execSync('git pull --rebase origin main', { cwd: PROJECT_ROOT, timeout: 30000, encoding: 'utf-8' });
    log('INFO', `git pull: ${out.trim().split('\n').pop() || 'up to date'}`);
    return true;
  } catch (e) {
    log('ERROR', `git pull 失败: ${e.message}`);
    return false;
  }
}

function gitCommitAndPush() {
  try {
    // 设置 git 环境
    const env = { ...process.env };
    if (GITHUB_TOKEN) {
      // 使用 token 认证的 remote URL
      const currentUrl = execSync('git remote get-url origin', { cwd: PROJECT_ROOT, encoding: 'utf-8' }).trim();
      const match = currentUrl.match(/github\.com[:/](.+?)\/(.+?)(?:\.git)?$/);
      if (match) {
        const tokenUrl = `https://x-access-token:${GITHUB_TOKEN}@github.com/${match[1]}/${match[2]}.git`;
        execSync(`git remote set-url origin "${tokenUrl}"`, { cwd: PROJECT_ROOT });
      }
    }

    execSync('git add config/mp_fakeid_cache.json regulatory-hot/public/data/', { cwd: PROJECT_ROOT });
    const diff = execSync('git diff --staged --name-only', { cwd: PROJECT_ROOT, encoding: 'utf-8' }).trim();

    if (!diff) {
      log('INFO', 'git: 无变更，跳过 commit');
      return true;
    }

    const ts = new Date().toISOString();
    execSync(`git commit -m "📱 守护进程同步 [${ts}]"`, { cwd: PROJECT_ROOT });
    execSync('git push origin main', { cwd: PROJECT_ROOT, timeout: 30000 });
    log('INFO', `git push 成功 (${diff.split('\n').length} 个文件)`);
    return true;
  } catch (e) {
    log('ERROR', `git push 失败: ${e.message}`);
    return false;
  }
}

// ============ 主循环 ============
async function pollingCycle(cycleNum) {
  const startTime = Date.now();
  log('INFO', `======== 第 ${cycleNum} 轮轮询开始 ========`);

  // 0. git pull 同步最新配置和数据
  if (!gitPull()) {
    log('WARN', 'git pull 失败，继续使用本地数据');
  }

  // 1. 加载配置
  const watchList = loadWatchList();
  const fakeidCache = loadFakeidCache();

  // 2. 解析 fakeid
  const accounts = await resolveFakeids(watchList, fakeidCache, cycleNum);
  const state = loadState();

  // 3. 逐公众号采集
  let totalNew = 0;
  const allNewArticles = [];
  const newStates = {};

  for (const mp of accounts) {
    if (!mp.fakeid) {
      log('WARN', `[${mp.name}] 跳过（无 fakeid）`);
      continue;
    }

    const items = await fetchArticles(mp.fakeid);
    if (items.length === 0) {
      log('INFO', `[${mp.name}] 0 篇`);
      newStates[mp.fakeid] = { name: mp.name, lastArticleId: state.accounts[mp.fakeid]?.lastArticleId || null, lastCheck: new Date().toISOString() };
      continue;
    }

    // ID 去重：从上一次的 lastArticleId 之后的都是新的
    const lastKnownId = state.accounts[mp.fakeid]?.lastArticleId || null;
    const newItems = [];
    for (const item of items) {
      const id = String(item.msg_id || item.aid || item.appmsgid || '');
      if (id === lastKnownId) break;  // 命中已知 ID，后续都是旧文章
      newItems.push(item);
    }

    if (newItems.length === 0) {
      log('INFO', `[${mp.name}] ${items.length} 篇 → 0 篇新 (缓存命中)`);
      newStates[mp.fakeid] = { name: mp.name, lastArticleId: lastKnownId, lastCheck: new Date().toISOString() };
      continue;
    }

    // 记录最新 ID
    const latestId = String(newItems[0].msg_id || newItems[0].aid || newItems[0].appmsgid || '');

    for (const item of newItems) {
      allNewArticles.push(normalizeArticle(item, mp));
    }

    log('INFO', `[${mp.name}] ${items.length} 篇 → ${newItems.length} 篇新`);
    newStates[mp.fakeid] = { name: mp.name, lastArticleId: latestId, lastCheck: new Date().toISOString() };
  }

  totalNew = allNewArticles.length;
  log('INFO', `共 ${totalNew} 篇新文章`);

  // 4. 抓正文
  if (allNewArticles.length > 0) {
    log('INFO', `并发抓正文 (${CONTENT_CONCURRENCY} 路)...`);
    let progress = 0;
    await concurrentMap(allNewArticles, CONTENT_CONCURRENCY, async (a) => {
      if (!a.link) return a;
      const md = await fetchContent(a.link);
      if (md) {
        a.contentMarkdown = md;
        a.contentMarkdownFetchedAt = new Date().toISOString();
        a.contentMarkdownStatus = 'ok';
      } else {
        a.contentMarkdownStatus = 'failed';
      }
      progress++;
      if (progress % 5 === 0 || progress === allNewArticles.length) {
        log('INFO', `  正文: ${progress}/${allNewArticles.length}`);
      }
      return a;
    });
    const okCount = allNewArticles.filter(a => a.contentMarkdownStatus === 'ok').length;
    log('INFO', `正文完成: ${okCount}/${allNewArticles.length}`);
  }

  // 5. 更新状态
  state.accounts = { ...state.accounts, ...newStates };
  saveState(state);

  // 6. 写入数据文件
  if (allNewArticles.length > 0) {
    const merged = mergeOutput(allNewArticles);
    log('INFO', `wechat-articles.json: +${allNewArticles.length}, 累计 ${merged.length}`);
    writeJson(OUTPUT_FILE, merged);

    // 写入数据库
    try {
      const { wechatToDb, insertEvents, logCrawl, disconnectPrisma } = require('./db_writer.cjs');
      const dbEvents = allNewArticles.map(a => wechatToDb(a));
      const dbResult = await insertEvents(dbEvents);
      log('INFO', `DB: +${dbResult.inserted}, 跳过 ${dbResult.skipped}`);
      await logCrawl('watcher', {
        startedAt: new Date(startTime).toISOString(),
        status: 'success',
        total: allNewArticles.length,
        inserted: dbResult.inserted,
        skipped: dbResult.skipped,
        durationMs: Date.now() - startTime,
      });
      await disconnectPrisma();
    } catch (e) {
      log('WARN', `DB 写入失败: ${e.message}`);
    }
  }

  // 7. git commit + push
  gitCommitAndPush();

  // 8. 每日自动发现（48个周期 = 24小时，在午夜附近运行一次）
  const hoursFromCycle = Math.floor((cycleNum * WATCH_INTERVAL_MIN) / 60);
  const lastDiscoverCycle = readJson(STATE_FILE.replace('.json', '-discover.json'), { lastCycle: -1000 }).lastCycle;
  if (cycleNum - lastDiscoverCycle >= 48) {  // 每48个周期=24小时一次
    try {
      const discoverResult = await discoverAccounts();
      if (discoverResult.added > 0) {
        gitCommitAndPush();  // 发现的新公众号也需要 push
      }
      writeJson(STATE_FILE.replace('.json', '-discover.json'), { lastCycle: cycleNum });
    } catch (e) {
      log('WARN', `自动发现失败: ${e.message}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log('INFO', `======== 第 ${cycleNum} 轮完成: +${totalNew} 篇, ${elapsed}s ========\n`);
}

// ============ 入口 ============
async function main() {
  log('INFO', `守护进程启动 — 间隔 ${WATCH_INTERVAL_MIN} 分钟, 每号 ${ARTICLE_LIMIT} 篇`);
  log('INFO', `Exporter: ${EXPORTER_URL}`);

  if (!AUTH_KEY) {
    log('ERROR', 'WX_AUTH_KEY 未配置');
    process.exit(1);
  }

  // 验证 auth
  const authCheck = await apiGet('/api/public/v1/authkey');
  if (authCheck.data?.code !== 0) {
    log('ERROR', `Auth-key 验证失败: ${JSON.stringify(authCheck.data)}`);
    process.exit(2);
  }
  log('INFO', 'Auth-key 有效');

  // 单次模式
  if (process.argv.includes('--once')) {
    // 单次模式也执行发现
    try {
      const discoverResult = await discoverAccounts();
      if (discoverResult.added > 0) {
        gitCommitAndPush();
      }
    } catch (e) {
      log('WARN', `自动发现失败: ${e.message}`);
    }
    await pollingCycle(0);
    log('INFO', '单次模式结束');
    process.exit(0);
  }

  // 仅发现模式
  if (process.argv.includes('--discover')) {
    const result = await discoverAccounts();
    gitCommitAndPush();
    log('INFO', `发现模式完成: +${result.added} 个新公众号`);
    for (const a of result.discovered) {
      console.log(`  ${a.name} (${a.category} / ${a.level})`);
    }
    process.exit(0);
  }

  // 自定义间隔
  const intervalArg = process.argv.find(a => a.startsWith('--interval='));
  const intervalMs = (intervalArg ? parseInt(intervalArg.split('=')[1]) : WATCH_INTERVAL_MIN) * 60 * 1000;

  // 常驻模式：立即运行一次，然后按间隔循环
  let cycleNum = 0;
  await pollingCycle(cycleNum);
  cycleNum++;

  setInterval(async () => {
    await pollingCycle(cycleNum);
    cycleNum++;
  }, intervalMs);

  log('INFO', `轮询已启动，每 ${intervalMs / 60000} 分钟一次`);
}

// 进程保活
process.on('uncaughtException', (e) => {
  log('ERROR', `未捕获异常: ${e.message}\n${e.stack}`);
  // PM2 会自动重启
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log('ERROR', `未处理的 Promise 拒绝: ${reason}`);
});

main().catch((e) => {
  log('ERROR', `启动失败: ${e.message}`);
  process.exit(1);
});
