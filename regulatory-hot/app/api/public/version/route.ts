import { NextResponse } from 'next/server';
import { SOURCES, SCORING_WEIGHTS, CATEGORY_SELECTION_THRESHOLDS } from '@/lib/config';

export async function GET() {
  return NextResponse.json({
    name: 'Regulatory Hot',
    version: '0.2.0',
    buildDate: '2026-07-03',
    sourcesCount: SOURCES.length,
    features: [
      'daily',
      'items',
      'topics',
      'rss',
      'agent-skill',
      'scoring-engine',    // 代码评分引擎
      'pre-filter',        // 两级 AI 筛选
      'event-clustering',  // 事件聚类
      'daily-generator',   // 日报生成器
    ],
    scoringEngine: {
      weights: SCORING_WEIGHTS,
      categoryThresholds: CATEGORY_SELECTION_THRESHOLDS,
      principle: '代码决策，模型只打分',
    },
  });
}
