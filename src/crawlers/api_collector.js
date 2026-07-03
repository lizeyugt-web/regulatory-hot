const axios = require('axios');

class APICollector {
  constructor(options = {}) {
    this.client = axios.create({
      timeout: 60000,
      headers: {
        'User-Agent': options.userAgent || 'RegulatoryMonitor/1.0',
        'Accept': 'application/json'
      }
    });
    this.apiKey = options.apiKey || null;
  }

  /**
   * 格式化日期为 YYYYMMDD
   */
  _formatDate(date) {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  /**
   * 替换URL模板参数
   */
  _replaceTemplateParams(value) {
    const now = new Date();
    const sinceDate = new Date(now.getTime() - 13 * 60 * 60 * 1000);
    const str = String(value);

    return str
      .replace('{since_date}', this._formatDate(sinceDate))
      .replace('{now_date}', this._formatDate(now));
  }

  /**
   * 采集openFDA API
   * @param {Object} source - API源配置
   * @returns {Promise<Array>}
   */
  async collect(source) {
    try {
      let url = source.endpoint;

      // 替换时间参数
      if (source.params) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(source.params)) {
          searchParams.append(key, this._replaceTemplateParams(value));
        }
        url += '?' + searchParams.toString();
      }

      // 添加API Key
      if (this.apiKey) {
        url += (url.includes('?') ? '&' : '?') + `api_key=${this.apiKey}`;
      }

      const response = await this.client.get(url);
      const data = response.data;

      if (!data.results || data.results.length === 0) {
        return [];
      }

      return data.results.map(item => ({
        source_type: 'api',
        source_name: source.name,
        source_url: source.endpoint,
        category: source.category,
        language: 'en',
        title: this._extractTitle(item, source),
        title_cn: '',
        summary: this._extractSummary(item, source),
        full_content: JSON.stringify(item),
        published_date: this._extractDate(item, source),
        source_link: this._extractLink(item, source),
        guid: this._generateGUID(item, source),
        authors: [],
        categories: [source.category],
        raw_data: JSON.stringify(item),
        crawled_at: new Date().toISOString()
      }));
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.warn(`[API] No results for ${source.name}`);
        return [];
      }
      console.error(`[API] Failed to collect from ${source.name}: ${error.message}`);
      return [];
    }
  }

  _extractTitle(item, source) {
    // openFDA 不同端点的字段映射
    if (item.patient && item.patient.drug) {
      return `Adverse Event Report: ${item.patient.drug[0]?.medicinalproduct || 'Unknown Drug'}`;
    }
    if (item.openfda && item.openfda.brand_name) {
      return `Drug Label Update: ${item.openfda.brand_name[0]}`;
    }
    if (item.product_description) {
      return `Recall: ${item.product_description}`;
    }
    if (item.recalling_firm) {
      return `Recall by ${item.recalling_firm}`;
    }
    return `FDA Update: ${item.report_number || item.id || 'Unknown'}`;
  }

  _extractSummary(item, source) {
    if (item.patient && item.patient.reaction) {
      const reactions = item.patient.reaction.map(r => r.reactionmeddrapt).filter(Boolean).join(', ');
      return `Adverse reactions: ${reactions}`;
    }
    if (item.reason_for_recall) {
      return `Reason: ${item.reason_for_recall}`;
    }
    return '';
  }

  _extractDate(item, source) {
    const dateFields = [
      'receivedate', 'effective_time', 'report_date',
      'recall_initiation_date', 'date_received'
    ];
    for (const field of dateFields) {
      if (item[field]) {
        const d = new Date(item[field]);
        if (!isNaN(d.getTime())) return d.toISOString();
      }
    }
    return new Date().toISOString();
  }

  _extractLink(item, source) {
    return `https://api.fda.gov${source.endpoint}`;
  }

  _generateGUID(item, source) {
    return `${source.endpoint}:${item.report_number || item.id || JSON.stringify(item).slice(0, 100)}`;
  }

  /**
   * 批量采集多个API源
   */
  async collectAll(sources) {
    const results = [];
    for (const source of sources) {
      // API调用之间增加延迟，遵守速率限制
      await new Promise(resolve => setTimeout(resolve, 500));
      const items = await this.collect(source);
      results.push(...items);
    }
    return results;
  }
}

module.exports = APICollector;
