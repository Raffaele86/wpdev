// wpdev GUI — main process. Tutta la logica sta in wpdevd: qui solo finestra + integrazioni OS.
const { app, BrowserWindow, ipcMain, clipboard } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');

// WSLg: il sandbox chromium non è disponibile
app.commandLine.appendSwitch('no-sandbox');

function openInWindowsBrowser(url) {
  if (!/^https?:\/\//.test(url)) return;
  // rundll32 apre l'URL nel browser predefinito di Windows (siamo in WSL)
  spawn('/mnt/c/Windows/System32/rundll32.exe', ['url.dll,FileProtocolHandler', url], {
    detached: true, stdio: 'ignore',
  }).unref();
}

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
