const crypto = require('crypto');
const RSSCollector = require('./rss_collector');
const APICollector = require('./api_collector');
const WebCollector = require('./web_collector');

class CrawlEngine {
  constructor(config, db) {
    this.config = config;
    this.db = db;
    this.rssCollector = new RSSCollector({
      userAgent: config.meta.user_agent
    });
    this.apiCollector = new APICollector({
      userAgent: config.meta.user_agent,
      apiKey: process.env.OPENFDA_API_KEY || null
    });
    this.webCollector = new WebCollector({
      userAgent: config.meta.user_agent
    });
    this.stats = {
      total: 0,
      rss: 0,
      api: 0,
      web: 0,
      duplicates: 0,
      errors: 0,
      startTime: null,
      endTime: null
    };
  }

  /**
   * 从配置中提取所有RSS源
   */
  _getAllRSSSources() {
    const sources = [];
    const { regulatory_agencies, international_organizations, industry_organizations } = this.config.sources;

    for (const sourcesGroup of [regulatory_agencies, international_organizations, industry_organizations]) {
      if (!sourcesGroup) continue;
      this._traverseOrganizations(sourcesGroup, (org, region) => {
        if (org.feeds?.rss) {
          org.feeds.rss.forEach(feed => {
            sources.push({
              ...feed,
              organization: org.name,
              organization_en: org.name_en,
              region: region
            });
          });
        }
      });
    }

    return sources;
  }

  /**
   * 从配置中提取所有API源
   */
  _getAllAPISources() {
    const sources = [];
    const { regulatory_agencies, international_organizations, industry_organizations } = this.config.sources;

    for (const sourcesGroup of [regulatory_agencies, international_organizations, industry_organizations]) {
      if (!sourcesGroup) continue;
      this._traverseOrganizations(sourcesGroup, (org, region) => {
        if (org.feeds?.api) {
          org.feeds.api.forEach(api => {
            sources.push({
              ...api,
              organization: org.name,
              organization_en: org.name_en,
              region: region
            });
          });
        }
      });
    }

    return sources;
  }

  /**
   * 从配置中提取所有网页源
   */
  _getAllWebSources() {
    const sources = [];
    const { regulatory_agencies, international_organizations, industry_organizations } = this.config.sources;

    for (const sourcesGroup of [regulatory_agencies, international_organizations, industry_organizations]) {
      if (!sourcesGroup) continue;
      this._traverseOrganizations(sourcesGroup, (org, region) => {
        if (org.feeds?.web_pages) {
          org.feeds.web_pages.forEach(page => {
            sources.push({
              ...page,
              organization: org.name,
              organization_en: org.name_en,
              region: region
            });
          });
        }
      });
    }

    return sources;
  }

  /**
   * 遍历组织配置
   */
  _traverseOrganizations(sourcesGroup, callback) {
    // 遍历地区分组 (usa, eu, china, japan, korea, etc.)
    for (const [regionKey, regionData] of Object.entries(sourcesGroup)) {
      if (regionData.organizations) {
        const regionName = regionData.name || regionKey;
        for (const [orgKey, orgData] of Object.entries(regionData.organizations)) {
          callback(orgData, regionName);
        }
      }
    }
    // 也处理直接包含 organizations 的情况（如 international_organizations）
    if (sourcesGroup.organizations) {
      const regionName = sourcesGroup.name || '';
      for (const [orgKey, orgData] of Object.entries(sourcesGroup.organizations)) {
        callback(orgData, regionName);
      }
    }
  }

  /**
   * 计算内容哈希用于去重
   */
  _computeHash(item) {
    const content = `${item.guid || ''}${item.title || ''}${item.source_link || ''}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * 去重：检查哈希是否已存在
   */
  async _deduplicate(items) {
    const uniqueItems = [];
    for (const item of items) {
      const hash = this._computeHash(item);
      const exists = await this.db.checkDuplicate(hash);
      if (!exists) {
        item.content_hash = hash;
        uniqueItems.push(item);
      } else {
        this.stats.duplicates++;
      }
    }
    return uniqueItems;
  }

  /**
   * 执行完整采集流程
   */
  async runFullCrawl() {
    console.log('[CrawlEngine] Starting full crawl cycle...');
    this.stats.startTime = new Date();
    this.stats.total = 0;
    this.stats.rss = 0;
    this.stats.api = 0;
    this.stats.web = 0;
    this.stats.duplicates = 0;
    this.stats.errors = 0;

    let allItems = [];

    // 1. RSS采集
    const rssSources = this._getAllRSSSources();
    console.log(`[CrawlEngine] Collecting ${rssSources.length} RSS sources...`);
    try {
      const rssItems = await this.rssCollector.collectAll(rssSources);
      this.stats.rss = rssItems.length;
      allItems.push(...rssItems);
      console.log(`[CrawlEngine] RSS: ${rssItems.length} items collected`);
    } catch (error) {
      console.error(`[CrawlEngine] RSS collection failed: ${error.message}`);
      this.stats.errors++;
    }

    // 2. API采集
    const apiSources = this._getAllAPISources();
    console.log(`[CrawlEngine] Collecting ${apiSources.length} API sources...`);
    try {
      const apiItems = await this.apiCollector.collectAll(apiSources);
      this.stats.api = apiItems.length;
      allItems.push(...apiItems);
      console.log(`[CrawlEngine] API: ${apiItems.length} items collected`);
    } catch (error) {
      console.error(`[CrawlEngine] API collection failed: ${error.message}`);
      this.stats.errors++;
    }

    // 3. 网页采集
    const webSources = this._getAllWebSources();
    console.log(`[CrawlEngine] Collecting ${webSources.length} web sources...`);
    try {
      const webItems = await this.webCollector.collectAll(webSources);
      this.stats.web = webItems.length;
      allItems.push(...webItems);
      console.log(`[CrawlEngine] Web: ${webItems.length} items collected`);
    } catch (error) {
      console.error(`[CrawlEngine] Web collection failed: ${error.message}`);
      this.stats.errors++;
    }

    // 4. 去重
    console.log(`[CrawlEngine] Deduplicating ${allItems.length} items...`);
    const uniqueItems = await this._deduplicate(allItems);
    this.stats.total = uniqueItems.length;
    console.log(`[CrawlEngine] After dedup: ${uniqueItems.length} unique items (${this.stats.duplicates} duplicates removed)`);

    // 5. 保存原始数据
    if (uniqueItems.length > 0) {
      await this.db.saveRawItems(uniqueItems);
      console.log(`[CrawlEngine] ${uniqueItems.length} raw items saved to database`);
    }

    this.stats.endTime = new Date();
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    console.log(`[CrawlEngine] Crawl cycle completed in ${duration.toFixed(1)}s`);
    console.log(`[CrawlEngine] Stats: ${JSON.stringify(this.stats)}`);

    return {
      stats: this.stats,
      items: uniqueItems
    };
  }
}

module.exports = CrawlEngine;
