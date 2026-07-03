import { getSource, type SourceLevel } from '@/lib/config';
import clsx from 'clsx';

interface Props {
  sourceId: string;
  showLevel?: boolean;
  className?: string;
}

const LEVEL_STYLES: Record<SourceLevel, string> = {
  'T1':   'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-950/30 dark:text-brand-400 dark:border-brand-900/40',
  'T1.5': 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-400 dark:border-cyan-900/40',
  'T2':   'bg-ink-50 text-ink-700 border-ink-200 dark:bg-ink-800/50 dark:text-ink-300 dark:border-ink-700/50',
  'T3':   'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40',
};

export function SourceBadge({ sourceId, showLevel = true, className }: Props) {
  const source = getSource(sourceId);
  if (!source) return null;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium tracking-wide',
        LEVEL_STYLES[source.level],
        className
      )}
    >
      <span>{source.name}</span>
      {showLevel && <span className="tnum opacity-60 text-[10px]">{source.level}</span>}
    </span>
  );
}
