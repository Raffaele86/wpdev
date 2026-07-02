// Un master php-fpm per sito (isolamento come i lightning services di Local),
// processo figlio di wpdevd, pidfile in ~/.wpdev/run/.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PHP_DIR, RUN_DIR, LOGS_DIR, TEMPLATES_DIR, MAILPIT_BIN, MAILPIT_SMTP, fpmBin } from './config.ts';
import { renderTemplate, readPidFile, pidAlive } from './util.ts';
import type { Site } from './registry.ts';

function fpmConfPath(slug: string): string { return path.join(PHP_DIR, slug, 'fpm.conf'); }
function fpmPidPath(slug: string): string { return path.join(RUN_DIR, `${slug}.fpm.pid`); }

export function renderFpmConf(site: Site): void {
  const dir = path.join(PHP_DIR, site.slug);
  const logDir = path.join(LOGS_DIR, site.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });
  const conf = renderTemplate(path.join(TEMPLATES_DIR, 'fpm.conf.tpl'), {
    slug: site.slug,
    pidFile: fpmPidPath(site.slug),
    socket: site.socket,
    fpmLog: path.join(logDir, 'php-fpm.log'),
    phpErrorLog: path.join(logDir, 'php-error.log'),
    mailpitBin: MAILPIT_BIN,
    mailpitSmtp: MAILPIT_SMTP,
    xdebugMode: site.xdebug ? 'debug' : 'off',
  });
  fs.writeFileSync(fpmConfPath(site.slug), conf);
}

export function fpmRunning(slug: string): boolean {
  const pid = readPidFile(fpmPidPath(slug));
  return pid !== null && pidAlive(pid);
}

export function checkPhpVersion(version: string): void {
  if (!fs.existsSync(fpmBin(version))) {
    throw new Error(
      `php-fpm ${version} non installato (${fpmBin(version)} assente).\n` +
      `Per aggiungere versioni PHP: sudo add-apt-repository ppa:ondrej/php && ` +
      `sudo apt install php${version}-fpm php${version}-mysql php${version}-gd php${version}-mbstring ` +
      `php${version}-xml php${version}-zip php${version}-intl php${version}-imagick`
    );
  }
}

export async function startFpm(site: Site): Promise<void> {
  if (fpmRunning(site.slug)) return;
  checkPhpVersion(site.phpVersion);
  renderFpmConf(site);
  // Socket stantio da uno shutdown sporco: php-fpm rifiuta di partire se esiste.
  try { fs.unlinkSync(site.socket); } catch { /* assente: ok */ }
  const child = spawn(fpmBin(site.phpVersion), ['--fpm-config', fpmConfPath(site.slug), '-F'], {
    detached: false,
    stdio: 'ignore',
  });
  child.unref();
  // Attendi il socket (max 10s): è il segnale che il pool è su.
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (fs.existsSync(site.socket)) return;
    if (child.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  const log = path.join(LOGS_DIR, site.slug, 'php-fpm.log');
  let tail = '';
  try { tail = fs.readFileSync(log, 'utf8').trim().split('\n').slice(-5).join('\n'); } catch { /* no log */ }
  throw new Error(`php-fpm per "${site.slug}" non è partito (socket assente).\n${tail}`);
}

export async function stopFpm(slug: string): Promise<void> {
  const pid = readPidFile(fpmPidPath(slug));
  if (pid !== null && pidAlive(pid)) {
    process.kill(pid, 'SIGQUIT'); // graceful
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline && pidAlive(pid)) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (pidAlive(pid)) process.kill(pid, 'SIGKILL');
  }
  try { fs.unlinkSync(fpmPidPath(slug)); } catch { /* già assente */ }
}

export function removeFpmConf(slug: string): void {
  fs.rmSync(path.join(PHP_DIR, slug), { recursive: true, force: true });
}
