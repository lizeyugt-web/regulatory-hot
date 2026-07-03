import { NextResponse } from 'next/server';
import { generateMockRawItems } from '@/lib/mock-data';
import { batchPreFilter, estimatePassRate } from '@/lib/prefilter';
import { estimateProcessingCost } from '@/lib/scoring';
import { PRE_FILTER, SCORING_AI } from '@/lib/config';

/**
 * GET /api/public/prefilter
 *   ?count=50           (default: 50, max: 200)
 *
 * 预筛演示接口 — 展示两级 AI 筛选的第一级效果
 * 返回每条原始数据的预筛结果、通过率、成本估算
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const count = Math.min(Math.max(Number(url.searchParams.get('count') ?? 50), 1), 200);

  const rawItems = generateMockRawItems(count);
  const { results, passedCount, rejectedCount, totalCost } = batchPreFilter(rawItems);
  const passRate = estimatePassRate(passedCount, count);

  // 成本对比：两级筛选 vs 全部精评
  const twoLevelCost = estimateProcessingCost(
    count,
    passRate / 100,
    PRE_FILTER.estimatedCostPerItem,
    SCORING_AI.estimatedCostPerItem,
  );

  const allScoringCost = {
    preFilterCost: 0,
    scoringCost: Math.round(count * SCORING_AI.estimatedCostPerItem * 10000) / 10000,
    totalCost: Math.round(count * SCORING_AI.estimatedCostPerItem * 10000) / 10000,
    itemsScored: count,
  };

  const savings = Math.round((1 - twoLevelCost.totalCost / allScoringCost.totalCost) * 100);

  const items = rawItems.map((item) => ({
    id: item.id,
    title: item.titleOriginal,
    sourceId: item.sourceId,
    ...results.get(item.id)!,
  }));

  return NextResponse.json({
    stats: {
      total: count,
      passed: passedCount,
      rejected: rejectedCount,
      passRate,
      preFilterCost: totalCost,
      model: PRE_FILTER.model,
    },
    costComparison: {
      twoLevel: twoLevelCost,
      allScoring: allScoringCost,
      savings: `${savings}%`,
    },
    items,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}
