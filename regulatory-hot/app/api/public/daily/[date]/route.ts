import { NextResponse } from 'next/server';
import { generateMockDaily } from '@/lib/mock-data';

/**
 * GET /api/public/daily/[date]
 */
export async function GET(_req: Request, { params }: { params: { date: string } }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
    return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
  }
  const report = generateMockDaily(params.date);
  return NextResponse.json(report, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
