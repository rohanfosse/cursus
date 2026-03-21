// ─── IPC : Documents (canal + projet) ─────────────────────────────────────────
const { handle } = require('./helpers')
const queries = require('../../db/index')

function register() {
  handle('db:getChannelDocuments',          (channelId) => queries.getChannelDocuments(channelId))
  handle('db:getPromoDocuments',            (promoId)   => queries.getPromoDocuments(promoId))
  handle('db:addChannelDocument',           (payload)   => queries.addChannelDocument(payload))
  handle('db:deleteChannelDocument',        (id)        => queries.deleteChannelDocument(id))
  handle('db:getChannelDocumentCategories', (channelId) => queries.getChannelDocumentCategories(channelId))

  // ── Documents de projet ─────────────────────────────────────────────────
  handle('db:getProjectDocuments',          (promoId, project) => queries.getProjectDocuments(promoId, project ?? null))
  handle('db:addProjectDocument', (payload) => {
    const result = queries.addProjectDocument(payload)
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
  handle('db:getProjectDocumentCategories', (promoId, project) => queries.getProjectDocumentCategories(promoId, project ?? null))
}

module.exports = { register }
