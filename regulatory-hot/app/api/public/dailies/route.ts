import { NextResponse } from 'next/server';
import { generateMockDaily } from '@/lib/mock-data';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const take = Math.min(Math.max(Number(url.searchParams.get('take') ?? 30), 1), 90);
  // 模拟回溯 N 天的日报
  const items = Array.from({ length: take }, (_, i) => {
    const d = new Date('2026-07-03T08:00:00+08:00');
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const r = generateMockDaily(dateStr);
    return {
      id: r.id,
      date: r.date,
      generatedAt: r.generatedAt,
      leadTitle: r.sections[0]?.items[0]?.title,
      eventCount: r.sections.reduce((sum, s) => sum + s.items.length, 0) + r.flashes.length,
      permalink: `/daily`,
    };
  });
  return NextResponse.json(
    { count: items.length, items },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  );
}
