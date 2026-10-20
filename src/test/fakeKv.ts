/** Almacén KV de mentira con el mismo comportamiento que el de Cloudflare (metadatos, prefijos y páginas). */
export class FakeKV {
  store = new Map<string, { value: string | ArrayBuffer; metadata: unknown }>();
  pageSize = 1000;
  async get(name: string, opts?: string | { type: string }) {
    const e = this.store.get(name);
    if (!e) return null;
    const type = typeof opts === 'string' ? opts : opts?.type;
    if (type === 'arrayBuffer') return e.value instanceof ArrayBuffer ? e.value : new TextEncoder().encode(String(e.value)).buffer;
    return typeof e.value === 'string' ? e.value : new TextDecoder().decode(e.value);
  }
  async getWithMetadata(name: string, type?: string) {
    const e = this.store.get(name);
    return { value: e ? await this.get(name, type) : null, metadata: e?.metadata ?? null };
  }
  async put(name: string, value: string | ArrayBuffer, opts?: { metadata?: unknown }) {
    this.store.set(name, { value, metadata: opts?.metadata ?? null });
  }
  async delete(name: string) {
    this.store.delete(name);
  }
  async list({ prefix = '', cursor }: { prefix?: string; cursor?: string }) {
    const all = [...this.store.keys()].filter((k) => k.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    const page = all.slice(start, start + this.pageSize);
    const done = start + this.pageSize >= all.length;
    return {
      keys: page.map((name) => ({ name, metadata: this.store.get(name)?.metadata })),
      list_complete: done,
      cursor: done ? undefined : String(start + this.pageSize),
    };
  }
}


