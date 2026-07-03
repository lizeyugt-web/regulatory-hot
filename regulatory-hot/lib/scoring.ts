/**
 * 评分引擎 — 核心模块
 *
 * 设计原则（AIHOT V11 重构经验）：
 *   "能用代码就别用 Agent" — 模型只做五维打分，最终决策完全由代码公式控制
 *
 * 本模块负责：
 *   1. 接收模型的五维原始分
 *   2. 代码加权计算 finalScore
 *   3. 代码映射 importance
 *   4. 代码判断是否精选（分类差异化阈值）
 *
 * 不依赖任何 AI 模型调用，纯函数，确定性输出。
 */
import {
  computeFinalScore,
  mapScoreToImportance,
  isSelected,
  type SourceLevel,
  type CategoryId,
  type Importance,
} from './config';

/** 五维评分输入 */
export interface FiveDimensionScores {
  sourceAuthority: number;
  impactScope: number;
  complianceUrgency: number;
  industryAttention: number;
  timeliness: number;
}

/** 评分引擎完整输出 */
export interface ScoringResult {
  scores: FiveDimensionScores;
  finalScore: number;
  importance: Importance;
  selected: boolean;
}

/**
 * 完整评分流程：五维分 → finalScore → importance → selected
 * 这是整个系统唯一的评分入口，所有调用方都应走此函数。
 */
export function runScoringEngine(
  scores: FiveDimensionScores,
  sourceLevel: SourceLevel,
  category: CategoryId,
): ScoringResult {
  const finalScore = computeFinalScore(scores, sourceLevel);
  const importance = mapScoreToImportance(finalScore);
  const selected = isSelected(finalScore, category, sourceLevel);

  return {
    scores,
    finalScore,
    importance,
    selected,
  };
}

/**
 * 批量评分 + 排序
 * 按 finalScore 降序返回
 */
export function batchScoreAndSort<T extends {
  scores: FiveDimensionScores;
  sourceLevel: SourceLevel;
  category: CategoryId;
  finalScore: number;
  importance: Importance;
  selected: boolean;
}>(items: T[]): T[] {
  return [...items].sort((a, b) => b.finalScore - a.finalScore);
}

/**
 * 成本估算工具
 */
export function estimateProcessingCost(
  totalCrawled: number,
  preFilterPassRate: number = 0.30,
  preFilterCostPerItem: number = 0.0005,
  scoringCostPerItem: number = 0.01,
): {
  preFilterCost: number;
  scoringCost: number;
  totalCost: number;
  itemsScored: number;
} {
  const itemsScored = Math.round(totalCrawled * preFilterPassRate);
  const preFilterCost = totalCrawled * preFilterCostPerItem;
  const scoringCost = itemsScored * scoringCostPerItem;
  return {
    preFilterCost: Math.round(preFilterCost * 10000) / 10000,
    scoringCost: Math.round(scoringCost * 10000) / 10000,
    totalCost: Math.round((preFilterCost + scoringCost) * 10000) / 10000,
    itemsScored,
  };
}
