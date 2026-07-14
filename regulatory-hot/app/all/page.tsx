import { EventCard } from '@/components/event/EventCard';
import { SmartSearchBar } from '@/components/event/SmartSearchBar';
import { CollapsibleGroup } from '@/components/event/CollapsibleGroup';
import { HotTopicsPanel } from '@/components/event/HotTopicsPanel';
import { AiProgressBar } from '@/components/event/AiProgressBar';
import { CATEGORIES, type CategoryId } from '@/lib/config';
import { getEvents, getStats } from '@/lib/events-data';
import { buildTimeline } from '@/lib/timeline';
import type { AiProgress } from '@/lib/events-data';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;
export const metadata = { title: '全部动态' };

interface PageProps {
  searchParams?: { category?: string; q?: string; mode?: string; range?: string; selected?: string };
}

export default async function AllPage({ searchParams }: PageProps) {
  const activeCat: CategoryId | 'all' =
    (searchParams?.category as CategoryId | undefined) ?? 'all';
  const selectedOnly = searchParams?.selected === '1';
  const q = searchParams?.q?.toLowerCase();

  const allEvents = await getEvents();
  const stats = await getStats();
  const aiProgress: AiProgress = {
    total: allEvents.length,
    completed: allEvents.filter(e => e.aiAnalyzedAt).length,
    pending: allEvents.length - allEvents.filter(e => e.aiAnalyzedAt).length,
  };

  let events = allEvents;

  if (activeCat !== 'all') {
    events = events.filter((e) => e.category === activeCat);
  }
  if (selectedOnly) {
    events = events.filter((e) => e.selected);
  }
  if (q) {
    const mode = searchParams?.mode ?? 'full';
    events = events.filter((e) => {
        if (mode === 'title') return e.title.toLowerCase().includes(q) || (e.titleEn?.toLowerCase().includes(q) ?? false);
        if (mode === 'summary') return e.summary.toLowerCase().includes(q) || (e.aiSummaryCn?.toLowerCase().includes(q) ?? false);
        if (mode === 'source') return (e.sourceName || '').toLowerCase().includes(q);
        if (mode === 'tag') return (e.tags || []).some(t => t.toLowerCase().includes(q));
        return e.title.toLowerCase().includes(q) ||
          (e.titleEn?.toLowerCase().includes(q) ?? false) ||
          e.summary.toLowerCase().includes(q) ||
          (e.aiSummaryCn?.toLowerCase().includes(q) ?? false) ||
          (e.aiReason?.toLowerCase().includes(q) ?? false) ||
          (e.contentCn?.toLowerCase().includes(q) ?? false);
    });
  }
  if (searchParams?.range) {
    const rangeDays: Record<string, number> = { '1d': 1, '3d': 3, '7d': 7, '30d': 30 };
    const days = rangeDays[searchParams.range] || 0;
    if (days > 0) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      events = events.filter((e) => new Date(e.publishedAt) >= cutoff);
    }
  }

  // 页面不硬截断，交给 CollapsibleGroup 的 maxInitial 控制
  const { recent, older, olderLabel, olderTotal } = buildTimeline(events);

  const groupArr = recent.map(g => [g.dateLabel, g] as const);

  return (
    <div className="mx-auto max-w-6xl grid gap-4 xl:grid-cols-[1fr_15rem]">
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
              <span>微信 <span className="tnum">{stats.wechatTotal || 0}</span></span>
              <span className="text-ink-300 dark:text-ink-700">·</span>
              <span>FDA <span className="tnum">{(stats.total || 0) - (stats.wechatTotal || 0)}</span></span>
            </div>
          </div>
        </header>

        {/* 智能搜索栏 */}
        <section className="mb-5">
          <SmartSearchBar basePath="/all" />
        </section>

        {/* 时间轴主体 */}
        <div className="relative">
          <div className="absolute left-[22px] top-2 bottom-2 w-px bg-ink-200 dark:bg-ink-800" />

          <div className="space-y-6">
            {/* 7天内 */}
            {groupArr.map(([, g]) => (
              <CollapsibleGroup
                key={g.dateLabel}
                dateLabel={g.dateLabel}
                count={g.items.length}
                dateCode={g.dateCode}
                isToday={g.isToday}
                maxInitial={g.isToday ? undefined : 200}
              >
                {g.items.map((e) => (
                  <EventCard key={e.id} event={e} variant="default" />
                ))}
              </CollapsibleGroup>
            ))}

            {/* 更早的记录 — 默认折叠 */}
            {older.length > 0 && (
              <CollapsibleGroup
                dateLabel={olderLabel}
                count={olderTotal}
                dateCode="•••"
                startCollapsed
              >
                {older.map((e) => (
                  <EventCard key={e.id} event={e} variant="default" />
                ))}
              </CollapsibleGroup>
            )}
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
