/**
 * 微信公众号智能采集脚本 v4.0
 *
 * 根据当前北京时间自动判断采集模式：
 *   日间 (0:30~23:59) → 增量模式：只抓过去 31 分钟的新文章
 *   零点 (0:00~0:29)  → 全量模式：拉昨天一整天的文章（兜底）
 *
 * 部署：GitHub Actions cron — 每 30 分钟触发
 *   cron: '0,30 * * * *'  (UTC 16:00~15:30 → 北京 0:00~23:30)
 *
 * 关键改进（相比 v3.1 / delta）：
 *   - 不需要阿里云 cron，全部 GitHub Actions 驱动
 *   - 延迟 ≤ 30 分钟（增量）+ 每天0点全量兜底
 *   - 增量模式轻量：5 篇/号，31 分钟窗口，~15s 完成
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const PROJECT_ROOT = path.join(__dirname, '..');
const EXPORTER_HOST = process.env.WX_EXPORTER_HOST || '47.107.133.169';
const EXPORTER_PORT = parseInt(process.env.WX_EXPORTER_PORT || '3443');
const EXPORTER_PROTOCOL = process.env.WX_EXPORTER_PROTOCOL || 'https';
const TLS_REJECT_UNAUTHORIZED = process.env.WX_TLS_REJECT_UNAUTHORIZED === '1';

const OUTPUT = process.env.OUTPUT_FILE
  || path.join(PROJECT_ROOT, 'regulatory-hot', 'public', 'data', 'wechat-articles.json');
const STATE_FILE = process.env.WX_STATE_FILE
  || path.join(PROJECT_ROOT, 'regulatory-hot', 'public', 'data', '.wechat-state.json');

const CONTENT_CONCURRENCY = parseInt(process.env.CONTENT_CONCURRENCY || '3');
const CONTENT_TIMEOUT_MS = parseInt(process.env.CONTENT_TIMEOUT_MS || '30000');
const CONTENT_MAX_CHARS = parseInt(process.env.CONTENT_MAX_CHARS || '30000');

const AUTH_KEY = process.env.WX_AUTH_KEY || process.env.WX_AUTH_KEY_FALLBACK || '';
if (!AUTH_KEY) {
  console.error('[wechat] WX_AUTH_KEY 未配置');
  process.exit(1);
}

const TARGET_MP_LIST = [
  { name: '中国药闻',   category: 'regulation', level: 'T1', country: 'CN' },
  { name: '中国药审',   category: 'approval',   level: 'T1', country: 'CN' },
  { name: '国家医保局', category: 'regulation', level: 'T1', country: 'CN' },
  { name: '蒲公英',     category: 'insight',    level: 'T2', country: 'CN' },
  { name: '医药魔方',   category: 'insight',    level: 'T2', country: 'CN' },
  { name: '赛柏蓝',     category: 'insight',    level: 'T2', country: 'CN' },
  { name: '识林',       category: 'regulation', level: 'T2', country: 'CN' },
  { name: '医药经济报', category: 'insight',    level: 'T2', country: 'CN' },
  { name: '健识局',     category: 'insight',    level: 'T2', country: 'CN' },
  { name: 'E药经理人',  category: 'insight',    level: 'T2', country: 'CN' },
];

// ============ 时间工具 ============
function beijingNow() {
  // 北京时间 = UTC + 8
  const now = new Date();
  now.setHours(now.getHours() + 8);
  return now;
}

function beijingISO(d) {
  // 返回北京时间的 ISO 字符串（伪装成 UTC）
  const bj = new Date(d);
  bj.setHours(bj.getHours() + 8);
  return bj.toISOString().replace('Z', '+08:00');
}

function todayBeijingStart() {
  const bj = beijingNow();
  bj.setHours(0, 0, 0, 0);
  bj.setHours(bj.getHours() - 8); // 转回 UTC
  return bj;
}

function yesterdayBeijingStart() {
  const bj = beijingNow();
  bj.setDate(bj.getDate() - 1);
  bj.setHours(0, 0, 0, 0);
  bj.setHours(bj.getHours() - 8);
  return bj;
}

function yesterdayBeijingEnd() {
  const bj = beijingNow();
  bj.setDate(bj.getDate() - 1);
  bj.setHours(23, 59, 59, 999);
  bj.setHours(bj.getHours() - 8);
  return bj;
}

/**
 * 判断当前北京时间是什么模式
 * @returns {{ mode: 'full'|'delta', label: string, params: object }}
 */
function detectMode() {
  const bj = beijingNow();
  const hour = bj.getHours();
  const minute = bj.getMinutes();

  if (hour === 0 && minute < 30) {
    // 零点前后 30 分钟 → 全量模式（拉昨天）
    const yesterday = new Date(bj);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    return {
      mode: 'full',
      label: `全量兜底 — ${dateStr}`,
      params: {
        articleLimit: 20,                  // 全量拉满
        windowStart: yesterdayBeijingStart(),
        windowEnd: yesterdayBeijingEnd(),
        description: `昨天 (${dateStr}) 全天文章`,
      },
    };
  }

  // 其他时间 → 增量模式（过去 31 分钟）
  const deltaMin = 31;
  const windowEnd = new Date(); // now (UTC)
  const windowStart = new Date(windowEnd.getTime() - deltaMin * 60 * 1000);
  return {
    mode: 'delta',
    label: `增量 — ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    params: {
      articleLimit: 5,                    // 增量轻量
      windowStart,
      windowEnd,
      description: `过去 ${deltaMin} 分钟 (${windowStart.toISOString().slice(11, 19)}~${windowEnd.toISOString().slice(11, 19)} UTC)`,
    },
  };
}

// ============ 工具函数 ============
function ensureDir(p) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ============ 状态管理 ============
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {}
  return { version: 1, accounts: {}, lastFullRun: null };
}

function saveState(state) {
  ensureDir(STATE_FILE);
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ============ HTTP 客户端 ============
function httpRequest({ protocol, host, port, path, method = 'GET', headers = {}, timeout = 30000 }) {
  return new Promise((resolve, reject) => {
    const transport = protocol === 'https' ? https : http;
    const req = transport.request(
      { host, port, path, method, headers, timeout, rejectUnauthorized: TLS_REJECT_UNAUTHORIZED },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${method} ${path}`)); });
    req.end();
  });
}

async function apiGetJson(endpoint, params = {}, { timeout = 30000 } = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const p = qs ? `${endpoint}?${qs}` : endpoint;
  const res = await httpRequest({
    protocol: EXPORTER_PROTOCOL, host: EXPORTER_HOST, port: EXPORTER_PORT, path: p,
    method: 'GET', headers: { 'Accept': 'application/json, */*', 'Cookie': `auth-key=${AUTH_KEY}`, 'X-Auth-Key': AUTH_KEY },
    timeout,
  });
  try { return { status: res.status, data: JSON.parse(res.data) }; }
  catch { return { status: res.status, data: null, error: 'parse_error' }; }
}

// ============ 探活 ============
async function checkAuth() {
  const res = await apiGetJson('/api/public/v1/authkey', {}, { timeout: 10000 });
  return res.status === 200 && res.data?.code === 0;
}

// ============ fakeid 管理 ============
function loadFakeidCache() {
  const cachePath = path.join(PROJECT_ROOT, 'config', 'mp_fakeid_cache.json');
  try { if (fs.existsSync(cachePath)) return JSON.parse(fs.readFileSync(cachePath, 'utf-8')); } catch {}
  return {};
}

function saveFakeidCache(cache) {
  const cachePath = path.join(PROJECT_ROOT, 'config', 'mp_fakeid_cache.json');
  ensureDir(cachePath);
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

async function searchAccounts() {
  const probeKeywords = ['a', '医', '药', '健', '中', '监'];
  const seen = new Map();
  for (const kw of probeKeywords) {
    const result = await apiGetJson('/api/public/v1/account', { keyword: kw, begin: 0, size: 20 });
    if (result.data?.ret === 200003) return { expired: true };
    const list = result.data?.list || [];
    for (const a of list) {
      if (a.fakeid && !seen.has(a.fakeid)) seen.set(a.fakeid, a);
    }
    if (seen.size >= 10) break;
  }
  return { expired: false, accounts: Array.from(seen.values()) };
}

// ============ 文章采集 ============
async function fetchArticles(fakeid, mpName, limit) {
  const result = await apiGetJson('/api/public/v1/article', { fakeid, begin: 0, size: limit });
  if (result.data?.ret === 200003) return { expired: true, articles: [] };

  let items = result.data?.articles
    || result.data?.data?.articles
    || result.data?.app_msg_list
    || result.data?.data?.app_msg_list
    || [];

  if (!Array.isArray(items)) return { expired: false, articles: [] };

  // 拆 multi_app_msg_item_list
  const flat = [];
  for (const it of items) {
    flat.push(it);
    const subs = it.multi_app_msg_item_list || [];
    for (const sub of subs) flat.push({ ...sub, msg_id: sub.aid || sub.appmsgid });
  }
  return { expired: false, articles: flat };
}

// ============ 时间过滤 + 增量去重 ============
function extractPublishTime(item) {
  const ts = item.create_time || item.update_time || item.send_time;
  if (typeof ts === 'number' && ts > 0) {
    if (ts > 1e12) return new Date(ts);
    if (ts > 1e9) return new Date(ts * 1000);
  }
  if (typeof ts === 'string') { const d = new Date(ts); if (!isNaN(d.getTime())) return d; }
  return null;
}

function withinWindow(publishDate, windowStart, windowEnd) {
  if (!publishDate) return false;
  const t = publishDate.getTime();
  return t >= windowStart.getTime() && t <= windowEnd.getTime();
}

function isNewArticle(articleId, lastKnownId) {
  // 增量模式：如果 articleId === lastKnownId，说明我们上次已经见过，停止扫描
  if (!lastKnownId) return true; // 没有历史记录，全部算新
  return articleId !== lastKnownId;
}

// ============ 正文抓取 ============
async function fetchContent(url) {
  try {
    const res = await apiGetJson('/api/public/v1/download', { url, format: 'markdown' }, { timeout: CONTENT_TIMEOUT_MS });
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

// ============ 文章规范化 ============
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
    contentMarkdown: '',
    contentMarkdownStatus: 'pending',
    // 采集元信息
    _collectedAt: new Date().toISOString(),
    _collectionMode: null, // 稍后填入
  };
}

// ============ 合并到现有 ============
function mergeOutput(newArticles) {
  let existing = [];
  if (fs.existsSync(OUTPUT)) {
    try { existing = JSON.parse(fs.readFileSync(OUTPUT, 'utf-8')); } catch {}
  }
  if (!Array.isArray(existing)) existing = [];

  const existingLinks = new Set(existing.map(a => a.link).filter(Boolean));
  const trulyNew = newArticles.filter(a => a.link && !existingLinks.has(a.link));

  return [...trulyNew, ...existing]
    .sort((a, b) => new Date(b.publishTime || 0) - new Date(a.publishTime || 0))
    .slice(0, 1000);
}

// ============ 主流程 ============
async function main() {
  const startTime = Date.now();
  const { mode, label, params } = detectMode();

  console.log(`\n============================================================`);
  console.log(`  微信公众号智能采集 v4.0 — ${label}`);
  console.log(`  模式: ${mode.toUpperCase()} | ${params.description}`);
  console.log(`  限制: ${params.articleLimit} 篇/号`);
  console.log(`============================================================\n`);

  // 1. 探活
  if (!(await checkAuth())) {
    console.error('[wechat] Auth-key 失效，跳过');
    process.exit(2);
  }
  console.log('[wechat] Auth-key 有效\n');

  // 2. 加载 fakeid
  const fakeidCache = loadFakeidCache();
  const state = loadState();
  let cacheUpdated = false;

  for (const mp of TARGET_MP_LIST) {
    if (fakeidCache[mp.name]) mp.fakeid = fakeidCache[mp.name];
  }

  const missingFakeid = TARGET_MP_LIST.filter(m => !m.fakeid);
  if (missingFakeid.length > 0) {
    console.log(`[wechat] ${missingFakeid.length} 个公众号缺少 fakeid，搜索中...`);
    const { expired, accounts } = await searchAccounts();
    if (expired) { console.error('[wechat] 登录过期'); process.exit(2); }
    for (const mp of missingFakeid) {
      const matched = accounts.find(a => {
        const n = a.nickname || a.name || '';
        return n.includes(mp.name) || mp.name.includes(n);
      });
      if (matched) { mp.fakeid = matched.fakeid; fakeidCache[mp.name] = matched.fakeid; cacheUpdated = true; }
    }
    if (cacheUpdated) saveFakeidCache(fakeidCache);
  }

  // 3. 逐公众号采集
  let totalNewCount = 0;
  const allNewArticles = [];
  const accountStates = {};

  for (const mp of TARGET_MP_LIST) {
    if (!mp.fakeid) { console.log(`[wechat] [${mp.name}] 跳过（无 fakeid）`); continue; }

    const { expired, articles: items } = await fetchArticles(mp.fakeid, mp.name, params.articleLimit);
    if (expired) { console.error('[wechat] Session 过期'); process.exit(2); }

    // 时间窗口过滤
    const inWindow = items.filter(it => withinWindow(extractPublishTime(it), params.windowStart, params.windowEnd));
    console.log(`[wechat] [${mp.name}] 列表 ${items.length} → 窗口内 ${inWindow.length} 篇`);

    // 增量模式的去重优化：按 articleId 跳过已处理的
    const lastKnownId = state.accounts?.[mp.name]?.lastArticleId || null;
    let newArticles;
    if (mode === 'delta' && lastKnownId) {
      newArticles = [];
      for (const item of inWindow) {
        const id = String(item.msg_id || item.aid || item.appmsgid || '');
        if (id === lastKnownId) break; // 命中已知，后续都是已处理的
        newArticles.push(item);
      }
      if (newArticles.length < inWindow.length) {
        console.log(`[wechat]   → 增量: ${newArticles.length} 篇新 (命中缓存)`);
      }
    } else {
      newArticles = inWindow;
    }

    if (newArticles.length === 0) {
      accountStates[mp.name] = {
        fakeid: mp.fakeid,
        lastArticleId: lastKnownId,
        lastCheck: new Date().toISOString(),
      };
      continue;
    }

    // 记录最新 articleId
    const latestId = String(newArticles[0].msg_id || newArticles[0].aid || newArticles[0].appmsgid || '');

    for (const item of newArticles) {
      const article = normalizeArticle(item, mp);
      article._collectionMode = mode;
      allNewArticles.push(article);
    }
    totalNewCount += newArticles.length;
    accountStates[mp.name] = {
      fakeid: mp.fakeid,
      lastArticleId: latestId,
      lastCheck: new Date().toISOString(),
    };
  }

  // 4. 全量模式：更新 lastFullRun
  if (mode === 'full') {
    state.lastFullRun = new Date().toISOString();
  }

  console.log(`\n[wechat] 共 ${totalNewCount} 篇新文章待处理`);

  // 5. 抓正文
  if (allNewArticles.length > 0) {
    console.log(`[wechat] 并发抓正文 (${CONTENT_CONCURRENCY} 路)...`);
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
      if (progress % 3 === 0 || progress === allNewArticles.length) {
        console.log(`[wechat]   正文进度: ${progress}/${allNewArticles.length}`);
      }
      return a;
    });
    const okCount = allNewArticles.filter(a => a.contentMarkdownStatus === 'ok').length;
    console.log(`[wechat] 正文完成: ${okCount}/${allNewArticles.length}`);
  }

  // 6. 更新状态
  state.accounts = { ...state.accounts, ...accountStates };
  saveState(state);

  // 7. 合并写入
  if (allNewArticles.length > 0) {
    const merged = mergeOutput(allNewArticles);
    console.log(`[wechat] wechat-articles.json: +${allNewArticles.length}, 累计 ${merged.length}`);
    ensureDir(OUTPUT);
    fs.writeFileSync(OUTPUT, JSON.stringify(merged, null, 2));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[wechat] ======== ${mode.toUpperCase()} 完成: +${totalNewCount} 篇, ${elapsed}s ========\n`);
}

main().catch((e) => {
  console.error(`[wechat] 致命: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
