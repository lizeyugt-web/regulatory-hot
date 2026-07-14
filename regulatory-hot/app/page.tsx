import Link from 'next/link';
import { EventCard } from '@/components/event/EventCard';
import { SmartSearchBar } from '@/components/event/SmartSearchBar';
import { HotTopicsPanel } from '@/components/event/HotTopicsPanel';
import { CategoryNavPanel } from '@/components/event/CategoryNavPanel';
import { CollapsibleGroup } from '@/components/event/CollapsibleGroup';
import { CATEGORIES, type CategoryId } from '@/lib/config';
import { getEvents, getStats } from '@/lib/events-data';
import { buildTimeline } from '@/lib/timeline';
import type { RegulatoryEvent } from '@/lib/types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

interface PageProps {
  searchParams?: { category?: string; q?: string; mode?: string; range?: string; selected?: string };
}

export default async function HomePage({ searchParams }: PageProps) {
  const activeCat: CategoryId | 'all' =
    (searchParams?.category as CategoryId | undefined) ?? 'all';
  const q = searchParams?.q?.toLowerCase();
  const selectedOnly = searchParams?.selected === '1';

  const allEvents = await getEvents();
  const stats = await getStats();

  // 首页只显示精选，限制 30 条
  let events = allEvents.filter((e) => e.selected);

  if (activeCat !== 'all') {
    events = events.filter((e) => e.category === activeCat);
  }
  if (selectedOnly) {
    events = events.filter((e) => e.selected);
  }
  if (q) {
    const mode = searchParams?.mode ?? 'full';
    events = events.filter(
      (e) => {
        if (mode === 'title') return e.title.toLowerCase().includes(q) || (e.titleEn?.toLowerCase().includes(q) ?? false);
        if (mode === 'summary') return e.summary.toLowerCase().includes(q) || (e.aiSummaryCn?.toLowerCase().includes(q) ?? false);
        if (mode === 'source') return (e.sourceName || '').toLowerCase().includes(q);
        if (mode === 'tag') return (e.tags || []).some(t => t.toLowerCase().includes(q));
        // full search
        return e.title.toLowerCase().includes(q) ||
          (e.titleEn?.toLowerCase().includes(q) ?? false) ||
          e.summary.toLowerCase().includes(q) ||
          (e.aiSummaryCn?.toLowerCase().includes(q) ?? false) ||
          (e.aiReason?.toLowerCase().includes(q) ?? false) ||
          (e.contentCn?.toLowerCase().includes(q) ?? false);
      }
    );
  }
  // 时间范围过滤
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

  const todayStr = format(new Date(), 'M月d日', { locale: zhCN });
  const categoryLabel = CATEGORIES.find((c) => c.id === activeCat)?.label;
  const catCounts = computeCategoryCounts(allEvents);

  return (
    <div className="mx-auto max-w-6xl grid gap-4 xl:grid-cols-[1fr_15rem]">
      <div className="min-w-0">
        {/* 顶部标题 + 统计 */}
        <header className="mb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
                {activeCat === 'all' ? '精选' : categoryLabel}
              </h1>
              <span className="text-xs text-ink-500 dark:text-ink-400">
                {todayStr} · 监管情报自动聚合
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

        {/* 智能搜索栏 */}
        <section className="mb-5">
          <SmartSearchBar basePath="/" />
        </section>

        {/* 时间轴主体 */}
        <div className="relative">
          <div className="absolute left-[22px] top-2 bottom-2 w-px bg-ink-200 dark:bg-ink-800" />

          <div className="space-y-6">
            {/* 7天内 */}
            {recent.map((g) => (
              <CollapsibleGroup
                key={g.dateLabel}
                dateLabel={g.dateLabel}
                count={g.items.length}
                dateCode={g.dateCode}
                isToday={g.isToday}
                maxInitial={g.isToday ? undefined : 10}
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

        {events.length === 0 && <EmptyState activeCat={activeCat} />}

        {events.length > 0 && (
          <p className="mt-6 text-center text-xs text-ink-500 dark:text-ink-400">
            共 <span className="tnum">{events.length}</span> 条精选
            {older.length > 0 && <span>（含 <span className="tnum">{olderTotal}</span> 条更早记录）</span>}
            {' · '}数据每小时自动更新
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

function computeCategoryCounts(events: RegulatoryEvent[]): Record<string, number> {
  const map: Record<string, number> = { regulation: 0, approval: 0, safety: 0, insight: 0 };
  for (const e of events) {
    if (e.category in map) map[e.category] += 1;
  }
  return map;
}
