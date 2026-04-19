const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('noteApp', {
  setTitleBarOverlay(overlay) {
    return ipcRenderer.invoke('titlebar:set-overlay', overlay)
  },
  writeCloudBackup(jsonString) {
    return ipcRenderer.invoke('cloud-backup:write', jsonString)
  },
  /** Packaged app OAuth origin (http://127.0.0.1:port); empty string in dev / browser. */
  getOauthOriginHint() {
    return ipcRenderer.invoke('app:oauth-origin')
  },
})
