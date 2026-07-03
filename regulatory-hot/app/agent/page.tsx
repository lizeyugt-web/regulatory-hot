import Link from 'next/link';
import { SITE } from '@/lib/config';

export const metadata = {
  title: 'Agent 接入',
};

export default function AgentPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">Agent 接入</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          {SITE.name} 提供多种集成方式，让监管情报直接进入你的工作流。
        </p>
      </header>

      <div className="grid gap-2 sm:grid-cols-2">
        <IntegrationCard icon="🌐" title="REST API"   desc="公开匿名 JSON API，OpenAPI 3.1 规范" href="/api/public/daily" status="可用" />
        <IntegrationCard icon="📡" title="RSS 订阅"   desc="标准 RSS Feed，可用 Feedly 等阅读器"   href="/rss.xml"          status="可用" />
        <IntegrationCard icon="🤖" title="Agent Skill" desc="为 Claude Code / Cursor / Codex 提供接入" href="#skill"           status="可用" />
        <IntegrationCard icon="📊" title="Webhook 推送" desc="重要事件主动推送到企业 IM" href="/feedback"          status="规划中" coming />
      </div>

      <section className="card p-5">
        <h2 className="section-title">REST API</h2>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">Base URL：<code className="rounded bg-ink-100 px-1.5 py-0.5 font-mono dark:bg-ink-800">{SITE.url}/api/public</code></p>
        <div className="mt-3 space-y-1.5 text-sm">
          <ApiEndpoint method="GET" path="/daily"                desc="最新日报" />
          <ApiEndpoint method="GET" path="/daily/{YYYY-MM-DD}"   desc="指定日期日报" />
          <ApiEndpoint method="GET" path="/dailies?take=N"       desc="日报归档列表" />
          <ApiEndpoint method="GET" path="/items?mode=selected"  desc="条目列表（支持 mode / category / cursor / q）" />
          <ApiEndpoint method="GET" path="/topics"               desc="主题列表" />
          <ApiEndpoint method="GET" path="/version"              desc="版本信息" />
        </div>
        <div className="mt-3 rounded-md bg-ink-900 p-3 text-xs text-ink-100 font-mono overflow-x-auto dark:bg-black">
          <pre>{`curl ${SITE.url}/api/public/daily
# → { "date": "2026-07-03", "sections": [...], "flashes": [...] }`}</pre>
        </div>
      </section>

      <section id="skill" className="card p-5">
        <h2 className="section-title">Agent Skill (SKILL.md)</h2>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">适用于 Claude Code、Cursor、Codex 等支持 SKILL.md 的 Agent</p>
        <div className="mt-3 rounded-md bg-ink-900 p-3 text-xs text-ink-100 font-mono overflow-x-auto dark:bg-black">
          <pre>{`---
name: regulatory-hot
description: |
  全球医药监管情报查询工具。当用户问"FDA 最近批了什么药？"、
  "NMPA 有什么新规？"、"帮我看下 EMA 的最新动态"等问题时使用。
---

# Regulatory Hot Skill

## 数据源
- 覆盖 FDA / EMA / NMPA / PMDA / MHRA 等 20+ 监管机构
- 覆盖 WHO / ICH / IMDRF 等 5 大国际组织

## 工具列表
- get_latest_daily()              → 获取最新日报
- search_events(query, category)  → 搜索监管事件
- get_topic(slug)                 → 获取主题详情
- get_event(id)                   → 获取单个事件详情`}</pre>
        </div>
      </section>

      <p className="text-center text-sm text-ink-500 dark:text-ink-400">
        有其他集成需求？<Link href="/feedback" className="text-brand-700 hover:underline dark:text-brand-300">告诉我们 →</Link>
      </p>
    </div>
  );
}

function IntegrationCard({ icon, title, desc, href, status, coming }: {
  icon: string; title: string; desc: string; href: string; status: string; coming?: boolean;
}) {
  return (
    <Link href={href} className="card group block p-4 hover:border-brand-300 dark:hover:border-brand-700">
      <div className="flex items-center justify-between">
        <span className="text-xl" aria-hidden>{icon}</span>
        <span className={`chip border ${coming ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
          {status}
        </span>
      </div>
      <h3 className="mt-2 text-sm font-semibold text-ink-900 group-hover:text-brand-700 dark:text-ink-50 dark:group-hover:text-brand-300">{title}</h3>
      <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{desc}</p>
    </Link>
  );
}

function ApiEndpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 py-1.5 last:border-0 dark:border-ink-800">
      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
        {method}
      </span>
      <code className="font-mono text-xs text-ink-900 dark:text-ink-50">{path}</code>
      <span className="text-xs text-ink-500 dark:text-ink-400">{desc}</span>
    </div>
  );
}
