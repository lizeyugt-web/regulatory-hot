/**
 * Mock 数据生成器
 *
 * 4 大板块导航 + 子分类标签体系
 * 评分/精选/聚类全部由真实引擎驱动
 */
import type { RegulatoryEvent, DailyReport, Topic, RawItem } from './types';
import {
  CATEGORIES,
  SOURCES,
  getSource,
  type CategoryId,
  type SubCategory,
  type SourceLevel,
  type ProductType,
  type TherapeuticArea,
} from './config';
import { runScoringEngine } from './scoring';
import { clusterEvents } from './clustering';
import { generateDailyReport } from './daily';

// 固定随机种子
let seed = 42;
function rand(): number {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}
function range(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

// ===========================================================================
// 数据模板 — 4 大板块 + 子标签
// ===========================================================================

interface EventTemplate {
  titleEn: string;
  title: string;
  summary: string;
  category: CategoryId;
  subCategory: SubCategory[];
  productType?: ProductType;
  therapeuticArea?: TherapeuticArea;
  scores: {
    sourceAuthority: number;
    impactScope: number;
    complianceUrgency: number;
    industryAttention: number;
    timeliness: number;
  };
  effectiveDate?: string;
  affectedRegions?: string[];
}

const EVENT_TEMPLATES: Record<string, EventTemplate[]> = {
  // ===== FDA =====
  fda: [
    {
      titleEn: 'FDA Approves Novel GLP-1 Receptor Agonist for Chronic Weight Management',
      title: 'FDA 批准新型 GLP-1 受体激动剂用于慢性体重管理',
      summary: 'FDA 于本周批准了一款新型 GLP-1 受体激动剂，适用于 BMI≥30 或 BMI≥27 合并至少一项体重相关并发症的成人患者。该药物为每周一次皮下注射，在 3 期临床试验中平均减重 15.4%。',
      category: 'approval',
      subCategory: ['新药批准', '优先审评'],
      productType: '化学药品',
      therapeuticArea: '代谢 (糖尿病/肥胖)',
      scores: { sourceAuthority: 98, impactScope: 92, complianceUrgency: 70, industryAttention: 95, timeliness: 95 },
      affectedRegions: ['US', 'Global'],
    },
    {
      titleEn: 'FDA Issues Final Guidance on AI/ML-Enabled Medical Devices',
      title: 'FDA 发布人工智能医疗器械定稿指南',
      summary: '本次指南明确了 AI/ML 医疗器械上市后修改的预定变更控制计划（PCCP）框架，允许厂商在无需每次重新提交 510(k) 的前提下部署模型更新。',
      category: 'regulation',
      subCategory: ['指南发布', '草案征求意见'],
      productType: '医疗器械 Class II',
      scores: { sourceAuthority: 98, impactScope: 88, complianceUrgency: 82, industryAttention: 90, timeliness: 92 },
      effectiveDate: '2026-08-15',
      affectedRegions: ['US'],
    },
    {
      titleEn: 'FDA Class I Recall: Defective Insulin Pump Batteries',
      title: 'FDA 一级召回：某品牌胰岛素泵电池缺陷',
      summary: '某医疗器械厂商对其胰岛素泵电池组发起一级召回，影响 2024 年 1 月至 2025 年 6 月期间销售的产品，已报告 12 起电池过热事件。',
      category: 'safety',
      subCategory: ['召回', '安全警戒'],
      productType: '医疗器械 Class II',
      therapeuticArea: '代谢 (糖尿病/肥胖)',
      scores: { sourceAuthority: 96, impactScope: 72, complianceUrgency: 95, industryAttention: 80, timeliness: 90 },
      affectedRegions: ['US'],
    },
    {
      titleEn: 'FDA Warning Letter to Sterile Compounding Facility',
      title: 'FDA 对某无菌配制设施发出警告信',
      summary: 'FDA 向某无菌药品配制设施发出警告信，指出其在无菌操作规程、环境监测和人员培训方面存在严重 CGMP 违规。',
      category: 'safety',
      subCategory: ['警告信', 'GMP 检查', '违规处罚'],
      productType: '化学药品',
      scores: { sourceAuthority: 95, impactScope: 55, complianceUrgency: 85, industryAttention: 60, timeliness: 85 },
      affectedRegions: ['US'],
    },
    {
      titleEn: 'FDA Publishes Draft Guidance on Biosimilar Interchangeability',
      title: 'FDA 发布生物类似药可互换性草案指南',
      summary: '草案指南阐述了生物类似药证明可互换性所需的科学证据标准，包括转换研究设计和参照药对比数据要求。',
      category: 'regulation',
      subCategory: ['指南发布', '草案征求意见'],
      productType: '生物制品',
      scores: { sourceAuthority: 97, impactScope: 80, complianceUrgency: 65, industryAttention: 82, timeliness: 88 },
      affectedRegions: ['US', 'Global'],
    },
  ],
  // ===== EMA =====
  ema: [
    {
      titleEn: 'EMA CHMP Adopts Positive Opinion for First-in-Class Gene Therapy',
      title: 'EMA CHMP 对首个同类基因疗法给出肯定意见',
      summary: '人用药品委员会（CHMP）通过肯定意见，建议批准一款用于治疗镰状细胞病的基因疗法。该产品为同类首个（first-in-class）一次性基因修饰疗法。',
      category: 'approval',
      subCategory: ['新药批准', '加速审批'],
      productType: '基因治疗',
      therapeuticArea: '罕见病',
      scores: { sourceAuthority: 96, impactScope: 85, complianceUrgency: 65, industryAttention: 88, timeliness: 90 },
      affectedRegions: ['EU'],
    },
    {
      titleEn: 'EMA Updates Guideline on Quality of Biotechnological Products',
      title: 'EMA 更新生物技术产品质量指南',
      summary: '本次更新重点修订了生物制品生产工艺变更可比性研究的统计学要求，新增了对连续生产工艺的接受标准。',
      category: 'regulation',
      subCategory: ['指南发布', '技术标准'],
      productType: '生物制品',
      scores: { sourceAuthority: 94, impactScope: 75, complianceUrgency: 70, industryAttention: 72, timeliness: 82 },
      affectedRegions: ['EU'],
    },
    {
      titleEn: 'EMA Safety Signal: Hepatotoxicity Risk with Novel JAK Inhibitor',
      title: 'EMA 安全信号：某新型 JAK 抑制剂肝毒性风险',
      summary: 'EMA 药物警戒风险评估委员会（PRAC）启动对某新型 JAK 抑制剂肝毒性风险的安全信号审查，要求上市许可持有人提交累积安全性数据。',
      category: 'safety',
      subCategory: ['安全警戒', '不良反应'],
      productType: '化学药品',
      therapeuticArea: '免疫/炎症',
      scores: { sourceAuthority: 94, impactScope: 78, complianceUrgency: 90, industryAttention: 82, timeliness: 88 },
      affectedRegions: ['EU'],
    },
  ],
  // ===== NMPA =====
  nmpa: [
    {
      titleEn: 'NMPA Approves Domestically Developed PD-1 Inhibitor for New Indication',
      title: 'NMPA 批准国产 PD-1 抑制剂新适应症',
      summary: '国家药监局通过优先审评程序，批准某国产 PD-1 单抗用于一线治疗不可切除肝细胞癌，这是该产品获批的第 5 个适应症。',
      category: 'approval',
      subCategory: ['新适应症', '优先审评'],
      productType: '生物制品',
      therapeuticArea: '肿瘤',
      scores: { sourceAuthority: 95, impactScope: 75, complianceUrgency: 60, industryAttention: 85, timeliness: 88 },
      affectedRegions: ['CN'],
    },
    {
      titleEn: 'NMPA Issues Technical Guideline for AI Medical Device Registration',
      title: 'NMPA 发布人工智能医疗器械注册技术审查指导原则',
      summary: '指导原则涵盖了 AI 医疗器械的全生命周期管理要求，包括算法变更控制、训练数据治理、临床评价路径等关键环节。',
      category: 'regulation',
      subCategory: ['指导原则', '法规发布'],
      productType: '医疗器械 Class III',
      scores: { sourceAuthority: 95, impactScope: 82, complianceUrgency: 78, industryAttention: 85, timeliness: 85 },
      affectedRegions: ['CN'],
    },
    {
      titleEn: 'NMPA Conducts Cross-Provincial Drug Distribution Inspection',
      title: 'NMPA 开展跨省药品流通专项检查',
      summary: '本次专项检查覆盖 23 个省份的 580 余家药品经营企业，重点关注冷链运输合规性和处方药销售管理。',
      category: 'safety',
      subCategory: ['飞行检查', 'GMP 检查'],
      productType: '化学药品',
      scores: { sourceAuthority: 93, impactScope: 68, complianceUrgency: 80, industryAttention: 65, timeliness: 80 },
      affectedRegions: ['CN'],
    },
  ],
  // ===== PMDA =====
  pmda: [
    {
      titleEn: 'PMDA Approves First Domestic CAR-T Cell Therapy',
      title: 'PMDA 批准首款国产 CAR-T 细胞疗法',
      summary: '日本药品医疗器械综合机构批准某国产 CAR-T 产品用于复发难治性 B 细胞急性淋巴细胞白血病。',
      category: 'approval',
      subCategory: ['新药批准', '突破性疗法'],
      productType: '细胞治疗',
      therapeuticArea: '肿瘤',
      scores: { sourceAuthority: 92, impactScope: 70, complianceUrgency: 60, industryAttention: 82, timeliness: 85 },
      affectedRegions: ['JP'],
    },
  ],
  // ===== MHRA =====
  mhra: [
    {
      titleEn: 'MHRA Launches New AI Airlock for Medical Device Regulation',
      title: 'MHRA 启动医疗器械 AI 监管沙盒',
      summary: '英国药品和医疗产品监管署推出 AI Airlock 计划，为 AI 医疗器械提供受控的真实世界测试环境，加速创新产品上市。',
      category: 'insight',
      subCategory: ['政策声明', '会议活动'],
      productType: '医疗器械 Class II',
      scores: { sourceAuthority: 90, impactScope: 72, complianceUrgency: 55, industryAttention: 78, timeliness: 82 },
      affectedRegions: ['GB'],
    },
  ],
  // ===== ICH =====
  ich: [
    {
      titleEn: 'ICH Assembly Adopts New Q5A(R3) Guideline on Viral Safety',
      title: 'ICH 大会通过新版 Q5A(R3) 病毒安全性指南',
      summary: '本次修订引入了对新型生产系统（如细胞与基因治疗产品）的病毒安全性考量，扩展了传统 Q5A 的适用范围。',
      category: 'regulation',
      subCategory: ['ICH 指南', '技术标准'],
      productType: '生物制品',
      scores: { sourceAuthority: 95, impactScope: 88, complianceUrgency: 75, industryAttention: 80, timeliness: 85 },
      effectiveDate: '2026-10-01',
      affectedRegions: ['Global'],
    },
  ],
  // ===== WHO =====
  who: [
    {
      titleEn: 'WHO Updates Essential Medicines List with New Cancer Immunotherapies',
      title: 'WHO 更新基本药物清单，新增多种肿瘤免疫疗法',
      summary: '第 23 版 WHO 基本药物清单纳入了 5 种肿瘤免疫疗法和 3 种新型抗生素，反映了全球疾病负担的最新变化。',
      category: 'insight',
      subCategory: ['行业分析', '统计报告'],
      therapeuticArea: '肿瘤',
      scores: { sourceAuthority: 94, impactScope: 90, complianceUrgency: 50, industryAttention: 85, timeliness: 80 },
      affectedRegions: ['Global'],
    },
  ],
  // ===== RAPS =====
  raps: [
    {
      titleEn: 'RAPS Analysis: FDA AI/ML Guidance Implications for Industry',
      title: 'RAPS 分析：FDA AI/ML 指南对行业的影响',
      summary: 'RAPS 对 FDA 最新发布的 AI/ML 医疗器械指南进行深度解读，分析了 PCCP 框架对器械厂商产品更新流程的具体影响。',
      category: 'insight',
      subCategory: ['行业分析'],
      scores: { sourceAuthority: 70, impactScope: 65, complianceUrgency: 55, industryAttention: 75, timeliness: 78 },
      affectedRegions: ['US'],
    },
  ],
  default: [
    {
      titleEn: 'Regulatory Update from Global Agency',
      title: '某监管机构发布更新公告',
      summary: '该机构发布了一份关于药品/医疗器械监管的重要更新，涉及审批流程优化和合规要求调整。',
      category: 'insight',
      subCategory: ['政策声明'],
      scores: { sourceAuthority: 80, impactScope: 60, complianceUrgency: 55, industryAttention: 60, timeliness: 70 },
      affectedRegions: ['Global'],
    },
  ],
};

// ===========================================================================
// 生成函数
// ===========================================================================

export function generateMockEvents(
  count: number = 30,
  opts: { selectedOnly?: boolean } = {},
): RegulatoryEvent[] {
  const list: RegulatoryEvent[] = [];
  const now = new Date('2026-07-03T08:00:00+08:00');

  const allTemplates: Array<{ sourceId: string; template: EventTemplate }> = [];
  for (const source of SOURCES) {
    const templates = EVENT_TEMPLATES[source.id] ?? EVENT_TEMPLATES.default;
    for (const template of templates) {
      allTemplates.push({ sourceId: source.id, template });
    }
  }

  for (let i = 0; i < count; i++) {
    const { sourceId, template } = allTemplates[i % allTemplates.length];
    const source = getSource(sourceId)!;

    const publishedAt = new Date(now.getTime() - i * range(60, 360) * 60 * 1000);
    const id = `mock-${sourceId}-${i.toString().padStart(3, '0')}`;

    const scores = {
      sourceAuthority: Math.min(100, Math.max(0, template.scores.sourceAuthority + range(-3, 3))),
      impactScope: Math.min(100, Math.max(0, template.scores.impactScope + range(-2, 2))),
      complianceUrgency: Math.min(100, Math.max(0, template.scores.complianceUrgency + range(-3, 3))),
      industryAttention: Math.min(100, Math.max(0, template.scores.industryAttention + range(-3, 3))),
      timeliness: Math.min(100, Math.max(0, template.scores.timeliness - i * 0.5 + range(-2, 2))),
    };

    const scoringResult = runScoringEngine(scores, source.level, template.category);

    list.push({
      id,
      rawItemId: `raw-${id}`,
      title: template.title,
      titleEn: template.titleEn,
      url: `${source.homepage}news/${i}`,
      permalink: `/items/${id}`,
      summary: template.summary,
      sourceId: source.id,
      sourceName: source.name,
      sourceLevel: source.level,
      sourceCountry: source.country,
      publishedAt: publishedAt.toISOString(),
      crawledAt: publishedAt.toISOString(),
      analyzedAt: publishedAt.toISOString(),
      category: template.category,
      subCategory: template.subCategory,
      tags: [source.name],
      importance: scoringResult.importance,
      scores: scoringResult.scores,
      finalScore: scoringResult.finalScore,
      selected: scoringResult.selected,
      isLead: false,
      productType: template.productType,
      therapeuticArea: template.therapeuticArea,
      effectiveDate: template.effectiveDate,
      affectedRegions: template.affectedRegions ?? [source.country === 'INT' ? 'Global' : source.country],
      clusterId: undefined,
      clusterSize: undefined,
      relatedIds: undefined,
      isClusterPrimary: undefined,
      clusterSourceCount: undefined,
      aiModel: 'deepseek-ai/DeepSeek-V3.1-Terminus',
      aiCost: 0.005,
      aiAnalyzedAt: publishedAt.toISOString(),
    });
  }

  const { primaryEvents } = clusterEvents(list);
  if (primaryEvents.length > 0) primaryEvents[0].isLead = true;

  return opts.selectedOnly ? primaryEvents.filter((e) => e.selected) : primaryEvents;
}

export function generateMockDaily(date: string = '2026-07-03'): DailyReport {
  const allEvents = generateMockEvents(40, { selectedOnly: false });
  return generateDailyReport(date, allEvents, {
    totalCrawled: 687,
    totalAnalyzed: Math.round(687 * 0.30),
    sourcesCovered: SOURCES.length,
  });
}

export function generateMockTopics(): Topic[] {
  const baseTopics: Array<Omit<Topic, 'itemCount' | 'lastEventAt'>> = [
    { id: '1', slug: 'fda', name: 'FDA', description: '美国食品药品监督管理局动态', type: 'agency' },
    { id: '2', slug: 'ema', name: 'EMA', description: '欧洲药品管理局动态', type: 'agency' },
    { id: '3', slug: 'nmpa', name: 'NMPA', description: '国家药品监督管理局动态', type: 'agency' },
    { id: '4', slug: 'pmda', name: 'PMDA', description: '日本药品医疗器械综合机构动态', type: 'agency' },
    { id: '5', slug: 'mhra', name: 'MHRA', description: '英国药品和医疗产品监管署动态', type: 'agency' },
    { id: '6', slug: 'who', name: 'WHO', description: '世界卫生组织动态', type: 'agency' },
    { id: '7', slug: 'ich', name: 'ICH', description: '国际人用药品注册技术协调会指南', type: 'agency' },
    { id: '8', slug: 'imdrf', name: 'IMDRF', description: '国际医疗器械监管机构论坛', type: 'agency' },
    { id: '9', slug: 'oncology', name: '肿瘤', description: '肿瘤领域药品/器械监管动态', type: 'area' },
    { id: '10', slug: 'rare-disease', name: '罕见病', description: '罕见病药物与基因疗法监管', type: 'area' },
    { id: '11', slug: 'ai-medical', name: 'AI 医疗器械', description: 'AI/ML 医疗器械的全球监管动向', type: 'tech' },
    { id: '12', slug: 'cell-gene', name: '细胞与基因治疗', description: 'CGT 领域监管动态', type: 'tech' },
  ];

  return baseTopics.map((t) => ({
    ...t,
    itemCount: range(8, 156),
    lastEventAt: new Date(Date.now() - range(1, 72) * 3600 * 1000).toISOString(),
  }));
}

export function generateMockRawItems(count: number = 50): RawItem[] {
  const items: RawItem[] = [];
  const now = new Date('2026-07-03T08:00:00+08:00');
  const sampleTitles = [
    { title: 'FDA approves new drug', content: 'The FDA has approved a novel therapy...' },
    { title: 'Job Opening: Regulatory Affairs Manager', content: 'We are hiring...' },
    { title: 'EMA publishes new guideline', content: 'The European Medicines Agency has released...' },
    { title: 'Sponsor our annual conference', content: 'Become a sponsor today...' },
    { title: 'NMPA announces inspection results', content: 'The National Medical Products Administration...' },
    { title: 'ICH Q5A(R3) guideline adopted', content: 'The ICH Assembly has adopted...' },
    { title: 'Summer sale on training courses', content: 'Get 50% off...' },
    { title: 'FDA issues warning letter to facility', content: 'The FDA has issued a warning letter...' },
    { title: 'WHO updates essential medicines list', content: 'The World Health Organization...' },
    { title: 'New blog post: Career in regulatory', content: 'Thinking about a career change...' },
  ];

  for (let i = 0; i < count; i++) {
    const sample = sampleTitles[i % sampleTitles.length];
    const source = SOURCES[i % SOURCES.length];
    const publishedAt = new Date(now.getTime() - i * range(30, 120) * 60 * 1000);
    items.push({
      id: `raw-${source.id}-${i.toString().padStart(3, '0')}`,
      sourceId: source.id,
      sourceLevel: source.level,
      sourceUrl: `${source.homepage}article/${i}`,
      titleOriginal: sample.title,
      titleOriginalLang: 'en',
      contentText: sample.content,
      publishedAt: publishedAt.toISOString(),
      crawledAt: publishedAt.toISOString(),
      contentHash: `hash-${i}-${Date.now()}`,
      preFilterStatus: 'pending',
    });
  }
  return items;
}
