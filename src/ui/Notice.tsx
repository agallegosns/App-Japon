import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';

type Tone = 'info' | 'warning' | 'danger' | 'success';

const ICONS: Record<Tone, ReactNode> = {
  info: <Info size={18} />,
  warning: <AlertTriangle size={18} />,
  danger: <XCircle size={18} />,
  success: <CheckCircle2 size={18} />,
};

export function Notice({ tone = 'info', children, role }: { tone?: Tone; children: ReactNode; role?: 'status' | 'alert' }) {
  return (
    <div className={`notice notice-${tone}`} role={role}>
      <span aria-hidden="true">{ICONS[tone]}</span>
      <div className="grow">{children}</div>
    </div>
  );
}
