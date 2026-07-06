// Blueprint = dir sotto ~/.wpdev/blueprints/<nome>/ con manifest.json:
//   themes/<dir>, plugins/<dir>, optional seed.sql (+ baseUrl per il search-replace).
import fs from 'node:fs';
import path from 'node:path';
import { BLUEPRINTS_DIR } from './config.ts';
import { runOk, writeJsonAtomic, readJson, type Emit } from './util.ts';
import { wp, searchReplace } from './wp.ts';
import { dumpDb } from './db.ts';
import type { Site } from './registry.ts';

export interface BlueprintManifest {
  name: string;
  description: string;
  themes: string[];
  plugins: string[];
  activate: string | null;
  seedSql: string | null;   // filename relativo alla dir del blueprint
  baseUrl: string | null;   // URL del sito d'origine (per search-replace del seed)
  childFrom?: string | null;     // dir template del child: genera themes/<slug>/ e lo attiva
  childTemplate?: string | null; // valore Template: del child (nome cartella parent)
}

function bpDir(name: string): string { return path.join(BLUEPRINTS_DIR, name); }

export function listBlueprints(): BlueprintManifest[] {
  if (!fs.existsSync(BLUEPRINTS_DIR)) return [];
  return fs.readdirSync(BLUEPRINTS_DIR)
    .filter((d) => fs.existsSync(path.join(bpDir(d), 'manifest.json')))
    .map((d) => readJson<BlueprintManifest>(path.join(bpDir(d), 'manifest.json'), null as unknown as BlueprintManifest));
}

export function getBlueprint(name: string): BlueprintManifest {
  const manifest = path.join(bpDir(name), 'manifest.json');
  if (!fs.existsSync(manifest)) {
    throw new Error(`blueprint non trovato: "${name}" (vedi: wpdev blueprint list)`);
  }
  return readJson<BlueprintManifest>(manifest, null as unknown as BlueprintManifest);
}

export async function applyBlueprint(site: Site, name: string, emit: Emit): Promise<void> {
  const bp = getBlueprint(name);
  const dir = bpDir(name);
  for (const theme of bp.themes) {
    emit(`blueprint: copio tema ${theme}`);
    await runOk('rsync', ['-a', '--exclude=node_modules',
      path.join(dir, 'themes', theme) + '/',
      path.join(site.webroot, 'wp-content', 'themes', theme) + '/']);
  }
  for (const plugin of bp.plugins) {
    emit(`blueprint: copio plugin ${plugin}`);
    await runOk('rsync', ['-a', '--exclude=node_modules',
      path.join(dir, 'plugins', plugin) + '/',
      path.join(site.webroot, 'wp-content', 'plugins', plugin) + '/']);
  }
  if (bp.seedSql) {
    emit('blueprint: importo seed database');
    const { importDb } = await import('./db.ts');
    await importDb(site.db, path.join(dir, bp.seedSql));
    if (bp.baseUrl) {
      emit(`blueprint: search-replace ${bp.baseUrl} → ${site.url}`);
      await searchReplace(site, bp.baseUrl, site.url);
    }
    // Il seed sovrascrive gli utenti: ripristina l'admin del sito.
    const { ADMIN_EMAIL } = await import('./config.ts');
    const { wpTry } = await import('./wp.ts');
    const create = await wpTry(site, ['user', 'create', site.adminUser, ADMIN_EMAIL,
      '--role=administrator', `--user_pass=${site.adminPass}`]);
    if (create.code !== 0) {
      await wp(site, ['user', 'update', site.adminUser, `--user_pass=${site.adminPass}`]);
    }
  }
  if (bp.childFrom) {
    // Child theme per-sito: cartella = slug, Theme Name = titolo del sito.
    const childDst = path.join(site.webroot, 'wp-content', 'themes', site.slug);
    emit(`blueprint: genero child theme "${site.slug}"`);
    await runOk('rsync', ['-a', '--exclude=node_modules',
      path.join(dir, bp.childFrom) + '/', childDst + '/']);
    const parent = bp.childTemplate ?? bp.themes[0];
    const header = [
      '/*',
      `Theme Name: ${site.name}`,
      `Template: ${parent}`,
      'Author: Raffaele Nocera',
      'Author URI: https://raffaelenocera.com/',
      `Description: Tema su misura per ${site.name}, costruito su RN Engine (raffaelenocera.com).`,
      'Version: 1.0.0',
      `Text Domain: ${site.slug}`,
      '*/',
    ].join('\n');
    const styleFile = path.join(childDst, 'style.css');
    const oldCss = fs.readFileSync(styleFile, 'utf8');
    const body = oldCss.includes('*/') ? oldCss.slice(oldCss.indexOf('*/') + 2) : oldCss;
    fs.writeFileSync(styleFile, header + '\n' + body);
    emit(`blueprint: attivo tema ${site.slug}`);
    await wp(site, ['theme', 'activate', site.slug]);
  } else if (bp.activate) {
    emit(`blueprint: attivo tema ${bp.activate}`);
    await wp(site, ['theme', 'activate', bp.activate]);
  }
}

// Salva un blueprint da un sito esistente: temi+plugin non-default + dump db.
export async function saveBlueprint(site: Site, name: string, emit: Emit): Promise<BlueprintManifest> {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(name)) throw new Error(`nome blueprint non valido: "${name}"`);
  const dir = bpDir(name);
  if (fs.existsSync(dir)) throw new Error(`blueprint "${name}" esiste già`);
  fs.mkdirSync(path.join(dir, 'themes'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'plugins'), { recursive: true });

  const themesRes = await wp(site, ['theme', 'list', '--field=name']);
  const themes = themesRes.stdout.trim().split('\n').filter(Boolean)
    .filter((t) => !/^twenty/.test(t));
  const pluginsRes = await wp(site, ['plugin', 'list', '--field=name']);
  const plugins = pluginsRes.stdout.trim().split('\n').filter(Boolean)
    .filter((p) => !['hello', 'akismet', 'wp-cli-login-server'].includes(p));

  for (const t of themes) {
    emit(`salvo tema ${t}`);
    await runOk('rsync', ['-a', '--exclude=node_modules',
      path.join(site.webroot, 'wp-content', 'themes', t) + '/',
      path.join(dir, 'themes', t) + '/']);
  }
  for (const p of plugins) {
    emit(`salvo plugin ${p}`);
    await runOk('rsync', ['-a', '--exclude=node_modules',
      path.join(site.webroot, 'wp-content', 'plugins', p) + '/',
      path.join(dir, 'plugins', p) + '/']);
  }
  emit('dump database seed');
  await dumpDb(site.db, path.join(dir, 'seed.sql'));

  const activeRes = await wp(site, ['theme', 'list', '--status=active', '--field=name']);
  const manifest: BlueprintManifest = {
    name,
    description: `salvato da "${site.slug}" il ${new Date().toISOString().slice(0, 10)}`,
    themes,
    plugins,
    activate: activeRes.stdout.trim().split('\n')[0] || null,
    seedSql: 'seed.sql',
    baseUrl: site.url,
  };
  writeJsonAtomic(path.join(dir, 'manifest.json'), manifest);
  return manifest;
}
