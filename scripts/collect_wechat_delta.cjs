/**
 * 微信公众号 高频增量采集脚本 v1.0
 *
 * 设计目标：部署在阿里云 47.107.133.169，cron 每 5 分钟运行一次。
 * 与 collect_wechat_v2.cjs（全量 2h 兜底）互补，专注"新文章第一时间捕获"。
 *
 * 与全量版的区别：
 *   - 只取每个公众号最新 5 篇（vs 20 篇）
 *   - ID 增量对比，命中已知文章立即停止（避免重复扫描）
 *   - 仅下载新文章正文
 *   - 轻量快速，单次运行 <30 秒
 *   - 自动 git push + 触发 GitHub Actions AI 分析
 *
 * 用法：
 *   node scripts/collect_wechat_delta.cjs                    # 常规增量
 *   node scripts/collect_wechat_delta.cjs --dry-run           # 预览不写入
 *   node scripts/collect_wechat_delta.cjs --no-push           # 不自动 git push
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============ 配置 ============
const PROJECT_ROOT = path.join(__dirname, '..');
const EXPORTER_HOST = process.env.WX_EXPORTER_HOST || '47.107.133.169';
const EXPORTER_PORT = parseInt(process.env.WX_EXPORTER_PORT || '3443');
const EXPORTER_PROTOCOL = process.env.WX_EXPORTER_PROTOCOL || 'https';
const TLS_REJECT_UNAUTHORIZED = process.env.WX_TLS_REJECT_UNAUTHORIZED === '1';

const OUTPUT = process.env.OUTPUT_FILE
  || path.join(PROJECT_ROOT, 'regulatory-hot', 'public', 'data', 'wechat-articles.json');
const STATE_FILE = process.env.WX_STATE_FILE
  || path.join(PROJECT_ROOT, 'regulatory-hot', 'public', 'data', '.wechat-delta-state.json');

const ARTICLE_LIMIT = parseInt(process.env.DELTA_ARTICLE_LIMIT || '5');
const CONTENT_CONCURRENCY = parseInt(process.env.DELTA_CONTENT_CONCURRENCY || '3');
const CONTENT_TIMEOUT_MS = parseInt(process.env.CONTENT_TIMEOUT_MS || '30000');
const CONTENT_MAX_CHARS = parseInt(process.env.CONTENT_MAX_CHARS || '30000');
const AUTO_PUSH = process.env.DELTA_AUTO_PUSH !== '0';
const DRY_RUN = process.argv.includes('--dry-run');
const NO_PUSH = process.argv.includes('--no-push');

const AUTH_KEY = process.env.WX_AUTH_KEY || process.env.WX_AUTH_KEY_FALLBACK || '';
if (!AUTH_KEY) {
  console.error('[delta] WX_AUTH_KEY 未配置');
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

// ============ 状态管理 ============
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {}
  return { version: 1, accounts: {}, lastFullMerge: null };
}

function saveState(state) {
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!DRY_RUN) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  }
}

function ensureDir(p) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
  try {
    return { status: res.status, data: JSON.parse(res.data) };
  } catch {
    return { status: res.status, data: null, error: 'parse_error' };
  }
}

// ============ 探活 ============
async function checkAuth() {
  const res = await apiGetJson('/api/public/v1/authkey', {}, { timeout: 10000 });
  if (res.status !== 200 || res.data?.code !== 0) {
    return { ok: false, reason: res.data?.msg || `status=${res.status}` };
  }
  return { ok: true };
}

// ============ fakeid 缓存 ============
function loadFakeidCache() {
  const cachePath = path.join(PROJECT_ROOT, 'config', 'mp_fakeid_cache.json');
  try { if (fs.existsSync(cachePath)) return JSON.parse(fs.readFileSync(cachePath, 'utf-8')); } catch {}
  return {};
}

function saveFakeidCache(cache) {
  const cachePath = path.join(PROJECT_ROOT, 'config', 'mp_fakeid_cache.json');
  ensureDir(cachePath);
  if (!DRY_RUN) fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

// ============ 账号搜索 ============
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

// ============ 文章列表 + 增量检测 ============
async function fetchNewArticles(fakeid, mpName, lastKnownId) {
  const result = await apiGetJson('/api/public/v1/article', { fakeid, begin: 0, size: ARTICLE_LIMIT });
  if (result.data?.ret === 200003) return { expired: true, articles: [] };

  let items = result.data?.articles
    || result.data?.data?.articles
    || result.data?.app_msg_list
    || result.data?.data?.app_msg_list
    || [];

  if (!Array.isArray(items)) return { expired: false, articles: [] };

  const flat = [];
  for (const it of items) {
    flat.push(it);
    const subs = it.multi_app_msg_item_list || [];
    for (const sub of subs) flat.push({ ...sub, msg_id: sub.aid || sub.appmsgid });
  }

  // 增量检测：按时间倒序，一旦遇到 lastKnownId 就停止
  const newArticles = [];
  for (const item of flat) {
    const articleId = String(item.msg_id || item.aid || item.appmsgid || '');
    if (lastKnownId && articleId === lastKnownId) break; // 命中已知，后续更旧的不需要
    newArticles.push(item);
  }
  return { expired: false, articles: newArticles, hitCached: newArticles.length < flat.length };
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
function extractPublishTime(item) {
  const ts = item.create_time || item.update_time || item.send_time;
  if (typeof ts === 'number' && ts > 0) {
    if (ts > 1e12) return new Date(ts).toISOString();
    if (ts > 1e9) return new Date(ts * 1000).toISOString();
  }
  if (typeof ts === 'string') { const d = new Date(ts); if (!isNaN(d.getTime())) return d.toISOString(); }
  return null;
}

function normalizeArticle(item, mp) {
  const articleId = String(item.msg_id || item.aid || item.appmsgid || '');
  return {
    id: articleId,
    title: (item.title || '').trim(),
    link: item.link || (articleId ? `https://mp.weixin.qq.com/s/${articleId}` : ''),
    publishTime: extractPublishTime(item) || new Date().toISOString(),
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
  };
}

// ============ 合并到 wechat-articles.json ============
function mergeOutput(newArticles) {
  let existing = [];
  if (fs.existsSync(OUTPUT)) {
    try { existing = JSON.parse(fs.readFileSync(OUTPUT, 'utf-8')); } catch {}
  }
  if (!Array.isArray(existing)) existing = [];

  const existingLinks = new Set(existing.map(a => a.link).filter(Boolean));
  const trulyNew = newArticles.filter(a => a.link && !existingLinks.has(a.link));

  // 新文章在前，保留总数不超过 1000
  return [...trulyNew, ...existing]
    .sort((a, b) => new Date(b.publishTime || 0) - new Date(a.publishTime || 0))
    .slice(0, 1000);
}

// ============ Git 操作 ============
function gitPush(message) {
  if (!AUTO_PUSH || NO_PUSH || DRY_RUN) {
    console.log(`[delta] 跳过 git push (DRY_RUN=${DRY_RUN}, NO_PUSH=${NO_PUSH})`);
    return false;
  }
  try {
    execSync('git add regulatory-hot/public/data/', { cwd: PROJECT_ROOT, stdio: 'pipe', timeout: 30000 });
    const diff = execSync('git diff --staged --name-only', { cwd: PROJECT_ROOT, encoding: 'utf-8', timeout: 10000 }).trim();
    if (!diff) {
      console.log('[delta] 无变更，跳过 git commit');
      return false;
    }
    execSync(`git commit -m "${message}"`, { cwd: PROJECT_ROOT, stdio: 'pipe', timeout: 15000 });
    execSync('git push', { cwd: PROJECT_ROOT, stdio: 'pipe', timeout: 30000 });
    console.log('[delta] git push 成功');
    return true;
  } catch (e) {
    console.error(`[delta] git 操作失败: ${e.message}`);
    return false;
  }
}

function triggerGitHubWorkflow() {
  if (!AUTO_PUSH || NO_PUSH || DRY_RUN) return;
  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    if (!GITHUB_TOKEN) { console.log('[delta] 无 GITHUB_TOKEN，跳过触发 AI 分析'); return; }
    const repo = process.env.GITHUB_REPOSITORY || 'lizeyugt-web/regulatory-hot';
    const body = JSON.stringify({ ref: 'main', inputs: { source: 'wechat-delta' } });
    const cmd = `curl -s -X POST "https://api.github.com/repos/${repo}/actions/workflows/collect-analyze.yml/dispatches" -H "Authorization: token ${GITHUB_TOKEN}" -H "Accept: application/vnd.github.v3+json" -d '${body}'`;
    execSync(cmd, { cwd: PROJECT_ROOT, stdio: 'pipe', timeout: 15000 });
    console.log('[delta] 已触发 GitHub Actions (AI 分析)');
  } catch (e) {
    console.error(`[delta] 触发 workflow 失败: ${e.message}`);
  }
}

// ============ 主流程 ============
async function main() {
  const startTime = Date.now();
  console.log(`\n[delta] ======== ${new Date().toISOString()} 增量采集开始 ========\n`);

  // 1. 探活
  const auth = await checkAuth();
  if (!auth.ok) {
    console.error(`[delta] Auth-key 失效: ${auth.reason}，跳过`);
    process.exit(2); // exit 2 = auth 问题，让 cron 邮件通知
  }
  console.log('[delta] Auth-key 有效');

  // 2. 加载状态
  const state = loadState();
  const fakeidCache = loadFakeidCache();
  let cacheUpdated = false;

  // 3. 确保每个目标公众号有 fakeid
  for (const mp of TARGET_MP_LIST) {
    if (fakeidCache[mp.name]) {
      mp.fakeid = fakeidCache[mp.name];
    }
  }

  const missingFakeid = TARGET_MP_LIST.filter(m => !m.fakeid);
  if (missingFakeid.length > 0) {
    console.log(`[delta] ${missingFakeid.length} 个公众号缺少 fakeid，尝试搜索...`);
    const { expired, accounts } = await searchAccounts();
    if (expired) {
      console.error('[delta] 登录已过期');
      process.exit(2);
    }
    for (const mp of missingFakeid) {
      const matched = accounts.find(a => {
        const n = a.nickname || a.name || '';
        return n.includes(mp.name) || mp.name.includes(n);
      });
      if (matched) {
        mp.fakeid = matched.fakeid;
        fakeidCache[mp.name] = matched.fakeid;
        cacheUpdated = true;
        console.log(`[delta] 匹配: ${mp.name} -> ${matched.fakeid}`);
      }
    }
    if (cacheUpdated) saveFakeidCache(fakeidCache);
  }

  // 4. 逐公众号增量采集
  let totalNewCount = 0;
  const allNewArticles = [];
  const accountStates = {};

  for (const mp of TARGET_MP_LIST) {
    if (!mp.fakeid) {
      console.log(`[delta] [${mp.name}] 跳过（无 fakeid）`);
      continue;
    }

    const lastKnownId = state.accounts?.[mp.name]?.lastArticleId || null;
    const { expired, articles: newItems, hitCached } = await fetchNewArticles(mp.fakeid, mp.name, lastKnownId);

    if (expired) {
      console.error('[delta] Session 过期，中断');
      process.exit(2);
    }

    if (newItems.length === 0) {
      // 无新文章
      accountStates[mp.name] = { fakeid: mp.fakeid, lastArticleId: lastKnownId, lastCheck: new Date().toISOString() };
      continue;
    }

    const hitMsg = hitCached
      ? `命中缓存(${ARTICLE_LIMIT - newItems.length}/${ARTICLE_LIMIT})`
      : `边界(${newItems.length}/${ARTICLE_LIMIT}篇全未见过)`;
    console.log(`[delta] [${mp.name}] ${newItems.length} 篇新 → ${hitMsg}`);

    // 记录最新 articleId（列表按时间倒序，第一篇最新）
    const latestId = String(newItems[0].msg_id || newItems[0].aid || newItems[0].appmsgid || '');
    accountStates[mp.name] = { fakeid: mp.fakeid, lastArticleId: latestId, lastCheck: new Date().toISOString() };

    for (const item of newItems) {
      allNewArticles.push(normalizeArticle(item, mp));
    }
    totalNewCount += newItems.length;
  }

  console.log(`\n[delta] 共 ${totalNewCount} 篇新文章`);

  // 5. 抓正文（仅对新文章）
  if (allNewArticles.length > 0) {
    console.log(`[delta] 并发抓正文 (${CONTENT_CONCURRENCY} 路)...`);
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
      return a;
    });
    const okCount = allNewArticles.filter(a => a.contentMarkdownStatus === 'ok').length;
    console.log(`[delta] 正文完成: ${okCount}/${allNewArticles.length}`);
  }

  // 6. 更新状态
  state.accounts = { ...state.accounts, ...accountStates };
  state.lastRun = new Date().toISOString();
  saveState(state);

  // 7. 合并写入 wechat-articles.json
  if (allNewArticles.length > 0) {
    const merged = mergeOutput(allNewArticles);
    console.log(`[delta] wechat-articles.json: 新增 ${allNewArticles.length}，累计 ${merged.length}`);
    if (!DRY_RUN) {
      ensureDir(OUTPUT);
      fs.writeFileSync(OUTPUT, JSON.stringify(merged, null, 2));
    }
  }

  // 8. git push
  let pushed = false;
  if (allNewArticles.length > 0) {
    const msg = `wechat: 增量 ${allNewArticles.length} 篇 [${new Date().toISOString().slice(0, 16)}]`;
    pushed = gitPush(msg);
  }

  // 9. 触发 AI 分析（仅当有新内容）
  if (pushed) {
    triggerGitHubWorkflow();
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[delta] ======== 完成: ${allNewArticles.length} 篇新, 耗时 ${elapsed}s ========\n`);
}

main().catch((e) => {
  console.error(`[delta] 致命错误: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
