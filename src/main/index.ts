import { app, BrowserWindow } from 'electron'
import { join } from 'path'

// Modules CommonJS — import default : Rollup + @rollup/plugin-commonjs convertit
// module.exports en export default, ce qui permet le bundling correct.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import dbRaw  from '../db/index'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import ipcRaw from './ipc'

const db  = dbRaw  as unknown as { init:     () => void }
const ipc = ipcRaw as unknown as { register: () => void }

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'CESIA',
    icon: join(__dirname, '../../resources/icon.png'),
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
