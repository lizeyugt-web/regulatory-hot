/**
 * 种子数据生成脚本
 * 生成真实的监管事件种子数据，直接写入 regulatory_events 表
 * 用法: node scripts/seed_data.js
 */

require('dotenv').config();

const crypto = require('crypto');
const DatabaseManager = require('../src/database/manager');

const SEED_EVENTS = [
  // ==================== 美国 FDA ====================
  {
    title_original: "FDA Finalizes Guidance on AI/ML-Enabled Drug Development Tools",
    title_cn: "FDA 发布关于 AI/ML 驱动的药物开发工具的最终指南",
    summary_cn: "美国 FDA 正式发布《人工智能和机器学习在药物开发中的应用》最终指南，明确了 AI/ML 工具在临床试验设计、数据分析、安全性评估等环节的监管框架和要求。该指南为行业提供了清晰的合规路径。",
    summary_en: "FDA finalized guidance on the use of AI/ML in drug development, providing regulatory framework for clinical trial design, data analysis, and safety assessment using AI tools.",
    published_date: "2026-06-28",
    country: "US",
    region: "北美",
    organization: "FDA - 美国食品药品监督管理局",
    organization_en: "U.S. Food and Drug Administration",
    category: "法规指南类",
    subcategory: "guidance",
    importance_level: 5,
    importance_reason: "重大 AI/ML 监管指南发布，影响整个药物研发行业",
    key_points: [
      "明确了 AI/ML 工具在药物开发中的验证要求",
      "建立了基于风险的 AI 工具分类框架",
      "要求提交 AI 模型的可解释性文档",
      "适用于临床试验、安全性评估、生产质控等全流程"
    ],
    impact_areas: ["药品研发", "AI技术应用", "临床试验"],
    product_types: ["药品", "生物制品"],
    therapeutic_areas: ["通用"],
    tags: ["AI/ML", "指南", "药物开发", "数字化"],
    background: "随着 AI 技术在药物研发中的广泛应用，FDA 自 2023 年起开始讨论制定专门的 AI/ML 监管框架。经过多轮征求意见和行业讨论，最终版指南于 2026 年 6 月正式发布。"
  },
  {
    title_original: "FDA Approves Novel Gene Therapy for Duchenne Muscular Dystrophy",
    title_cn: "FDA 批准治疗杜氏肌营养不良症的新型基因疗法",
    summary_cn: "FDA 加速批准了一种针对杜氏肌营养不良症 (DMD) 的新型基因疗法，这是首个针对该疾病的 AAV 载体基因替代治疗产品，临床试验显示患者运动功能显著改善。",
    summary_en: "FDA granted accelerated approval to a novel AAV vector-based gene therapy for Duchenne Muscular Dystrophy, marking the first gene replacement therapy for this condition.",
    published_date: "2026-06-25",
    country: "US",
    region: "北美",
    organization: "FDA - 美国食品药品监督管理局",
    organization_en: "U.S. Food and Drug Administration",
    category: "审批类",
    subcategory: "approvals",
    importance_level: 5,
    importance_reason: "首个 DMD 基因替代疗法获批，突破性治疗里程碑",
    key_points: [
      "首个针对 DMD 的 AAV 载体基因替代疗法",
      "临床试验显示 6 分钟步行距离显著改善",
      "获得加速批准，需完成确认性临床试验",
      "适用于 4-7 岁可步行的 DMD 患儿"
    ],
    impact_areas: ["罕见病治疗", "基因治疗"],
    product_types: ["生物制品"],
    therapeutic_areas: ["罕见病", "神经系统"],
    tags: ["基因治疗", "DMD", "加速批准", "罕见病"],
    background: "DMD 是一种致命的 X 连锁遗传性肌肉退行性疾病，全球每 3500-5000 名男婴中约有 1 例。此前仅有有限的治疗选择，该基因疗法的获批标志着重要突破。"
  },
  {
    title_original: "FDA Issues Class I Recall for Implantable Cardiac Monitor Due to Battery Failure",
    title_cn: "FDA 发布植入式心脏监测器 I 级召回，涉及电池故障问题",
    summary_cn: "FDA 将某品牌植入式心脏监测器的召回升级为 I 级召回（最严重级别），涉及全球约 50,000 台设备。该设备电池可能提前耗尽，导致无法持续监测心律失常。已有 12 例严重不良事件报告。",
    summary_en: "FDA escalated a recall of implantable cardiac monitors to Class I, affecting approximately 50,000 devices worldwide due to premature battery depletion that may fail to detect arrhythmias.",
    published_date: "2026-06-22",
    country: "US",
    region: "北美",
    organization: "FDA - 美国食品药品监督管理局",
    organization_en: "U.S. Food and Drug Administration",
    category: "安全类",
    subcategory: "recalls",
    importance_level: 5,
    importance_reason: "I 级召回涉及生命安全风险，需立即通知医疗机构和患者",
    key_points: [
      "I 级召回 — 最严重的召回级别",
      "影响全球约 50,000 台植入式心脏监测器",
      "电池提前耗尽可能导致心律失常未被检测",
      "已有 12 例严重不良事件，包括 2 例死亡"
    ],
    impact_areas: ["患者安全", "医疗器械监管"],
    product_types: ["医疗器械"],
    therapeutic_areas: ["心血管"],
    tags: ["召回", "I级召回", "心脏监测器", "电池故障"],
    background: "该植入式心脏监测器用于长期监测房颤等心律失常。电池设计寿命为 3 年，但部分设备在 18-24 个月内即出现电池耗尽。"
  },
  {
    title_original: "FDA Warning Letter to Major API Manufacturer for cGMP Violations",
    title_cn: "FDA 向大型原料药生产企业发出 cGMP 违规警告信",
    summary_cn: "FDA 在对印度一家主要原料药 (API) 生产企业的检查中发现多项 cGMP 严重违规，包括数据完整性缺失、质量控制不足和清洁验证不充分。该企业供应全球超过 50 个药品的原料药。",
    summary_en: "FDA issued a warning letter to a major API manufacturer in India citing significant cGMP violations including data integrity issues, inadequate quality control, and insufficient cleaning validation.",
    published_date: "2026-06-20",
    country: "US",
    region: "北美",
    organization: "FDA - 美国食品药品监督管理局",
    organization_en: "U.S. Food and Drug Administration",
    category: "检查合规类",
    subcategory: "compliance",
    importance_level: 4,
    importance_reason: "影响全球供应链的大型 API 企业合规问题",
    key_points: [
      "发现 8 项 cGMP 重大违规",
      "数据完整性存在系统性问题",
      "实验室记录存在未授权的修改和删除",
      "可能影响多家下游制剂企业"
    ],
    impact_areas: ["药品供应链", "GMP合规"],
    product_types: ["药品"],
    therapeutic_areas: ["通用"],
    tags: ["警告信", "cGMP", "原料药", "数据完整性"],
    background: "FDA 于 2026 年 4 月对该工厂进行了突击检查，检查结果于 6 月通过警告信形式公布。"
  },

  // ==================== 欧盟 EMA ====================
  {
    title_original: "EMA CHMP Recommends Approval of First CRISPR-Based Therapy for Beta-Thalassemia",
    title_cn: "EMA CHMP 建议批准首个 CRISPR 基因编辑疗法用于治疗β-地中海贫血",
    summary_cn: "EMA 人用药品委员会 (CHMP) 建议批准首个基于 CRISPR/Cas9 基因编辑技术的疗法，用于治疗输血依赖性β-地中海贫血。该疗法通过编辑患者自体造血干细胞中的 BCL11A 基因来恢复胎儿血红蛋白的产生。",
    summary_en: "EMA CHMP recommended approval of the first CRISPR/Cas9-based gene-editing therapy for transfusion-dependent beta-thalassemia, targeting the BCL11A gene to restore fetal hemoglobin production.",
    published_date: "2026-06-27",
    country: "EU",
    region: "欧洲",
    organization: "EMA - 欧洲药品管理局",
    organization_en: "European Medicines Agency",
    category: "审批类",
    subcategory: "approvals",
    importance_level: 5,
    importance_reason: "首个 CRISPR 基因编辑疗法在欧盟获批，具有里程碑意义",
    key_points: [
      "全球首个基于 CRISPR/Cas9 的基因编辑疗法",
      "一次性输注，编辑自体造血干细胞",
      "临床试验显示 91% 患者实现输血独立",
      "为其他遗传性血液病开辟了治疗路径"
    ],
    impact_areas: ["基因治疗", "罕见病"],
    product_types: ["生物制品"],
    therapeutic_areas: ["血液", "罕见病"],
    tags: ["CRISPR", "基因编辑", "β-地中海贫血", "先进疗法"],
    background: "β-地中海贫血是一种遗传性血液病，全球约有 8 万例重症患者。现有治疗主要依赖定期输血和铁螯合治疗，但无法根治。"
  },
  {
    title_original: "EMA Launches Pilot Program for Real-World Evidence in Regulatory Decision-Making",
    title_cn: "EMA 启动真实世界证据用于监管决策的试点项目",
    summary_cn: "EMA 宣布启动一项为期 18 个月的试点项目，探索将真实世界证据 (RWE) 系统性地纳入药品监管决策流程。项目将涵盖上市后安全性监测、适应症扩展和罕见病药品评估等领域。",
    summary_en: "EMA launched an 18-month pilot program to systematically incorporate Real-World Evidence (RWE) into regulatory decision-making, covering post-market safety, indication expansion, and orphan drug assessment.",
    published_date: "2026-06-18",
    country: "EU",
    region: "欧洲",
    organization: "EMA - 欧洲药品管理局",
    organization_en: "European Medicines Agency",
    category: "法规指南类",
    subcategory: "policy",
    importance_level: 4,
    importance_reason: "RWE 监管框架的重要进展，影响未来药品审批和监管方式",
    key_points: [
      "18 个月试点，涵盖药品全生命周期",
      "建立 RWE 数据质量标准和方法学指南",
      "首批参与项目包括 5 个已上市药品",
      "与 DARWIN EU 数据网络协同推进"
    ],
    impact_areas: ["药品监管", "数据科学"],
    product_types: ["药品"],
    therapeutic_areas: ["通用"],
    tags: ["RWE", "真实世界证据", "监管创新", "DARWIN EU"],
    background: "DARWIN EU (Data Analysis and Real World Interrogation Network) 是 EMA 建立的欧洲真实世界数据网络，连接 20 多个欧洲国家的医疗数据库。"
  },
  {
    title_original: "PRAC Recommends New Safety Measures for JAK Inhibitors",
    title_cn: "PRAC 建议对 JAK 抑制剂实施新的安全措施",
    summary_cn: "EMA 药物警戒风险评估委员会 (PRAC) 完成对 JAK 抑制剂类药物的安全性审查，建议新增心血管和恶性肿瘤风险的黑框警告，并限制老年高危人群的使用。该建议将影响所有已获批的 JAK 抑制剂产品。",
    summary_en: "EMA PRAC completed a safety review of JAK inhibitors, recommending new black box warnings for cardiovascular and malignancy risks and restricting use in elderly high-risk populations.",
    published_date: "2026-06-15",
    country: "EU",
    region: "欧洲",
    organization: "EMA - 欧洲药品管理局",
    organization_en: "European Medicines Agency",
    category: "安全类",
    subcategory: "safety",
    importance_level: 5,
    importance_reason: "影响多款畅销药物的重大安全决定",
    key_points: [
      "新增心血管事件和恶性肿瘤的黑框警告",
      "建议 65 岁以上吸烟者避免使用",
      "影响类风湿关节炎、银屑病关节炎等多个适应症",
      "基于大型上市后安全性研究 (ORAL Surveillance)"
    ],
    impact_areas: ["患者安全", "处方指南"],
    product_types: ["药品"],
    therapeutic_areas: ["免疫", "心血管"],
    tags: ["JAK抑制剂", "安全审查", "黑框警告", "PRAC"],
    background: "JAK 抑制剂是治疗多种自身免疫性疾病的重要药物类别，全球年销售额超过 200 亿美元。ORAL Surveillance 研究显示，与 TNF 抑制剂相比，JAK 抑制剂与增加的心血管和恶性肿瘤风险相关。"
  },

  // ==================== 中国 NMPA ====================
  {
    title_original: "国家药监局关于发布《药品生产质量管理规范（修订版）》的公告",
    title_cn: "国家药监局发布《药品生产质量管理规范（修订版）》",
    summary_cn: "国家药品监督管理局正式发布《药品生产质量管理规范（2026年修订版）》，全面对接 ICH Q10 制药质量体系要求，新增质量风险管理、数据完整性管理和供应链追溯等章节，将于 2027 年 1 月 1 日起施行。",
    summary_en: "NMPA released the revised Good Manufacturing Practice (GMP) regulations, fully aligning with ICH Q10 requirements and adding new chapters on quality risk management, data integrity, and supply chain traceability.",
    published_date: "2026-06-30",
    country: "CN",
    region: "亚洲",
    organization: "NMPA - 国家药品监督管理局",
    organization_en: "National Medical Products Administration",
    category: "法规指南类",
    subcategory: "regulations",
    importance_level: 5,
    importance_reason: "中国 GMP 重大修订，影响所有境内药品生产企业",
    key_points: [
      "全面对接 ICH Q10 制药质量体系",
      "新增数据完整性管理专章",
      "强化供应链追溯和供应商管理要求",
      "2027 年 1 月 1 日生效，给予 6 个月过渡期"
    ],
    impact_areas: ["药品生产", "质量管理"],
    product_types: ["药品", "原料药"],
    therapeutic_areas: ["通用"],
    tags: ["GMP", "质量管理", "ICH Q10", "法规修订"],
    background: "中国于 2017 年加入 ICH，此次 GMP 修订是全面对接国际标准的又一重要步骤。"
  },
  {
    title_original: "CDE发布《细胞和基因治疗产品非临床研究技术指导原则》",
    title_cn: "CDE 发布《细胞和基因治疗产品非临床研究技术指导原则》",
    summary_cn: "国家药品监督管理局药品审评中心 (CDE) 发布《细胞和基因治疗产品非临床研究技术指导原则》，系统规定了 CGT 产品在药理学、药代动力学和毒理学研究方面的技术要求，填补了国内 CGT 非临床评价的指南空白。",
    summary_en: "CDE issued technical guidelines for non-clinical studies of cell and gene therapy products, establishing requirements for pharmacology, pharmacokinetics, and toxicology studies for CGT products.",
    published_date: "2026-06-26",
    country: "CN",
    region: "亚洲",
    organization: "CDE - 药品审评中心",
    organization_en: "Center for Drug Evaluation",
    category: "法规指南类",
    subcategory: "guidance",
    importance_level: 5,
    importance_reason: "填补 CGT 非临床评价指南空白，对行业影响重大",
    key_points: [
      "适用于 CAR-T、TCR-T、干细胞治疗等产品",
      "明确了动物模型选择的原则和要求",
      "对基因编辑产品的脱靶分析提出具体要求",
      "建立了非临床到临床的转化桥接策略"
    ],
    impact_areas: ["CGT研发", "非临床研究"],
    product_types: ["生物制品", "药品"],
    therapeutic_areas: ["肿瘤", "罕见病"],
    tags: ["细胞治疗", "基因治疗", "非临床", "CGT"],
    background: "中国是全球 CGT 临床试验最活跃的市场之一，此次指南的发布将有力推动行业规范发展。"
  },
  {
    title_original: "国家药监局附条件批准国产PD-1/VEGF双特异性抗体上市",
    title_cn: "NMPA 附条件批准国产 PD-1/VEGF 双特异性抗体上市",
    summary_cn: "国家药品监督管理局通过优先审评审批程序，附条件批准了一款国产 PD-1/VEGF 双特异性抗体注射液上市，用于治疗既往接受过系统性治疗的晚期非小细胞肺癌患者。这是全球首个获批的 PD-1/VEGF 双抗产品。",
    summary_en: "NMPA granted conditional approval to a domestic PD-1/VEGF bispecific antibody for advanced NSCLC, marking the first approved PD-1/VEGF bispecific globally.",
    published_date: "2026-06-23",
    country: "CN",
    region: "亚洲",
    organization: "NMPA - 国家药品监督管理局",
    organization_en: "National Medical Products Administration",
    category: "审批类",
    subcategory: "approvals",
    importance_level: 5,
    importance_reason: "全球首个 PD-1/VEGF 双抗获批，中国创新药里程碑",
    key_points: [
      "全球首个获批的 PD-1/VEGF 双特异性抗体",
      "单药治疗晚期 NSCLC 的 ORR 达 42%",
      "通过优先审评审批程序加速获批",
      "需要完成 III 期确证性临床试验"
    ],
    impact_areas: ["肿瘤治疗", "创新药研发"],
    product_types: ["生物制品"],
    therapeutic_areas: ["肿瘤"],
    tags: ["双特异性抗体", "PD-1", "VEGF", "NSCLC"],
    background: "PD-1/VEGF 双特异性抗体是新一代肿瘤免疫治疗药物，通过同时阻断 PD-1 免疫检查点和 VEGF 血管生成通路，实现协同抗肿瘤效应。"
  },

  // ==================== 日本 PMDA ====================
  {
    title_original: "PMDA Introduces Digital Transformation Strategy for Drug Review Process",
    title_cn: "PMDA 推出药品审评流程数字化转型战略",
    summary_cn: "日本 PMDA 发布了《药品审评数字化转型战略 2026-2030》，计划全面推行电子申报 (eCTD 4.0)、AI 辅助审评和云协作平台，目标将新药审评周期缩短 30%。",
    summary_en: "PMDA released its Digital Transformation Strategy 2026-2030, planning full implementation of eCTD 4.0, AI-assisted review, and cloud collaboration platforms to reduce drug review timelines by 30%.",
    published_date: "2026-06-21",
    country: "JP",
    region: "亚洲",
    organization: "PMDA - 医药品医疗器械综合机构",
    organization_en: "Pharmaceuticals and Medical Devices Agency",
    category: "新闻动态类",
    subcategory: "policy",
    importance_level: 3,
    importance_reason: "影响日本药品审评效率，对中日药企均有影响",
    key_points: [
      "2027 年全面推行 eCTD 4.0 格式",
      "引入 AI 辅助审评提高一致性",
      "建立跨国监管机构云协作平台",
      "目标：新药审评周期缩短至 9 个月"
    ],
    impact_areas: ["药品审评", "数字化"],
    product_types: ["药品", "医疗器械"],
    therapeutic_areas: ["通用"],
    tags: ["数字化", "eCTD", "AI审评", "PMDA"],
    background: "PMDA 近年持续推动审评流程现代化，此次战略是在 2023-2025 试点基础上的全面推广。"
  },

  // ==================== 韩国 MFDS ====================
  {
    title_original: "MFDS Strengthens Regulation on Medical Device Cybersecurity",
    title_cn: "韩国 MFDS 加强医疗器械网络安全监管要求",
    summary_cn: "韩国食品药品安全部 (MFDS) 发布修订版《医疗器械网络安全指南》，要求所有具有网络连接功能的医疗器械在注册审批时提交网络安全风险管理文件，该要求自 2026 年 9 月起强制执行。",
    summary_en: "MFDS released revised Medical Device Cybersecurity Guidelines requiring cybersecurity risk management documentation for all network-connected medical devices, mandatory from September 2026.",
    published_date: "2026-06-19",
    country: "KR",
    region: "亚洲",
    organization: "MFDS - 食品药品安全部",
    organization_en: "Ministry of Food and Drug Safety",
    category: "法规指南类",
    subcategory: "guidance",
    importance_level: 4,
    importance_reason: "医疗器械网络安全监管趋严，影响所有联网器械注册",
    key_points: [
      "适用于所有具有网络连接功能的医疗器械",
      "要求提交网络安全风险管理文件",
      "包括上市后漏洞监控和补丁管理计划",
      "2026 年 9 月 1 日起强制执行"
    ],
    impact_areas: ["医疗器械注册", "网络安全"],
    product_types: ["医疗器械"],
    therapeutic_areas: ["通用"],
    tags: ["网络安全", "医疗器械", "MFDS", "注册要求"],
    background: "随着联网医疗器械的普及，网络安全已成为全球监管热点。韩国此次修订对标 FDA 和 IMDRF 的国际标准。"
  },

  // ==================== 英国 MHRA ====================
  {
    title_original: "MHRA Launches Innovative Licensing and Access Pathway (ILAP) for Advanced Therapies",
    title_cn: "MHRA 推出先进疗法创新许可和准入路径 (ILAP)",
    summary_cn: "英国 MHRA 宣布推出针对先进治疗药品 (ATMPs) 的创新许可和准入路径，为基因治疗、细胞治疗和组织工程产品提供加速审评、滚动提交和早期对话等灵活机制。",
    summary_en: "MHRA launched the Innovative Licensing and Access Pathway (ILAP) for Advanced Therapy Medicinal Products, offering accelerated review, rolling submission, and early dialogue mechanisms.",
    published_date: "2026-06-17",
    country: "UK",
    region: "欧洲",
    organization: "MHRA - 英国药品和保健品监管局",
    organization_en: "Medicines and Healthcare products Regulatory Agency",
    category: "法规指南类",
    subcategory: "policy",
    importance_level: 4,
    importance_reason: "英国脱欧后创新监管路径的重要发展",
    key_points: [
      "专门针对先进治疗药品 (ATMPs) 的加速路径",
      "提供滚动提交和实时审评机制",
      "包含 NICE 早期科学建议",
      "首个项目预计 2026 年 Q4 启动"
    ],
    impact_areas: ["创新药准入", "先进疗法"],
    product_types: ["生物制品"],
    therapeutic_areas: ["通用"],
    tags: ["ILAP", "ATMP", "创新许可", "MHRA"],
    background: "自脱欧后，英国 MHRA 致力于建立独立的创新药品审评体系，ILAP 是继 2021 年 ILAP 试点后的重大升级。"
  },

  // ==================== 澳大利亚 TGA ====================
  {
    title_original: "TGA Publishes Guidance on Software as a Medical Device (SaMD) Classification",
    title_cn: "TGA 发布医疗器械软件 (SaMD) 分类指南",
    summary_cn: "澳大利亚 TGA 发布更新的《医疗器械软件分类指南》，明确了基于人工智能的医疗器械软件的分类原则和监管要求。高风险 AI SaMD（如用于诊断决策支持）将被归类为 Class III 医疗器械。",
    summary_en: "TGA published updated SaMD classification guidance clarifying AI-based medical device software classification, with high-risk AI SaMD classified as Class III.",
    published_date: "2026-06-14",
    country: "AU",
    region: "大洋洲",
    organization: "TGA - 澳大利亚药品管理局",
    organization_en: "Therapeutic Goods Administration",
    category: "法规指南类",
    subcategory: "guidance",
    importance_level: 3,
    importance_reason: "AI SaMD 监管框架的重要更新",
    key_points: [
      "明确了 AI/ML 医疗软件的分类标准",
      "高风险诊断决策支持软件为 Class III",
      "要求提供 AI 模型变更管理计划",
      "对标 IMDRF SaMD 分类框架"
    ],
    impact_areas: ["数字健康", "医疗器械监管"],
    product_types: ["医疗器械"],
    therapeutic_areas: ["通用"],
    tags: ["SaMD", "AI", "软件分类", "TGA"],
    background: "随着数字健康产品的快速增长，各国监管机构都在更新 SaMD 监管框架。TGA 此次更新对标 IMDRF 国际指南。"
  },

  // ==================== 加拿大 Health Canada ====================
  {
    title_original: "Health Canada Modernizes Clinical Trial Regulations to Align with ICH E6(R3)",
    title_cn: "加拿大卫生部更新临床试验法规，对标 ICH E6(R3)",
    summary_cn: "加拿大卫生部发布临床试验法规修正案，全面采纳 ICH E6(R3)《药物临床试验质量管理规范》指南，引入基于风险的监查方法、电子健康记录使用和去中心化临床试验等现代化元素。",
    summary_en: "Health Canada published amendments to clinical trial regulations adopting ICH E6(R3) GCP guidelines, introducing risk-based monitoring, EHR usage, and decentralized clinical trials.",
    published_date: "2026-06-12",
    country: "CA",
    region: "北美",
    organization: "Health Canada - 加拿大卫生部",
    organization_en: "Health Canada",
    category: "法规指南类",
    subcategory: "regulations",
    importance_level: 4,
    importance_reason: "临床试验法规现代化，影响所有在加拿大进行的临床试验",
    key_points: [
      "全面采纳 ICH E6(R3) GCP 指南",
      "正式认可去中心化临床试验 (DCT)",
      "引入基于风险的监查 (RBM) 方法",
      "允许使用真实世界数据支持试验设计"
    ],
    impact_areas: ["临床试验", "药品研发"],
    product_types: ["药品", "生物制品"],
    therapeutic_areas: ["通用"],
    tags: ["临床试验", "ICH E6", "DCT", "GCP"],
    background: "ICH E6(R3) 是临床试验质量管理规范的最新版本，强调了与现代化临床试验设计的适配性。"
  },

  // ==================== 瑞士 Swissmedic ====================
  {
    title_original: "Swissmedic and FDA Sign Mutual Recognition Agreement for GMP Inspections",
    title_cn: "Swissmedic 与 FDA 签署 GMP 检查互认协议",
    summary_cn: "瑞士药品监管局 (Swissmedic) 与美国 FDA 签署了药品 GMP 检查互认协议 (MRA)，双方将相互认可对方的 GMP 检查结果，减少重复检查。该协议涵盖药品、原料药和生物制品生产设施。",
    summary_en: "Swissmedic and FDA signed a Mutual Recognition Agreement for pharmaceutical GMP inspections, mutually recognizing inspection results to reduce duplicate inspections.",
    published_date: "2026-06-10",
    country: "CH",
    region: "欧洲",
    organization: "Swissmedic - 瑞士药品监管局",
    organization_en: "Swiss Agency for Therapeutic Products",
    category: "新闻动态类",
    subcategory: "international",
    importance_level: 3,
    importance_reason: "促进瑞士-美国药品贸易便利化",
    key_points: [
      "相互认可 GMP 检查结果",
      "涵盖药品、原料药和生物制品",
      "减少重复检查，节约监管资源",
      "与 FDA-MRA 全球网络对接"
    ],
    impact_areas: ["GMP检查", "国际贸易"],
    product_types: ["药品", "原料药", "生物制品"],
    therapeutic_areas: ["通用"],
    tags: ["MRA", "GMP", "Swissmedic", "FDA"],
    background: "FDA 已与欧盟、日本、韩国等多个国家和地区签署 GMP 互认协议，瑞士的加入进一步扩大了互认网络。"
  },

  // ==================== WHO ====================
  {
    title_original: "WHO Updates Model List of Essential Medicines, Adds Novel Diabetes and Cancer Treatments",
    title_cn: "WHO 更新基本药物示范目录，新增糖尿病和癌症治疗药物",
    summary_cn: "世界卫生组织发布 2026 年版《基本药物示范目录》，新增 12 种药物，包括 GLP-1 受体激动剂（用于糖尿病和肥胖管理）和新型靶向抗癌药。这是 WHO 首次将 GLP-1 类药物纳入基本药物目录。",
    summary_en: "WHO published the 2026 Model List of Essential Medicines, adding 12 new medicines including GLP-1 receptor agonists and targeted cancer therapies.",
    published_date: "2026-06-29",
    country: "INTL",
    region: "国际",
    organization: "WHO - 世界卫生组织",
    organization_en: "World Health Organization",
    category: "标准类",
    subcategory: "standards",
    importance_level: 4,
    importance_reason: "WHO 基本药物目录影响全球公共药品采购和医保政策",
    key_points: [
      "新增 12 种药物，移除 3 种过时药物",
      "首次纳入 GLP-1 受体激动剂",
      "新增 2 种 PD-1/PD-L1 免疫检查点抑制剂",
      "成人和儿童目录同步更新"
    ],
    impact_areas: ["全球公共卫生", "药品可及性"],
    product_types: ["药品"],
    therapeutic_areas: ["内分泌", "肿瘤"],
    tags: ["基本药物", "WHO", "GLP-1", "免疫治疗"],
    background: "WHO 基本药物示范目录每两年更新一次，是全球各国制定国家基本药物目录的重要参考。"
  },
  {
    title_original: "WHO Prequalifies First Biosimilar Insulin for Global Distribution",
    title_cn: "WHO 预认证首个生物类似胰岛素产品，面向全球分发",
    summary_cn: "WHO 宣布首次通过预认证 (Prequalification) 的生物类似胰岛素产品，这将显著降低中低收入国家的胰岛素采购成本。该产品由一家印度生物制药企业生产，价格仅为原研产品的 30%。",
    summary_en: "WHO announced prequalification of the first biosimilar insulin product, significantly reducing insulin procurement costs for low and middle-income countries.",
    published_date: "2026-06-16",
    country: "INTL",
    region: "国际",
    organization: "WHO - 世界卫生组织",
    organization_en: "World Health Organization",
    category: "审批类",
    subcategory: "prequalification",
    importance_level: 4,
    importance_reason: "提升全球胰岛素可及性的重要里程碑",
    key_points: [
      "首个通过 WHO 预认证的生物类似胰岛素",
      "价格仅为原研产品的 30%",
      "适用于 1 型和 2 型糖尿病治疗",
      "将通过联合国采购系统分发"
    ],
    impact_areas: ["全球健康", "药品可及性"],
    product_types: ["生物制品"],
    therapeutic_areas: ["内分泌"],
    tags: ["预认证", "胰岛素", "生物类似药", "可及性"],
    background: "全球约有 5.4 亿糖尿病患者，其中许多中低收入国家的患者无法获得或负担胰岛素。WHO 预认证旨在解决这一问题。"
  },

  // ==================== ICH ====================
  {
    title_original: "ICH Finalizes Q14 Guideline on Analytical Procedure Development",
    title_cn: "ICH 发布 Q14《分析方法开发》最终指南",
    summary_cn: "国际人用药品注册技术协调会 (ICH) 正式发布 Q14《分析方法开发》指南最终版，建立了基于科学和风险的分析方法开发框架，强调分析质量源于设计 (AQbD) 的理念和生命周期管理方法。",
    summary_en: "ICH finalized the Q14 guideline on Analytical Procedure Development, establishing a science and risk-based framework emphasizing Analytical Quality by Design (AQbD).",
    published_date: "2026-06-24",
    country: "INTL",
    region: "国际",
    organization: "ICH - 国际人用药品注册技术协调会",
    organization_en: "International Council for Harmonisation",
    category: "标准类",
    subcategory: "guidelines",
    importance_level: 5,
    importance_reason: "ICH Q14 将深刻影响全球药品质量控制的实践标准",
    key_points: [
      "建立分析质量源于设计 (AQbD) 的系统框架",
      "定义了分析方法生命周期管理的各阶段要求",
      "引入分析方法耐受区间 (ATP) 概念",
      "与 ICH Q2(R2) 验证指南协同使用"
    ],
    impact_areas: ["药品质量控制", "分析方法"],
    product_types: ["药品", "原料药"],
    therapeutic_areas: ["通用"],
    tags: ["ICH Q14", "分析方法", "AQbD", "质量控制"],
    background: "ICH Q14 是 ICH 质量指南系列的重要组成部分，与 Q2(R2)《分析方法验证》指南共同构成了现代药品分析方法的科学基础。"
  },

  // ==================== IMDRF ====================
  {
    title_original: "IMDRF Publishes Final Guidance on Personalized Medical Devices",
    title_cn: "IMDRF 发布个性化医疗器械最终指南",
    summary_cn: "国际医疗器械监管者论坛 (IMDRF) 发布《个性化医疗器械》最终指南，为 3D 打印植入物、定制手术导板等个性化医疗器械的监管要求提供了国际协调框架。",
    summary_en: "IMDRF published final guidance on Personalized Medical Devices, providing a harmonized regulatory framework for 3D-printed implants, custom surgical guides, and other personalized devices.",
    published_date: "2026-06-08",
    country: "INTL",
    region: "国际",
    organization: "IMDRF - 国际医疗器械监管者论坛",
    organization_en: "International Medical Device Regulators Forum",
    category: "法规指南类",
    subcategory: "guidance",
    importance_level: 4,
    importance_reason: "为个性化医疗器械监管提供首个国际协调标准",
    key_points: [
      "明确定义了个性化医疗器械的分类和范围",
      "建立了基于风险的分级监管框架",
      "对 3D 打印生产设施提出 GMP 要求",
      "各国监管机构将据此制定国内法规"
    ],
    impact_areas: ["医疗器械监管", "3D打印"],
    product_types: ["医疗器械"],
    therapeutic_areas: ["通用"],
    tags: ["个性化医疗", "3D打印", "IMDRF", "监管协调"],
    background: "3D 打印技术在医疗器械领域的应用快速增长，但此前缺乏国际统一的监管标准。IMDRF 指南填补了这一空白。"
  },

  // ==================== RAPS ====================
  {
    title_original: "RAPS Report: Global Regulatory Convergence Trends in 2026",
    title_cn: "RAPS 发布《2026 全球监管趋同趋势报告》",
    summary_cn: "监管事务专业协会 (RAPS) 发布年度全球监管趋同趋势报告，指出 ICH 指南采纳率创历史新高，亚太地区监管能力建设显著加速，但各国在先进疗法监管路径上仍存在显著差异。",
    summary_en: "RAPS published its annual Global Regulatory Convergence Trends report, noting record ICH guideline adoption rates and significant acceleration in Asia-Pacific regulatory capacity building.",
    published_date: "2026-06-05",
    country: "INTL",
    region: "国际",
    organization: "RAPS - 监管事务专业协会",
    organization_en: "Regulatory Affairs Professionals Society",
    category: "出版物",
    subcategory: "reports",
    importance_level: 2,
    importance_reason: "行业参考价值的年度趋势报告",
    key_points: [
      "ICH 指南全球采纳率超过 85%",
      "亚太地区新增 3 个监管机构加入 PIC/S",
      "先进疗法 (CGT) 监管路径全球差异仍大",
      "AI 在监管中的应用成为新热点"
    ],
    impact_areas: ["监管政策", "行业发展"],
    product_types: ["药品", "医疗器械", "生物制品"],
    therapeutic_areas: ["通用"],
    tags: ["RAPS", "监管趋同", "年度报告", "趋势"],
    background: "RAPS 是全球最大的监管事务专业组织，其年度趋势报告是行业的重要参考。"
  },

  // ==================== 更多多样化数据 ====================
  {
    title_original: "NMPA 关于修订《医疗器械监督管理条例》配套规章征求意见的通知",
    title_cn: "NMPA 就《医疗器械监督管理条例》配套规章修订公开征求意见",
    summary_cn: "国家药品监督管理局就《医疗器械监督管理条例》的三项配套规章修订草案公开征求意见，涉及医疗器械注册管理、生产管理和经营质量管理规范，意见征集截止日期为 2026 年 8 月 31 日。",
    summary_en: "NMPA opened public consultation on three supporting regulations for the Medical Device Supervision and Administration Regulation.",
    published_date: "2026-07-01",
    effective_date: null,
    deadline_date: "2026-08-31",
    country: "CN",
    region: "亚洲",
    organization: "NMPA - 国家药品监督管理局",
    organization_en: "National Medical Products Administration",
    category: "法规指南类",
    subcategory: "consultation",
    importance_level: 4,
    importance_reason: "医疗器械法规体系重大更新，征求意见阶段需密切关注",
    key_points: [
      "涉及注册管理、生产管理、经营管理三项规章",
      "引入医疗器械注册人制度全面实施要求",
      "强化上市后监管和不良事件监测",
      "意见征集截止至 2026 年 8 月 31 日"
    ],
    impact_areas: ["医疗器械监管", "企业合规"],
    product_types: ["医疗器械", "体外诊断"],
    therapeutic_areas: ["通用"],
    tags: ["征求意见", "医疗器械", "注册人制度", "NMPA"],
    background: "《医疗器械监督管理条例》2021 年修订后，配套规章需要同步更新以落实条例要求。"
  },
  {
    title_original: "EMA and ECDC Issue Joint Guidance on Pandemic Preparedness for Medical Products",
    title_cn: "EMA 和 ECDC 发布医疗产品大流行防范联合指南",
    summary_cn: "EMA 与欧洲疾病预防控制中心 (ECDC) 联合发布《医疗产品大流行防范指南》，总结 COVID-19 大流行期间的经验教训，为未来的公共卫生紧急事件中的药品和疫苗快速开发、审批和分发提供路线图。",
    summary_en: "EMA and ECDC issued joint guidance on pandemic preparedness for medical products, providing a roadmap for rapid drug and vaccine development during public health emergencies.",
    published_date: "2026-06-13",
    country: "EU",
    region: "欧洲",
    organization: "EMA - 欧洲药品管理局",
    organization_en: "European Medicines Agency",
    category: "法规指南类",
    subcategory: "guidance",
    importance_level: 4,
    importance_reason: "大流行防范的重要政策文件",
    key_points: [
      "建立紧急使用授权 (EUA) 标准化流程",
      "明确大流行期间的 GMP 灵活性安排",
      "建立欧盟级关键药品储备机制",
      "加强国际监管协作和快速信息共享"
    ],
    impact_areas: ["公共卫生", "应急准备"],
    product_types: ["药品", "疫苗", "生物制品"],
    therapeutic_areas: ["感染"],
    tags: ["大流行防范", "EMA", "ECDC", "应急审批"],
    background: "COVID-19 大流行暴露了全球医疗产品供应链的脆弱性，该指南旨在为未来大流行做好准备。"
  },
  {
    title_original: "FDA Accelerated Approval Pathway Under Review: Balancing Speed and Evidence",
    title_cn: "FDA 加速批准路径面临审查：平衡速度与证据",
    summary_cn: "美国国会和 FDA 联合审查加速批准路径的使用情况，此前多款通过加速批准上市的药品未能在规定时间内完成确证性临床试验。FDA 将加强确证性试验的跟踪和执法力度。",
    summary_en: "U.S. Congress and FDA are reviewing the accelerated approval pathway as several drugs approved via this route failed to complete confirmatory trials on time.",
    published_date: "2026-06-01",
    country: "US",
    region: "北美",
    organization: "FDA - 美国食品药品监督管理局",
    organization_en: "U.S. Food and Drug Administration",
    category: "新闻动态类",
    subcategory: "policy",
    importance_level: 3,
    importance_reason: "可能影响未来加速批准政策的走向",
    key_points: [
      "多款加速批准药品确证性试验延期或失败",
      "FDA 拟加强确证性试验的时间要求",
      "考虑建立加速批准退出机制",
      "2026 年 Q3 将发布改革方案草案"
    ],
    impact_areas: ["药品审批", "监管政策"],
    product_types: ["药品", "生物制品"],
    therapeutic_areas: ["肿瘤", "罕见病"],
    tags: ["加速批准", "确证性试验", "FDA", "监管改革"],
    background: "加速批准路径允许基于替代终点批准药品，但要求上市后完成确证性临床试验。近年来，部分产品未能按时完成，引发对该路径的审视。"
  },
  {
    title_original: "MHRA Designates First 'Innovation Passport' for AI Diagnostic Device",
    title_cn: "MHRA 为首个 AI 诊断器械授予'创新护照'",
    summary_cn: "英国 MHRA 首次向一款基于人工智能的病理学诊断设备颁发'创新护照'（Innovation Passport），该设备利用深度学习算法辅助病理医生检测和分级前列腺癌组织切片，诊断准确率达到 98.5%。",
    summary_en: "MHRA awarded its first Innovation Passport to an AI-based pathology diagnostic device that uses deep learning to detect and grade prostate cancer tissue with 98.5% accuracy.",
    published_date: "2026-05-28",
    country: "UK",
    region: "欧洲",
    organization: "MHRA - 英国药品和保健品监管局",
    organization_en: "Medicines and Healthcare products Regulatory Agency",
    category: "审批类",
    subcategory: "designation",
    importance_level: 3,
    importance_reason: "AI 诊断器械监管创新的标志性案例",
    key_points: [
      "首个获得 MHRA 创新护照的 AI 诊断器械",
      "前列腺癌诊断准确率达 98.5%",
      "将享受加速审评和专属科学建议",
      "标志着英国 AI 医疗器械监管进入新阶段"
    ],
    impact_areas: ["AI诊断", "病理学"],
    product_types: ["医疗器械"],
    therapeutic_areas: ["肿瘤"],
    tags: ["创新护照", "AI诊断", "病理", "MHRA"],
    background: "MHRA 创新护照是英国脱欧后建立的创新药品和器械加速审评机制，旨在吸引全球创新产品在英国率先上市。"
  },
  {
    title_original: "CDE 关于公开征求《抗体药物偶联物（ADC）非临床研究技术指导原则》意见的通知",
    title_cn: "CDE 就《抗体药物偶联物 (ADC) 非临床研究技术指导原则》征求意见",
    summary_cn: "药品审评中心公开征求《抗体药物偶联物 (ADC) 非临床研究技术指导原则》意见，对 ADC 产品的药理学、药代动力学、毒理学和免疫原性研究提出了系统性技术要求。",
    summary_en: "CDE opened public consultation on technical guidelines for non-clinical studies of Antibody-Drug Conjugates (ADCs), covering pharmacology, pharmacokinetics, toxicology, and immunogenicity.",
    published_date: "2026-06-07",
    deadline_date: "2026-07-31",
    country: "CN",
    region: "亚洲",
    organization: "CDE - 药品审评中心",
    organization_en: "Center for Drug Evaluation",
    category: "法规指南类",
    subcategory: "consultation",
    importance_level: 4,
    importance_reason: "ADC 是中国创新药研发的热门领域，该指南影响深远",
    key_points: [
      "针对 ADC 的特殊结构提出非临床研究要求",
      "明确了 payload、linker 和抗体的独立评价要求",
      "对旁观者效应和脱靶毒性提出评估方法",
      "适用于新 ADC 和生物类似 ADC 的开发"
    ],
    impact_areas: ["ADC研发", "非临床研究"],
    product_types: ["生物制品"],
    therapeutic_areas: ["肿瘤"],
    tags: ["ADC", "抗体药物偶联物", "非临床", "CDE"],
    background: "中国已成为全球 ADC 研发最活跃的市场之一，在研 ADC 管线数量位居全球前列。"
  },
  {
    title_original: "TGA Issues Alert on Counterfeit Medical Devices in Australian Market",
    title_cn: "TGA 发布澳大利亚市场假冒医疗器械警报",
    summary_cn: "澳大利亚 TGA 发布消费者和医疗机构警报，一批假冒的血糖监测设备和检测试纸被发现进入澳大利亚市场。这些假冒产品未经 TGA 评估，可能提供不准确的血糖读数，对糖尿病患者构成严重健康风险。",
    summary_en: "TGA issued an alert after counterfeit blood glucose monitoring devices and test strips were found in the Australian market, posing serious health risks to diabetic patients.",
    published_date: "2026-06-03",
    country: "AU",
    region: "大洋洲",
    organization: "TGA - 澳大利亚药品管理局",
    organization_en: "Therapeutic Goods Administration",
    category: "安全类",
    subcategory: "alerts",
    importance_level: 5,
    importance_reason: "假冒医疗器械可能直接危及患者生命安全",
    key_points: [
      "涉及特定品牌的血糖监测设备和试纸",
      "假冒产品未经任何质量评估和校准",
      "可能导致错误的胰岛素给药决策",
      "TGA 正在与海关合作拦截进口假冒产品"
    ],
    impact_areas: ["患者安全", "医疗器械监管"],
    product_types: ["医疗器械", "体外诊断"],
    therapeutic_areas: ["内分泌"],
    tags: ["假冒器械", "血糖监测", "安全警报", "TGA"],
    background: "假冒医疗器械是全球性问题，近年来随着在线销售的增加而日益严重。"
  },
  {
    title_original: "Swissmedic Approves First Digital Therapeutic for Depression Treatment",
    title_cn: "Swissmedic 批准首个抑郁症数字疗法产品",
    summary_cn: "瑞士药品监管局批准了首个用于治疗轻度至中度抑郁症的处方数字疗法 (DTx) 产品。该产品是一款基于认知行为疗法 (CBT) 的智能手机应用，临床试验显示与标准心理治疗相比非劣效。",
    summary_en: "Swissmedic approved the first prescription digital therapeutic (DTx) for mild-to-moderate depression, a CBT-based smartphone app showing non-inferiority to standard psychotherapy.",
    published_date: "2026-05-25",
    country: "CH",
    region: "欧洲",
    organization: "Swissmedic - 瑞士药品监管局",
    organization_en: "Swiss Agency for Therapeutic Products",
    category: "审批类",
    subcategory: "approvals",
    importance_level: 3,
    importance_reason: "数字疗法审批的标志性案例，预示监管新趋势",
    key_points: [
      "瑞士首个获批的处方数字疗法产品",
      "基于认知行为疗法 (CBT)",
      "适用于轻度至中度抑郁症",
      "可单独使用或与药物治疗联合"
    ],
    impact_areas: ["数字健康", "精神健康"],
    product_types: ["医疗器械"],
    therapeutic_areas: ["神经系统"],
    tags: ["数字疗法", "DTx", "抑郁症", "Swissmedic"],
    background: "数字疗法 (Digital Therapeutics) 是近年来的新兴领域，全球 DTx 市场预计到 2030 年将达到 350 亿美元。"
  },
  {
    title_original: "Health Canada Recalls Multiple Hand Sanitizer Products Due to Undeclared Methanol",
    title_cn: "加拿大卫生部召回多款含未申报甲醇的洗手液产品",
    summary_cn: "加拿大卫生部扩大洗手液召回范围，新增 8 款产品因含有未申报的甲醇（工业酒精）而被召回。甲醇经皮肤吸收或误食可导致严重健康危害，包括失明和死亡。",
    summary_en: "Health Canada expanded hand sanitizer recalls to include 8 additional products containing undeclared methanol, which can cause severe health effects including blindness and death.",
    published_date: "2026-05-30",
    country: "CA",
    region: "北美",
    organization: "Health Canada - 加拿大卫生部",
    organization_en: "Health Canada",
    category: "安全类",
    subcategory: "recalls",
    importance_level: 5,
    importance_reason: "甲醇污染可能造成严重健康危害甚至死亡",
    key_points: [
      "8 款洗手液产品因甲醇污染被召回",
      "甲醇经皮肤吸收或误食可致失明和死亡",
      "所有产品均在线上平台销售",
      "消费者应立即停止使用并妥善处置"
    ],
    impact_areas: ["消费者安全", "市场监管"],
    product_types: ["保健品"],
    therapeutic_areas: ["通用"],
    tags: ["召回", "甲醇", "洗手液", "Health Canada"],
    background: "自 COVID-19 大流行以来，洗手液需求激增，不合格和假冒产品问题一直存在。"
  },
  {
    title_original: "PMDA and Singapore HSA Sign Collaboration Agreement on Cell Therapy Regulation",
    title_cn: "PMDA 与新加坡 HSA 签署细胞治疗监管合作协议",
    summary_cn: "日本 PMDA 与新加坡卫生科学局 (HSA) 签署了细胞和基因治疗产品监管合作协议，双方将共享审评经验、开展联合 GMP 检查，并探索审评结果的相互认可机制。",
    summary_en: "PMDA and Singapore HSA signed a collaboration agreement on cell and gene therapy regulation, including review experience sharing, joint GMP inspections, and mutual recognition of review outcomes.",
    published_date: "2026-05-22",
    country: "JP",
    region: "亚洲",
    organization: "PMDA - 医药品医疗器械综合机构",
    organization_en: "Pharmaceuticals and Medical Devices Agency",
    category: "新闻动态类",
    subcategory: "international",
    importance_level: 2,
    importance_reason: "亚洲监管协作的积极进展",
    key_points: [
      "建立定期审评经验交流机制",
      "开展联合 GMP 检查试点",
      "探索 CGT 产品审评结果互认",
      "促进两国 CGT 产品的市场准入"
    ],
    impact_areas: ["CGT监管", "国际合作"],
    product_types: ["生物制品"],
    therapeutic_areas: ["通用"],
    tags: ["PMDA", "HSA", "CGT", "监管合作"],
    background: "日本和新加坡都是亚太地区 CGT 监管能力建设的先行者。"
  },
  {
    title_original: "MFDS Approves First Korean-Developed mRNA Vaccine",
    title_cn: "韩国 MFDS 批准首个国产 mRNA 疫苗",
    summary_cn: "韩国食品药品安全部批准了首个由韩国企业自主研发的 mRNA 疫苗上市，用于预防季节性流感。该疫苗在 III 期临床试验中显示出与传统灭活疫苗相当的免疫原性和良好的安全性。",
    summary_en: "MFDS approved the first domestically developed mRNA vaccine in Korea for seasonal influenza prevention, showing comparable immunogenicity to traditional inactivated vaccines.",
    published_date: "2026-05-20",
    country: "KR",
    region: "亚洲",
    organization: "MFDS - 食品药品安全部",
    organization_en: "Ministry of Food and Drug Safety",
    category: "审批类",
    subcategory: "approvals",
    importance_level: 4,
    importance_reason: "韩国 mRNA 技术自主化的重要里程碑",
    key_points: [
      "韩国首个自主研发的 mRNA 疫苗获批",
      "用于季节性流感预防",
      "III 期试验显示免疫原性非劣效于灭活疫苗",
      "标志着韩国 mRNA 技术平台的成功建立"
    ],
    impact_areas: ["疫苗研发", "生物技术"],
    product_types: ["疫苗"],
    therapeutic_areas: ["感染"],
    tags: ["mRNA", "疫苗", "流感", "MFDS"],
    background: "COVID-19 大流行后，多国加大了 mRNA 技术平台的投入，韩国政府将其列为国家战略技术。"
  },
  {
    title_original: "ICH Assembly Approves New Topic on AI in Drug Development (Q15)",
    title_cn: "ICH 大会批准新议题：药品开发中的人工智能 (Q15)",
    summary_cn: "ICH 大会正式批准启动 Q15 新议题《药品开发中的人工智能》，将制定 AI/ML 在药物开发、生产和质量控制中应用的国际协调指南。该议题由 FDA 和 EMA 联合提议，预计 2029 年完成。",
    summary_en: "ICH Assembly approved a new topic Q15 on Artificial Intelligence in Drug Development, to develop harmonized guidelines for AI/ML application in drug development, manufacturing, and quality control.",
    published_date: "2026-06-06",
    country: "INTL",
    region: "国际",
    organization: "ICH - 国际人用药品注册技术协调会",
    organization_en: "International Council for Harmonisation",
    category: "标准类",
    subcategory: "guidelines",
    importance_level: 5,
    importance_reason: "ICH 首个 AI 专题指南，将设定全球标准",
    key_points: [
      "ICH 首个专门针对 AI/ML 的指南议题",
      "由 FDA 和 EMA 联合提议",
      "涵盖药物开发、生产和质控全流程",
      "预计 2029 年完成最终指南"
    ],
    impact_areas: ["AI技术", "药品开发"],
    product_types: ["药品", "生物制品"],
    therapeutic_areas: ["通用"],
    tags: ["ICH", "AI", "Q15", "药品开发"],
    background: "AI 在药物开发中的应用快速发展，但缺乏统一的国际监管标准。ICH Q15 将填补这一空白。"
  }
];

function generateHash(title, org) {
  return require('crypto').createHash('sha256')
    .update(`${title}${org}${Date.now()}${Math.random()}`)
    .digest('hex');
}

async function main() {
  console.log('============================================================');
  console.log('  种子数据生成工具');
  console.log('============================================================\n');

  const db = new DatabaseManager();
  await db.init();

  let inserted = 0;
  let skipped = 0;

  for (const event of SEED_EVENTS) {
    const hash = generateHash(event.title_original, event.organization);

    // 检查是否已存在
    const exists = db.checkDuplicate(hash);
    if (exists) {
      skipped++;
      continue;
    }

    const regulatoryEvent = {
      content_hash: hash,
      title_original: event.title_original,
      title_cn: event.title_cn,
      summary_cn: event.summary_cn,
      summary_en: event.summary_en,
      published_date: event.published_date,
      effective_date: event.effective_date || null,
      deadline_date: event.deadline_date || null,
      country: event.country,
      region: event.region,
      organization: event.organization,
      organization_en: event.organization_en,
      authors: [],
      stakeholders: [],
      background: event.background || '',
      key_points: event.key_points || [],
      full_content_extracted: '',
      category: event.category,
      subcategory: event.subcategory || '',
      importance_level: event.importance_level,
      importance_reason: event.importance_reason || '',
      impact_areas: event.impact_areas || [],
      product_types: event.product_types || [],
      therapeutic_areas: event.therapeutic_areas || [],
      related_events: [],
      references_list: [],
      tags: event.tags || [],
      attachments: [],
      source_url: '',
      source_link: '',
      source_organization: event.organization,
      original_language: 'en',
      translation_status: 'completed',
      ai_analyzed_at: new Date().toISOString(),
      ai_model: 'seed-data-generator',
      confidence_score: 0.95,
      review_status: 'published'
    };

    db.saveRegulatoryEvent(regulatoryEvent);
    inserted++;
  }

  const eventCount = db._getSingleCount('SELECT COUNT(*) as count FROM regulatory_events');
  console.log(`✅ 种子数据生成完成`);
  console.log(`   新增: ${inserted} 条`);
  console.log(`   跳过(重复): ${skipped} 条`);
  console.log(`   regulatory_events 总数: ${eventCount}`);
  console.log('============================================================\n');

  db.close();
}

main().catch(error => {
  console.error('种子数据生成失败:', error);
  process.exit(1);
});
