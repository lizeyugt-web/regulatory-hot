/**
 * 数据读取层 — Server Component 直读 SQLite 数据库
 * 替代原来的 events.json 文件读取
 */
import prisma from './prisma';
import type { RegulatoryEvent } from './types';

// ============ 核心读取 ============

/** 获取事件列表（支持筛选） */
export async function getEvents(options?: {
  category?: string;
  sourceId?: string;
  selectedOnly?: boolean;
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
}): Promise<RegulatoryEvent[]> {
  const where: any = {};

  if (options?.category && options.category !== 'all') where.category = options.category;
  if (options?.sourceId) where.sourceId = options.sourceId;
  if (options?.selectedOnly) where.selected = 1;
  if (options?.from || options?.to) {
    where.publishedAt = {};
    if (options.from) where.publishedAt.gte = options.from;
    if (options.to) where.publishedAt.lte = options.to;
  }

  const dbEvents = await prisma.event.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
    take: options?.limit || undefined,
    skip: options?.offset || 0,
  });

  return dbEvents.map(toRegulatoryEvent);
}

/** 获取精选事件 */
export async function getSelectedEvents(limit = 30): Promise<RegulatoryEvent[]> {
  return getEvents({ selectedOnly: true, limit });
}

/** 获取统计数据 */
export async function getStats() {
  const [total, selected, wechatTotal, aiCompleted] = await Promise.all([
    prisma.event.count(),
    prisma.event.count({ where: { selected: 1 } }),
    prisma.event.count({ where: { isSocial: 1 } }),
    prisma.event.count({ where: { aiStatus: 'analyzed' } }),
  ]);

  return { total, selected, wechatTotal, fdaTotal: total - wechatTotal, aiCompleted };
}

/** 全文检索 */
export async function searchEvents(q: string, limit = 20): Promise<RegulatoryEvent[]> {
  try {
    const results = await prisma.$queryRawUnsafe(
      `SELECT e.* FROM events e 
       INNER JOIN events_fts f ON e.rowid = f.rowid
       WHERE events_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
      q, limit
    );
    return (results as any[]).map(toRegulatoryEvent);
  } catch {
    // FTS 降级
    const dbEvents = await prisma.event.findMany({
      where: {
        OR: [
          { titleCn: { contains: q } },
          { summaryCn: { contains: q } },
        ],
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });
    return dbEvents.map(toRegulatoryEvent);
  }
}

/** 获取事件详情 */
export async function getEventById(id: string): Promise<RegulatoryEvent | null> {
  const e = await prisma.event.findUnique({ where: { id } });
  return e ? toRegulatoryEvent(e) : null;
}

// ============ 类型转换 ============

function toRegulatoryEvent(e: any): RegulatoryEvent {
  return {
    id: e.id,
    rawItemId: e.rawItemId,
    title: e.titleCn || e.titleOriginal,
    titleEn: e.titleLang !== 'zh' ? e.titleOriginal : undefined,
    url: e.url,
    permalink: e.permalink,
    summary: e.summaryCn || e.summaryOriginal,
    background: '',
    sourceId: e.sourceId,
    sourceName: e.sourceName,
    sourceLevel: e.sourceLevel,
    sourceCountry: e.sourceCountry,
    publishedAt: e.publishedAt,
    crawledAt: e.crawledAt,
    analyzedAt: e.aiAnalyzedAt || '',
    category: e.category,
    subCategory: safeParse(e.subCategory, []),
    tags: safeParse(e.tags, []),
    importance: e.importance,
    scores: safeParse(e.scores, { sourceAuthority: 50, impactScope: 50, timeliness: 50, complianceUrgency: 50, industryAttention: 50 }),
    finalScore: e.finalScore,
    selected: e.selected === 1,
    isLead: e.isLead === 1,
    // AI 字段
    aiSummaryCn: e.summaryCn,
    aiReason: e.aiReason,
    aiModel: e.aiModel,
    aiCost: e.aiCost,
    aiAnalyzedAt: e.aiAnalyzedAt,
    aiSummaryModel: e.aiModel,
    contentCn: e.contentCn || undefined,
    contentOriginal: e.contentOriginal || undefined,
    contentOriginalLang: e.titleLang || undefined,
    // 微信
    isSocial: e.isSocial === 1,
    _readCount: e.readCount,
    _likeCount: e.likeCount,
    _coverUrl: e.coverUrl,
    _contentHint: e.contentHint || undefined,
    // 其他
    affectedRegions: safeParse(e.affectedRegions, []),
    clusterId: e.clusterId,
    clusterSize: e.clusterSize,
  };
}

function safeParse(json: string | null | undefined, fallback: any): any {
  if (!json) return fallback;
  try { return JSON.parse(json); } catch { return fallback; }
}
