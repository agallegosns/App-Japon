// Servidor de sincronización de Nihon Trip (Cloudflare Worker + almacén KV).
//
// Es un buzón: guarda datos que YA LLEGAN CIFRADOS desde el móvil. No tiene ninguna clave, no puede leer el contenido
// y no hay cuentas ni contraseñas. Cada pareja usa una "sala" cuyo nombre es un código que sale del código secreto del
// viaje (un hash de 64 caracteres imposible de adivinar). Este archivo no contiene secretos y puede ser público.
//
// Enlace obligatorio (Settings → Bindings): un KV namespace con el nombre de variable DATA.

const VERSION = 1;
const DEFAULT_ORIGINS = ['https://agallegosns.github.io'];

const ROOM_RE = /^[a-f0-9]{64}$/;
const RECORD_KEY_RE = /^(trips|days|bookings|activities|attachments):[A-Za-z0-9_-]{1,64}$/;
const BLOB_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const MAX_BODY_BYTES = 2 * 1024 * 1024; // petición JSON
const MAX_RECORD_BYTES = 256 * 1024; // un registro cifrado
const MAX_BLOB_BYTES = 20 * 1024 * 1024; // un adjunto cifrado (KV admite 25 MB)
const MAX_GET = 40;
const MAX_PUT = 20; // cada registro cuesta una lectura y una escritura: el plan gratuito limita las operaciones por petición
const MAX_LIST_PAGES = 5;

function allowedOrigins(env) {
  const custom = typeof env.ALLOWED_ORIGINS === 'string' ? env.ALLOWED_ORIGINS : '';
  const list = custom.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? list : DEFAULT_ORIGINS;
}

function corsHeaders(origin, env) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && allowedOrigins(env).includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors },
  });
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return { error: 'Petición demasiado grande.', status: 413 };
  try {
    const body = JSON.parse(text);
    if (typeof body !== 'object' || body === null) return { error: 'Petición no válida.', status: 400 };
    return { body };
  } catch {
    return { error: 'La petición no es JSON válido.', status: 400 };
  }
}

function validRoom(room) {
  return typeof room === 'string' && ROOM_RE.test(room);
}

function isCount(n) {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    // Una web de otro sitio no puede usar este buzón desde el navegador.
    if (origin && !allowedOrigins(env).includes(origin)) return json({ error: 'Origen no permitido.' }, 403, cors);

    const hasKv = !!env.DATA && typeof env.DATA.get === 'function';
    if (url.pathname === '/v1/ping' && request.method === 'GET') {
      return json({ ok: true, version: VERSION, kv: hasKv }, 200, cors);
    }
    if (!hasKv) return json({ error: 'Falta enlazar el almacén KV con el nombre DATA en el Worker.' }, 500, cors);
    const kv = env.DATA;

    try {
      // ---- adjuntos (archivos cifrados) ----
      const blob = /^\/v1\/blob\/([A-Za-z0-9_-]{1,64})$/.exec(url.pathname);
      if (blob) {
        const room = url.searchParams.get('room');
        if (!validRoom(room) || !BLOB_ID_RE.test(blob[1])) return json({ error: 'Datos no válidos.' }, 400, cors);
        const name = `${room}:blob:${blob[1]}`;
        if (request.method === 'PUT') {
          const declared = Number(request.headers.get('Content-Length') || '0');
          if (declared > MAX_BLOB_BYTES) return json({ error: 'Archivo demasiado grande.' }, 413, cors);
          const bytes = await request.arrayBuffer();
          if (bytes.byteLength === 0 || bytes.byteLength > MAX_BLOB_BYTES) return json({ error: 'Archivo no válido.' }, 413, cors);
          await kv.put(name, bytes, { metadata: { n: bytes.byteLength } });
          return json({ ok: true }, 200, cors);
        }
        if (request.method === 'GET') {
          const bytes = await kv.get(name, { type: 'arrayBuffer' });
          if (!bytes) return json({ error: 'No existe.' }, 404, cors);
          return new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', ...cors } });
        }
        return json({ error: 'Método no permitido.' }, 405, cors);
      }

      if (request.method !== 'POST') return json({ error: 'No encontrado.' }, 404, cors);
      const parsed = await readJson(request);
      if (parsed.error) return json({ error: parsed.error }, parsed.status, cors);
      const body = parsed.body;
      if (!validRoom(body.room)) return json({ error: 'Sala no válida.' }, 400, cors);
      const prefix = `${body.room}:`;

      // ---- lista de lo que hay (solo nombres y fechas, sin contenido) ----
      if (url.pathname === '/v1/list') {
        const items = [];
        const blobs = [];
        let cursor;
        for (let page = 0; page < MAX_LIST_PAGES; page++) {
          const res = await kv.list({ prefix, cursor });
          for (const k of res.keys) {
            const short = k.name.slice(prefix.length);
            if (short.startsWith('blob:')) blobs.push(short.slice(5));
            else items.push({ k: short, u: Number(k.metadata?.u ?? 0), d: k.metadata?.d ? 1 : 0 });
          }
          if (res.list_complete) return json({ items, blobs, complete: true }, 200, cors);
          cursor = res.cursor;
        }
        return json({ items, blobs, complete: false }, 200, cors);
      }

      // ---- leer registros cifrados ----
      if (url.pathname === '/v1/get') {
        if (!Array.isArray(body.keys) || body.keys.length > MAX_GET) return json({ error: 'Demasiadas claves.' }, 400, cors);
        const out = [];
        for (const k of body.keys) {
          if (typeof k !== 'string' || !RECORD_KEY_RE.test(k)) return json({ error: 'Clave no válida.' }, 400, cors);
          const res = await kv.getWithMetadata(prefix + k, 'text');
          if (res.value !== null) out.push({ k, u: Number(res.metadata?.u ?? 0), d: res.metadata?.d ? 1 : 0, v: res.value });
        }
        return json({ items: out }, 200, cors);
      }

      // ---- guardar registros cifrados (gana siempre el más reciente) ----
      if (url.pathname === '/v1/put') {
        if (!Array.isArray(body.items) || body.items.length > MAX_PUT) return json({ error: 'Demasiados registros.' }, 400, cors);
        const written = [];
        const skipped = [];
        for (const it of body.items) {
          if (typeof it !== 'object' || it === null) return json({ error: 'Registro no válido.' }, 400, cors);
          if (typeof it.k !== 'string' || !RECORD_KEY_RE.test(it.k)) return json({ error: 'Clave no válida.' }, 400, cors);
          if (!isCount(it.u) || (it.d !== 0 && it.d !== 1)) return json({ error: 'Fecha o marca no válidas.' }, 400, cors);
          if (typeof it.v !== 'string' || it.v.length === 0 || it.v.length > MAX_RECORD_BYTES) return json({ error: 'Contenido no válido.' }, 400, cors);
          const name = prefix + it.k;
          const current = await kv.getWithMetadata(name, 'text');
          if (current.value !== null && Number(current.metadata?.u ?? 0) >= it.u) {
            skipped.push(it.k);
            continue;
          }
          await kv.put(name, it.v, { metadata: { u: it.u, d: it.d } });
          written.push(it.k);
        }
        return json({ written, skipped }, 200, cors);
      }

      // ---- borrar todo lo de la sala ----
      if (url.pathname === '/v1/wipe') {
        let deleted = 0;
        // Se vuelve a listar desde el principio tras cada tanda: así no se salta nada aunque se esté borrando.
        for (let page = 0; page < MAX_LIST_PAGES; page++) {
          const res = await kv.list({ prefix });
          for (const k of res.keys) {
            await kv.delete(k.name);
            deleted++;
          }
          if (res.list_complete) return json({ deleted, complete: true }, 200, cors);
        }
        return json({ deleted, complete: false }, 200, cors);
      }

      return json({ error: 'No encontrado.' }, 404, cors);
    } catch {
      // Sin detalles: el error real (p. ej. límite diario de KV) se ve en el panel de Cloudflare.
      return json({ error: 'El servidor no pudo completar la operación (¿límite diario de Cloudflare?).' }, 500, cors);
    }
  },
};
