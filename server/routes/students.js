// ─── Routes étudiants ────────────────────────────────────────────────────────
const router  = require('express').Router()
const queries = require('../db/index')
const wrap    = require('../utils/wrap')
const { requireRole } = require('../middleware/authorize')

// Liste étudiants : profs voient tout, étudiants uniquement leur promo
router.get('/', wrap((req) => {
  if (req.user?.type === 'student') return queries.getStudents(req.user.promo_id)
  return queries.getAllStudents()
}))
router.get('/stats',               requireRole('teacher'), wrap((req) => queries.getClasseStats(Number(req.query.promoId))))
// Profil : un étudiant ne peut voir que les profils de sa promo
router.get('/:id/profile', (req, res, next) => {
  if (req.user?.type === 'student') {
    const { getDb } = require('../db/connection')
    const target = getDb().prepare('SELECT promo_id FROM students WHERE id = ?').get(Number(req.params.id))
    if (target && target.promo_id !== req.user.promo_id) {
      return res.status(403).json({ ok: false, error: 'Accès non autorisé à ce profil.' })
    }
  }
  next()
}, wrap((req) => queries.getStudentProfile(Number(req.params.id))))
// Devoirs d'un étudiant : seul l'étudiant lui-même ou un prof
router.get('/:id/assignments', (req, res, next) => {
  if (req.user?.type === 'student' && req.user.id !== Number(req.params.id)) {
    return res.status(403).json({ ok: false, error: 'Vous ne pouvez consulter que vos propres devoirs.' })
  }
  next()
}, wrap((req) => queries.getStudentTravaux(Number(req.params.id))))
router.post('/photo', (req, res, next) => {
  if (req.user?.type === 'student' && req.user.id !== req.body.studentId) {
    return res.status(403).json({ ok: false, error: 'Vous ne pouvez modifier que votre propre photo.' })
  }
  next()
}, wrap((req) => queries.updateStudentPhoto(req.body.studentId, req.body.photoData)))
router.post('/bulk-import',        requireRole('teacher'), wrap((req) => queries.bulkImportStudents(req.body.promoId, req.body.rows)))

// ── Onboarding wizard ────────────────────────────────────────────────────────
router.get('/onboarding-status', wrap((req) => {
  if (req.user.type !== 'student') return { done: true } // non-students skip
  return { done: queries.getOnboardingStatus(req.user.id) }
}))

router.post('/complete-onboarding', wrap((req) => {
  if (req.user.type !== 'student') return { done: true }
  queries.completeOnboarding(req.user.id)
  return { done: true }
}))

// ── RGPD Art. 20 — Export des données personnelles ──────────────────────────
router.get('/:id/export', (req, res, next) => {
  // Un étudiant ne peut exporter que ses propres données, un prof peut tout exporter
  if (req.user?.type === 'student' && req.user.id !== Number(req.params.id)) {
    return res.status(403).json({ ok: false, error: 'Vous ne pouvez exporter que vos propres données.' })
  }
  next()
}, (req, res) => {
  try {
    const { getDb } = require('../db/connection')
    const db = getDb()
    const studentId = Number(req.params.id)

    const student = db.prepare(`
      SELECT s.id, s.name, s.email, s.avatar_initials, s.promo_id, p.name AS promo_name
      FROM students s JOIN promotions p ON s.promo_id = p.id WHERE s.id = ?
    `).get(studentId)
    if (!student) return res.status(404).json({ ok: false, error: 'Étudiant introuvable.' })

    const messages = db.prepare(`
      SELECT id, channel_id, dm_student_id, content, created_at, edited
      FROM messages WHERE author_name = ? AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 1000
    `).all(student.name)

    const depots = db.prepare(`
      SELECT d.id, d.travail_id, t.title AS travail_title, d.file_name, d.note, d.feedback, d.submitted_at
      FROM depots d JOIN travaux t ON d.travail_id = t.id WHERE d.student_id = ?
      ORDER BY d.submitted_at DESC
    `).all(studentId)

    const groups = db.prepare(`
      SELECT g.id, g.name FROM group_members gm
      JOIN groups g ON gm.group_id = g.id WHERE gm.student_id = ?
    `).all(studentId)

    const liveResponses = db.prepare(`
      SELECT lr.activity_id, la.title, lr.answer, lr.created_at
      FROM live_responses lr JOIN live_activities la ON lr.activity_id = la.id
      WHERE lr.student_id = ? ORDER BY lr.created_at DESC
    `).all(studentId)

    const signatures = db.prepare(`
      SELECT id, file_name, status, signer_name, signed_at, created_at
      FROM signature_requests WHERE dm_student_id = ?
      ORDER BY created_at DESC
    `).all(studentId)

    const exportData = {
      exported_at: new Date().toISOString(),
      student: { id: student.id, name: student.name, email: student.email, promo: student.promo_name },
      messages: messages.length,
      submissions: depots,
      groups,
      quiz_responses: liveResponses,
      signatures,
      _note: 'Export RGPD Art. 20 — Données personnelles de l\'étudiant. Les contenus de messages sont disponibles mais limités à 1000 entrées.',
    }

    res.setHeader('Content-Disposition', `attachment; filename="export-rgpd-${student.name.replace(/\s+/g, '-')}.json"`)
    res.setHeader('Content-Type', 'application/json')
    res.json({ ok: true, data: exportData })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

module.exports = router
