/**
 * Route admin - Lecture config (accessible aux responsables, pas seulement admin)
 * Separe de settings.js car GET /config doit etre accessible aux teachers
 * pour afficher le bandeau mode lecture seule.
 */
const queries = require('../../db/index')
const { MODULE_KEYS, MODULE_META } = require('../../constants/modules')

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
function modulesRead(req, res) {
  try {
    const result = {}
    for (const m of MODULE_KEYS) {
      result[m] = queries.getAppConfig(`module_${m}`) !== '0' // default enabled
    }
    res.json({ ok: true, data: result })
  } catch {
    // Par defaut tous actifs
    const fallback = {}
    for (const m of MODULE_KEYS) fallback[m] = true
    res.json({ ok: true, data: fallback })
  }
}

/** GET /api/admin/modules/meta — labels + descriptions pour l'UI admin */
function modulesMetaRead(req, res) {
  res.json({ ok: true, data: MODULE_META })
}

module.exports = { settingsRead, modulesRead, modulesMetaRead }
