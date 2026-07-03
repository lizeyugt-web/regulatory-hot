import Link from 'next/link';
import type { RegulatoryEvent } from '@/lib/types';

interface Props {
  events: RegulatoryEvent[];
}

/**
 * 「当前热点」面板 — 从传入的 events 中取 importance 最高的
 */
export function HotTopicsPanel({ events }: Props) {
  const hot = events
    .filter((e) => e.selected)
    .sort((a, b) => b.importance - a.importance || b.finalScore - a.finalScore)
    .slice(0, 6);

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-ink-200 px-4 py-2.5 dark:border-ink-800">
        <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-50">当前热点</h2>
        <p className="text-xs text-ink-500 dark:text-ink-400">按重要度排序 · 随时间消退</p>
      </div>
      <ul className="divide-y divide-ink-100 px-4 dark:divide-ink-800">
        {hot.length === 0 && (
          <li className="py-3 text-sm text-ink-500 dark:text-ink-400">暂无热点</li>
        )}
        {hot.map((e) => (
          <li key={e.id}>
            <Link
              href={e.permalink}
              className="group block py-2.5"
            >
              <h3 className="line-clamp-2 text-sm font-medium text-ink-900 group-hover:text-brand-700 dark:text-ink-100 dark:group-hover:text-brand-300">
                {e.title}
              </h3>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
                <span className="inline-flex items-center gap-0.5 rounded bg-orange-50 px-1 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
                  {'★'.repeat(e.importance)}
                </span>
                <span>·</span>
                <span>{e.sourceName}</span>
                <span>·</span>
                <time>{timeAgoShort(e.publishedAt)}</time>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min}分钟前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}小时前`;
  return `${Math.floor(h / 24)}天前`;
}
