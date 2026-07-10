# 监管信息采集监控平台 (Regulatory Hot) — 项目架构文档 v3.0

> **固化日期**: 2026-07-10  
> **GitHub**: https://github.com/lizeyugt-web/regulatory-hot  
> **本地路径**: `d:/Claude code 项目/监管信息采集监控平台/`

---

## 一、项目概述

全球医药监管情报实时聚合平台，对标 AIHOT（数字生命卡兹克）。

**核心信息流**：
```
采集 (本地守护进程 Local Daemon v1.0)
  → AI 一步分析 (DeepSeek-V3.2 标题翻译+摘要+推荐理由+五维评分)
  → SQLite (regulatory.db)
  → 前端展示 (Next.js 14 / React 18)
```

---

## 二、关键配置信息

### AI 模型
| 用途 | 模型 | 提供商 | 价格 |
|------|------|--------|------|
| 一步分析（标题+摘要+推荐+评分） | `deepseek-ai/DeepSeek-V3.2` | 硅基流动 (SiliconFlow) | ¥4.00/¥6.00 每百万token |
| 正文翻译（长文本） | `Qwen/Qwen3.5-35B-A3B` | 硅基流动 | ¥0.40/¥3.20 每百万token |
| 预筛（去噪） | `deepseek-ai/DeepSeek-V3.2` | 硅基流动 | - |
| Embedding | `Qwen/Qwen3-Embedding-8B` | 硅基流动 | - |
| Reranker | `Qwen/Qwen3-Reranker-8B` | 硅基流动 | - |

### API 配置
- **Base URL**: `https://api.siliconflow.cn/v1`
- **API Key**: 存储在 GitHub Secrets `SILICONFLOW_API_KEY` 和本地 `.env`
- **兼容协议**: OpenAI Chat Completions

### GitHub
- **仓库**: `lizeyugt-web/regulatory-hot` (Private)
- **GitHub Token**: 见 GitHub Secrets（不提交到仓库）
- **GitHub 用户名**: `lizeyugt-web`

### 本地开发
- **Dev Server**: `npx next dev -p 3457 -H 0.0.0.0`
- **访问地址**: `http://127.0.0.1:3457/`
- **Next.js 版本**: 15.x
- **Node 版本**: 22.x

---

## 三、信源体系（第一层：FDA）

### 当前已实现
| 信源 | 采集方式 | 端点 | 记录数 |
|------|---------|------|--------|
| 美国 FDA | RSS + API | FDA.gov RSS, openFDA, Federal Register | 167条 |
| FDA 药品审批 | RSS | FDA Drug Approvals RSS | 含在内 |
| FDA 器械510k/PMA | API | openFDA /device/510k.json, /device/pma.json | 含在内 |

### 第二层计划（待实现）
| 信源 | 国家/地区 | 优先级 | 采集方式 |
|------|----------|--------|---------|
| EMA (欧洲药品管理局) | 欧盟 | P0 | RSS |
| NMPA (国家药监局) | 中国 | P0 | 网页爬虫 |
| PMDA (日本) | 日本 | P1 | RSS |
| MHRA (英国) | 英国 | P1 | RSS |
| Health Canada | 加拿大 | P2 | RSS |
| TGA (澳大利亚) | 澳大利亚 | P2 | RSS |
| Swissmedic (瑞士) | 瑞士 | P2 | RSS |
| ANVISA (巴西) | 巴西 | P2 | RSS |
| WHO | 国际 | P1 | RSS |
| ICH | 国际 | P1 | RSS |
| IMDRF | 国际 | P2 | RSS |
| PIC/S | 国际 | P2 | RSS |
| ISO | 国际 | P2 | RSS |
### 微信公众号（已实现 v4.0 智能全量+增量）
| 信源 | 说明 | 采集方式 | 部署位置 |
|------|------|---------|---------|
| 微信公众号 (10 P0) | 医药监管相关公众号 | wechat-article-exporter Docker（直连 3443）+ **v4.0 智能采集** | 阿里云 47.107.133.169:3443 |

**微信采集架构 v4.0**（2026-07-09 更新）：
```
GitHub Actions: wechat-sync.yml (每 30 分钟)
  ├─ 每日 0:00 (北京)  → 全量兜底：拉昨天一整天的文章 (20篇/号)
  └─ 每日 0:30~23:30     → 增量模式：只抓过去31分钟新文章 (5篇/号)
  
核心脚本: scripts/collect_wechat_smart.cjs
  · 运行时自动检测北京时间 → 判断全量还是增量模式
  · 增量: ID 比对去重，命中缓存即停，单次 ~15s
  · 全量: 时间窗口过滤昨天全天，拉到 20 篇/号
  · 延迟：≤ 30 分钟（增量）+ 每天0点全量兜底
```

**微信采集架构 v3.1**（保留，collect_wechat_v2.cjs，不再自动运行）：
```
阿里云 Docker: wechat-article-exporter (端口 3443, HTTPS)
  → /api/public/v1/authkey              → 探活 / 验证 auth-key
  → /api/public/v1/account?keyword=xxx  → 搜索公众号（拿到 fakeid）
  → /api/public/v1/article?fakeid=xxx   → 公众号文章发布列表（size 上限 20）
  → /api/public/v1/download?url=...&format=markdown
                                      → 单篇文章正文（Markdown/HTML/Text/JSON）

GitHub Actions（直连 3443，无 SSH 跳板）
  → collect_wechat_v2.cjs v3.1
      · 端点全部用 /api/public/v1/*（与官网文档对齐）
      · 7 天过滤（只保留 7 天内发布）
      · 并发 3 路抓正文 markdown
      · 增量合并到 wechat-articles.json
  → merge_wechat.cjs
      · 新文章：contentOriginal = markdown 正文
      · 旧记录升级：把 digest(54字) 升级为正文 markdown(>200字)
  → analyze.cjs
      · 中文文章走 isChinese 分支，prompt 中无 contentCn 翻译要求
      · 其他语言（英文/日文）保留翻译逻辑
```

**P0 已配置公众号（10个）**: 中国药闻、中国药审、国家医保局、蒲公英、医药魔方、赛柏蓝、识林、医药经济报、健识局、E药经理人

**GitHub Secret**: `WECHAT_AUTH_KEY`（在 3443 /dashboard/account 登录后从 cookie 取得）

详见 [docs/wechat-mp-list.md](./docs/wechat-mp-list.md) |

### 第三层计划（待实现）
| 信源 | 类型 | 采集方式 |
|------|------|---------|
| RAPS | 行业媒体 | RSS |
| ISPE | 行业媒体 | RSS |
| PDA | 行业媒体 | RSS |
| DIA | 行业媒体 | RSS |
| USP (美国药典) | 标准组织 | RSS |

---

## 四、文件结构

```
监管信息采集监控平台/
├── .github/workflows/
│   ├── collect-analyze.yml      # FDA 采集 + AI 分析（每 2h）
│   └── wechat-sync.yml          # 微信公众号智能同步（每 30min）
├── regulatory-hot/              # Next.js 15 前端项目
│   ├── app/
│   │   ├── page.tsx             # 首页（精选）
│   │   ├── all/page.tsx         # 全部动态（时间轴）
│   │   ├── items/[id]/page.tsx  # 详情页
│   │   └── globals.css          # 全局样式
│   ├── components/event/
│   │   ├── EventCard.tsx        # AIHOT 风格卡片
│   │   ├── DetailView.tsx       # 详情页核心组件
│   │   ├── ActionsDashboard.tsx # GitHub Actions 调度看板
│   │   ├── AiProgressBar.tsx    # AI 处理进度条
│   │   ├── FilterToolbar.tsx    # 筛选工具条
│   │   ├── HotTopicsPanel.tsx   # 热点面板
│   │   ├── CategoryChip.tsx     # 分类标签
│   │   ├── SourceBadge.tsx      # 信源标签
│   │   ├── ImportanceBadge.tsx  # 重要度标签
│   │   └── ShareActions.tsx     # 分享操作
│   ├── lib/
│   │   ├── config.ts            # 核心配置（信源/分类/评分/AI模型）
│   │   ├── types.ts             # TypeScript 类型定义
│   │   ├── events-data.ts       # 数据读取层
│   │   ├── ai-client.ts         # AI API 客户端
│   │   └── clustering.ts        # 事件聚类
│   └── public/data/
│       ├── events.json          # 主数据文件
│       └── .progress.json       # AI 处理进度状态
├── scripts/
│   ├── analyze.cjs              # AI 一步分析脚本 v2.2（统一 Gateway）
│   ├── collect_fda.cjs          # FDA 采集入口
│   ├── collect_wechat_v2.cjs    # 微信公众号采集 v3.1（保留，不再自动运行）
│   ├── collect_wechat_smart.cjs  # 微信公众号采集 v4.0（智能全量+增量）
│   ├── collect_wechat_delta.cjs  # 微信公众号采集 v4.0-delta（阿里云方案，未启用）
│   ├── merge_wechat.cjs         # 微信文章合并到 events.json
│   └── check_cookie.cjs         # Cookie 过期检查 & 通知
├── src/
│   ├── crawlers/
│   │   ├── fda_collector.js     # FDA 采集器核心
│   │   ├── rss_collector.js     # RSS 通用采集器
│   │   ├── web_collector.js     # 网页爬虫
│   │   ├── api_collector.js     # API 采集器
│   │   └── engine.js            # 采集引擎
│   ├── analyzer/
│   │   └── ai_analyzer.js       # 旧版 AI 分析器（Claude）
│   ├── database/
│   │   └── manager.js           # SQLite 数据库管理
│   └── scheduler/
│       └── scheduler.js         # 本地调度器
├── auto_collect_analyze.cmd     # Windows 一键运行脚本
├── run_analyze.bat              # 手动分析脚本
├── schedule_task.ps1            # Windows 定时任务安装
├── .gitignore
└── .env                         # 本地环境变量（不提交 Git）
```

---

## 五、数据模型

### RegulatoryEvent 核心字段
```typescript
interface RegulatoryEvent {
  id: string;                    // 唯一ID
  title: string;                 // 中文标题（AI翻译后）
  titleEn?: string;              // 英文原标题
  url: string;                   // 原始链接
  summary: string;               // 原始摘要
  sourceId: string;              // 信源ID（如 'fda'）
  sourceName: string;            // 信源显示名
  sourceLevel: 'T1'|'T1.5'|'T2'|'T3';
  category: 'regulation'|'approval'|'safety'|'insight';
  importance: 1|2|3|4|5;
  scores: { sourceAuthority, impactScope, timeliness, complianceUrgency, industryAttention };
  finalScore: number;            // 0-100 综合分
  selected: boolean;             // 是否精选
  // AI 分析字段 (v2.0)
  aiSummaryCn?: string;          // AI 中文摘要
  aiReason?: string;             // AI 推荐理由
  aiSummaryModel?: string;       // 分析模型
  aiAnalyzedAt?: string;         // 分析时间
  contentCn?: string;            // 中文正文
  contentOriginal?: string;      // 原文正文
}
```

---

## 六、定时调度（v3.0 本地化）

### 本地守护进程 (Local Daemon v1.0) — 主力
- **脚本**: `scripts/local_daemon.cjs`
- **PM2 配置**: `ecosystem.local.config.cjs`
- **一键启动**: `start_local.cmd`
- **触发**: 持续运行，每 30 分钟一轮
- **流程**:
  ```
  git pull (拉取 ECS 微信文章)
    → 微信导入 (wechat → regulatory.db)
    → FDA 采集 (每 4 轮/2h)
    → AI 分析 (analyze_v3.cjs, 上限 100 条/轮)
    → git push
  ```
- **延迟**: ≤ 30 分钟

### ECS 守护进程 (watcher.cjs v5.0) — 微信采集
- **部署**: 阿里云 47.107.133.169, PM2 管理
- **脚本**: `scripts/watcher.cjs`
- **触发**: 每 30 分钟轮询 wechat-article-exporter (Docker, 端口 3443)
- **职责**: 拉取 10 个 P0 公众号文章 → 写 wechat-articles.json → git push

### GitHub Actions — 保留作为兜底
- **FDA 采集**: `.github/workflows/collect-analyze.yml` (每 2h, cron 触发)
- **微信 AI**: `.github/workflows/wechat-sync.yml` (每 30min)
- **状态**: 保留但不再作为主路径

---

## 七、分类体系

| 分类 | 中文 | 子分类 |
|------|------|--------|
| `regulation` | 法规与标准 | 法规发布、指南发布、指导原则、草案征求意见、技术标准、药典更新、ICH指南、ISO标准、USP标准 |
| `approval` | 审批与决策 | 新药批准、新适应症、附条件批准、加速审批、优先审评、突破性疗法、仿制药批准、510(k)批准、PMA批准、De Novo、拒绝/撤回 |
| `safety` | 安全与合规 | 安全警戒、不良反应、召回、警告信、黑框警告、进口禁令、GMP检查、飞行检查、违规处罚、临床暂停 |
| `insight` | 行业洞察 | 会议活动、咨询委员会、公开听证、人事变动、政策声明、跨境合作、年度报告、白皮书、期刊文章、行业分析、统计报告 |

---

## 八、评分体系

### 五维评分权重
| 维度 | 权重 | 说明 |
|------|------|------|
| sourceAuthority | 30% | 信源权威度 |
| impactScope | 25% | 影响范围 |
| complianceUrgency | 20% | 合规紧急度 |
| industryAttention | 15% | 行业关注度 |
| timeliness | 10% | 时效性 |

### 重要度映射
| 分数 | 等级 | 标签 |
|------|------|------|
| ≥85 | 5 | 重大 |
| ≥70 | 4 | 高 |
| ≥55 | 3 | 中 |
| ≥40 | 2 | 低 |
| <40 | 1 | 参考 |

---

## 九、FDA 审批类型知识

### 药品 (NDA Classification Codes)
- Type 1: 新分子实体(NME)
- Type 2: 新活性成分
- Type 3: 新剂型
- Type 4: 新复方药
- Type 5: 新配方/新制造商/新适应症
- Type 9: 不单独上市的新适应症
- Type 10: 独立上市的新适应症

### 器械审批路径
- 510(k): 中等风险 (Class II)，实质等同
- PMA: 高风险 (Class III)，独立安全有效性证据
- De Novo: 新型低中风险器械，无predicate device
- HDE: 罕见病器械

---

## 十、费用估算

| 场景 | 条数 | 模型 | 费用 |
|------|------|------|------|
| 全量摘要分析 | 167条 | DeepSeek-V3.2 | ¥0.30 |
| 每月新增 | ~600条 | DeepSeek-V3.2 | ~¥1.20/月 |
| 正文翻译 | 167条 | Qwen3.5-35B-A3B | ¥1.5-2.5 |
| GitHub Actions | 免费 | - | ¥0 |

---

## 十一、后续扩展规划

### 短期 (P0)
- [ ] 接入 EMA (欧洲) 信源
- [ ] 接入 NMPA (中国) 信源
- [ ] 详情页正文翻译（Qwen3.5）

### 中期 (P1)
- [ ] PMDA (日本) + WHO + ICH 信源
- [ ] 事件聚类（同事件多源折叠）
- [ ] 日报自动生成

### 长期 (P2)
- [ ] 全部 20+ 信源接入
- [ ] Vercel 部署（替换本地 dev server）
- [ ] 飞书/邮件自动推送

---

> **最后更新**: 2026-07-10 09:25 CST（v3.0 本地守护进程架构，GitHub Actions 降级为兜底）  
> **下次维护**: 添加新信源时更新本文档
