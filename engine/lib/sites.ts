// Orchestrazione siti: create/start/stop/delete/clone/share/export/import.
// Ogni webroot vive in ~/wpdev-sites/<slug>/app/public (layout speculare a Local).
import fs from 'node:fs';
import path from 'node:path';
import {
  SITES_DIR, EXPORTS_DIR, RUN_DIR, LOGS_DIR, ADMINER_DIR,
  DEFAULT_PHP_VERSION, DEFAULT_LOCALE, SHARE_PORT_BASE, siteUrlFor,
} from './config.ts';
import {
  validateSlug, dbIdent, randToken, randHex, runOk, type Emit,
} from './util.ts';
import {
  type Site, loadRegistry, saveRegistry, getSite, siteExists, upsertSite, removeSite, nextSharePort,
} from './registry.ts';
import { createSiteDb, dropSiteDb, dumpDb, importDb } from './db.ts';
import { startFpm, stopFpm, fpmRunning, removeFpmConf, checkPhpVersion } from './phpfpm.ts';
import {
  writeSiteVhost, removeSiteVhost, writeShareVhost, removeShareVhost,
  reloadCaddy, hashBasicAuth, caddyRunning,
} from './caddy.ts';
import { addHost, removeHost, hostInEtcHosts } from './hosts.ts';
import { downloadCore, writeWpConfig, installWp, isInstalled, ensureLoginPlugin, magicLoginUrl, searchReplace, wpTry } from './wp.ts';
import { applyBlueprint, getBlueprint } from './blueprint.ts';
import { startQuickTunnel, stopTunnel } from './tunnel.ts';

export interface NewSiteOpts {
  slug: string;
  title?: string;
  blueprint?: string;
  php?: string;
  locale?: string;
}

function buildSite(opts: NewSiteOpts): Site {
  const slug = opts.slug;
  const sitePath = path.join(SITES_DIR, slug);
  return {
    id: randHex(12),
    name: opts.title ?? slug,
    slug,
    domain: `${slug}.localhost`,
    url: siteUrlFor(`${slug}.localhost`),
    path: sitePath,
    webroot: path.join(sitePath, 'app', 'public'),
    phpVersion: opts.php ?? DEFAULT_PHP_VERSION,
    db: { name: dbIdent(slug), user: dbIdent(slug), pass: randToken(20) },
    socket: path.join(RUN_DIR, `${slug}.sock`),
    adminUser: 'raffa',
    adminPass: randToken(16),
    status: 'stopped',
    blueprint: opts.blueprint ?? null,
    share: null,
    xdebug: false,
    createdAt: new Date().toISOString(),
  };
}

export async function createSite(opts: NewSiteOpts, emit: Emit): Promise<Site> {
  validateSlug(opts.slug);
  if (siteExists(opts.slug)) throw new Error(`il sito "${opts.slug}" esiste già`);
  if (fs.existsSync(path.join(SITES_DIR, opts.slug))) {
    throw new Error(`la cartella ${path.join(SITES_DIR, opts.slug)} esiste già: rimuovila o scegli un altro slug`);
  }
  if (opts.blueprint) getBlueprint(opts.blueprint); // fallisce subito se non esiste
  if (opts.php) checkPhpVersion(opts.php);
  if (!(await caddyRunning())) {
    throw new Error('Caddy wpdev non raggiungibile (admin :2020): systemctl --user start wpdev-caddy');
  }

  const site = buildSite(opts);
  try {
    emit(`creo ${site.webroot}`);
    fs.mkdirSync(site.webroot, { recursive: true });
    fs.mkdirSync(path.join(LOGS_DIR, site.slug), { recursive: true });

    emit(`registro ${site.domain} in /etc/hosts (helper privilegiato)`);
    await addHost(site.domain);

    emit(`creo database ${site.db.name} + utente dedicato`);
    await createSiteDb(site.db);

    emit(`scarico WordPress core (${opts.locale ?? DEFAULT_LOCALE})…`);
    await downloadCore(site, opts.locale ?? DEFAULT_LOCALE);

    emit('scrivo wp-config.php');
    writeWpConfig(site);

    emit(`installo WordPress (admin: ${site.adminUser})`);
    await installWp(site, opts.title ?? opts.slug);

    if (opts.blueprint) {
      emit(`applico blueprint "${opts.blueprint}"`);
      await applyBlueprint(site, opts.blueprint, emit);
    }

    // Magic login (wpdev admin): non fatale se il package wp-cli manca.
    const login = await wpTry(site, ['login', 'install', '--activate', '--yes']);
    if (login.code !== 0) emit('avviso: wp-cli-login-command non disponibile — "wpdev admin" userà user/pass');

    emit('avvio php-fpm + vhost Caddy');
    await startSiteInternal(site);
    site.status = 'running';
    upsertSite(site);
    emit(`sito pronto: ${site.url}`);
    return site;
  } catch (err) {
    emit(`ERRORE: ${(err as Error).message}`);
    emit('rollback: rimuovo le risorse create…');
    await destroyResources(site, emit);
    throw err;
  }
}

async function startSiteInternal(site: Site): Promise<void> {
  await startFpm(site);
  writeSiteVhost(site);
  await reloadCaddy();
  if (!hostInEtcHosts(site.domain)) await addHost(site.domain);
}

export async function startSite(slug: string, emit: Emit): Promise<Site> {
  const site = getSite(slug);
  emit(`avvio ${slug}`);
  await startSiteInternal(site);
  site.status = 'running';
  upsertSite(site);
  return site;
}

export async function stopSite(slug: string, emit: Emit): Promise<Site> {
  const site = getSite(slug);
  emit(`fermo ${slug}`);
  if (site.share) {
    stopTunnel(slug, site.share.pid);
    removeShareVhost(slug);
    site.share = null;
  }
  await stopFpm(slug);
  removeSiteVhost(slug);
  await reloadCaddy();
  site.status = 'stopped';
  upsertSite(site);
  return site;
}

// Cleanup best-effort di TUTTE le risorse di un sito (usato da delete e dal rollback di new).
async function destroyResources(site: Site, emit: Emit): Promise<string[]> {
  const problems: string[] = [];
  const attempt = async (label: string, fn: () => Promise<void> | void) => {
    try { await fn(); } catch (err) { problems.push(`${label}: ${(err as Error).message}`); }
  };
  await attempt('tunnel', () => { if (site.share) stopTunnel(site.slug, site.share.pid); });
  await attempt('php-fpm', () => stopFpm(site.slug));
  await attempt('vhost', () => { removeSiteVhost(site.slug); });
  await attempt('caddy reload', () => reloadCaddy());
  await attempt('database', () => dropSiteDb(site.db));
  await attempt('hosts', () => removeHost(site.domain));
  await attempt('webroot', () => fs.rmSync(site.path, { recursive: true, force: true }));
  await attempt('fpm conf', () => removeFpmConf(site.slug));
  await attempt('socket', () => { try { fs.unlinkSync(site.socket); } catch { /* assente */ } });
  await attempt('logs', () => fs.rmSync(path.join(LOGS_DIR, site.slug), { recursive: true, force: true }));
  for (const p of problems) emit(`avviso cleanup: ${p}`);
  return problems;
}

export async function deleteSite(slug: string, emit: Emit): Promise<void> {
  const site = getSite(slug);
  emit(`elimino ${slug} (webroot, db, vhost, hosts, registry)`);
  const problems = await destroyResources(site, emit);
  removeSite(slug);
  if (problems.length > 0) {
    throw new Error(`sito rimosso dal registry ma con residui: ${problems.join('; ')}`);
  }
  emit(`${slug} eliminato senza residui`);
}

export async function cloneSite(srcSlug: string, dstSlug: string, emit: Emit): Promise<Site> {
  const src = getSite(srcSlug);
  validateSlug(dstSlug);
  if (siteExists(dstSlug)) throw new Error(`il sito "${dstSlug}" esiste già`);

  const dst = buildSite({ slug: dstSlug, title: `${src.name} (clone)`, php: src.phpVersion });
  dst.blueprint = src.blueprint;
  dst.adminUser = src.adminUser;
  dst.adminPass = src.adminPass;
  try {
    emit(`clono ${srcSlug} → ${dstSlug}: copio i file…`);
    fs.mkdirSync(dst.webroot, { recursive: true });
    fs.mkdirSync(path.join(LOGS_DIR, dst.slug), { recursive: true });
    await runOk('rsync', ['-a', src.webroot + '/', dst.webroot + '/']);

    await addHost(dst.domain);
    emit(`creo database ${dst.db.name} e importo il dump di ${srcSlug}`);
    await createSiteDb(dst.db);
    const tmpSql = path.join(RUN_DIR, `clone-${dst.slug}.sql`);
    await dumpDb(src.db, tmpSql);
    await importDb(dst.db, tmpSql);
    fs.unlinkSync(tmpSql);

    emit('riscrivo wp-config.php (nuove credenziali db)');
    writeWpConfig(dst, detectTablePrefix(src.webroot));

    emit(`search-replace //${src.domain} → //${dst.domain}`);
    await startSiteInternal(dst); // fpm su prima del search-replace non serve, ma il vhost sì per verifiche
    await searchReplace(dst, `//${src.domain}`, `//${dst.domain}`);

    dst.status = 'running';
    upsertSite(dst);
    emit(`clone pronto: ${dst.url}`);
    return dst;
  } catch (err) {
    emit(`ERRORE: ${(err as Error).message}`);
    await destroyResources(dst, emit);
    throw err;
  }
}

export async function exportSite(slug: string, emit: Emit): Promise<{ zip: string; sql: string }> {
  const site = getSite(slug);
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
  const base = path.join(EXPORTS_DIR, `${slug}-${stamp}`);
  const sqlFile = `${base}.sql`;
  const zipFile = `${base}.zip`;

  emit(`dump database → ${sqlFile}`);
  await dumpDb(site.db, sqlFile);
  emit(`zip webroot → ${zipFile}`);
  await runOk('zip', ['-qr', zipFile, '.'], { cwd: site.webroot, timeoutMs: 600_000 });
  emit('export completato (pronto per scp + import su Hostinger)');
  return { zip: zipFile, sql: sqlFile };
}

export interface ImportOpts {
  slug: string;
  zip: string;        // zip del webroot (formato wpdev export) OPPURE directory webroot
  sql?: string;       // dump .sql opzionale
  sourceUrl?: string; // URL d'origine per il search-replace (auto-rilevato dal db se omesso)
  title?: string;
  php?: string;
}

// Legge $table_prefix dal wp-config d'origine (i siti Local possono averlo custom).
function detectTablePrefix(webroot: string): string {
  try {
    const conf = fs.readFileSync(path.join(webroot, 'wp-config.php'), 'utf8');
    const m = conf.match(/\$table_prefix\s*=\s*['"]([A-Za-z0-9_]+)['"]/);
    if (m) return m[1];
  } catch { /* wp-config assente: default */ }
  return 'wp_';
}

export async function importSite(opts: ImportOpts, emit: Emit): Promise<Site> {
  validateSlug(opts.slug);
  if (siteExists(opts.slug)) throw new Error(`il sito "${opts.slug}" esiste già`);
  if (!fs.existsSync(opts.zip)) throw new Error(`zip/directory non trovata: ${opts.zip}`);
  if (opts.sql && !fs.existsSync(opts.sql)) throw new Error(`sql non trovato: ${opts.sql}`);

  const site = buildSite({ slug: opts.slug, title: opts.title ?? opts.slug, php: opts.php });
  try {
    fs.mkdirSync(site.webroot, { recursive: true });
    fs.mkdirSync(path.join(LOGS_DIR, site.slug), { recursive: true });
    if (fs.statSync(opts.zip).isDirectory()) {
      emit(`copio ${opts.zip} → ${site.webroot} (rsync)`);
      await runOk('rsync', ['-a', opts.zip.replace(/\/$/, '') + '/', site.webroot + '/'],
        { timeoutMs: 3_600_000 });
    } else {
      emit(`estraggo ${opts.zip} → ${site.webroot}`);
      await runOk('unzip', ['-qo', opts.zip, '-d', site.webroot], { timeoutMs: 600_000 });
    }

    await addHost(site.domain);
    emit(`creo database ${site.db.name}`);
    await createSiteDb(site.db);
    if (opts.sql) {
      emit('importo il dump sql');
      await importDb(site.db, opts.sql);
    }
    const tablePrefix = detectTablePrefix(site.webroot);
    if (tablePrefix !== 'wp_') emit(`prefisso tabelle rilevato: ${tablePrefix}`);
    emit('riscrivo wp-config.php (credenziali locali)');
    writeWpConfig(site, tablePrefix);

    // URL d'origine: quello passato, altrimenti auto-rilevato dal db importato.
    let sourceUrl = opts.sourceUrl?.replace(/\/$/, '');
    if (opts.sql && !sourceUrl) {
      const cur = await wpTry(site, ['option', 'get', 'siteurl']);
      const val = cur.stdout.trim();
      if (cur.code === 0 && val.startsWith('http')) sourceUrl = val.replace(/\/$/, '');
    }
    await startSiteInternal(site);
    if (opts.sql && sourceUrl && sourceUrl !== site.url) {
      emit(`search-replace ${sourceUrl} → ${site.url}`);
      await searchReplace(site, sourceUrl, site.url);
    }
    if (opts.sql) {
      // Garantisce un accesso admin locale noto anche su db importati.
      const { ADMIN_EMAIL } = await import('./config.ts');
      const create = await wpTry(site, ['user', 'create', site.adminUser, ADMIN_EMAIL,
        '--role=administrator', `--user_pass=${site.adminPass}`]);
      if (create.code !== 0) {
        await wpTry(site, ['user', 'update', site.adminUser, `--user_pass=${site.adminPass}`]);
      }
    }
    site.status = 'running';
    upsertSite(site);
    emit(`import completato: ${site.url}`);
    return site;
  } catch (err) {
    emit(`ERRORE: ${(err as Error).message}`);
    await destroyResources(site, emit);
    throw err;
  }
}

export async function shareSite(slug: string, auth: string | undefined, emit: Emit): Promise<{ url: string; authUser: string; authPass: string }> {
  const site = getSite(slug);
  if (site.status !== 'running' || !fpmRunning(slug)) {
    throw new Error(`il sito "${slug}" non è in esecuzione: wpdev start ${slug}`);
  }
  if (site.share?.url) {
    emit(`Live Link già attivo: ${site.share.url}`);
    return { url: site.share.url, authUser: site.share.authUser, authPass: site.share.authPass };
  }
  let authUser = 'guest';
  let authPass = randToken(10);
  if (auth) {
    const i = auth.indexOf(':');
    if (i <= 0) throw new Error('--auth vuole il formato utente:password');
    authUser = auth.slice(0, i);
    authPass = auth.slice(i + 1);
  }
  const port = site.share?.port ?? nextSharePort(SHARE_PORT_BASE);
  site.share = { port, url: null, authUser, authPass, pid: null };

  emit(`vhost condivisione su 127.0.0.1:${port} (basic auth: ${authUser})`);
  const hash = await hashBasicAuth(authPass);
  await writeShareVhost(site, hash);
  await reloadCaddy();

  emit('avvio quick tunnel cloudflared…');
  const { url, pid } = await startQuickTunnel(slug, `http://127.0.0.1:${port}`);
  site.share.url = url;
  site.share.pid = pid;
  upsertSite(site);
  emit(`Live Link attivo: ${url} (auth ${authUser}:${authPass})`);
  return { url, authUser, authPass };
}

export async function unshareSite(slug: string, emit: Emit): Promise<void> {
  const site = getSite(slug);
  if (!site.share) { emit('nessun Live Link attivo'); return; }
  stopTunnel(slug, site.share.pid);
  removeShareVhost(slug);
  await reloadCaddy();
  site.share = null;
  upsertSite(site);
  emit('Live Link fermato');
}

export interface SiteStatusRow {
  slug: string;
  name: string;
  domain: string;
  url: string;
  status: string;
  php: string;
  fpm: boolean;
  installed: boolean | null;
  shareUrl: string | null;
  path: string;
}

export async function listSitesStatus(withInstalled: boolean = false): Promise<SiteStatusRow[]> {
  const reg = loadRegistry();
  const rows: SiteStatusRow[] = [];
  for (const s of reg.sites) {
    rows.push({
      slug: s.slug,
      name: s.name,
      domain: s.domain,
      url: s.url ?? siteUrlFor(s.domain),
      status: s.status,
      php: s.phpVersion,
      fpm: fpmRunning(s.slug),
      installed: withInstalled ? await isInstalled(s) : null,
      shareUrl: s.share?.url ?? null,
      path: s.path,
    });
  }
  return rows;
}

export async function adminUrl(slug: string): Promise<{ url: string; user: string; pass: string }> {
  const site = getSite(slug);
  if (!fpmRunning(slug)) throw new Error(`il sito "${slug}" non è in esecuzione: wpdev start ${slug}`);
  try {
    const url = await magicLoginUrl(site);
    return { url, user: site.adminUser, pass: site.adminPass };
  } catch {
    // Fallback senza magic login: wp-login classico + credenziali dal registry.
    return { url: `${site.url}/wp-login.php`, user: site.adminUser, pass: site.adminPass };
  }
}

export async function setXdebug(slug: string, on: boolean, emit: Emit): Promise<void> {
  const site = getSite(slug);
  site.xdebug = on;
  upsertSite(site);
  if (site.status === 'running') {
    emit('riavvio php-fpm con la nuova configurazione xdebug');
    await stopFpm(slug);
    await startFpm(site);
  }
}

export async function setPhpVersion(slug: string, version: string, emit: Emit): Promise<void> {
  checkPhpVersion(version);
  const site = getSite(slug);
  site.phpVersion = version;
  upsertSite(site);
  if (site.status === 'running') {
    emit(`riavvio php-fpm con PHP ${version}`);
    await stopFpm(slug);
    await startFpm(site);
  }
}

export function readLogs(slug: string, tail: number = 60): Record<string, string[]> {
  const site = getSite(slug);
  const dir = path.join(LOGS_DIR, site.slug);
  const files = ['php-error.log', 'php-fpm.log', 'caddy-access.log', 'wp-debug.log', 'cloudflared.log'];
  const out: Record<string, string[]> = {};
  for (const f of files) {
    const p = path.join(dir, f);
    if (fs.existsSync(p)) {
      out[f] = fs.readFileSync(p, 'utf8').trimEnd().split('\n').slice(-tail);
    }
  }
  return out;
}

// Pool fpm di servizio per Adminer (vhost https://adminer.localhost creato dal setup).
export function adminerPseudoSite(): Site {
  return {
    id: 'adminer', name: 'Adminer', slug: 'adminer', domain: 'adminer.localhost', url: siteUrlFor('adminer.localhost'),
    path: ADMINER_DIR, webroot: ADMINER_DIR, phpVersion: DEFAULT_PHP_VERSION,
    db: { name: '', user: '', pass: '' },
    socket: path.join(RUN_DIR, 'adminer.sock'),
    adminUser: '', adminPass: '', status: 'running',
    blueprint: null, share: null, xdebug: false, createdAt: '',
  };
}

// Riconciliazione all'avvio del daemon: i figli (fpm, tunnel) muoiono col daemon,
// quindi rilancia fpm per i siti "running" e azzera i Live Link (URL quick tunnel non stabili).
export async function reconcile(emit: Emit): Promise<void> {
  if (fs.existsSync(path.join(ADMINER_DIR, 'adminer.php'))) {
    try { await startFpm(adminerPseudoSite()); } catch (err) {
      emit(`adminer: pool fpm non avviato — ${(err as Error).message}`);
    }
  }
  const reg = loadRegistry();
  let dirty = false;
  for (const site of reg.sites) {
    if (site.share) {
      removeShareVhost(site.slug);
      site.share = null;
      dirty = true;
      emit(`${site.slug}: Live Link azzerato (i quick tunnel non sopravvivono al riavvio del daemon)`);
    }
    if (site.status === 'running' && !fpmRunning(site.slug)) {
      try {
        await startFpm(site);
        writeSiteVhost(site);
        emit(`${site.slug}: php-fpm rilanciato`);
      } catch (err) {
        emit(`${site.slug}: impossibile rilanciare php-fpm — ${(err as Error).message}`);
      }
    }
  }
  if (dirty) saveRegistry(reg);
  try { await reloadCaddy(); } catch (err) { emit(`caddy reload fallito: ${(err as Error).message}`); }
}
