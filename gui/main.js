// wpdev GUI — main process. Tutta la logica sta in wpdevd: qui solo finestra + integrazioni OS.
const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const { spawn, execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

// WSLg: il sandbox chromium non è disponibile
app.commandLine.appendSwitch('no-sandbox');

function openInWindowsBrowser(url) {
  if (!/^https?:\/\//.test(url)) return;
  // rundll32 apre l'URL nel browser predefinito di Windows (siamo in WSL)
  spawn('/mnt/c/Windows/System32/rundll32.exe', ['url.dll,FileProtocolHandler', url], {
    detached: true, stdio: 'ignore',
  }).unref();
}

// Claude Code sul tema attivo: wt.exe (interop) apre una finestra Windows
// Terminal col claude di WSL già nella cartella del tema. Path assoluti:
// wpdev non è nel PATH non-interattivo, wt.exe è un alias per-utente.
const WPDEV_CLI = path.join(process.env.HOME ?? '/home/raffa', '.local/bin/wpdev');
const WT_EXE = '/mnt/c/Users/Raffaele/AppData/Local/Microsoft/WindowsApps/wt.exe';

function activeThemeDir(slug, webroot) {
  return new Promise((resolve) => {
    execFile(WPDEV_CLI, ['cli', slug, '--', 'option', 'get', 'stylesheet'],
      { timeout: 15000 }, (err, stdout) => {
        const themes = path.join(webroot, 'wp-content', 'themes');
        // sito spento o wp-cli in errore: si apre comunque sulla cartella themes
        const name = err ? '' : String(stdout).trim().split('\n').pop();
        const dir = name ? path.join(themes, name) : themes;
        resolve(fs.existsSync(dir) ? dir : themes);
      });
  });
}

ipcMain.handle('claude', async (_e, slug, webroot) => {
  if (!/^[a-z0-9-]+$/.test(String(slug)) || !path.isAbsolute(String(webroot))) {
    return { error: 'parametri non validi' };
  }
  const dir = await activeThemeDir(slug, webroot);
  spawn(WT_EXE,
    ['wsl.exe', '-d', 'Ubuntu', '-u', 'raffa', '--cd', dir, '--',
      'bash', '-lc', 'exec claude --dangerously-skip-permissions'],
    { detached: true, stdio: 'ignore' }).unref();
  return { ok: true, dir };
});

ipcMain.handle('open-url', (_e, url) => openInWindowsBrowser(url));
ipcMain.handle('copy', (_e, text) => clipboard.writeText(String(text)));
ipcMain.handle('win', (e, action) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return;
  if (action === 'min') win.minimize();
  else if (action === 'max') win.isMaximized() ? win.unmaximize() : win.maximize();
  else if (action === 'close') win.close();
});

app.whenReady().then(() => {
  // Hook di test: WPDEV_SIZE=<larghezza>x<altezza> apre la finestra a misura data
  // (serve a verificare la composizione stretta con gli screenshot headless).
  const size = /^(\d+)x(\d+)$/.exec(process.env.WPDEV_SIZE ?? '');
  const win = new BrowserWindow({
    width: size ? Number(size[1]) : 1240,
    height: size ? Number(size[2]) : 820,
    minWidth: 900,
    minHeight: 600,
    title: 'wpdev',
    // dipinto da Electron prima che la pagina renderizzi: deve essere il fondo
    // del tema (graphite-950), altrimenti a ogni apertura lampeggia il vecchio mondo
    backgroundColor: '#0e1013',
    frame: false,               // niente chrome X11: title bar custom in-app
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  // Hook di test headless: WPDEV_SELECT=<slug> pre-seleziona un sito,
  // WPDEV_OPEN=new apre il dialog "nuovo sito".
  const query = {};
  if (process.env.WPDEV_SELECT) query.select = process.env.WPDEV_SELECT;
  if (process.env.WPDEV_OPEN) query.open = process.env.WPDEV_OPEN;
  if (process.env.WPDEV_Q) query.q = process.env.WPDEV_Q;
  win.loadFile('index.html', Object.keys(query).length ? { query } : undefined);

  // Verifica headless: WPDEV_SHOT=<file.png> cattura la finestra dopo 4s ed esce.
  const shot = process.env.WPDEV_SHOT;
  if (shot) {
    const delay = Number(process.env.WPDEV_SHOT_DELAY) || 4000;
    setTimeout(async () => {
      const img = await win.webContents.capturePage();
      require('node:fs').writeFileSync(shot, img.toPNG());
      app.quit();
    }, delay);
  }
});

app.on('window-all-closed', () => app.quit());
