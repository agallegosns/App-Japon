// @vitest-environment node
import { describe, expect, it } from 'vitest';
import worker from '../../cloudflare/worker.js';
import { FakeKV } from '../test/fakeKv';

const ROOM_A = 'a'.repeat(64);
const ROOM_B = 'b'.repeat(64);
const ORIGIN = 'https://agallegosns.github.io';
const BASE = 'https://sync.test';

function env(kv: FakeKV = new FakeKV()) {
  return { kv, env: { DATA: kv } as Record<string, unknown> };
}

async function post(e: Record<string, unknown>, path: string, body: unknown, origin: string | null = ORIGIN) {
  const res = await worker.fetch(
    new Request(BASE + path, { method: 'POST', body: JSON.stringify(body), headers: origin ? { Origin: origin, 'Content-Type': 'application/json' } : {} }),
    e,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, body: (await res.json()) as Record<string, any>, headers: res.headers };
}

const item = (k: string, u: number, d: 0 | 1 = 0, v = '{"iv":"x","ct":"y"}') => ({ k, u, d, v });

describe('servidor de sincronización', () => {
  it('responde al ping y avisa si falta el almacén', async () => {
    const ok = await worker.fetch(new Request(BASE + '/v1/ping'), env().env);
    expect(await ok.json()).toEqual({ ok: true, version: 1, kv: true });
    const sin = await worker.fetch(new Request(BASE + '/v1/ping'), {});
    expect(await sin.json()).toEqual({ ok: true, version: 1, kv: false });
    const r = await post({}, '/v1/list', { room: ROOM_A });
    expect(r.status).toBe(500);
    expect(r.body.error).toMatch(/DATA/);
  });

  it('solo acepta peticiones del navegador desde la web de la app', async () => {
    const { env: e } = env();
    expect((await post(e, '/v1/list', { room: ROOM_A }, 'https://malo.example')).status).toBe(403);
    const good = await post(e, '/v1/list', { room: ROOM_A });
    expect(good.status).toBe(200);
    expect(good.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect((await post(e, '/v1/list', { room: ROOM_A }, null)).status).toBe(200);
    const pre = await worker.fetch(new Request(BASE + '/v1/put', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), e);
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    const custom = await post({ ...e, ALLOWED_ORIGINS: 'http://localhost:4173' }, '/v1/list', { room: ROOM_A }, 'http://localhost:4173');
    expect(custom.status).toBe(200);
    expect((await post({ ...e, ALLOWED_ORIGINS: 'http://localhost:4173' }, '/v1/list', { room: ROOM_A }, ORIGIN)).status).toBe(403);
  });

  it('guarda, lista y devuelve registros cifrados', async () => {
    const { env: e } = env();
    const put = await post(e, '/v1/put', { room: ROOM_A, items: [item('bookings:b1', 10), item('trips:t1', 5)] });
    expect(put.body).toEqual({ written: ['bookings:b1', 'trips:t1'], skipped: [] });
    const list = await post(e, '/v1/list', { room: ROOM_A });
    expect(list.body.items).toEqual([
      { k: 'bookings:b1', u: 10, d: 0 },
      { k: 'trips:t1', u: 5, d: 0 },
    ]);
    const got = await post(e, '/v1/get', { room: ROOM_A, keys: ['bookings:b1', 'days:no-existe'] });
    expect(got.body.items).toEqual([{ k: 'bookings:b1', u: 10, d: 0, v: '{"iv":"x","ct":"y"}' }]);
  });

  it('gana siempre el cambio más reciente y las bajas quedan marcadas', async () => {
    const { env: e } = env();
    await post(e, '/v1/put', { room: ROOM_A, items: [item('bookings:b1', 10, 0, 'nuevo')] });
    const viejo = await post(e, '/v1/put', { room: ROOM_A, items: [item('bookings:b1', 9, 0, 'viejo')] });
    expect(viejo.body).toEqual({ written: [], skipped: ['bookings:b1'] });
    const igual = await post(e, '/v1/put', { room: ROOM_A, items: [item('bookings:b1', 10, 0, 'igual')] });
    expect(igual.body.skipped).toEqual(['bookings:b1']);
    const baja = await post(e, '/v1/put', { room: ROOM_A, items: [item('bookings:b1', 11, 1, '0')] });
    expect(baja.body.written).toEqual(['bookings:b1']);
    expect((await post(e, '/v1/list', { room: ROOM_A })).body.items).toEqual([{ k: 'bookings:b1', u: 11, d: 1 }]);
    const reaparece = await post(e, '/v1/put', { room: ROOM_A, items: [item('bookings:b1', 10, 0, 'resucitado')] });
    expect(reaparece.body.skipped).toEqual(['bookings:b1']);
  });

  it('cada pareja tiene su sala y no ve la de otros', async () => {
    const { env: e } = env();
    await post(e, '/v1/put', { room: ROOM_A, items: [item('bookings:b1', 1)] });
    await post(e, '/v1/put', { room: ROOM_B, items: [item('bookings:b2', 1)] });
    expect((await post(e, '/v1/list', { room: ROOM_A })).body.items.map((i: { k: string }) => i.k)).toEqual(['bookings:b1']);
    expect((await post(e, '/v1/get', { room: ROOM_B, keys: ['bookings:b1'] })).body.items).toEqual([]);
  });

  it('la lista recorre todas las páginas del almacén', async () => {
    const kv = new FakeKV();
    kv.pageSize = 2;
    const { env: e } = env(kv);
    await post(e, '/v1/put', { room: ROOM_A, items: ['a', 'b', 'c', 'd', 'e'].map((x) => item(`days:${x}`, 1)) });
    const res = await post(e, '/v1/list', { room: ROOM_A });
    expect(res.body.items).toHaveLength(5);
    expect(res.body.complete).toBe(true);
  });

  it('rechaza datos no válidos', async () => {
    const { env: e } = env();
    expect((await post(e, '/v1/list', { room: 'corta' })).status).toBe(400);
    expect((await post(e, '/v1/list', {})).status).toBe(400);
    const bad = (items: unknown[]) => post(e, '/v1/put', { room: ROOM_A, items });
    expect((await bad([item('bookings:../otra', 1)])).status).toBe(400);
    expect((await bad([item('otro:x', 1)])).status).toBe(400);
    expect((await bad([item('bookings:b1', -1)])).status).toBe(400);
    expect((await bad([item('bookings:b1', 1.5)])).status).toBe(400);
    expect((await bad([{ ...item('bookings:b1', 1), d: 2 }])).status).toBe(400);
    expect((await bad([item('bookings:b1', 1, 0, '')])).status).toBe(400);
    expect((await bad([item('bookings:b1', 1, 0, 'x'.repeat(300_000))])).status).toBe(400);
    expect((await bad(Array.from({ length: 21 }, (_, i) => item(`days:d${i}`, 1)))).status).toBe(400);
    expect((await post(e, '/v1/get', { room: ROOM_A, keys: Array.from({ length: 41 }, (_, i) => `days:d${i}`) })).status).toBe(400);
    expect((await post(e, '/v1/get', { room: ROOM_A, keys: ['../x'] })).status).toBe(400);
    const notJson = await worker.fetch(new Request(BASE + '/v1/list', { method: 'POST', body: 'esto no es json' }), e);
    expect(notJson.status).toBe(400);
    expect((await post(e, '/v1/inventada', { room: ROOM_A })).status).toBe(404);
  });

  it('guarda y devuelve adjuntos cifrados', async () => {
    const { env: e } = env();
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const put = await worker.fetch(new Request(`${BASE}/v1/blob/att-1?room=${ROOM_A}`, { method: 'PUT', body: bytes, headers: { Origin: ORIGIN } }), e);
    expect(put.status).toBe(200);
    const get = await worker.fetch(new Request(`${BASE}/v1/blob/att-1?room=${ROOM_A}`, { headers: { Origin: ORIGIN } }), e);
    expect(new Uint8Array(await get.arrayBuffer())).toEqual(bytes);
    const otra = await worker.fetch(new Request(`${BASE}/v1/blob/att-1?room=${ROOM_B}`), e);
    expect(otra.status).toBe(404);
    expect((await post(e, '/v1/list', { room: ROOM_A })).body.blobs).toEqual(['att-1']);
    const malId = await worker.fetch(new Request(`${BASE}/v1/blob/${'x'.repeat(65)}?room=${ROOM_A}`), e);
    expect(malId.status).toBe(404);
    const malSala = await worker.fetch(new Request(`${BASE}/v1/blob/a1?room=nope`, { method: 'PUT', body: bytes }), e);
    expect(malSala.status).toBe(400);
    const vacio = await worker.fetch(new Request(`${BASE}/v1/blob/a2?room=${ROOM_A}`, { method: 'PUT', body: new Uint8Array(0) }), e);
    expect(vacio.status).toBe(413);
    const grande = await worker.fetch(
      new Request(`${BASE}/v1/blob/a3?room=${ROOM_A}`, { method: 'PUT', body: bytes, headers: { 'Content-Length': String(30 * 1024 * 1024) } }),
      e,
    );
    expect(grande.status).toBe(413);
  });

  it('borrar la sala elimina todo lo suyo y nada de las demás', async () => {
    const kv = new FakeKV();
    kv.pageSize = 2;
    const { env: e } = env(kv);
    await post(e, '/v1/put', { room: ROOM_A, items: ['a', 'b', 'c'].map((x) => item(`days:${x}`, 1)) });
    await worker.fetch(new Request(`${BASE}/v1/blob/att-1?room=${ROOM_A}`, { method: 'PUT', body: new Uint8Array([1]) }), e);
    await post(e, '/v1/put', { room: ROOM_B, items: [item('days:z', 1)] });
    const res = await post(e, '/v1/wipe', { room: ROOM_A });
    expect(res.body).toEqual({ deleted: 4, complete: true });
    expect((await post(e, '/v1/list', { room: ROOM_A })).body.items).toEqual([]);
    expect((await post(e, '/v1/list', { room: ROOM_B })).body.items).toHaveLength(1);
  });

  it('si el almacén falla (p. ej. límite diario) devuelve un error sin detalles internos', async () => {
    const kv = new FakeKV();
    kv.put = async () => {
      throw new Error('KV put() limit exceeded for the day. secreto-interno');
    };
    const r = await post({ DATA: kv }, '/v1/put', { room: ROOM_A, items: [item('days:a', 1)] });
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain('secreto-interno');
  });
});
