// Live Link: cloudflared quick tunnel (--url), processo figlio di wpdevd.
// NON tocca ~/.cloudflared/config.yml né i tunnel esistenti (dashboard-managed).
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CLOUDFLARED_BIN, LOGS_DIR, STATE_DIR } from './config.ts';
import { pidAlive } from './util.ts';

const children = new Map<string, ChildProcess>();

export async function startQuickTunnel(slug: string, localUrl: string): Promise<{ url: string; pid: number }> {
  const logDir = path.join(LOGS_DIR, slug);
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, 'cloudflared.log');
  // --config vuota OBBLIGATORIA: il legacy ~/.cloudflared/config.yml dirotta
  // l'ingress del quick tunnel (catch-all 404 su qualunque hostname trycloudflare).
  const emptyConfig = path.join(STATE_DIR, 'cloudflared-empty.yml');
  if (!fs.existsSync(emptyConfig)) fs.writeFileSync(emptyConfig, '');
  const child = spawn(CLOUDFLARED_BIN, ['tunnel', '--config', emptyConfig, '--url', localUrl, '--no-autoupdate'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.set(slug, child);
  const log = fs.createWriteStream(logFile, { flags: 'a' });
  child.stdout.pipe(log);

  // L'URL trycloudflare compare su stderr entro pochi secondi.
  return new Promise((resolve, reject) => {
    let buf = '';
    const deadline = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`cloudflared: URL non ottenuto entro 30s (log: ${logFile})`));
    }, 30_000);
    child.stderr.on('data', (d: Buffer) => {
      const text = d.toString();
      buf += text;
      log.write(text);
      const m = buf.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (m) {
        clearTimeout(deadline);
        resolve({ url: m[0], pid: child.pid! });
      }
    });
    child.on('exit', (code) => {
      clearTimeout(deadline);
      children.delete(slug);
      reject(new Error(`cloudflared terminato subito (code ${code}, log: ${logFile})`));
    });
  });
}

export function stopTunnel(slug: string, pid: number | null): void {
  const child = children.get(slug);
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
  } else if (pid !== null && pidAlive(pid)) {
    try { process.kill(pid, 'SIGTERM'); } catch { /* già morto */ }
  }
  children.delete(slug);
}
