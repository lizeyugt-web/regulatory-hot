export const metadata = { title: '内部员工登录' };

export default function LoginPage() {
  return (
    <div className="max-w-md">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">内部员工登录</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">仅供 RegHot 编辑团队使用</p>
      </header>
      <form className="card space-y-3 p-5">
        <input
          type="text" placeholder="用户名"
          className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
        />
        <input
          type="password" placeholder="密码"
          className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50"
        />
        <button
          type="button"
          className="w-full rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          登录
        </button>
        <p className="text-center text-xs text-ink-500 dark:text-ink-400">* 占位表单，未来接入飞书 OAuth</p>
      </form>
    </div>
  );
}
