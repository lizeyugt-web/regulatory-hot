/**
 * 核心数据模型 TypeScript 类型定义
 * 复刻 AIHOT 模式：raw_items + analyzed_items + daily_reports
 */
import type { CategoryId, Importance, ProductType, SourceLevel, SubCategory, TherapeuticArea } from './config';

// ---------------------------------------------------------------------------
// 1. 原始采集条目
// ---------------------------------------------------------------------------
export interface RawItem {
  id: string;
  sourceId: string;                  // 关联 SOURCES.id
  sourceLevel: SourceLevel;
  sourceUrl: string;                 // 原始文章 URL
  titleOriginal: string;             // 原文标题
  titleOriginalLang: 'en' | 'zh' | 'ja' | 'de' | 'fr' | 'es' | 'other';
  contentText: string;               // 纯文本正文
  contentHtml?: string;              // 原文 HTML（可选）
  publishedAt: string;               // ISO 8601
  crawledAt: string;                 // ISO 8601
  contentHash: string;               // SHA-256 去重

  // ===== 两级 AI 筛选状态 =====
  preFilterStatus: 'pending' | 'relevant' | 'irrelevant';
  preFilterConfidence?: number;      // 预筛置信度 0-1
  preFilterReason?: string;          // 预筛判断理由
  preFilterModel?: string;           // 预筛使用的模型
  preFilterCost?: number;            // 预筛 API 成本（元）
  preFilterAt?: string;              // 预筛时间 ISO 8601
}

// ---------------------------------------------------------------------------
// 2. AI 分析结果（对外展示的核心实体）
// ---------------------------------------------------------------------------
export interface RegulatoryEvent {
  id: string;
  rawItemId: string;

  // 标题
  title: string;                     // 中文标题
  titleEn?: string;                  // 英文原标题
  url: string;                       // 原始链接
  permalink: string;                 // 站内详情页链接

  // 摘要
  summary: string;                   // 1-3 句中文摘要
  background?: string;               // 背景说明

  // 来源
  sourceId: string;
  sourceName: string;                // 显示名
  sourceLevel: SourceLevel;
  sourceCountry: string;             // ISO 国家代码

  // 时间
  publishedAt: string;
  crawledAt: string;
  analyzedAt: string;

  // 分类 & 标签
  category: CategoryId;              // 4 大板块（导航栏）
  subCategory?: SubCategory[];       // 细粒度标签（可多个）
  tags: string[];                    // 自由标签

  // 重要度（5 级）
  importance: Importance;
  /** 5 个独立维度得分（0-100），代码层加权得到 importance */
  scores: {
    sourceAuthority: number;   // 信源权威度
    impactScope: number;       // 影响范围
    timeliness: number;        // 时效性
    complianceUrgency: number; // 合规紧急度
    industryAttention: number; // 行业关注度
  };
  finalScore: number;                // 0-100 综合分

  // 业务字段
  productType?: ProductType;
  therapeuticArea?: TherapeuticArea;
  effectiveDate?: string;            // 法规/指南生效日期
  affectedRegions: string[];         // 受影响国家/地区

  // 事件聚类
  clusterId?: string;                // 同一事件多源聚合 ID
  clusterSize?: number;              // 聚合内条目数
  relatedIds?: string[];             // 相关条目 ID

  // 状态
  selected: boolean;                 // 是否进入精选
  isLead: boolean;                   // 是否当日头条

  // ===== AI 摘要 & 翻译（新版 AIHOT 信息流） =====
  aiSummaryCn?: string;              // AI 生成的中文摘要（150-250字）
  aiReason?: string;                 // AI 生成的推荐理由（1-2句）
  contentCn?: string;                // 翻译后的中文正文
  contentOriginal?: string;          // 原文正文
  contentOriginalLang?: string;      // 原文语言（en/zh/ja/...）

  // AI 元信息
  aiModel: string;                   // 使用的模型（如 deepseek-v4-pro）
  aiCost?: number;                   // 本次分析成本（元）
  aiAnalyzedAt?: string;             // AI 评分时间 ISO 8601
  aiSummaryModel?: string;           // 摘要分析使用的模型
  aiTranslateModel?: string;         // 正文翻译使用的模型
  aiTranslateAt?: string;            // 翻译时间 ISO 8601

  // ===== 聚类详情 =====
  isClusterPrimary?: boolean;        // 是否为聚类的展示主条目
  clusterSourceCount?: number;       // 本聚类的信源数量
}

// ---------------------------------------------------------------------------
// 3. 日报
// ---------------------------------------------------------------------------
export interface DailySection {
  label: string;
  category: CategoryId;
  items: Array<Pick<RegulatoryEvent,
    'id' | 'title' | 'summary' | 'url' | 'sourceName' | 'importance' | 'finalScore'
  >>;
}

export interface DailyReport {
  id: string;
  date: string;                      // YYYY-MM-DD
  generatedAt: string;               // ISO 8601
  windowStart: string;               // 过去 24h 窗口
  windowEnd: string;
  leadEventId?: string;              // 头条
  sections: DailySection[];
  flashes: RegulatoryEvent[];        // 快讯
  stats: {
    totalCrawled: number;
    totalAnalyzed: number;
    totalSelected: number;
    sourcesCovered: number;
  };
}

// ---------------------------------------------------------------------------
// 4. 主题
// ---------------------------------------------------------------------------
export interface Topic {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: 'agency' | 'tech' | 'product' | 'area';
  itemCount: number;
  lastEventAt?: string;
}

// ---------------------------------------------------------------------------
// 5. API 响应统一格式
// ---------------------------------------------------------------------------
export interface PaginatedResponse<T> {
  count: number;
  hasNext: boolean;
  nextCursor: string | null;
  items: T[];
}

export interface DailyListResponse {
  count: number;
  items: Array<{
    id: string;
    date: string;
    generatedAt: string;
    leadTitle?: string;
    eventCount: number;
    permalink: string;
  }>;
}
