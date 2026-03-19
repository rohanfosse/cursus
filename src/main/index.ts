import { app, BrowserWindow, dialog } from 'electron'
import { join } from 'path'

// Modules CommonJS — import default : Rollup + @rollup/plugin-commonjs convertit
// module.exports en export default, ce qui permet le bundling correct.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import dbRaw            from '../db/index'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import ipcRaw           from './ipc'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import notificationsRaw from './notifications'

const db            = dbRaw            as unknown as { init: () => void; close: () => void }
const ipc           = ipcRaw           as unknown as { register: () => void }
const notifications = notificationsRaw as unknown as { start: () => void }

// ── Gestionnaires d'erreurs globaux ──────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[Main] uncaughtException:', err)
  dialog.showErrorBox('Erreur inattendue', `${err.message}\n\nL'application va continuer, mais redémarrez si le problème persiste.`)
})

process.on('unhandledRejection', (reason) => {
  console.error('[Main] unhandledRejection:', reason)
})

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
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  })

  // Push événements maximize/unmaximize vers le renderer
  win.on('maximize',   () => win.webContents.send('window:maximizeState', true))
  win.on('unmaximize', () => win.webContents.send('window:maximizeState', false))

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
  notifications.start()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Fermeture propre de la base de données ────────────────────────────────────
app.on('before-quit', () => {
  db.close()
})
