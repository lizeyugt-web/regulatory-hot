/**
 * 微信文章合并脚本 (merge_wechat.cjs)
 * 
 * 将 wechat-articles.json（来自 wechat-article-exporter）
 * 转换为 events.json 格式并合并。
 * 
 * 由 GitHub Actions 在 SCP 下载后、AI 分析前执行。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ============ 路径 ============
const WECHAT_RAW = path.join(__dirname, '..', 'regulatory-hot', 'public', 'data', 'wechat-articles.json');
const EVENTS_FILE = path.join(__dirname, '..', 'regulatory-hot', 'public', 'data', 'events.json');

// ============ 工具 ============
function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// ============ 转换函数 ============
function wechatArticleToEvent(article) {
  const eventId = sha256(article.link + article.title).substring(0, 16);

  // 微信文章均为中文，无须翻译。contentOriginal 优先使用正文 markdown，
  // 其次用 digest（120 字摘要）兜底，这样 analyze.cjs 才有可读原文。
  const hasMarkdown = typeof article.contentMarkdown === 'string' && article.contentMarkdown.trim().length > 0;
  const contentOriginal = hasMarkdown ? article.contentMarkdown : (article.digest || '');
  const contentType = hasMarkdown ? 'markdown' : 'text';

  return {
    id: eventId,
    rawItemId: sha256(article.link + article.title),
    // 标题
    title: article.title || '',
    titleEn: '',
    url: article.link || '',
    permalink: `/items/${eventId}`,
    // 摘要
    summary: article.digest || '',
    background: '',
    // 来源
    sourceId: `wechat-${article.sourceName || 'unknown'}`,
    sourceName: article.sourceName || '',
    sourceLevel: article.sourceLevel || 'T2',
    sourceCountry: article.sourceCountry || 'CN',
    sourceFeed: article.sourceDesc || '',
    sourceDesc: article.sourceDesc || '',
    // 时间
    publishedAt: article.publishTime || new Date().toISOString(),
    crawledAt: new Date().toISOString(),
    analyzedAt: null,
    // 分类 & 标签
    category: article.sourceCategory || 'insight',
    subCategory: ['行业分析'],
    tags: ['微信公众号', article.sourceName || ''].filter(Boolean),
    // 重要度 & 评分
    importance: 3,
    scores: {
      sourceAuthority: article.sourceLevel === 'T1' ? 90 : 60,
      impactScope: 50,
      timeliness: 80,
      complianceUrgency: 50,
      industryAttention: 60,
    },
    finalScore: 60,
    // 业务字段
    productType: undefined,
    therapeuticArea: undefined,
    effectiveDate: undefined,
    affectedRegions: ['CN'],
    // 状态
    selected: false,
    isLead: false,
    // AI 摘要（待分析）
    aiSummaryCn: '',
    aiReason: '',
    contentCn: '',
    contentOriginal,
    contentOriginalLang: 'zh',     // 微信文章 100% 中文
    contentType,
    // 元信息
    aiModel: '',
    aiCost: 0,
    aiAnalyzedAt: null,
    // 微信特有
    isSocial: true,
    _source: 'wechat',
    _readCount: article.readCount || 0,
    _likeCount: article.likeCount || 0,
    _coverUrl: article.coverUrl || '',
    _contentFetchedAt: article.contentMarkdownFetchedAt || null,
    _contentStatus: article.contentMarkdownStatus || 'unknown',
  };
}

// ============ 主流程 ============
function main() {
  console.log('[merge_wechat] 开始合并微信文章...');

  // 检查 wechat-articles.json 是否存在
  if (!fs.existsSync(WECHAT_RAW)) {
    console.log('[merge_wechat] ⚠️ wechat-articles.json 不存在，跳过');
    return;
  }

  // 读取微信文章
  let wechatArticles = [];
  try {
    wechatArticles = JSON.parse(fs.readFileSync(WECHAT_RAW, 'utf-8'));
  } catch (e) {
    console.error(`[merge_wechat] ❌ 无法解析 wechat-articles.json: ${e.message}`);
    return;
  }

  if (!Array.isArray(wechatArticles) || wechatArticles.length === 0) {
    console.log('[merge_wechat] ⚠️ wechat-articles.json 为空，跳过');
    return;
  }

  console.log(`[merge_wechat] 读取到 ${wechatArticles.length} 篇微信文章`);

  // 读取现有 events.json
  let eventsData = { updated: new Date().toISOString(), stats: {}, items: [] };
  if (fs.existsSync(EVENTS_FILE)) {
    try {
      eventsData = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
    } catch (e) {
      console.error(`[merge_wechat] ⚠️ events.json 解析失败，将创建新文件`);
    }
  }

  const existingUrls = new Set((eventsData.items || []).map(e => e.url).filter(Boolean));
  // 用 link → event 的索引，便于回填旧记录
  const urlToIdx = new Map();
  (eventsData.items || []).forEach((e, i) => { if (e.url) urlToIdx.set(e.url, i); });

  let addedCount = 0;
  let upgradedCount = 0;

  // 转换并合并
  for (const article of wechatArticles) {
    if (!article.link) continue;

    // 旧记录升级：如果 events.json 已有这条 link（且 _source=wechat），
    // 用新抓的 contentMarkdown 覆盖原 contentOriginal，清空旧 aiSummaryCn 让 analyze 重跑
    const oldIdx = urlToIdx.get(article.link);
    if (oldIdx !== undefined) {
      const old = eventsData.items[oldIdx];
      if (old && old._source === 'wechat') {
        const hasNewMd = typeof article.contentMarkdown === 'string' && article.contentMarkdown.trim().length > 0;
        const oldHasMd = typeof old.contentOriginal === 'string' && old.contentOriginal.length > 200; // digest 一般 < 200 字
        if (hasNewMd && !oldHasMd) {
          old.contentOriginal = article.contentMarkdown;
          old.contentType = 'markdown';
          old._contentFetchedAt = article.contentMarkdownFetchedAt || null;
          old._contentStatus = article.contentMarkdownStatus || 'ok';
          // 让 analyze.cjs 重新评估（用真正文再分析）
          old.aiSummaryCn = '';
          old.aiReason = '';
          old.contentCn = '';
          old.aiAnalyzedAt = null;
          upgradedCount++;
        }
      }
      continue;
    }

    const event = wechatArticleToEvent(article);
    eventsData.items.push(event);  // 先追加
    existingUrls.add(article.link);
    addedCount++;
  }

  // 全部合并后按发布时间倒序重排（新文章在最前）
  eventsData.items.sort((a, b) => {
    const ta = new Date(a.publishedAt || 0).getTime();
    const tb = new Date(b.publishedAt || 0).getTime();
    return tb - ta;
  });

  // 更新统计
  eventsData.stats = {
    total: eventsData.items.length,
    selected: eventsData.items.filter(e => e.selected).length,
    aiCompleted: eventsData.items.filter(e => e.aiSummaryCn && e.aiSummaryCn.length > 0).length,
    aiPending: eventsData.items.filter(e => !e.aiSummaryCn || e.aiSummaryCn.length === 0).length,
    wechatTotal: eventsData.items.filter(e => e._source === 'wechat').length,
  };
  eventsData.updated = new Date().toISOString();

  // 写入
  fs.writeFileSync(EVENTS_FILE, JSON.stringify(eventsData, null, 2), 'utf8');

  console.log(`[merge_wechat] ✅ 合并完成:`);
  console.log(`  微信新增: ${addedCount} 篇`);
  console.log(`  旧记录升级: ${upgradedCount} 篇（contentOriginal 由 digest 升级为正文 markdown）`);
  console.log(`  总计: ${eventsData.items.length} 篇`);
  console.log(`  待AI分析: ${eventsData.stats.aiPending} 篇`);

  // 打印新增文章
  if (addedCount > 0) {
    console.log('\n[merge_wechat] 新增文章:');
    wechatArticles
      .filter(a => a.link && !existingUrls.has(a.link))
      .slice(0, 5)
      .forEach((a, i) => {
        const d = a.publishTime ? new Date(a.publishTime).toLocaleDateString('zh-CN') : '?';
        console.log(`  ${i + 1}. [${d}] [${a.sourceName}] ${(a.title || '').substring(0, 60)}`);
      });
  }

  console.log('[merge_wechat] 完成');
}

main();
