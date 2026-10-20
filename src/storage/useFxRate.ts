import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { FxRate } from '../models/currency';
import { fetchBceRate, loadRate, manualRate, needsRefresh, saveRate, validateRate } from './fxRate';

let current: FxRate = loadRate();
const listeners = new Set<() => void>();
let inflight: Promise<FxRate> | null = null;

function set(rate: FxRate): void {
  current = rate;
  saveRate(rate);
  listeners.forEach((l) => l());
}

/** Descarga la cotización del BCE (una sola petición a la vez) y la guarda. */
export function refreshRate(): Promise<FxRate> {
  inflight ??= fetchBceRate()
    .then((r) => {
      set(r);
      return r;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Fija la cotización a mano (p. ej. la que te aplica tu banco). Devuelve un error de validación o null. */
export function setManualRate(value: number): string | null {
  const err = validateRate(value);
  if (err) return err;
  set(manualRate(value));
  return null;
}

/** Test: restablece el estado interno desde el almacenamiento. */
export function reloadRateFromStorage(): void {
  current = loadRate();
  listeners.forEach((l) => l());
}

export interface FxState {
  rate: FxRate;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Cotización euro/yen compartida por toda la app. Si hay conexión y la cotización es antigua, se actualiza sola
 * al usarla; si no hay conexión, se sigue usando la última guardada.
 */
export function useFxRate(autoRefresh = true): FxState {
  const rate = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => current,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await refreshRate();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (autoRefresh && navigator.onLine && needsRefresh(current)) void refresh();
  }, [autoRefresh, refresh]);

  return { rate, refreshing, error, refresh };
}
