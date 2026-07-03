import { NextResponse } from 'next/server';
import { generateMockEvents } from '@/lib/mock-data';
import type { PaginatedResponse, RegulatoryEvent } from '@/lib/types';
import type { CategoryId } from '@/lib/config';

/**
 * GET /api/public/items
 *   ?mode=selected|all      (default: selected)
 *   &category=regulation
 *   &importance=5
 *   &source=fda
 *   &since=2026-07-01
 *   &take=1-100             (default: 20)
 *   &cursor=<base64>        (cursor pagination)
 *   &q=<keyword>
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;

  const mode = (sp.get('mode') ?? 'selected') as 'selected' | 'all';
  const category = sp.get('category') as CategoryId | null;
  const importance = sp.get('importance') ? Number(sp.get('importance')) : 0;
  const source = sp.get('source');
  const take = Math.min(Math.max(Number(sp.get('take') ?? 20), 1), 100);
  const cursor = sp.get('cursor');
  const q = sp.get('q')?.toLowerCase();

  let events = generateMockEvents(80, { selectedOnly: mode === 'selected' });

  if (category) events = events.filter((e) => e.category === category);
  if (importance > 0) events = events.filter((e) => e.importance === importance);
  if (source) events = events.filter((e) => e.sourceId === source);
  if (q) {
    events = events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.titleEn?.toLowerCase().includes(q) ?? false) ||
        e.summary.toLowerCase().includes(q)
    );
  }

  // Cursor 分页（模拟：取 cursor 后 N 条）
  let startIdx = 0;
  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
      startIdx = Math.max(0, Number(decoded.i ?? 0));
    } catch {
      startIdx = 0;
    }
  }
  const slice = events.slice(startIdx, startIdx + take);
  const hasNext = startIdx + take < events.length;
  const nextCursor = hasNext
    ? Buffer.from(JSON.stringify({ i: startIdx + take })).toString('base64')
    : null;

  const resp: PaginatedResponse<RegulatoryEvent> = {
    count: events.length,
    hasNext,
    nextCursor,
    items: slice,
  };
  return NextResponse.json(resp, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' },
  });
}
