/**
 * 事件聚类模块 — 同事件多源折叠
 *
 * AIHOT 核心经验：同一事件（如"FDA 批准某新药"）会被多个信源同时报道，
 * 不聚类则精选页会变成同一事件的重复刷屏。
 *
 * 当前阶段：基于关键词/标题相似度的简单聚类
 * 后续阶段：接入 Embedding 语义聚类（text-embedding-3-small）
 */
import type { RegulatoryEvent } from './types';
import { selectPrimaryEvent, type SourceLevel } from './config';

/** 简单文本相似度（Jaccard 系数，基于词集交集） */
export function textSimilarity(a: string, b: string): number {
  const tokenize = (s: string): Set<string> => {
    // 简单分词：英文按空格，中文按 2-gram
    const tokens = new Set<string>();
    const lower = s.toLowerCase();
    // 英文单词
    const words = lower.match(/[a-z]+/g) ?? [];
    for (const w of words) {
      if (w.length >= 3) tokens.add(w);
    }
    // 中文 2-gram
    const cjk = lower.match(/[\u4e00-\u9fa5]+/g) ?? [];
    for (const seg of cjk) {
      for (let i = 0; i < seg.length - 1; i++) {
        tokens.add(seg.slice(i, i + 2));
      }
    }
    return tokens;
  };

  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/** 聚类结果 */
export interface ClusterResult {
  /** 聚类后的主条目列表（每个聚类只保留一条） */
  primaryEvents: RegulatoryEvent[];
  /** 聚类映射：eventId → clusterId */
  clusterMap: Map<string, string>;
  /** 聚类详情：clusterId → 该聚类的所有事件 */
  clusterDetails: Map<string, RegulatoryEvent[]>;
}

/**
 * 对事件列表进行聚类
 *
 * @param events 待聚类的事件列表
 * @param similarityThreshold 相似度阈值（默认 0.30，后续接入 Embedding 后改为 0.82）
 * @param windowHours 聚类窗口（只对发布时间在窗口内的事件聚类）
 */
export function clusterEvents(
  events: RegulatoryEvent[],
  similarityThreshold: number = 0.30,
  windowHours: number = 72,
): ClusterResult {
  const clusterMap = new Map<string, string>();
  const clusterDetails = new Map<string, RegulatoryEvent[]>();
  const now = Date.now();
  const windowMs = windowHours * 60 * 60 * 1000;

  let clusterCounter = 0;

  for (const event of events) {
    const eventTime = new Date(event.publishedAt).getTime();
    // 跳过窗口外的事件
    if (now - eventTime > windowMs) {
      const soloId = `cluster-solo-${event.id}`;
      clusterMap.set(event.id, soloId);
      clusterDetails.set(soloId, [event]);
      continue;
    }

    // 尝试匹配已有聚类
    let matchedClusterId: string | null = null;
    let bestSimilarity = 0;

    for (const [clusterId, clusterItems] of clusterDetails) {
      // 只与窗口内的聚类比较
      const clusterTime = new Date(clusterItems[0].publishedAt).getTime();
      if (now - clusterTime > windowMs) continue;

      // 取聚类中所有事件的标题做相似度比较
      for (const existing of clusterItems) {
        const sim = textSimilarity(event.title, existing.title);
        if (sim > bestSimilarity) {
          bestSimilarity = sim;
          if (sim >= similarityThreshold) {
            matchedClusterId = clusterId;
          }
        }
      }
    }

    if (matchedClusterId) {
      clusterMap.set(event.id, matchedClusterId);
      clusterDetails.get(matchedClusterId)!.push(event);
    } else {
      const newClusterId = `cluster-${clusterCounter++}`;
      clusterMap.set(event.id, newClusterId);
      clusterDetails.set(newClusterId, [event]);
    }
  }

  // 从每个聚类选出主条目
  const primaryEvents: RegulatoryEvent[] = [];
  for (const [clusterId, clusterItems] of clusterDetails) {
    const primary = selectPrimaryEvent(clusterItems);
    // 标记主条目和聚类信息
    primary.isClusterPrimary = true;
    primary.clusterId = clusterId;
    primary.clusterSize = clusterItems.length;
    primary.clusterSourceCount = new Set(clusterItems.map((e) => e.sourceId)).size;
    primary.relatedIds = clusterItems.filter((e) => e.id !== primary.id).map((e) => e.id);

    // 非主条目也标记 clusterId
    for (const item of clusterItems) {
      if (item.id !== primary.id) {
        item.clusterId = clusterId;
        item.clusterSize = clusterItems.length;
        item.isClusterPrimary = false;
      }
    }

    primaryEvents.push(primary);
  }

  // 按 finalScore 降序
  primaryEvents.sort((a, b) => b.finalScore - a.finalScore);

  return { primaryEvents, clusterMap, clusterDetails };
}

/**
 * 获取某聚类的所有非主条目（用于展开查看"+N 源"）
 */
export function getClusterMembers(
  clusterId: string,
  allEvents: RegulatoryEvent[],
): RegulatoryEvent[] {
  return allEvents.filter((e) => e.clusterId === clusterId && !e.isClusterPrimary);
}
