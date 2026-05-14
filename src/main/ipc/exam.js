// ─── IPC : Mode examen surveille ─────────────────────────────────────────────
// Verrouillage Electron pendant une session d'examen :
//   - plein ecran force + kiosk (bloque taskbar/dock + decor)
//   - menu bar invisible
//   - blocage des raccourcis devtools, refresh, fermeture fenetre
//
// Le blocage strict d'Alt+Tab ou de la composition windows est impossible
// sans hook OS-level (hors scope MVP). On compte sur "tricheur opportuniste"
// + log des focus loss (cf. ipc/exam-events au commit suivant).
//
// Pas de proctoring camera/ecran : on ne capture rien.

const { ipcMain, BrowserWindow } = require('electron')

// Snapshot de l'etat fenetre avant kiosk, pour restauration propre a exit.
// On garde par webContents.id pour gerer plusieurs fenetres (au cas ou).
const prevStateByWc = new Map()
const keyGuardByWc  = new Map()

// Raccourcis bloques pendant l'examen (devtools, reload, fermeture).
// Format : "modifiers+key" en lowercase, modifiers ordre fixe.
const BLOCKED_KEYS = new Set([
  'control+shift+i', 'control+shift+j', 'control+shift+c',
  'meta+shift+i',    'meta+shift+j',    'meta+shift+c',
  'f12',
  'control+r', 'control+shift+r', 'meta+r', 'meta+shift+r',
  'control+w', 'meta+w',
  'control+q', 'meta+q',
])

function inputToCombo(input) {
  return [
    input.control ? 'control' : null,
    input.meta    ? 'meta'    : null,
    input.shift   ? 'shift'   : null,
    (input.key || '').toLowerCase(),
  ].filter(Boolean).join('+')
}

function installKeyGuard(win) {
  const wcId = win.webContents.id
  if (keyGuardByWc.has(wcId)) return // deja installe
  const handler = (event, input) => {
    if (input.type !== 'keyDown') return
    if (BLOCKED_KEYS.has(inputToCombo(input))) event.preventDefault()
  }
  win.webContents.on('before-input-event', handler)
  keyGuardByWc.set(wcId, handler)
}

function removeKeyGuard(win) {
  const wcId = win.webContents.id
  const handler = keyGuardByWc.get(wcId)
  if (handler) {
    win.webContents.off('before-input-event', handler)
    keyGuardByWc.delete(wcId)
  }
}

function register() {
  ipcMain.handle('exam:enterKiosk', async (event /* , travailId */) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) throw new Error('Fenetre Electron introuvable.')
      const wcId = win.webContents.id

      prevStateByWc.set(wcId, {
        fullScreen:        win.isFullScreen(),
        kiosk:             typeof win.isKiosk === 'function' ? win.isKiosk() : false,
        menuBarVisibility: win.isMenuBarVisible(),
        alwaysOnTop:       win.isAlwaysOnTop(),
      })

      win.setMenuBarVisibility(false)
      win.setAlwaysOnTop(true)
      win.setFullScreen(true)
      if (typeof win.setKiosk === 'function') win.setKiosk(true)
      installKeyGuard(win)

      return { ok: true, data: null }
    } catch (err) {
      console.error('[exam:enterKiosk]', err)
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('exam:exitKiosk', async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { ok: true, data: null } // graceful : si plus de fenetre, c'est ok
      const wcId = win.webContents.id
      const prev = prevStateByWc.get(wcId)
      if (prev) {
        if (typeof win.setKiosk === 'function') win.setKiosk(prev.kiosk)
        win.setFullScreen(prev.fullScreen)
        win.setMenuBarVisibility(prev.menuBarVisibility)
        win.setAlwaysOnTop(prev.alwaysOnTop)
        prevStateByWc.delete(wcId)
      } else {
        // Pas de state : on relache au mieux.
        if (typeof win.setKiosk === 'function') win.setKiosk(false)
        win.setFullScreen(false)
        win.setMenuBarVisibility(true)
        win.setAlwaysOnTop(false)
      }
      removeKeyGuard(win)
      return { ok: true, data: null }
    } catch (err) {
      console.error('[exam:exitKiosk]', err)
      return { ok: false, error: err.message }
    }
  })
}

module.exports = { register }
