'use client';

import { useState } from 'react';
import { formatDistanceToNowStrict, format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { RegulatoryEvent } from '@/lib/types';
import { ImportanceBadge } from './ImportanceBadge';
import { CategoryChip } from './CategoryChip';
import { SourceBadge } from './SourceBadge';
import { ShareActions } from './ShareActions';
import { CATEGORIES } from '@/lib/config';
import Link from 'next/link';

interface Props {
  event: RegulatoryEvent;
  prev?: RegulatoryEvent | null;
  next?: RegulatoryEvent | null;
  related?: RegulatoryEvent[];
  catLabel: string;
}

/**
 * AIHOT 风格详情页核心组件
 */
export function DetailView({ event, prev, next, related, catLabel }: Props) {
  const [showOriginal, setShowOriginal] = useState(false);

  const titleDisplay = event.title || event.titleEn || '';
  const titleEnDisplay = event.titleEn || '';
  const summaryDisplay = event.aiSummaryCn || event.summary || '';
  const hasTranslation = !!event.contentCn;
  const hasOriginal = !!event.contentOriginal;

  // SPEC-H: 微信公众号来源不显示正文，改为跳转提示
  const isWechatSource = event._source === 'wechat' || (event.sourceId || '').startsWith('wechat-');

  const displayContent = showOriginal
    ? (event.contentOriginal || '')
    : (event.contentCn || event.contentOriginal || '');

  const contentLabel = showOriginal
    ? (event.contentOriginalLang === 'zh' ? '中文原文' : '英文原文')
    : '中文翻译';

  const publishedDate = new Date(event.publishedAt);
  const timeAgo = formatDistanceToNowStrict(publishedDate, { addSuffix: true, locale: zhCN });
  const dateStr = format(publishedDate, 'yyyy年M月d日 HH:mm', { locale: zhCN });

  return (
    <div className="max-w-3xl">
      {/* 面包屑导航 */}
      <nav aria-label="面包屑" className="mb-4 flex items-center gap-1.5 text-xs text-ink-500 dark:text-ink-400">
        <Link href="/" className="hover:text-brand-600 dark:hover:text-brand-400">首页</Link>
        <Chevron />
        <Link href={`/?category=${event.category}`} className="hover:text-brand-600 dark:hover:text-brand-400">
          {catLabel}
        </Link>
        <Chevron />
        <span className="truncate text-ink-700 dark:text-ink-300">{titleDisplay}</span>
      </nav>

      <article className="card overflow-hidden">
        {/* 头部：标题 + 元信息 */}
        <header className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {event.selected && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-amber-700 ring-1 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/40">
                <span aria-hidden>✦</span>
                <span className="font-medium tracking-wide">精选</span>
              </span>
            )}
            <ImportanceBadge level={event.importance} />
            <CategoryChip category={event.category} />
            <SourceBadge sourceId={event.sourceId} />
            {event.clusterSize && event.clusterSize > 1 && (
              <span className="chip border border-ink-200 bg-ink-50 text-ink-500 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-400">
                <span className="tnum">{event.clusterSize}</span> 源
              </span>
            )}
            <span className="ml-auto tnum rounded bg-ink-100/70 px-1.5 py-0.5 font-mono text-2xs text-ink-500 dark:bg-ink-800/60 dark:text-ink-400">
              {event.finalScore}
            </span>
          </div>

          {/* 中文标题 */}
          <h1 className="mt-3.5 text-[1.5rem] font-bold leading-[1.3] tracking-tight text-ink-900 text-balance dark:text-ink-25 sm:text-[1.75rem]">
            {titleDisplay}
          </h1>

          {/* 英文原标题（如果有） */}
          {titleEnDisplay && titleEnDisplay !== titleDisplay && (
            <p className="mt-2 text-sm italic text-ink-500 text-pretty dark:text-ink-400">
              {titleEnDisplay}
            </p>
          )}

          {/* 时间 + 相对时间 */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs tracking-wide text-ink-500 dark:text-ink-400">
            <time dateTime={event.publishedAt} className="tnum">
              {dateStr}
            </time>
            <Dot />
            <span className="tnum">{timeAgo}</span>
            {event.sourceName && (
              <>
                <Dot />
                <span>
                  来源：
                  <a
                    className="ml-1 text-brand-700 hover:underline dark:text-brand-400"
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {event.sourceName}
                  </a>
                </span>
              </>
            )}
          </div>
        </header>

        {/* AI 摘要区块 */}
        <section className="border-t border-ink-200/60 px-6 py-5 sm:px-8 dark:border-ink-800/40">
          <h2 className="text-2xs font-semibold uppercase tracking-widest text-ink-400 dark:text-ink-500">
            🤖 AI 摘要
          </h2>
          <p className="mt-2 text-[0.9375rem] leading-[1.75] text-ink-700 text-pretty dark:text-ink-200">
            {summaryDisplay}
          </p>
          {event.aiSummaryModel && (
            <p className="mt-2 text-[10px] text-ink-400 dark:text-ink-500">
              分析模型：{event.aiSummaryModel}
              {event.aiAnalyzedAt && ` · ${format(new Date(event.aiAnalyzedAt), 'MM-dd HH:mm', { locale: zhCN })}`}
            </p>
          )}
        </section>

        {/* 正文区块 */}
        {/* SPEC-H: 微信公众号来源隐藏正文，显示跳转提示 */}
        {isWechatSource ? (
          <section className="border-t border-ink-200/60 px-6 py-5 sm:px-8 dark:border-ink-800/40">
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 text-center dark:border-blue-800 dark:bg-blue-950/20">
              <div className="mb-2 text-2xl">📱</div>
              <h3 className="mb-1 text-sm font-semibold text-blue-800 dark:text-blue-200">
                微信公众号来源
              </h3>
              <p className="mb-4 text-xs leading-relaxed text-blue-700 dark:text-blue-300">
                本文来自微信公众号「{event.sourceName || '未知'}」，请点击下方按钮查看原文。
              </p>
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
              >
                <ExternalIcon />
                <span>阅读原文</span>
              </a>
            </div>
          </section>
        ) : displayContent ? (
          <section className="border-t border-ink-200/60 px-6 py-5 sm:px-8 dark:border-ink-800/40">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xs font-semibold uppercase tracking-widest text-ink-400 dark:text-ink-500">
                📄 {contentLabel}
              </h2>
              {/* 中英切换按钮 */}
              {(hasTranslation || hasOriginal) && (
                <button
                  onClick={() => setShowOriginal(!showOriginal)}
                  className="inline-flex items-center gap-1 rounded-md border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 transition-colors hover:border-brand-300 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:border-brand-600 dark:hover:text-brand-400"
                >
                  {showOriginal ? (
                    <>
                      <TranslateIcon />
                      <span>查看中文</span>
                    </>
                  ) : (
                    <>
                      <OriginalIcon />
                      <span>查看原文</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="prose prose-sm max-w-none text-[0.9375rem] leading-[1.8] text-ink-700 dark:text-ink-200">
              {displayContent.split('\n').map((para, i) => {
                const trimmed = para.trim();
                if (!trimmed) return <br key={i} />;
                return <p key={i} className="mb-3">{trimmed}</p>;
              })}
            </div>
            {event.aiTranslateModel && (
              <p className="mt-3 text-[10px] text-ink-400 dark:text-ink-500">
                翻译模型：{event.aiTranslateModel}
                {event.aiTranslateAt && ` · ${format(new Date(event.aiTranslateAt), 'MM-dd HH:mm', { locale: zhCN })}`}
              </p>
            )}
          </section>
        ) : null}

        {/* 推荐理由 */}
        {event.aiReason && (
          <section className="border-t border-ink-200/60 bg-amber-50/30 px-6 py-4 sm:px-8 dark:border-ink-800/40 dark:bg-amber-950/10">
            <p className="text-sm leading-[1.7] text-amber-900 dark:text-amber-200/90">
              <span className="font-semibold">💡 推荐理由：</span>
              {event.aiReason}
            </p>
          </section>
        )}

        {/* 五维评分 */}
        <section className="border-t border-ink-200/60 bg-ink-50/40 px-6 py-5 sm:px-8 dark:border-ink-800/40 dark:bg-ink-925/30">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xs font-semibold uppercase tracking-widest text-ink-400 dark:text-ink-500">评分详情</h2>
            <p className="text-2xs text-ink-500 dark:text-ink-400">
              综合分 <span className="tnum font-semibold text-ink-900 dark:text-ink-50">{event.finalScore}</span>/100
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { key: 'sourceAuthority', label: '信源权威' },
              { key: 'impactScope', label: '影响范围' },
              { key: 'timeliness', label: '时效性' },
              { key: 'complianceUrgency', label: '合规紧急' },
              { key: 'industryAttention', label: '行业关注' },
            ].map((dim) => {
              const v = (event.scores as any)[dim.key] as number;
              return (
                <div key={dim.key} className="rounded-md border border-ink-200/70 bg-white p-2.5 text-center dark:border-ink-800/60 dark:bg-ink-900/40">
                  <p className="text-[11px] text-ink-500 dark:text-ink-400">{dim.label}</p>
                  <p className="tnum mt-0.5 text-lg font-bold text-ink-900 dark:text-ink-50">{v}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 标签 + 操作 */}
        <section className="border-t border-ink-200/60 px-6 py-5 sm:px-8 dark:border-ink-800/40">
          {/* 标签 */}
          {event.tags && event.tags.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {event.tags.map((t) => (
                <span
                  key={t}
                  className="chip-outline rounded-md px-2 py-1 text-xs"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* 阅读原文按钮 */}
          <div className="mb-4">
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-700"
            >
              <ExternalIcon />
              <span>阅读原文</span>
            </a>
          </div>

          {/* 分享操作 */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-500 dark:text-ink-400">操作：</span>
            <ShareActions eventId={event.id} title={titleDisplay} />
          </div>
        </section>
      </article>

      {/* 上一条 / 下一条导航 */}
      <nav className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="条目导航">
        {prev ? (
          <Link href={prev.permalink} className="card group flex flex-col gap-1 p-3 hover:border-brand-300 dark:hover:border-brand-700">
            <span className="text-2xs tracking-wider text-ink-400 dark:text-ink-500">← 上一条</span>
            <span className="line-clamp-2 text-sm font-medium text-ink-900 group-hover:text-brand-700 dark:text-ink-50 dark:group-hover:text-brand-300">
              {prev.title || prev.titleEn || ''}
            </span>
          </Link>
        ) : <div />}
        {next ? (
          <Link href={next.permalink} className="card group flex flex-col gap-1 p-3 text-right hover:border-brand-300 dark:hover:border-brand-700">
            <span className="text-2xs tracking-wider text-ink-400 dark:text-ink-500">下一条 →</span>
            <span className="line-clamp-2 text-sm font-medium text-ink-900 group-hover:text-brand-700 dark:text-ink-50 dark:group-hover:text-brand-300">
              {next.title || next.titleEn || ''}
            </span>
          </Link>
        ) : <div />}
      </nav>

      {/* 相关推荐 */}
      {related && related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight text-ink-900 dark:text-ink-50">
            <span>相关推荐</span>
            <span className="h-px flex-1 bg-ink-200 dark:bg-ink-800" />
          </h2>
          <div className="divide-y divide-ink-100 rounded-lg border border-ink-200 bg-white p-4 dark:divide-ink-800 dark:border-ink-800 dark:bg-ink-900">
            {related.map((e) => (
              <CompactRelatedCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ===========================================================================
// 子组件
// ===========================================================================

function CompactRelatedCard({ event }: { event: RegulatoryEvent }) {
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

function Chevron() {
  return <svg className="h-3 w-3 text-ink-300 dark:text-ink-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>;
}

function Dot() {
  return <span className="text-ink-300 dark:text-ink-700">·</span>;
}

function ExternalIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7V17" /></svg>;
}

function TranslateIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 8l6 6" /><path d="M4 14l6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" /><path d="M22 22l-5-10-5 10" /><path d="M14 18h6" />
    </svg>
  );
}

function OriginalIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14,2 14,8 20,8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10,9 9,9 8,9" />
    </svg>
  );
}
