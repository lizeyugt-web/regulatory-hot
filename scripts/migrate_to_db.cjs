/**
 * 数据迁移脚本: JSON → SQLite
 * 
 * 将 events.json 和 wechat-articles.json 中的数据迁移到 Prisma SQLite 数据库
 * 策略：微信文章先合并到 events 表（与 FDA 事件同表），按 link 去重
 * 
 * 用法: node scripts/migrate_to_db.cjs
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

// ============ 配置 ============
const REGULATORY_HOT = path.join(__dirname, '..', 'regulatory-hot');
const EVENTS_JSON = path.join(REGULATORY_HOT, 'public', 'data', 'events.json');
const WECHAT_JSON = path.join(REGULATORY_HOT, 'public', 'data', 'wechat-articles.json');
const DB_PATH = path.join(REGULATORY_HOT, 'regulatory.db');

// ============ 工具 ============
function sha256(text) { return crypto.createHash('sha256').update(text).digest('hex'); }

function detectLang(text) {
  if (!text) return 'en';
  const cnChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const jaChars = (text.match(/[\u3040-\u309f\u30a0-\u30ff]/g) || []).length;
  if (cnChars / text.length > 0.3) return 'zh';
  if (jaChars > 2) return 'ja';
  return 'en';
}

// ============ 主流程 ============
async function main() {
  // 初始化 Prisma
  const adapter = new PrismaLibSql({ url: 'file:' + DB_PATH });
  const prisma = new PrismaClient({ adapter });

  console.log('============================================================');
  console.log('  数据迁移: JSON → SQLite');
  console.log('============================================================\n');

  // ===== 1. 迁移 events.json =====
  console.log('[1/3] 迁移 events.json...');
  let eventsData = { items: [] };
  try { eventsData = JSON.parse(fs.readFileSync(EVENTS_JSON, 'utf-8')); } catch (e) {
    console.log('  ⚠️ events.json 不存在或为空，跳过');
  }

  const items = eventsData.items || [];
  console.log(`  读取到 ${items.length} 条事件`);

  let eventInserted = 0;
  let eventSkipped = 0;

  for (const item of items) {
    if (!item.url) { eventSkipped++; continue; }

    // 检查是否已存在
    const existing = await prisma.event.findUnique({ where: { url: item.url } });
    if (existing) { eventSkipped++; continue; }

    const titleLang = detectLang(item.title || '');

    try {
      await prisma.event.create({
        data: {
          id: item.id || sha256(item.url + (item.title || '')).substring(0, 16),
          rawItemId: item.rawItemId || sha256(item.url + (item.title || '')),
          titleOriginal: item.title || '',
          titleCn: item.titleLang === 'zh' ? (item.title || '') : (item.aiSummaryCn ? item.title : ''),  // 中文=原标题，非中文等 AI
          titleLang,
          summaryOriginal: item.summary || '',
          summaryCn: item.aiSummaryCn || '',
          contentOriginal: item.contentOriginal || null,
          contentCn: item.contentCn || null,
          contentHint: null,
          contentType: item.contentType || 'text',
          url: item.url,
          permalink: item.permalink || `/items/${item.id}`,
          sourceId: item.sourceId || 'unknown',
          sourceName: item.sourceName || '',
          sourceLevel: item.sourceLevel || 'T2',
          sourceCountry: item.sourceCountry || '',
          sourceFeed: item.sourceFeed || '',
          sourceDesc: item.sourceDesc || '',
          category: item.category || 'insight',
          subCategory: JSON.stringify(item.subCategory || []),
          tags: JSON.stringify(item.tags || []),
          affectedRegions: JSON.stringify(item.affectedRegions || []),
          scores: JSON.stringify(item.scores || {}),
          finalScore: item.finalScore || 0,
          importance: item.importance || 3,
          aiStatus: item.aiAnalyzedAt ? 'analyzed' : 'pending',
          aiModel: item.aiModel || item.aiSummaryModel || '',
          aiReason: item.aiReason || '',
          aiCost: item.aiCost || 0,
          aiAnalyzedAt: item.aiAnalyzedAt || null,
          selected: item.selected ? 1 : 0,
          isLead: item.isLead ? 1 : 0,
          publishedAt: item.publishedAt || new Date().toISOString(),
          crawledAt: item.crawledAt || new Date().toISOString(),
          isSocial: item.isSocial ? 1 : 0,
          readCount: item._readCount || 0,
          likeCount: item._likeCount || 0,
          coverUrl: item._coverUrl || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
      eventInserted++;
    } catch (e) {
      console.log(`  ⚠️ 跳过: ${item.id} — ${e.message}`);
      eventSkipped++;
    }
  }
  console.log(`  ✓ 新增 ${eventInserted} 条, 跳过 ${eventSkipped} 条\n`);

  // ===== 2. 迁移微信文章 (补充未在 events.json 中的) =====
  console.log('[2/3] 迁移微信文章...');
  let wechatArticles = [];
  try { wechatArticles = JSON.parse(fs.readFileSync(WECHAT_JSON, 'utf-8')); } catch (e) {
    console.log('  ⚠️ wechat-articles.json 不存在或为空，跳过');
  }

  console.log(`  读取到 ${wechatArticles.length} 篇微信文章`);
  let wxInserted = 0;
  let wxSkipped = 0;

  for (const article of wechatArticles) {
    if (!article.link) { wxSkipped++; continue; }

    const existing = await prisma.event.findUnique({ where: { url: article.link } });
    if (existing) { wxSkipped++; continue; }

    const eventId = sha256(article.link + article.title).substring(0, 16);
    const hasMd = typeof article.contentMarkdown === 'string' && article.contentMarkdown.trim().length > 0;

    try {
      await prisma.event.create({
        data: {
          id: eventId,
          rawItemId: sha256(article.link + article.title),
          titleOriginal: article.title || '',
          titleCn: article.title || '',  // 微信=中文，直接拷贝
          titleLang: 'zh',
          summaryOriginal: article.digest || '',
          summaryCn: '',  // 待 AI 分析
          contentOriginal: null,  // 版权限制
          contentCn: null,
          contentHint: '微信公众号文章受平台限制，请点击原文链接阅读完整内容',
          contentType: hasMd ? 'markdown' : 'text',
          url: article.link,
          permalink: `/items/${eventId}`,
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
        },
      });
      wxInserted++;
    } catch (e) {
      wxSkipped++;
    }
  }
  console.log(`  ✓ 新增 ${wxInserted} 篇, 跳过 ${wxSkipped} 篇\n`);

  // ===== 3. 写入 sources 表 =====
  console.log('[3/3] 写入信源配置...');
  const sources = [
    { id: 'fda', name: '美国 FDA', nameEn: 'U.S. Food and Drug Administration', type: 'agency', country: 'US', region: 'americas', level: 'T1' },
    { id: 'ema', name: '欧洲 EMA', nameEn: 'European Medicines Agency', type: 'agency', country: 'EU', region: 'europe', level: 'T1' },
    { id: 'nmpa', name: '国家药监局', nameEn: 'NMPA', type: 'agency', country: 'CN', region: 'asia', level: 'T1' },
    { id: 'pmda', name: '日本 PMDA', nameEn: 'PMDA', type: 'agency', country: 'JP', region: 'asia', level: 'T1' },
    { id: 'mhra', name: '英国 MHRA', nameEn: 'MHRA', type: 'agency', country: 'GB', region: 'europe', level: 'T1' },
    { id: 'tga', name: '澳大利亚 TGA', nameEn: 'TGA', type: 'agency', country: 'AU', region: 'oceania', level: 'T1' },
    { id: 'wechat-中国药闻', name: '中国药闻', type: 'wechat', country: 'CN', level: 'T1', config: JSON.stringify({ fakeid: 'MzkyODIwNDY4OA==' }) },
    { id: 'wechat-中国药审', name: '中国药审', type: 'wechat', country: 'CN', level: 'T1', config: JSON.stringify({ fakeid: 'MzUzNjA1ODg4NQ==' }) },
    { id: 'wechat-国家医保局', name: '国家医保局', type: 'wechat', country: 'CN', level: 'T1', config: JSON.stringify({ fakeid: 'MzU2MzY3NTA2MQ==' }) },
    { id: 'wechat-蒲公英', name: '蒲公英', type: 'wechat', country: 'CN', level: 'T2', config: JSON.stringify({ fakeid: 'MjM5NDU0Mjk0Mw==' }) },
    { id: 'wechat-医药魔方', name: '医药魔方', type: 'wechat', country: 'CN', level: 'T2', config: JSON.stringify({ fakeid: 'Mzg2OTY4MTEzMA==' }) },
    { id: 'wechat-赛柏蓝', name: '赛柏蓝', type: 'wechat', country: 'CN', level: 'T2', config: JSON.stringify({ fakeid: 'MjM5NTA4Mzc2Mg==' }) },
    { id: 'wechat-识林', name: '识林', type: 'wechat', country: 'CN', level: 'T2', config: JSON.stringify({ fakeid: 'MzA5MDAyNjQxMw==' }) },
    { id: 'wechat-医药经济报', name: '医药经济报', type: 'wechat', country: 'CN', level: 'T2', config: JSON.stringify({ fakeid: 'MjM5MTcyMjYxMw==' }) },
    { id: 'wechat-健识局', name: '健识局', type: 'wechat', country: 'CN', level: 'T2', config: JSON.stringify({ fakeid: 'MzIxMjYwMDI5Nw==' }) },
    { id: 'wechat-E药经理人', name: 'E药经理人', type: 'wechat', country: 'CN', level: 'T2', config: JSON.stringify({ fakeid: 'MjM5NzY2MDQwMg==' }) },
  ];

  let srcInserted = 0;
  for (const src of sources) {
    const exists = await prisma.source.findUnique({ where: { id: src.id } });
    if (exists) continue;
    await prisma.source.create({
      data: {
        id: src.id, name: src.name, nameEn: src.nameEn || '',
        type: src.type, country: src.country, region: src.region || '',
        level: src.level, enabled: 1,
        config: src.config || '{}', endpoints: '[]',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      },
    });
    srcInserted++;
  }
  console.log(`  ✓ 新增 ${srcInserted} 个信源\n`);

  // ===== 统计 =====
  const totalEvents = await prisma.event.count();
  const totalSources = await prisma.source.count();
  const aiPending = await prisma.event.count({ where: { aiStatus: 'pending' } });

  console.log('============================================================');
  console.log('  迁移完成!');
  console.log(`  事件总数: ${totalEvents}`);
  console.log(`  待 AI 分析: ${aiPending}`);
  console.log(`  信源数: ${totalSources}`);
  console.log(`  数据库: ${DB_PATH}`);
  console.log('============================================================\n');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('迁移失败:', e.message);
  console.error(e.stack);
  process.exit(1);
});
