/**
 * 微信公众号采集脚本 v3.1 (collect_wechat_v2.cjs)
 *
 * 调用 wechat-article-exporter 的 Nitro Server HTTP API
 * 部署在阿里云 47.107.133.169:3443/dashboard/account
 *
 * v3.1 变更（2026-07-08）：
 *   - 端点全部切到 /api/public/v1/*（与官网 API 文档对齐）
 *     · /api/public/v1/account    — 根据 keyword 搜索公众号（拿到 fakeid）
 *     · /api/public/v1/article    — 根据 fakeid 拿历史文章（size 上限 20）
 *     · /api/public/v1/download   — 抓单篇文章正文（Markdown/HTML/Text/JSON）
 *     · /api/public/v1/authkey    — 探活 / 验证 auth-key
 *   - 7 天过滤、并发抓正文（与 v3.0 一致）
 *
 * 关键 API 端点（与官网 /dashboard/account 文档对应）：
 *   GET /api/public/v1/authkey
 *   GET /api/public/v1/account?keyword=xxx&begin=0&size=20
 *   GET /api/public/v1/article?fakeid=xxx&begin=0&size=20
 *   GET /api/public/v1/download?url=<encoded>&format=markdown
 *
 * 认证：X-Auth-Key header 或 Cookie: auth-key={AUTH_KEY}
 *   密钥与网站登录集成，扫码登录后自动刷新，过期约 4 天。
 *
 * 采集流程：
 *   1. 探活 auth-key（/api/public/v1/authkey）
 *   2. 对每个目标公众号，按 name 调 /api/public/v1/account 拿到 fakeid
 *   3. /api/public/v1/article?fakeid=xxx&size=20 → 最新文章列表
 *   4. 过滤：剔除 7 天前发布的
 *   5. 对每篇保留的文章，并发抓正文（/api/public/v1/download?format=markdown）
 *   6. 去重合并，保存到 OUTPUT
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ============ 配置 ============
const EXPORTER_HOST = process.env.WX_EXPORTER_HOST || '47.107.133.169';
const EXPORTER_PORT = parseInt(process.env.WX_EXPORTER_PORT || '3443');
const EXPORTER_PROTOCOL = process.env.WX_EXPORTER_PROTOCOL || 'https';
// 自签证书：默认拒绝校验（避免 ERR_TLS_CERT_ALTNAME_INVALID），可通过 WX_TLS_REJECT_UNAUTHORIZED=1 打开
const TLS_REJECT_UNAUTHORIZED = process.env.WX_TLS_REJECT_UNAUTHORIZED === '1';
const OUTPUT = process.env.OUTPUT_FILE || '/tmp/wechat-articles.json';
const ARTICLE_LIMIT = parseInt(process.env.ARTICLE_LIMIT || '20');
const RECENT_DAYS = parseInt(process.env.RECENT_DAYS || '7');
const CONTENT_CONCURRENCY = parseInt(process.env.CONTENT_CONCURRENCY || '3');
const CONTENT_TIMEOUT_MS = parseInt(process.env.CONTENT_TIMEOUT_MS || '30000');
const CONTENT_MAX_CHARS = parseInt(process.env.CONTENT_MAX_CHARS || '30000');
// 兜底策略：是否采集 dashboard 已关注但不在 P0 列表的账号
// 默认 false（避免把"Alex大叔"这种杂号混入监管时间流）
// 想全量抓可设 WX_ALLOW_FALLBACK_ACCOUNTS=1
const ALLOW_FALLBACK_ACCOUNTS = process.env.WX_ALLOW_FALLBACK_ACCOUNTS === '1';

// Auth key — 必填，存于 GitHub Secret WECHAT_AUTH_KEY
// 留空则脚本会立即报错（避免静默以空数据污染事件流）
const AUTH_KEY = process.env.WX_AUTH_KEY || process.env.WX_AUTH_KEY_FALLBACK || '';
if (!AUTH_KEY) {
  console.error('[collect_wechat_v2] ❌ WX_AUTH_KEY 未配置（请在 GitHub Secret / .env 中设置）');
  // 写出空数组，让 GitHub Actions 不报错
  try { fs.writeFileSync(OUTPUT, '[]'); } catch {}
  process.exit(1);
}

// 目标公众号列表（按名称）
// 策略：先按 P0 列表尝试匹配；匹配失败的也尝试按名称单独查 fakeid。
// 兜底：账号列表里所有已关注公众号都拉（即使不在 P0 列表）。
const TARGET_MP_LIST = [
  // ===== T1: 国家级官方监管机构 =====
  { name: '中国药闻',    category: 'regulation', level: 'T1', country: 'CN', desc: '国家药监局官方号' },
  { name: '中国药审',    category: 'approval',   level: 'T1', country: 'CN', desc: '药审中心(CDE)官方' },
  { name: '国家医保局',  category: 'regulation', level: 'T1', country: 'CN', desc: '医保政策' },
  // ===== T2: 行业KOL/媒体 =====
  { name: '蒲公英',      category: 'insight',    level: 'T2', country: 'CN', desc: '制药技术/GMP社区' },
  { name: '医药魔方',    category: 'insight',    level: 'T2', country: 'CN', desc: '数据驱动医药分析' },
  { name: '赛柏蓝',      category: 'insight',    level: 'T2', country: 'CN', desc: '医药行业综合资讯' },
  { name: '识林',        category: 'regulation', level: 'T2', country: 'CN', desc: 'FDA/EMA/PIC/S法规解读' },
  { name: '医药经济报',  category: 'insight',    level: 'T2', country: 'CN', desc: '医药行业权威报纸' },
  { name: '健识局',      category: 'insight',    level: 'T2', country: 'CN', desc: '医药政策深度解读' },
  { name: 'E药经理人',   category: 'insight',    level: 'T2', country: 'CN', desc: '医药行业深度报道' },
];

// 名称 → 分类推断（兜底阶段用：不在 P0 列表时，按名称猜分类）
const NAME_CATEGORY_HINTS = [
  { kw: '药审', cat: 'approval', level: 'T1' },
  { kw: '药监', cat: 'regulation', level: 'T1' },
  { kw: '医保', cat: 'regulation', level: 'T1' },
  { kw: '监管', cat: 'regulation', level: 'T1' },
  { kw: 'FDA', cat: 'regulation', level: 'T2' },
  { kw: 'NMPA', cat: 'regulation', level: 'T1' },
  { kw: '指南', cat: 'regulation', level: 'T2' },
  { kw: '安全', cat: 'safety', level: 'T2' },
  { kw: '召回', cat: 'safety', level: 'T2' },
  { kw: '审批', cat: 'approval', level: 'T1' },
  { kw: 'GMP', cat: 'regulation', level: 'T2' },
  { kw: '合规', cat: 'regulation', level: 'T2' },
];

function inferCategoryFromName(name) {
  for (const h of NAME_CATEGORY_HINTS) {
    if (name.includes(h.kw)) return { category: h.cat, level: h.level };
  }
  return { category: 'insight', level: 'T2' };
}

// fakeid 缓存路径
const FAKEID_CACHE = (() => {
  const serverPath = '/opt/wechat-exporter/config/mp_fakeid_cache.json';
  const devPath = path.join(__dirname, '..', 'config', 'mp_fakeid_cache.json');
  if (fs.existsSync(serverPath)) return serverPath;
  return devPath;
})();

// ============ 工具 ============
function nowIso() { return new Date().toISOString(); }

function log(level, msg, extra) {
  const line = `[${nowIso()}] [${level}] ${msg}${extra ? ' ' + JSON.stringify(extra) : ''}`;
  console.log(line);
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
      {
        host, port, path, method, headers, timeout,
        rejectUnauthorized: TLS_REJECT_UNAUTHORIZED,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, data });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${method} ${path}`)); });
    req.end();
  });
}

// 通用 GET — JSON 返回
async function apiGetJson(endpoint, params = {}, { timeout = 30000 } = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const path = qs ? `${endpoint}?${qs}` : endpoint;

  const res = await httpRequest({
    protocol: EXPORTER_PROTOCOL,
    host: EXPORTER_HOST,
    port: EXPORTER_PORT,
    path,
    method: 'GET',
    headers: {
      'Accept': 'application/json, text/markdown, */*',
      'User-Agent': 'RegulatoryHot-Collector/3.0',
      'Cookie': `auth-key=${AUTH_KEY}`,
      'X-Auth-Key': AUTH_KEY,
    },
    timeout,
  });

  // 尝试 JSON 解析（下载接口可能返回 markdown 文本）
  const ct = (res.headers['content-type'] || '').toLowerCase();
  if (ct.includes('application/json') || endpoint.startsWith('/api/web/mp/') || endpoint.startsWith('/api/public/v1/authkey')) {
    try {
      return { status: res.status, data: JSON.parse(res.data), raw: res.data };
    } catch (e) {
      return { status: res.status, data: null, raw: res.data, error: 'parse_error' };
    }
  }
  // 文本（markdown / html）
  return { status: res.status, data: res.data, raw: res.data, isText: true };
}

// ============ 步骤 1：探活 ============
async function checkAuthKey() {
  const res = await apiGetJson('/api/public/v1/authkey', {}, { timeout: 10000 });
  if (res.status !== 200) {
    return { ok: false, reason: `http_${res.status}` };
  }
  if (res.data?.code === 0) {
    return { ok: true };
  }
  return { ok: false, reason: res.data?.msg || `code=${res.data?.code}` };
}

// ============ fakeid 缓存管理 ============
function loadFakeidCache() {
  try {
    if (fs.existsSync(FAKEID_CACHE)) {
      return JSON.parse(fs.readFileSync(FAKEID_CACHE, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveFakeidCache(cache) {
  ensureDir(FAKEID_CACHE);
  fs.writeFileSync(FAKEID_CACHE, JSON.stringify(cache, null, 2));
}

// ============ 步骤 2：账号列表（按关键字搜）============
// /api/public/v1/account?keyword=xxx
// v1 API 行为：
//   - keyword 是单字（"a"/"医"）时，会返回多个已关注公众号（实测最多 10）
//   - keyword 强必填，空格不返回
//   - 单次最多 size=20
// 策略：先用 1-2 个常用字拿到所有已关注账号，再与 TARGET_MP_LIST 名称匹配
async function getAccountList() {
  const probeKeywords = ['a', '医', '药', '健', '公', '中', '监', '新', '生'];
  const seen = new Map(); // fakeid → account

  for (const kw of probeKeywords) {
    const result = await apiGetJson('/api/public/v1/account', {
      keyword: kw,
      begin: 0,
      size: 20,
    });

    if (result.data?.ret === 200003 || result.data?.base_resp?.ret === 200003) {
      return { expired: true, accounts: [], error: 'session_expired' };
    }
    if (result.data?.code === -1 || result.data?.base_resp?.ret === -1) {
      return { expired: true, accounts: [], error: 'auth_invalid' };
    }

    const list = result.data?.list || result.data?.data?.list || result.data?.base_resp?.list || [];
    if (Array.isArray(list)) {
      for (const a of list) {
        if (a.fakeid && !seen.has(a.fakeid)) {
          seen.set(a.fakeid, a);
        }
      }
    }
    // 拿到 10 个就停（接口上限）
    if (seen.size >= 10) break;
  }

  return { expired: false, accounts: Array.from(seen.values()) };
}

// ============ 步骤 3：文章列表（按 fakeid 查）============
// /api/public/v1/article?fakeid=xxx&begin=0&size=20
// 返回中 articles[*] 包含 title / link / create_time / digest / cover 等
async function fetchArticles(fakeid, mpName) {
  const result = await apiGetJson('/api/public/v1/article', {
    fakeid: fakeid,
    begin: 0,
    size: ARTICLE_LIMIT,   // 上限 20
  });

  if (result.data?.ret === 200003 || result.data?.base_resp?.ret === 200003) {
    return { expired: true, articles: [], error: 'session_expired' };
  }
  if (result.data?.code === -1) {
    return { expired: true, articles: [], error: 'authkey_invalid' };
  }

  // 解析文章列表
  let items = result.data?.articles
    || result.data?.data?.articles
    || result.data?.app_msg_list
    || result.data?.data?.app_msg_list
    || result.data?.list
    || [];

  if (!Array.isArray(items)) {
    return { expired: false, articles: [], error: 'bad_shape' };
  }

  // 拆 multi_app_msg_item_list
  const flat = [];
  for (const it of items) {
    flat.push(it);
    const subs = it.multi_app_msg_item_list || [];
    for (const sub of subs) {
      flat.push({ ...sub, msg_id: sub.aid || sub.appmsgid });
    }
  }

  return { expired: false, articles: flat };
}

// ============ 步骤 4：7 天过滤 ============
function withinRecentDays(publishTime) {
  if (!publishTime) return false;
  const t = new Date(publishTime).getTime();
  if (isNaN(t)) return false;
  const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  return t >= cutoff;
}

function extractPublishTime(item) {
  const ts = item.create_time || item.update_time || item.send_time;
  if (typeof ts === 'number' && ts > 0) {
    // 13 位 = 毫秒（> 10^12），10 位 = 秒（< 10^11）
    if (ts > 1e12) return new Date(ts).toISOString();
    if (ts > 1e9) return new Date(ts * 1000).toISOString();
  } else if (typeof ts === 'string') {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

// ============ 步骤 5：抓正文（并发）============
async function fetchOneContent(url) {
  try {
    const res = await apiGetJson(
      '/api/public/v1/download',
      { url, format: 'markdown' },
      { timeout: CONTENT_TIMEOUT_MS }
    );
    if (res.status !== 200) return null;
    if (res.isText && typeof res.data === 'string') {
      let md = res.data;
      if (md.length > CONTENT_MAX_CHARS) {
        md = md.slice(0, CONTENT_MAX_CHARS) + '\n\n...(内容过长已截断)...';
      }
      return md;
    }
    return null;
  } catch (e) {
    return null;
  }
}

// 简单并发池
async function concurrentMap(items, limit, mapper, onProgress) {
  const results = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) break;
      results[i] = await mapper(items[i], i);
      done++;
      if (onProgress) onProgress(done, items.length);
    }
  });
  await Promise.all(workers);
  return results;
}

// ============ 步骤 6：合并已有数据 ============
function mergeWithExisting(newArticles) {
  let existing = [];
  if (fs.existsSync(OUTPUT)) {
    try { existing = JSON.parse(fs.readFileSync(OUTPUT, 'utf-8')); } catch {}
  }
  const existingLinks = new Set(existing.map(a => a.link).filter(Boolean));
  const onlyNew = newArticles.filter(a => a.link && !existingLinks.has(a.link));
  // 全量 = 旧 + 新（按发布时间倒序，最多 800 篇）
  return [...onlyNew, ...existing]
    .sort((a, b) => new Date(b.publishTime || 0) - new Date(a.publishTime || 0))
    .slice(0, 800);
}

// ============ 主流程 ============
async function main() {
  log('INFO', '========================================');
  log('INFO', '微信公众号采集 v3.0');
  log('INFO', `Exporter: ${EXPORTER_PROTOCOL}://${EXPORTER_HOST}:${EXPORTER_PORT}`);
  log('INFO', `目标公众号: ${TARGET_MP_LIST.length} 个`);
  log('INFO', `7 天过滤: 仅保留 ${RECENT_DAYS} 天内发布`);
  log('INFO', `正文并发: ${CONTENT_CONCURRENCY} 路`);
  log('INFO', '========================================');

  // 1. 探活
  const auth = await checkAuthKey();
  if (!auth.ok) {
    log('ERROR', `Auth-key 失效: ${auth.reason}，跳过本次采集`);
    ensureDir(OUTPUT);
    fs.writeFileSync(OUTPUT, '[]');
    return;
  }
  log('INFO', 'Auth-key 有效');

  // 2. 加载 fakeid 缓存
  const fakeidCache = loadFakeidCache();
  let fakeidCacheUpdated = false;

  // 3. 拉账号列表
  const { expired, accounts, error: accErr } = await getAccountList();
  if (expired) {
    log('ERROR', '微信登录已过期，请重新扫码');
    ensureDir(OUTPUT);
    fs.writeFileSync(OUTPUT, '[]');
    return;
  }
  log('INFO', `账号列表: ${accounts.length} 个`, accErr ? { err: accErr } : undefined);

  // 4. 匹配目标公众号 fakeid
  for (const mp of TARGET_MP_LIST) {
    if (fakeidCache[mp.name]) {
      mp.fakeid = fakeidCache[mp.name];
      continue;
    }
    const matched = accounts.find(a => {
      const nickname = a.nickname || a.name || a.mp_name || '';
      return nickname.includes(mp.name) || mp.name.includes(nickname);
    });
    if (matched) {
      mp.fakeid = matched.fakeid || matched.fake_id || '';
      fakeidCache[mp.name] = mp.fakeid;
      fakeidCacheUpdated = true;
      log('INFO', `匹配: ${mp.name} → fakeid=${mp.fakeid}`);
    } else {
      log('WARN', `P0 未匹配: ${mp.name}（可能尚未关注该公众号）`);
    }
  }
  if (fakeidCacheUpdated) saveFakeidCache(fakeidCache);

  // 4b. 兜底：未匹配到的 P0 公众号，按名字再单独搜一次 fakeid
  // （dashboard 里可能只关注了"中国药监局"而不是"中国药闻"等别名）
  for (const mp of TARGET_MP_LIST) {
    if (mp.fakeid) continue;
    try {
      const r = await apiGetJson('/api/public/v1/account', { keyword: mp.name, size: 5 });
      const list = r.data?.list || [];
      const hit = list.find(a => {
        const n = a.nickname || '';
        return n.includes(mp.name) || mp.name.includes(n);
      });
      if (hit) {
        mp.fakeid = hit.fakeid;
        fakeidCache[mp.name] = mp.fakeid;
        fakeidCacheUpdated = true;
        log('INFO', `P0 单独搜: ${mp.name} → fakeid=${mp.fakeid}`);
      }
    } catch (e) { /* ignore */ }
  }
  if (fakeidCacheUpdated) saveFakeidCache(fakeidCache);

  // 4c. 兜底兜底：把已关注但不在 P0 列表的账号也加进来
  // 默认关闭（避免"Alex大叔"这种星座/鸡汤号污染监管时间流）
  // 想全量抓可设 WX_ALLOW_FALLBACK_ACCOUNTS=1
  if (ALLOW_FALLBACK_ACCOUNTS) {
    const targetFakenames = new Set(TARGET_MP_LIST.filter(m => m.fakeid).map(m => m.name));
    for (const a of accounts) {
      const name = a.nickname || a.name || a.mp_name || 'unknown';
      if (targetFakenames.has(name)) continue;
      // 用名称推断分类，加入候选列表
      const inferred = inferCategoryFromName(name);
      TARGET_MP_LIST.push({
        name,
        category: inferred.category,
        level: inferred.level,
        country: 'CN',
        desc: 'dashboard 已关注（非 P0，按名称推断分类）',
        fakeid: a.fakeid || a.fake_id || '',
      });
      log('INFO', `兜底加入: ${name} → fakeid=${a.fakeid}  cat=${inferred.category}`);
    }
  } else {
    log('INFO', '兜底账号已关闭（仅 P0 公众号），设 WX_ALLOW_FALLBACK_ACCOUNTS=1 开启');
  }

  // 5. 逐公众号采集文章列表
  const allArticles = [];
  let sessionExpired = false;

  for (const mp of TARGET_MP_LIST) {
    if (!mp.fakeid) {
      log('INFO', `[${mp.name}] 跳过（无 fakeid）`);
      continue;
    }
    log('INFO', `[${mp.name}] 采集中...`);
    const { expired: mpExpired, articles: items, error: artErr } = await fetchArticles(mp.fakeid, mp.name);
    if (mpExpired) { sessionExpired = true; break; }
    log('INFO', `[${mp.name}] 列表: ${items.length} 篇${artErr ? ` (err=${artErr})` : ''}`);

    for (const item of items) {
      const pubTime = extractPublishTime(item);
      if (!withinRecentDays(pubTime)) continue; // 7 天过滤

      const articleId = item.msg_id || item.aid || item.appmsgid || '';
      const link = item.link || (articleId ? `https://mp.weixin.qq.com/s/${articleId}` : '');
      if (!link) continue;

      allArticles.push({
        id: String(articleId),
        title: (item.title || '').trim(),
        link,
        publishTime: pubTime,
        source: 'wechat',
        contentType: 'article',
        sourceName: mp.name,
        sourceId: mp.fakeid,
        sourceLevel: mp.level,
        sourceCategory: mp.category,
        sourceCountry: mp.country,
        sourceDesc: mp.desc,
        digest: (item.digest || '').trim(),
        coverUrl: item.cover || item.pic_url || '',
        readCount: item.read_num || 0,
        likeCount: item.like_num || 0,
        // 正文相关字段
        contentMarkdown: '',           // 待抓
        contentMarkdownFetchedAt: null,
        contentMarkdownStatus: 'pending',
      });
    }
  }

  if (sessionExpired) {
    log('ERROR', 'Session 过期，中断采集');
    ensureDir(OUTPUT);
    fs.writeFileSync(OUTPUT, JSON.stringify(allArticles, null, 2));
    return;
  }

  // 6. 去重（按 link）+ 按时间倒序
  const seen = new Set();
  const unique = allArticles.filter(a => {
    if (seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  }).sort((a, b) => new Date(b.publishTime || 0) - new Date(a.publishTime || 0));

  log('INFO', `7 天内共 ${unique.length} 篇待抓正文`);

  // 7. 并发抓正文
  if (unique.length > 0) {
    let done = 0;
    await concurrentMap(
      unique,
      CONTENT_CONCURRENCY,
      async (a) => {
        if (!a.link) return a;
        const md = await fetchOneContent(a.link);
        if (md) {
          a.contentMarkdown = md;
          a.contentMarkdownFetchedAt = nowIso();
          a.contentMarkdownStatus = 'ok';
        } else {
          a.contentMarkdownStatus = 'failed';
        }
        return a;
      },
      (d, total) => {
        if (d % 5 === 0 || d === total) {
          log('INFO', `抓正文进度: ${d}/${total}`);
        }
      }
    );
  }

  const successCount = unique.filter(a => a.contentMarkdownStatus === 'ok').length;
  log('INFO', `正文抓取完成: ${successCount}/${unique.length} 成功`);

  // 8. 合并已有数据并落盘
  const merged = mergeWithExisting(unique);
  ensureDir(OUTPUT);
  fs.writeFileSync(OUTPUT, JSON.stringify(merged, null, 2));

  log('INFO', '========================================');
  log('INFO', '📊 采集汇总:');
  log('INFO', `  本批 7 天内: ${unique.length} 篇`);
  log('INFO', `  正文抓取成功: ${successCount}`);
  log('INFO', `  累计（最近 800）: ${merged.length} 篇`);
  log('INFO', `  公众号覆盖: ${TARGET_MP_LIST.filter(m => m.fakeid).length}/${TARGET_MP_LIST.length}`);
  log('INFO', '========================================');

  if (unique.length > 0) {
    log('INFO', '最新文章预览:');
    unique.slice(0, 5).forEach((a, i) => {
      const d = a.publishTime ? new Date(a.publishTime).toLocaleDateString('zh-CN') : '?';
      const hasMd = a.contentMarkdownStatus === 'ok' ? '📄' : '⚠️';
      log('INFO', `  ${i + 1}. ${hasMd} [${d}] [${a.sourceName}] ${(a.title || '').substring(0, 60)}`);
    });
  }
}

main().catch((e) => {
  log('ERROR', `💥 致命: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
