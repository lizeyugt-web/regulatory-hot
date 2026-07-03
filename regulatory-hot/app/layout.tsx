import type { Metadata } from 'next';
import './globals.css';
import { SiteSidebar } from '@/components/layout/SiteSidebar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { CommandPalette } from '@/components/command/CommandPalette';
import { PageTransition } from '@/components/layout/PageTransition';
import { SITE } from '@/lib/config';
import { ThemeScript } from '@/components/layout/ThemeScript';

export const metadata: Metadata = {
  title: {
    default: `${SITE.name} · ${SITE.tagline}`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  metadataBase: new URL(SITE.url),
  keywords: ['医药监管', 'FDA', 'EMA', 'NMPA', 'PMDA', 'MHRA', '药品审批', '医疗器械', '监管情报'],
  openGraph: {
    type: 'website',
    title: SITE.name,
    description: SITE.description,
    siteName: SITE.name,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <ThemeScript />
        <link rel="preconnect" href="https://rsms.me" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body className="noise-bg min-h-screen">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-brand-500 focus:px-3 focus:py-1.5 focus:text-sm focus:text-white"
        >
          跳到主内容
        </a>
        <div className="layout-shell relative z-10">
          <SiteSidebar />
          <main className="main-area" id="main-content" tabIndex={-1}>
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
        <SiteFooter />
        <CommandPalette />
      </body>
    </html>
  );
}
