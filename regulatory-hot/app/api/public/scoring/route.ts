import { NextResponse } from 'next/server';
import {
  SCORING_WEIGHTS,
  SOURCE_LEVEL_BASE_SCORE,
  CATEGORY_SELECTION_THRESHOLDS,
  SOURCE_LEVEL_BONUS,
  computeFinalScore,
  mapScoreToImportance,
  isSelected,
  type SourceLevel,
  type CategoryId,
} from '@/lib/config';
import { runScoringEngine, estimateProcessingCost } from '@/lib/scoring';

/**
 * GET /api/public/scoring
 *
 * 评分引擎调试接口 — 查看当前评分配置和计算逻辑
 * 支持传入测试参数：
 *   ?sa=90&is=80&cu=70&ia=75&ti=85&level=T1&category=approval
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;

  // 如果传入了评分参数，计算示例
  const hasParams = sp.has('sa') || sp.has('is');
  if (hasParams) {
    const scores = {
      sourceAuthority: Number(sp.get('sa') ?? 80),
      impactScope: Number(sp.get('is') ?? 70),
      complianceUrgency: Number(sp.get('cu') ?? 60),
      industryAttention: Number(sp.get('ia') ?? 65),
      timeliness: Number(sp.get('ti') ?? 75),
    };
    const level = (sp.get('level') ?? 'T1') as SourceLevel;
    const category = (sp.get('category') ?? 'approval') as CategoryId;

    const result = runScoringEngine(scores, level, category);

    return NextResponse.json({
      input: { scores, sourceLevel: level, category },
      output: result,
      formula: {
        weightedSum:
          scores.sourceAuthority * SCORING_WEIGHTS.sourceAuthority +
          scores.impactScope * SCORING_WEIGHTS.impactScope +
          scores.complianceUrgency * SCORING_WEIGHTS.complianceUrgency +
          scores.industryAttention * SCORING_WEIGHTS.industryAttention +
          scores.timeliness * SCORING_WEIGHTS.timeliness,
        sourceBonus: (SOURCE_LEVEL_BASE_SCORE[level] - 50) * 0.1,
        selectionThreshold: CATEGORY_SELECTION_THRESHOLDS[category],
        sourceBonusForSelection: SOURCE_LEVEL_BONUS[level],
      },
    });
  }

  // 默认返回配置信息
  return NextResponse.json({
    weights: SCORING_WEIGHTS,
    sourceLevelBaseScores: SOURCE_LEVEL_BASE_SCORE,
    sourceLevelBonus: SOURCE_LEVEL_BONUS,
    categoryThresholds: CATEGORY_SELECTION_THRESHOLDS,
    costEstimate: estimateProcessingCost(800, 0.30),
    example: runScoringEngine(
      { sourceAuthority: 95, impactScope: 85, complianceUrgency: 70, industryAttention: 80, timeliness: 88 },
      'T1',
      'approval',
    ),
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=300' },
  });
}
