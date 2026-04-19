/**
 * Route admin - Lecture config (accessible aux responsables, pas seulement admin)
 * Separe de settings.js car GET /config doit etre accessible aux teachers
 * pour afficher le bandeau mode lecture seule.
 */
const queries = require('../../db/index')
const { MODULE_KEYS, MODULE_META } = require('../../constants/modules')

/**
 * Modules opt-in : DESACTIVES tant que l'admin n'a pas explicitement mis
 * '1'. Par defaut on ne les affiche pas (gestion prudente des nouvelles
 * features a rollout optionnel par promo CESI).
 */
const OPT_IN_MODULES = new Set(['games'])

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
      const raw = queries.getAppConfig(`module_${m}`)
      result[m] = OPT_IN_MODULES.has(m)
        ? raw === '1'    // opt-in : desactive tant que pas '1'
        : raw !== '0'    // default : active sauf si '0' explicite
    }
    res.json({ ok: true, data: result })
  } catch {
    const fallback = {}
    for (const m of MODULE_KEYS) fallback[m] = !OPT_IN_MODULES.has(m)
    res.json({ ok: true, data: fallback })
  }
}

/** GET /api/admin/modules/meta — labels + descriptions pour l'UI admin */
function modulesMetaRead(req, res) {
  res.json({ ok: true, data: MODULE_META })
}

module.exports = { settingsRead, modulesRead, modulesMetaRead }
