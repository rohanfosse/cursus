/**
 * Routes admin - Statistiques applicatives et heatmap
 */
const router  = require('express').Router()
const queries = require('../../db/index')
const { getDb } = require('../../db/connection')
const { isSystemAdmin } = require('../../permissions')

router.get('/stats', (req, res) => {
  try {
    // Enseignant non-admin : filtrer par ses promos
    let promoIds = null
    if (!isSystemAdmin(req.user?.type)) {
      const teacherId = Math.abs(req.user.id)
      promoIds = getDb()
        .prepare('SELECT promo_id FROM teacher_promos WHERE teacher_id = ?')
        .all(teacherId)
        .map(r => r.promo_id)
    }
    const stats = queries.getAdminStats(promoIds)
    res.json({ ok: true, data: stats })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.get('/heatmap', (req, res) => {
  try {
    const data = queries.getActivityHeatmap()
    res.json({ ok: true, data })
  } catch {
    res.json({ ok: true, data: [] })
  }
})

router.get('/visits', (req, res) => {
  try {
    const data = queries.getVisitStats()
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── Metriques d'adoption ────────────────────────────────────────────────────

router.get('/adoption', (req, res) => {
  try {
    const data = queries.getAdoptionMetrics()
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.get('/last-seen', (req, res) => {
  try {
    const data = queries.getLastSeenPerStudent()
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.get('/inactive', (req, res) => {
  try {
    const days = Math.max(1, Math.min(90, Number(req.query.days) || 7))
    const data = queries.getInactiveStudents(days)
    res.json({ ok: true, data })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── Error reports (monitoring interne) ──────────────────────────────────────

router.get('/error-reports', (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 50, 200)
    const offset = parseInt(req.query.offset) || 0
    // Filtres optionnels (cf. migration v94 : source/level/since).
    // source : 'frontend' | 'server' | 'uncaught' | 'rejection' | 'boot'
    // level  : 'warn' | 'error' | 'fatal'
    // since  : ISO date string ou 'YYYY-MM-DD' (created_at >= since)
    const source = req.query.source || null
    const level  = req.query.level  || null
    const since  = req.query.since  || null
    const { getErrorReports, getErrorReportsCount } = require('../../db/models/admin')
    const items = getErrorReports({ limit, offset, source, level, since })
    const total = getErrorReportsCount({ source, level, since })
    res.json({ ok: true, data: { items, total } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Stats agreges 24h par source/level — pour le dashboard "sante pilote".
router.get('/error-reports/stats', (req, res) => {
  try {
    const { getErrorReportsStats } = require('../../db/models/admin')
    res.json({ ok: true, data: getErrorReportsStats() })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Boot errors flat file — accessible sans DB (utile si la DB elle-meme
// fait crasher le boot, le fichier reste lisible). Path derive de DB_PATH.
router.get('/boot-errors', (req, res) => {
  try {
    if (!isSystemAdmin(req.user?.type)) {
      return res.status(403).json({ ok: false, error: 'Accès réservé aux administrateurs.' })
    }
    const fs = require('fs')
    const path = require('path')
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../../data/db/cursus.db')
    const logFile = path.join(path.dirname(dbPath), 'boot-errors.log')
    if (!fs.existsSync(logFile)) return res.json({ ok: true, data: { entries: [], message: 'Pas de boot failures enregistrees.' } })
    const raw = fs.readFileSync(logFile, 'utf8')
    const entries = raw.split('\n').filter(Boolean).slice(-200).map(line => {
      try { return JSON.parse(line) } catch { return { raw: line } }
    })
    res.json({ ok: true, data: { entries, total: entries.length } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

router.delete('/error-reports', (req, res) => {
  try {
    if (!isSystemAdmin(req.user?.type)) {
      return res.status(403).json({ ok: false, error: 'Accès réservé aux administrateurs.' })
    }
    const { clearErrorReports } = require('../../db/models/admin')
    clearErrorReports()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

module.exports = router
