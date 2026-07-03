'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CATEGORIES, type CategoryId } from '@/lib/config';
import { clsx } from 'clsx';

interface Props {
  active: CategoryId | 'all';
  counts?: Record<string, number>;
}

/**
 * 分类导航侧栏 — AIHOT 风格
 *
 * 设计：色条 + 数字徽标 + hover 微动效
 * 每个分类左侧有一条主题色竖线，激活时整行高亮
 */

const CAT_COLOR_BAR: Record<string, string> = {
  regulation: 'bg-amber-500',
  approval:   'bg-emerald-600',
  safety:     'bg-red-600',
  insight:    'bg-sky-600',
};

const CAT_ACTIVE_BG: Record<string, string> = {
  regulation: 'bg-amber-50 dark:bg-amber-950/20',
  approval:   'bg-emerald-50 dark:bg-emerald-950/20',
  safety:     'bg-red-50 dark:bg-red-950/20',
  insight:    'bg-sky-50 dark:bg-sky-950/20',
};

const CAT_ACTIVE_TEXT: Record<string, string> = {
  regulation: 'text-amber-800 dark:text-amber-200',
  approval:   'text-emerald-800 dark:text-emerald-200',
  safety:     'text-red-800 dark:text-red-200',
  insight:    'text-sky-800 dark:text-sky-200',
};

export function CategoryNavPanel({ active, counts }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  function go(id: CategoryId | 'all') {
    const params = new URLSearchParams(sp.toString());
    if (id === 'all') params.delete('category');
    else params.set('category', id);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : '/', { scroll: false });
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-ink-200/60 px-4 py-2.5 dark:border-ink-800/60">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
          分类导航
        </h3>
      </div>
      <div className="p-2">
        <button
          onClick={() => go('all')}
          className={clsx(
            'group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-all duration-150',
            active === 'all'
              ? 'bg-brand-50 font-semibold text-brand-700 dark:bg-brand-950/30 dark:text-brand-300'
              : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800/50'
          )}
        >
          <span className={clsx('h-4 w-0.5 rounded-full transition-colors', active === 'all' ? 'bg-brand-500' : 'bg-transparent group-hover:bg-ink-300 dark:group-hover:bg-ink-600')} />
          <span className="flex-1">全部</span>
          <span className="tnum rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500 dark:bg-ink-800 dark:text-ink-400">
            {counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0}
          </span>
        </button>
        {CATEGORIES.map((c) => {
          const isActive = active === c.id;
          return (
            <button
              key={c.id}
              onClick={() => go(c.id)}
              className={clsx(
                'group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-all duration-150',
                isActive
                  ? clsx(CAT_ACTIVE_BG[c.id], 'font-semibold', CAT_ACTIVE_TEXT[c.id])
                  : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800/50'
              )}
            >
              <span className={clsx('h-4 w-0.5 rounded-full transition-colors', isActive ? CAT_COLOR_BAR[c.id] : 'bg-transparent group-hover:bg-ink-300 dark:group-hover:bg-ink-600')} />
              <span aria-hidden className="text-sm opacity-80">{c.emoji}</span>
              <span className="flex-1">{c.label}</span>
              <span className="tnum rounded-full bg-ink-100/70 px-1.5 py-0.5 text-[10px] font-medium text-ink-500 dark:bg-ink-800/70 dark:text-ink-400">
                {counts?.[c.id] ?? 0}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
