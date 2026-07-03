#!/usr/bin/env -S node --no-warnings
// wpdev — CLI: thin client dell'API di wpdevd (stessa logica per CLI e GUI).
// Solo `cli`/`shell`/`import --from-remote` eseguono localmente (serve il TTY / le chiavi ssh).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import {
  API_HOST, API_PORT, REPO_DIR, WP_BIN, MAILPIT_UI_PORT, siteUrlFor,
} from './lib/config.ts';

const API = `http://${API_HOST}:${API_PORT}`;

function die(msg: string): never {
  console.error(`wpdev: ${msg}`);
  process.exit(1);
}

async function daemonUp(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch { return false; }
}

async function ensureDaemon(): Promise<void> {
  if (await daemonUp()) return;
  // Prova systemd user unit, poi fallback a spawn diretto.
  spawnSync('systemctl', ['--user', 'start', 'wpdevd.service'], { stdio: 'ignore' });
  for (let i = 0; i < 20; i++) {
    if (await daemonUp()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  const child = spawn(process.execPath, ['--no-warnings', path.join(REPO_DIR, 'engine', 'daemon.ts')], {
    detached: true, stdio: 'ignore',
  });
  child.unref();
  for (let i = 0; i < 20; i++) {
    if (await daemonUp()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  die('wpdevd non parte (prova: node ~/wpdev/engine/daemon.ts per vedere l\'errore)');
}

async function apiJson(method: string, apiPath: string, body?: unknown): Promise<any> {
  await ensureDaemon();
  const res = await fetch(`${API}${apiPath}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) die(data.error ?? `API ${res.status}`);
  return data;
}

// Segue una risposta NDJSON stampando i log; ritorna il result finale.
async function apiStream(method: string, apiPath: string, body?: unknown): Promise<any> {
  await ensureDaemon();
  const res = await fetch(`${API}${apiPath}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    die((data as any).error ?? `API ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let final: any = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const evt = JSON.parse(line);
      if (evt.event === 'log') console.log(`  • ${evt.msg}`);
      else if (evt.event === 'error') die(evt.message);
      else if (evt.event === 'done') final = evt.result;
    }
  }
  return final;
}

function parseFlags(args: string[]): { pos: string[]; flags: Record<string, string | boolean> } {
  const pos: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > 0) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else if (i + 1 < args.length && !args[i + 1].startsWith('--')) { flags[a.slice(2)] = args[++i]; }
      else flags[a.slice(2)] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((r) => rl.question(`${question} [y/N] `, r));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

function printSiteSummary(site: any): void {
  console.log('');
  console.log(`  URL:        ${site.url}`);
  console.log(`  Admin:      ${site.url}/wp-admin/  (${site.adminUser} / ${site.adminPass})`);
  console.log(`  Webroot:    ${site.webroot}`);
  console.log(`  DB:         ${site.db.name} (utente ${site.db.user})`);
  console.log(`  PHP:        ${site.phpVersion}`);
}

async function cmdList(): Promise<void> {
  const { sites } = await apiJson('GET', '/api/sites');
  if (sites.length === 0) { console.log('nessun sito (crea con: wpdev new <slug>)'); return; }
  const rows = sites.map((s: any) => ({
    SITO: s.slug,
    STATO: s.status === 'running' ? (s.fpm ? 'running' : 'errore(fpm giù)') : 'stopped',
    PHP: s.php,
    URL: s.url,
    'LIVE LINK': s.shareUrl ?? '-',
  }));
  console.table(rows);
}

async function resolveAll(flagAll: boolean, slug: string | undefined, verb: string): Promise<string[]> {
  if (flagAll) {
    const { sites } = await apiJson('GET', '/api/sites');
    return sites.map((s: any) => s.slug);
  }
  if (!slug) die(`uso: wpdev ${verb} <slug>|--all`);
  return [slug];
}

// import --from-remote: copia webroot + dump db via ssh (lato CLI: servono le chiavi dell'utente),
// poi passa i file locali alla normale API /api/import.
async function remoteFetch(remote: string, slug: string): Promise<{ zip: string; sql: string | null; sourceUrl: string | null }> {
  const m = remote.match(/^([^:]+):(.+)$/);
  if (!m) die('formato --from-remote: utente@host:/percorso/webroot');
  const [, host, remotePath] = m;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `wpdev-import-${slug}-`));
  const zip = path.join(tmp, 'webroot.zip');

  console.log(`  • copio il webroot da ${host}:${remotePath}…`);
  const tar = spawnSync('bash', ['-c',
    `ssh ${JSON.stringify(host)} "cd ${JSON.stringify(remotePath)} && tar czf - ." > ${JSON.stringify(path.join(tmp, 'webroot.tgz'))}`],
    { stdio: ['ignore', 'inherit', 'inherit'] });
  if (tar.status !== 0) die('copia remota fallita (ssh/tar)');
  fs.mkdirSync(path.join(tmp, 'webroot'));
  spawnSync('tar', ['xzf', path.join(tmp, 'webroot.tgz'), '-C', path.join(tmp, 'webroot')], { stdio: 'inherit' });
  const zipRes = spawnSync('zip', ['-qr', zip, '.'], { cwd: path.join(tmp, 'webroot') });
  if (zipRes.status !== 0) die('zip del webroot remoto fallito');

  console.log('  • provo il dump del database remoto (wp db export)…');
  const sqlFile = path.join(tmp, 'db.sql');
  const dump = spawnSync('bash', ['-c',
    `ssh ${JSON.stringify(host)} "cd ${JSON.stringify(remotePath)} && wp db export - 2>/dev/null" > ${JSON.stringify(sqlFile)}`]);
  const hasSql = dump.status === 0 && fs.existsSync(sqlFile) && fs.statSync(sqlFile).size > 1000;
  if (!hasSql) console.log('  • dump remoto non disponibile (wp-cli assente sul server?): import solo file');

  let sourceUrl: string | null = null;
  if (hasSql) {
    const opt = spawnSync('bash', ['-c', `ssh ${JSON.stringify(host)} "cd ${JSON.stringify(remotePath)} && wp option get siteurl 2>/dev/null"`]);
    const out = opt.stdout?.toString().trim();
    if (opt.status === 0 && out?.startsWith('http')) sourceUrl = out;
  }
  return { zip, sql: hasSql ? sqlFile : null, sourceUrl };
}

const HELP = `wpdev — WordPress locale scriptabile (clone LocalWP nativo WSL)

  new <slug> [--blueprint <n>] [--php 8.3] [--title ..] [--locale it_IT]
  list                              elenca i siti
  start|stop|restart <slug>|--all
  delete <slug> [--yes]             elimina tutto senza residui
  cli <slug> -- <argomenti wp>      wp-cli sul sito (es: wpdev cli demo -- plugin list)
  shell <slug>                      shell nel webroot del sito
  open <slug>                       stampa gli URL del sito
  admin <slug>                      URL di login automatico (magic link)
  db <slug>                         Adminer + credenziali db
  share <slug> [--auth u:p] [--stop]   Live Link pubblico via cloudflared
  clone <src> <dst>
  export <slug>                     zip webroot + dump .sql in ~/wpdev-exports
  import <zip> <slug> [--sql <f>] [--source-url <u>]
  import --from-remote u@host:/path <slug>
  blueprint list | blueprint save <slug> <nome>
  php <slug> <versione>             cambia versione PHP del sito
  xdebug <slug> on|off
  logs <slug> [--tail N]
  mailpit                           stampa l'URL della UI Mailpit
  daemon start|stop|status
  gui                               apre la GUI desktop (WSLg)
  selftest                          suite di accettazione end-to-end`;

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, flags } = parseFlags(rest);

  switch (cmd) {
    case 'new': {
      const slug = pos[0] ?? die('uso: wpdev new <slug> [--blueprint <n>] [--php <v>] [--title <t>]');
      const site = await apiStream('POST', '/api/sites', {
        slug, blueprint: flags.blueprint, php: flags.php, title: flags.title, locale: flags.locale,
      });
      printSiteSummary(site);
      break;
    }
    case 'list': case 'ls': await cmdList(); break;
    case 'start': case 'stop': case 'restart': {
      const slugs = await resolveAll(flags.all === true, pos[0], cmd);
      for (const s of slugs) await apiStream('POST', `/api/sites/${s}/${cmd}`);
      break;
    }
    case 'delete': case 'rm': {
      const slug = pos[0] ?? die('uso: wpdev delete <slug>');
      if (flags.yes !== true && !(await confirm(`eliminare DEFINITIVAMENTE "${slug}" (webroot + database)?`))) {
        die('annullato');
      }
      await apiStream('DELETE', `/api/sites/${slug}`);
      break;
    }
    case 'cli': {
      const slug = pos[0] ?? die('uso: wpdev cli <slug> -- <argomenti wp>');
      const sep = process.argv.indexOf('--');
      const wpArgs = sep >= 0 ? process.argv.slice(sep + 1) : process.argv.slice(4);
      const { site } = await apiJson('GET', `/api/sites/${slug}`);
      const res = spawnSync(WP_BIN, [`--path=${site.webroot}`, ...wpArgs], { stdio: 'inherit' });
      process.exit(res.status ?? 1);
      break;
    }
    case 'shell': {
      const slug = pos[0] ?? die('uso: wpdev shell <slug>');
      const { site } = await apiJson('GET', `/api/sites/${slug}`);
      console.log(`shell nel webroot di ${slug} (exit per uscire) — wp-cli già puntato sul sito`);
      const res = spawnSync(process.env.SHELL ?? 'bash', [], {
        stdio: 'inherit', cwd: site.webroot,
        env: { ...process.env, WPDEV_SITE: slug, WP_CLI_CONFIG_PATH: '', PROMPT_COMMAND: '' },
      });
      process.exit(res.status ?? 0);
      break;
    }
    case 'open': {
      const slug = pos[0] ?? die('uso: wpdev open <slug>');
      const { site } = await apiJson('GET', `/api/sites/${slug}`);
      console.log(site.url);
      break;
    }
    case 'admin': {
      const slug = pos[0] ?? die('uso: wpdev admin <slug>');
      const data = await apiJson('GET', `/api/sites/${slug}/admin`);
      console.log(data.url);
      if (data.url.includes('wp-login.php')) console.log(`(login: ${data.user} / ${data.pass})`);
      break;
    }
    case 'db': {
      const slug = pos[0] ?? die('uso: wpdev db <slug>');
      const { site } = await apiJson('GET', `/api/sites/${slug}`);
      console.log(`Adminer:  ${siteUrlFor('adminer.localhost')}/?server=localhost&username=${site.db.user}&db=${site.db.name}`);
      console.log(`Password: ${site.db.pass}`);
      break;
    }
    case 'share': {
      const slug = pos[0] ?? die('uso: wpdev share <slug> [--auth utente:password] [--stop]');
      if (flags.stop === true) { await apiStream('DELETE', `/api/sites/${slug}/share`); break; }
      const r = await apiStream('POST', `/api/sites/${slug}/share`, { auth: flags.auth });
      console.log('');
      console.log(`  Live Link:  ${r.url}`);
      console.log(`  Accesso:    ${r.authUser} / ${r.authPass}`);
      break;
    }
    case 'clone': {
      const [src, dst] = pos;
      if (!src || !dst) die('uso: wpdev clone <sorgente> <destinazione>');
      const site = await apiStream('POST', `/api/sites/${src}/clone`, { dst });
      printSiteSummary(site);
      break;
    }
    case 'export': {
      const slug = pos[0] ?? die('uso: wpdev export <slug>');
      const r = await apiStream('POST', `/api/sites/${slug}/export`);
      console.log(`\n  ${r.zip}\n  ${r.sql}`);
      break;
    }
    case 'import': {
      if (flags['from-remote']) {
        const slug = pos[0] ?? die('uso: wpdev import --from-remote utente@host:/path <slug>');
        const fetched = await remoteFetch(String(flags['from-remote']), slug);
        const site = await apiStream('POST', '/api/import', {
          slug, zip: fetched.zip, sql: fetched.sql ?? undefined, sourceUrl: fetched.sourceUrl ?? undefined,
        });
        printSiteSummary(site);
      } else {
        const [zip, slug] = pos;
        if (!zip || !slug) die('uso: wpdev import <zip> <slug> [--sql <file>] [--source-url <url>]');
        const site = await apiStream('POST', '/api/import', {
          slug, zip: path.resolve(zip),
          sql: flags.sql ? path.resolve(String(flags.sql)) : undefined,
          sourceUrl: flags['source-url'] ? String(flags['source-url']) : undefined,
          title: flags.title ? String(flags.title) : undefined,
        });
        printSiteSummary(site);
      }
      break;
    }
    case 'blueprint': {
      const sub = pos[0];
      if (sub === 'list') {
        const { blueprints } = await apiJson('GET', '/api/blueprints');
        if (blueprints.length === 0) console.log('nessun blueprint');
        else console.table(blueprints.map((b: any) => ({ NOME: b.name, TEMI: b.themes.join(','), ATTIVA: b.activate ?? '-', DESCRIZIONE: b.description })));
      } else if (sub === 'save') {
        const [, from, name] = pos;
        if (!from || !name) die('uso: wpdev blueprint save <slug> <nome>');
        await apiStream('POST', '/api/blueprints', { from, name });
        console.log(`blueprint "${name}" salvato`);
      } else die('uso: wpdev blueprint list|save <slug> <nome>');
      break;
    }
    case 'php': {
      const [slug, version] = pos;
      if (!slug || !version) die('uso: wpdev php <slug> <versione>');
      await apiStream('POST', `/api/sites/${slug}/php`, { version });
      break;
    }
    case 'xdebug': {
      const [slug, mode] = pos;
      if (!slug || !['on', 'off'].includes(mode)) die('uso: wpdev xdebug <slug> on|off');
      await apiStream('POST', `/api/sites/${slug}/xdebug`, { on: mode === 'on' });
      console.log(`xdebug ${mode}`);
      break;
    }
    case 'logs': {
      const slug = pos[0] ?? die('uso: wpdev logs <slug> [--tail N]');
      const tail = flags.tail ? parseInt(String(flags.tail), 10) : 40;
      const { logs } = await apiJson('GET', `/api/sites/${slug}/logs?tail=${tail}`);
      for (const [file, lines] of Object.entries(logs)) {
        console.log(`\n===== ${file} =====`);
        for (const l of lines as string[]) console.log(l);
      }
      break;
    }
    case 'mailpit':
      console.log(`http://127.0.0.1:${MAILPIT_UI_PORT}`);
      break;
    case 'daemon': {
      const sub = pos[0];
      if (sub === 'start') { await ensureDaemon(); console.log('wpdevd attivo'); }
      else if (sub === 'stop') spawnSync('systemctl', ['--user', 'stop', 'wpdevd.service'], { stdio: 'inherit' });
      else if (sub === 'status') {
        console.log(await daemonUp() ? `wpdevd attivo su ${API}` : 'wpdevd non attivo');
      } else die('uso: wpdev daemon start|stop|status');
      break;
    }
    case 'gui': {
      const guiDir = path.join(REPO_DIR, 'gui');
      if (!fs.existsSync(path.join(guiDir, 'node_modules', '.bin', 'electron'))) {
        die(`GUI non installata: cd ${guiDir} && npm install`);
      }
      await ensureDaemon();
      const child = spawn(path.join(guiDir, 'node_modules', '.bin', 'electron'), ['.', '--no-sandbox'], {
        cwd: guiDir, detached: true, stdio: 'ignore',
      });
      child.unref();
      console.log('GUI avviata (finestra WSLg)');
      break;
    }
    case 'selftest': {
      const res = spawnSync('bash', [path.join(REPO_DIR, 'bin', 'wpdev-selftest')], { stdio: 'inherit' });
      process.exit(res.status ?? 1);
      break;
    }
    case 'help': case undefined: case '--help': case '-h':
      console.log(HELP);
      break;
    default:
      die(`comando sconosciuto: "${cmd}" (wpdev help)`);
  }
}

main().catch((err) => die(err.message));
