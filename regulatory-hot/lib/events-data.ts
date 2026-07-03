/**
 * 数据读取层 — Server Component 直接读文件系统，不走 HTTP self-request
 * 这样避免 Next.js 请求自己造成的死锁/排队（10秒 → 10ms）
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import type { RegulatoryEvent } from './types';

export interface EventsData {
  updated: string;
  stats: {
    total: number;
    sources: { rss: number; fr: number; web: number };
    selected: number;
  };
  items: RegulatoryEvent[];
}

/** AI 处理进度统计 */
export interface AiProgress {
  total: number;
  completed: number;
  pending: number;
  lastRun?: string;
  lastDuration?: string;
  lastCost?: string;
  updatedAt?: string;
}

let _cache: EventsData | null = null;
let _cacheTime = 0;
const CACHE_TTL = 30_000; // 30秒内存缓存（分析时更频繁更新）

/**
 * 读取 events.json，带内存缓存
 */
export function getEventsData(): EventsData {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL) {
    return _cache;
  }

  try {
    const filePath = join(process.cwd(), 'public', 'data', 'events.json');
    const raw = readFileSync(filePath, 'utf8');
    _cache = JSON.parse(raw);
    _cacheTime = now;
    return _cache!;
  } catch {
    // 文件不存在时返回空数据
    return {
      updated: new Date().toISOString(),
      stats: { total: 0, selected: 0, sources: { rss: 0, fr: 0, web: 0 } },
      items: [],
    };
  }
}

/** 获取所有事件列表 */
export function getEvents(): RegulatoryEvent[] {
  return getEventsData().items;
}

/** 获取精选事件 */
export function getSelectedEvents(): RegulatoryEvent[] {
  return getEvents().filter((e) => e.selected);
}

/** 获取统计数据 */
export function getStats() {
  return getEventsData().stats;
}

/** 获取 AI 处理进度（优先读 .progress.json，降级实时计算） */
export function getAiProgress(): AiProgress {
  try {
    const filePath = join(process.cwd(), 'public', 'data', '.progress.json');
    const raw = readFileSync(filePath, 'utf8');
    const p = JSON.parse(raw);
    return {
      total: p.total || 0,
      completed: p.completed || 0,
      pending: p.pending || 0,
      lastRun: p.lastRun,
      lastDuration: p.lastDuration,
      lastCost: p.lastCost,
      updatedAt: p.updatedAt,
    };
  } catch {
    const items = getEvents();
    const completed = items.filter(e => e.aiSummaryCn).length;
    return { total: items.length, completed, pending: items.length - completed };
  }
}
