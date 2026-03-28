// ─── IPC handlers pour le cache offline ──────────────────────────────────────
const { ipcMain, app } = require('electron')
const fs = require('fs')
const path = require('path')

const CACHE_DIR = path.join(app.getPath('userData'), 'offline-cache')

// Creer le dossier de cache s'il n'existe pas
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }
}

function safeName(key) {
  // Sanitize le nom de fichier : garder uniquement alphanum, tirets, underscores
  return key.replace(/[^a-zA-Z0-9_-]/g, '_')
}

function registerOfflineHandlers() {
  // Ecrire dans le cache
  ipcMain.handle('offline:write', async (_event, key, data) => {
    try {
      ensureCacheDir()
      const filePath = path.join(CACHE_DIR, `${safeName(key)}.json`)
      fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8')
      return { ok: true, data: null }
    } catch (err) {
      console.error('[Offline] Erreur ecriture cache:', err.message)
      return { ok: false, error: err.message }
    }
  })

  // Lire depuis le cache
  ipcMain.handle('offline:read', async (_event, key) => {
    try {
      const filePath = path.join(CACHE_DIR, `${safeName(key)}.json`)
      if (!fs.existsSync(filePath)) return { ok: true, data: null }
      const raw = fs.readFileSync(filePath, 'utf-8')
      return { ok: true, data: JSON.parse(raw) }
    } catch (err) {
      console.error('[Offline] Erreur lecture cache:', err.message)
      return { ok: false, error: err.message }
    }
  })

  // Vider tout le cache
  ipcMain.handle('offline:clear', async () => {
    try {
      if (fs.existsSync(CACHE_DIR)) {
        const files = fs.readdirSync(CACHE_DIR)
        for (const file of files) {
          fs.unlinkSync(path.join(CACHE_DIR, file))
        }
      }
      return { ok: true, data: null }
    } catch (err) {
      console.error('[Offline] Erreur nettoyage cache:', err.message)
      return { ok: false, error: err.message }
    }
  })
}

module.exports = { registerOfflineHandlers }
