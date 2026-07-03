/**
 * 日报生成模块 — 提前计算，分桶排序
 *
 * AIHOT 核心经验："信息入库时已完成所有处理，日报只需分桶排序，1 秒出报"
 * 本模块不调用任何 AI 模型，纯 SQL/数组操作。
 */
import type { RegulatoryEvent, DailyReport, DailySection } from './types';
import { CATEGORIES, DAILY_CONFIG, type CategoryId } from './config';

/**
 * 从已评分、已精选的事件列表生成日报
 *
 * @param date 日期 YYYY-MM-DD
 * @param allEvents 过去 24h 内的所有事件（含精选和非精选）
 * @param stats 统计信息
 */
export function generateDailyReport(
  date: string,
  allEvents: RegulatoryEvent[],
  stats: {
    totalCrawled: number;
    totalAnalyzed: number;
    sourcesCovered: number;
  },
): DailyReport {
  const selectedEvents = allEvents.filter((e) => e.selected);

  // 按分类分桶
  const sectionMap = new Map<CategoryId, RegulatoryEvent[]>();
  for (const ev of selectedEvents) {
    const key = ev.category;
    if (!sectionMap.has(key)) sectionMap.set(key, []);
    sectionMap.get(key)!.push(ev);
  }

  // 按 DAILY_CONFIG.sectionOrder 顺序生成 sections
  const sections: DailySection[] = [];
  const usedEventIds = new Set<string>();

  for (const catId of DAILY_CONFIG.sectionOrder) {
    const items = sectionMap.get(catId);
    if (!items || items.length === 0) continue;

    // 按 finalScore 降序，取前 N 条
    const sorted = [...items].sort((a, b) => b.finalScore - a.finalScore);
    const topItems = sorted.slice(0, DAILY_CONFIG.maxPerSection);

    for (const item of topItems) {
      usedEventIds.add(item.id);
    }

    const cat = CATEGORIES.find((c) => c.id === catId)!;
    sections.push({
      label: cat.label,
      category: catId,
      items: topItems.map((e) => ({
        id: e.id,
        title: e.title,
        summary: e.summary,
        url: e.url,
        sourceName: e.sourceName,
        importance: e.importance,
        finalScore: e.finalScore,
      })),
    });
  }

  // 快讯：importance >= 阈值且未进入任何 section
  const flashes = selectedEvents
    .filter((e) => e.importance >= DAILY_CONFIG.flashImportanceThreshold && !usedEventIds.has(e.id))
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, DAILY_CONFIG.maxFlashes);

  // 头条：精选事件中 finalScore 最高的
  const lead = selectedEvents.sort((a, b) => b.finalScore - a.finalScore)[0];

  return {
    id: `daily-${date}`,
    date,
    generatedAt: `${date}T${DAILY_CONFIG.generateAt}:00.000+08:00`,
    windowStart: `${date}T00:00:00.000+08:00`,
    windowEnd: `${date}T${DAILY_CONFIG.generateAt}:00.000+08:00`,
    leadEventId: lead?.id,
    sections,
    flashes,
    stats: {
      totalCrawled: stats.totalCrawled,
      totalAnalyzed: stats.totalAnalyzed,
      totalSelected: selectedEvents.length,
      sourcesCovered: stats.sourcesCovered,
    },
  };
}
