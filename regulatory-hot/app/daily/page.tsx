import { ImportanceBadge } from '@/components/event/ImportanceBadge';
import { SourceBadge } from '@/components/event/SourceBadge';
import { CategoryChip } from '@/components/event/CategoryChip';
import { CATEGORIES, type CategoryId } from '@/lib/config';
import { getEvents, getStats } from '@/lib/events-data';
import type { RegulatoryEvent } from '@/lib/types';
import Link from 'next/link';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const dynamic = 'force-dynamic';
export const metadata = { title: '监管日报' };

export default async function DailyPage() {
  const allEvents = await getEvents();
  const stats = await getStats();
  const today = new Date();

  // 过去 24h 窗口
  const windowStart = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const recentEvents = allEvents.filter((e) => new Date(e.publishedAt) >= windowStart);

  // 按分类分组
  const sections = CATEGORIES.map((cat) => ({
    label: cat.label,
    category: cat.id as CategoryId,
    items: recentEvents
      .filter((e) => e.category === cat.id)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 5)
      .map((e) => ({
        id: e.id,
        title: e.title,
        summary: e.summary,
        url: e.url,
        sourceName: e.sourceName,
        importance: e.importance,
        finalScore: e.finalScore,
      })),
  })).filter((s) => s.items.length > 0);

  // 快讯：importance >= 4 且未进入 sections 前 3
  const sectionIds = new Set(sections.flatMap((s) => s.items.slice(0, 3).map((i) => i.id)));
  const flashes = recentEvents
    .filter((e) => e.importance >= 4 && !sectionIds.has(e.id))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 5);

  const totalSelected = recentEvents.filter((e) => e.selected).length;

  return (
    <div className="mx-auto max-w-6xl grid gap-6 lg:grid-cols-[14rem_1fr]">
      {/* === 左侧：日报说明 === */}
      <aside className="hidden lg:block">
        <div className="sticky top-4 space-y-4">
          <div className="flex gap-1 rounded-md border border-ink-200 bg-ink-50 p-0.5 text-xs dark:border-ink-800 dark:bg-ink-900">
            <button className="flex-1 rounded bg-white px-2 py-1 font-medium text-ink-900 shadow-sm dark:bg-ink-800 dark:text-ink-50">日报</button>
            <button className="flex-1 rounded px-2 py-1 text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-50">周报</button>
            <button className="flex-1 rounded px-2 py-1 text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-50">月报</button>
          </div>

          <div className="card p-3">
            <p className="text-xs text-ink-500 dark:text-ink-400">
              监管日报自动汇总过去 24 小时内 FDA 官方发布的所有重要监管动态。
            </p>
            <p className="mt-2 text-xs text-ink-400 dark:text-ink-500">
              数据来源：FDA RSS + Federal Register + 官方网页
            </p>
          </div>
        </div>
      </aside>

      {/* === 主体：日报内容 === */}
      <div>
        <header className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">
            {format(today, 'M月d日 EEEE', { locale: zhCN })}
          </h1>
          <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
            过去 24h FDA 监管动态结构化摘要 · 自动生成
          </p>
        </header>

        {/* 关键统计 */}
        <div className="mb-6 flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm dark:border-ink-800 dark:bg-ink-900">
          <Stat label="今日事件" value={recentEvents.length} />
          <Stat label="精选" value={totalSelected} />
          <Stat label="信源" value={1} />
          <Stat label="总采集" value={stats.total} />
        </div>

        {/* 重要快讯 */}
        {flashes.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink-900 dark:text-ink-50">
              <span className="text-amber-500">⚡</span>
              <span>重要快讯</span>
            </h2>
            <div className="space-y-2">
              {flashes.map((e) => (
                <Link
                  key={e.id}
                  href={`/items/${e.id}`}
                  className="card block p-3 hover:border-amber-300 dark:hover:border-amber-700"
                >
                  <div className="flex items-start gap-2">
                    <ImportanceBadge level={e.importance} />
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 text-sm font-semibold text-ink-900 dark:text-ink-50">{e.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-ink-500 dark:text-ink-400">{e.summary}</p>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                        <SourceBadge sourceId={e.sourceId} showLevel={false} />
                        <span>·</span>
                        <CategoryChip category={e.category} />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* 分板块 */}
        {sections.map((section) => (
          <section key={section.category} className="mb-6">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink-900 dark:text-ink-50">
              <span>{CATEGORIES.find((c) => c.id === section.category)?.emoji}</span>
              <span>{section.label}</span>
              <span className="text-xs font-normal text-ink-500 dark:text-ink-400">({section.items.length})</span>
            </h2>
            <div className="space-y-2">
              {section.items.map((it) => (
                <Link
                  key={it.id}
                  href={`/items/${it.id}`}
                  className="card block p-3 hover:border-brand-300 dark:hover:border-brand-700"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="line-clamp-2 flex-1 text-sm font-semibold text-ink-900 dark:text-ink-50">
                      {it.title}
                    </h3>
                    <ImportanceBadge level={it.importance} showLabel={false} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-500 dark:text-ink-400">{it.summary}</p>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                    <span>{it.sourceName}</span>
                    <span>·</span>
                    <span className="font-mono">评分 {it.finalScore}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {recentEvents.length === 0 && (
          <div className="rounded-lg border border-dashed border-ink-300 bg-white p-8 text-center text-ink-500 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400">
            过去 24 小时暂无新内容，请稍后再来查看。
          </div>
        )}

        <p className="mt-8 text-center text-xs text-ink-500 dark:text-ink-400">
          生成时间：{format(today, 'yyyy-MM-dd HH:mm', { locale: zhCN })} · 自动编辑系统
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span className="font-mono text-lg font-semibold text-ink-900 dark:text-ink-50">{value}</span>
      <span className="ml-1.5 text-xs text-ink-500 dark:text-ink-400">{label}</span>
    </div>
  );
}
