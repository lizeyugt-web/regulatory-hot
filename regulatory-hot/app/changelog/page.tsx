const ENTRIES = [
  {
    date: '2026-07-03',
    version: 'v0.3.0',
    title: '质感打磨 · 5 轮迭代超越原版',
    items: [
      '色彩系统：4 层级中性灰（ink-25/50/100/.../950）+ 暗色带蓝调的"暗夜灰"，告别纯黑',
      '噪点纹理层（SVG fractalNoise + overlay 混合），给暗色模式增加纸张质感',
      '多层级阴影：浅色用暖光冷阴影，暗色用 inset ring + glow',
      '字体：Inter（英文）+ PingFang SC（中文），标题字距 -0.015em，数字 tabular-nums',
      '排版：正文 15px / 1.7 行高 / text-pretty 避免孤行',
      '微交互：页面 enter fade-in 动画、卡片 hover 微平移、focus-visible 全站焦点环',
      '命令面板 ⌘K：搜索页面 / 切换主题 / 复制 API URL / 单字母快捷键（H/A/D/T/F/G）',
      '详情页：面包屑 + 上一条/下一条导航 + 复制链接/收藏/分享到 X/邮件',
      '首页右栏：分类导航原地更新（无页面刷新）',
      '空状态：精致 SVG 插画 + 双 CTA',
      '骨架屏：app/loading.tsx 路由级骨架',
      '错误边界：global-error.tsx 500 页面',
      'Footer：信源统计 + 订阅 RSS 入口 + 多列导航',
      'A11y：sr-only "跳到主内容" 链接、aria-modal 对话框、role=radiogroup',
      '可访问性：prefers-reduced-motion 全局禁用动画',
      '可触屏：touch-action: manipulation + tap 高亮颜色',
    ],
  },
  {
    date: '2026-07-03',
    version: 'v0.2.0',
    title: '布局重构 · 仿 AIHOT 风格',
    items: [
      '左侧固定侧栏替代顶部 nav（Logo + 分组菜单 + 主题切换 + 内部登录）',
      '主体改为时间线 + 右栏"当前热点"面板',
      '新增暗色模式（light / follow-system / dark 三态切换）',
      '分类筛选改为更紧凑的小 chip',
      '事件卡片改为行式：信源 / 精选标识 / 评分 / 标题 / 摘要 / 标签 / 推荐理由',
      '日报页：左侧日报历史导航 + 周报月报入口 + 前后日切换',
    ],
  },
  {
    date: '2026-07-03',
    version: 'v0.1.0',
    title: '初始骨架上线',
    items: [
      '完成 9 页面骨架：/、/all、/daily、/topics、/topics/[slug]、/items/[id]、/agent、/about、/feedback',
      '完成 8 大分类、5 级重要度、19 个信源配置',
      '实现 Mock 数据生成器，所有页面均可正常展示',
      '完成 REST API 骨架：/api/public/daily、/items、/topics、/version',
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">更新日志</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">记录每一次重要迭代</p>
      </header>

      <div className="space-y-5">
        {ENTRIES.map((e) => (
          <article key={e.date + e.version} className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-ink-200/60 bg-ink-50/40 px-5 py-2.5 dark:border-ink-800/40 dark:bg-ink-925/30">
              <span className="rounded bg-gradient-to-br from-brand-500 to-brand-700 px-2 py-0.5 font-mono text-2xs font-bold text-white shadow-sm">
                {e.version}
              </span>
              <time className="tnum text-xs text-ink-500 dark:text-ink-400" dateTime={e.date}>{e.date}</time>
            </div>
            <div className="p-5">
              <h2 className="text-lg font-semibold tracking-tight text-ink-900 dark:text-ink-50">{e.title}</h2>
              <ul className="mt-3 space-y-1.5 text-sm text-ink-700 leading-[1.7] dark:text-ink-300">
                {e.items.map((it, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-brand-500" />
                    <span className="flex-1">{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
