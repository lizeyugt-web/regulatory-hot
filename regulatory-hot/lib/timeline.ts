/**
 * 时间轴分组工具 — 主页 & 全部动态共用
 */
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { RegulatoryEvent } from './types';

export function buildTimeline(events: RegulatoryEvent[]) {
  const todayStr = format(new Date(), 'M月d日', { locale: zhCN });
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const map = new Map<string, { items: RegulatoryEvent[]; isToday: boolean }>();
  for (const e of events) {
    const key = format(new Date(e.publishedAt), 'M月d日', { locale: zhCN });
    if (!map.has(key)) {
      map.set(key, { items: [], isToday: key === todayStr });
    }
    map.get(key)!.items.push(e);
  }

  // 按日期排序（最近的在前）
  const sorted = Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a, 'zh', { numeric: true }));

  // 7天内 vs 7天外
  const recent: {
    dateLabel: string; dateCode: string; items: RegulatoryEvent[]; isToday: boolean;
  }[] = [];
  const older: RegulatoryEvent[] = [];

  for (const [dateLabel, group] of sorted) {
    const parts = dateLabel.match(/(\d+)月(\d+)日/);
    if (!parts) { older.push(...group.items); continue; }
    const dateObj = new Date(new Date().getFullYear(), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const dateCode = `${parts[1]}/${parts[2]}`;

    if (dateObj >= sevenDaysAgo) {
      recent.push({ dateLabel, dateCode, items: group.items, isToday: group.isToday });
    } else {
      older.push(...group.items);
    }
  }

  // 更早的记录按天数分组
  const olderByDay = new Map<string, RegulatoryEvent[]>();
  for (const e of older) {
    const key = format(new Date(e.publishedAt), 'M月d日', { locale: zhCN });
    if (!olderByDay.has(key)) olderByDay.set(key, []);
    olderByDay.get(key)!.push(e);
  }
  const olderSorted = Array.from(olderByDay.entries())
    .sort(([a], [b]) => b.localeCompare(a, 'zh', { numeric: true }));

  const olderFlattened = olderSorted.flatMap(([, items]) => items);
  const olderLabel = olderSorted.length > 0
    ? `更早的记录 · ${olderSorted[olderSorted.length - 1][0]} 至 ${olderSorted[0][0]}`
    : '更早的记录';

  return {
    recent,
    older: olderFlattened,
    olderLabel,
    olderTotal: olderFlattened.length,
  };
}
