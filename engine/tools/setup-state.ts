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

// Blueprint rn-engine: parent brandizzato (rebrand del solo header di style.css, i prefissi
// interni bottega_* restano) + template del child (generato per-slug alla creazione del sito).
const bottegaSrc = path.join(os.homedir(), 'bottega-theme');
const bpDir = path.join(BLUEPRINTS_DIR, 'rn-engine');
if (fs.existsSync(path.join(bottegaSrc, 'bottega'))) {
  const { execFileSync } = await import('node:child_process');
  const parentDst = path.join(bpDir, 'themes', 'rn-engine');
  fs.mkdirSync(path.join(bpDir, 'themes'), { recursive: true });
  execFileSync('rsync', ['-a', '--delete', '--exclude=node_modules',
    path.join(bottegaSrc, 'bottega') + '/', parentDst + '/']);
  // Rebrand SOLO l'header visibile del parent
  const styleFile = path.join(parentDst, 'style.css');
  let css = fs.readFileSync(styleFile, 'utf8');
  css = css
    .replace(/^Theme Name:.*$/m, 'Theme Name: RN Engine — raffaelenocera.com')
    .replace(/^Description:.*$/m, 'Description: Motore WordPress su misura di raffaelenocera.com: veloce, sicuro, zero CLS. Base per il tema del sito, costruito come child.');
  fs.writeFileSync(styleFile, css);

  // Template del child (da bottega-child-sample): applicato per-slug da applyBlueprint
  const childSrc = path.join(bottegaSrc, 'bottega-child-sample');
  if (fs.existsSync(childSrc)) {
    execFileSync('rsync', ['-a', '--delete', '--exclude=node_modules',
      childSrc + '/', path.join(bpDir, 'child-template') + '/']);
  }
  writeJsonAtomic(path.join(bpDir, 'manifest.json'), {
    name: 'rn-engine',
    description: 'RN Engine (parent brandizzato) + child generato con lo slug del sito',
    themes: ['rn-engine'],
    plugins: [],
    activate: null,
    seedSql: null,
    baseUrl: null,
    childFrom: fs.existsSync(childSrc) ? 'child-template' : null,
    childTemplate: 'rn-engine',
  });
  // Il vecchio blueprint bottega è sostituito
  fs.rmSync(path.join(BLUEPRINTS_DIR, 'bottega'), { recursive: true, force: true });
  console.log('blueprint "rn-engine" creato/aggiornato (bottega rimosso)');
} else {
  console.log('avviso: ~/bottega-theme/bottega non trovato — blueprint rn-engine saltato');
}
