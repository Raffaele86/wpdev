const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wpdev', {
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  copy: (text) => ipcRenderer.invoke('copy', text),
  win: (action) => ipcRenderer.invoke('win', action),
});
