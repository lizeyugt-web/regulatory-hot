'use client';

import { Children, cloneElement, isValidElement } from 'react';
import type { ReactNode, CSSProperties } from 'react';

interface StaggerProps {
  children: ReactNode;
  /** 起始延迟（ms） */
  delay?: number;
  /** 每项间隔（ms） */
  step?: number;
  className?: string;
}

/**
 * Stagger 列表：子项依次淡入上滑
 * 性能：纯 CSS 动画，仅 transform/opacity
 */
export function Stagger({ children, delay = 0, step = 30, className }: StaggerProps) {
  const items = Children.toArray(children);
  return (
    <div className={className}>
      {items.map((child, i) => {
        if (!isValidElement(child)) return child;
        const style: CSSProperties = {
          animation: `slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${delay + i * step}ms both`,
          opacity: 0,
        };
        return cloneElement(child as React.ReactElement, {
          // 透传 key
          key: (child as any).key ?? i,
          style: { ...((child.props as any).style ?? {}), ...style },
        });
      })}
    </div>
  );
}
