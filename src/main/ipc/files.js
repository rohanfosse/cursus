// ─── IPC : Fichiers, dialogues, export/import ────────────────────────────────
const { ipcMain, dialog, shell, BrowserWindow } = require('electron')
const fs   = require('fs')
const path = require('path')
const { assertSafePath, MAX_READ_BYTES } = require('./helpers')
const queries = require('../../../server/db/index')

function register() {
  // ── Visualisation PDF ───────────────────────────────────────────────────
  ipcMain.handle('window:openPdf', async (_event, filePath) => {
    try {
      const win = new BrowserWindow({
        width: 960, height: 780,
        title: 'Visualisation - Cursus',
        backgroundColor: '#111214',
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      })
      await win.loadURL(`file://${filePath}`)
      return { ok: true, data: null }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ── Shell - ouvrir fichier/lien ─────────────────────────────────────────
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
      if (typeof url !== 'string') return { ok: false, error: 'URL invalide.' }
      let parsed
      try { parsed = new URL(url) } catch { return { ok: false, error: 'URL invalide.' } }
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        return { ok: false, error: 'Protocole non autorisé.' }
      }
      await shell.openExternal(url)
      return { ok: true, data: null }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  })

  // ── Lecture de fichiers ─────────────────────────────────────────────────
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
        bmp: 'image/bmp', ico: 'image/x-icon',
        mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
        mkv: 'video/x-matroska', webm: 'video/webm',
        mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
        txt: 'text/plain', csv: 'text/csv', json: 'application/json',
        html: 'text/html', css: 'text/css', js: 'application/javascript',
        xml: 'application/xml', md: 'text/markdown',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc: 'application/msword',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls: 'application/vnd.ms-excel',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ppt: 'application/vnd.ms-powerpoint',
        zip: 'application/zip', rar: 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed', gz: 'application/gzip',
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

  // ── Dialogues ───────────────────────────────────────────────────────────
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
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Tous les fichiers', extensions: ['*'] },
          { name: 'PDF',               extensions: ['pdf'] },
          { name: 'Documents',         extensions: ['doc', 'docx', 'odt'] },
          { name: 'Archives',          extensions: ['zip', 'tar', 'gz'] },
          { name: 'Code source',       extensions: ['py', 'js', 'ts', 'java', 'c', 'cpp', 'pkt'] },
        ],
      })
      if (result.canceled || !result.filePaths.length) return { ok: true, data: null }
      return { ok: true, data: result.filePaths }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // ── Export CSV des notes ─────────────────────────────────────────────────
  ipcMain.handle('export:csv', async (_event, travailId) => {
    try {
      const travail = queries.getTravailById(travailId)
      if (!travail) return { ok: false, error: 'Travail introuvable.' }

      const depots = queries.getDepots(travailId)

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

      const safeName = travail.title.replace(/[\\/:*?"<>|]/g, '_')
      const { canceled, filePath: dest } = await dialog.showSaveDialog({
        defaultPath: `notes_${safeName}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      })
      if (canceled || !dest) return { ok: true, data: null }

      fs.writeFileSync(dest, '\uFEFF' + csv, 'utf8')
      return { ok: true, data: path.basename(dest) }
    } catch (err) {
      console.error('[IPC export:csv]', err.message)
      return { ok: false, error: err.message }
    }
  })

  // ── Import CSV étudiants ────────────────────────────────────────────────
  ipcMain.handle('import:students', async (_event, promoId) => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Importer des étudiants (CSV)',
        filters: [{ name: 'Fichiers CSV', extensions: ['csv', 'txt'] }],
        properties: ['openFile'],
      })
      if (canceled || !filePaths.length) return { ok: true, data: null }

      const csvStats = fs.statSync(filePaths[0])
      if (csvStats.size > 10 * 1024 * 1024) return { ok: false, error: 'Fichier trop volumineux (max 10 Mo).' }

      const raw  = fs.readFileSync(filePaths[0], 'utf8').replace(/^\uFEFF/, '')
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

  // ── Contrôles de fenêtre ────────────────────────────────────────────────
  ipcMain.handle('window:minimize', (_event) => {
    try { _event.sender.getOwnerBrowserWindow()?.minimize(); return { ok: true, data: null } }
    catch (err) { return { ok: false, error: err.message } }
  })

  ipcMain.handle('window:maximize', (_event) => {
    try {
      const win = _event.sender.getOwnerBrowserWindow()
      if (win) win.isMaximized() ? win.unmaximize() : win.maximize()
      return { ok: true, data: null }
    } catch (err) { return { ok: false, error: err.message } }
  })

  ipcMain.handle('window:close', (_event) => {
    try { _event.sender.getOwnerBrowserWindow()?.close(); return { ok: true, data: null } }
    catch (err) { return { ok: false, error: err.message } }
  })

  ipcMain.handle('window:isMaximized', (_event) => {
    try { return { ok: true, data: _event.sender.getOwnerBrowserWindow()?.isMaximized() ?? false } }
    catch (err) { return { ok: false, error: err.message } }
  })
}

module.exports = { register }
