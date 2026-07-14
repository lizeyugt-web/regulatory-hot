import Link from 'next/link';
import { getEvents } from '@/lib/events-data';
import type { RegulatoryEvent } from '@/lib/types';
import { formatDistanceToNowStrict } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const dynamic = 'force-dynamic';
export const metadata = { title: '主题' };

interface Topic {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: 'category' | 'tag';
  itemCount: number;
  lastEventAt?: string;
}

const CAT_LABELS: Record<string, { name: string; desc: string }> = {
  regulation: { name: '法规与标准', desc: '法规、指南、指导原则、技术标准更新' },
  approval: { name: '审批与决策', desc: '药品/器械/生物制品审批决定' },
  safety: { name: '安全与合规', desc: '安全警戒、召回、警告信、GMP 检查' },
  insight: { name: '行业洞察', desc: '会议活动、政策声明、跨境合作' },
};

export default async function TopicsPage() {
  const events = await getEvents();

  // 按分类生成主题
  const catMap = new Map<string, RegulatoryEvent[]>();
  for (const e of events) {
    if (!catMap.has(e.category)) catMap.set(e.category, []);
    catMap.get(e.category)!.push(e);
  }

  const topics: Topic[] = [];
  for (const [cat, items] of catMap) {
    const meta = CAT_LABELS[cat] ?? { name: cat, desc: '' };
    topics.push({
      id: cat,
      slug: cat,
      name: meta.name,
      description: meta.desc,
      type: 'category',
      itemCount: items.length,
      lastEventAt: items[0]?.publishedAt,
    });
  }

  // 按标签生成主题（只取 top 12）
  const tagMap = new Map<string, RegulatoryEvent[]>();
  for (const e of events) {
    for (const t of e.subCategory ?? []) {
      if (!tagMap.has(t)) tagMap.set(t, []);
      tagMap.get(t)!.push(e);
    }
  }
  for (const [tag, items] of tagMap) {
    topics.push({
      id: `tag-${tag}`,
      slug: `tag-${encodeURIComponent(tag)}`,
      name: tag,
      description: `标签: ${tag}`,
      type: 'tag',
      itemCount: items.length,
      lastEventAt: items[0]?.publishedAt,
    });
  }

  const categories = topics.filter((t) => t.type === 'category');
  const tags = topics.filter((t) => t.type === 'tag').sort((a, b) => b.itemCount - a.itemCount).slice(0, 12);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">主题</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          按分类 / 标签组织，共 {topics.length} 个主题
        </p>
      </header>

      <TopicSection title="分类" emoji="📂" topics={categories} />
      <TopicSection title="热门标签" emoji="🏷️" topics={tags} />
    </div>
  );
}

function TopicSection({
  title, emoji, topics,
}: { title: string; emoji: string; topics: Topic[] }) {
  if (topics.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold tracking-tight text-ink-900 dark:text-ink-50">
        <span aria-hidden>{emoji}</span>
        <span>{title}</span>
        <span className="text-xs font-normal text-ink-500 dark:text-ink-400">({topics.length})</span>
      </h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {topics.map((t) => (
          <Link
            key={t.id}
            href={`/topics/${t.slug}`}
            className="group block rounded-lg border border-ink-200 bg-white p-3 transition hover:border-brand-300 hover:shadow-sm dark:border-ink-800 dark:bg-ink-900 dark:hover:border-brand-700"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-ink-900 group-hover:text-brand-700 dark:text-ink-50 dark:group-hover:text-brand-300">
                {t.name}
              </h3>
              <span className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[10px] text-ink-500 dark:bg-ink-800 dark:text-ink-400">
                {t.itemCount}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-ink-500 dark:text-ink-400">
              {t.description}
            </p>
            {t.lastEventAt && (
              <p className="mt-2 text-[11px] text-ink-400 dark:text-ink-500">
                {formatDistanceToNowStrict(new Date(t.lastEventAt), { addSuffix: true, locale: zhCN })}
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
