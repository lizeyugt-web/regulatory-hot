/**
 * 精选页四类展示映射
 *
 * 目标：在不改动底层数据结构和采集逻辑的前提下，将现有 RegulatoryEvent
 * 映射到面向读者的四类信息流：
 *   - agency:    官方监管信息（监管机构发布的法规/指南/政策）
 *   - enterprise:药械企业信息（产品审批、上市、召回、安全通告等）
 *   - org:       行业协会/国际组织信息（WHO/ICH/RAPS 等）
 *   - other:     其他信息（行业洞察、会议、报告、政策评论等）
 *
 * 映射规则基于 source.type + category，未来若数据源扩展为独立的企业公告源，
 * 可无缝迁移到 source.type === 'enterprise'。
 */

import { getSource, CATEGORIES, type CategoryId } from './config';
import type { RegulatoryEvent } from './types';

export type FeaturedColumnId = 'agency' | 'enterprise' | 'org' | 'other';

export interface FeaturedColumn {
  id: FeaturedColumnId;
  title: string;
  description: string;
  count: number;
}

export const FEATURED_COLUMNS: FeaturedColumn[] = [
  {
    id: 'agency',
    title: '官方监管信息',
    description: '监管机构 · 法规指南 · 政策公告',
    count: 0,
  },
  {
    id: 'enterprise',
    title: '药械企业信息',
    description: '产品审批 · 上市许可 · 召回安全',
    count: 0,
  },
  {
    id: 'org',
    title: '行业协会信息',
    description: '国际组织 · 行业协会 · 标准发布',
    count: 0,
  },
  {
    id: 'other',
    title: '其他信息',
    description: '行业洞察 · 会议报告 · 政策评论',
    count: 0,
  },
];

/**
 * 将单条事件映射到精选四类之一
 */
export function classifyFeaturedColumn(event: RegulatoryEvent): FeaturedColumnId {
  const source = getSource(event.sourceId);

  // 行业协会 / 国际组织：source.type 为 org 或 media（行业组织/媒体）
  if (source?.type === 'org' || source?.type === 'media') {
    return 'org';
  }

  // 官方监管机构发布的内容，按 category 细分
  if (source?.type === 'agency' || event.sourceLevel === 'T1') {
    if (event.category === 'regulation') {
      return 'agency';
    }
    // approval / safety 通常涉及具体企业产品
    if (event.category === 'approval' || event.category === 'safety') {
      return 'enterprise';
    }
  }

  // 默认归入其他
  return 'other';
}

/**
 * 按精选列分组事件，并按发布时间降序排序
 */
export function groupFeaturedByColumn(
  events: RegulatoryEvent[],
): Record<FeaturedColumnId, RegulatoryEvent[]> {
  const groups: Record<FeaturedColumnId, RegulatoryEvent[]> = {
    agency: [],
    enterprise: [],
    org: [],
    other: [],
  };

  for (const event of events) {
    const column = classifyFeaturedColumn(event);
    groups[column].push(event);
  }

  // 每组按 publishedAt 降序，时间新的在前
  for (const key of Object.keys(groups) as FeaturedColumnId[]) {
    groups[key].sort(
      (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );
  }

  return groups;
}

/**
 * 获取分类的显示标签
 */
export function getCategoryLabel(category: CategoryId): string {
  return CATEGORIES.find((c) => c.id === category)?.label ?? category;
}
