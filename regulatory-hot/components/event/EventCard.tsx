'use client';

import Link from 'next/link';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { RegulatoryEvent } from '@/lib/types';
import { ImportanceBadge } from './ImportanceBadge';
import { CategoryChip } from './CategoryChip';
import { SourceBadge } from './SourceBadge';

interface Props {
  event: RegulatoryEvent;
  variant?: 'default' | 'lead' | 'compact' | 'grid';
}

/**
 * AIHOT 风格事件卡片
 * 排版：15px 正文 / 1.7 行高 / 标题 -0.015em / 数字 tabular-nums
 */
export function EventCard({ event, variant = 'default' }: Props) {
  if (variant === 'lead') return <LeadCard event={event} />;
  if (variant === 'compact') return <CompactCard event={event} />;
  if (variant === 'grid') return <GridCard event={event} />;
  return <TimelineRow event={event} />;
}

// ===========================================================================
// 头条卡片
// ===========================================================================
function LeadCard({ event }: { event: RegulatoryEvent }) {
  const titleDisplay = event.title || event.titleEn || '';
  const summaryDisplay = event.aiSummaryCn || event.summary || '';

  return (
    <Link
      href={event.permalink}
      className="group block rounded-xl border border-brand-300 bg-gradient-to-br from-brand-50/60 via-white to-white p-6 shadow-soft transition-all duration-300 ease-out-expo hover:shadow-pop dark:border-brand-700/50 dark:from-brand-950/30 dark:via-ink-900 dark:to-ink-925"
    >
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="rounded-md bg-gradient-to-br from-brand-500 to-brand-700 px-2 py-0.5 font-semibold uppercase tracking-wider text-white shadow-sm">
          TOP 1
        </span>
        <span className="font-medium tracking-wide text-ink-500 dark:text-ink-400">今日焦点</span>
        <ImportanceBadge level={event.importance} />
        <CategoryChip category={event.category} />
        {event.clusterSize && event.clusterSize > 1 && (
          <span className="chip border border-ink-200 bg-white text-ink-500 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
            <span className="tnum">{event.clusterSize}</span> 源
          </span>
        )}
        <span className="ml-auto tnum rounded bg-white/80 px-1.5 py-0.5 font-mono text-2xs text-ink-500 dark:bg-ink-900/80 dark:text-ink-400">
          {event.finalScore}
        </span>
      </div>
      <h2 className="mt-3.5 text-[1.5rem] font-bold leading-[1.25] tracking-tight text-ink-900 text-balance group-hover:text-brand-700 dark:text-ink-25 dark:group-hover:text-brand-300">
        {titleDisplay}
      </h2>
      <p className="mt-2.5 text-[0.9375rem] leading-[1.7] text-ink-700 dark:text-ink-300 text-pretty">
        {summaryDisplay}
      </p>
      {/* 推荐理由 */}
      {event.aiReason && (
        <div className="mt-3 rounded-md border-l-2 border-amber-400 bg-amber-50/40 px-3 py-2 dark:border-amber-700/60 dark:bg-amber-950/10">
          <p className="text-xs leading-[1.6] text-amber-900 dark:text-amber-200/90">
            <span className="font-semibold tracking-wide">💡 推荐理由：</span>
            {event.aiReason}
          </p>
        </div>
      )}
      <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs tracking-wide text-ink-500 dark:text-ink-400">
        <SourceBadge sourceId={event.sourceId} />
        <span className="text-ink-300 dark:text-ink-700">·</span>
        <time dateTime={event.publishedAt}>
          {formatDistanceToNowStrict(new Date(event.publishedAt), { addSuffix: true, locale: zhCN })}
        </time>
        {event.therapeuticArea && (
          <>
            <span className="text-ink-300 dark:text-ink-700">·</span>
            <span>{event.therapeuticArea}</span>
          </>
        )}
      </div>
    </Link>
  );
}

// ===========================================================================
// 时间轴行式卡片（"全部"页面主要样式）
// ===========================================================================
function TimelineRow({ event }: { event: RegulatoryEvent }) {
  const titleDisplay = event.title || event.titleEn || '';
  const summaryDisplay = event.aiSummaryCn || event.summary || '';

  return (
    <article className="group relative flex gap-3 py-4 first:pt-0">
      {/* 时间线左轴 */}
      <div className="relative flex w-14 flex-shrink-0 flex-col items-center pt-0.5">
        <span className="tnum text-xs font-medium tabular-nums text-ink-500 dark:text-ink-400">
          {formatTimeLabel(event.publishedAt)}
        </span>
        <span className="timeline-dot mt-2" />
      </div>

      {/* 内容区 */}
      <div className="min-w-0 flex-1">
        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {event.selected && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-700 ring-1 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/40">
              <span aria-hidden>✦</span>
              <span className="font-medium tracking-wide">精选</span>
            </span>
          )}
          <SourceBadge sourceId={event.sourceId} showLevel={false} />
          <CategoryChip category={event.category} />
          {event.clusterSize && event.clusterSize > 1 && (
            <span className="chip border border-ink-200 bg-ink-50 text-ink-500 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
              <span className="tnum">{event.clusterSize}</span> 源
            </span>
          )}
          <ImportanceBadge level={event.importance} showLabel={false} />
          <span className="ml-auto tnum rounded bg-ink-100/70 px-1.5 py-0.5 font-mono text-2xs text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
            {event.finalScore}
          </span>
        </div>

        {/* 标题 — 优先显示 AI 翻译的中文标题 */}
        <h3 className="mt-2 text-[0.9375rem] font-semibold leading-[1.5] tracking-tight text-ink-900 text-balance group-hover:text-brand-700 dark:text-ink-50 dark:group-hover:text-brand-300">
          <Link href={event.permalink} className="tap-none">
            {titleDisplay}
          </Link>
        </h3>

        {/* AI 中文摘要 */}
        {summaryDisplay && (
          <p className="mt-1.5 line-clamp-3 text-sm leading-[1.7] text-ink-600 text-pretty dark:text-ink-400">
            {summaryDisplay}
          </p>
        )}

        {/* 标签 */}
        {event.tags && event.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {event.tags.slice(0, 5).map((t) => (
              <span
                key={t}
                className="chip-outline rounded-md px-1.5 py-0.5 text-2xs"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* 推荐理由 — 优先 AI 推荐理由，降级到规则生成 */}
        {event.aiReason && (
          <div className="mt-3 rounded-md border-l-2 border-amber-400 bg-amber-50/40 px-3 py-2 dark:border-amber-700/60 dark:bg-amber-950/10">
            <p className="text-xs leading-[1.6] text-amber-900 dark:text-amber-200/90">
              <span className="font-semibold tracking-wide">💡 推荐理由：</span>
              {event.aiReason}
            </p>
          </div>
        )}
        {/* 降级：规则推荐理由（仅当无 AI 推荐理由且高分精选时） */}
        {!event.aiReason && event.selected && event.finalScore >= 80 && (
          <div className="mt-3 rounded-md border-l-2 border-amber-400 bg-amber-50/40 px-3 py-2 dark:border-amber-700/60 dark:bg-amber-950/10">
            <p className="text-xs leading-[1.6] text-amber-900 dark:text-amber-200/90">
              <span className="font-semibold tracking-wide">推荐理由：</span>
              {generateReason(event)}
            </p>
          </div>
        )}

        {/* Meta footer */}
        <div className="mt-2.5 flex items-center gap-2 text-xs tracking-wide text-ink-500 dark:text-ink-400">
          <time dateTime={event.publishedAt} className="tnum">
            {formatDistanceToNowStrict(new Date(event.publishedAt), { addSuffix: true, locale: zhCN })}
          </time>
          {event.therapeuticArea && (
            <>
              <span className="text-ink-300 dark:text-ink-700">·</span>
              <span>{event.therapeuticArea}</span>
            </>
          )}
          {event.productType && (
            <>
              <span className="text-ink-300 dark:text-ink-700">·</span>
              <span>{event.productType}</span>
            </>
          )}
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-0.5 text-ink-400 transition-colors hover:text-brand-600 dark:hover:text-brand-400"
          >
            <span>原文</span>
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </a>
        </div>
      </div>
    </article>
  );
}

// ===========================================================================
// 紧凑卡片（侧边栏/相关推荐用）
// ===========================================================================
function CompactCard({ event }: { event: RegulatoryEvent }) {
  const titleDisplay = event.title || event.titleEn || '';

  return (
    <Link href={event.permalink} className="group block py-2.5 tap-none">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="line-clamp-2 text-[13px] font-medium leading-[1.5] text-ink-900 group-hover:text-brand-700 dark:text-ink-100 dark:group-hover:text-brand-300">
          {titleDisplay}
        </h4>
        <span className="tnum flex-shrink-0 rounded bg-ink-100/60 px-1 py-0.5 font-mono text-[10px] text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
          {event.finalScore}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-500 dark:text-ink-400">
        <SourceBadge sourceId={event.sourceId} showLevel={false} />
        <span className="text-ink-300 dark:text-ink-700">·</span>
        <time className="tnum">
          {formatDistanceToNowStrict(new Date(event.publishedAt), { addSuffix: true, locale: zhCN })}
        </time>
      </div>
    </Link>
  );
}

// ===========================================================================
// 网格卡片
// ===========================================================================
function GridCard({ event }: { event: RegulatoryEvent }) {
  const titleDisplay = event.title || event.titleEn || '';
  const summaryDisplay = event.aiSummaryCn || event.summary || '';

  return (
    <Link
      href={event.permalink}
      className="group tap-none flex h-full flex-col rounded-lg border border-ink-200/70 bg-white p-3 transition-all duration-200 hover:border-brand-300 hover:shadow-soft dark:border-ink-800/70 dark:bg-ink-900 dark:hover:border-brand-500/50"
    >
      {/* 顶部 meta 行 */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1 text-[10px]">
        <CategoryChip category={event.category} />
        <ImportanceBadge level={event.importance} showLabel={false} />
        {event.clusterSize && event.clusterSize > 1 && (
          <span className="chip border border-ink-200 bg-ink-50 text-ink-500 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
            <span className="tnum">{event.clusterSize}</span> 源
          </span>
        )}
        <span className="ml-auto tnum rounded bg-ink-100/70 px-1 py-px font-mono text-[10px] text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
          {event.finalScore}
        </span>
      </div>

      {/* 标题 */}
      <h3 className="text-[13.5px] font-semibold leading-[1.45] tracking-tight text-ink-900 text-balance line-clamp-2 group-hover:text-brand-700 dark:text-ink-50 dark:group-hover:text-brand-300">
        {titleDisplay}
      </h3>

      {/* 摘要 */}
      <p className="mt-1.5 line-clamp-2 text-[12px] leading-[1.55] text-ink-600 dark:text-ink-400">
        {summaryDisplay}
      </p>

      {/* 标签（紧凑） */}
      {event.tags && event.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {event.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded border border-ink-200 bg-ink-50/60 px-1.5 py-px text-[10px] text-ink-600 dark:border-ink-800 dark:bg-ink-925/40 dark:text-ink-400"
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* 底部 meta */}
      <div className="mt-auto flex items-center gap-1.5 pt-2 text-[11px] text-ink-500 dark:text-ink-400">
        <SourceBadge sourceId={event.sourceId} showLevel={false} />
        <span className="text-ink-300 dark:text-ink-700">·</span>
        <time className="tnum">
          {formatDistanceToNowStrict(new Date(event.publishedAt), { addSuffix: true, locale: zhCN })}
        </time>
        {event.therapeuticArea && (
          <>
            <span className="text-ink-300 dark:text-ink-700">·</span>
            <span className="truncate">{event.therapeuticArea}</span>
          </>
        )}
      </div>
    </Link>
  );
}

// ===========================================================================
// 工具函数
// ===========================================================================

function formatTimeLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

/** 规则生成的推荐理由（降级方案） */
function generateReason(event: RegulatoryEvent): string {
  const bits: string[] = [];
  if (event.importance === 5) bits.push('重大影响');
  if (event.sourceLevel === 'T1') bits.push(`${event.sourceName}官方发布`);
  if (event.productType) bits.push(`涉及${event.productType}`);
  if (event.therapeuticArea) bits.push(`聚焦${event.therapeuticArea}领域`);
  if (event.clusterSize && event.clusterSize > 1) bits.push(`${event.clusterSize} 个信源同步报道`);
  if (bits.length === 0) bits.push('AI 多维评分较高');
  return bits.join('，') + '。';
}
