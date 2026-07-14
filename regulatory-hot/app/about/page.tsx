import { SOURCES } from '@/lib/config';
import Link from 'next/link';

export const metadata = {
  title: '关于',
  description: '关于 Regulatory Hot 的定位、使命和实现方式',
};

export default function AboutPage() {
  const t1 = SOURCES.filter((s) => s.level === 'T1');
  const others = SOURCES.filter((s) => s.level !== 'T1');

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">关于</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          我们做的是「AI 版的医药监管情报员」
        </p>
      </header>

      <section className="card p-5">
        <h2 className="section-title">为什么做这个？</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-ink-700 dark:text-ink-300 leading-relaxed">
          <li>· 监管信息分散：FDA、EMA、NMPA、PMDA、MHRA……每天几十条公告散落在不同网站</li>
          <li>· 时效性极强：错过一条警告信或指南可能带来合规风险</li>
          <li>· 跨语言阅读成本高：日文、英文、中文、法文…</li>
          <li>· 人工订阅 RSS 难管理：信源质量参差不齐，营销内容泛滥</li>
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="section-title">实现方式</h2>
        <ol className="mt-3 space-y-1.5 text-sm text-ink-700 dark:text-ink-300 leading-relaxed list-decimal list-inside">
          <li>从 20+ 监管机构官网自动抓取 RSS / API / 网页</li>
          <li>便宜模型（DeepSeek-V3.2）做预筛，去掉 70% 噪音</li>
          <li>强推理模型（DeepSeek-V3.1-Terminus）做多维度评分 + 翻译 + 摘要</li>
          <li>代码层做阈值判断、聚类、精选，决定是否展示</li>
          <li>多渠道分发：Web / RSS / REST API / Agent Skill</li>
        </ol>
      </section>

      <section>
        <h2 className="section-title">T1 一手信源 ({t1.length})</h2>
        <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">监管机构与国际组织官方公告</p>
        <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {t1.map((s) => (
            <a
              key={s.id}
              href={s.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="card flex items-center justify-between px-3 py-2 text-sm hover:border-brand-300 dark:hover:border-brand-700"
            >
              <div>
                <p className="font-medium text-ink-900 dark:text-ink-50">{s.name}</p>
                <p className="text-[11px] text-ink-500 dark:text-ink-400">{s.nameEn}</p>
              </div>
              <span className="text-[11px] text-ink-400">{s.country}</span>
            </a>
          ))}
        </div>
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="section-title">行业信源 ({others.length})</h2>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">行业组织、媒体、协会</p>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {others.map((s) => (
              <a
                key={s.id}
                href={s.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="card flex items-center justify-between px-3 py-2 text-sm hover:border-brand-300 dark:hover:border-brand-700"
              >
                <div>
                  <p className="font-medium text-ink-900 dark:text-ink-50">{s.name}</p>
                  <p className="text-[11px] text-ink-500 dark:text-ink-400">{s.nameEn}</p>
                </div>
                <span className="text-[11px] text-ink-400">{s.level}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-ink-200 bg-gradient-to-br from-ink-50 to-white p-5 dark:border-ink-800 dark:from-ink-900 dark:to-ink-950">
        <h2 className="section-title">免责声明</h2>
        <p className="mt-2 text-sm text-ink-700 dark:text-ink-300 leading-relaxed">
          本平台呈现的所有信息均来自公开来源，AI 分析结果仅供参考。
          不构成任何合规、法律或医学建议。重要事项请以官方原文为准。
        </p>
      </section>

      <p className="text-center text-sm text-ink-500 dark:text-ink-400">
        有建议或合作意向？<Link href="/feedback" className="text-brand-700 hover:underline dark:text-brand-300">联系我们 →</Link>
      </p>
    </div>
  );
}
