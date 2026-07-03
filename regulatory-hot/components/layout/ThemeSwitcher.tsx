'use client';

import { useEffect, useState } from 'react';
import { clsx } from 'clsx';

type Theme = 'light' | 'system' | 'dark';

const OPTIONS: Array<{ value: Theme; label: string; path: string }> = [
  {
    value: 'dark', label: '深色',
    path: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
  },
  {
    value: 'system', label: '跟随系统',
    path: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    value: 'light', label: '浅色',
    path: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
  },
];

function applyTheme(theme: Theme) {
  const html = document.documentElement;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  html.classList.toggle('dark', isDark);
  html.dataset.theme = theme;
  try { localStorage.setItem('reghot-theme', theme); } catch {}
}

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem('reghot-theme') as Theme | null) || 'system';
    setTheme(stored);
    setMounted(true);
  }, []);

  function pick(t: Theme) {
    setTheme(t);
    applyTheme(t);
  }

  return (
    <div role="radiogroup" aria-label="主题" className="flex items-center gap-1 rounded-md border border-ink-200 bg-ink-100/50 p-0.5 dark:border-ink-800 dark:bg-ink-900/50">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={mounted ? theme === o.value : o.value === 'system'}
          aria-label={o.label}
          title={o.label}
          onClick={() => pick(o.value)}
          className={clsx(
            'flex-1 rounded p-1.5 transition',
            mounted && theme === o.value
              ? 'bg-white text-brand-600 shadow-sm dark:bg-ink-800 dark:text-brand-300'
              : 'text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-50'
          )}
        >
          <svg className="mx-auto h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={o.path} />
          </svg>
        </button>
      ))}
    </div>
  );
}
