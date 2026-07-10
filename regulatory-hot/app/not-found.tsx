import Link from 'next/link';
import { EventCard } from '@/components/event/EventCard';
import { getSelectedEvents } from '@/lib/events-data';

export default async function NotFound() {
  const suggestions = (await getSelectedEvents()).slice(0, 4);

  return (
    <div className="mx-auto max-w-3xl py-10">
      <div className="text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-3xl dark:from-brand-950/40 dark:to-brand-900/30">
          🔍
        </div>
        <p className="tnum text-5xl font-bold text-brand-500">404</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">页面未找到</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-500 dark:text-ink-400 text-pretty">
          你访问的内容可能已被移除、链接错误，或者正在等待采集。
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/" className="rounded-md bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600">
            返回首页
          </Link>
          <Link href="/all" className="rounded-md border border-ink-200 bg-white px-4 py-1.5 text-sm font-medium text-ink-700 hover:border-ink-300 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300">
            全部动态
          </Link>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-tight text-ink-900 dark:text-ink-50">
            <span>不如看看这些？</span>
            <span className="h-px flex-1 bg-ink-200 dark:bg-ink-800" />
          </h2>
          <div className="divide-y divide-ink-100 rounded-lg border border-ink-200 bg-white p-4 dark:divide-ink-800 dark:border-ink-800 dark:bg-ink-900">
            {suggestions.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        </div>
      )}
    </div>
  );
}
