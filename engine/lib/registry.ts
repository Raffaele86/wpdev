// Registry siti (~/.wpdev/sites.json) — ispirato al sites.json di Local.
import fs from 'node:fs';
import net from 'node:net';
import { REGISTRY_FILE } from './config.ts';
import { readJson, writeJsonAtomic } from './util.ts';

export interface SiteDb { name: string; user: string; pass: string; }

export interface SiteShare { port: number; url: string | null; authUser: string; authPass: string; pid: number | null; }

export interface Site {
  id: string;
  name: string;
  slug: string;
  domain: string;
  url: string;       // https://<slug>.localhost[:porta]
  path: string;      // ~/wpdev-sites/<slug>
  webroot: string;   // <path>/app/public
  phpVersion: string;
  db: SiteDb;
  socket: string;
  adminUser: string;
  adminPass: string;
  status: 'running' | 'stopped';
  blueprint: string | null;
  share: SiteShare | null;
  xdebug: boolean;
  createdAt: string;
}

interface Registry { sites: Site[]; }

export function loadRegistry(): Registry {
  return readJson<Registry>(REGISTRY_FILE, { sites: [] });
}

export function saveRegistry(reg: Registry): void {
  writeJsonAtomic(REGISTRY_FILE, reg);
}

export function getSite(slug: string): Site {
  const site = loadRegistry().sites.find((s) => s.slug === slug);
  if (!site) throw new Error(`sito non trovato: "${slug}" (vedi: wpdev list)`);
  return site;
}

export function siteExists(slug: string): boolean {
  return loadRegistry().sites.some((s) => s.slug === slug);
}

export function upsertSite(site: Site): void {
  const reg = loadRegistry();
  const i = reg.sites.findIndex((s) => s.slug === site.slug);
  if (i >= 0) reg.sites[i] = site; else reg.sites.push(site);
  saveRegistry(reg);
}

export function removeSite(slug: string): void {
  const reg = loadRegistry();
  reg.sites = reg.sites.filter((s) => s.slug !== slug);
  saveRegistry(reg);
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

// Il registry non conosce i vhost scritti a mano: chi chiama passa in `reserved` le porte
// già dichiarate nei frammenti caddy, e come rete di sicurezza si prova anche il bind.
export async function nextSharePort(base: number, reserved: Set<number> = new Set()): Promise<number> {
  const used = new Set(loadRegistry().sites.map((s) => s.share?.port).filter(Boolean) as number[]);
  for (let port = base; port < base + 200; port++) {
    if (used.has(port) || reserved.has(port)) continue;
    if (await portFree(port)) return port;
  }
  throw new Error(`nessuna porta libera per il Live Link nel range ${base}-${base + 199}`);
}
