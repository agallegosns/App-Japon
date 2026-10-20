import { useSyncExternalStore } from 'react';
import type { NihonDB } from '../storage/db';
import { onLocalChange } from '../storage/meta';
import { SyncApi, SyncError } from './api';
import { SYNC_URL } from './config';
import { deriveCredentials, generateCode, parseCode, type Credentials } from './crypto';
import { hasLocalData, syncNow, type SyncMode, type SyncResult } from './engine';

/** Estado y orquestación de «compartir con tu pareja». El código vive solo en este móvil (localStorage). */

const KEY = 'nihon.sync';
const AUTO_DEBOUNCE_MS = 8_000;
const MIN_AUTO_GAP_MS = 60_000;

export interface SyncConfig {
  code: string;
  lastSyncAt: number | null;
}

export interface SyncState {
  config: SyncConfig | null;
  syncing: boolean;
  error: string | null;
  warnings: string[];
}

let api = new SyncApi(SYNC_URL);
let state: SyncState = { config: loadConfig(), syncing: false, error: null, warnings: [] };
const listeners = new Set<() => void>();
let running: Promise<SyncResult | null> | null = null;
let pending = false;
let credsCache: { code: string; creds: Credentials } | null = null;

function loadConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SyncConfig>;
    if (typeof v.code === 'string' && parseCode(v.code)) return { code: v.code, lastSyncAt: typeof v.lastSyncAt === 'number' ? v.lastSyncAt : null };
  } catch {
    // Dato dañado o sin almacenamiento: se trata como «sin compartir».
  }
  return null;
}

function persist(config: SyncConfig | null): void {
  try {
    if (config) localStorage.setItem(KEY, JSON.stringify(config));
    else localStorage.removeItem(KEY);
  } catch {
    // Sin almacenamiento: la configuración sigue en memoria durante esta sesión.
  }
}

function set(patch: Partial<SyncState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

async function credentials(code: string): Promise<Credentials> {
  if (credsCache?.code === code) return credsCache.creds;
  const creds = await deriveCredentials(code);
  credsCache = { code, creds };
  return creds;
}

export function getSyncState(): SyncState {
  return state;
}

export function useSync(): SyncState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => state,
  );
}

/** Tests: sustituye el cliente del servidor y reinicia el estado. */
export function resetSyncForTests(testApi?: SyncApi): void {
  api = testApi ?? new SyncApi(SYNC_URL);
  credsCache = null;
  running = null;
  pending = false;
  persist(null);
  state = { config: null, syncing: false, error: null, warnings: [] };
  listeners.forEach((l) => l());
}

export function errorText(e: unknown): string {
  if (e instanceof SyncError) {
    if (e.kind === 'offline') return 'Sin conexión en este momento. Se sincronizará cuando vuelva.';
    if (e.kind === 'network') return 'No se pudo conectar con el servidor. Se reintentará más tarde.';
    if (e.kind === 'server') return `${e.message} Si pasa a menudo, puede ser el límite diario gratuito de Cloudflare: se reintentará mañana.`;
    return e.message;
  }
  return e instanceof Error ? e.message : String(e);
}

/** Sincroniza ahora. Si ya hay una en marcha, espera a esa y vuelve a pasar una vez más (por si hubo cambios entre medias). */
export function runSync(db: NihonDB, mode: SyncMode = 'normal'): Promise<SyncResult | null> {
  const config = state.config;
  if (!config) return Promise.resolve(null);
  if (running) {
    pending = true;
    return running;
  }
  set({ syncing: true, error: null });
  running = (async () => {
    try {
      const result = await syncNow(db, api, await credentials(config.code), mode);
      const next = { code: config.code, lastSyncAt: Date.now() };
      persist(next);
      set({ config: next, error: null, warnings: result.warnings });
      return result;
    } catch (e) {
      set({ error: errorText(e) });
      return null;
    } finally {
      running = null;
      set({ syncing: false });
      if (pending) {
        pending = false;
        void runSync(db);
      }
    }
  })();
  return running;
}

/** Crea un código nuevo, empieza a compartir y sube lo que hay en este móvil. */
export async function startSharing(db: NihonDB): Promise<string> {
  const code = generateCode();
  const config = { code: parseCode(code) ?? code, lastSyncAt: null };
  persist(config);
  set({ config, error: null, warnings: [] });
  void runSync(db);
  return code;
}

export interface JoinPlan {
  code: string;
  remoteItems: number;
  localHasData: boolean;
  /** true si hay datos en los dos sitios y hay que elegir cuáles se quedan. */
  needsChoice: boolean;
}

/** Mira qué hay en la nube con ese código y en este móvil, sin cambiar nada. */
export async function planJoin(db: NihonDB, text: string): Promise<JoinPlan> {
  const code = parseCode(text);
  if (!code) throw new Error('El código no es válido: son 20 letras y números (por ejemplo ABCDE-12345-FGHJK-MNPQR).');
  const creds = await deriveCredentials(code);
  const remote = await api.list(creds.room);
  const localHasData = await hasLocalData(db);
  return { code, remoteItems: remote.items.length, localHasData, needsChoice: remote.items.length > 0 && localHasData };
}

/** Empieza a compartir con un código existente. `replaceLocal`: se descarga lo de la nube y se pierde lo de este móvil. */
export async function joinSharing(db: NihonDB, code: string, replaceLocal: boolean): Promise<SyncResult | null> {
  const config = { code, lastSyncAt: null };
  persist(config);
  credsCache = null;
  set({ config, error: null, warnings: [] });
  return runSync(db, replaceLocal ? 'replaceLocal' : 'normal');
}

/** Deja de compartir en este móvil (no borra nada, ni aquí ni en la nube). */
export function stopSharing(): void {
  persist(null);
  credsCache = null;
  set({ config: null, error: null, warnings: [] });
}

/** Borra de la nube todo lo de este código y deja de compartir. Los datos de los móviles se quedan como están. */
export async function wipeCloud(): Promise<number> {
  const config = state.config;
  if (!config) return 0;
  const creds = await credentials(config.code);
  const res = await api.wipe(creds.room);
  stopSharing();
  return res.deleted;
}

/** Sincronización automática: al abrir, al recuperar conexión, al volver a la app y poco después de cada cambio. */
export function startAutoSync(db: NihonDB): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const maybe = (minGap = 0) => {
    const last = state.config?.lastSyncAt ?? 0;
    if (!state.config || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    if (Date.now() - last < minGap) return;
    void runSync(db);
  };
  const onOnline = () => maybe();
  const onVisible = () => {
    if (document.visibilityState === 'visible') maybe(MIN_AUTO_GAP_MS);
  };
  const stopChange = onLocalChange(() => {
    if (!state.config) return;
    clearTimeout(timer);
    timer = setTimeout(() => maybe(), AUTO_DEBOUNCE_MS);
  });
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const first = setTimeout(() => maybe(), 1_500);
  return () => {
    clearTimeout(first);
    clearTimeout(timer);
    stopChange();
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
