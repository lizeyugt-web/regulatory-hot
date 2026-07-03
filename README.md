# 全球药械监管信息采集监控平台

## 🌐 Global Regulatory Intelligence Monitoring Platform

### 项目概述

自动采集、AI分析、结构化展示全球药品/医疗器械监管机构的最新动态信息。

### 覆盖范围

#### 监管机构 (第一梯队)
| 地区 | 机构 | 采集方式 |
|------|------|---------|
| 🇺🇸 美国 | FDA | RSS + openFDA API + 网页 |
| 🇪🇺 欧盟 | EMA / EDQM / HMA | RSS + 网页 |
| 🇨🇳 中国 | NMPA / CDE / CFDI | 网页 |
| 🇯🇵 日本 | PMDA / MHLW | RSS + 网页 |
| 🇰🇷 韩国 | MFDS | 网页 |
| 🇨🇭 瑞士 | Swissmedic | 网页 |
| 🇬🇧 英国 | MHRA | 网页 |
| 🇨🇦 加拿大 | Health Canada | 网页 |
| 🇦🇺 澳大利亚 | TGA | 网页 |

#### 国际组织 (第二梯队)
- WHO (世界卫生组织)
- ICH (国际人用药品注册技术协调会)
- PIC/S (药品检查合作计划)
- IMDRF (国际医疗器械监管者论坛)
- ISO (国际标准化组织)

#### 行业组织 (第三梯队)
- ISPE / PDA / RAPS / DIA
- USP (美国药典)
- PhRMA / EFPIA (制药协会)
- AdvaMed / MedTech Europe (器械协会)

### 技术架构

```
采集层: RSS Parser + openFDA API + Playwright Web Scraper
  ↓
存储层: SQLite (raw_items → regulatory_events)
  ↓
分析层: Claude API (结构化提取/分类/分级/翻译)
  ↓
展示层: Fastify REST API + 原生JS Web界面
  ↓
调度层: 内置Scheduler (每12小时全量采集)
```

### 快速启动

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 ANTHROPIC_API_KEY

# 3. 启动平台
node index.js

# 4. 访问
# Web UI: http://localhost:3000
# API: http://localhost:3000/api/
```

### API 接口

| 接口 | 说明 |
|------|------|
| GET /api/stats | 统计概览 |
| GET /api/events | 事件列表 (支持筛选) |
| GET /api/events/:id | 事件详情 |
| GET /api/events/by-country | 按国家聚合 |
| GET /api/events/by-organization | 按机构聚合 |
| GET /api/events/by-category | 按分类聚合 |
| GET /api/events/timeline | 时间线数据 |
| GET /api/events/high-importance | 高重要性事件 |
| GET /api/search?q= | 全文搜索 |
| POST /api/crawl/trigger | 手动触发采集 |
| GET /api/crawl/status | 采集状态 |
| GET /api/crawl/logs | 采集日志 |

### 信息分类分级

#### 分类
- 法规指南类 / 审批类 / 安全类 / 会议活动类
- 检查合规类 / 标准类 / 新闻动态类 / 出版物

#### 重要度 (1-5星)
- ⭐⭐⭐⭐⭐ 重大影响: 新法规/指南颁布、重大安全警告
- ⭐⭐⭐⭐ 高影响: 指南草案、重要审批、召回
- ⭐⭐⭐ 中等: 一般政策更新、会议纪要
- ⭐⭐ 一般: 日常公告、活动通知
- ⭐ 参考: 背景信息、历史存档

### 项目结构

```
├── config/
│   └── sources.json          # 数据源配置 (URL/API/RSS)
├── src/
│   ├── crawlers/
│   │   ├── engine.js          # 采集引擎主控
│   │   ├── rss_collector.js   # RSS采集器
│   │   ├── api_collector.js   # API采集器
│   │   └── web_collector.js   # 网页采集器 (Playwright)
│   ├── analyzer/
│   │   └── ai_analyzer.js     # AI分析处理器 (Claude API)
│   ├── database/
│   │   └── manager.js         # 数据库管理器 (SQLite)
│   ├── scheduler/
│   │   └── scheduler.js       # 定时任务调度器
│   ├── api/
│   │   └── server.js          # REST API服务器 (Fastify)
│   └── web/
│       └── public/
│           └── index.html     # Web前端界面
├── data/                      # 数据存储目录
├── index.js                   # 主入口
├── package.json
└── .env.example
```

### 许可

MIT
