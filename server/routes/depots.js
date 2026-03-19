// ─── Routes dépôts ────────────────────────────────────────────────────────────
const router  = require('express').Router()
const queries = require('../../src/db/index')

function wrap(fn) {
  return (req, res) => {
    try { res.json({ ok: true, data: fn(req) }) }
    catch (err) { res.status(400).json({ ok: false, error: err.message }) }
  }
}

router.get('/',         wrap((req) => queries.getDepots(Number(req.query.travailId))))

// Soumission de dépôt — vérifier que l'étudiant soumet pour lui-même
router.post('/', (req, res) => {
  try {
    const payload = req.body
    const studentId = payload.student_id ?? payload.studentId
    // Un étudiant ne peut soumettre que pour lui-même
    if (req.user.type === 'student' && studentId !== req.user.id) {
      return res.status(403).json({ ok: false, error: 'Vous ne pouvez soumettre que pour votre propre compte.' })
    }
    res.json({ ok: true, data: queries.addDepot(payload) })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

// Note et feedback — réservés aux enseignants
router.post('/note', (req, res) => {
  if (req.user.type === 'student') {
    return res.status(403).json({ ok: false, error: 'Seuls les enseignants peuvent attribuer des notes.' })
  }
  try { res.json({ ok: true, data: queries.setNote(req.body) }) }
  catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})
router.post('/feedback', (req, res) => {
  if (req.user.type === 'student') {
    return res.status(403).json({ ok: false, error: 'Seuls les enseignants peuvent donner un feedback.' })
  }
  try { res.json({ ok: true, data: queries.setFeedback(req.body) }) }
  catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

module.exports = router
