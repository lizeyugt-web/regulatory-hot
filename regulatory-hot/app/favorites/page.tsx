export const metadata = { title: '收藏' };

export default function FavoritesPage() {
  return (
    <div>
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">收藏</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          你收藏的监管情报会出现在这里
        </p>
      </header>
      <div className="rounded-lg border border-dashed border-ink-300 bg-white p-10 text-center text-ink-500 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-400">
        <p className="text-sm">还没有收藏内容</p>
        <p className="mt-1 text-xs text-ink-400">在任意情报页点击「收藏」按钮即可加入</p>
      </div>
    </div>
  );
}
