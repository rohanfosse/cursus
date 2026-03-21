// ─── IPC : Messages (envoi, recherche, épinglage, réactions) ─────────────────
const { ipcMain, BrowserWindow } = require('electron')
const { handle } = require('./helpers')
const queries = require('../../../server/db/index')
const { sendMessagePayload } = require('./validation')

function register() {
  // ── Lecture ──────────────────────────────────────────────────────────────
  handle('db:getChannelMessages',     (channelId)              => queries.getChannelMessages(channelId))
  handle('db:getDmMessages',          (studentId)              => queries.getDmMessages(studentId))
  handle('db:getChannelMessagesPage', (channelId, beforeId)    => queries.getChannelMessagesPage(channelId, beforeId ?? null))
  handle('db:getDmMessagesPage',      (studentId, beforeId)    => queries.getDmMessagesPage(studentId, beforeId ?? null))
  handle('db:searchMessages',         (channelId, query)       => queries.searchMessages(channelId, query))
  handle('db:searchAllMessages',      ({ promoId, query, limit }) => queries.searchAllMessages(promoId ?? null, query, limit ?? 8))

  // ── Envoi — handler dédié : DB + push temps-réel ────────────────────────
  ipcMain.handle('db:sendMessage', async (_event, payload) => {
    try {
      // Validation du payload
      const parsed = sendMessagePayload.safeParse(payload)
      if (!parsed.success) {
        const msg = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
        return { ok: false, error: `Données invalides : ${msg}` }
      }
      payload = parsed.data
      const result = queries.sendMessage(payload)

      // Parsing des mentions
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
        channelName:    payload.channelName ?? null,
        promoId:        payload.promoId     ?? null,
        preview:        rawContent.replace(/[*_`>#[\]!]/g, '').slice(0, 80),
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

  // ── Épinglage ───────────────────────────────────────────────────────────
  handle('db:getPinnedMessages', (channelId) => queries.getPinnedMessages(channelId))
  handle('db:togglePinMessage',  (payload)   => queries.togglePinMessage(payload.messageId, payload.pinned))

  // ── Réactions ───────────────────────────────────────────────────────────
  handle('db:updateReactions', (msgId, reactionsJson) => queries.updateReactions(msgId, reactionsJson))

  // ── Suppression / modification ──────────────────────────────────────────
  handle('db:deleteMessage', (id) => queries.deleteMessage(id))
  handle('db:editMessage',   (id, content) => queries.editMessage(id, content))
}

module.exports = { register }
