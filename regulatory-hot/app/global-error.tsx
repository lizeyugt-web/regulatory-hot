'use client';

import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-ink-50 dark:bg-ink-950">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
          <p className="tnum text-5xl font-bold text-brand-500">500</p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">
            出了点问题
          </h1>
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400 text-pretty">
            页面加载时发生错误。已记录到日志，请稍后再试。
          </p>
          {error.digest && (
            <p className="tnum mt-2 text-2xs text-ink-400 dark:text-ink-500">
              trace: {error.digest}
            </p>
          )}
          <div className="mt-6 flex gap-2">
            <button
              onClick={reset}
              className="rounded-md bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              重试
            </button>
            <Link
              href="/"
              className="rounded-md border border-ink-200 bg-white px-4 py-1.5 text-sm font-medium text-ink-700 hover:border-ink-300 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300"
            >
              返回首页
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
