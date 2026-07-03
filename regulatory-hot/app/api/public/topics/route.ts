import { NextResponse } from 'next/server';
import { generateMockTopics } from '@/lib/mock-data';

export async function GET() {
  const topics = generateMockTopics();
  return NextResponse.json(
    { count: topics.length, items: topics },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  );
}
