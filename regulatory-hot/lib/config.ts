/**
 * 监管领域核心配置
 *
 * 设计原则：所有"会随业务变化"的字段都集中在此，方便后续扩展。
 * 复刻自 AIHOT 的"配置驱动"模式，避免硬编码散落各处。
 */

// ---------------------------------------------------------------------------
// 1. 监管机构 / 信源定义
// ---------------------------------------------------------------------------

export type SourceLevel = 'T1' | 'T1.5' | 'T2' | 'T3';

export interface RegulatorySource {
  id: string;                 // slug
  name: string;               // 中文显示名
  nameEn: string;             // 英文名
  country: string;            // ISO 国家代码
  region: 'global' | 'asia' | 'europe' | 'americas' | 'oceania';
  level: SourceLevel;         // 权威度分级
  type: 'agency' | 'org' | 'media';
  /** 采集入口：RSS / API / 网页 */
  endpoints: Array<{
    kind: 'rss' | 'api' | 'web';
    url: string;
    note?: string;
  }>;
  homepage: string;
}

/** T1 = 监管机构一手公告；T1.5 = 官方社交/博客；T2 = 行业媒体；T3 = 学术/二级聚合 */
export const SOURCES: RegulatorySource[] = [
  // ---------- 第一梯队：9 国核心监管机构 ----------
  {
    id: 'fda',
    name: '美国 FDA',
    nameEn: 'U.S. Food and Drug Administration',
    country: 'US',
    region: 'americas',
    level: 'T1',
    type: 'agency',
    endpoints: [
      { kind: 'rss', url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds', note: '多频道 RSS' },
      { kind: 'api', url: 'https://api.fda.gov/drug/event.json', note: 'openFDA' },
      { kind: 'api', url: 'https://api.fda.gov/device/510k.json', note: 'openFDA 器械 510k' },
      { kind: 'api', url: 'https://api.fda.gov/device/pma.json', note: 'openFDA 器械 PMA' },
    ],
    homepage: 'https://www.fda.gov/',
  },
  {
    id: 'ema',
    name: '欧洲 EMA',
    nameEn: 'European Medicines Agency',
    country: 'EU',
    region: 'europe',
    level: 'T1',
    type: 'agency',
    endpoints: [
      { kind: 'rss', url: 'https://www.ema.europa.eu/en/rss-feeds', note: 'News & Events RSS' },
    ],
    homepage: 'https://www.ema.europa.eu/',
  },
  {
    id: 'nmpa',
    name: '国家药监局 NMPA',
    nameEn: 'National Medical Products Administration',
    country: 'CN',
    region: 'asia',
    level: 'T1',
    type: 'agency',
    endpoints: [
      { kind: 'web', url: 'https://www.nmpa.gov.cn/yaopin/', note: '药品公告' },
      { kind: 'web', url: 'https://www.cmde.org.cn/flfg/zdyz/zdyzwbk/', note: '医疗器械技术审评' },
    ],
    homepage: 'https://www.nmpa.gov.cn/',
  },
  {
    id: 'pmda',
    name: '日本 PMDA',
    nameEn: 'Pharmaceuticals and Medical Devices Agency',
    country: 'JP',
    region: 'asia',
    level: 'T1',
    type: 'agency',
    endpoints: [
      { kind: 'rss', url: 'https://www.pmda.go.jp/english/rss/', note: 'News RSS' },
    ],
    homepage: 'https://www.pmda.go.jp/english/',
  },
  {
    id: 'mhra',
    name: '英国 MHRA',
    nameEn: 'Medicines and Healthcare products Regulatory Agency',
    country: 'GB',
    region: 'europe',
    level: 'T1',
    type: 'agency',
    endpoints: [
      { kind: 'rss', url: 'https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency.atom', note: 'GOV.UK Atom' },
    ],
    homepage: 'https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency',
  },
  {
    id: 'health-canada',
    name: '加拿大 Health Canada',
    nameEn: 'Health Canada',
    country: 'CA',
    region: 'americas',
    level: 'T1',
    type: 'agency',
    endpoints: [
      { kind: 'rss', url: 'https://www.canada.ca/en/health-canada/services/drugs-health-products/visiting-rebuilding-health-canada-website.html', note: '通告 RSS' },
    ],
    homepage: 'https://www.canada.ca/en/health-canada.html',
  },
  {
    id: 'tga',
    name: '澳大利亚 TGA',
    nameEn: 'Therapeutic Goods Administration',
    country: 'AU',
    region: 'oceania',
    level: 'T1',
    type: 'agency',
    endpoints: [
      { kind: 'rss', url: 'https://www.tga.gov.au/rss/updates.xml', note: 'Updates' },
    ],
    homepage: 'https://www.tga.gov.au/',
  },
  {
    id: 'swissmedic',
    name: '瑞士 Swissmedic',
    nameEn: 'Swiss Agency for Therapeutic Products',
    country: 'CH',
    region: 'europe',
    level: 'T1',
    type: 'agency',
    endpoints: [
      { kind: 'rss', url: 'https://www.swissmedic.ch/swissmedic/en/home/news.rss.html', note: 'News' },
    ],
    homepage: 'https://www.swissmedic.ch/',
  },
  {
    id: 'anvisa',
    name: '巴西 ANVISA',
    nameEn: 'Brazilian Health Regulatory Agency',
    country: 'BR',
    region: 'americas',
    level: 'T1',
    type: 'agency',
    endpoints: [
      { kind: 'rss', url: 'https://www.gov.br/anvisa/pt-br/assuntos/medicamentos', note: '药品页' },
    ],
    homepage: 'https://www.gov.br/anvisa/',
  },
  // ---------- 第二梯队：国际组织 ----------
  {
    id: 'who',
    name: '世界卫生组织 WHO',
    nameEn: 'World Health Organization',
    country: 'INT',
    region: 'global',
    level: 'T1',
    type: 'org',
    endpoints: [
      { kind: 'rss', url: 'https://www.who.int/rss-feeds/news-english.xml', note: 'News' },
    ],
    homepage: 'https://www.who.int/',
  },
  {
    id: 'ich',
    name: '国际人用药品注册技术协调会 ICH',
    nameEn: 'International Council for Harmonisation',
    country: 'INT',
    region: 'global',
    level: 'T1',
    type: 'org',
    endpoints: [
      { kind: 'rss', url: 'https://www.ich.org/feed.xml', note: 'News Feed' },
    ],
    homepage: 'https://www.ich.org/',
  },
  {
    id: 'imdrf',
    name: '国际医疗器械监管机构论坛 IMDRF',
    nameEn: 'International Medical Device Regulators Forum',
    country: 'INT',
    region: 'global',
    level: 'T1',
    type: 'org',
    endpoints: [
      { kind: 'rss', url: 'https://www.imdrf.org/rss/news.xml', note: 'News' },
    ],
    homepage: 'https://www.imdrf.org/',
  },
  {
    id: 'pic-s',
    name: '药品检查合作计划 PIC/S',
    nameEn: 'Pharmaceutical Inspection Co-operation Scheme',
    country: 'INT',
    region: 'global',
    level: 'T1',
    type: 'org',
    endpoints: [
      { kind: 'rss', url: 'https://picscheme.org/en/news', note: 'News' },
    ],
    homepage: 'https://picscheme.org/',
  },
  {
    id: 'iso',
    name: '国际标准化组织 ISO',
    nameEn: 'International Organization for Standardization',
    country: 'INT',
    region: 'global',
    level: 'T1',
    type: 'org',
    endpoints: [
      { kind: 'rss', url: 'https://www.iso.org/news/rss.xml', note: 'News' },
    ],
    homepage: 'https://www.iso.org/',
  },
  // ---------- 第三梯队：行业组织 / 媒体 ----------
  {
    id: 'raps',
    name: 'RAPS',
    nameEn: 'Regulatory Affairs Professionals Society',
    country: 'US',
    region: 'global',
    level: 'T2',
    type: 'media',
    endpoints: [
      { kind: 'rss', url: 'https://www.raps.org/news-and-articles/news-articles.rss', note: 'News' },
    ],
    homepage: 'https://www.raps.org/',
  },
  {
    id: 'ispe',
    name: 'ISPE',
    nameEn: 'International Society for Pharmaceutical Engineering',
    country: 'US',
    region: 'global',
    level: 'T2',
    type: 'media',
    endpoints: [
      { kind: 'rss', url: 'https://ispe.org/feed', note: 'News Feed' },
    ],
    homepage: 'https://ispe.org/',
  },
  {
    id: 'pda',
    name: 'PDA',
    nameEn: 'Parenteral Drug Association',
    country: 'US',
    region: 'global',
    level: 'T2',
    type: 'media',
    endpoints: [
      { kind: 'rss', url: 'https://www.pda.org/news', note: 'News' },
    ],
    homepage: 'https://www.pda.org/',
  },
  {
    id: 'dia',
    name: 'DIA',
    nameEn: 'Drug Information Association',
    country: 'US',
    region: 'global',
    level: 'T2',
    type: 'media',
    endpoints: [
      { kind: 'rss', url: 'https://www.diaglobal.org/en/news', note: 'News' },
    ],
    homepage: 'https://www.diaglobal.org/',
  },
  {
    id: 'usp',
    name: '美国药典 USP',
    nameEn: 'U.S. Pharmacopeia',
    country: 'US',
    region: 'global',
    level: 'T2',
    type: 'media',
    endpoints: [
      { kind: 'rss', url: 'https://www.usp.org/news', note: 'News' },
    ],
    homepage: 'https://www.usp.org/',
  },
];

// 工具函数
export function getSource(id: string): RegulatorySource | undefined {
  return SOURCES.find((s) => s.id === id);
}

export function getSourcesByLevel(level: SourceLevel): RegulatorySource[] {
  return SOURCES.filter((s) => s.level === level);
}

// ---------------------------------------------------------------------------
// 2. 分类体系（4 大板块 — 导航栏用）
//    设计原则：越简单越好，一目了然。细节交给 subCategory 标签。
// ---------------------------------------------------------------------------

export type CategoryId =
  | 'regulation'    // 法规与标准 — 法规/指南/指导原则/技术标准/药典
  | 'approval'      // 审批与决策 — 药品/器械/生物制品审批、附条件批准
  | 'safety'        // 安全与合规 — 安全警戒/召回/警告信/GMP检查/禁令
  | 'insight';      // 行业洞察 — 会议/政策/合作/研究报告/出版物

export interface Category {
  id: CategoryId;
  label: string;
  labelEn: string;
  description: string;
  emoji: string;
  cssClass: string;
}

export const CATEGORIES: Category[] = [
  {
    id: 'regulation', label: '法规与标准', labelEn: 'Regulation & Standards',
    description: '法规、指南、指导原则、技术标准、药典更新',
    emoji: '📜', cssClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    id: 'approval', label: '审批与决策', labelEn: 'Approvals & Decisions',
    description: '药品/器械/生物制品审批、附条件批准、拒绝/撤回决定',
    emoji: '✅', cssClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'safety', label: '安全与合规', labelEn: 'Safety & Compliance',
    description: '安全警戒、召回、警告信、GMP 检查、进口禁令',
    emoji: '⚠️', cssClass: 'bg-red-50 text-red-700 border-red-200',
  },
  {
    id: 'insight', label: '行业洞察', labelEn: 'Industry Insights',
    description: '会议活动、政策声明、跨境合作、研究报告、出版物',
    emoji: '📰', cssClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
];

export function getCategory(id: CategoryId | string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// 2a. 子分类标签（更细粒度的标签，一条信息可有多个标签）
// ---------------------------------------------------------------------------

export const SUB_CATEGORIES = [
  // regulation 下的标签
  '法规发布', '指南发布', '指导原则', '草案征求意见', '技术标准', '药典更新',
  'ICH 指南', 'ISO 标准', 'USP 标准',
  // approval 下的标签
  '新药批准', '新适应症', '附条件批准', '加速审批', '优先审评', '突破性疗法',
  '仿制药批准', '510(k) 批准', 'PMA 批准', 'De Novo', '拒绝/撤回',
  // safety 下的标签
  '安全警戒', '不良反应', '召回', '警告信', '黑框警告', '进口禁令',
  'GMP 检查', '飞行检查', '违规处罚', '临床暂停',
  // insight 下的标签
  '会议活动', '咨询委员会', '公开听证', '人事变动', '政策声明', '跨境合作',
  '年度报告', '白皮书', '期刊文章', '行业分析', '统计报告',
] as const;

export type SubCategory = (typeof SUB_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// 3. 重要度（5 级）
// ---------------------------------------------------------------------------

export type Importance = 1 | 2 | 3 | 4 | 5;

export interface ImportanceMeta {
  level: Importance;
  label: string;
  stars: string;
  description: string;
  cssClass: string;          // 文字色
  bgClass: string;           // 背景色
}

export const IMPORTANCE_META: Record<Importance, ImportanceMeta> = {
  5: { level: 5, label: '重大', stars: '★★★★★',
       description: '全球性影响、紧急合规要求、生效日期临近',
       cssClass: 'text-red-600',     bgClass: 'bg-red-50 border-red-200' },
  4: { level: 4, label: '高',   stars: '★★★★',
       description: '重大法规变化、关键审批、跨地区影响',
       cssClass: 'text-orange-600',  bgClass: 'bg-orange-50 border-orange-200' },
  3: { level: 3, label: '中',   stars: '★★★',
       description: '值得关注的指南更新、行业普遍关注',
       cssClass: 'text-yellow-600',  bgClass: 'bg-yellow-50 border-yellow-200' },
  2: { level: 2, label: '低',   stars: '★★',
       description: '局部地区、局部企业相关',
       cssClass: 'text-blue-600',    bgClass: 'bg-blue-50 border-blue-200' },
  1: { level: 1, label: '参考', stars: '★',
       description: '基础参考、背景信息',
       cssClass: 'text-gray-500',    bgClass: 'bg-gray-50 border-gray-200' },
};

// ---------------------------------------------------------------------------
// 4. 产品类型 / 治疗领域（枚举）
// ---------------------------------------------------------------------------

export const PRODUCT_TYPES = [
  '化学药品', '生物制品', '疫苗', '细胞治疗', '基因治疗',
  '体外诊断 IVD', '医疗器械 Class I', '医疗器械 Class II', '医疗器械 Class III',
  '组合产品', '原料药', '辅料', '包装材料',
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const THERAPEUTIC_AREAS = [
  '肿瘤', '心血管', '代谢 (糖尿病/肥胖)', '免疫/炎症', '感染', '神经/精神',
  '罕见病', '呼吸', '皮肤', '眼科', '血液', '生殖/泌尿', '儿科',
  '疫苗/公共卫生', '诊断/影像', '其他',
] as const;
export type TherapeuticArea = (typeof THERAPEUTIC_AREAS)[number];

// ---------------------------------------------------------------------------
// 5. 站点元信息
// ---------------------------------------------------------------------------

export const SITE = {
  name: 'Regulatory Hot',
  shortName: 'RegHot',
  tagline: '全球医药监管情报实时聚合',
  description:
    '从 FDA、EMA、NMPA、PMDA、MHRA 等 20+ 监管机构，以及 WHO、ICH、IMDRF 等 5 大国际组织自动采集医药监管动态，AI 结构化分析后多渠道分发。',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://47.107.133.169:3457',
  author: 'Regulatory Hot Team',
  buildDate: '2026-07-03',
} as const;

// ===========================================================================
// 6. 评分引擎 — 核心架构：代码决策，模型只打分
// ===========================================================================
// 设计原则（来自 AIHOT V11 重构经验）：
//   "能用脚本就别用 Agent" — 模型只做五维打分，最终决策完全由代码公式控制
//   改权重/阈值秒级生效，不需要动 Prompt
// ===========================================================================

/** 五维评分权重（总和 1.0），按监管领域调整 */
export const SCORING_WEIGHTS = {
  sourceAuthority: 0.30,    // 信源权威度 — 监管领域最重要
  impactScope: 0.25,        // 影响范围 — 跨国/多产品影响
  complianceUrgency: 0.20,  // 合规紧急度 — 是否需要立即行动
  industryAttention: 0.15,  // 行业关注度
  timeliness: 0.10,         // 时效性
} as const;

/** 信源等级 → 基准分（用于加权微调） */
export const SOURCE_LEVEL_BASE_SCORE: Record<SourceLevel, number> = {
  'T1': 85,     // 官方一手公告 — 最高
  'T1.5': 65,   // 官方社交/博客
  'T2': 45,     // 行业媒体
  'T3': 25,     // 学术/二级聚合
};

/** 各分类精选阈值 — 4 大类，简洁可控 */
export const CATEGORY_SELECTION_THRESHOLDS: Record<CategoryId, number> = {
  'regulation': 75,   // 法规与标准 — 量大，选最重要的
  'approval':   68,   // 审批与决策 — 稀缺，本身高价值
  'safety':     65,   // 安全与合规 — 宁多勿漏
  'insight':    78,   // 行业洞察 — 信息量大，门槛高
};

/** T1 信源额外加成（官方一手信息天然更值得关注） */
export const SOURCE_LEVEL_BONUS: Record<SourceLevel, number> = {
  'T1': 5,
  'T1.5': 2,
  'T2': 0,
  'T3': 0,
};

/**
 * 核心函数：五维分 + 信源等级 → finalScore (0-100)
 * 这是整个系统的"评分宪法"，所有决策都由此公式决定。
 */
export function computeFinalScore(
  scores: {
    sourceAuthority: number;
    impactScope: number;
    complianceUrgency: number;
    industryAttention: number;
    timeliness: number;
  },
  sourceLevel: SourceLevel,
): number {
  const weighted =
    scores.sourceAuthority * SCORING_WEIGHTS.sourceAuthority +
    scores.impactScope * SCORING_WEIGHTS.impactScope +
    scores.complianceUrgency * SCORING_WEIGHTS.complianceUrgency +
    scores.industryAttention * SCORING_WEIGHTS.industryAttention +
    scores.timeliness * SCORING_WEIGHTS.timeliness;

  // 信源等级微调：T1 有额外加成
  const sourceBonus = (SOURCE_LEVEL_BASE_SCORE[sourceLevel] - 50) * 0.1;
  return Math.min(100, Math.max(0, Math.round(weighted + sourceBonus)));
}

/** finalScore → importance (1-5) 映射 */
export function mapScoreToImportance(score: number): Importance {
  if (score >= 85) return 5;
  if (score >= 70) return 4;
  if (score >= 55) return 3;
  if (score >= 40) return 2;
  return 1;
}

/**
 * 判断是否精选 — 分类差异化阈值 + 信源加成
 * AIHOT 经验：不同分类信息密度不同，不能统一阈值
 */
export function isSelected(
  finalScore: number,
  category: CategoryId,
  sourceLevel: SourceLevel,
): boolean {
  const threshold = CATEGORY_SELECTION_THRESHOLDS[category];
  const bonus = SOURCE_LEVEL_BONUS[sourceLevel];
  return finalScore + bonus >= threshold;
}

// ===========================================================================
// 7. AI 模型配置 — 已迁移至 config/ai-models.json（2026-07-29）
// ===========================================================================
// ⚠️ 端点/Key/每模块模型 统一由项目根 config/ai-models.json 管理
//    （lib/ai-config.ts 加载；Chat 走 WorkBuddy 积分反代，Embedding/Rerank 走硅基流动）
//    此处仅保留 Prompt 模板与少量兼容导出，不再维护模型名/端点。
// ===========================================================================

/** @deprecated 使用 lib/ai-config.ts 的 getAIModuleConfig() 代替 */
export const AI_API = {
  baseUrl: process.env.WB_PROXY_BASE_URL ?? 'http://127.0.0.1:8002/v1',
  apiKey: process.env.WB_PROXY_API_KEY ?? '',
} as const;

// ===========================================================================
// 7a. 两级 AI 筛选模型 — 成本控制核心
// ===========================================================================
// 第一级：便宜模型预筛（DeepSeek-V3.2），过滤无关内容
// 第二级：强模型精评（DeepSeek-V3.1-Terminus），只对相关内容做五维打分
// ===========================================================================

export interface PreFilterConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  estimatedCostPerItem: number;
  prompt: string;
}

export const PRE_FILTER: PreFilterConfig = {
  model: process.env.PRE_FILTER_MODEL ?? 'deepseek-ai/DeepSeek-V3.2',
  maxTokens: 512,
  temperature: 0,
  estimatedCostPerItem: 0.0005,
  prompt: `判断以下内容是否属于医药监管领域的重要动态：
- 新法规/指南/指导原则的发布或修订
- 药品/器械的审批决定（批准/拒绝/撤回）
- 安全警告/召回/不良反应通报
- 检查结果/合规行动/警告信
- 国际标准/药典更新
- 监管机构重大政策声明/人事变动

排除：纯企业新闻、营销内容、招聘信息、会议赞助广告。
输出 JSON：{"relevant": true/false, "reason": "一句话理由"}`,
};

export interface ScoringConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  estimatedCostPerItem: number;
  prompt: string;
}

export const SCORING_AI: ScoringConfig = {
  model: process.env.SCORING_MODEL ?? 'deepseek-ai/DeepSeek-V3.1-Terminus',
  maxTokens: 1024,
  temperature: 0,
  estimatedCostPerItem: 0.005,
  prompt: `对以下监管信息进行五维评分（每维 0-100，不打总分）：
1. sourceAuthority — 信源权威度（官方一手=90+，权威媒体=70-89，个人博客=40-69）
2. impactScope — 影响范围（全球/跨国=90+，多国=70-89，单国=50-69，局部=30-49）
3. complianceUrgency — 合规紧急度（需立即行动=90+，3个月内=70-89，6个月内=50-69，信息性=30-49）
4. industryAttention — 行业关注度（广泛关注=90+，领域关注=70-89，小众=40-69）
5. timeliness — 时效性（今日新闻=90+，本周=70-89，本月=50-69，更早=30-49）

输出 JSON：{"sourceAuthority":N, "impactScope":N, "complianceUrgency":N, "industryAttention":N, "timeliness":N}`,
};

// ===========================================================================
// 7b. Embedding & Reranker 模型
// ===========================================================================

export const EMBEDDING_CONFIG = {
  model: process.env.EMBEDDING_MODEL ?? 'Qwen/Qwen3-Embedding-8B',
  /** Qwen3-Embedding-8B 最大输入 token 数 */
  maxInputTokens: 32768,
  /** 可选维度：64/128/256/512/768/1024/1536/2048/2560/4096 */
  dimensions: 1024,
} as const;

export const RERANKER_CONFIG = {
  model: process.env.RERANKER_MODEL ?? 'Qwen/Qwen3-Reranker-8B',
  /** 每次 Rerank 最多文档数 */
  topN: 20,
} as const;

// ===========================================================================
// 7c. 备选模型（降级/高负载时切换）
// ===========================================================================

export const ALT_MODELS = {
  /** 备选精评模型：Qwen3.5 MoE 架构，35B 总参仅激活 3B，速度极快 */
  scoring: process.env.ALT_SCORING_MODEL ?? 'Qwen/Qwen3.5-35B-A3B',
} as const;

// ===========================================================================
// 8. 事件聚类配置 — 同事件多源折叠
// ===========================================================================

export const CLUSTERING = {
  /** Embedding 相似度阈值（0-1），超过此值视为同一事件 */
  similarityThreshold: 0.82,
  /** 聚类窗口：只对过去 N 小时内的条目聚类 */
  windowHours: 72,
  /** 主条选择优先级：同事件中按此顺序选主展示条目 */
  displayPriority: ['T1', 'T1.5', 'T2', 'T3'] as SourceLevel[],
} as const;

/**
 * 从同一聚类的多条事件中选出主展示条目
 * 规则：先按信源等级排序，同等级取 finalScore 最高的
 */
export function selectPrimaryEvent<T extends { sourceLevel: SourceLevel; finalScore: number }>(
  cluster: T[],
): T {
  const levelOrder: Record<SourceLevel, number> = {
    'T1': 0,
    'T1.5': 1,
    'T2': 2,
    'T3': 3,
  };
  return [...cluster].sort((a, b) => {
    const levelDiff = levelOrder[a.sourceLevel] - levelOrder[b.sourceLevel];
    if (levelDiff !== 0) return levelDiff;
    return b.finalScore - a.finalScore;
  })[0];
}

// ===========================================================================
// 9. 日报生成配置 — 提前计算，分桶排序
// ===========================================================================

export const DAILY_CONFIG = {
  /** 每日生成时间（北京时间） */
  generateAt: '08:00',
  /** 数据窗口：过去 24 小时 */
  windowHours: 24,
  /** 每个版块最多展示条目数 */
  maxPerSection: 5,
  /** 快讯：importance >= 此值且未进入任何 section 的条目 */
  flashImportanceThreshold: 4 as Importance,
  /** 快讯最多条数 */
  maxFlashes: 5,
  /** 日报 section 排序 */
  sectionOrder: [
    'regulation',
    'approval',
    'safety',
    'insight',
  ] as CategoryId[],
} as const;
