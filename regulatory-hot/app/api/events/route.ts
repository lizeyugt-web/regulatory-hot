/**
 * GET /api/events — 事件列表
 * 
 * Query params:
 *   category - 分类筛选
 *   source - 信源ID
 *   selected - 1=仅精选
 *   lang - 语言
 *   limit - 每页数 (默认30)
 *   offset - 偏移
 *   from / to - 时间范围
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const source = searchParams.get('source');
  const selected = searchParams.get('selected');
  const lang = searchParams.get('lang');
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const q = searchParams.get('q');

  const where: any = {};

  if (category && category !== 'all') where.category = category;
  if (source) where.sourceId = source;
  if (selected === '1') where.selected = 1;
  if (lang) where.titleLang = lang;
  if (from || to) {
    where.publishedAt = {};
    if (from) where.publishedAt.gte = from;
    if (to) where.publishedAt.lte = to;
  }

  // FTS5 search
  if (q) {
    // Use SQLite FTS5 via raw query
    const results = await prisma.$queryRawUnsafe(
      `SELECT e.* FROM events e 
       INNER JOIN events_fts f ON e.rowid = f.rowid
       WHERE events_fts MATCH ?
       ORDER BY e.publishedAt DESC
       LIMIT ? OFFSET ?`,
      q, limit, offset
    ) as any[];
    return NextResponse.json({ items: results, count: results.length });
  }

  const [items, count] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.event.count({ where }),
  ]);

  return NextResponse.json({ items, count, limit, offset });
}
