/**
 * AI 分析处理器
 * 使用 Claude API 对原始采集信息进行结构化提取、分类、分级
 */

class AIAnalyzer {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || '';
    this.model = options.model || process.env.AI_MODEL || 'claude-sonnet-5';
    this.baseUrl = options.baseUrl || process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1/messages';
    this.maxTokens = options.maxTokens || 4096;
    this.batchSize = options.batchSize || 10;
  }

  /**
   * 构建分析提示词
   */
  _buildAnalysisPrompt(item) {
    return `你是一个全球药品和医疗器械监管情报分析专家。请分析以下监管信息，提取结构化数据。

## 原始信息
- 来源: ${item.source_name}
- 类型: ${item.source_type}
- 分类: ${item.category || '未知'}
- 语言: ${item.language || 'en'}
- 标题: ${item.title || ''}
- 发布时间: ${item.published_date || '未知'}
- 原始链接: ${item.source_link || ''}
- 摘要: ${item.summary || ''}
- 完整内容: ${(item.full_content || item.summary || '').substring(0, 5000)}

## 分析要求
请以JSON格式返回分析结果，严格按照以下结构：

\`\`\`json
{
  "title_original": "原始标题",
  "title_cn": "准确的中文翻译标题",
  "summary_cn": "中文摘要（150-250字，包含核心信息）",
  "summary_en": "English summary (150-250 words)",
  "published_date": "ISO 8601格式日期",
  "effective_date": "生效日期（如适用，否则null）",
  "deadline_date": "意见征集截止日期（如适用，否则null）",
  "country": "国家/地区代码（US/EU/CN/JP/KR/CH/UK/CA/AU/INTL）",
  "region": "地区（北美/欧洲/亚洲/国际）",
  "organization": "发布机构中文名",
  "organization_en": "发布机构英文名",
  "authors": ["作者/委员会名称"],
  "stakeholders": ["相关方"],
  "background": "事件背景（100-200字，说明来龙去脉）",
  "key_points": ["关键要点1", "关键要点2", "关键要点3"],
  "category": "分类",
  "subcategory": "子分类",
  "importance_level": 4,
  "importance_reason": "分级理由（50字以内）",
  "impact_areas": ["影响领域"],
  "product_types": ["产品类型"],
  "therapeutic_areas": ["治疗领域"],
  "tags": ["标签1", "标签2"],
  "references_list": ["引用/参考链接"],
  "confidence_score": 0.85
}
\`\`\`

## 重要度分级标准（importance_level 1-5）
- 5级(重大): 新法规/指南颁布、重大安全警告/召回、突破性疗法批准
- 4级(高): 指南草案发布、重要审批决定、重大政策变更
- 3级(中): 一般政策更新、会议纪要、行业通知
- 2级(一般): 日常公告、活动通知、统计报告
- 1级(参考): 背景信息、历史存档、一般新闻

## 分类选项（category）
法规指南类 / 审批类 / 安全类 / 会议活动类 / 检查合规类 / 标准类 / 新闻动态类 / 出版物 / 其他

## 产品类型选项（product_types）
药品 / 医疗器械 / 生物制品 / 疫苗 / 体外诊断 / 组合产品 / 保健品 / 化妆品

## 治疗领域选项（therapeutic_areas）
肿瘤 / 心血管 / 神经系统 / 免疫 / 感染 / 呼吸 / 内分泌 / 血液 / 眼科 / 皮肤 / 消化 / 罕见病 / 通用

请直接返回JSON，不要包含其他文字。`;
  }

  /**
   * 调用 Claude API 分析单条信息
   */
  async analyzeItem(item) {
    if (!this.apiKey) {
      return this._fallbackAnalysis(item);
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          messages: [{
            role: 'user',
            content: this._buildAnalysisPrompt(item)
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const text = data.content[0].text;

      // 提取JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          ...result,
          content_hash: item.content_hash,
          raw_item_id: item.id,
          source_url: item.source_url,
          source_link: item.source_link,
          original_language: item.language || 'en',
          ai_analyzed_at: new Date().toISOString(),
          ai_model: this.model,
          source_organization: item.source_name,
          review_status: 'pending'
        };
      }

      throw new Error('Failed to parse JSON from response');
    } catch (error) {
      console.error(`[AI] Analysis failed for ${item.title}: ${error.message}`);
      return this._fallbackAnalysis(item);
    }
  }

  /**
   * 降级分析（无API时使用规则引擎）
   */
  _fallbackAnalysis(item) {
    const importanceMap = {
      'guidance': 4,
      'regulations': 5,
      'safety': 4,
      'recalls': 4,
      'compliance': 4,
      'approvals': 4,
      'meetings': 2,
      'news': 2,
      'policy': 3,
      'standards': 3,
      'announcements': 3,
      'newsletter': 2,
      'general': 2
    };

    const categoryMap = {
      'guidance': '法规指南类',
      'regulations': '法规指南类',
      'safety': '安全类',
      'recalls': '安全类',
      'compliance': '检查合规类',
      'approvals': '审批类',
      'meetings': '会议活动类',
      'news': '新闻动态类',
      'policy': '法规指南类',
      'standards': '标准类',
      'announcements': '新闻动态类',
      'newsletter': '出版物',
      'general': '新闻动态类'
    };

    const category = categoryMap[item.category] || '新闻动态类';
    const importance = importanceMap[item.category] || 3;

    return {
      content_hash: item.content_hash,
      raw_item_id: item.id,
      title_original: item.title || '',
      title_cn: item.title_cn || item.title || '',
      summary_cn: item.summary || '',
      summary_en: item.summary || '',
      published_date: item.published_date || new Date().toISOString(),
      effective_date: null,
      deadline_date: null,
      country: this._guessCountry(item),
      region: this._guessRegion(item),
      organization: item.source_name || '',
      organization_en: item.source_name || '',
      authors: [],
      stakeholders: [],
      background: '',
      key_points: [],
      category: category,
      subcategory: '',
      importance_level: importance,
      importance_reason: `基于信息分类"${item.category}"自动判定`,
      impact_areas: [],
      product_types: [],
      therapeutic_areas: [],
      tags: [],
      references_list: [],
      source_url: item.source_url || '',
      source_link: item.source_link || '',
      original_language: item.language || 'en',
      ai_analyzed_at: new Date().toISOString(),
      ai_model: 'rule-engine',
      confidence_score: 0.5,
      source_organization: item.source_name || '',
      review_status: 'pending'
    };
  }

  /**
   * 根据来源推测国家
   */
  _guessCountry(item) {
    const name = (item.source_name || '').toLowerCase();
    const url = (item.source_url || '').toLowerCase();
    const link = (item.source_link || '').toLowerCase();

    // Check multiple fields for better matching
    const combined = `${name} ${url} ${link}`;

    if (combined.includes('fda') || combined.includes('openfda') || combined.includes('usp') || name.includes('usp')) return 'US';
    if (name.includes('ema') || name.includes('edqm') || name.includes('hma') || url.includes('ema.europa') || url.includes('edqm')) return 'EU';
    if (name.includes('nmpa') || name.includes('cde') || name.includes('cfdi') || url.includes('nmpa.gov') || url.includes('cde.org')) return 'CN';
    if (name.includes('pmda') || name.includes('mhlw') || url.includes('pmda.go') || url.includes('mhlw.go')) return 'JP';
    if (name.includes('mfds') || url.includes('mfds.go')) return 'KR';
    if (name.includes('swissmedic') || url.includes('swissmedic')) return 'CH';
    if (name.includes('mhra') || url.includes('gov.uk')) return 'UK';
    if (name.includes('health canada') || name.includes('canada.ca') || url.includes('canada.ca')) return 'CA';
    if (name.includes('tga') || url.includes('tga.gov')) return 'AU';
    if (name.includes('who') || name.includes('ich') || name.includes('pics') || name.includes('imdrf') || name.includes('iso')) return 'INTL';
    return 'INTL';
  }

  /**
   * 根据来源推测地区
   */
  _guessRegion(item) {
    const country = this._guessCountry(item);
    const regionMap = {
      'US': '北美', 'CA': '北美',
      'EU': '欧洲', 'UK': '欧洲', 'CH': '欧洲',
      'CN': '亚洲', 'JP': '亚洲', 'KR': '亚洲',
      'AU': '大洋洲',
      'INTL': '国际'
    };
    return regionMap[country] || '国际';
  }

  /**
   * 批量分析
   */
  async analyzeBatch(items) {
    const results = [];
    for (const item of items) {
      const result = await this.analyzeItem(item);
      if (result) results.push(result);

      // API 调用之间增加延迟
      if (this.apiKey) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    return results;
  }

  /**
   * 运行完整分析流程
   */
  async runAnalysis(db, limit = 50) {
    console.log('[AI] Starting analysis of unanalyzed items...');

    const unanalyzedItems = db.getUnanalyzedItems(limit);
    console.log(`[AI] Found ${unanalyzedItems.length} unanalyzed items`);

    if (unanalyzedItems.length === 0) {
      return { analyzed: 0 };
    }

    const analyzedEvents = await this.analyzeBatch(unanalyzedItems);

    // 保存分析结果
    let saved = 0;
    for (const event of analyzedEvents) {
      try {
        db.saveRegulatoryEvent(event);
        saved++;
      } catch (error) {
        console.error(`[AI] Failed to save event: ${error.message}`);
      }
    }

    console.log(`[AI] Analysis complete: ${saved}/${unanalyzedItems.length} events saved`);
    return { analyzed: saved, total: unanalyzedItems.length };
  }
}

module.exports = AIAnalyzer;
