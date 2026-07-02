#!/usr/bin/env -S node --no-warnings
// wpdevd — daemon wpdev: API HTTP/JSON su 127.0.0.1:9700. TUTTA la logica di
// orchestrazione sta nell'engine; CLI e GUI sono client di questa API.
// Operazioni lunghe (new/clone/delete/share/export/import) rispondono in NDJSON:
//   {"event":"log","msg":...}\n … {"event":"done","result":...} | {"event":"error","message":...}
import http from 'node:http';
import { API_HOST, API_PORT, ensureStateDirs, MAILPIT_UI_PORT } from './lib/config.ts';
import { ensureMainCaddyfile, caddyRunning, rootCaPath } from './lib/caddy.ts';
import { type Emit } from './lib/util.ts';
import {
  createSite, startSite, stopSite, deleteSite, cloneSite, exportSite, importSite,
  shareSite, unshareSite, listSitesStatus, adminUrl, setXdebug, setPhpVersion,
  readLogs, reconcile,
} from './lib/sites.ts';
import { getSite, loadRegistry } from './lib/registry.ts';
import { listBlueprints, saveBlueprint } from './lib/blueprint.ts';

const VERSION = '0.1.0';

// Le operazioni che toccano registry/Caddy sono serializzate: niente race su reload.
let opChain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = opChain.then(fn, fn);
  opChain = next.catch(() => { /* l'errore arriva comunque al chiamante */ });
  return next;
}

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (d) => { data += d; if (data.length > 1_000_000) req.destroy(); });
    req.on('end', () => {
      if (!data.trim()) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error('body JSON non valido')); }
    });
    req.on('error', reject);
  });
}

// CORS aperto: l'API ascolta solo su 127.0.0.1 e la GUI Electron fetcha da file://.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

function sendJson(res: http.ServerResponse, code: number, obj: unknown): void {
  res.writeHead(code, { 'content-type': 'application/json', ...CORS });
  res.end(JSON.stringify(obj, null, 1) + '\n');
}

// NDJSON: header subito, log in streaming, esito in coda.
async function streamOp(res: http.ServerResponse, fn: (emit: Emit) => Promise<unknown>): Promise<void> {
  res.writeHead(200, { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store', ...CORS });
  const emit: Emit = (msg) => res.write(JSON.stringify({ event: 'log', msg }) + '\n');
  try {
    const result = await withLock(() => fn(emit));
    res.end(JSON.stringify({ event: 'done', result: result ?? null }) + '\n');
  } catch (err) {
    res.end(JSON.stringify({ event: 'error', message: (err as Error).message }) + '\n');
  }
}

async function route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${API_HOST}:${API_PORT}`);
  const parts = url.pathname.split('/').filter(Boolean); // ["api", ...]
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (parts[0] !== 'api') return sendJson(res, 404, { error: 'not found' });

  // GET /api/health
  if (parts[1] === 'health' && method === 'GET') {
    return sendJson(res, 200, {
      ok: true, version: VERSION, pid: process.pid,
      caddy: await caddyRunning(),
      mailpitUi: `http://127.0.0.1:${MAILPIT_UI_PORT}`,
      rootCa: rootCaPath(),
    });
  }

  // /api/blueprints
  if (parts[1] === 'blueprints') {
    if (method === 'GET') return sendJson(res, 200, { blueprints: listBlueprints() });
    if (method === 'POST') {
      const body = await readBody(req);
      const from = getSite(String(body.from ?? ''));
      return streamOp(res, (emit) => saveBlueprint(from, String(body.name ?? ''), emit));
    }
  }

  // /api/import
  if (parts[1] === 'import' && method === 'POST') {
    const body = await readBody(req);
    return streamOp(res, (emit) => importSite({
      slug: String(body.slug ?? ''),
      zip: String(body.zip ?? ''),
      sql: body.sql ? String(body.sql) : undefined,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : undefined,
      title: body.title ? String(body.title) : undefined,
      php: body.php ? String(body.php) : undefined,
    }, emit));
  }

  // /api/sites…
  if (parts[1] === 'sites') {
    const slug = parts[2];
    const action = parts[3];

    if (!slug && method === 'GET') {
      return sendJson(res, 200, { sites: await listSitesStatus(false) });
    }
    if (!slug && method === 'POST') {
      const body = await readBody(req);
      return streamOp(res, (emit) => createSite({
        slug: String(body.slug ?? ''),
        title: body.title ? String(body.title) : undefined,
        blueprint: body.blueprint ? String(body.blueprint) : undefined,
        php: body.php ? String(body.php) : undefined,
        locale: body.locale ? String(body.locale) : undefined,
      }, emit));
    }
    if (slug && !action && method === 'GET') {
      return sendJson(res, 200, { site: getSite(slug) });
    }
    if (slug && !action && method === 'DELETE') {
      return streamOp(res, (emit) => deleteSite(slug, emit));
    }
    if (slug && method === 'POST') {
      const body = await readBody(req);
      switch (action) {
        case 'start': return streamOp(res, (emit) => startSite(slug, emit));
        case 'stop': return streamOp(res, (emit) => stopSite(slug, emit));
        case 'restart': return streamOp(res, async (emit) => { await stopSite(slug, emit); return startSite(slug, emit); });
        case 'clone': return streamOp(res, (emit) => cloneSite(slug, String(body.dst ?? ''), emit));
        case 'share': return streamOp(res, (emit) => shareSite(slug, body.auth ? String(body.auth) : undefined, emit));
        case 'export': return streamOp(res, (emit) => exportSite(slug, emit));
        case 'php': return streamOp(res, (emit) => setPhpVersion(slug, String(body.version ?? ''), emit));
        case 'xdebug': return streamOp(res, (emit) => setXdebug(slug, Boolean(body.on), emit));
      }
    }
    if (slug && action === 'share' && method === 'DELETE') {
      return streamOp(res, (emit) => unshareSite(slug, emit));
    }
    if (slug && action === 'admin' && method === 'GET') {
      return sendJson(res, 200, await adminUrl(slug));
    }
    if (slug && action === 'logs' && method === 'GET') {
      const tail = parseInt(url.searchParams.get('tail') ?? '60', 10);
      return sendJson(res, 200, { logs: readLogs(slug, tail) });
    }
  }

  sendJson(res, 404, { error: `endpoint sconosciuto: ${method} ${url.pathname}` });
}

async function main(): Promise<void> {
  ensureStateDirs();
  ensureMainCaddyfile();
  await reconcile((msg) => console.log(`[reconcile] ${msg}`));

  const server = http.createServer((req, res) => {
    route(req, res).catch((err) => {
      if (!res.headersSent) sendJson(res, 500, { error: (err as Error).message });
      else res.end(JSON.stringify({ event: 'error', message: (err as Error).message }) + '\n');
    });
  });
  server.listen(API_PORT, API_HOST, () => {
    console.log(`wpdevd ${VERSION} in ascolto su http://${API_HOST}:${API_PORT} (siti registrati: ${loadRegistry().sites.length})`);
  });

  const shutdown = () => { console.log('wpdevd: shutdown'); server.close(); process.exit(0); };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => { console.error(`wpdevd: avvio fallito — ${err.message}`); process.exit(1); });
