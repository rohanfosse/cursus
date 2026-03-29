// ─── Handlers IPC - processus Main ────────────────────────────────────────────
// Orchestrateur : charge et enregistre les modules IPC spécialisés.
// Ce fichier est intentionnellement en JavaScript pour la compatibilité
// avec better-sqlite3 (module natif CommonJS).

const { ipcMain } = require('electron')
const { setCurrentUser } = require('./ipc/helpers')
const structure = require('./ipc/structure')
const messages  = require('./ipc/messages')
const travaux   = require('./ipc/travaux')
const documents = require('./ipc/documents')
const projects  = require('./ipc/projects')
const files     = require('./ipc/files')
const onboarding = require('./ipc/onboarding')
const { registerOfflineHandlers } = require('./ipc/offline')

function register() {
  // ── Contexte utilisateur (envoyé par le renderer après login) ──────────
  ipcMain.on('auth:setUser', (_event, user) => {
    setCurrentUser(user ?? null)
  })

  structure.register()
  messages.register()
  travaux.register()
  documents.register()
  projects.register()
  files.register()
  onboarding.register()
  registerOfflineHandlers()
}

module.exports = { register }
