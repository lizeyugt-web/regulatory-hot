'use client';

import { useState } from 'react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

const FEEDBACK_TYPES = ['内容问题', '功能建议', '信源建议', 'Bug 报告', '合作意向'];

export default function FeedbackPage() {
  const [type, setType] = useState(FEEDBACK_TYPES[0]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setErrorMsg('标题和描述不能为空');
      return;
    }
    setStatus('submitting');
    setErrorMsg('');
    try {
      // 模拟 API
      await new Promise((r) => setTimeout(r, 1200));
      // 真实场景：fetch('/api/feedback', { method: 'POST', body: JSON.stringify({...}) })
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg('提交失败，请稍后重试');
    }
  }

  function reset() {
    setType(FEEDBACK_TYPES[0]);
    setTitle('');
    setContent('');
    setContact('');
    setStatus('idle');
    setErrorMsg('');
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-ink-50">反馈与建议</h1>
        <p className="mt-1 text-sm text-ink-500 dark:text-ink-400">
          你的反馈直接决定我们下一步迭代方向。
        </p>
      </header>

      {status === 'success' ? (
        <div className="card flex flex-col items-center px-6 py-12 text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-2xl dark:bg-emerald-950/40">
            ✅
          </div>
          <h2 className="text-lg font-semibold text-ink-900 dark:text-ink-50">收到！感谢你的反馈</h2>
          <p className="mt-1.5 max-w-sm text-sm text-ink-500 dark:text-ink-400">
            我们会认真阅读每一条建议。如果提供了联系方式，可能在 1-3 个工作日内回复。
          </p>
          <button
            onClick={reset}
            className="mt-5 rounded-md border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 hover:border-ink-300 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300"
          >
            再提一条
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4 p-5" noValidate>
          <div>
            <label className="block text-sm font-medium text-ink-900 dark:text-ink-50">
              反馈类型
            </label>
            <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup">
              {FEEDBACK_TYPES.map((t) => (
                <label key={t} className="cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={type === t}
                    onChange={() => setType(t)}
                    className="peer sr-only"
                  />
                  <span className="inline-flex items-center rounded-md border border-ink-200 bg-white px-2.5 py-1 text-xs text-ink-700 transition-colors peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300 dark:peer-checked:border-brand-500 dark:peer-checked:bg-brand-950/40 dark:peer-checked:text-brand-300">
                    {t}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <Field
            id="fb-title"
            label="标题"
            value={title}
            onChange={setTitle}
            placeholder="一句话描述问题"
            maxLength={120}
            required
          />
          <p className="-mt-3 text-2xs text-ink-400 dark:text-ink-500 tnum">
            {title.length}/120
          </p>

          <div>
            <label className="block text-sm font-medium text-ink-900 dark:text-ink-50" htmlFor="fb-content">
              详细描述 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="fb-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              required
              placeholder="尽量详细，附上链接或截图更佳"
              className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-50"
            />
          </div>

          <Field
            id="fb-contact"
            label="联系方式（可选）"
            value={contact}
            onChange={setContact}
            placeholder="邮箱 / 微信 / 飞书"
            hint="留下联系方式可在需要时快速回复你"
          />

          {errorMsg && (
            <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-between border-t border-ink-100 pt-4 dark:border-ink-800">
            <p className="text-2xs text-ink-400 dark:text-ink-500 tnum">
              * 当前为占位表单，未来对接飞书 / 邮件
            </p>
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="inline-flex items-center gap-2 rounded-md bg-brand-500 px-4 py-1.5 text-sm font-medium text-white shadow-soft transition-all hover:bg-brand-600 disabled:opacity-60"
            >
              {status === 'submitting' ? (
                <>
                  <Spinner />
                  <span>提交中…</span>
                </>
              ) : (
                <span>提交反馈</span>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  id, label, value, onChange, placeholder, required, maxLength, hint,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; maxLength?: number; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink-900 dark:text-ink-50" htmlFor={id}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className="mt-1 w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-50"
      />
      {hint && <p className="mt-1 text-2xs text-ink-400 dark:text-ink-500">{hint}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
