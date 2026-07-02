// MariaDB via client `mariadb` (nessun driver node: zero dipendenze).
import { loadConfig } from './config.ts';
import { run, runOk } from './util.ts';
import type { SiteDb } from './registry.ts';

const MARIADB = '/usr/bin/mariadb';
const MARIADB_DUMP = '/usr/bin/mariadb-dump';

function adminArgs(): string[] {
  const cfg = loadConfig();
  return ['-u', cfg.dbAdminUser, `-p${cfg.dbAdminPass}`, '-h', 'localhost'];
}

async function sqlAdmin(sql: string): Promise<string> {
  const res = await runOk(MARIADB, [...adminArgs(), '-N', '-B'], { input: sql });
  return res.stdout;
}

export async function createSiteDb(db: SiteDb): Promise<void> {
  // I nomi derivano da uno slug già validato ([a-z0-9_]) — interpolazione sicura.
  await sqlAdmin(
    `CREATE DATABASE IF NOT EXISTS \`${db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\n` +
    `CREATE USER IF NOT EXISTS '${db.user}'@'localhost' IDENTIFIED BY '${db.pass}';\n` +
    `GRANT ALL PRIVILEGES ON \`${db.name.replace(/_/g, '\\_')}\`.* TO '${db.user}'@'localhost';`
  );
}

export async function dropSiteDb(db: SiteDb): Promise<void> {
  await sqlAdmin(
    `DROP DATABASE IF EXISTS \`${db.name}\`;\n` +
    `DROP USER IF EXISTS '${db.user}'@'localhost';`
  );
}

export async function dbExists(name: string): Promise<boolean> {
  const out = await sqlAdmin(`SHOW DATABASES LIKE '${name.replace(/_/g, '\\_')}';`);
  return out.trim().length > 0;
}

export async function dumpDb(db: SiteDb, outFile: string): Promise<void> {
  const { spawn } = await import('node:child_process');
  const fs = await import('node:fs');
  await new Promise<void>((resolve, reject) => {
    const outStream = fs.createWriteStream(outFile, { mode: 0o600 });
    const child = spawn(MARIADB_DUMP, ['-u', db.user, `-p${db.pass}`, '-h', 'localhost',
      '--single-transaction', '--default-character-set=utf8mb4', db.name]);
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d; });
    child.stdout.pipe(outStream);
    child.on('error', reject);
    child.on('close', (code) => {
      outStream.close();
      if (code === 0) resolve();
      else reject(new Error(`mariadb-dump fallito (${code}): ${stderr.trim().slice(-300)}`));
    });
  });
}

export async function importDb(db: SiteDb, sqlFile: string): Promise<void> {
  const fs = await import('node:fs');
  const sql = fs.readFileSync(sqlFile, 'utf8');
  await runOk(MARIADB, ['-u', db.user, `-p${db.pass}`, '-h', 'localhost',
    '--default-character-set=utf8mb4', db.name], { input: sql });
}

export async function checkAdminAccess(): Promise<boolean> {
  const cfg = loadConfig();
  const res = await run(MARIADB, ['-u', cfg.dbAdminUser, `-p${cfg.dbAdminPass}`, '-h', 'localhost', '-N', '-B'],
    { input: 'SELECT 1;' });
  return res.code === 0;
}
