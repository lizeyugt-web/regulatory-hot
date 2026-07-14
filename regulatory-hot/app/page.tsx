import { FeaturedTelegraph } from '@/components/event/FeaturedTelegraph';
import { CountryTabs } from '@/components/event/CountryTabs';
import { getEvents, getStats } from '@/lib/events-data';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

interface PageProps {
  searchParams?: { country?: string };
}

export default async function HomePage({ searchParams }: PageProps) {
  const country = searchParams?.country ?? 'CN';
  const allEvents = await getEvents();
  const stats = await getStats();

  // 首页只显示精选
  let events = allEvents.filter((e) => e.selected);

  // 按国家/地区过滤（ALL 表示全部）
  if (country && country !== 'ALL') {
    events = events.filter((e) => e.sourceCountry === country);
  }

  // 按发布时间降序
  events.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  const todayStr = format(new Date(), 'M月d日 EEEE', { locale: zhCN });

  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] flex-col">
      {/* 顶部标题栏 */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-ink-200 px-5 py-3 dark:border-ink-800">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-ink-900 dark:text-ink-25">
            全球药械监管情报精选
          </h1>
          <span className="text-xs text-ink-500 dark:text-ink-400">
            {todayStr}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-ink-500 dark:text-ink-400">
          <span>
            采集{' '}
            <strong className="tnum font-semibold text-ink-700 dark:text-ink-200">
              {stats.total}
            </strong>
          </span>
          <span>
            精选{' '}
            <strong className="tnum font-semibold text-ink-700 dark:text-ink-200">
              {stats.selected}
            </strong>
          </span>
          <span>
            覆盖{' '}
            <strong className="tnum font-semibold text-ink-700 dark:text-ink-200">
              8
            </strong>{' '}
            个国家/地区
          </span>
        </div>
      </header>

      {/* 国家/地区切换 */}
      <CountryTabs activeCountry={country} />

      {/* 四列电报流 */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <FeaturedTelegraph events={events} />
      </div>

      {/* 底部栏 */}
      <footer className="flex flex-shrink-0 items-center justify-between border-t border-ink-200 bg-ink-50 px-5 py-2.5 text-xs text-ink-500 dark:border-ink-800 dark:bg-ink-925">
        <div className="flex items-center gap-5">
          <span>
            精选{' '}
            <strong className="tnum font-semibold text-ink-700 dark:text-ink-200">
              {events.length}
            </strong>{' '}
            条
          </span>
          <span>数据每 30 分钟自动更新</span>
        </div>
        <button
          type="button"
          onClick={() => {
            if (typeof document !== 'undefined') {
              const content = document.querySelector('.flex-1.overflow-y-auto');
              content?.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
          className="flex items-center gap-1 rounded px-2 py-1 transition-colors hover:bg-ink-100 dark:hover:bg-ink-800"
        >
          <span>↑</span>
          <span>回到顶部</span>
        </button>
      </footer>
    </div>
  );
}
