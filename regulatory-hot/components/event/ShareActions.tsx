'use client';

import { useState } from 'react';
import { clsx } from 'clsx';

interface Props {
  eventId: string;
  title: string;
}

export function ShareActions({ eventId, title }: Props) {
  const [copied, setCopied] = useState(false);
  const [favorited, setFavorited] = useState(false);

  const url = typeof window !== 'undefined'
    ? `${window.location.origin}/items/${eventId}`
    : `/items/${eventId}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  function toggleFav() {
    setFavorited((f) => !f);
    // 真实场景：写入 localStorage + 后端
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <ActionBtn onClick={copy} active={copied} icon={<CopyIcon />} label={copied ? '已复制' : '复制链接'} />
      <ActionBtn onClick={toggleFav} active={favorited} icon={<StarIcon filled={favorited} />} label={favorited ? '已收藏' : '收藏'} />
      <ActionBtn
        onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank')}
        icon={<XIcon />}
        label="分享到 X"
      />
      <ActionBtn
        onClick={() => window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`, '_blank')}
        icon={<MailIcon />}
        label="邮件"
      />
    </div>
  );
}

function ActionBtn({
  onClick, active, icon, label,
}: { onClick: () => void; active?: boolean; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700/50 dark:bg-brand-950/40 dark:text-brand-300'
          : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300 dark:hover:border-ink-700 dark:hover:bg-ink-800'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function CopyIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.05 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 6l-10 7L2 6" />
    </svg>
  );
}
