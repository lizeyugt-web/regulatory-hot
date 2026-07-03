'use client';

/**
 * AIHOT 风格统一筛选条
 *
 * 设计原则：
 *   - 三个并列筛选维度：分类 · 标签 · 精选规则
 *   - 分类：色块卡片网格（一目了然）
 *   - 标签：「标签库」横向 chip 流，支持多选（AND / OR 可切换）
 *   - 精选：一个开关，背后是一条规则（"是否只显示被算法精选的条目"）
 *   - 不再使用「多行散装按钮」列表
 *
 * 替代原先的 CategoryFilterBar + ImportanceFilterBar + SearchBox
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useTransition, useMemo } from 'react';
import clsx from 'clsx';
import { CATEGORIES, SUB_CATEGORIES, type CategoryId, type SubCategory } from '@/lib/config';

interface Props {
  basePath: string;
  /** 是否展示搜索框（仅全部页需要） */
  showSearch?: boolean;
  /** 标签库：标签 → 命中条数 */
  tagStats: Record<string, number>;
  /** 标签默认匹配模式：'any' = 命中任一即显示（OR），'all' = 必须全部命中（AND） */
  defaultTagMatch?: 'any' | 'all';
}

// 分类色板（Anthropic 风格：低饱和暖色，激活态用品牌棕系）
const CAT_PALETTE: Record<CategoryId, { tint: string; solid: string; ring: string }> = {
  regulation: {
    tint:  'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-900/40',
    solid: 'bg-amber-600 text-white border-amber-700 shadow-[0_2px_8px_-2px_rgb(180_83_9/0.4)]',
    ring:  'ring-amber-500/40',
  },
  approval: {
    tint:  'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-200 dark:border-emerald-900/40',
    solid: 'bg-emerald-700 text-white border-emerald-800 shadow-[0_2px_8px_-2px_rgb(4_120_87/0.4)]',
    ring:  'ring-emerald-500/40',
  },
  safety: {
    tint:  'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/20 dark:text-red-200 dark:border-red-900/40',
    solid: 'bg-red-700 text-white border-red-800 shadow-[0_2px_8px_-2px_rgb(185_28_28/0.4)]',
    ring:  'ring-red-500/40',
  },
  insight: {
    tint:  'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/20 dark:text-sky-200 dark:border-sky-900/40',
    solid: 'bg-sky-700 text-white border-sky-800 shadow-[0_2px_8px_-2px_rgb(3_105_161/0.4)]',
    ring:  'ring-sky-500/40',
  },
};

const ALL_CAT_PALETTE = {
  tint:  'bg-ink-100 text-ink-700 border-ink-200 dark:bg-ink-800/60 dark:text-ink-200 dark:border-ink-700',
  solid: 'bg-ink-900 text-white border-ink-900 shadow-[0_2px_8px_-2px_rgb(0_0_0/0.3)] dark:bg-ink-50 dark:text-ink-900 dark:border-ink-50',
  ring:  'ring-ink-400/50',
};

// 每个分类下推荐优先展示的标签（保持标签库有序、不堆挤）
const CAT_TAGS: Record<CategoryId, readonly SubCategory[]> = {
  regulation: ['法规发布', '指南发布', '指导原则', '草案征求意见', '技术标准', '药典更新', 'ICH 指南', 'ISO 标准', 'USP 标准'],
  approval:   ['新药批准', '新适应症', '附条件批准', '加速审批', '优先审评', '突破性疗法', '仿制药批准', '510(k) 批准', 'PMA 批准', 'De Novo', '拒绝/撤回'],
  safety:     ['安全警戒', '不良反应', '召回', '警告信', '黑框警告', '进口禁令', 'GMP 检查', '飞行检查', '违规处罚', '临床暂停'],
  insight:    ['会议活动', '咨询委员会', '公开听证', '人事变动', '政策声明', '跨境合作', '年度报告', '白皮书', '期刊文章', '行业分析', '统计报告'],
};

export function FilterToolbar({
  basePath,
  showSearch = false,
  tagStats,
  defaultTagMatch = 'any',
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const activeCat: CategoryId | 'all' = (sp.get('category') as CategoryId | 'all') ?? 'all';
  // 多选标签：URL 中用 `tag=A&tag=B` 形式
  const activeTags: string[] = sp.getAll('tag');
  const tagMatch = (sp.get('tagMatch') as 'any' | 'all' | null) ?? defaultTagMatch;
  // 精选规则：URL 中 `selected=1` 表示开启
  const selectedOnly = sp.get('selected') === '1';
  const [q, setQ] = useState(sp.get('q') ?? '');

  useEffect(() => {
    setQ(sp.get('q') ?? '');
  }, [sp]);

  function pushParams(mut: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(sp.toString());
    mut(params);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    });
  }

  function setCategory(id: CategoryId | 'all') {
    pushParams((p) => {
      if (id === 'all') p.delete('category');
      else p.set('category', id);
    });
  }

  function toggleTag(tag: string) {
    pushParams((p) => {
      const current = p.getAll('tag');
      p.delete('tag');
      const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      next.forEach((t) => p.append('tag', t));
    });
  }

  function setTagMatch(m: 'any' | 'all') {
    pushParams((p) => {
      if (m === 'any') p.delete('tagMatch');
      else p.set('tagMatch', m);
    });
  }

  function setSelectedOnly(v: boolean) {
    pushParams((p) => {
      if (v) p.set('selected', '1');
      else p.delete('selected');
    });
  }

  function clearAllTags() {
    pushParams((p) => {
      p.delete('tag');
      p.delete('tagMatch');
    });
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    pushParams((p) => {
      if (q.trim()) p.set('q', q.trim());
      else p.delete('q');
    });
  }

  // 当前展示的标签集合：
  // - 选中"全部分类"时，把整个 SUB_CATEGORIES 按 hit 数降序排
  // - 选中具体分类时，只显示该分类下的标签（按 hit 数降序）
  const visibleTags = useMemo(() => {
    const list: SubCategory[] =
      activeCat === 'all'
        ? [...SUB_CATEGORIES]
        : [...CAT_TAGS[activeCat]];
    return list
      .map((t) => ({ tag: t, count: tagStats[t] ?? 0 }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [activeCat, tagStats]);

  return (
    <div className="card overflow-hidden">
      {/* ────────── 分类区：色块化 segment 控件 ────────── */}
      <div className="px-3.5 pt-3.5 pb-2.5 sm:px-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-ink-500">
            分类
          </span>
          {activeCat !== 'all' && (
            <button
              onClick={() => setCategory('all')}
              className="text-[11px] text-ink-400 transition-colors hover:text-brand-600 dark:text-ink-500 dark:hover:text-brand-400"
            >
              清除
            </button>
          )}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          <CategoryCard
            active={activeCat === 'all'}
            onClick={() => setCategory('all')}
            label="全部"
            palette={ALL_CAT_PALETTE}
            activeRing
          />
          {CATEGORIES.map((c) => (
            <CategoryCard
              key={c.id}
              active={activeCat === c.id}
              onClick={() => setCategory(c.id)}
              label={c.label}
              emoji={c.emoji}
              palette={CAT_PALETTE[c.id]}
              activeRing
            />
          ))}
        </div>
      </div>

      {/* ────────── 标签库 + 精选规则 + 搜索 ────────── */}
      <div className="border-t border-ink-200/70 bg-ink-50/40 dark:border-ink-800/60 dark:bg-ink-925/40">
        {/* 标签库 */}
        <div className="px-3.5 pt-2.5 pb-2 sm:px-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400 dark:text-ink-500">
              标签库
            </span>
            {activeTags.length > 0 && (
              <>
                <span className="text-[11px] text-ink-500 dark:text-ink-400">
                  已选 <span className="tnum font-semibold text-brand-600 dark:text-brand-400">{activeTags.length}</span> 个
                </span>
                <div className="inline-flex items-center rounded border border-ink-200 bg-white p-0.5 text-[10px] dark:border-ink-700 dark:bg-ink-900">
                  <button
                    onClick={() => setTagMatch('any')}
                    className={clsx(
                      'rounded px-1.5 py-0.5 transition-colors',
                      tagMatch === 'any'
                        ? 'bg-brand-500 text-white'
                        : 'text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100'
                    )}
                    title="命中任一即显示"
                  >
                    任一
                  </button>
                  <button
                    onClick={() => setTagMatch('all')}
                    className={clsx(
                      'rounded px-1.5 py-0.5 transition-colors',
                      tagMatch === 'all'
                        ? 'bg-brand-500 text-white'
                        : 'text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100'
                    )}
                    title="必须全部命中"
                  >
                    全部
                  </button>
                </div>
                <button
                  onClick={clearAllTags}
                  className="text-[11px] text-ink-400 transition-colors hover:text-red-600 dark:text-ink-500 dark:hover:text-red-400"
                >
                  清除
                </button>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {visibleTags.map(({ tag, count }) => {
              const active = activeTags.includes(tag);
              return (
                <TagChip
                  key={tag}
                  active={active}
                  count={count}
                  onClick={() => toggleTag(tag)}
                  label={tag}
                />
              );
            })}
            {visibleTags.length === 0 && (
              <span className="text-[11px] text-ink-400 dark:text-ink-500">当前分类下暂无标签</span>
            )}
          </div>
        </div>

        {/* 精选规则 + 搜索 */}
        <div className="flex flex-col gap-2.5 border-t border-ink-200/60 px-3.5 py-2.5 sm:flex-row sm:items-center sm:gap-3 sm:px-4 dark:border-ink-800/50">
          {/* 精选规则 — 一个开关，背后是评分阈值规则 */}
          <SelectedRuleSwitch checked={selectedOnly} onChange={setSelectedOnly} />

          {showSearch && <div className="hidden h-5 w-px bg-ink-200 sm:block dark:bg-ink-700" />}

          {showSearch && (
            <form onSubmit={submitSearch} className="relative flex-1">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索标题或摘要…"
                className="w-full rounded-md border border-ink-200 bg-white py-1.5 pl-8 pr-3 text-sm text-ink-900 placeholder-ink-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200/60 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-50 dark:placeholder-ink-500 dark:focus:border-brand-400 dark:focus:ring-brand-700/40"
              />
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// 子组件：分类色块卡片
// ===========================================================================

function CategoryCard({
  active, onClick, label, emoji, palette, activeRing,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  emoji?: string;
  palette: { tint: string; solid: string; ring: string };
  activeRing?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'group relative flex min-w-0 flex-col items-center gap-0.5 rounded-md border px-1.5 py-1.5 text-[11px] font-medium leading-tight transition-all duration-200 ease-out-expo',
        active
          ? clsx(palette.solid, activeRing && 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-ink-925', palette.ring)
          : clsx(palette.tint, 'hover:-translate-y-px hover:shadow-soft')
      )}
    >
      {emoji && (
        <span className={clsx('text-base leading-none', active && 'drop-shadow-sm')}>
          {emoji}
        </span>
      )}
      <span className="truncate text-center tracking-wide">{label}</span>
    </button>
  );
}

// ===========================================================================
// 子组件：标签 chip
// ===========================================================================

function TagChip({
  active, onClick, label, count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  // 命中数为 0 的标签灰显
  const dim = count === 0;

  return (
    <button
      onClick={onClick}
      disabled={dim && !active}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight transition-all duration-150',
        active
          ? 'border-brand-500 bg-brand-500 text-white shadow-[0_1px_4px_-1px_rgb(115_125_240/0.5)]'
          : dim
            ? 'cursor-not-allowed border-ink-200/60 bg-transparent text-ink-300 dark:border-ink-800/40 dark:text-ink-600'
            : 'border-ink-200 bg-white text-ink-700 hover:border-brand-400 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:border-brand-400 dark:hover:text-brand-300'
      )}
    >
      <span>{label}</span>
      <span
        className={clsx(
          'tnum rounded-full px-1 text-[9px] font-semibold tabular-nums leading-tight',
          active
            ? 'bg-white/25 text-white'
            : dim
              ? 'bg-ink-100 text-ink-400 dark:bg-ink-800/50 dark:text-ink-600'
              : 'bg-ink-100 text-ink-500 group-hover:bg-brand-100 group-hover:text-brand-700 dark:bg-ink-800 dark:text-ink-400'
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ===========================================================================
// 子组件：精选规则开关
// ===========================================================================

function SelectedRuleSwitch({
  checked, onChange,
}: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className={clsx(
        'group flex items-center gap-2 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors',
        checked
          ? 'border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200'
          : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:border-ink-600'
      )}
      title="开启后只显示被 AI 评分算法判定为「精选」的条目"
    >
      <span
        className={clsx(
          'relative inline-block h-3.5 w-6 flex-shrink-0 rounded-full transition-colors',
          checked ? 'bg-amber-500' : 'bg-ink-300 dark:bg-ink-700'
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-transform',
            checked ? 'left-[14px]' : 'left-0.5'
          )}
        />
      </span>
      <span className="flex items-center gap-1">
        <span aria-hidden>✦</span>
        <span>仅看精选</span>
      </span>
    </button>
  );
}
