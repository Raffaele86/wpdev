// Percorsi e costanti condivise. Tutto lo stato vive sotto ~/.wpdev (mai in webroot).
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export const HOME = os.homedir();
export const REPO_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
export const TEMPLATES_DIR = path.join(REPO_DIR, 'engine', 'templates');

export const STATE_DIR = path.join(HOME, '.wpdev');
export const SITES_DIR = path.join(HOME, 'wpdev-sites');
// Gli export sono file semplici: possono stare su drvfs (D:) per la visibilità da Windows.
// Configurabile con "exportsDir" in config.json; engine e siti restano su ext4 (socket unix).
export const EXPORTS_DIR: string = (() => {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.wpdev', 'config.json'), 'utf8'));
    if (typeof cfg.exportsDir === 'string' && cfg.exportsDir) return cfg.exportsDir;
  } catch { /* config assente: default */ }
  return path.join(HOME, 'wpdev-exports');
})();

export const REGISTRY_FILE = path.join(STATE_DIR, 'sites.json');
export const CONFIG_FILE = path.join(STATE_DIR, 'config.json');
export const CADDY_DIR = path.join(STATE_DIR, 'caddy');
export const CADDY_SITES_DIR = path.join(CADDY_DIR, 'sites');
export const CADDYFILE = path.join(CADDY_DIR, 'Caddyfile');
export const PHP_DIR = path.join(STATE_DIR, 'php');
export const RUN_DIR = path.join(STATE_DIR, 'run');
export const LOGS_DIR = path.join(STATE_DIR, 'logs');
export const BLUEPRINTS_DIR = path.join(STATE_DIR, 'blueprints');
export const ADMINER_DIR = path.join(STATE_DIR, 'adminer');

export const API_HOST = '127.0.0.1';
export const API_PORT = 9700;
// 443 è occupata dal router httpd di LocalWP lato Windows (rete mirrored):
// wpdev usa una porta HTTPS dedicata. Configurabile con "httpsPort" in config.json
// (metti 443 quando LocalWP non serve più).
export const HTTPS_PORT: number = (() => {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.wpdev', 'config.json'), 'utf8'));
    if (Number.isInteger(cfg.httpsPort)) return cfg.httpsPort;
  } catch { /* config assente: default */ }
  return 8443;
})();

export function siteUrlFor(domain: string): string {
  return HTTPS_PORT === 443 ? `https://${domain}` : `https://${domain}:${HTTPS_PORT}`;
}
export const CADDY_ADMIN = '127.0.0.1:2020';
export const MAILPIT_SMTP = '127.0.0.1:1025';
export const MAILPIT_UI_PORT = 8025;
export const SHARE_PORT_BASE = 9800;

export const CADDY_BIN = path.join(HOME, '.local', 'bin', 'caddy');
export const CLOUDFLARED_BIN = path.join(HOME, '.local', 'bin', 'cloudflared');
export const MAILPIT_BIN = path.join(HOME, '.local', 'bin', 'mailpit');
export const WP_BIN = path.join(HOME, '.local', 'bin', 'wp');
export const HOSTS_HELPER = '/usr/local/sbin/wpdev-hosts';

export const DEFAULT_PHP_VERSION = '8.3';
export const DEFAULT_LOCALE = 'it_IT';
export const ADMIN_EMAIL = process.env.WPDEV_ADMIN_EMAIL ?? 'admin@example.com';

export function fpmBin(version: string): string {
  return `/usr/sbin/php-fpm${version}`;
}

export interface WpdevConfig {
  dbAdminUser: string;
  dbAdminPass: string;
}

export function loadConfig(): WpdevConfig {
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(`config mancante (${CONFIG_FILE}): esegui prima setup.sh`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

export function ensureStateDirs(): void {
  for (const d of [STATE_DIR, SITES_DIR, EXPORTS_DIR, CADDY_DIR, CADDY_SITES_DIR,
    PHP_DIR, RUN_DIR, LOGS_DIR, BLUEPRINTS_DIR, ADMINER_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }
}
