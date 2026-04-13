// ─── IPC : Cahiers (notebooks collaboratifs) ────────────────────────────────
const { handle, handleRole } = require('./helpers')
const queries = require('../../../server/db/index')

function register() {
  handle('db:getCahiers',         (promoId, project) => queries.getCahiers(promoId, project ?? null))
  handle('db:getCahierById',      (id) => queries.getCahierById(id))
  handle('db:getCahierYjsState',  (id) => {
    const state = queries.getCahierYjsState(id)
    return state ? Buffer.from(state).toString('base64') : null
  })
  handle('db:saveCahierYjsState', (id, base64State) => {
    const buf = Buffer.from(base64State, 'base64')
    return queries.saveCahierYjsState(id, buf)
  })
  handle('db:createCahier',       (payload) => queries.createCahier(payload))
  handle('db:renameCahier',       (id, title) => queries.renameCahier(id, title))
  handleRole('teacher', 'db:deleteCahier', (id) => queries.deleteCahier(id))
}

module.exports = { register }
