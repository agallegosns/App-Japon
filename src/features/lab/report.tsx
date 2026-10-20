import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type LabStatus = 'idle' | 'running' | 'ok' | 'fail' | 'info';

export interface LabResult {
  title: string;
  status: LabStatus;
  lines: string[];
  at: number;
}

interface LabReportApi {
  results: Record<string, LabResult>;
  report: (id: string, result: Omit<LabResult, 'at'>) => void;
}

const Ctx = createContext<LabReportApi | null>(null);

export function LabReportProvider({ children }: { children: ReactNode }) {
  const [results, setResults] = useState<Record<string, LabResult>>({});
  const report = useCallback((id: string, r: Omit<LabResult, 'at'>) => {
    setResults((prev) => ({ ...prev, [id]: { ...r, at: Date.now() } }));
  }, []);
  const value = useMemo(() => ({ results, report }), [results, report]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLabReport(): LabReportApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLabReport fuera de LabReportProvider');
  return ctx;
}

export const STATUS_TEXT: Record<LabStatus, string> = {
  idle: 'Sin ejecutar',
  running: 'En curso',
  ok: 'VERIFICADO',
  fail: 'FALLO',
  info: 'Información',
};

export function formatMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}
