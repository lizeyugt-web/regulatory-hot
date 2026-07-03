import Link from 'next/link';
import { SOURCES, SITE } from '@/lib/config';

export function SiteFooter() {
  const t1 = SOURCES.filter((s) => s.level === 'T1').length;
  const t2 = SOURCES.filter((s) => s.level !== 'T1').length;

  return (
    <footer className="relative z-10 mt-20 border-t border-ink-200/60 bg-ink-50/60 backdrop-blur dark:border-ink-800/40 dark:bg-ink-950/40">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-10 sm:px-7">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white font-bold text-xs">
                R
              </div>
              <div>
                <div className="font-semibold tracking-tight text-ink-900 dark:text-ink-50">
                  {SITE.name}
                </div>
                <div className="text-[10px] tracking-wide text-ink-500 dark:text-ink-400">
                  {SITE.tagline}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-[1.7] text-ink-500 dark:text-ink-400 text-pretty">
              从全球 {SOURCES.length} 个监管机构与国际组织自动采集医药监管动态，AI 结构化分析，多渠道分发。
            </p>
            <p className="mt-2 text-2xs text-ink-400 dark:text-ink-500 tnum">
              构建于 {SITE.buildDate} · v0.3
            </p>
          </div>

          <FooterCol title="浏览" links={[
            { href: '/', label: '精选' },
            { href: '/all', label: '全部' },
            { href: '/daily', label: '监管日报' },
            { href: '/topics', label: '主题地图' },
            { href: '/favorites', label: '收藏' },
          ]} />

          <FooterCol title="集成" links={[
            { href: '/api/public/daily', label: 'REST API', external: true },
            { href: '/rss.xml', label: 'RSS 订阅', external: true },
            { href: '/agent#skill', label: 'Agent Skill' },
            { href: '/agent#changelog', label: 'OpenAPI 规范' },
          ]} />

          <div>
            <h4 className="text-sm font-semibold text-ink-900 dark:text-ink-50">覆盖信源</h4>
            <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
              T1 一手 <span className="tnum font-semibold text-ink-900 dark:text-ink-50">{t1}</span> ·
              T2 媒体 <span className="tnum font-semibold text-ink-900 dark:text-ink-50">{t2}</span>
            </p>
            <Link href="/about" className="mt-2 inline-block text-xs text-brand-600 hover:underline dark:text-brand-400">
              查看完整列表 →
            </Link>

            <h4 className="mt-5 text-sm font-semibold text-ink-900 dark:text-ink-50">订阅</h4>
            <p className="mt-2 text-xs text-ink-500 dark:text-ink-400">
              每日 08:00 推送监管日报
            </p>
            <Link
              href="/rss.xml"
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:border-brand-300 hover:text-brand-700 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 11a9 9 0 019 9M4 4a16 16 0 0116 16" />
                <circle cx="5" cy="19" r="1" />
              </svg>
              RSS / Atom
            </Link>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-ink-200/60 pt-6 text-xs text-ink-500 dark:border-ink-800/40 dark:text-ink-400 sm:flex-row sm:items-center">
          <p className="leading-relaxed">
            © {new Date().getFullYear()} {SITE.name} · 信息仅供参考，不构成合规建议
          </p>
          <div className="flex gap-4">
            <Link href="/changelog" className="hover:text-ink-900 dark:hover:text-ink-50">更新日志</Link>
            <Link href="/about" className="hover:text-ink-900 dark:hover:text-ink-50">关于</Link>
            <Link href="/feedback" className="hover:text-ink-900 dark:hover:text-ink-50">反馈</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title, links,
}: { title: string; links: Array<{ href: string; label: string; external?: boolean }> }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink-900 dark:text-ink-50">{title}</h4>
      <ul className="mt-2 space-y-1.5 text-xs text-ink-500 dark:text-ink-400">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              target={l.external ? '_blank' : undefined}
              rel={l.external ? 'noopener noreferrer' : undefined}
              className="hover:text-ink-900 dark:hover:text-ink-50 transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
