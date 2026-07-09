/**
 * GET /api/search — 全文检索
 */
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

  if (!q) {
    return NextResponse.json({ items: [], count: 0 });
  }

  try {
    const results = await prisma.$queryRawUnsafe(
      `SELECT e.* FROM events e 
       INNER JOIN events_fts f ON e.rowid = f.rowid
       WHERE events_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
      q, limit
    );
    return NextResponse.json({ items: results, count: (results as any[]).length, query: q });
  } catch {
    // FTS5 表不存在时降级为 LIKE 搜索
    const results = await prisma.event.findMany({
      where: {
        OR: [
          { titleCn: { contains: q } },
          { summaryCn: { contains: q } },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
    return NextResponse.json({ items: results, count: results.length, query: q, fallback: true });
  }
}
