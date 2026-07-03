import { EventCard } from '@/components/event/EventCard';
import { FilterToolbar } from '@/components/event/FilterToolbar';
import { HotTopicsPanel } from '@/components/event/HotTopicsPanel';
import { AiProgressBar } from '@/components/event/AiProgressBar';
import { CATEGORIES, SUB_CATEGORIES, type CategoryId } from '@/lib/config';
import { getEvents, getStats, getAiProgress } from '@/lib/events-data';
import type { RegulatoryEvent } from '@/lib/types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;
export const metadata = { title: '全部动态' };

interface PageProps {
  searchParams?: { category?: string; tag?: string | string[]; tagMatch?: string; selected?: string; q?: string };
}

export default function AllPage({ searchParams }: PageProps) {
  const activeCat: CategoryId | 'all' =
    (searchParams?.category as CategoryId | undefined) ?? 'all';
  const activeTags = toStringArray(searchParams?.tag);
  const tagMatch: 'any' | 'all' = searchParams?.tagMatch === 'all' ? 'all' : 'any';
  const selectedOnly = searchParams?.selected === '1';
  const q = searchParams?.q?.toLowerCase();

  const allEvents = getEvents();
  const stats = getStats();
  const aiProgress = getAiProgress();
  const tagStats = computeTagStats(allEvents);

  let events = allEvents;

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

  // 限制展示数量
  events = events.slice(0, 50);

  const groups = new Map<string, typeof events>();
  for (const e of events) {
    const key = format(new Date(e.publishedAt), 'M月d日 EEEE', { locale: zhCN });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const groupArr = Array.from(groups.entries());

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_15rem]">
      <div className="min-w-0">
        {/* 顶部标题 */}
        <header className="mb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50">全部动态</h1>
              <span className="text-xs text-ink-500 dark:text-ink-400">
                共 <span className="tnum font-semibold text-ink-700 dark:text-ink-200">{events.length}</span> 条 · 不限于精选
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-ink-500 dark:text-ink-400">
              <span>采集 <span className="tnum font-semibold text-ink-700 dark:text-ink-200">{stats.total}</span></span>
              <span className="text-ink-300 dark:text-ink-700">·</span>
              <span>AI分析 <span className="tnum font-semibold text-ink-700 dark:text-ink-200">{aiProgress.completed}</span></span>
              <span className="text-ink-300 dark:text-ink-700">·</span>
              <span>RSS <span className="tnum">{stats.sources.rss}</span></span>
              <span className="text-ink-300 dark:text-ink-700">·</span>
              <span>FR <span className="tnum">{stats.sources.fr}</span></span>
              <span className="text-ink-300 dark:text-ink-700">·</span>
              <span>Web <span className="tnum">{stats.sources.web}</span></span>
            </div>
          </div>
        </header>

        {/* AI 处理进度条 — 始终显示 */}
        <section className="mb-4">
          <AiProgressBar progress={aiProgress} />
        </section>

        {/* 筛选条 */}
        <section className="mb-5">
          <FilterToolbar basePath="/all" showSearch tagStats={tagStats} />
        </section>

        {/* 时间轴主体 */}
        <div className="relative">
          <div className="absolute left-[22px] top-2 bottom-2 w-px bg-ink-200 dark:bg-ink-800" />

          <div className="space-y-6">
            {groupArr.map(([dateLabel, items]) => (
              <section key={dateLabel}>
                <div className="mb-2 flex items-center gap-3">
                  <div className="relative z-10 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 border-white bg-brand-500 text-[10px] font-bold text-white shadow-soft dark:border-ink-950 dark:bg-brand-600">
                    {dateLabel.split(' ')[0].replace('月', '/').replace('日', '')}
                  </div>
                  <h2 className="text-sm font-semibold tracking-tight text-ink-900 dark:text-ink-50">
                    {dateLabel}
                  </h2>
                  <span className="tnum text-xs text-ink-500 dark:text-ink-400">{items.length} 条</span>
                  <span className="h-px flex-1 bg-ink-200/60 dark:bg-ink-800/60" />
                </div>
                <div className="divide-y divide-ink-100 dark:divide-ink-800/60">
                  {items.map((e) => (
                    <EventCard key={e.id} event={e} variant="default" />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {events.length === 0 && (
          <div className="rounded-lg border border-dashed border-ink-300 bg-white p-8 text-center text-ink-500 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400">
            当前筛选条件下没有条目
          </div>
        )}
      </div>

      <aside className="space-y-4">
        <HotTopicsPanel events={allEvents} />
      </aside>
    </div>
  );
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
