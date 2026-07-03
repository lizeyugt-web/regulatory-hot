/**
 * 预筛模块 — 第一级 AI 筛选
 *
 * AIHOT 两级筛选架构：
 *   第一级：便宜模型（V3.2）预筛，判断"是否监管相关"
 *   第二级：贵模型（V4 Pro）精评，只对相关内容做五维打分
 *
 * 当前阶段：模拟预筛（基于关键词规则）
 * 后续阶段：接入真实 DeepSeek API
 */
import { PRE_FILTER } from './config';
import type { RawItem } from './types';

/** 预筛结果 */
export interface PreFilterResult {
  status: 'relevant' | 'irrelevant';
  confidence: number;
  reason: string;
  model: string;
  cost: number;
}

/** 监管相关关键词（用于模拟预筛） */
const RELEVANT_KEYWORDS = [
  // 审批
  'approve', 'approval', '批准', '获批', '授权', 'authorize',
  'NDA', 'BLA', 'ANDA', 'IND', '510k', 'PMA', 'de novo',
  'clearance', '许可', '上市',
  // 法规
  'guidance', 'guideline', '指南', '指导原则', '法规', 'regulation',
  'rule', 'final rule', 'draft', '征求意见', '发布',
  // 安全
  'recall', '召回', 'warning letter', '警告信', 'safety',
  'adverse', '不良反应', 'black box', '黑框警告',
  // 检查
  'inspection', '检查', 'GMP', 'cGMP', 'compliance', '合规',
  'warning', 'import alert', '进口禁令', '禁令',
  // 标准
  'standard', '标准', 'ICH', 'ISO', 'USP', 'pharmacopoeia', '药典',
  'harmonis', '协调',
  // 机构
  'FDA', 'EMA', 'NMPA', 'PMDA', 'MHRA', 'WHO', 'ANVISA', 'Swissmedic',
  'CHMP', 'committee', '委员会',
];

/** 排除关键词 */
const EXCLUDE_KEYWORDS = [
  'recruit', '招聘', 'hiring', 'job', 'career',
  'webinar sponsor', '赞助', 'advertisement', '广告',
  'sale', 'discount', '促销',
];

/**
 * 预筛函数（当前为模拟实现，基于关键词匹配）
 *
 * 后续替换为真实 DeepSeek V3.2 API 调用：
 *   POST https://api.deepseek.com/v1/chat/completions
 *   model: deepseek-v3.2
 *   prompt: PRE_FILTER.prompt + title + content
 */
export function preFilterItem(item: {
  titleOriginal: string;
  contentText: string;
}): PreFilterResult {
  const text = `${item.titleOriginal} ${item.contentText}`.toLowerCase();

  // 排除关键词优先
  for (const kw of EXCLUDE_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) {
      return {
        status: 'irrelevant',
        confidence: 0.92,
        reason: `匹配排除关键词: ${kw}`,
        model: PRE_FILTER.model,
        cost: PRE_FILTER.estimatedCostPerItem,
      };
    }
  }

  // 相关关键词匹配
  let matchCount = 0;
  const matchedKeywords: string[] = [];
  for (const kw of RELEVANT_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) {
      matchCount++;
      matchedKeywords.push(kw);
    }
  }

  if (matchCount >= 1) {
    const confidence = Math.min(0.95, 0.60 + matchCount * 0.08);
    return {
      status: 'relevant',
      confidence,
      reason: `匹配监管关键词: ${matchedKeywords.slice(0, 3).join(', ')}`,
      model: PRE_FILTER.model,
      cost: PRE_FILTER.estimatedCostPerItem,
    };
  }

  return {
    status: 'irrelevant',
    confidence: 0.75,
    reason: '未匹配任何监管相关关键词',
    model: PRE_FILTER.model,
    cost: PRE_FILTER.estimatedCostPerItem,
  };
}

/**
 * 批量预筛
 */
export function batchPreFilter(items: RawItem[]): {
  results: Map<string, PreFilterResult>;
  passedCount: number;
  rejectedCount: number;
  totalCost: number;
} {
  const results = new Map<string, PreFilterResult>();
  let passedCount = 0;
  let rejectedCount = 0;
  let totalCost = 0;

  for (const item of items) {
    const result = preFilterItem({
      titleOriginal: item.titleOriginal,
      contentText: item.contentText,
    });
    results.set(item.id, result);
    totalCost += result.cost;
    if (result.status === 'relevant') {
      passedCount++;
    } else {
      rejectedCount++;
    }
  }

  return { results, passedCount, rejectedCount, totalCost };
}

/**
 * 估算预筛通过率
 */
export function estimatePassRate(passedCount: number, totalCount: number): number {
  if (totalCount === 0) return 0;
  return Math.round((passedCount / totalCount) * 10000) / 100; // 保留 2 位小数
}
