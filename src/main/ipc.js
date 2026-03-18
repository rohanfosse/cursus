// ─── Handlers IPC — processus Main ────────────────────────────────────────────
// Ce fichier est intentionnellement en JavaScript pour la compatibilité
// avec better-sqlite3 (module natif CommonJS).
// Les types sont déclarés dans src/renderer/src/env.d.ts côté renderer.

const { ipcMain, dialog, shell } = require('electron')
const fs      = require('fs')
const path    = require('path')
// Chemin relatif depuis src/main/ vers src/db/
const queries = require('../db/index')

// ─── Sécurité : validation des chemins de fichiers ───────────────────────────
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

// Wrapper uniforme { ok, data } / { ok: false, error }
function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, data: fn(...args) }
    } catch (err) {
      console.error(`[IPC ${channel}]`, err.message)
      return { ok: false, error: err.message }
    }
  })
}

function register() {
  // ── Structure ────────────────────────────────────────────────────────────
  handle('db:getPromotions',    ()           => queries.getPromotions())
  handle('db:getChannels',      (promoId)    => queries.getChannels(promoId))
  handle('db:getStudents',      (promoId)    => queries.getStudents(promoId))
  handle('db:getAllStudents',   ()           => queries.getAllStudents())

  // ── Messages ─────────────────────────────────────────────────────────────
  handle('db:getChannelMessages',     (channelId)              => queries.getChannelMessages(channelId))
  handle('db:getDmMessages',          (studentId)              => queries.getDmMessages(studentId))
  // Endpoints paginés (infinite scroll) — beforeId = curseur (null = page initiale)
  handle('db:getChannelMessagesPage', (channelId, beforeId)    => queries.getChannelMessagesPage(channelId, beforeId ?? null))
  handle('db:getDmMessagesPage',      (studentId, beforeId)    => queries.getDmMessagesPage(studentId, beforeId ?? null))
  handle('db:searchMessages',         (channelId, query)       => queries.searchMessages(channelId, query))

  // sendMessage — handler dédié : DB + push temps-réel vers tous les renderers
  ipcMain.handle('db:sendMessage', async (_event, payload) => {
    try {
      const result = queries.sendMessage(payload)
      const { BrowserWindow } = require('electron')

      // ── Parsing des mentions dans le contenu ─────────────────────────────
      const rawContent      = payload.content ?? ''
      const mentionEveryone = /@everyone\b/i.test(rawContent)
      const mentionNames    = []
      const re = /@([\w][\w.\-]*)/g
      let m
      while ((m = re.exec(rawContent)) !== null) {
        const name = m[1].toLowerCase()
        if (name !== 'everyone') mentionNames.push(m[1])
      }

      const push = {
        channelId:      payload.channelId   ?? null,
        dmStudentId:    payload.dmStudentId ?? null,
        authorName:     payload.authorName  ?? null,
        mentionEveryone,
        mentionNames,
      }
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send('msg:new', push)
      }
      return { ok: true, data: result }
    } catch (err) {
      console.error('[IPC db:sendMessage]', err.message)
      return { ok: false, error: err.message }
    }
  })

  // ── Travaux ───────────────────────────────────────────────────────────────
  handle('db:getTravaux',       (channelId) => queries.getTravaux(channelId))
  handle('db:getTravailById',   (travailId) => queries.getTravailById(travailId))
  handle('db:createTravail',    (payload)   => queries.createTravail(payload))
  handle('db:getTravauxSuivi',  (travailId) => queries.getTravauxSuivi(travailId))

  // ── Dépôts ────────────────────────────────────────────────────────────────
  handle('db:getDepots',   (travailId) => queries.getDepots(travailId))
  handle('db:addDepot',    (payload)   => queries.addDepot(payload))
  handle('db:setNote',     (payload)   => queries.setNote(payload))
  handle('db:setFeedback', (payload)   => queries.setFeedback(payload))

  // ── Groupes ───────────────────────────────────────────────────────────────
  handle('db:getGroups',       (promoId)  => queries.getGroups(promoId))
  handle('db:createGroup',     (payload)  => queries.createGroup(payload))
  handle('db:deleteGroup',     (groupId)  => queries.deleteGroup(groupId))
  handle('db:getGroupMembers', (groupId)  => queries.getGroupMembers(groupId))
  handle('db:setGroupMembers', (payload)  => queries.setGroupMembers(payload))

  // ── Profil étudiant ───────────────────────────────────────────────────────
  handle('db:getStudentProfile', (studentId) => queries.getStudentProfile(studentId))
  handle('db:getStudentTravaux', (studentId) => queries.getStudentTravaux(studentId))

  // ── Ressources ────────────────────────────────────────────────────────────
  handle('db:getRessources',  (travailId) => queries.getRessources(travailId))
  handle('db:addRessource',   (payload)   => queries.addRessource(payload))
  handle('db:deleteRessource',(id)        => queries.deleteRessource(id))

  // ── Groupes par projet ────────────────────────────────────────────────────
  handle('db:getTravailGroupMembers', (travailId) => queries.getTravailGroupMembers(travailId))
  handle('db:setTravailGroupMember',  (payload)   => queries.setTravailGroupMember(payload))

  // ── Brouillon / publication ───────────────────────────────────────────────
  handle('db:updateTravailPublished', (payload) => queries.updateTravailPublished(payload))

  // ── Échéancier prof ───────────────────────────────────────────────────────
  handle('db:getTeacherSchedule',     ()         => queries.getTeacherSchedule())
  handle('db:getTravailCategories',   (promoId)  => queries.getTravailCategories(promoId))

  // ── Gantt + rendus ────────────────────────────────────────────────────────
  handle('db:getGanttData',  (promoId) => queries.getGanttData(promoId ?? null))
  handle('db:getAllRendus',   (promoId) => queries.getAllRendus(promoId ?? null))

  // ── Visualisation PDF ─────────────────────────────────────────────────────
  ipcMain.handle('window:openPdf', async (_event, filePath) => {
    try {
      const { BrowserWindow } = require('electron')
      const win = new BrowserWindow({
        width: 960, height: 780,
        title: 'Visualisation — CeSlack',
        backgroundColor: '#111214',
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      })
      await win.loadURL(`file://${filePath}`)
      return { ok: true, data: null }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ── Promotions & canaux ───────────────────────────────────────────────────
  handle('db:createPromotion',  (payload)            => queries.createPromotion(payload))
  handle('db:deletePromotion',  (promoId)            => queries.deletePromotion(promoId))
  handle('db:createChannel',    (payload)            => queries.createChannel(payload))
  handle('db:renameChannel',    (id, name)           => queries.renameChannel(id, name))
  handle('db:deleteChannel',    (id)                 => queries.deleteChannel(id))
  handle('db:renameCategory',   (promoId, old, next) => queries.renameCategory(promoId, old, next))
  handle('db:deleteCategory',   (promoId, category)  => queries.deleteCategory(promoId, category))

  // ── Réinitialisation des données ─────────────────────────────────────────
  handle('db:resetAndSeed', () => { queries.resetAndSeed(); return null })

  // ── Inscription étudiant ──────────────────────────────────────────────────
  handle('db:getStudentByEmail', (email)   => queries.getStudentByEmail(email))
  handle('db:registerStudent',   (payload) => queries.registerStudent(payload))

  // ── Identité / login ──────────────────────────────────────────────────────
  handle('db:getIdentities',        ()                 => queries.getIdentities())
  handle('db:loginWithCredentials', (email, password)  => queries.loginWithCredentials(email, password))

  // ── Shell — ouvrir fichier/lien ───────────────────────────────────────────
  ipcMain.handle('shell:openPath', async (_event, filePath) => {
    try {
      const resolved = assertSafePath(filePath)
      if (!fs.existsSync(resolved)) return { ok: false, error: 'Fichier introuvable.' }
      const err = await shell.openPath(resolved)
      return err ? { ok: false, error: err } : { ok: true, data: null }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  ipcMain.handle('shell:openExternal', async (_event, url) => {
    try {
      if (typeof url !== 'string' || !/^(https?:\/\/|mailto:)/i.test(url)) {
        return { ok: false, error: 'URL invalide.' }
      }
      await shell.openExternal(url)
      return { ok: true, data: null }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  // ── Documents de canal ────────────────────────────────────────────────────
  handle('db:getChannelDocuments',          (channelId) => queries.getChannelDocuments(channelId))
  handle('db:getPromoDocuments',            (promoId)   => queries.getPromoDocuments(promoId))
  handle('db:addChannelDocument',           (payload)   => queries.addChannelDocument(payload))
  handle('db:deleteChannelDocument',        (id)        => queries.deleteChannelDocument(id))
  handle('db:getChannelDocumentCategories', (channelId) => queries.getChannelDocumentCategories(channelId))

  // ── Documents de projet (nouveau) ─────────────────────────────────────────
  handle('db:getProjectDocuments',          (promoId, project)  => queries.getProjectDocuments(promoId, project ?? null))
  handle('db:addProjectDocument', (payload) => {
    const result = queries.addProjectDocument(payload)
    // Notifier les canaux du projet correspondant
    if (result?.changes && payload.project && payload.promoId && payload.authorName) {
      try {
        const channels = queries.getChannels(payload.promoId)
        const projectChannels = channels.filter(c => c.category?.trim() === payload.project?.trim())
        const emoji   = payload.type === 'link' ? '🔗' : '📎'
        const catPart = payload.category && payload.category !== 'Général' ? ` · ${payload.category}` : ''
        const text    = `${emoji} **${payload.name}** a été ajouté aux documents${catPart}`
        for (const ch of projectChannels) {
          queries.sendMessage({
            channelId:  ch.id,
            authorName: payload.authorName,
            authorType: payload.authorType ?? 'teacher',
            content:    text,
          })
        }
      } catch (e) {
        console.warn('[addProjectDocument] Notification canal échouée :', e.message)
      }
    }
    return result
  })
  handle('db:getProjectDocumentCategories', (promoId, project)  => queries.getProjectDocumentCategories(promoId, project ?? null))

  // ── Messages épinglés ─────────────────────────────────────────────────────
  handle('db:getPinnedMessages', (channelId) => queries.getPinnedMessages(channelId))
  handle('db:togglePinMessage',  (payload)   => queries.togglePinMessage(payload.messageId, payload.pinned))

  // ── Réactions (persistance) ───────────────────────────────────────────────
  handle('db:updateReactions', (msgId, reactionsJson) => queries.updateReactions(msgId, reactionsJson))

  // ── Suppression / modification de messages ────────────────────────────────
  handle('db:deleteMessage', (id) => queries.deleteMessage(id))
  handle('db:editMessage',   (id, content) => queries.editMessage(id, content))

  // ── Action de masse ───────────────────────────────────────────────────────
  handle('db:markNonSubmittedAsD', (travailId) => queries.markNonSubmittedAsD(travailId))

  // ── Rubrics ───────────────────────────────────────────────────────────────
  handle('db:getRubric',      (travailId) => queries.getRubric(travailId))
  handle('db:upsertRubric',   (payload)   => queries.upsertRubric(payload))
  handle('db:deleteRubric',   (travailId) => queries.deleteRubric(travailId))
  handle('db:getDepotScores', (depotId)   => queries.getDepotScores(depotId))
  handle('db:setDepotScores', (payload)   => queries.setDepotScores(payload))

  // ── Export CSV des notes ──────────────────────────────────────────────────
  ipcMain.handle('export:csv', async (_event, travailId) => {
    try {
      const travail = queries.getTravailById(travailId)
      if (!travail) return { ok: false, error: 'Travail introuvable.' }

      const depots = queries.getDepots(travailId)

      // En-têtes + lignes
      const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const headers = ['Étudiant', 'Note', 'Feedback', 'Soumis le', 'Type', 'Fichier / Lien']
      const rows = depots.map((d) => [
        escape(d.student_name),
        escape(d.note ?? ''),
        escape(d.feedback ?? ''),
        escape(d.submitted_at ?? ''),
        escape(d.type ?? ''),
        escape(d.type === 'link' ? (d.link_url ?? '') : (d.file_name ?? '')),
      ])
      const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n')

      // Boîte de dialogue de sauvegarde
      const safeName = travail.title.replace(/[\\/:*?"<>|]/g, '_')
      const { canceled, filePath: dest } = await dialog.showSaveDialog({
        defaultPath: `notes_${safeName}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      })
      if (canceled || !dest) return { ok: true, data: null }

      fs.writeFileSync(dest, '\uFEFF' + csv, 'utf8') // BOM UTF-8 pour Excel
      return { ok: true, data: path.basename(dest) }
    } catch (err) {
      console.error('[IPC export:csv]', err.message)
      return { ok: false, error: err.message }
    }
  })

  // ── Import CSV étudiants ──────────────────────────────────────────────────
  ipcMain.handle('import:students', async (_event, promoId) => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Importer des étudiants (CSV)',
        filters: [{ name: 'Fichiers CSV', extensions: ['csv', 'txt'] }],
        properties: ['openFile'],
      })
      if (canceled || !filePaths.length) return { ok: true, data: null }

      const raw  = fs.readFileSync(filePaths[0], 'utf8').replace(/^\uFEFF/, '') // strip BOM
      const sep  = raw.indexOf(';') !== -1 ? ';' : ','
      const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
      if (lines.length < 2) return { ok: false, error: 'Fichier CSV vide ou sans données.' }

      const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''))
      const rows = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''))
        const row = {}
        headers.forEach((h, j) => { row[h] = cols[j] ?? '' })
        rows.push(row)
      }

      const result = queries.bulkImportStudents(promoId, rows)
      return { ok: true, data: result }
    } catch (err) {
      console.error('[IPC import:students]', err.message)
      return { ok: false, error: err.message }
    }
  })

  // ── Fichiers ──────────────────────────────────────────────────────────────
  ipcMain.handle('fs:readFileBase64', async (_event, filePath) => {
    try {
      const resolved = assertSafePath(filePath)
      if (!fs.existsSync(resolved)) return { ok: false, error: 'Fichier introuvable.' }
      const stats = fs.statSync(resolved)
      if (stats.size > MAX_READ_BYTES) return { ok: false, error: 'Fichier trop volumineux (> 50 Mo).' }
      const buffer  = fs.readFileSync(resolved)
      const ext     = path.extname(resolved).slice(1).toLowerCase()
      const mimeMap = {
        pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg',
        jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
        mp4: 'video/mp4', txt: 'text/plain',
      }
      const mime = mimeMap[ext] ?? 'application/octet-stream'
      return { ok: true, data: { mime, b64: buffer.toString('base64'), ext } }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('fs:downloadFile', async (_event, filePath) => {
    try {
      const resolved = assertSafePath(filePath)
      if (!fs.existsSync(resolved)) return { ok: false, error: 'Fichier introuvable.' }
      const fileName = path.basename(resolved)
      const { canceled, filePath: dest } = await dialog.showSaveDialog({ defaultPath: fileName })
      if (canceled || !dest) return { ok: true, data: null }
      fs.copyFileSync(resolved, dest)
      return { ok: true, data: dest }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ── Dialogues ─────────────────────────────────────────────────────────────
  ipcMain.handle('dialog:openImage', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
      })
      if (result.canceled || !result.filePaths.length) return { ok: true, data: null }
      const buffer = fs.readFileSync(result.filePaths[0])
      const ext    = path.extname(result.filePaths[0]).slice(1).toLowerCase()
      const mime   = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
      return { ok: true, data: `data:${mime};base64,${buffer.toString('base64')}` }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('dialog:openFile', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Tous les fichiers', extensions: ['*'] },
          { name: 'PDF',               extensions: ['pdf'] },
          { name: 'Documents',         extensions: ['doc', 'docx', 'odt'] },
          { name: 'Archives',          extensions: ['zip', 'tar', 'gz'] },
          { name: 'Code source',       extensions: ['py', 'js', 'ts', 'java', 'c', 'cpp', 'pkt'] },
        ],
      })
      if (result.canceled || !result.filePaths.length) return { ok: true, data: null }
      return { ok: true, data: result.filePaths[0] }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

}

module.exports = { register }
