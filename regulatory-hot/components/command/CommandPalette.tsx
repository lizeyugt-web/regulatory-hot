'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon?: string;
  group: string;
  action: () => void;
  keywords?: string[];
}

/**
 * ⌘K 命令面板
 * 暴露 window.openCommandPalette() 全局方法，让侧栏按钮可触发
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const items = useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = [
      { id: 'home',     label: '精选',         hint: 'H',  group: '页面', icon: '✨', action: () => router.push('/'),          keywords: ['selected', 'home'] },
      { id: 'all',      label: '全部动态',     hint: 'A',  group: '页面', icon: '📋', action: () => router.push('/all'),       keywords: ['all'] },
      { id: 'daily',    label: '监管日报',     hint: 'D',  group: '页面', icon: '📅', action: () => router.push('/daily'),     keywords: ['daily'] },
      { id: 'topics',   label: '主题地图',     hint: 'T',  group: '页面', icon: '🗂', action: () => router.push('/topics'),    keywords: ['topics'] },
      { id: 'agent',    label: 'Agent 接入',   hint: 'G',  group: '页面', icon: '🤖', action: () => router.push('/agent'),     keywords: ['agent', 'api'] },
      { id: 'feedback', label: '提交反馈',     hint: 'F',  group: '页面', icon: '💬', action: () => router.push('/feedback'),  keywords: ['feedback'] },
    ];
    const acts: CommandItem[] = [
      {
        id: 'theme-light', label: '切换到浅色模式', group: '主题', icon: '☀️',
        action: () => { document.documentElement.classList.remove('dark'); try { localStorage.setItem('reghot-theme','light'); } catch {} },
      },
      {
        id: 'theme-dark', label: '切换到深色模式', group: '主题', icon: '🌙',
        action: () => { document.documentElement.classList.add('dark'); try { localStorage.setItem('reghot-theme','dark'); } catch {} },
      },
      {
        id: 'theme-system', label: '跟随系统主题', group: '主题', icon: '💻',
        action: () => {
          try { localStorage.setItem('reghot-theme','system'); } catch {}
          const dark = matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.classList.toggle('dark', dark);
        },
      },
      {
        id: 'copy-api', label: '复制 API Base URL', group: '操作', icon: '📋',
        action: () => { navigator.clipboard?.writeText(`${window.location.origin}/api/public`); },
      },
      {
        id: 'open-rss', label: '打开 RSS 订阅', group: '操作', icon: '📡',
        action: () => window.open('/rss.xml', '_blank'),
      },
      {
        id: 'open-api', label: '打开 API 文档', group: '操作', icon: '🔌',
        action: () => window.open('/api/public/daily', '_blank'),
      },
    ];
    return [...nav, ...acts];
  }, [router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      const hay = `${it.label} ${it.hint ?? ''} ${(it.keywords ?? []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  // 暴露全局方法
  useEffect(() => {
    (window as any).openCommandPalette = () => setOpen(true);
    return () => { delete (window as any).openCommandPalette; };
  }, []);

  // 快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setActiveIdx(0);
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        filtered[activeIdx]?.action();
        setOpen(false);
      }
    },
    [filtered, activeIdx]
  );

  if (!open) return null;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, it) => {
    if (!acc[it.group]) acc[it.group] = [];
    acc[it.group].push(it);
    return acc;
  }, {});

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="命令面板"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] sm:pt-[18vh]"
      style={{ animation: 'fadeIn 0.18s ease-out' }}
    >
      <div
        className="absolute inset-0 bg-ink-950/60 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop dark:border-ink-800 dark:bg-ink-900"
        style={{ animation: 'slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="flex items-center gap-2 border-b border-ink-100 px-4 dark:border-ink-800">
          <svg className="h-4 w-4 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={onKeyDown}
            placeholder="搜索页面、操作…"
            className="flex-1 bg-transparent py-3 text-sm text-ink-900 placeholder-ink-400 outline-none dark:text-ink-50 dark:placeholder-ink-500"
            aria-label="搜索命令"
          />
          <kbd className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-2xs font-medium text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-400">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-ink-500 dark:text-ink-400">
              没有匹配的命令
            </div>
          )}
          {Object.entries(grouped).map(([group, list]) => (
            <div key={group} className="mb-1">
              <div className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                {group}
              </div>
              {list.map((it) => {
                const globalIdx = filtered.indexOf(it);
                const isActive = globalIdx === activeIdx;
                return (
                  <button
                    key={it.id}
                    onClick={() => { it.action(); setOpen(false); }}
                    onMouseEnter={() => setActiveIdx(globalIdx)}
                    className={clsx(
                      'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                      isActive
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300'
                        : 'text-ink-700 dark:text-ink-300'
                    )}
                  >
                    <span className="text-base" aria-hidden>{it.icon}</span>
                    <span className="flex-1">{it.label}</span>
                    {it.hint && (
                      <kbd className="rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-2xs font-medium text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-400">
                        {it.hint}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-ink-100 bg-ink-50/60 px-4 py-2 text-2xs text-ink-500 dark:border-ink-800 dark:bg-ink-925/60 dark:text-ink-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-ink-200 bg-white px-1 dark:border-ink-700 dark:bg-ink-800">↑</kbd>
              <kbd className="rounded border border-ink-200 bg-white px-1 dark:border-ink-700 dark:bg-ink-800">↓</kbd>
              <span>切换</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-ink-200 bg-white px-1.5 dark:border-ink-700 dark:bg-ink-800">↵</kbd>
              <span>选择</span>
            </span>
          </div>
          <span>RegHot · ⌘K</span>
        </div>
      </div>
    </div>
  );
}
