/**
 * FDA 官方信息采集器 v3 — 卡兹克风格
 *
 * 架构：采集(RSS+FR+Web) → 去重 → 纯规则分类映射 → 输出 events.json → 前端 fetch
 * 砍掉：openFDA API、SQLite、import 脚本、API Route
 *
 * 数据流：
 *   config/fda_sources.json → 采集 → 去重 → classify → transformToEvents
 *   → regulatory-hot/public/data/events.json → 前端 fetch('/data/events.json')
 */

const axios = require('axios');
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { XMLParser } = require('fast-xml-parser');
const fdaConfig = require('../../config/fda_sources.json');

class FDACollector {
  constructor(options = {}) {
    // 输出到前端 public/data 目录
    this.outputDir = options.outputDir || path.join(__dirname, '..', '..', 'regulatory-hot', 'public', 'data');
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
    this.requestDelay = options.requestDelay || 2000;

    if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });

    this.xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    this.axios = axios.create({
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml;q=0.8,*/*;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      }
    });
    this.stats = { rss: 0, fr: 0, web: 0, duplicates: 0, errors: 0 };
  }

  // ================================================================
  // 1. FDA RSS 采集
  // ================================================================

  async collectRSS() {
    console.log('\n📡 [FDA RSS] 开始采集...');
    const feeds = Object.entries(fdaConfig.fda.rss_feeds.feeds);
    const results = [];

    for (const [feedId, feed] of feeds) {
      try {
        console.log(`  📡 ${feed.name}`);
        const response = await this.axios.get(feed.url);
        const parsed = this.xmlParser.parse(response.data);
        const channel = parsed.rss?.channel || {};
        const items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);

        const normalized = items.map(item => this._normalizeRSS(item, feed, feedId));
        results.push(...normalized);
        console.log(`    ✅ ${normalized.length} items`);
      } catch (error) {
        console.log(`    ❌ ${error.message}`);
        this.stats.errors++;
      }
      await this._delay(this.requestDelay);
    }

    this.stats.rss = results.length;
    console.log(`📡 [FDA RSS] 完成: ${results.length} items`);
    return results;
  }

  _normalizeRSS(item, feed, feedId) {
    const now = new Date().toISOString();
    const title = (item.title || '').trim();
    const link = (item.link || '').trim();
    const description = (item.description || '').trim();
    const pubDate = item.pubDate || '';

    return {
      source_type: 'rss',
      source_id: feedId,
      source_name: feed.name,
      source_url: feed.url,
      category: feed.category,
      subcategory: feed.subcategory,
      importance_base: feed.importance,
      title,
      summary: description.replace(/<[^>]*>/g, '').substring(0, 500),
      content_html: description,
      published_date: pubDate ? new Date(pubDate).toISOString() : now,
      link,
      guid: item.guid?.['#text'] || item.guid || link,
      crawled_at: now,
      content_hash: crypto.createHash('sha256').update(link || title).digest('hex')
    };
  }

  // ================================================================
  // 2. Federal Register RSS 采集
  // ================================================================

  async collectFederalRegister() {
    console.log('\n🏛️ [Federal Register] 开始采集...');
    const feeds = Object.entries(fdaConfig.fda.federal_register.feeds);
    const results = [];

    for (const [feedId, feed] of feeds) {
      try {
        console.log(`  🏛️ ${feed.name}`);
        const response = await this.axios.get(feed.url);
        const parsed = this.xmlParser.parse(response.data);
        const channel = parsed.rss?.channel || {};
        const items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);

        const normalized = items.map(item => this._normalizeFR(item, feed, feedId));
        results.push(...normalized);
        console.log(`    ✅ ${normalized.length} items`);
      } catch (error) {
        console.log(`    ❌ ${error.message}`);
        this.stats.errors++;
      }
      await this._delay(this.requestDelay);
    }

    this.stats.fr = results.length;
    console.log(`🏛️ [Federal Register] 完成: ${results.length} items`);
    return results;
  }

  _normalizeFR(item, feed, feedId) {
    const now = new Date().toISOString();
    const title = (item.title || '').trim();
    const link = (item.link || '').trim();
    const description = (item.description || '').trim();
    const pubDate = item.pubDate || '';

    // FR RSS 有时含 dc:subject 标签
    const subjects = item['dc:subject'];
    const subjectArr = Array.isArray(subjects) ? subjects : (subjects ? [subjects] : []);

    return {
      source_type: 'fr',
      source_id: feedId,
      source_name: feed.name,
      source_url: feed.url,
      category: feed.category,
      subcategory: feed.subcategory,
      importance_base: feed.importance,
      title,
      summary: description.replace(/<[^>]*>/g, '').substring(0, 500),
      content_html: description,
      published_date: pubDate ? new Date(pubDate).toISOString() : now,
      link,
      guid: item.guid?.['#text'] || item.guid || link,
      crawled_at: now,
      content_hash: crypto.createHash('sha256').update(link || title).digest('hex'),
      fr_subjects: subjectArr
    };
  }

  // ================================================================
  // 3. Web 采集 (Playwright)
  // ================================================================

  async collectWeb() {
    console.log('\n🌐 [FDA Web] 开始爬取网页...');
    const pages = Object.entries(fdaConfig.fda.web_pages.pages);
    const results = [];
    let browser = null;

    try {
      browser = await chromium.launch({ headless: true });
      for (const [pageId, page] of pages) {
        try {
          console.log(`  🌐 ${page.name}`);
          const items = await this._scrapePage(browser, page, pageId);
          results.push(...items);
          console.log(`    ✅ ${items.length} items`);
        } catch (error) {
          console.log(`    ❌ ${error.message}`);
          this.stats.errors++;
        }
        await this._delay(this.requestDelay);
      }
    } finally {
      if (browser) await browser.close();
    }

    this.stats.web = results.length;
    console.log(`🌐 [FDA Web] 完成: ${results.length} items`);
    return results;
  }

  async _scrapePage(browser, pageConfig, pageId) {
    const context = await browser.newContext({ userAgent: this.userAgent });
    const page = await context.newPage();
    const results = [];

    try {
      await page.goto(pageConfig.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);

      const items = await page.evaluate(() => {
        const found = [];
        const selectors = [
          'article a[href]', '.usa-card a[href]', '.views-row a[href]',
          'li a[href]', '.field-content a[href]', '.teaser a[href]',
          'h3 a[href]', 'h2 a[href]', '.title a[href]'
        ];

        const seen = new Set();
        for (const sel of selectors) {
          document.querySelectorAll(sel).forEach(a => {
            const href = a.getAttribute('href');
            const text = a.textContent.trim();
            if (href && text.length > 15 && !seen.has(href) && !href.startsWith('#') && !href.startsWith('javascript:')) {
              seen.add(href);
              const fullUrl = href.startsWith('http') ? href : 'https://www.fda.gov' + href;
              found.push({ title: text.substring(0, 400), link: fullUrl, date: '', summary: '' });
            }
          });
          if (found.length > 5) break;
        }
        return found.slice(0, 50);
      });

      const now = new Date().toISOString();
      for (const item of items) {
        results.push({
          source_type: 'web',
          source_id: pageId,
          source_name: pageConfig.name,
          source_url: pageConfig.url,
          category: pageConfig.category,
          subcategory: pageConfig.subcategory,
          importance_base: pageConfig.importance,
          title: item.title,
          summary: item.summary,
          content_html: '',
          published_date: now,
          link: item.link,
          guid: item.link,
          crawled_at: now,
          content_hash: crypto.createHash('sha256').update(item.link || item.title).digest('hex')
        });
      }
    } finally {
      await context.close();
    }
    return results;
  }

  // ================================================================
  // 4. 去重
  // ================================================================

  deduplicate(items) {
    const seen = new Set();
    const unique = [];
    for (const item of items) {
      const key = item.content_hash || item.link || item.title;
      if (!seen.has(key)) { seen.add(key); unique.push(item); }
      else this.stats.duplicates++;
    }
    console.log(`\n🔄 [去重] ${items.length} → ${unique.length} (${this.stats.duplicates} dupes)`);
    return unique;
  }

  // ================================================================
  // 5. 纯规则分类映射 + 噪音过滤 — 零 AI 成本
  // ================================================================

  /**
   * 噪音判断：非医药监管核心内容
   */
  isNoise(text) {
    // 动物食品/宠物（非人用药品）
    if (/\b(pet food|dog food|cat food|animal food|veterinary|animal drug|pet treat|poultry|livestock)\b/i.test(text)) return true;
    // 膳食补充剂（非药品）
    if (/\b(dietary supplement|vitamin|mineral supplement|herbal supplement|protein powder|energy drink)\b/i.test(text)) return true;
    // 化妆品/美容（非药品器械）
    if (/\b(cosmetic|sunscreen|moisturizer|makeup|lipstick|nail polish|hair dye|perfume|skin cream|beauty)\b/i.test(text)) return true;
    // 烟草产品
    if (/\b(tobacco|cigarette|vaping|e-cigarette|nicotine product|smokeless tobacco)\b/i.test(text)) return true;
    // 食品（非药品/器械监管）
    if (/\b(food safety|foodborne|food facility|food label|menu label|nutrition facts|food additive)\b/i.test(text) &&
        !/\b(drug|device|biologic|medical|pharmaceutical)\b/i.test(text)) return true;
    return false;
  }

  classify(item) {
    const text = `${item.title} ${item.summary}`.toLowerCase();
    const isNoisy = this.isNoise(text);

    // 噪音内容：降低重要性，归入洞察
    if (isNoisy) {
      return {
        category: 'insight',
        subCategory: ['行业分析'],
        importance: 1,  // 最低重要性
        isNoise: true,
      };
    }

    let category = item.category || 'insight';
    let subCategory = item.subcategory || [];
    let importance = item.importance_base || 3;

    // 安全/合规关键词覆盖
    if (/\b(recall|withdraw|warning letter|seizure|injunction|arrest|indictment|consent decree)\b/.test(text)) {
      category = 'safety';
      if (/recall/.test(text)) subCategory = ['召回'];
      else if (/warning letter/.test(text)) subCategory = ['警告信'];
      else subCategory = ['违规处罚'];
      // 只给人用药品/器械的召回高重要性
      importance = /\b(drug|device|biologic|medical|pharmaceutical|surgical|implant|inject)\b/i.test(text)
        ? Math.max(importance, 5) : Math.max(importance, 3);
    }
    // 安全通讯
    else if (/\b(drug safety communication|safety alert|medwatch|adverse|boxed warning|black box)\b/.test(text)) {
      category = 'safety';
      subCategory = ['安全警戒'];
      importance = Math.max(importance, 5);
    }
    // 审批关键词
    else if (/\b(approve|approval|clearance|clear|authorize|authorization|licens)\b/.test(text)) {
      category = 'approval';
      if (/510\(k\)/.test(text)) subCategory = ['510(k) 批准'];
      else if (/\bpma\b/.test(text)) subCategory = ['PMA 批准'];
      else if (/\bbiosimilar/.test(text)) subCategory = ['仿制药批准'];
      else subCategory = ['新药批准'];
      importance = Math.max(importance, 4);
    }
    // 法规/指南
    else if (/\b(guidance|guideline|rule|regulation|draft|proposed|final rule|standard)\b/.test(text)) {
      category = 'regulation';
      if (/draft|proposed/.test(text)) subCategory = ['草案征求意见'];
      else if (/guidance/.test(text)) subCategory = ['指南发布'];
      else subCategory = ['法规发布'];
      importance = Math.max(importance, 4);
    }
    // 咨询委员会/会议
    else if (/\b(advisory committee|meeting|workshop|conference|hearing|public workshop)\b/.test(text)) {
      category = 'insight';
      subCategory = ['咨询委员会', '会议活动'];
    }

    // Federal Register 类型覆盖
    if (item.source_type === 'fr') {
      if (item.source_id === 'fr_rules') { category = 'regulation'; subCategory = ['法规发布']; importance = 5; }
      else if (item.source_id === 'fr_proposed_rules') { category = 'regulation'; subCategory = ['草案征求意见']; importance = 4; }
      else if (item.source_id === 'fr_notices') { category = 'insight'; subCategory = ['政策声明']; importance = 2; }
    }

    return { category, subCategory, importance, isNoise: false };
  }

  // ================================================================
  // 6. 转换为前端 events.json 格式
  // ================================================================

  transformToEvents(items) {
    const { SOURCES, IMPORTANCE_META } = this._getFrontendConfig();
    const fdaSource = SOURCES.find(s => s.id === 'fda') || { name: 'FDA', level: 'T1', country: 'US' };

    return items.map((item, idx) => {
      const { category, subCategory, importance, isNoise } = this.classify(item);

      // 基础五维分数（从 importance 推导）
      const scores = {
        sourceAuthority: isNoise ? 70 : 95,
        impactScope: item.source_type === 'fr' && item.source_id === 'fr_rules' ? 90 :
                     (item.source_type === 'fr' ? 70 : (importance >= 4 ? 75 : 50)),
        complianceUrgency: category === 'safety' ? 90 :
                          (category === 'regulation' ? 75 :
                          (category === 'approval' ? 60 : 40)),
        industryAttention: importance >= 5 ? 90 : (importance >= 4 ? 75 : (importance >= 3 ? 55 : 35)),
        timeliness: this._computeTimeliness(item.published_date),
      };
      const finalScore = Math.min(100, Math.round(
        scores.sourceAuthority * 0.30 + scores.impactScope * 0.25 +
        scores.complianceUrgency * 0.20 + scores.industryAttention * 0.15 +
        scores.timeliness * 0.10
      ));

      // 分类差异化精选阈值
      const thresholds = {
        regulation: 78,
        approval: 75,
        safety: 72,
        insight: 82,
      };
      const threshold = thresholds[category] || 80;

      return {
        id: item.content_hash.substring(0, 16),
        rawItemId: item.content_hash,
        title: item.title,
        titleEn: item.title,
        url: item.link,
        permalink: `/items/${item.content_hash.substring(0, 16)}`,
        summary: item.summary || '',
        sourceId: 'fda',
        sourceName: fdaSource.name,
        sourceLevel: fdaSource.level,
        sourceCountry: fdaSource.country,
        sourceChannel: item.source_type,
        sourceFeed: item.source_name,
        publishedAt: item.published_date,
        crawledAt: item.crawled_at,
        analyzedAt: item.crawled_at,
        category,
        subCategory,
        tags: [item.source_name],
        importance,
        scores,
        finalScore,
        selected: finalScore >= threshold && !isNoise,
        isLead: false,
        isSocial: false,
        affectedRegions: ['US'],
        aiModel: 'rule-based-v3',
        aiCost: 0,
        aiAnalyzedAt: item.crawled_at,
      };
    });
  }

  _computeTimeliness(publishedDate) {
    const diff = Date.now() - new Date(publishedDate).getTime();
    const hours = diff / (1000 * 60 * 60);
    if (hours < 24) return 95;
    if (hours < 72) return 80;
    if (hours < 168) return 65;
    if (hours < 720) return 50;
    return 30;
  }

  _getFrontendConfig() {
    // 从 config.ts 的逻辑中提取必要信息（避免 TS 导入）
    return {
      SOURCES: [{
        id: 'fda',
        name: '美国 FDA',
        level: 'T1',
        country: 'US',
      }],
      IMPORTANCE_META: {}
    };
  }

  // ================================================================
  // 7. 保存 events.json 到 public/data/
  // ================================================================

  saveEventsJSON(events) {
    const outputPath = path.join(this.outputDir, 'events.json');

    const output = {
      updated: new Date().toISOString(),
      stats: {
        total: events.length,
        sources: {
          rss: events.filter(e => e.sourceChannel === 'rss').length,
          fr: events.filter(e => e.sourceChannel === 'fr').length,
          web: events.filter(e => e.sourceChannel === 'web').length,
        },
        selected: events.filter(e => e.selected).length,
      },
      items: events,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n📦 [输出] ${outputPath}`);
    console.log(`   总计 ${events.length} 条 | 精选 ${output.stats.selected} 条`);
    console.log(`   RSS: ${output.stats.sources.rss} | FR: ${output.stats.sources.fr} | Web: ${output.stats.sources.web}`);
    return outputPath;
  }

  // ================================================================
  // 主流程
  // ================================================================

  async run() {
    console.log('============================================================');
    console.log('  FDA 官方信息采集 v3 — 卡兹克风格');
    console.log('  RSS(5) + Federal Register(3) + Web(8) = 16 采集点');
    console.log('============================================================');
    console.log(`  Start: ${new Date().toISOString()}`);
    console.log(`  Output: ${this.outputDir}\n`);

    let allItems = [];

    // 1. FDA RSS
    const rssItems = await this.collectRSS();
    allItems.push(...rssItems);

    // 2. Federal Register RSS
    const frItems = await this.collectFederalRegister();
    allItems.push(...frItems);

    // 3. Web 爬取
    const webItems = await this.collectWeb();
    allItems.push(...webItems);

    // 4. 去重
    const unique = this.deduplicate(allItems);

    // 5. 纯规则分类 + 转换
    console.log('\n🏷️ [分类映射] 纯规则分类...');
    const events = this.transformToEvents(unique);
    console.log(`🏷️ [分类映射] 完成: ${events.length} events`);

    // 6. 按时间排序
    events.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    // 7. 标记头条
    if (events.length > 0 && events[0].selected) events[0].isLead = true;

    // 8. 保存
    this.saveEventsJSON(events);

    console.log('\n============================================================');
    console.log(`  ✅ Done! RSS:${this.stats.rss} FR:${this.stats.fr} Web:${this.stats.web}`);
    console.log(`  Total: ${allItems.length} → ${unique.length} unique → ${events.length} events`);
    console.log('============================================================\n');

    return { stats: this.stats, total: events.length, outputDir: this.outputDir };
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

module.exports = FDACollector;
