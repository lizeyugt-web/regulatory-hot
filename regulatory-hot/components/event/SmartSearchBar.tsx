'use client';

/**
 * 智能搜索栏
 *
 * 统一搜索入口：搜索框 + 搜索模式下拉 + 时间范围 + 精选开关
 * 替代原有的 FilterToolbar
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useTransition, useRef } from 'react';
import clsx from 'clsx';

// ============ 搜索模式 ============
const SEARCH_MODES = [
  { value: 'full',    label: '全文搜索', placeholder: '搜索标题、摘要、正文…' },
  { value: 'title',   label: '标题搜索', placeholder: '搜索文章标题…' },
  { value: 'summary', label: '摘要搜索', placeholder: '搜索AI摘要…' },
  { value: 'source',  label: '公众号搜索', placeholder: '输入公众号名称…' },
  { value: 'tag',     label: '标签搜索',   placeholder: '搜索标签关键词…' },
] as const;

const TIME_RANGES = [
  { value: '',     label: '不限时间' },
  { value: '1d',   label: '今天' },
  { value: '3d',   label: '最近 3 天' },
  { value: '7d',   label: '最近 7 天' },
  { value: '30d',  label: '最近 30 天' },
] as const;

interface Props {
  basePath: string;
  /** 可搜索的公众号列表（用于自动补全提示） */
  accounts?: string[];
}

export function SmartSearchBar({ basePath, accounts = [] }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(sp.get('q') ?? '');
  const [mode, setMode] = useState((sp.get('mode') as string) ?? 'full');
  const [timeRange, setTimeRange] = useState(sp.get('range') ?? '');
  const [selectedOnly, setSelectedOnly] = useState(sp.get('selected') === '1');
  const [modeOpen, setModeOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const modeRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQ(sp.get('q') ?? '');
    setMode(sp.get('mode') ?? 'full');
    setTimeRange(sp.get('range') ?? '');
    setSelectedOnly(sp.get('selected') === '1');
  }, [sp]);

  // 点击外部关闭下拉
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (modeRef.current && !modeRef.current.contains(e.target as Node)) setModeOpen(false);
      if (timeRef.current && !timeRef.current.contains(e.target as Node)) setTimeOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function pushParams(mut: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(sp.toString());
    mut(params);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    });
  }

  function applySearch() {
    pushParams((p) => {
      if (q.trim()) p.set('q', q.trim()); else p.delete('q');
      if (mode !== 'full') p.set('mode', mode); else p.delete('mode');
      if (timeRange) p.set('range', timeRange); else p.delete('range');
      if (selectedOnly) p.set('selected', '1'); else p.delete('selected');
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    applySearch();
  }

  function handleModeSelect(m: string) {
    setMode(m);
    setModeOpen(false);
    // 立即应用
    pushParams((p) => {
      if (q.trim()) p.set('q', q.trim()); else p.delete('q');
      if (m !== 'full') p.set('mode', m); else p.delete('mode');
      if (timeRange) p.set('range', timeRange); else p.delete('range');
      if (selectedOnly) p.set('selected', '1'); else p.delete('selected');
    });
  }

  function handleTimeSelect(r: string) {
    setTimeRange(r);
    setTimeOpen(false);
    pushParams((p) => {
      if (q.trim()) p.set('q', q.trim()); else p.delete('q');
      if (mode !== 'full') p.set('mode', mode); else p.delete('mode');
      if (r) p.set('range', r); else p.delete('range');
      if (selectedOnly) p.set('selected', '1'); else p.delete('selected');
    });
  }

  function handleSelectedToggle() {
    const next = !selectedOnly;
    setSelectedOnly(next);
    pushParams((p) => {
      if (q.trim()) p.set('q', q.trim()); else p.delete('q');
      if (mode !== 'full') p.set('mode', mode); else p.delete('mode');
      if (timeRange) p.set('range', timeRange); else p.delete('range');
      if (next) p.set('selected', '1'); else p.delete('selected');
    });
  }

  function clearAll() {
    setQ('');
    setMode('full');
    setTimeRange('');
    setSelectedOnly(false);
    startTransition(() => {
      router.push(basePath, { scroll: false });
    });
  }

  const hasFilters = q || mode !== 'full' || timeRange || selectedOnly;
  const currentMode = SEARCH_MODES.find(m => m.value === mode) ?? SEARCH_MODES[0];
  const currentTime = TIME_RANGES.find(t => t.value === timeRange) ?? TIME_RANGES[0];

  return (
    <div className="card">
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
        {/* 搜索输入框 */}
        <div className="relative flex-1">
          <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={currentMode.placeholder}
            className="w-full rounded-lg border border-ink-200 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder-ink-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200/60 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50 dark:placeholder-ink-500 dark:focus:border-brand-400 dark:focus:ring-brand-700/40"
          />
          {q && (
            <button type="button" onClick={() => { setQ(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-400 hover:text-ink-600">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {/* 搜索按钮 */}
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 active:bg-brand-800"
          title="开始搜索（支持模糊匹配）"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          搜索
        </button>

        {/* 搜索模式下拉 */}
        <div className="relative" ref={modeRef}>
          <button
            type="button"
            onClick={() => { setModeOpen(!modeOpen); setTimeOpen(false); }}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
              mode !== 'full'
                ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-300'
                : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300'
            )}
          >
            {currentMode.label}
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {modeOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-lg border border-ink-200 bg-white py-1 shadow-lg dark:border-ink-700 dark:bg-ink-900">
              {SEARCH_MODES.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => handleModeSelect(m.value)}
                  className={clsx(
                    'w-full px-3 py-1.5 text-left text-sm transition-colors',
                    mode === m.value
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'text-ink-700 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800'
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 时间范围下拉 */}
        <div className="relative" ref={timeRef}>
          <button
            type="button"
            onClick={() => { setTimeOpen(!timeOpen); setModeOpen(false); }}
            className={clsx(
              'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
              timeRange
                ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-300'
                : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300'
            )}
          >
            {currentTime.label}
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          {timeOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-32 rounded-lg border border-ink-200 bg-white py-1 shadow-lg dark:border-ink-700 dark:bg-ink-900">
              {TIME_RANGES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => handleTimeSelect(t.value)}
                  className={clsx(
                    'w-full px-3 py-1.5 text-left text-sm transition-colors',
                    timeRange === t.value
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'text-ink-700 hover:bg-ink-50 dark:text-ink-300 dark:hover:bg-ink-800'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 精选开关 */}
        <button
          type="button"
          onClick={handleSelectedToggle}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
            selectedOnly
              ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200'
              : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300'
          )}
        >
          <span aria-hidden>✦</span>
          <span>精选</span>
        </button>

        {/* 清除 */}
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg px-2 py-2 text-sm text-ink-400 transition-colors hover:text-red-600 dark:text-ink-500 dark:hover:text-red-400"
            title="清除所有筛选"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        )}
      </form>
    </div>
  );
}
