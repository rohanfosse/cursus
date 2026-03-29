// ─── Route error reporting (monitoring interne) ───────────────────────────────
const router = require('express').Router()
const { reportError } = require('../db/models/admin')

// POST /api/report-error — public (auth optionnelle, le frontend peut reporter avant login)
router.post('/', (req, res) => {
  try {
    const { page, message, stack, appVersion } = req.body
    if (!message) return res.status(400).json({ ok: false, error: 'message requis' })
    reportError({
      userId: req.user?.id ?? null,
      userName: req.user?.name ?? null,
      userType: req.user?.type ?? null,
      page,
      message: String(message).substring(0, 2000),
      stack: stack ? String(stack).substring(0, 5000) : null,
      userAgent: req.get('user-agent') || null,
      appVersion: appVersion ?? null,
    })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Erreur interne' })
  }
})

module.exports = router
