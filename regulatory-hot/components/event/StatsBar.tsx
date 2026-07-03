interface Props {
  totalCrawled: number;
  totalSelected: number;
  sourcesCovered: number;
}

export function StatsBar({ totalCrawled, totalSelected, sourcesCovered }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500 dark:text-ink-400">
      <span>
        今日采集 <span className="font-semibold text-ink-700 dark:text-ink-200">{totalCrawled}</span>
      </span>
      <span>·</span>
      <span>
        精选 <span className="font-semibold text-ink-700 dark:text-ink-200">{totalSelected}</span>
      </span>
      <span>·</span>
      <span>
        覆盖 <span className="font-semibold text-ink-700 dark:text-ink-200">{sourcesCovered}</span> 个信源
      </span>
    </div>
  );
}
