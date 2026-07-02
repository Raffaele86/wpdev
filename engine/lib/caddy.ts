// Istanza Caddy dedicata wpdev (admin :2020) — NON toccare il Caddy di ComfyUI
// (~/.config/caddy/Caddyfile, :8189). Vhost per sito = frammento in caddy/sites/.
import fs from 'node:fs';
import path from 'node:path';
import { CADDY_BIN, CADDY_DIR, CADDY_SITES_DIR, CADDYFILE, CADDY_ADMIN, TEMPLATES_DIR, LOGS_DIR } from './config.ts';
import { renderTemplate, runOk } from './util.ts';
import type { Site } from './registry.ts';

export function ensureMainCaddyfile(): void {
  fs.mkdirSync(CADDY_SITES_DIR, { recursive: true });
  const content = renderTemplate(path.join(TEMPLATES_DIR, 'Caddyfile.main.tpl'), {
    caddyAdmin: CADDY_ADMIN,
    caddyStorage: path.join(CADDY_DIR, 'storage'),
  });
  if (!fs.existsSync(CADDYFILE) || fs.readFileSync(CADDYFILE, 'utf8') !== content) {
    fs.writeFileSync(CADDYFILE, content);
  }
}

function siteFragment(slug: string): string { return path.join(CADDY_SITES_DIR, `${slug}.caddy`); }
function shareFragment(slug: string): string { return path.join(CADDY_SITES_DIR, `${slug}-share.caddy`); }

export function writeSiteVhost(site: Site): void {
  const frag = renderTemplate(path.join(TEMPLATES_DIR, 'site.caddy.tpl'), {
    slug: site.slug,
    domain: site.domain,
    webroot: site.webroot,
    socket: site.socket,
    accessLog: path.join(LOGS_DIR, site.slug, 'caddy-access.log'),
  });
  fs.writeFileSync(siteFragment(site.slug), frag);
}

export function removeSiteVhost(slug: string): boolean {
  let removed = false;
  for (const f of [siteFragment(slug), shareFragment(slug)]) {
    if (fs.existsSync(f)) { fs.unlinkSync(f); removed = true; }
  }
  return removed;
}

export async function writeShareVhost(site: Site, authHash: string): Promise<void> {
  if (!site.share) throw new Error('share non configurato sul sito');
  const frag = renderTemplate(path.join(TEMPLATES_DIR, 'share.caddy.tpl'), {
    slug: site.slug,
    sharePort: String(site.share.port),
    authUser: site.share.authUser,
    authHash,
    webroot: site.webroot,
    socket: site.socket,
  });
  fs.writeFileSync(shareFragment(site.slug), frag);
}

export function removeShareVhost(slug: string): boolean {
  const f = shareFragment(slug);
  if (fs.existsSync(f)) { fs.unlinkSync(f); return true; }
  return false;
}

export async function hashBasicAuth(password: string): Promise<string> {
  const res = await runOk(CADDY_BIN, ['hash-password', '--plaintext', password]);
  return res.stdout.trim();
}

export async function reloadCaddy(): Promise<void> {
  ensureMainCaddyfile();
  // `caddy reload` resta appeso se l'admin endpoint è giù: meglio fallire subito e chiaro.
  if (!(await caddyRunning())) {
    throw new Error('Caddy wpdev non attivo (admin :2020): systemctl --user start wpdev-caddy');
  }
  await runOk(CADDY_BIN, ['reload', '--config', CADDYFILE, '--adapter', 'caddyfile'], {
    cwd: CADDY_DIR,
    timeoutMs: 30_000,
  });
}

export async function caddyRunning(): Promise<boolean> {
  try {
    const res = await fetch(`http://${CADDY_ADMIN}/config/`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

export function rootCaPath(): string {
  return path.join(CADDY_DIR, 'storage', 'pki', 'authorities', 'local', 'root.crt');
}
