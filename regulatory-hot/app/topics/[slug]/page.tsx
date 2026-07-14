import { EventCard } from '@/components/event/EventCard';
import { getEvents } from '@/lib/events-data';
import type { RegulatoryEvent } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string };
}

const CAT_LABELS: Record<string, string> = {
  regulation: '法规与标准',
  approval: '审批与决策',
  safety: '安全与合规',
  insight: '行业洞察',
};

export default async function TopicDetailPage({ params }: PageProps) {
  const allEvents = await getEvents();
  const slug = decodeURIComponent(params.slug);

  let topicName = slug;
  let topicDesc = '';
  let events: RegulatoryEvent[] = [];

  if (slug.startsWith('tag-')) {
    const tag = slug.replace('tag-', '');
    topicName = tag;
    topicDesc = `标签: ${tag}`;
    events = allEvents.filter((e) => (e.subCategory as string[])?.includes(tag));
  } else {
    topicName = CAT_LABELS[slug] ?? slug;
    topicDesc = `分类: ${topicName}`;
    events = allEvents.filter((e) => e.category === slug);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <p className="text-xs text-ink-500 dark:text-ink-400">主题</p>
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">{topicName}</h1>
          <span className="text-sm text-ink-500 dark:text-ink-400">
            {events.length} 条动态
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-700 dark:text-ink-300">{topicDesc}</p>
      </header>

      {events.length > 0 ? (
        <div className="divide-y divide-ink-100 rounded-lg border border-ink-200 bg-white p-4 dark:divide-ink-800 dark:border-ink-800 dark:bg-ink-900">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-ink-300 bg-white p-8 text-center text-ink-500 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400">
          该主题下暂无内容
        </div>
      )}
    </div>
  );
}
