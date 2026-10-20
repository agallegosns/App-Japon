import { useEffect, useState } from 'react';

type WakeState = 'unsupported' | 'active' | 'error' | 'idle';

/** Mantiene la pantalla encendida mientras el componente está montado (si el navegador lo permite). */
export function useWakeLock(enabled: boolean): WakeState {
  const [state, setState] = useState<WakeState>('idle');
  useEffect(() => {
    if (!enabled) return;
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (!wl) {
      setState('unsupported');
      return;
    }
    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const acquire = () =>
      wl
        .request('screen')
        .then((s) => {
          if (cancelled) void s.release();
          else {
            sentinel = s;
            setState('active');
          }
        })
        .catch(() => setState('error'));
    void acquire();
    const onVis = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      sentinel?.release().catch(() => undefined);
    };
  }, [enabled]);
  return state;
}
