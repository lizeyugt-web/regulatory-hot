import { NextResponse } from 'next/server';
import { generateMockDaily } from '@/lib/mock-data';
import type { DailyReport } from '@/lib/types';

/**
 * GET /api/public/daily
 * GET /api/public/daily/2026-07-03
 *
 * 公开匿名，无需鉴权
 * Rate Limit: 600 req/min/IP（待后续接入 Vercel/Edge 配置）
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dateParam = url.pathname.split('/').pop();

  // 简单日期校验
  let date = '2026-07-03';
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    date = dateParam;
  }

  const report: DailyReport = generateMockDaily(date);
  return NextResponse.json(report, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
