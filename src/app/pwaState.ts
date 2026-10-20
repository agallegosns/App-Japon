import { useSyncExternalStore } from 'react';

/** Estado del service worker compartido entre el registro (main.tsx) y la interfaz. */
export interface PwaState {
  needRefresh: boolean;
  offlineReady: boolean;
  registration: ServiceWorkerRegistration | null;
  registerError: string | null;
  applyUpdate: (() => Promise<void>) | null;
}

let state: PwaState = { needRefresh: false, offlineReady: false, registration: null, registerError: null, applyUpdate: null };
const listeners = new Set<() => void>();

export function setPwaState(patch: Partial<PwaState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getPwaState(): PwaState {
  return state;
}

export function usePwaState(): PwaState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
