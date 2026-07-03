import { IMPORTANCE_META, type Importance } from '@/lib/config';
import clsx from 'clsx';

interface Props {
  level: Importance;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

/**
 * 重要度指示器 — 纯色点设计（无星星）
 *
 * 设计变更：用户要求去掉星星表示法，改为：
 *   - 一个小圆点 + 可选文字标签
 *   - 颜色对应重要度级别
 *   - 极简，不抢内容焦点
 */

const DOT_COLOR: Record<Importance, string> = {
  5: 'bg-red-500',
  4: 'bg-orange-500',
  3: 'bg-yellow-500',
  2: 'bg-blue-500',
  1: 'bg-ink-400',
};

const TEXT_COLOR: Record<Importance, string> = {
  5: 'text-red-600 dark:text-red-400',
  4: 'text-orange-600 dark:text-orange-400',
  3: 'text-yellow-600 dark:text-yellow-400',
  2: 'text-blue-600 dark:text-blue-400',
  1: 'text-ink-500 dark:text-ink-400',
};

export function ImportanceBadge({ level, size = 'sm', showLabel = false, className }: Props) {
  const meta = IMPORTANCE_META[level];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1',
        size === 'sm' ? 'text-[11px]' : 'text-xs',
        TEXT_COLOR[level],
        className
      )}
      title={meta.description}
    >
      <span className={clsx('inline-block rounded-full', DOT_COLOR[level], size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2')} />
      {showLabel && <span className="tracking-wide">{meta.label}</span>}
    </span>
  );
}
