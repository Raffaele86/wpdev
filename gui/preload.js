const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wpdev', {
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  claude: (slug, webroot) => ipcRenderer.invoke('claude', slug, webroot),
  copy: (text) => ipcRenderer.invoke('copy', text),
  win: (action) => ipcRenderer.invoke('win', action),
});
