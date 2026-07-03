import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface RunResult { code: number; stdout: string; stderr: string; }

export interface RunOpts {
  cwd?: string;
  env?: Record<string, string>;
  input?: string;
  timeoutMs?: number;
}

// Esegue un comando (niente shell: argomenti espliciti, niente injection).
export function run(cmd: string, args: string[], opts: RunOpts = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...(opts.env ?? {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (opts.timeoutMs) {
      timer = setTimeout(() => { child.kill('SIGKILL'); }, opts.timeoutMs);
    }
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => { if (timer) clearTimeout(timer); reject(err); });
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
    // Se il figlio muore mentre gli scriviamo input grossi (es. dump sql),
    // lo stdin dà EPIPE: senza handler abbatterebbe l'intero processo.
    child.stdin.on('error', () => { /* il close riporterà l'exit code vero */ });
    try {
      if (opts.input !== undefined) child.stdin.write(opts.input);
      child.stdin.end();
    } catch { /* figlio già morto: gestito da close */ }
  });
}

// Come run(), ma fallisce con errore descrittivo se exit code != 0.
export async function runOk(cmd: string, args: string[], opts: RunOpts = {}): Promise<RunResult> {
  const res = await run(cmd, args, opts);
  if (res.code !== 0) {
    const detail = (res.stderr || res.stdout).trim().split('\n').slice(-8).join('\n');
    throw new Error(`comando fallito (${res.code}): ${cmd} ${args.join(' ')}\n${detail}`);
  }
  return res;
}

export function randToken(len: number = 24): string {
  return crypto.randomBytes(len).toString('base64url').slice(0, len);
}

export function randHex(len: number = 12): string {
  return crypto.randomBytes(len).toString('hex').slice(0, len);
}

export function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = `${file}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,23}$/;

export function validateSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new Error(`slug non valido: "${slug}" (ammessi [a-z0-9-], max 24 caratteri, inizia con lettera/cifra)`);
  }
}

// Nome db/utente MariaDB: i trattini diventano underscore.
export function dbIdent(slug: string): string {
  return `wp_${slug.replace(/-/g, '_')}`;
}

export function renderTemplate(tplPath: string, vars: Record<string, string>): string {
  let text = fs.readFileSync(tplPath, 'utf8');
  for (const [k, v] of Object.entries(vars)) {
    text = text.split(`{{${k}}}`).join(v);
  }
  const leftover = text.match(/\{\{[a-zA-Z0-9_]+\}\}/);
  if (leftover) throw new Error(`template ${path.basename(tplPath)}: variabile non risolta ${leftover[0]}`);
  return text;
}

export function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export function readPidFile(file: string): number | null {
  try {
    const pid = parseInt(fs.readFileSync(file, 'utf8').trim(), 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch { return null; }
}

export type Emit = (msg: string) => void;
