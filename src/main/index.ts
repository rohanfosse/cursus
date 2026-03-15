import { app, BrowserWindow } from 'electron'
import { join } from 'path'

// Modules CommonJS — la couche DB et IPC restent en JS pour compatibilité better-sqlite3
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../db/index') as { init: () => void }
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ipc = require('./ipc') as { register: () => void }

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'CESI Cours',
    backgroundColor: '#111214',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#111214',
      symbolColor: '#9aa0a6',
      height: 32,
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // En développement, electron-vite fournit l'URL du serveur Vite (HMR)
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  db.init()
  ipc.register()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
