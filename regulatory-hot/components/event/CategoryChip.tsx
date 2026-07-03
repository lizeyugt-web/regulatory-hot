import { CATEGORIES, type CategoryId } from '@/lib/config';
import clsx from 'clsx';

interface Props {
  category: CategoryId | string;
  size?: 'sm' | 'md';
  className?: string;
}

// 暗色模式用更克制的低饱和度
const DARK: Record<string, string> = {
  'bg-amber-50 text-amber-700 border-amber-200':     'dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40',
  'bg-emerald-50 text-emerald-700 border-emerald-200':'dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40',
  'bg-red-50 text-red-700 border-red-200':           'dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/40',
  'bg-sky-50 text-sky-700 border-sky-200':           'dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900/40',
};

export function CategoryChip({ category, size = 'sm', className }: Props) {
  const cat = CATEGORIES.find((c) => c.id === category);
  if (!cat) return null;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded border font-medium tracking-wide',
        cat.cssClass,
        DARK[cat.cssClass] ?? '',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs',
        className
      )}
      title={cat.description}
    >
      <span aria-hidden>{cat.emoji}</span>
      <span>{cat.label}</span>
    </span>
  );
}
