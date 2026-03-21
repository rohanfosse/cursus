// ─── IPC helpers partagés ─────────────────────────────────────────────────────
const { ipcMain } = require('electron')
const path = require('path')

const MAX_READ_BYTES = 50 * 1024 * 1024

function assertSafePath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('Chemin de fichier invalide.')
  }
  if (filePath.includes('\0')) {
    throw new Error('Chemin de fichier invalide (null byte).')
  }
  const resolved = path.resolve(filePath)
  if (!path.isAbsolute(resolved)) {
    throw new Error('Chemin de fichier non absolu.')
  }
  return resolved
}

/** Wrapper uniforme { ok, data } / { ok: false, error } */
function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, data: fn(...args) }
    } catch (err) {
      const isDbError = err.code && err.code.startsWith('SQLITE_')
      if (isDbError) {
        console.error(`[IPC ${channel}] DB error (${err.code}):`, err.message)
      } else {
        console.error(`[IPC ${channel}]`, err.stack || err.message)
      }
      return { ok: false, error: err.message }
    }
  })
}

module.exports = { handle, assertSafePath, MAX_READ_BYTES }
