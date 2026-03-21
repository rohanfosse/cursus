// ─── Handlers IPC — processus Main ────────────────────────────────────────────
// Orchestrateur : charge et enregistre les modules IPC spécialisés.
// Ce fichier est intentionnellement en JavaScript pour la compatibilité
// avec better-sqlite3 (module natif CommonJS).

const structure = require('./ipc/structure')
const messages  = require('./ipc/messages')
const travaux   = require('./ipc/travaux')
const documents = require('./ipc/documents')
const files     = require('./ipc/files')

function register() {
  structure.register()
  messages.register()
  travaux.register()
  documents.register()
  files.register()
}

module.exports = { register }
