// ─── IPC : Documents (canal + projet) ─────────────────────────────────────────
const { handle, handleRole, handlePromo } = require('./helpers')
const queries = require('../../../server/db/index')
const { validated, addDocumentPayload } = require('./validation')

function register() {
  handle('db:getChannelDocuments',          (channelId) => queries.getChannelDocuments(channelId))
  handlePromo('db:getPromoDocuments', (promoId) => promoId, (promoId) => queries.getPromoDocuments(promoId))
  handle('db:addChannelDocument',           validated(addDocumentPayload, (payload) => queries.addChannelDocument(payload)))
  handleRole('teacher','db:deleteChannelDocument',        (id)        => queries.deleteChannelDocument(id))
  handle('db:getChannelDocumentCategories', (channelId) => queries.getChannelDocumentCategories(channelId))

  // ── Documents de projet ─────────────────────────────────────────────────
  handlePromo('db:getProjectDocuments', (promoId) => promoId, (promoId, project) => queries.getProjectDocuments(promoId, project ?? null))
  handle('db:addProjectDocument', validated(addDocumentPayload, (payload) => {
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
  }))
  handle('db:getProjectDocumentCategories', (promoId, project) => queries.getProjectDocumentCategories(promoId, project ?? null))
  handlePromo('db:searchDocuments', (promoId) => promoId, (promoId, q) => queries.searchDocuments(promoId, q ?? ''))
  handle('db:linkDocumentToTravail',        (docId, travailId) => queries.linkDocumentToTravail(docId, travailId ?? null))
  handleRole('teacher','db:updateProjectDocument', (id, payload) => queries.updateProjectDocument({ id, ...payload }))
}

module.exports = { register }
