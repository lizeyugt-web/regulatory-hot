'use client';

import Link from 'next/link';

interface CountryTab {
  code: string;
  name: string;
}

const COUNTRY_TABS: CountryTab[] = [
  { code: 'CN', name: '中国' },
  { code: 'US', name: '美国' },
  { code: 'EU', name: '欧盟' },
  { code: 'JP', name: '日本' },
  { code: 'GB', name: '英国' },
  { code: 'INT', name: '国际组织' },
  { code: 'ALL', name: '全部' },
];

interface CountryTabsProps {
  activeCountry: string;
  basePath?: string;
}

export function CountryTabs({ activeCountry, basePath = '/' }: CountryTabsProps) {
  return (
    <nav className="flex items-center gap-1 border-b border-ink-200 px-1 dark:border-ink-800">
      {COUNTRY_TABS.map((tab) => {
        const isActive = tab.code === activeCountry;
        const href = tab.code === 'ALL' ? basePath : `${basePath}?country=${tab.code}`;

        return (
          <Link
            key={tab.code}
            href={href}
            className={`relative flex items-center gap-1.5 px-4 py-3 text-sm transition-colors ${
              isActive
                ? 'font-semibold text-ink-900 dark:text-ink-50'
                : 'font-medium text-ink-500 hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200'
            }`}
          >
            <span>{tab.name}</span>
            <span className="font-mono text-[10px] text-ink-400 dark:text-ink-500">
              {tab.code === 'ALL' ? 'ALL' : tab.code}
            </span>
            {isActive && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-t bg-brand-500" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
