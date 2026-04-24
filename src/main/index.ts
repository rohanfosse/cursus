import { app, BrowserWindow, dialog, ipcMain, nativeImage, session, shell, Tray, Menu } from 'electron'
import { join } from 'path'
import { initUpdater, stopUpdater, getPendingUpdate, quitAndInstall } from './updater'

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

// ── Logging persistant (rotation quotidienne dans %APPDATA%/Cursus/logs) ───
// electron-log auto-capte console.log/warn/error + uncaughtException.
// Path: %APPDATA%/Cursus/logs/main.log (macOS: ~/Library/Logs/Cursus).
import log from 'electron-log/main'
log.initialize()
log.transports.file.maxSize = 5 * 1024 * 1024 // 5 MB avant rotation
log.transports.file.level = 'info'
log.transports.console.level = app.isPackaged ? 'warn' : 'debug'
// Redirige console.* du main process vers electron-log (fichier + console dev)
Object.assign(console, log.functions)

// Flag : fenêtre principale pas encore créée → on affiche un dialog bloquant.
// Après, les erreurs async routinières (fetch, IPC) ne doivent pas interrompre
// l'utilisateur — juste logger et rapporter au renderer s'il est là.
let startupComplete = false

// ── Gestionnaires d'erreurs globaux ──────────────────────────────────────────
process.on('uncaughtException', (err) => {
  log.error('[Main] uncaughtException:', err)
  if (!startupComplete) {
    dialog.showErrorBox('Erreur inattendue', `${err.message}\n\nL'application va continuer, mais redémarrez si le problème persiste.`)
  } else {
    // En runtime : on log + on notifie le renderer (qui affichera un toast).
    // Pas de modal bloquant sur chaque promesse qui casse.
    mainWin?.webContents.send('main:runtime-error', { message: err.message })
  }
})

process.on('unhandledRejection', (reason) => {
  log.error('[Main] unhandledRejection:', reason)
  if (!startupComplete) {
    const msg = reason instanceof Error ? reason.message : String(reason)
    dialog.showErrorBox(
      'Erreur au démarrage',
      `${msg}\n\nSi le problème persiste, supprimez le dossier :\n%APPDATA%\\Cursus`,
    )
  }
  // Apres startup : silencieux (log only) — un fetch en echec ou un unfurl
  // qui crashe ne doit pas interrompre l'utilisateur.
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
      // Caches V8 le bytecode compile → startup plus rapide apres 1re run.
      v8CacheOptions: 'bypassHeatCheck',
      // Spellcheck FR active : etudiants qui redigent consignes, rapports,
      // messages longs. ~30 MB RAM, negligeable sur machines modernes.
      // Les editeurs specifiques (code, tables, math, TypeRace) posent leur
      // propre spellcheck="false" au niveau de l'element.
      spellcheck: true,
      // Desactive le background throttling : sinon Chromium ralentit les
      // timers (setInterval, refresh JWT 6h) et throttle les sockets quand
      // la fenetre est cachee/minimisee → session qui expire la nuit.
      backgroundThrottling: false,
    },
    autoHideMenuBar: true,
  })

  // Afficher la fenêtre seulement quand le renderer est chargé
  win.once('ready-to-show', () => {
    if (splash && !splash.isDestroyed()) splash.destroy()
    win.show()
    win.focus()
    // A partir d'ici, les erreurs async routinieres ne doivent plus afficher
    // de dialog bloquant — juste logger et notifier le renderer.
    startupComplete = true
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
    log.error(`[Main] did-fail-load  code=${code}  desc=${desc}  url=${url}`)
    // Code -3 = request aborted (navigation vers une autre URL, HMR, ...) : bruit dev.
    if (code === -3) return
    dialog.showErrorBox(
      'Erreur de chargement',
      `Impossible de charger l'interface.\n\nCode : ${code}\nDétail : ${desc}\nURL : ${url}`,
    )
  })

  // Diagnostic : crash du renderer - proposer de relancer
  win.webContents.on('render-process-gone', (_event, details) => {
    log.error('[Main] render-process-gone', details)
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

  // Ouvre le dossier des logs dans l'explorateur — utile support pilote.
  ipcMain.handle('logs:open-folder', () => {
    try {
      shell.showItemInFolder(log.transports.file.getFile().path)
      return { ok: true, data: null }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, error: msg }
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
  // Dictionnaire de correction orthographique FR (+fallback en-US pour les
  // mots techniques). Chromium telecharge le dictionnaire Hunspell au 1er run
  // sur Windows ; non-bloquant en offline — reprend au prochain demarrage.
  try { session.defaultSession.setSpellCheckerLanguages(['fr', 'en-US']) }
  catch (err) { log.warn('[Main] setSpellCheckerLanguages failed:', err) }

  // Splash AVANT db.init : better-sqlite3 est synchrone, les migrations peuvent
  // prendre 500-1500ms sur une DB a seed ou apres bump de version. On affiche
  // d'abord le splash pour que l'utilisateur ait un retour visuel immediat,
  // puis on lance l'init (qui bloque brievement le thread principal mais la
  // fenetre splash est deja peinte par le GPU).
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

  try {
    db.init()
  } catch (dbErr: unknown) {
    const msg = dbErr instanceof Error ? dbErr.message : String(dbErr)
    log.error('[Main] DB init failed:', dbErr)
    splash.destroy()
    // Dialog enrichie : proposer d'ouvrir les logs plutot que demander
    // a l'utilisateur de supprimer a l'aveugle son dossier de donnees.
    dialog.showMessageBox({
      type: 'error',
      title: 'Erreur de base de données',
      message: 'Impossible d\'initialiser la base de données.',
      detail: `${msg}\n\nConsultez les logs pour plus de detail, ou contactez le support.`,
      buttons: ['Ouvrir les logs', 'Quitter'],
      defaultId: 0,
      cancelId: 1,
    }).then(({ response }) => {
      if (response === 0) {
        try { shell.showItemInFolder(log.transports.file.getFile().path) }
        catch (err) { log.error('[Main] open logs folder failed:', err) }
      }
      app.quit()
    })
    return
  }
  try {
    ipc.register()
  } catch (ipcErr) {
    log.error('[Main] IPC register failed:', ipcErr)
    splash.destroy()
    dialog.showErrorBox(
      'Erreur critique',
      'Impossible d\'initialiser les handlers IPC. L\'application va fermer.',
    )
    app.quit()
    return
  }
  notifications.start()

  createWindow(splash)

  // ── System tray ────────────────────────────────────────────────────────────
  const trayIconPath = join(__dirname, '../../resources/icon-tray.png')
  tray = new Tray(nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 }))

  function rebuildTrayMenu(): void {
    if (!tray) return
    const pending = getPendingUpdate()
    const items: Electron.MenuItemConstructorOptions[] = [
      { label: 'Afficher Cursus', click: () => { mainWin?.show(); mainWin?.focus() } },
    ]
    if (pending) {
      items.push({ type: 'separator' })
      items.push({
        label: `Redemarrer pour installer v${pending.version}`,
        click: () => { isQuitting = true; quitAndInstall() },
      })
    }
    items.push({ type: 'separator' })
    items.push({
      label: 'Ouvrir le dossier des logs',
      click: () => {
        try { shell.showItemInFolder(log.transports.file.getFile().path) }
        catch (err) { log.error('[Main] open logs folder failed:', err) }
      },
    })
    items.push({ type: 'separator' })
    items.push({ label: 'Quitter', click: () => { isQuitting = true; app.quit() } })
    tray.setContextMenu(Menu.buildFromTemplate(items))
    tray.setToolTip(pending ? `Cursus — mise a jour v${pending.version} prete` : 'Cursus')
  }

  rebuildTrayMenu()
  tray.on('double-click', () => { mainWin?.show(); mainWin?.focus() })

  // ── Auto-update (production uniquement) ──────────────────────────────────
  // Kill switch serveur + telemetrie + notification systeme + tray entry
  initUpdater({
    mainWin,
    tray,
    rebuildTrayMenu,
  }).catch((err) => {
    console.warn('[Main] updater init failed:', err.message)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch(async (err: Error) => {
  log.error('[Main] startup error:', err)
  const { response } = await dialog.showMessageBox({
    type: 'error',
    title: 'Erreur au démarrage',
    message: 'Cursus n\'a pas pu demarrer correctement.',
    detail: `${err.message}\n\nConsultez les logs pour plus de detail.`,
    buttons: ['Ouvrir les logs', 'Quitter'],
    defaultId: 0,
    cancelId: 1,
  })
  if (response === 0) {
    try { shell.showItemInFolder(log.transports.file.getFile().path) }
    catch { /* best-effort */ }
  }
  app.quit()
})

app.on('window-all-closed', () => {
  // Le tray garde l'app en vie, ne pas quitter
})

// ── Fermeture propre ──────────────────────────────────────────────────────────
app.on('before-quit', () => {
  isQuitting = true
  notifications.stop()
  stopUpdater()
  db.close()
})
