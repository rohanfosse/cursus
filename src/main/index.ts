import { app, BrowserWindow, dialog, ipcMain, nativeImage, Tray, Menu } from 'electron'
import { join } from 'path'
import { autoUpdater } from 'electron-updater'

// Modules CommonJS - import default : Rollup + @rollup/plugin-commonjs convertit
// module.exports en export default, ce qui permet le bundling correct.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import dbRaw            from '../../server/db/index'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import ipcRaw           from './ipc'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import notificationsRaw from './notifications'

const db            = dbRaw            as unknown as { init: () => void; close: () => void }
const ipc           = ipcRaw           as unknown as { register: () => void }
const notifications = notificationsRaw as unknown as { start: () => void; stop: () => void }

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

let mainWin: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

// ── Single instance : si une instance est déjà ouverte, la focus ────────────
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore()
      mainWin.show()
      mainWin.focus()
    }
  })
}

function createWindow(splash: BrowserWindow | null): void {
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
    titleBarOverlay: {
      color: '#111214',
      symbolColor: '#8B8D91',
      height: 36,
    },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      plugins: true, // Active le viewer PDF Chromium intégré
      devTools: !app.isPackaged,
    },
  })

  // Afficher la fenêtre seulement quand le renderer est chargé
  win.once('ready-to-show', () => {
    if (splash && !splash.isDestroyed()) splash.destroy()
    win.show()
    win.focus()
  })

  // Fallback : forcer l'affichage si ready-to-show ne se déclenche pas dans les 5s
  setTimeout(() => {
    if (splash && !splash.isDestroyed()) splash.destroy()
    if (!win.isDestroyed() && !win.isVisible()) {
      win.show()
      win.focus()
    }
  }, 5000)

  // Minimiser au tray au lieu de quitter
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })

  // Diagnostic : échec de chargement du renderer
  win.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error(`[Main] did-fail-load  code=${code}  desc=${desc}  url=${url}`)
    dialog.showErrorBox(
      'Erreur de chargement',
      `Impossible de charger l'interface.\n\nCode : ${code}\nDétail : ${desc}\nURL : ${url}`
    )
  })

  // Diagnostic : crash du renderer - proposer de relancer
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Main] render-process-gone', details)
    dialog.showMessageBox(win, {
      type: 'error',
      title: 'Processus renderer terminé',
      message: `L'interface a cessé de fonctionner.\nRaison : ${details.reason}`,
      buttons: ['Relancer', 'Quitter'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) {
        win.reload()
      } else {
        app.quit()
      }
    })
  })

  // Push événements maximize/unmaximize vers le renderer
  win.on('maximize',   () => win.webContents.send('window:maximizeState', true))
  win.on('unmaximize', () => win.webContents.send('window:maximizeState', false))

  // Badge notification sur l'icone de la barre des taches (Windows)
  const badgePath = join(__dirname, '../../resources/badge-notif.png')
  const badgeIcon = nativeImage.createFromPath(badgePath)

  ipcMain.on('badge:set', () => {
    if (!win.isDestroyed()) {
      win.setOverlayIcon(badgeIcon, 'Nouvelles notifications')
      win.flashFrame(true)
    }
  })
  ipcMain.on('badge:clear', () => {
    if (!win.isDestroyed()) {
      win.setOverlayIcon(null, '')
    }
  })

  // En développement, electron-vite fournit l'URL du serveur Vite (HMR)
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWin = win
}

app.whenReady().then(() => {
  try {
    db.init()
  } catch (dbErr: unknown) {
    const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
    console.error('[Main] DB init failed:', dbErr)
    dialog.showErrorBox(
      'Erreur de base de données',
      `Impossible d\'initialiser la base de données.\n\n${msg}\n\nSi le problème persiste, supprimez le fichier de données dans %APPDATA%\\Cursus.`,
    )
    app.quit()
    return
  }
  ipc.register()
  notifications.start()

  // ── Splash screen ──────────────────────────────────────────────────────────
  const splash = new BrowserWindow({
    width: 360,
    height: 360,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    show: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })
  splash.loadFile(join(__dirname, '../../resources/splash.html'))

  createWindow(splash)

  // ── System tray ────────────────────────────────────────────────────────────
  const trayIconPath = join(__dirname, '../../resources/icon.ico')
  tray = new Tray(nativeImage.createFromPath(trayIconPath))
  tray.setToolTip('Cursus')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Afficher Cursus', click: () => { mainWin?.show(); mainWin?.focus() } },
    { type: 'separator' },
    { label: 'Quitter', click: () => { isQuitting = true; app.quit() } },
  ]))
  tray.on('double-click', () => { mainWin?.show(); mainWin?.focus() })

  // ── Auto-update (production uniquement) ──────────────────────────────────
  if (app.isPackaged) {
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', (info) => {
      console.log('[Updater] Mise à jour disponible:', info.version)
      const win = BrowserWindow.getAllWindows()[0]
      if (win) win.webContents.send('updater:available', info.version)
    })

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[Updater] Mise à jour téléchargée:', info.version)
      const win = BrowserWindow.getAllWindows()[0]
      if (win) win.webContents.send('updater:downloaded', info.version)
    })

    ipcMain.on('updater:quitAndInstall', () => {
      autoUpdater.quitAndInstall()
    })

    autoUpdater.on('error', (err) => {
      console.error('[Updater] Erreur:', err.message)
    })

    autoUpdater.checkForUpdatesAndNotify()
  }

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
  // Le tray garde l'app en vie, ne pas quitter
})

// ── Fermeture propre ──────────────────────────────────────────────────────────
app.on('before-quit', () => {
  isQuitting = true
  notifications.stop()
  db.close()
})
