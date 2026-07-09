'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

interface CollapsibleGroupProps {
  dateLabel: string;
  count: number;
  dateCode: string;  // e.g. "7/9"
  children: ReactNode;
}

export function CollapsibleGroup({ dateLabel, count, dateCode, children }: CollapsibleGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section>
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="mb-2 flex w-full items-center gap-3 cursor-pointer group"
      >
        <div className="relative z-10 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border-2 border-white bg-brand-500 text-[10px] font-bold text-white shadow-soft dark:border-ink-950 dark:bg-brand-600">
          {dateCode}
        </div>
        <h2 className="text-sm font-semibold tracking-tight text-ink-900 dark:text-ink-50">
          {dateLabel}
        </h2>
        <span className="tnum text-xs text-ink-500 dark:text-ink-400">{count} 条</span>
        <span className="h-px flex-1 bg-ink-200/60 dark:bg-ink-800/60" />
        <svg
          className={`h-4 w-4 flex-shrink-0 text-ink-400 transition-transform duration-200 ${
            collapsed ? '' : 'rotate-180'
          }`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          collapsed ? 'max-h-0 opacity-0' : 'max-h-[9999px] opacity-100'
        }`}
      >
        <div className="divide-y divide-ink-100 dark:divide-ink-800/60">
          {children}
        </div>
      </div>
    </section>
  );
}
