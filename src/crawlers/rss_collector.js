const Parser = require('rss-parser');
const { chromium } = require('playwright');

class RSSCollector {
  constructor(options = {}) {
    this.parser = new Parser({
      timeout: 30000,
      headers: {
        'User-Agent': options.userAgent || 'RegulatoryMonitor/1.0'
      }
    });
  }

  /**
   * 采集单个RSS源
   * @param {Object} source - RSS源配置 {name, url, category, language}
   * @returns {Promise<Array>} 采集到的条目列表
   */
  async collect(source) {
    try {
      const feed = await this.parser.parseURL(source.url);
      return feed.items.map(item => ({
        source_type: 'rss',
        source_name: source.name,
        source_url: source.url,
        category: source.category,
        language: source.language,
        title: item.title || '',
        title_cn: '',
        summary: item.contentSnippet || item.content || '',
        full_content: item.content || '',
        published_date: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        source_link: item.link || '',
        guid: item.guid || item.link || '',
        authors: item.creator ? [item.creator] : [],
        categories: item.categories || [],
        raw_data: JSON.stringify(item),
        crawled_at: new Date().toISOString()
      }));
    } catch (error) {
      console.error(`[RSS] Failed to collect from ${source.name}: ${error.message}`);
      return [];
    }
  }

  /**
   * 批量采集多个RSS源
   * @param {Array} sources - RSS源配置列表
   * @returns {Promise<Array>} 所有采集到的条目
   */
  async collectAll(sources) {
    const results = await Promise.allSettled(
      sources.map(source => this.collect(source))
    );

    const items = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        items.push(...result.value);
      } else {
        console.error(`[RSS] Source ${sources[index].name} failed: ${result.reason}`);
      }
    });

    return items;
  }
}

module.exports = RSSCollector;
