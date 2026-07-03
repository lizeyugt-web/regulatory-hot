import { generateMockEvents } from '@/lib/mock-data';
import { SITE } from '@/lib/config';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const events = generateMockEvents(30, { selectedOnly: true });
  const baseUrl = SITE.url;

  const items = events
    .map((e) => {
      const link = `${baseUrl}${e.permalink}`;
      const pub = new Date(e.publishedAt).toUTCString();
      return `    <item>
      <title>${escapeXml(e.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pub}</pubDate>
      <description>${escapeXml(e.summary)}</description>
      <category>${escapeXml(e.sourceName)}</category>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${SITE.name} · 精选监管情报</title>
    <link>${baseUrl}</link>
    <description>${SITE.description}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
    },
  });
}
