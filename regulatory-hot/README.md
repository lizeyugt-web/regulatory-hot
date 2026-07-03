# Regulatory Hot · 全球医药监管情报

> 复刻 [AIHOT](https://aihot.virxact.com/) 模式到医药监管领域

## 目标

从全球 20+ 监管机构（FDA / EMA / NMPA / PMDA / MHRA 等）和 5 大国际组织（WHO / ICH / IMDRF / PIC/S / ISO）自动采集医药监管动态，AI 结构化分析后多渠道分发。

## 当前状态：v0.1.0 — 页面骨架完成

- ✅ 9 页面骨架（首页/全部/日报/主题/详情/Agent/关于/日志/反馈）
- ✅ 8 大分类 + 5 级重要度 + 20+ 信源配置
- ✅ Mock 数据生成器 + REST API 骨架
- ⏳ 真实数据采集（下一步）
- ⏳ DeepSeek V3.2 预筛 + V4 Pro 精评（下一步）
- ⏳ PostgreSQL + Prisma 替换 Mock（下一步）

## 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | Next.js 14 (App Router) + TypeScript |
| 样式 | Tailwind CSS |
| AI 模型 | DeepSeek V3.2 (预筛) + DeepSeek V4 Pro (精评) |
| 数据 | Mock → PostgreSQL + Prisma + pgvector |
| 部署 | Vercel / 阿里云 |

## 本地启动

```bash
cd regulatory-hot
npm install
npm run dev
# 访问 http://localhost:3457
```

## 目录结构

```
regulatory-hot/
├── app/                    # Next.js App Router
│   ├── api/public/         # 公开 REST API
│   ├── all/                # 全部动态
│   ├── daily/              # 监管日报
│   ├── topics/             # 主题地图
│   ├── items/[id]/         # 事件详情
│   ├── agent/              # Agent 接入文档
│   ├── about/              # 关于
│   ├── changelog/          # 更新日志
│   ├── feedback/           # 反馈
│   ├── layout.tsx          # 根布局
│   ├── page.tsx            # 首页
│   └── globals.css         # 全局样式
├── components/
│   ├── event/              # 事件相关组件（卡片、徽章、筛选）
│   └── layout/             # Header / Footer
├── lib/
│   ├── config.ts           # 集中配置（信源/分类/重要度）
│   ├── types.ts            # TypeScript 类型
│   └── mock-data.ts        # Mock 数据生成
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## 核心数据模型

```typescript
RegulatoryEvent {
  title, titleEn, summary
  sourceId, sourceName, sourceLevel (T1/T1.5/T2/T3)
  category (8 类), importance (1-5)
  scores: 5 维度评分 → 代码加权
  productType, therapeuticArea, affectedRegions
  selected, clusterId, relatedIds
  aiModel, aiCost
}
```

## 评分算法（代码决策 + AI 打分）

```
最终得分 = 信源权威度 × 0.30 
         + 影响范围   × 0.25 
         + 合规紧急度 × 0.25
         + 行业关注度 × 0.20

重要性 = 5 (重大) if score >= 85
       | 4 (高)   if score >= 70
       | 3 (中)   if score >= 55
       | 2 (低)   if score >= 40
       | 1 (参考) otherwise
```

## 下一步

- [ ] 接入真实 RSS 抓取（10个核心信源）
- [ ] 接入 openFDA API（drug / device / 510k / pma）
- [ ] 接入 DeepSeek API（预筛 + 精评）
- [ ] PostgreSQL + Prisma 替换 Mock
- [ ] 事件聚类（Embedding 相似度）
- [ ] 每日 08:00 定时生成日报
- [ ] 部署到 47.107.133.169:3457

---

🤖 Powered by Regulatory Hot Team · 数据每 12h 自动更新
