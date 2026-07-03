import type { AiProgress } from '@/lib/events-data';

interface Props {
  progress: AiProgress;
}

/**
 * AI 处理进度条
 * 显示分析完成进度，后台运行中时提示刷新
 */
export function AiProgressBar({ progress }: Props) {
  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const isDone = progress.pending === 0;

  return (
    <div className={`rounded-lg border px-4 py-3 transition-colors ${
      isDone
        ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-800/40 dark:bg-emerald-950/20'
        : 'border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${isDone ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
            {isDone ? '✅' : '🤖'} AI 处理进度
          </span>
          {!isDone && (
            <span className="text-2xs text-amber-600 dark:text-amber-400">
              （后台运行中，刷新页面查看最新进度）
            </span>
          )}
          {progress.lastRun && (
            <span className="text-2xs text-ink-400 dark:text-ink-500">
              上次运行: {new Date(progress.lastRun).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <span className="tnum text-xs font-mono text-ink-600 dark:text-ink-300">
          {progress.completed}/{progress.total}
          {progress.lastDuration && <span className="ml-1 text-2xs text-ink-400">· {progress.lastDuration}</span>}
        </span>
      </div>

      {/* 进度条 */}
      <div className="h-2 overflow-hidden rounded-full bg-ink-200 dark:bg-ink-800/60">
        <div
          className={`h-full rounded-full transition-all duration-700 ${
            isDone
              ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
              : 'bg-gradient-to-r from-amber-400 to-amber-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 完成状态 */}
      {isDone && (
        <p className="mt-1.5 text-2xs text-emerald-600 dark:text-emerald-400">
          全部 {progress.total} 条已完成 AI 摘要分析
          {progress.lastCost && <span> · 总费用 ¥{progress.lastCost}</span>}
        </p>
      )}

      {/* 运行中状态 */}
      {!isDone && (
        <p className="mt-1.5 text-2xs text-amber-600 dark:text-amber-400">
          剩余 {progress.pending} 条待处理 · 每 10 条自动保存
        </p>
      )}
    </div>
  );
}
