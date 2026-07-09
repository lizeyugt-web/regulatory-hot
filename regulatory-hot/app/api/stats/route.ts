/**
 * GET /api/stats — 统计概览
 */
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const [total, selected, aiCompleted, aiPending, wechatTotal] = await Promise.all([
    prisma.event.count(),
    prisma.event.count({ where: { selected: 1 } }),
    prisma.event.count({ where: { aiStatus: 'analyzed' } }),
    prisma.event.count({ where: { aiStatus: 'pending' } }),
    prisma.event.count({ where: { isSocial: 1 } }),
  ]);

  // 按日期统计
  const byDate = await prisma.$queryRawUnsafe(
    `SELECT date(publishedAt) as date, count(*) as cnt 
     FROM events 
     GROUP BY date(publishedAt) 
     ORDER BY date DESC 
     LIMIT 14`
  ) as { date: string; cnt: number }[];

  // 按分类统计
  const byCategory = await prisma.$queryRawUnsafe(
    `SELECT category, count(*) as cnt 
     FROM events 
     GROUP BY category`
  ) as { category: string; cnt: number }[];

  // 按信源统计
  const bySource = await prisma.$queryRawUnsafe(
    `SELECT sourceName, sourceLevel, count(*) as cnt 
     FROM events 
     GROUP BY sourceName 
     ORDER BY cnt DESC 
     LIMIT 15`
  ) as { sourceName: string; sourceLevel: string; cnt: number }[];

  return NextResponse.json({
    total,
    selected,
    aiCompleted,
    aiPending,
    wechatTotal,
    fdaTotal: total - wechatTotal,
    byDate,
    byCategory,
    bySource,
  });
}
