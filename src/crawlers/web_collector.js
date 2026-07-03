const { chromium } = require('playwright');

class WebCollector {
  constructor(options = {}) {
    this.userAgent = options.userAgent || 'RegulatoryMonitor/1.0';
    this.browser = null;
  }

  /**
   * 初始化浏览器
   */
  async initBrowser() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
    }
    return this.browser;
  }

  /**
   * 关闭浏览器
   */
  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * 采集单个网页
   * @param {Object} source - 网页源配置 {name, url, category, language, scrape_method}
   * @returns {Promise<Array>}
   */
  async collect(source) {
    const browser = await this.initBrowser();
    const context = await browser.newContext({
      userAgent: this.userAgent,
      locale: source.language === 'zh' ? 'zh-CN' :
              source.language === 'ja' ? 'ja-JP' :
              source.language === 'ko' ? 'ko-KR' : 'en-US'
    });

    const page = await context.newPage();

    try {
      await page.goto(source.url, {
        waitUntil: 'networkidle',
        timeout: 60000
      });

      // 等待内容加载
      await page.waitForTimeout(3000);

      // 根据不同机构使用不同提取策略
      const items = await this._extractItems(page, source);

      await context.close();
      return items;
    } catch (error) {
      console.error(`[Web] Failed to collect from ${source.name}: ${error.message}`);
      await context.close();
      return [];
    }
  }

  /**
   * 提取页面内容条目
   */
  async _extractItems(page, source) {
    // 通用提取策略：查找文章列表项
    const items = await page.evaluate((sourceInfo) => {
      const results = [];

      // 通用选择器：查找常见列表结构
      const selectors = [
        'article', '.article-item', '.news-item', '.list-item',
        'li.news', '.content-item', '.post', '.entry',
        'tr.news-row', '.views-row', '.teaser',
        '.list-group-item', '.card', '.news-card',
        // 中文站点常见选择器
        '.news_list li', '.list li', '.xxgk_item',
        '.info_list li', '.article_list li',
        // 列表中的链接
        'ul.list > li > a', '.news-list a'
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0 && elements.length < 200) {
          elements.forEach(el => {
            const link = el.querySelector('a[href]') || el.closest('a[href]');
            const titleEl = el.querySelector('h1, h2, h3, h4, h5, .title, .headline') || link;
            const dateEl = el.querySelector('time, .date, .published, .post-date, span.date');
            const summaryEl = el.querySelector('.summary, .excerpt, .description, p');

            if (titleEl || link) {
              const title = (titleEl?.textContent || link?.textContent || '').trim();
              const href = link?.getAttribute('href') || '';
              const fullUrl = href ? (href.startsWith('http') ? href : new URL(href, window.location.origin).href) : '';

              if (title && title.length > 5) {
                results.push({
                  title: title.substring(0, 500),
                  source_link: fullUrl,
                  published_date: dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime') || '',
                  summary: summaryEl?.textContent?.trim() || '',
                  source_name: sourceInfo.name,
                  category: sourceInfo.category,
                  language: sourceInfo.language
                });
              }
            }
          });
          if (results.length > 0) break; // 如果找到了就用第一个有效的选择器
        }
      }

      // 如果通用选择器没找到，尝试从所有链接中提取
      if (results.length === 0) {
        const allLinks = document.querySelectorAll('a[href]');
        allLinks.forEach(link => {
          const text = link.textContent.trim();
          const href = link.getAttribute('href');
          if (text.length > 20 && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
            const fullUrl = href.startsWith('http') ? href : new URL(href, window.location.origin).href;
            results.push({
              title: text.substring(0, 500),
              source_link: fullUrl,
              published_date: '',
              summary: '',
              source_name: sourceInfo.name,
              category: sourceInfo.category,
              language: sourceInfo.language
            });
          }
        });
      }

      return results.slice(0, 100); // 限制最多100条
    }, { name: source.name, category: source.category, language: source.language });

    // 格式化输出
    return items.map(item => ({
      source_type: 'web',
      source_name: source.name,
      source_url: source.url,
      category: source.category,
      language: source.language,
      title: item.title,
      title_cn: '',
      summary: item.summary,
      full_content: '',
      published_date: item.published_date && !isNaN(new Date(item.published_date)) ? new Date(item.published_date).toISOString() : new Date().toISOString(),
      source_link: item.source_link,
      guid: item.source_link || item.title,
      authors: [],
      categories: [source.category],
      raw_data: JSON.stringify(item),
      crawled_at: new Date().toISOString()
    }));
  }

  /**
   * 批量采集多个网页
   */
  async collectAll(sources) {
    const allItems = [];
    for (const source of sources) {
      const items = await this.collect(source);
      allItems.push(...items);
      // 页面间增加延迟
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    await this.closeBrowser();
    return allItems;
  }
}

module.exports = WebCollector;
