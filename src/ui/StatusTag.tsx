import type { ReactNode } from 'react';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

export function StatusTag({ tone = 'neutral', children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span className={`tag tag-${tone}`}>
      {icon}
      {children}
    </span>
  );
}
