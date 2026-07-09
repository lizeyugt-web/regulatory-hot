import Link from 'next/link';
import { EventCard } from '@/components/event/EventCard';
import { FilterToolbar } from '@/components/event/FilterToolbar';
import { HotTopicsPanel } from '@/components/event/HotTopicsPanel';
import { CategoryNavPanel } from '@/components/event/CategoryNavPanel';
import { CollapsibleGroup } from '@/components/event/CollapsibleGroup';
import { CATEGORIES, SUB_CATEGORIES, type CategoryId } from '@/lib/config';
import { getEvents, getStats } from '@/lib/events-data';
import type { RegulatoryEvent } from '@/lib/types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

interface PageProps {
  searchParams?: { category?: string; tag?: string | string[]; tagMatch?: string; selected?: string; q?: string };
}

export default async function HomePage({ searchParams }: PageProps) {
  const activeCat: CategoryId | 'all' =
    (searchParams?.category as CategoryId | undefined) ?? 'all';
  const activeTags = toStringArray(searchParams?.tag);
  const tagMatch: 'any' | 'all' = searchParams?.tagMatch === 'all' ? 'all' : 'any';
  const selectedOnly = searchParams?.selected === '1';
  const q = searchParams?.q?.toLowerCase();

  const allEvents = await getEvents();
  const stats = await getStats();
  const tagStats = computeTagStats(allEvents);

  // 首页只显示精选，限制 30 条
  let events = allEvents.filter((e) => e.selected);

  if (activeCat !== 'all') {
    events = events.filter((e) => e.category === activeCat);
  }
  if (activeTags.length > 0) {
    events = events.filter((e) => matchTags(e, activeTags, tagMatch));
  }
  if (selectedOnly) {
    events = events.filter((e) => e.selected);
  }
  if (q) {
    events = events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.titleEn?.toLowerCase().includes(q) ?? false) ||
        e.summary.toLowerCase().includes(q) ||
        (e.aiSummaryCn?.toLowerCase().includes(q) ?? false) ||
        (e.aiReason?.toLowerCase().includes(q) ?? false) ||
        (e.contentCn?.toLowerCase().includes(q) ?? false)
    );
  }

  // 限制首页展示数量
  events = events.slice(0, 30);

  const groups = groupByDay(events);

  const today = format(new Date(), 'M月d日 EEEE', { locale: zhCN });
  const categoryLabel = CATEGORIES.find((c) => c.id === activeCat)?.label;
  const catCounts = computeCategoryCounts(allEvents);

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_15rem]">
      <div className="min-w-0">
        {/* 顶部标题 + 统计 */}
        <header className="mb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
                {activeCat === 'all' ? '精选' : categoryLabel}
              </h1>
              <span className="text-xs text-ink-500 dark:text-ink-400">
                {today} · FDA 监管情报自动聚合
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
              <span>采集 <span className="tnum font-semibold text-ink-700 dark:text-ink-200">{stats.total}</span></span>
              <span className="text-ink-300 dark:text-ink-700">·</span>
              <span>精选 <span className="tnum font-semibold text-ink-700 dark:text-ink-200">{stats.selected}</span></span>
              <span className="text-ink-300 dark:text-ink-700">·</span>
              <span>信源 <span className="tnum font-semibold text-ink-700 dark:text-ink-200">FDA</span></span>
            </div>
          </div>
        </header>

        {/* 筛选条 */}
        <section className="mb-5">
          <FilterToolbar basePath="/" tagStats={tagStats} />
        </section>

        {/* 时间轴主体 */}
        <div className="relative">
          <div className="absolute left-[22px] top-2 bottom-2 w-px bg-ink-200 dark:bg-ink-800" />

          <div className="space-y-6">
            {groups.map((g) => (
              <CollapsibleGroup
                key={g.dateLabel}
                dateLabel={g.dateLabel}
                count={g.items.length}
                dateCode={g.dateLabel.replace('月', '/').replace('日', '')}
              >
                {g.items.map((e) => (
                  <EventCard key={e.id} event={e} variant="default" />
                ))}
              </CollapsibleGroup>
            ))}
          </div>
        </div>

        {events.length === 0 && <EmptyState activeCat={activeCat} />}

        {events.length > 0 && (
          <p className="mt-6 text-center text-xs text-ink-500 dark:text-ink-400">
            共 <span className="tnum">{events.length}</span> 条精选 · 数据每小时自动更新
          </p>
        )}
      </div>

      <aside className="space-y-4">
        <HotTopicsPanel events={allEvents} />
        <CategoryNavPanel active={activeCat} counts={catCounts} />
      </aside>
    </div>
  );
}

function EmptyState({ activeCat }: { activeCat: CategoryId | 'all' }) {
  const label = CATEGORIES.find((c) => c.id === activeCat)?.label;
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-ink-100 text-2xl dark:bg-ink-800/60">
        🔍
      </div>
      <h3 className="text-base font-semibold text-ink-900 dark:text-ink-50">
        当前筛选下没有条目
      </h3>
      <p className="mt-1.5 max-w-xs text-sm text-ink-500 dark:text-ink-400">
        {label ? `${label}分类下暂无内容` : '没有匹配的内容'}，试试切换其它分类或查看全部动态。
      </p>
      <div className="mt-5 flex gap-2">
        <Link
          href="/all"
          className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
        >
          查看全部
        </Link>
        <Link
          href="/"
          className="rounded-md border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-ink-300 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300"
        >
          清空筛选
        </Link>
      </div>
    </div>
  );
}

function groupByDay(events: RegulatoryEvent[]) {
  const map = new Map<string, RegulatoryEvent[]>();
  for (const e of events) {
    const key = format(new Date(e.publishedAt), 'M月d日', { locale: zhCN });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries()).map(([dateLabel, items]) => ({ dateLabel, items }));
}

function toStringArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function matchTags(e: RegulatoryEvent, tags: string[], mode: 'any' | 'all'): boolean {
  const eventTags: string[] = e.subCategory ?? [];
  if (mode === 'all') return tags.every((t) => eventTags.includes(t));
  return tags.some((t) => eventTags.includes(t));
}

function computeTagStats(events: RegulatoryEvent[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of SUB_CATEGORIES) map[t] = 0;
  for (const e of events) {
    for (const t of e.subCategory ?? []) {
      if (t in map) map[t] += 1;
    }
  }
  return map;
}

function computeCategoryCounts(events: RegulatoryEvent[]): Record<string, number> {
  const map: Record<string, number> = { regulation: 0, approval: 0, safety: 0, insight: 0 };
  for (const e of events) {
    if (e.category in map) map[e.category] += 1;
  }
  return map;
}
