'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * 页面切换淡入：监听 pathname 变化，触发一次 fade-in 动画
 * 关键：使用 key 强制重新挂载 → 触发动画重播
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    setAnimKey((k) => k + 1);
  }, [pathname]);

  return (
    <div
      key={animKey}
      className="animate-fade-in"
      style={{ animation: 'fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      {children}
    </div>
  );
}
