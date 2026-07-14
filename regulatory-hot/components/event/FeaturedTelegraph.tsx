'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { RegulatoryEvent } from '@/lib/types';
import {
  FEATURED_COLUMNS,
  groupFeaturedByColumn,
  type FeaturedColumnId,
} from '@/lib/featured-mapping';

interface FeaturedTelegraphProps {
  events: RegulatoryEvent[];
}

const COLUMN_ICONS: Record<FeaturedColumnId, string> = {
  agency: '01',
  enterprise: '02',
  org: '03',
  other: '04',
};

export function FeaturedTelegraph({ events }: FeaturedTelegraphProps) {
  const groups = groupFeaturedByColumn(events);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {FEATURED_COLUMNS.map((column) => (
        <FeaturedColumnCard
          key={column.id}
          column={column}
          items={groups[column.id]}
        />
      ))}
    </div>
  );
}

interface FeaturedColumnCardProps {
  column: {
    id: FeaturedColumnId;
    title: string;
    description: string;
  };
  items: RegulatoryEvent[];
}

function FeaturedColumnCard({ column, items }: FeaturedColumnCardProps) {
  return (
    <article className="flex min-h-[420px] flex-col rounded-lg border border-ink-200 bg-ink-25 shadow-card dark:border-ink-800 dark:bg-ink-900 dark:shadow-card-dark">
      <header className="border-b border-ink-200 px-4 py-3 dark:border-ink-800">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-mono text-ink-400 dark:text-ink-500">
              {COLUMN_ICONS[column.id]}
            </span>
            <h2 className="text-sm font-bold tracking-tight text-ink-900 dark:text-ink-50">
              {column.title}
            </h2>
          </div>
          <span className="rounded bg-ink-100 px-1.5 py-0.5 text-xs font-semibold text-ink-500 dark:bg-ink-800 dark:text-ink-400">
            {String(items.length).padStart(2, '0')}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">
          {column.description}
        </p>
      </header>

      <div className="flex-1 px-3 py-2">
        <div className="relative pl-3">
          {/* 垂直时间线 */}
          <div className="absolute left-0 top-1.5 bottom-1.5 w-px bg-ink-200 dark:bg-ink-800" />

          <div className="space-y-0">
            {items.map((item) => (
              <FeaturedItem key={item.id} event={item} />
            ))}
          </div>

          {items.length === 0 && (
            <p className="py-8 text-center text-xs text-ink-400 dark:text-ink-500">
              暂无内容
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

interface FeaturedItemProps {
  event: RegulatoryEvent;
}

function FeaturedItem({ event }: FeaturedItemProps) {
  const published = new Date(event.publishedAt);
  const dateStr = format(published, 'MM-dd', { locale: zhCN });
  const timeStr = format(published, 'HH:mm', { locale: zhCN });

  const dotClass = getImportanceDotClass(event.importance);

  return (
    <Link
      href={event.permalink}
      className="group relative block border-b border-ink-100 py-2.5 last:border-b-0 dark:border-ink-800/60"
    >
      {/* 时间线圆点 */}
      <span
        className={`absolute -left-[17px] top-3.5 h-1.5 w-1.5 rounded-full border-2 border-ink-25 dark:border-ink-900 ${dotClass}`}
      />

      <div className="space-y-1">
        <div className="font-mono text-xs text-ink-400 dark:text-ink-500">
          <span className="text-ink-500 dark:text-ink-400">{dateStr}</span>{' '}
          {timeStr}
        </div>

        <span
          className={`inline-block rounded px-1 py-0.5 text-[10px] font-semibold tracking-wide ${
            event.sourceLevel === 'T1' || event.sourceLevel === 'T1.5'
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
              : 'border border-ink-200 bg-ink-50 text-ink-500 dark:border-ink-700 dark:bg-ink-800/60 dark:text-ink-400'
          }`}
        >
          {event.sourceName}
        </span>

        <h3 className="text-sm font-medium leading-snug text-ink-900 transition-colors group-hover:text-brand-600 dark:text-ink-50 dark:group-hover:text-brand-400">
          {event.title}
        </h3>

        {event.summary && (
          <p className="line-clamp-2 text-xs leading-relaxed text-ink-500 dark:text-ink-400">
            {event.summary}
          </p>
        )}
      </div>
    </Link>
  );
}

function getImportanceDotClass(importance: number): string {
  if (importance >= 5) {
    return 'bg-importance-5';
  }
  if (importance >= 4) {
    return 'bg-importance-4';
  }
  return 'bg-ink-300 dark:bg-ink-600';
}
