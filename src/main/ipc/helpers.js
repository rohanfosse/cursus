// ─── IPC helpers partagés ─────────────────────────────────────────────────────
const { ipcMain } = require('electron')
const path = require('path')
const { hasRole } = require('../../../server/permissions')

const MAX_READ_BYTES = 50 * 1024 * 1024

// ── Contexte utilisateur (rempli par setToken dans le renderer) ──────────────
let _currentUser = null // { id, name, type, promo_id }

function setCurrentUser(user) { _currentUser = user }
function getCurrentUser() { return _currentUser }

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

/** Wrapper role-based — bloque si l'utilisateur n'a pas le role minimum. */
function handleRole(minRole, channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      if (!hasRole(_currentUser?.type, minRole)) {
        return { ok: false, error: 'Accès réservé.' }
      }
      return { ok: true, data: fn(...args) }
    } catch (err) {
      console.error(`[IPC ${channel}]`, err.stack || err.message)
      return { ok: false, error: err.message }
    }
  })
}

/**
 * Wrapper projet-scopé — vérifie que le TA est assigné au projet.
 * Teachers et admins passent toujours.
 */
function handleProject(channel, getProjectId, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      if (!hasRole(_currentUser?.type, 'ta')) {
        return { ok: false, error: 'Accès réservé.' }
      }
      if (_currentUser?.type === 'ta') {
        const projectId = getProjectId(...args)
        if (projectId) {
          const { getDb } = require('../../../server/db/connection')
          const teacherId = Math.abs(_currentUser.id)
          const assigned = getDb().prepare(
            'SELECT 1 FROM teacher_projects WHERE teacher_id = ? AND project_id = ? LIMIT 1'
          ).get(teacherId, projectId)
          if (!assigned) {
            return { ok: false, error: 'Vous n\'êtes pas assigné à ce projet.' }
          }
        }
      }
      return { ok: true, data: fn(...args) }
    } catch (err) {
      console.error(`[IPC ${channel}]`, err.stack || err.message)
      return { ok: false, error: err.message }
    }
  })
}

/**
 * Wrapper promo-isolé — vérifie que l'étudiant appartient à la promo demandée.
 * @param {string} channel
 * @param {(...args) => number|null} getPromoId — extrait le promoId cible des arguments
 * @param {Function} fn — handler
 */
function handlePromo(channel, getPromoId, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      if (_currentUser?.type === 'student') {
        const targetPromo = getPromoId(...args)
        if (targetPromo != null && _currentUser.promo_id !== targetPromo) {
          return { ok: false, error: 'Accès non autorisé à cette promotion.' }
        }
      }
      return { ok: true, data: fn(...args) }
    } catch (err) {
      console.error(`[IPC ${channel}]`, err.stack || err.message)
      return { ok: false, error: err.message }
    }
  })
}

module.exports = { handle, handleRole, handleProject, handlePromo, assertSafePath, MAX_READ_BYTES, setCurrentUser, getCurrentUser }
