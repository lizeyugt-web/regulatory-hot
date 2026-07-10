'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

interface CollapsibleGroupProps {
  dateLabel: string;
  count: number;
  dateCode: string;       // e.g. "7/9"
  children: ReactNode;
  /** 当天不可折叠，全部显示 */
  isToday?: boolean;
  /** 初始显示条数上限（非当天时生效），超出部分折叠 */
  maxInitial?: number;
}

export function CollapsibleGroup({
  dateLabel, count, dateCode, children, isToday = false, maxInitial,
}: CollapsibleGroupProps) {
  const [collapsed, setCollapsed] = useState(!isToday);
  const [showAll, setShowAll] = useState(isToday);

  const hasMore = !isToday && maxInitial && count > maxInitial;
  const hiddenCount = hasMore ? count - maxInitial : 0;

  // 当天始终展开
  const effectiveCollapsed = isToday ? false : collapsed;

  return (
    <section>
      <button
        type="button"
        onClick={() => {
          if (!isToday) setCollapsed(!collapsed);
        }}
        className="mb-2 flex w-full items-center gap-3 group"
        style={{ cursor: isToday ? 'default' : 'pointer' }}
      >
        <div className={`relative z-10 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold shadow-soft dark:border-ink-950 ${
          isToday
            ? 'bg-amber-500 text-white dark:bg-amber-600'
            : 'bg-brand-500 text-white dark:bg-brand-600'
        }`}>
          {dateCode}
        </div>
        <h2 className="text-sm font-semibold tracking-tight text-ink-900 dark:text-ink-50">
          {isToday ? `${dateLabel}（今天）` : dateLabel}
        </h2>
        <span className="tnum text-xs text-ink-500 dark:text-ink-400">{count} 条</span>
        <span className="h-px flex-1 bg-ink-200/60 dark:bg-ink-800/60" />
        {!isToday && (
          <svg
            className={`h-4 w-4 flex-shrink-0 text-ink-400 transition-transform duration-200 ${
              effectiveCollapsed ? '' : 'rotate-180'
            }`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* 内容区 */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          effectiveCollapsed ? 'max-h-0 opacity-0' : 'max-h-[9999px] opacity-100'
        }`}
      >
        <div className="divide-y divide-ink-100 dark:divide-ink-800/60">
          {children}
        </div>
      </div>

      {/* 显示更多按钮 */}
      {hasMore && !effectiveCollapsed && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 w-full rounded-md border border-dashed border-ink-200 py-2 text-xs text-ink-500 transition-colors hover:border-amber-300 hover:text-amber-600 dark:border-ink-700 dark:text-ink-400 dark:hover:border-amber-600 dark:hover:text-amber-400"
        >
          显示更多 {hiddenCount} 条
        </button>
      )}
    </section>
  );
}
