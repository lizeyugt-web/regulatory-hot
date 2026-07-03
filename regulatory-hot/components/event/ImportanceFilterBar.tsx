'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { IMPORTANCE_META, type Importance } from '@/lib/config';
import clsx from 'clsx';

interface Props {
  basePath: string;
}

const DARK_ACTIVE: Record<Importance, string> = {
  5: 'dark:bg-red-950/50 dark:text-red-300 dark:border-red-800/50',
  4: 'dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800/50',
  3: 'dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800/50',
  2: 'dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/50',
  1: 'dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700/50',
};

export function ImportanceFilterBar({ basePath }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const active = sp.get('importance') ? Number(sp.get('importance')) : 0;

  function go(level: Importance | 0) {
    const params = new URLSearchParams(sp.toString());
    if (level === 0) params.delete('importance');
    else params.set('importance', String(level));
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-ink-500 dark:text-ink-400">重要度：</span>
      <button
        onClick={() => go(0)}
        className={clsx(
          'rounded-md border px-2 py-0.5 text-xs font-medium transition',
          active === 0
            ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/50 dark:text-brand-300'
            : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300'
        )}
      >
        全部
      </button>
      {([5, 4, 3, 2, 1] as Importance[]).map((lv) => {
        const meta = IMPORTANCE_META[lv];
        const isActive = active === lv;
        return (
          <button
            key={lv}
            onClick={() => go(lv)}
            className={clsx(
              'rounded-md border px-2 py-0.5 text-xs font-medium transition',
              isActive
                ? `${meta.bgClass} ${meta.cssClass} border-current ${DARK_ACTIVE[lv]}`
                : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300'
            )}
          >
            {meta.stars} {meta.label}
          </button>
        );
      })}
    </div>
  );
}
