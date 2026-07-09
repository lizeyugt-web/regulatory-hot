# 数据写入数据库 Spec

> 固化日期: 2026-07-09
> 版本: v1.0

---

## 一、整体架构

```
GitHub Actions (cron 触发器)
│
├── fda-collect.yml (每 2h)
│   └── collect_fda.cjs → better-sqlite3 → regulatory.db
│
├── wechat-sync.yml (每 30min)
│   └── collect_wechat_smart.cjs → better-sqlite3 → regulatory.db
│
├── 合并（采集完成后）
│   └── merge_all.cjs（合并 FDA/微信数据到统一 events 表）
│
└── analyze.cjs (采集后自动触发)
    └── 读取未分析事件 → AI 分析/翻译 → 写回 regulatory.db

所有 change  → git add regulatory.db → git commit → git push
```

---

## 二、数据库表结构

### 2.1 events（主表）

```sql
CREATE TABLE events (
  id              TEXT PRIMARY KEY,        -- UUID
  rawItemId       TEXT NOT NULL,           -- SHA256(url+title)

  -- 标题
  titleOriginal   TEXT NOT NULL,           -- 原标题（任何语言）
  titleCn         TEXT NOT NULL DEFAULT '',-- 中文标题（AI 翻译后填入）
  titleLang       TEXT NOT NULL,           -- 'zh' | 'en' | 'ja' | ...

  -- 摘要
  summaryOriginal TEXT NOT NULL DEFAULT '',-- 原始摘要
  summaryCn       TEXT NOT NULL DEFAULT '',-- AI 中文摘要 (150-250字)

  -- 正文
  contentOriginal TEXT,                    -- 原文正文（微信: null）
  contentCn       TEXT,                    -- 中文正文（微信: null）
  contentHint     TEXT,                    -- 正文提示（仅微信有值）
  contentType     TEXT NOT NULL DEFAULT 'text', -- 'markdown' | 'html' | 'text'

  -- 信源
  sourceId        TEXT NOT NULL,           -- 'fda' | 'wechat-中国药闻' | 'ema'
  sourceName      TEXT NOT NULL,           -- 显示名
  sourceLevel     TEXT NOT NULL,           -- 'T1' | 'T2'
  sourceCountry   TEXT NOT NULL DEFAULT '',-- ISO 国家代码

  -- 链接
  url             TEXT NOT NULL,           -- 原始链接
  permalink       TEXT NOT NULL,           -- 站内链接 /items/:id

  -- 分类
  category        TEXT NOT NULL,           -- 'regulation'|'approval'|'safety'|'insight'
  subCategory     TEXT DEFAULT '[]',       -- JSON array

  -- 评分
  importance      INTEGER NOT NULL DEFAULT 3,   -- 1-5
  scores          TEXT DEFAULT '{}',      -- JSON: { sourceAuthority, impactScope, timeliness, complianceUrgency, industryAttention }
  finalScore      REAL NOT NULL DEFAULT 0,-- 0-100

  -- AI 字段
  aiReason        TEXT DEFAULT '',         -- AI 推荐理由
  aiModel         TEXT DEFAULT '',         -- 分析模型
  aiTranslateModel TEXT DEFAULT '',        -- 翻译模型
  aiCost          REAL DEFAULT 0,          -- 分析成本(元)
  aiAnalyzedAt    TEXT,                    -- ISO 8601

  -- 状态
  aiStatus        TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'analyzed'|'skipped'
  selected        INTEGER NOT NULL DEFAULT 0,      -- 0/1 是否精选
  isLead          INTEGER NOT NULL DEFAULT 0,      -- 0/1 是否头条

  -- 时间
  publishedAt     TEXT NOT NULL,           -- ISO 8601
  crawledAt       TEXT NOT NULL DEFAULT (datetime('now')),

  -- 微信特有
  isSocial        INTEGER NOT NULL DEFAULT 0,
  readCount       INTEGER DEFAULT 0,
  likeCount       INTEGER DEFAULT 0,
  coverUrl        TEXT DEFAULT '',

  -- 聚类（后期）
  clusterId       TEXT,
  clusterSize     INTEGER DEFAULT 0,

  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX idx_events_source ON events(sourceId);
CREATE INDEX idx_events_published ON events(publishedAt DESC);
CREATE INDEX idx_events_category ON events(category);
CREATE INDEX idx_events_ai_status ON events(aiStatus);
CREATE INDEX idx_events_source_level ON events(sourceLevel);
CREATE UNIQUE INDEX idx_events_url ON events(url);

-- FTS5 全文检索
CREATE VIRTUAL TABLE events_fts USING fts5(
  titleCn, summaryCn, contentCn,
  content='events',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

-- 触发器：自动同步 FTS 索引
CREATE TRIGGER events_ai AFTER INSERT ON events BEGIN
  INSERT INTO events_fts(rowid, titleCn, summaryCn, contentCn)
  VALUES (new.rowid, new.titleCn, new.summaryCn, new.contentCn);
END;

CREATE TRIGGER events_au AFTER UPDATE ON events BEGIN
  DELETE FROM events_fts WHERE rowid = old.rowid;
  INSERT INTO events_fts(rowid, titleCn, summaryCn, contentCn)
  VALUES (new.rowid, new.titleCn, new.summaryCn, new.contentCn);
END;

CREATE TRIGGER events_ad AFTER DELETE ON events BEGIN
  DELETE FROM events_fts WHERE rowid = old.rowid;
END;
```

### 2.2 sources（信源配置）

```sql
CREATE TABLE sources (
  id        TEXT PRIMARY KEY,        -- 'fda' | 'wechat-中国药闻' | 'ema'
  name      TEXT NOT NULL,           -- 显示名
  nameEn    TEXT NOT NULL DEFAULT '',
  type      TEXT NOT NULL,           -- 'agency' | 'wechat' | 'org' | 'media'
  country   TEXT NOT NULL DEFAULT '',
  region    TEXT NOT NULL DEFAULT '',-- 'asia' | 'europe' | 'americas' | 'global'
  level     TEXT NOT NULL DEFAULT 'T2',
  enabled   INTEGER NOT NULL DEFAULT 1,
  endpoints TEXT DEFAULT '[]',       -- JSON: RSS/API/Web 采集入口
  config    TEXT DEFAULT '{}',       -- JSON: 额外配置（如微信 fakeid）
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.3 crawl_logs（采集日志）

```sql
CREATE TABLE crawl_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id   TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  status      TEXT NOT NULL DEFAULT 'running', -- 'success'|'failed'|'partial'
  items_total INTEGER DEFAULT 0,
  items_new   INTEGER DEFAULT 0,
  items_dup   INTEGER DEFAULT 0,
  error_msg   TEXT,
  duration_ms INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.4 ai_analyses（AI 分析记录）

```sql
CREATE TABLE ai_analyses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id    TEXT NOT NULL,
  model       TEXT NOT NULL,           -- 使用的模型
  task        TEXT NOT NULL,           -- 'translate_title'|'summarize'|'score'|'translate_content'
  input_tokens  INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost        REAL DEFAULT 0,
  duration_ms INTEGER,
  status      TEXT NOT NULL DEFAULT 'success',
  error_msg   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 三、写入流程详解

### 3.1 FDA 采集 (collect_fda.cjs)

```
1. RSS/API/Web 抓取原始条目
2. 去重：
   - 通过 contentHash (SHA256) 查 events 表
   - 通过 url 查 events 表
   - 重复 → 跳过
3. 语言检测：
   - titleOriginal 的前 100 字符检测
   - 中文字符占比 >30% → titleLang='zh'
   - 日文字符 >20% → titleLang='ja'
   - 其他 → titleLang='en'
4. 写入 events 表：
   ┌─────────────────────────────────────────────────────────┐
   │ titleOriginal   = "FDA Approves New Treatment for..."   │
   │ titleCn         = ''         ← 待 AI 翻译              │
   │ titleLang       = 'en'                                  │
   │ summaryOriginal = RSS 摘要原文                           │
   │ summaryCn       = ''         ← 待 AI 分析              │
   │ contentOriginal = 网页抓取的完整英文正文                   │
   │ contentCn       = ''         ← 待 AI 翻译              │
   │ contentHint     = null       ← 非微信，正常显示          │
   │ sourceId        = 'fda'                                 │
   │ aiStatus        = 'pending'                             │
   └─────────────────────────────────────────────────────────┘
5. 写入采集日志到 crawl_logs
6. git add → commit → push
```

### 3.2 微信公众号采集 (collect_wechat_smart.cjs)

```
1. 智能模式检测（全量/增量）
2. 抓取文章列表 + 正文
3. 去重（通过 link/url）
4. 写入 events 表：
   ┌─────────────────────────────────────────────────────────┐
   │ titleOriginal   = "国家药监局发布2026年工作要点"           │
   │ titleCn         = "国家药监局发布2026年工作要点"  ← 相同  │
   │ titleLang       = 'zh'              ← 100% 中文         │
   │ summaryOriginal = 公众号摘要(digest)                      │
   │ summaryCn       = ''               ← 待 AI 生成摘要     │
   │ contentOriginal = null             ← 版权限制，不存储    │
   │ contentCn       = null             ← 不显示正文          │
   │ contentHint     = "微信公众号文章受平台限制..."            │
   │ sourceId        = 'wechat-中国药闻'                      │
   │ aiStatus        = 'pending'                             │
   └─────────────────────────────────────────────────────────┘
5. 写入采集日志到 crawl_logs
6. git add → commit → push
```

### 3.3 AI 分析 (analyze.cjs) — 核心差异化逻辑

```
输入: events 表中 aiStatus='pending' 的事件

对每个事件：

┌─ 步骤 1: 判断是不是中文 ───────────────────────────────┐
│                                                         │
│  if (titleLang == 'zh') {                              │
│    // 中文事件 — 不需要翻译                              │
│    titleCn = titleOriginal   ← 直接拷贝                │
│    goto 步骤 2 (摘要)                                   │
│  } else {                                              │
│    // 非中文事件 — 需要翻译                              │
│    步骤 1a: AI 翻译标题 → titleCn                      │
│    步骤 1b: AI 翻译正文 → contentCn                     │
│    goto 步骤 2                                          │
│  }                                                     │
└─────────────────────────────────────────────────────────┘

┌─ 步骤 2: AI 生成中文摘要 ───────────────────────────────┐
│                                                         │
│  输入: titleCn + summaryOriginal                       │
│  输出: summaryCn (150-250 字中文摘要)                   │
│                                                         │
│  中文事件: titleCn 就是原标题，summaryOriginal 也是中文   │
│  非中文: titleCn 是翻译后的，summaryOriginal 是英文       │
│  都用中文 prompt 要求输出中文摘要                         │
└─────────────────────────────────────────────────────────┘

┌─ 步骤 3: AI 五维评分 ───────────────────────────────────┐
│                                                         │
│  输入: titleCn + summaryCn                             │
│  输出: {                                                │
│    sourceAuthority: 0-100,                              │
│    impactScope: 0-100,                                  │
│    timeliness: 0-100,                                   │
│    complianceUrgency: 0-100,                            │
│    industryAttention: 0-100                             │
│  }                                                      │
│                                                         │
│  公式计算: finalScore =                                 │
│    sourceAuthority × 0.30 +                             │
│    impactScope × 0.25 +                                 │
│    complianceUrgency × 0.20 +                           │
│    industryAttention × 0.15 +                           │
│    timeliness × 0.10                                    │
│                                                         │
│  importance 映射:                                       │
│    ≥85 → 5, ≥70 → 4, ≥55 → 3, ≥40 → 2, <40 → 1       │
└─────────────────────────────────────────────────────────┘

┌─ 步骤 4: AI 推荐理由 ───────────────────────────────────┐
│                                                         │
│  输入: titleCn + summaryCn + category + scores         │
│  输出: aiReason (1-2 句中文推荐理由)                    │
└─────────────────────────────────────────────────────────┘

┌─ 步骤 5: 写回数据库 ───────────────────────────────────┐
│                                                         │
│  UPDATE events SET                                      │
│    titleCn       = (翻译后的/原文的),                     │
│    summaryCn     = (AI 摘要),                            │
│    contentCn     = (翻译后的/原文的/null),                │
│    scores        = (五维评分 JSON),                      │
│    finalScore    = (综合分),                             │
│    importance    = (等级),                               │
│    aiReason      = (推荐理由),                           │
│    aiModel       = 'Qwen/Qwen2.5-72B-Instruct',         │
│    aiAnalyzedAt  = (ISO 8601),                          │
│    aiStatus      = 'analyzed'                           │
│  WHERE id = ?                                           │
│                                                         │
│  写入 ai_analyses 记录（每条事件的每次 API 调用）         │
└─────────────────────────────────────────────────────────┘
```

---

## 四、AI 处理策略速查

| 步骤 | 中文事件 | 非中文事件 | 微信事件 |
|------|----------|-----------|----------|
| 标题 | `titleCn` = `titleOriginal` | AI 翻译 `titleOriginal` | `titleCn` = `titleOriginal` |
| 摘要 | AI 生成中文摘要（输入已是中文） | AI 生成中文摘要（输入英文） | AI 生成中文摘要（输入中文） |
| 正文 | `contentCn` = `contentOriginal` | AI 翻译 `contentOriginal` | `contentCn` = null |
| 评分 | 五维评分 | 五维评分 | 五维评分 |
| 推荐 | AI 推荐理由 | AI 推荐理由 | AI 推荐理由 |

---

## 五、各模型分工

| 任务 | 模型 | 原因 |
|------|------|------|
| 标题翻译 (en→zh) | Qwen2.5-72B | 翻译质量好，稳定 |
| 摘要生成 | Qwen2.5-72B | 需要理解长文本 |
| 正文翻译 (长文本) | Qwen3.5-35B-A3B | 便宜，适合长文本 |
| 五维评分 | Qwen2.5-72B | 需要复杂判断 |
| 推荐理由 | Qwen2.5-72B | 1-2 句简短输出 |

---

## 六、GitHub Actions 改造

```
fda-collect.yml:
  采集 FDA  → better-sqlite3 写 events + crawl_logs
  commit regulatory.db + push

wechat-sync.yml:
  智能采集 → better-sqlite3 写 events + crawl_logs
  merge（不再需要，因为直接写同一个 events 表）
  commit regulatory.db + push

analyze (在各自的 workflow 末尾触发):
  读 events WHERE aiStatus='pending'
  AI 分析/翻译 → 写回 events + ai_analyses
  commit regulatory.db + push
```

**关键简化**：微信和 FDA 直写同一个 `events` 表，不再需要 `merge_wechat.cjs` 中间脚本。
