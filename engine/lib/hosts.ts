// *.localhost NON risolve dentro WSL (i browser Windows sì): l'helper privilegiato
// /usr/local/sbin/wpdev-hosts (sudoers NOPASSWD) gestisce un blocco marcato in /etc/hosts.
import fs from 'node:fs';
import { HOSTS_HELPER } from './config.ts';
import { run } from './util.ts';

export function helperInstalled(): boolean {
  return fs.existsSync(HOSTS_HELPER);
}

async function helper(action: 'add' | 'remove', domain: string): Promise<void> {
  const res = await run('sudo', ['-n', HOSTS_HELPER, action, domain]);
  if (res.code !== 0) {
    throw new Error(
      `wpdev-hosts ${action} ${domain} fallito: ${(res.stderr || res.stdout).trim()}\n` +
      `(helper installato? sudoers configurato? vedi setup.sh)`
    );
  }
}

export async function addHost(domain: string): Promise<void> {
  if (!helperInstalled()) {
    throw new Error(`${HOSTS_HELPER} non installato: esegui setup.sh (dentro WSL *.localhost non risolve senza)`);
  }
  await helper('add', domain);
}

export async function removeHost(domain: string): Promise<void> {
  if (!helperInstalled()) return; // niente helper → niente entry da rimuovere
  await helper('remove', domain);
}

export function hostInEtcHosts(domain: string): boolean {
  try {
    return fs.readFileSync('/etc/hosts', 'utf8')
      .split('\n')
      .some((l) => l.trim().endsWith(` ${domain}`) && l.includes('127.0.0.1'));
  } catch { return false; }
}
