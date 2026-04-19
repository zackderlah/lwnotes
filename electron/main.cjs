const { app, BrowserWindow, Menu, shell, ipcMain, dialog } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')
const { startDistServer } = require('./serve-dist.cjs')
const { OAUTH_LOCAL_PORT } = require('./oauth-port.cjs')

const isDev = !app.isPackaged

/** Packaged app loads UI from this URL so Google OAuth has a valid http origin (not file://). */
let packagedAppUrl = null
let staticServerClose = null

const FRAME_COLOR = '#D8E6F3'
const SYMBOL_COLOR = '#111111'

let mainWindow = null

function getTitleBarOptions() {
  if (process.platform === 'darwin') {
    return { titleBarStyle: 'hiddenInset' }
  }
  return {
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: FRAME_COLOR,
      symbolColor: SYMBOL_COLOR,
      height: 32,
    },
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 820,
    minHeight: 520,
    backgroundColor: FRAME_COLOR,
    title: 'Note App',
    show: false,
    autoHideMenuBar: true,
    ...getTitleBarOptions(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // Google Identity Services opens OAuth in window.open() — must stay in-app so GIS can
  // postMessage back. Sending every popup to the default browser breaks sign-in (stuck loading).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const u = String(url || '')
    if (
      u === 'about:blank' ||
      u.startsWith('https://accounts.google.com') ||
      u.startsWith('https://oauth2.googleapis.com') ||
      u.startsWith('https://accounts.youtube.com')
    ) {
      return { action: 'allow' }
    }
    shell.openExternal(u)
    return { action: 'deny' }
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5181'

  mainWindow.webContents.on('did-fail-load', (event, code, desc, url, isMainFrame) => {
    if (!isMainFrame || !isDev) return
    if (!String(url || '').startsWith('http://localhost')) return
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Note App</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#D8E6F3;color:#111;padding:28px;line-height:1.5">
<h1 style="font-size:18px;margin:0 0 12px">Dev server not reachable</h1>
<p>The app loads from <strong>${devUrl}</strong> in development, but that address failed (${code}: ${desc || 'error'}).</p>
<p><strong>Fix:</strong> in the project folder run:</p>
<pre style="background:rgba(0,0,0,.06);padding:12px;border-radius:8px;overflow:auto">npm run dev</pre>
<p>Or start Vite and Electron together:</p>
<pre style="background:rgba(0,0,0,.06);padding:12px;border-radius:8px;overflow:auto">npm run dev:electron</pre>
</body></html>`
    mainWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    )
  })

  if (isDev) {
    mainWindow.loadURL(devUrl)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadURL(packagedAppUrl || `http://127.0.0.1:${OAUTH_LOCAL_PORT}/`)
  }
}

ipcMain.handle('cloud-backup:write', async (_event, jsonString) => {
  if (typeof jsonString !== 'string') return { ok: false }
  const dir = path.join(app.getPath('userData'), 'library-backups')
  await fs.mkdir(dir, { recursive: true })
  const file = path.join(dir, 'latest.json')
  await fs.writeFile(file, jsonString, 'utf8')
  return { ok: true, file }
})

ipcMain.handle('app:oauth-origin', () => {
  if (isDev) return ''
  return `http://127.0.0.1:${OAUTH_LOCAL_PORT}`
})

ipcMain.handle('titlebar:set-overlay', (_event, overlay) => {
  if (!mainWindow || !overlay || typeof overlay.color !== 'string') return
  const symbolColor =
    typeof overlay.symbolColor === 'string' ? overlay.symbolColor : '#111111'
  const height = Number.isFinite(overlay.height) ? overlay.height : 32
  try {
    if (typeof mainWindow.setTitleBarOverlay === 'function') {
      mainWindow.setTitleBarOverlay({
        color: overlay.color,
        symbolColor,
        height,
      })
    }
    if (typeof mainWindow.setBackgroundColor === 'function') {
      mainWindow.setBackgroundColor(overlay.color)
    }
  } catch {
    /* older Electron / platform */
  }
})

app.whenReady().then(async () => {
  if (!isDev) {
    const distRoot = path.join(__dirname, '..', 'dist')
    try {
      const { url, close } = await startDistServer({
        distRoot,
        port: OAUTH_LOCAL_PORT,
        host: '127.0.0.1',
      })
      packagedAppUrl = url
      staticServerClose = close
    } catch (e) {
      const msg = e && e.message ? e.message : String(e)
      dialog.showErrorBox(
        'Note App',
        `Could not start the local server on port ${OAUTH_LOCAL_PORT} (needed for Google sign-in). ${msg}`,
      )
      app.quit()
      return
    }
    Menu.setApplicationMenu(null)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => {
  if (staticServerClose) {
    void staticServerClose()
    staticServerClose = null
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
