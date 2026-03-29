/**
 * Route admin - Lecture config (accessible aux responsables, pas seulement admin)
 * Separe de settings.js car GET /config doit etre accessible aux teachers
 * pour afficher le bandeau mode lecture seule.
 */
const queries = require('../../db/index')

/** GET /api/admin/config — lecture du mode lecture seule */
function settingsRead(req, res) {
  try {
    const readOnly = queries.getAppConfig('read_only')
    res.json({ ok: true, data: { read_only: readOnly === '1' } })
  } catch {
    res.json({ ok: true, data: { read_only: false } })
  }
}

/** GET /api/admin/modules — liste des modules et leur etat */
const MODULES = ['kanban', 'frise', 'rex', 'live', 'signatures']

function modulesRead(req, res) {
  try {
    const result = {}
    for (const m of MODULES) {
      result[m] = queries.getAppConfig(`module_${m}`) !== '0' // default enabled
    }
    res.json({ ok: true, data: result })
  } catch {
    // Par defaut tous actifs
    const fallback = {}
    for (const m of MODULES) fallback[m] = true
    res.json({ ok: true, data: fallback })
  }
}

module.exports = { settingsRead, modulesRead }
