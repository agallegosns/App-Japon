import type { ReactNode } from 'react';
import { Card } from '../../ui/Card';
import { StatusTag, type Tone } from '../../ui/StatusTag';
import { STATUS_TEXT, useLabReport, type LabResult, type LabStatus } from './report';

const TONE: Record<LabStatus, Tone> = { idle: 'neutral', running: 'info', ok: 'success', fail: 'danger', info: 'info' };

function combined(results: LabResult[]): LabStatus {
  if (results.length === 0) return 'idle';
  if (results.some((r) => r.status === 'fail')) return 'fail';
  if (results.some((r) => r.status === 'running')) return 'running';
  if (results.every((r) => r.status === 'ok')) return 'ok';
  return 'info';
}

/** Tarjeta de una prueba con su estado real y el detalle de la última ejecución de cada subprueba. */
export function LabSection({ ids, anchor, title, description, children }: { ids: string[]; anchor?: string; title: string; description: ReactNode; children: ReactNode }) {
  const { results } = useLabReport();
  const mine = ids.map((id) => results[id]).filter((r): r is LabResult => !!r);
  const status = combined(mine);
  return (
    <Card as="section" id={anchor} title={title} action={<StatusTag tone={TONE[status]}>{STATUS_TEXT[status]}</StatusTag>}>
      <div className="stack">
        <p className="muted small">{description}</p>
        {children}
        {mine.map((r) => (
          <pre key={r.title} className={`lab-log${r.status === 'fail' ? ' is-fail' : ''}`} aria-live="polite">
            {`${r.title} — ${STATUS_TEXT[r.status]}\n${r.lines.join('\n')}`}
          </pre>
        ))}
      </div>
    </Card>
  );
}
