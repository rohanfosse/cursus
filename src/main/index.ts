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
  const msg = reason instanceof Error ? reason.message : String(reason)
  dialog.showErrorBox(
    'Erreur au démarrage',
    `${msg}\n\nSi le problème persiste, supprimez le dossier :\n%APPDATA%\\Cursus`
  )
})

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'Cursus',
    show: false, // affiché uniquement quand le renderer est prêt
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

  // Afficher la fenêtre seulement quand le renderer est chargé
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
  })

  // Fallback : forcer l'affichage si ready-to-show ne se déclenche pas dans les 5s
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show()
      win.focus()
    }
  }, 5000)

  // Diagnostic : échec de chargement du renderer
  win.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error(`[Main] did-fail-load  code=${code}  desc=${desc}  url=${url}`)
    dialog.showErrorBox(
      'Erreur de chargement',
      `Impossible de charger l'interface.\n\nCode : ${code}\nDétail : ${desc}\nURL : ${url}`
    )
  })

  // Diagnostic : crash du renderer
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Main] render-process-gone', details)
    dialog.showErrorBox(
      'Processus renderer terminé',
      `Raison : ${details.reason}\nCode de sortie : ${details.exitCode}`
    )
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
}).catch((err: Error) => {
  console.error('[Main] startup error:', err)
  dialog.showErrorBox(
    'Erreur au démarrage',
    `${err.message}\n\nSi le problème persiste, supprimez le dossier :\n%APPDATA%\\Cursus`
  )
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Fermeture propre de la base de données ────────────────────────────────────
app.on('before-quit', () => {
  db.close()
})
