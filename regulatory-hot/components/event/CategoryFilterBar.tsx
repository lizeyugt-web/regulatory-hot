'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CATEGORIES, type CategoryId } from '@/lib/config';
import clsx from 'clsx';

interface Props {
  active: CategoryId | 'all';
  basePath: string;
}

export function CategoryFilterBar({ active, basePath }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  function go(id: CategoryId | 'all') {
    const params = new URLSearchParams(sp.toString());
    if (id === 'all') params.delete('category');
    else params.set('category', id);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <FilterButton active={active === 'all'} onClick={() => go('all')} label="全部" />
      {CATEGORIES.map((c) => (
        <FilterButton
          key={c.id}
          active={active === c.id}
          onClick={() => go(c.id)}
          label={c.label}
          emoji={c.emoji}
        />
      ))}
    </div>
  );
}

function FilterButton({
  active, onClick, label, emoji,
}: { active: boolean; onClick: () => void; label: string; emoji?: string }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-950/50 dark:text-brand-300'
          : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:border-brand-500 dark:hover:text-brand-300'
      )}
    >
      {emoji && <span aria-hidden>{emoji}</span>}
      <span>{label}</span>
    </button>
  );
}
