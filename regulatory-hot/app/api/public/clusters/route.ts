import { NextResponse } from 'next/server';
import { generateMockEvents } from '@/lib/mock-data';
import { clusterEvents } from '@/lib/clustering';

/**
 * GET /api/public/clusters
 *
 * 事件聚类演示接口 — 展示同事件多源折叠效果
 */
export async function GET() {
  const allEvents = generateMockEvents(80, { selectedOnly: false });
  const { primaryEvents, clusterMap, clusterDetails } = clusterEvents(allEvents);

  const clusterSummaries = Array.from(clusterDetails.entries())
    .filter(([, items]) => items.length > 1)
    .map(([clusterId, items]) => ({
      clusterId,
      size: items.length,
      sourceCount: new Set(items.map((e) => e.sourceId)).size,
      primary: {
        id: items.find((e) => e.isClusterPrimary)?.id,
        title: items.find((e) => e.isClusterPrimary)?.title,
        sourceName: items.find((e) => e.isClusterPrimary)?.sourceName,
      },
      members: items.map((e) => ({
        id: e.id,
        title: e.title,
        sourceName: e.sourceName,
        sourceLevel: e.sourceLevel,
        finalScore: e.finalScore,
        isPrimary: e.isClusterPrimary,
      })),
    }))
    .sort((a, b) => b.size - a.size);

  return NextResponse.json({
    stats: {
      totalEvents: allEvents.length,
      totalClusters: clusterDetails.size,
      multiSourceClusters: clusterSummaries.length,
      primaryEvents: primaryEvents.length,
      compressionRatio: `${Math.round((1 - primaryEvents.length / allEvents.length) * 100)}%`,
    },
    clusters: clusterSummaries,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=300' },
  });
}
