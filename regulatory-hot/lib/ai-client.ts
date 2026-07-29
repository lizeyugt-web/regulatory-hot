/**
 * 统一 AI 客户端 — 兼容 OpenAI Chat Completions 协议
 *
 * Chat 类调用统一走 WorkBuddy 积分反代（config/ai-models.json，默认 127.0.0.1:8002）
 * Embeddings / Rerank 保留硅基流动（反代不支持这两类 API）
 *
 * 封装：
 *   - Chat Completions（预筛 / 五维评分 / 翻译摘要）
 *   - Embeddings（语义聚类，硅基流动）
 *   - Rerank（聚类精排，硅基流动）
 */
import { PRE_FILTER, SCORING_AI, EMBEDDING_CONFIG, RERANKER_CONFIG } from './config';
import { getAIModuleConfig } from './ai-config';

// ===========================================================================
// 类型定义
// ===========================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'json_object' | 'text';
}

export interface ChatCompletionResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

export interface RerankResult {
  index: number;
  relevanceScore: number;
}

// ===========================================================================
// 1. Chat Completions（预筛 / 评分 / 翻译）
// ===========================================================================

/**
 * 从模型输出中提取 JSON（处理 markdown 代码块、前后空格等）
 */
function extractJson(text: string): string {
  // 去掉 markdown 代码块包裹
  let cleaned = text.trim();
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    cleaned = codeBlockMatch[1].trim();
  }
  // 尝试匹配 JSON 对象
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : cleaned;
}

function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(extractJson(text)) as T;
  } catch {
    return fallback;
  }
}

export async function chatCompletion(
  options: ChatCompletionOptions,
): Promise<ChatCompletionResponse> {
  const scoringCfg = getAIModuleConfig('scoring');
  const {
    model = scoringCfg.model,
    messages,
    maxTokens = 1024,
    temperature = 0,
    responseFormat = 'text',
  } = options;

  const body: Record<string, unknown> = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  if (responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(`${scoringCfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${scoringCfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI 反代 error [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  return {
    content: choice?.message?.content ?? '',
    model: data.model,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}

// ===========================================================================
// 2. 预筛（便宜快速模型）
// ===========================================================================

export interface PreFilterResult {
  relevant: boolean;
  reason: string;
  confidence: number;
}

export async function preFilterWithAI(
  title: string,
  content: string,
): Promise<PreFilterResult & { cost: number }> {
  const prefilterCfg = getAIModuleConfig('prefilter');
  const prompt = `${PRE_FILTER.prompt}\n\n标题：${title}\n内容：${content.substring(0, 2000)}`;

  const result = await chatCompletion({
    model: prefilterCfg.model,
    messages: [
      { role: 'system', content: '你是一个监管信息筛选助手，只输出 JSON。' },
      { role: 'user', content: prompt },
    ],
    maxTokens: PRE_FILTER.maxTokens,
    temperature: PRE_FILTER.temperature,
    responseFormat: 'json_object',
  });

  const parsed = safeJsonParse<{ relevant: boolean; reason: string; confidence?: number }>(
    result.content,
    { relevant: true, reason: '预筛解析失败，默认通过' },
  );

  return {
    relevant: parsed.relevant,
    reason: parsed.reason ?? '',
    confidence: parsed.confidence ?? (parsed.relevant ? 0.8 : 0.3),
    cost: PRE_FILTER.estimatedCostPerItem,
  };
}

// ===========================================================================
// 3. 五维评分（高质量精评模型）
// ===========================================================================

export interface FiveDimensionScores {
  sourceAuthority: number;
  impactScope: number;
  complianceUrgency: number;
  industryAttention: number;
  timeliness: number;
}

export async function scoreWithAI(
  title: string,
  content: string,
  sourceName: string,
  category: string,
): Promise<FiveDimensionScores & { cost: number }> {
  const scoringCfg = getAIModuleConfig('scoring');
  const prompt = `${SCORING_AI.prompt}\n\n来源：${sourceName}\n分类：${category}\n标题：${title}\n内容：${content.substring(0, 3000)}`;

  const result = await chatCompletion({
    model: scoringCfg.model,
    messages: [
      { role: 'system', content: '你是一个医药监管信息评分专家，只输出 JSON。' },
      { role: 'user', content: prompt },
    ],
    maxTokens: SCORING_AI.maxTokens,
    temperature: SCORING_AI.temperature,
    responseFormat: 'json_object',
  });

  const parsed = safeJsonParse<FiveDimensionScores>(result.content, {
    sourceAuthority: 70,
    impactScope: 60,
    complianceUrgency: 55,
    industryAttention: 60,
    timeliness: 70,
  });

  return {
    sourceAuthority: clampScore(parsed.sourceAuthority),
    impactScope: clampScore(parsed.impactScope),
    complianceUrgency: clampScore(parsed.complianceUrgency),
    industryAttention: clampScore(parsed.industryAttention),
    timeliness: clampScore(parsed.timeliness),
    cost: SCORING_AI.estimatedCostPerItem,
  };
}

function clampScore(value: unknown): number {
  const n = Number(value);
  if (isNaN(n)) return 60;
  return Math.min(100, Math.max(0, Math.round(n)));
}

// ===========================================================================
// 4. Embeddings（语义聚类）
// ===========================================================================

export async function getEmbedding(
  text: string,
): Promise<EmbeddingResponse> {
  const embCfg = getAIModuleConfig('embedding');
  const response = await fetch(`${embCfg.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${embCfg.apiKey}`,
    },
    body: JSON.stringify({
      model: embCfg.model,
      input: text.substring(0, EMBEDDING_CONFIG.maxInputTokens),
      dimensions: EMBEDDING_CONFIG.dimensions,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SiliconFlow Embedding error [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  const embeddingData = data.data?.[0];

  return {
    embedding: embeddingData?.embedding ?? [],
    model: data.model,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}

/**
 * 批量获取 Embeddings（一次 API 调用）
 */
export async function getBatchEmbeddings(
  texts: string[],
): Promise<EmbeddingResponse[]> {
  const embCfg = getAIModuleConfig('embedding');
  const response = await fetch(`${embCfg.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${embCfg.apiKey}`,
    },
    body: JSON.stringify({
      model: embCfg.model,
      input: texts.map((t) => t.substring(0, EMBEDDING_CONFIG.maxInputTokens)),
      dimensions: EMBEDDING_CONFIG.dimensions,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SiliconFlow Batch Embedding error [${response.status}]: ${errorText}`);
  }

  const data = await response.json();

  return (data.data ?? []).map((item: { embedding: number[]; index: number }) => ({
    embedding: item.embedding ?? [],
    model: data.model,
    usage: {
      promptTokens: Math.round((data.usage?.prompt_tokens ?? 0) / texts.length),
      totalTokens: Math.round((data.usage?.total_tokens ?? 0) / texts.length),
    },
  }));
}

/** 余弦相似度计算 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ===========================================================================
// 5. Reranker（聚类精排）
// ===========================================================================

export async function rerank(
  query: string,
  documents: string[],
  topN: number = RERANKER_CONFIG.topN,
): Promise<RerankResult[]> {
  const rrCfg = getAIModuleConfig('reranker');
  const response = await fetch(`${rrCfg.baseUrl}/rerank`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${rrCfg.apiKey}`,
    },
    body: JSON.stringify({
      model: rrCfg.model,
      query,
      documents,
      top_n: topN,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SiliconFlow Rerank error [${response.status}]: ${errorText}`);
  }

  const data = await response.json();

  return (data.results ?? []).map((item: { index: number; relevance_score: number }) => ({
    index: item.index,
    relevanceScore: item.relevance_score,
  }));
}

// ===========================================================================
// 6. 便捷方法：完整分析流水线
// ===========================================================================

export interface FullAnalysisInput {
  title: string;
  content: string;
  sourceName: string;
  category: string;
}

export interface FullAnalysisOutput {
  preFilter: PreFilterResult;
  scores: FiveDimensionScores;
  totalCost: number;
}

/**
 * 完整分析一条信息：预筛 → 评分
 * 预筛不通过的不会进入评分
 */
export async function fullAnalysis(
  input: FullAnalysisInput,
): Promise<FullAnalysisOutput> {
  // Step 1: 预筛
  const preFilter = await preFilterWithAI(input.title, input.content);

  if (!preFilter.relevant) {
    return {
      preFilter,
      scores: { sourceAuthority: 0, impactScope: 0, complianceUrgency: 0, industryAttention: 0, timeliness: 0 },
      totalCost: preFilter.cost,
    };
  }

  // Step 2: 五维评分
  const scores = await scoreWithAI(input.title, input.content, input.sourceName, input.category);

  return {
    preFilter,
    scores,
    totalCost: preFilter.cost + scores.cost,
  };
}
