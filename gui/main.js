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

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: 'wpdev',
    backgroundColor: '#16161d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  // WPDEV_SELECT=<slug> pre-seleziona un sito (usato dalle verifiche automatiche)
  win.loadFile('index.html', process.env.WPDEV_SELECT
    ? { query: { select: process.env.WPDEV_SELECT } } : undefined);

  // Verifica headless: WPDEV_SHOT=<file.png> cattura la finestra dopo 4s ed esce.
  const shot = process.env.WPDEV_SHOT;
  if (shot) {
    setTimeout(async () => {
      const img = await win.webContents.capturePage();
      require('node:fs').writeFileSync(shot, img.toPNG());
      app.quit();
    }, 4000);
  }
});

app.on('window-all-closed', () => app.quit());
