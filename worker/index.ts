/**
 * DUO Worker: serves the web app and runs the sync relay (design doc §7).
 *
 * The relay is a dumb, encrypted mailbox. It stores sealed records it can't
 * read, keyed by a mailbox id derived from the couple key, and deletes them
 * after 30 days. It never sees keys, names or fitness data.
 *
 *   POST /api/v1/mailbox/:id   { records: [{ id, kind, from, at, blob }] }
 *   GET  /api/v1/mailbox/:id?after=<seq>&not=<deviceId>
 *   GET  /api/health
 */

interface D1Result<T> { results: T[] }
interface D1Prepared {
  bind(...v: unknown[]): D1Prepared;
  run(): Promise<unknown>;
  all<T>(): Promise<D1Result<T>>;
}
interface D1Database { prepare(sql: string): D1Prepared; batch(s: D1Prepared[]): Promise<unknown> }
interface Fetcher { fetch(req: Request): Promise<Response> }
interface Env { DB: D1Database; ASSETS: Fetcher }

const KINDS = new Set(['snapshot', 'cheer', 'challenge', 'private']);
const MAX_RECORDS = 50;
const MAX_BLOB = 256 * 1024;
const TTL_MS = 30 * 86400000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });

interface InRecord { id: string; kind: string; from: string; at: number; blob: string }

export function validRecord(r: unknown): r is InRecord {
  const x = r as InRecord;
  return !!x && typeof x.id === 'string' && /^[A-Za-z0-9_-]{6,40}$/.test(x.id)
    && KINDS.has(x.kind) && typeof x.from === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(x.from)
    && Number.isFinite(x.at) && typeof x.blob === 'string' && x.blob.length > 0 && x.blob.length <= MAX_BLOB && /^[A-Za-z0-9_-]+$/.test(x.blob);
}

async function mailbox(req: Request, env: Env, box: string): Promise<Response> {
  const now = Date.now();
  if (req.method === 'POST') {
    let body: { records?: unknown[] };
    try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
    const recs = Array.isArray(body.records) ? body.records : [];
    if (!recs.length || recs.length > MAX_RECORDS || !recs.every(validRecord)) return json({ error: 'bad records' }, 400);
    const stmts: D1Prepared[] = [env.DB.prepare('DELETE FROM records WHERE created < ?').bind(now - TTL_MS)];
    for (const r of recs as InRecord[]) {
      // Only the newest snapshot per phone is worth keeping.
      if (r.kind === 'snapshot') stmts.push(env.DB.prepare("DELETE FROM records WHERE mailbox = ? AND sender = ? AND kind = 'snapshot'").bind(box, r.from));
      stmts.push(env.DB.prepare('INSERT OR IGNORE INTO records (mailbox, id, kind, sender, at, created, blob) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(box, r.id, r.kind, r.from, Math.round(r.at), now, r.blob));
    }
    await env.DB.batch(stmts);
    return json({ ok: true, stored: recs.length });
  }
  if (req.method === 'GET') {
    const u = new URL(req.url);
    const after = Math.max(0, parseInt(u.searchParams.get('after') ?? '0', 10) || 0);
    const not = u.searchParams.get('not') ?? '';
    const { results } = await env.DB.prepare('SELECT seq, id, kind, sender AS "from", at, blob FROM records WHERE mailbox = ? AND seq > ? AND sender != ? AND created >= ? ORDER BY seq LIMIT 200')
      .bind(box, after, not, now - TTL_MS).all<{ seq: number }>();
    return json({ records: results });
  }
  return json({ error: 'method not allowed' }, 405);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') return json({ ok: true, app: 'duo' });
    const m = /^\/api\/v1\/mailbox\/([0-9a-f]{32})$/.exec(url.pathname);
    if (m) {
      try { return await mailbox(req, env, m[1]); } catch { return json({ error: 'server error' }, 500); }
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    return env.ASSETS.fetch(req);
  },
};
