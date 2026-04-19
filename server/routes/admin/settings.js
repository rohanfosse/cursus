/**
 * Routes admin - Parametres systeme (ecriture config, archivage promos)
 * Note : GET /config est monte separement dans index.js (accessible aux teachers)
 */
const router  = require('express').Router()
const queries = require('../../db/index')
const { MODULE_KEYS } = require('../../constants/modules')

router.post('/config', (req, res) => {
  try {
    const { key, value } = req.body
    const allowed = ['read_only']
    if (!allowed.includes(key)) return res.status(400).json({ ok: false, error: 'Clé non autorisée.' })
    queries.setAppConfig(key, value)
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// POST /api/admin/modules — activer/desactiver un module enrichissement
router.post('/modules', (req, res) => {
  try {
    const { module: moduleName, enabled } = req.body
    if (!MODULE_KEYS.includes(moduleName)) {
      return res.status(400).json({ ok: false, error: 'Module inconnu.' })
    }
    queries.setAppConfig(`module_${moduleName}`, enabled ? '1' : '0')
    res.json({ ok: true, data: { [moduleName]: !!enabled } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.post('/promos/:id/archive', (req, res) => {
  try {
    const { archived } = req.body
    queries.togglePromoArchive(Number(req.params.id), archived)
    res.json({ ok: true, data: null })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

module.exports = router
