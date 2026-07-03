import { SITE, SOURCES, CATEGORIES } from '@/lib/config';

interface Props {
  totalEvents: number;
  totalSelected: number;
  totalSources: number;
  generatedAt?: string;
}

export function StatsOverview({ totalEvents, totalSelected, totalSources, generatedAt }: Props) {
  const stats = [
    { label: '覆盖监管机构', value: totalSources, suffix: '家', hint: 'T1 一手信源' },
    { label: '今日动态',    value: totalEvents,  suffix: '条', hint: '过去 24h 抓取' },
    { label: '精选条目',    value: totalSelected, suffix: '条', hint: 'AI 评分 ≥ 65' },
    { label: '内容板块',    value: CATEGORIES.length, suffix: '类', hint: '4 大板块 + 细分类标签' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="card-padded">
          <p className="text-xs text-ink-500">{s.label}</p>
          <p className="mt-1 text-2xl font-bold text-ink-900">
            {s.value}
            <span className="ml-0.5 text-sm font-normal text-ink-500">{s.suffix}</span>
          </p>
          <p className="mt-1 text-xs text-ink-500">{s.hint}</p>
        </div>
      ))}
    </div>
  );
}
