#!/usr/bin/env -S node --no-warnings
// Inizializza/aggiorna lo stato ~/.wpdev (idempotente). Chiamato da setup.sh.
// - directory di stato, Caddyfile principale, vhost+pool Adminer, blueprint bottega
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  ensureStateDirs, ADMINER_DIR, RUN_DIR, CADDY_SITES_DIR, TEMPLATES_DIR, BLUEPRINTS_DIR, HTTPS_PORT,
} from '../lib/config.ts';
import { ensureMainCaddyfile } from '../lib/caddy.ts';
import { renderTemplate, writeJsonAtomic } from '../lib/util.ts';

ensureStateDirs();
ensureMainCaddyfile();
console.log('stato ~/.wpdev inizializzato');

// Vhost Adminer (il pool fpm lo avvia wpdevd alla partenza, se adminer.php esiste)
const adminerFrag = renderTemplate(path.join(TEMPLATES_DIR, 'adminer.caddy.tpl'), {
  adminerDir: ADMINER_DIR,
  adminerSocket: path.join(RUN_DIR, 'adminer.sock'),
  httpsPort: String(HTTPS_PORT),
});
fs.writeFileSync(path.join(CADDY_SITES_DIR, 'adminer.caddy'), adminerFrag);
console.log('vhost adminer.localhost scritto');

// adminer.localhost in /etc/hosts (se l'helper privilegiato è già installato)
const { addHost, helperInstalled, hostInEtcHosts } = await import('../lib/hosts.ts');
if (helperInstalled() && !hostInEtcHosts('adminer.localhost')) {
  try { await addHost('adminer.localhost'); console.log('adminer.localhost registrato in /etc/hosts'); }
  catch (err) { console.log(`avviso: hosts adminer non registrato — ${(err as Error).message}`); }
}

// Blueprint bottega dal tema in ~/bottega-theme (parent + child sample, senza node_modules)
const bottegaSrc = path.join(os.homedir(), 'bottega-theme');
const bpDir = path.join(BLUEPRINTS_DIR, 'bottega');
if (fs.existsSync(path.join(bottegaSrc, 'bottega'))) {
  const { execFileSync } = await import('node:child_process');
  fs.mkdirSync(path.join(bpDir, 'themes'), { recursive: true });
  for (const theme of ['bottega', 'bottega-child-sample']) {
    const src = path.join(bottegaSrc, theme);
    if (!fs.existsSync(src)) continue;
    execFileSync('rsync', ['-a', '--delete', '--exclude=node_modules',
      src + '/', path.join(bpDir, 'themes', theme) + '/']);
  }
  writeJsonAtomic(path.join(bpDir, 'manifest.json'), {
    name: 'bottega',
    description: 'starter WP con tema Bottega (parent) + child sample, da ~/bottega-theme',
    themes: ['bottega', 'bottega-child-sample'].filter((t) => fs.existsSync(path.join(bpDir, 'themes', t))),
    plugins: [],
    activate: 'bottega',
    seedSql: null,
    baseUrl: null,
  });
  console.log('blueprint "bottega" creato/aggiornato');
} else {
  console.log('avviso: ~/bottega-theme/bottega non trovato — blueprint bottega saltato');
}
