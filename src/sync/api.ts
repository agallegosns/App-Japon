/** Cliente del buzón de sincronización (Cloudflare Worker). Solo envía y recibe datos ya cifrados. */

export type SyncErrorKind = 'offline' | 'network' | 'forbidden' | 'invalid' | 'server';

export class SyncError extends Error {
  constructor(
    message: string,
    public readonly kind: SyncErrorKind,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

export interface RemoteItem {
  k: string;
  u: number;
  d: 0 | 1;
}

export interface RemoteList {
  items: RemoteItem[];
  blobs: string[];
  complete: boolean;
}

export interface RemoteRecord extends RemoteItem {
  v: string;
}

export interface PutItem {
  k: string;
  u: number;
  d: 0 | 1;
  v: string;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class SyncApi {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: Fetcher = (input, init) => fetch(input, init),
  ) {}

  private async request(path: string, init: RequestInit, timeoutMs = 30_000): Promise<Response> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new SyncError('Sin conexión en este momento.', 'offline');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await this.fetcher(this.baseUrl + path, { ...init, signal: ctl.signal });
    } catch {
      throw new SyncError('No se pudo conectar con el servidor de sincronización.', 'network');
    } finally {
      clearTimeout(timer);
    }
    if (res.ok) return res;
    let message = '';
    try {
      message = ((await res.json()) as { error?: string }).error ?? '';
    } catch {
      // Sin cuerpo útil: se usa el mensaje genérico.
    }
    if (res.status === 403) throw new SyncError('El servidor no acepta esta app (origen no permitido).', 'forbidden');
    if (res.status >= 400 && res.status < 500) throw new SyncError(message || `Petición rechazada (${res.status}).`, 'invalid');
    throw new SyncError(message || `El servidor respondió con el error ${res.status}.`, 'server');
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.request(path, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    return (await res.json()) as T;
  }

  async ping(): Promise<{ ok: boolean; kv: boolean; version: number }> {
    const res = await this.request('/v1/ping', { method: 'GET' }, 10_000);
    return (await res.json()) as { ok: boolean; kv: boolean; version: number };
  }

  list(room: string): Promise<RemoteList> {
    return this.post<RemoteList>('/v1/list', { room });
  }

  async get(room: string, keys: string[]): Promise<RemoteRecord[]> {
    return (await this.post<{ items: RemoteRecord[] }>('/v1/get', { room, keys })).items;
  }

  put(room: string, items: PutItem[]): Promise<{ written: string[]; skipped: string[] }> {
    return this.post('/v1/put', { room, items });
  }

  async putBlob(room: string, id: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
    await this.request(`/v1/blob/${encodeURIComponent(id)}?room=${room}`, { method: 'PUT', body: bytes }, 120_000);
  }

  async getBlob(room: string, id: string): Promise<ArrayBuffer | null> {
    try {
      const res = await this.request(`/v1/blob/${encodeURIComponent(id)}?room=${room}`, { method: 'GET' }, 120_000);
      return await res.arrayBuffer();
    } catch (e) {
      if (e instanceof SyncError && e.kind === 'invalid' && /No existe/.test(e.message)) return null;
      throw e;
    }
  }

  wipe(room: string): Promise<{ deleted: number; complete: boolean }> {
    return this.post('/v1/wipe', { room });
  }
}
