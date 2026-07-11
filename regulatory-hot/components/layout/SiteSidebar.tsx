'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { SITE } from '@/lib/config';
import { ThemeSwitcher } from './ThemeSwitcher';
import { SearchTrigger } from './SearchTrigger';
import { useEffect, useState } from 'react';

const NAV_SECTIONS = [
  {
    label: '内容',
    items: [
      { href: '/',       label: '精选',   icon: 'sparkles', shortcut: 'H' },
      { href: '/all',    label: '全部',   icon: 'list',     shortcut: 'A' },
      { href: '/daily',  label: '日报',   icon: 'calendar', shortcut: 'D' },
      { href: '/topics', label: '主题',   icon: 'tag',      shortcut: 'T' },
      { href: '/favorites', label: '收藏', icon: 'star',    shortcut: 'F' },
    ],
  },
  {
    label: '接入',
    items: [
      { href: '/agent', label: 'Agent 接入', icon: 'plug', shortcut: 'G' },
    ],
  },
  {
    label: '管理',
    items: [
      { href: 'https://47.107.133.169:3443/dashboard/account', label: '公众号管理', icon: 'wechat', external: true },
    ],
  },
  {
    label: '更多',
    items: [
      { href: '/about',     label: '关于',     icon: 'info' },
      { href: '/changelog', label: '更新日志', icon: 'history' },
      { href: '/feedback',  label: '反馈',     icon: 'message' },
    ],
  },
];

const ICON_PATHS: Record<string, string> = {
  sparkles: 'M12 3v2m0 14v2M5 12H3m18 0h-2M5.6 5.6l1.4 1.4m10 10l1.4 1.4M5.6 18.4l1.4-1.4m10-10l1.4-1.4M12 7a5 5 0 100 10 5 5 0 000-10z',
  list:     'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  tag:      'M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.99 1.99 0 013 12V7a4 4 0 014-4z',
  star:     'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.05 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z',
  plug:     'M13 10V3L4 14h7v7l9-11h-7z',
  info:     'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  history:  'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  message:  'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  wechat:   'M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-4.064 0-7.357 2.601-7.357 5.81 0 3.207 3.293 5.808 7.357 5.808.972 0 1.916-.163 2.791-.467a.795.795 0 01.66.09l1.758 1.029a.299.299 0 00.153.05.27.27 0 00.267-.272c0-.066-.027-.13-.045-.197l-.359-1.367a.546.546 0 01.196-.615C24.057 18.045 25 16.56 25 14.668c0-3.208-3.293-5.81-7.357-5.81zm-3.566 3.223c.594 0 1.074.489 1.074 1.09a1.082 1.082 0 01-1.074 1.09c-.593 0-1.074-.488-1.074-1.09 0-.601.48-1.09 1.074-1.09zm5.374 0c.594 0 1.074.489 1.074 1.09a1.082 1.082 0 01-1.074 1.09c-.594 0-1.074-.488-1.074-1.09 0-.601.48-1.09 1.074-1.09z',
};

function Icon({ name }: { name: string }) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  return (
    <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function SiteSidebar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(href + '/');
  }

  // 单字母快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      const map: Record<string, string> = { h: '/', a: '/all', d: '/daily', t: '/topics', f: '/favorites', g: '/agent' };
      const k = e.key.toLowerCase();
      if (map[k]) {
        e.preventDefault();
        window.location.href = map[k];
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <aside className="sidebar" aria-label="主导航">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 px-3 pb-5 tap-none">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white font-bold text-sm shadow-soft">
          R
        </div>
        <div className="min-w-0">
          <div className="font-semibold tracking-tight text-ink-900 dark:text-ink-25 leading-tight truncate">
            {SITE.name}
          </div>
          <div className="text-[10px] tracking-wide text-ink-500 dark:text-ink-400 leading-tight truncate">
            {SITE.tagline}
          </div>
        </div>
      </Link>

      {/* 搜索按钮 */}
      <div className="px-3 pb-4">
        <SearchTriggerButton onClick={() => (window as any).openCommandPalette?.()} />
      </div>

      {/* Nav sections */}
      <nav className="flex-1 space-y-6 overflow-y-auto px-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-ink-400 dark:text-ink-500">
              {section.label}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  {('external' in item) && (item as any).external ? (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="nav-item"
                    >
                      <Icon name={item.icon} />
                      <span className="flex-1">{item.label}</span>
                      <svg className="h-3 w-3 text-ink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  ) : (
                    <Link
                      href={item.href}
                      className={clsx('nav-item', isActive(item.href) && 'nav-item-active')}
                    >
                      <Icon name={item.icon} />
                      <span className="flex-1">{item.label}</span>
                      {(item as { shortcut?: string }).shortcut && (
                        <kbd className="hidden rounded border border-ink-200 bg-white/60 px-1 py-0.5 text-[10px] font-mono text-ink-400 group-hover:inline-block dark:border-ink-700 dark:bg-ink-800/40 lg:inline-block">
                          {(item as { shortcut?: string }).shortcut}
                        </kbd>
                      )}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* 底部：主题 + 内部登录 */}
      <div className="space-y-3 border-t border-ink-200/70 px-3 pt-4 dark:border-ink-800/60">
        <ThemeSwitcher />
        <Link
          href="/login"
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800/60 dark:hover:text-ink-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          <span>内部员工登录</span>
        </Link>
      </div>
    </aside>
  );
}

function SearchTriggerButton({ onClick }: { onClick: () => void }) {
  const [isMac, setIsMac] = useState(false);
  useEffect(() => {
    setIsMac(/mac/i.test(navigator.platform));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onClick();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClick]);

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md border border-ink-200 bg-ink-50/60 px-2.5 py-1.5 text-left text-xs text-ink-500 transition-colors hover:border-ink-300 hover:bg-ink-100 hover:text-ink-700 dark:border-ink-800 dark:bg-ink-925/60 dark:hover:border-ink-700 dark:hover:bg-ink-800/60 dark:hover:text-ink-300"
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <span className="flex-1">搜索</span>
      <kbd className="rounded border border-ink-200 bg-white px-1 py-0.5 font-mono text-[10px] text-ink-400 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-500">
        {isMac ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  );
}
