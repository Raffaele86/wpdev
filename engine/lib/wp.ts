// Tutte le operazioni WordPress passano da wp-cli (`wp --path=<webroot>`).
import fs from 'node:fs';
import path from 'node:path';
import { WP_BIN, TEMPLATES_DIR, LOGS_DIR, DEFAULT_LOCALE, ADMIN_EMAIL } from './config.ts';
import { run, runOk, renderTemplate, randToken, type RunResult } from './util.ts';
import type { Site } from './registry.ts';

export async function wp(site: Site, args: string[], opts: { timeoutMs?: number } = {}): Promise<RunResult> {
  return runOk(WP_BIN, [`--path=${site.webroot}`, ...args], { timeoutMs: opts.timeoutMs ?? 300_000 });
}

export async function wpTry(site: Site, args: string[]): Promise<RunResult> {
  return run(WP_BIN, [`--path=${site.webroot}`, ...args], { timeoutMs: 300_000 });
}

export async function downloadCore(site: Site, locale: string = DEFAULT_LOCALE): Promise<void> {
  fs.mkdirSync(site.webroot, { recursive: true });
  await wp(site, ['core', 'download', `--locale=${locale}`, '--skip-content=false'], { timeoutMs: 600_000 });
}

export function writeWpConfig(site: Site): void {
  const vars: Record<string, string> = {
    dbName: site.db.name,
    dbUser: site.db.user,
    dbPass: site.db.pass,
    wpDebugLog: path.join(LOGS_DIR, site.slug, 'wp-debug.log'),
  };
  for (let i = 1; i <= 8; i++) vars[`salt${i}`] = randToken(64);
  const conf = renderTemplate(path.join(TEMPLATES_DIR, 'wp-config.php.tpl'), vars);
  fs.writeFileSync(path.join(site.webroot, 'wp-config.php'), conf, { mode: 0o640 });
}

export async function installWp(site: Site, title: string): Promise<void> {
  await wp(site, ['core', 'install',
    `--url=https://${site.domain}`,
    `--title=${title}`,
    `--admin_user=${site.adminUser}`,
    `--admin_password=${site.adminPass}`,
    `--admin_email=${ADMIN_EMAIL}`,
    '--skip-email',
  ]);
}

export async function isInstalled(site: Site): Promise<boolean> {
  const res = await wpTry(site, ['core', 'is-installed']);
  return res.code === 0;
}

// Magic login: package aaemnnosttv/wp-cli-login-command (installato da setup.sh)
// + companion plugin per sito. `wp login create` stampa l'URL one-time.
export async function ensureLoginPlugin(site: Site): Promise<void> {
  await wp(site, ['login', 'install', '--activate', '--yes']);
}

export async function magicLoginUrl(site: Site): Promise<string> {
  const res = await wp(site, ['login', 'create', site.adminUser, '--url-only']);
  const url = res.stdout.trim().split('\n').pop() ?? '';
  if (!url.startsWith('http')) throw new Error(`URL magic-login inatteso: ${res.stdout.trim()}`);
  return url;
}

export async function searchReplace(site: Site, from: string, to: string): Promise<void> {
  await wp(site, ['search-replace', from, to, '--all-tables', '--precise', '--quiet']);
}
