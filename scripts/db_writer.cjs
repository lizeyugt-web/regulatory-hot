/**
 * 事件写入数据库 — 供采集脚本共用
 * 
 * 去重、转换、写入 SQLite events 表
 */
const { getPrisma, disconnectPrisma } = require('../src/db');
const crypto = require('crypto');

function sha256(text) { return crypto.createHash('sha256').update(text).digest('hex'); }

function detectLang(text) {
  if (!text) return 'en';
  const cn = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  return cn / text.length > 0.3 ? 'zh' : 'en';
}

/**
 * FDA 事件 → DB 格式
 */
function fdaToDb(event) {
  const lang = detectLang(event.title || '');
  return {
    id: event.id || sha256(event.url + event.title).substring(0, 16),
    rawItemId: sha256(event.url + event.title),
    titleOriginal: event.title || '',
    titleCn: lang === 'zh' ? event.title : '',
    titleLang: lang,
    summaryOriginal: event.summary || '',
    summaryCn: '',
    contentOriginal: lang !== 'zh' ? (event.contentOriginal || null) : (event.contentOriginal || null),
    contentCn: '',
    contentHint: null,
    contentType: 'html',
    url: event.url,
    permalink: `/items/${event.id}`,
    sourceId: event.sourceId || 'fda',
    sourceName: event.sourceName || '美国 FDA',
    sourceLevel: event.sourceLevel || 'T1',
    sourceCountry: event.sourceCountry || 'US',
    sourceFeed: event.sourceFeed || '',
    sourceDesc: '',
    category: event.category || 'insight',
    subCategory: JSON.stringify(event.subCategory || []),
    tags: JSON.stringify(event.tags || []),
    affectedRegions: JSON.stringify(event.affectedRegions || ['US']),
    scores: JSON.stringify(event.scores || {}),
    finalScore: event.finalScore || 0,
    importance: event.importance || 3,
    aiStatus: 'pending',
    selected: event.selected ? 1 : 0,
    isLead: event.isLead ? 1 : 0,
    publishedAt: event.publishedAt || new Date().toISOString(),
    crawledAt: new Date().toISOString(),
    isSocial: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 微信事件 → DB 格式
 */
function wechatToDb(article) {
  const hasMd = article.contentMarkdown && article.contentMarkdown.trim().length > 0;
  const eid = sha256(article.link + article.title).substring(0, 16);

  return {
    id: eid,
    rawItemId: sha256(article.link + article.title),
    titleOriginal: article.title || '',
    titleCn: article.title || '',
    titleLang: 'zh',
    summaryOriginal: article.digest || '',
    summaryCn: '',
    contentOriginal: null,
    contentCn: null,
    contentHint: '微信公众号文章受平台限制，请点击原文链接阅读完整内容',
    contentType: hasMd ? 'markdown' : 'text',
    url: article.link,
    permalink: `/items/${eid}`,
    sourceId: `wechat-${article.sourceName || 'unknown'}`,
    sourceName: article.sourceName || '',
    sourceLevel: article.sourceLevel || 'T2',
    sourceCountry: article.sourceCountry || 'CN',
    sourceFeed: '',
    sourceDesc: article.sourceDesc || '',
    category: article.sourceCategory || 'insight',
    subCategory: '["行业分析"]',
    tags: JSON.stringify(['微信公众号', article.sourceName || ''].filter(Boolean)),
    affectedRegions: '["CN"]',
    scores: JSON.stringify({
      sourceAuthority: article.sourceLevel === 'T1' ? 90 : 60,
      impactScope: 50, timeliness: 80,
      complianceUrgency: 50, industryAttention: 60,
    }),
    finalScore: 60,
    importance: 3,
    aiStatus: 'pending',
    selected: 0,
    isLead: 0,
    publishedAt: article.publishTime || new Date().toISOString(),
    crawledAt: article.contentMarkdownFetchedAt || new Date().toISOString(),
    isSocial: 1,
    readCount: article.readCount || 0,
    likeCount: article.likeCount || 0,
    coverUrl: article.coverUrl || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 批量写入事件（自动去重）
 * @returns {{ inserted: number, skipped: number }}
 */
async function insertEvents(events) {
  const prisma = getPrisma();
  let inserted = 0;
  let skipped = 0;

  for (const ev of events) {
    if (!ev.url) { skipped++; continue; }
    try {
      const exists = await prisma.event.findUnique({ where: { url: ev.url } });
      if (exists) { skipped++; continue; }
      await prisma.event.create({ data: ev });
      inserted++;
    } catch (e) {
      console.error(`  DB write failed: ${ev.url} — ${e.message}`);
      skipped++;
    }
  }

  return { inserted, skipped };
}

/**
 * 日志——采集记录
 */
async function logCrawl(sourceId, result) {
  const prisma = getPrisma();
  await prisma.crawlLog.create({
    data: {
      sourceId,
      startedAt: result.startedAt || new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      status: result.status || 'success',
      itemsTotal: result.total || 0,
      itemsNew: result.inserted || 0,
      itemsDup: result.skipped || 0,
      errorMsg: result.error || null,
      durationMs: result.durationMs || 0,
      createdAt: new Date().toISOString(),
    },
  });
}

module.exports = {
  fdaToDb,
  wechatToDb,
  insertEvents,
  logCrawl,
  detectLang,
  sha256,
  getPrisma,
  disconnectPrisma,
};
