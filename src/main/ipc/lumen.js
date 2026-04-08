// ─── IPC : Lumen (snapshot repo git d'exemple) ──────────────────────────────
// Handler pour sauvegarder le zip d'un snapshot sur le disque de l'utilisateur.
// Le renderer fetch le zip via HTTP (authentifie), puis delegue la sauvegarde
// ici pour beneficier du dialog natif showSaveDialog + ecriture sur disque
// via Node.js (pas de blob gymnastics cote web).
const { ipcMain, dialog, shell } = require('electron')
const fs = require('fs')
const path = require('path')

function register() {
  /**
   * Sauvegarde un buffer zip sur le disque via un save dialog natif.
   * @param {{ buffer: ArrayBuffer | Uint8Array, suggestedName: string }} payload
   */
  ipcMain.handle('lumen:saveSnapshotZip', async (_event, payload) => {
    try {
      const { buffer, suggestedName } = payload ?? {}
      if (!buffer) return { ok: false, error: 'Aucune donnee recue.' }

      const { canceled, filePath: dest } = await dialog.showSaveDialog({
        defaultPath: suggestedName || 'cours-exemple.zip',
        filters: [{ name: 'Archive ZIP', extensions: ['zip'] }],
      })
      if (canceled || !dest) return { ok: true, data: null }

      // payload.buffer peut etre un ArrayBuffer (serialise par IPC) ou
      // deja un Uint8Array selon le pont Electron — on normalise.
      const bytes = Buffer.isBuffer(buffer)
        ? buffer
        : Buffer.from(buffer)
      fs.writeFileSync(dest, bytes)

      return { ok: true, data: { filename: path.basename(dest), path: dest } }
    } catch (err) {
      return { ok: false, error: err?.message ?? 'Erreur lors de la sauvegarde.' }
    }
  })

  /**
   * Ouvre le dossier contenant le zip sauvegarde (appele apres saveSnapshotZip).
   * Permet a l'etudiant d'aller directement chercher son fichier.
   */
  ipcMain.handle('lumen:revealSnapshot', async (_event, filePath) => {
    try {
      if (typeof filePath !== 'string' || !filePath) {
        return { ok: false, error: 'Chemin invalide.' }
      }
      shell.showItemInFolder(filePath)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err?.message ?? 'Erreur.' }
    }
  })
}

module.exports = { register }
