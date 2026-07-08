/**
 * 统一 AI Gateway (CJS) — SPEC-C 实现
 *
 * 所有 AI 调用的统一入口：
 *   - chatCompletion: 基础对话补全（含重试、速率限制处理）
 *   - analyzeEvent: 一步分析事件（翻译+摘要+评分）
 *   - calcCost: 费用计算
 *   - estimateTokens: Token 估算
 *
 * 供 analyze.cjs 和 fda_collector.js 共同使用。
 */

const fs = require('fs');
const path = require('path');

// ===========================================================================
// 配置
// ===========================================================================
const DEFAULT_CONFIG = {
  baseUrl: process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1',
  apiKey: process.env.SILICONFLOW_API_KEY || '',
  model: 'deepseek-ai/DeepSeek-V3.2',  // 默认用 DeepSeek，避免 Qwen thinking 模式 content 为空
  maxTokens: 1024,
  temperature: 0.3,
  concurrency: 5,
  maxRetries: 3,
};

const PRICING = {
  'Qwen/Qwen3.5-35B-A3B': { input: 0.40, output: 3.20 },
  'deepseek-ai/DeepSeek-V3.2': { input: 1.33, output: 4.00 },
  default: { input: 1.00, output: 2.00 },
};

// ===========================================================================
// 类定义
// ===========================================================================
class AIGateway {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stats = {
      totalCalls: 0,
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    };

    // 自动从 .env 加载 API Key
    if (!this.config.apiKey) {
      this._loadApiKey();
    }
  }

  _loadApiKey() {
    const envPaths = [
      path.join(__dirname, '..', '.env'),
      path.join(__dirname, '..', 'regulatory-hot', '.env'),
      path.join(__dirname, '..', '..', 'regulatory-hot', '.env'),
    ];
    for (const envPath of envPaths) {
      try {
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf8');
          for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) continue;
            if (trimmed.slice(0, eqIdx).trim() === 'SILICONFLOW_API_KEY') {
              this.config.apiKey = trimmed.slice(eqIdx + 1).trim();
              return;
            }
          }
        }
      } catch { /* noop */ }
    }
  }

  // =========================================================================
  // 核心方法：Chat Completion（含重试和速率限制处理）
  // =========================================================================
  async chatCompletion(messages, options = {}) {
    const {
      model = this.config.model,
      maxTokens = this.config.maxTokens,
      temperature = this.config.temperature,
    } = options;

    if (!this.config.apiKey) {
      throw new Error('SILICONFLOW_API_KEY 未配置');
    }

    let lastError = null;
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
          },
          body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          if (response.status === 429) {
            const waitMs = Math.min((attempt + 1) * 2000, 10000);
            await this._sleep(waitMs);
            continue;
          }
          throw new Error(`API ${response.status}: ${errText.slice(0, 200)}`);
        }

        const data = await response.json();
        // Qwen thinking 模型默认开启推理模式，content 可能为空，实际内容在 reasoning_content
        const rawContent = data.choices?.[0]?.message?.content || '';
        const reasoningContent = data.choices?.[0]?.message?.reasoning_content || '';
        const content = rawContent || reasoningContent;
        const usage = data.usage || {};

        this.stats.totalCalls++;
        const inputTokens = usage.prompt_tokens || this.estimateTokens(messages.map(m => m.content).join('\n'));
        const outputTokens = usage.completion_tokens || this.estimateTokens(content);
        this.stats.totalInputTokens += inputTokens;
        this.stats.totalOutputTokens += outputTokens;

        const cost = this.calcCost(model, inputTokens, outputTokens);
        this.stats.totalCost += cost;

        return { content, usage: { promptTokens: inputTokens, completionTokens: outputTokens }, model: data.model || model, cost };
      } catch (err) {
        lastError = err;
        if (attempt < this.config.maxRetries - 1) {
          await this._sleep((attempt + 1) * 1000);
        }
      }
    }
    throw lastError;
  }

  // =========================================================================
  // 一步分析事件（对齐 SPEC-B：采集-分析一体化）
  // =========================================================================
  async analyzeEvent(event) {
    const prompt = this._buildAnalyzePrompt(event);
    const messages = [{ role: 'user', content: prompt }];

    const result = await this.chatCompletion(messages);

    // 解析 JSON
    let parsed;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = {}; }
      } else { parsed = {}; }
    }

    // 写入 AI 字段
    if (parsed.titleCn) event.title = parsed.titleCn;
    event.aiSummaryCn = parsed.aiSummaryCn || '';
    event.aiReason = parsed.aiReason || '';
    event.aiModel = result.model || this.config.model;
    event.aiAnalyzedAt = new Date().toISOString();

    if (parsed.contentCn) {
      event.contentCn = parsed.contentCn;
      event.aiTranslateModel = result.model;
      event.aiTranslateAt = new Date().toISOString();
    }

    // 五维评分
    if (parsed.scores && typeof parsed.scores === 'object') {
      const s = parsed.scores;
      event.scores = {
        sourceAuthority: this._clamp(s.sourceAuthority, 0, 100),
        impactScope: this._clamp(s.impactScope, 0, 100),
        timeliness: this._clamp(s.timeliness, 0, 100),
        complianceUrgency: this._clamp(s.complianceUrgency, 0, 100),
        industryAttention: this._clamp(s.industryAttention, 0, 100),
      };
      event.finalScore = this._computeFinalScore(event.scores, event.sourceLevel);
    }

    event.aiCost = (event.aiCost || 0) + result.cost;

    return { cost: result.cost, inputTokens: result.usage.promptTokens, outputTokens: result.usage.completionTokens };
  }

  // =========================================================================
  // 批量分析
  // =========================================================================
  async batchAnalyze(events, { concurrency = this.config.concurrency, onProgress = null } = {}) {
    const toAnalyze = events.filter(e => !e.aiSummaryCn || (typeof e.aiSummaryCn === 'string' && e.aiSummaryCn.trim().length === 0));
    if (toAnalyze.length === 0) return { analyzed: 0, totalCost: 0 };

    let doneCount = 0;
    let errorCount = 0;
    let batchCost = 0;

    for (let i = 0; i < toAnalyze.length; i += concurrency) {
      const batch = toAnalyze.slice(i, Math.min(i + concurrency, toAnalyze.length));
      const tasks = batch.map(async (event) => {
        try {
          const r = await this.analyzeEvent(event);
          return { ok: true, cost: r.cost };
        } catch (err) {
          return { ok: false, error: err.message };
        }
      });

      const results = await Promise.all(tasks);
      for (const r of results) {
        if (r.ok) { doneCount++; batchCost += r.cost; }
        else errorCount++;
      }

      if (onProgress) {
        onProgress({ done: doneCount, errors: errorCount, total: toAnalyze.length, cost: batchCost });
      }
    }

    return { analyzed: doneCount, errors: errorCount, totalCost: batchCost };
  }

  // =========================================================================
  // 工具方法
  // =========================================================================
  estimateTokens(text) {
    if (!text) return 0;
    const cnChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    return Math.ceil(cnChars / 1.5 + (text.length - cnChars) / 4);
  }

  calcCost(model, inputTokens, outputTokens) {
    const p = PRICING[model] || PRICING.default;
    return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
  }

  getStats() {
    return { ...this.stats, model: this.config.model, baseUrl: this.config.baseUrl };
  }

  _sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  _clamp(v, min, max) {
    const n = Math.round(Number(v));
    if (isNaN(n)) return 50;
    return Math.max(min, Math.min(max, n));
  }

  _computeFinalScore(scores, sourceLevel) {
    const weights = {
      sourceAuthority: 0.30, impactScope: 0.25,
      complianceUrgency: 0.20, industryAttention: 0.15, timeliness: 0.10,
    };
    const baseScore = { 'T1': 85, 'T1.5': 65, 'T2': 45, 'T3': 25 };
    const weighted =
      scores.sourceAuthority * weights.sourceAuthority +
      scores.impactScope * weights.impactScope +
      scores.complianceUrgency * weights.complianceUrgency +
      scores.industryAttention * weights.industryAttention +
      scores.timeliness * weights.timeliness;
    const sourceBonus = ((baseScore[sourceLevel] || 50) - 50) * 0.1;
    return Math.min(100, Math.max(0, Math.round(weighted + sourceBonus)));
  }

  _buildAnalyzePrompt(event) {
    const hasOriginal = event.contentOriginal && event.contentOriginal.length > 0;
    const contentOriginalSection = hasOriginal
      ? `\n原文内容：${event.contentOriginal.substring(0, 5000)}`
      : '';

    const isWechat = event.source === 'wechat' || (event.sourceId && event.sourceId.startsWith('wechat-'));
    const isChinese = event.contentOriginalLang === 'zh' || isWechat;

    // 确定原标题和语言标识
    let titleLine = '';
    if (isChinese) {
      titleLine = `标题：${event.title || ''}`;
    } else {
      titleLine = `标题（${event.contentOriginalLang === 'ja' ? '日文' : '英文'}）：${event.titleEn || event.title || ''}`;
    }

    const sourceDesc = isWechat
      ? `微信公众号：${event.sourceName || ''}\n描述：${event.sourceFeed || event.sourceDesc || ''}`
      : `来源：${event.sourceName || ''}\n分类：${event.category || ''}`;

    const focusHint = isWechat
      ? '重点关注：国内监管政策变化、行业动态、合规要点、对药企的实际影响。'
      : '重点关注：政策表态、指南文件、AI/ML监管、国际协调动态。';

    return `你是全球医药监管情报分析专家。请分析以下监管相关信息。${focusHint}

【原始信息】
${titleLine}
摘要/简介：${event.summary || event.digest || '(无)'}${contentOriginalSection}
${sourceDesc}

请返回 JSON（直接输出，不要 markdown 代码块）：
{
  "titleCn": "准确、专业的中文标题${isChinese ? '（优化提炼，20字以内）' : '翻译'}"${isChinese ? ',' : ''}
  ${isChinese ? '' : '"aiSummaryCn": "中文摘要（150-250字），包含：事件核心事实（谁/什么/何时）、影响范围（哪些产品/领域受影响）、合规要点（需要关注的关键合规事项）",'}
  ${isChinese ? '"aiSummaryCn": "中文摘要（150-250字），提炼文章核心观点，包含：事件背景、关键信息、对行业的影响/启示",' : ''}
  "aiReason": "推荐理由（1-2句话），说明为什么中国药企/监管从业者需要关注这条信息",
  "scores": {
    "sourceAuthority": 0-100,
    "impactScope": 0-100,
    "complianceUrgency": 0-100,
    "industryAttention": 0-100,
    "timeliness": 0-100
  }
}`;
  }
}

// ===========================================================================
// 导出
// ===========================================================================
module.exports = { AIGateway, DEFAULT_CONFIG, PRICING };
