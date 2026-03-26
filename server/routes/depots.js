// ─── Routes dépôts ────────────────────────────────────────────────────────────
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap         = require('../utils/wrap')
const { requirePromo, promoFromTravail } = require('../middleware/authorize')

const submitDepotSchema = z.object({
  travail_id: z.number().int().positive('Devoir invalide'),
  student_id: z.number().int().optional(),
  studentId:  z.number().int().optional(),
  type:       z.enum(['file', 'link'], { message: 'Type de dépôt invalide (file ou link)' }),
  content:    z.string().min(1, 'Contenu du dépôt requis'),
  file_name:  z.string().nullable().optional(),
  link_url:   z.string().nullable().optional(),
  deploy_url: z.string().nullable().optional(),
}).passthrough()

const noteSchema = z.object({
  depot_id: z.number().int().positive('Dépôt invalide'),
  note:     z.string().min(1, 'Note requise').max(10),
})

const feedbackSchema = z.object({
  depot_id: z.number().int().positive('Dépôt invalide'),
  feedback: z.string().max(5000, 'Feedback trop long (max 5 000 caractères)'),
})

router.get('/',         requirePromo(promoFromTravail), wrap((req) => queries.getDepots(Number(req.query.travailId))))

// Soumission de dépôt - vérifier que l'étudiant soumet pour lui-même
router.post('/', validate(submitDepotSchema), (req, res) => {
  try {
    const payload = req.body
    const studentId = payload.student_id ?? payload.studentId
    // Un étudiant ne peut soumettre que pour lui-même
    if (req.user.type === 'student' && studentId !== req.user.id) {
      return res.status(403).json({ ok: false, error: 'Vous ne pouvez soumettre que pour votre propre compte.' })
    }
    // Vérifier que le devoir appartient à la promo de l'étudiant
    if (req.user.type === 'student') {
      const { getDb } = require('../db/connection')
      const travail = getDb().prepare('SELECT promo_id FROM travaux WHERE id = ?').get(payload.travail_id)
      if (travail && travail.promo_id !== req.user.promo_id) {
        return res.status(403).json({ ok: false, error: 'Ce devoir n\'appartient pas à votre promotion.' })
      }
    }
    res.json({ ok: true, data: queries.addDepot(payload) })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

// Note et feedback - réservés aux enseignants
router.post('/note', validate(noteSchema), (req, res) => {
  if (req.user.type === 'student') {
    return res.status(403).json({ ok: false, error: 'Seuls les pilotes peuvent attribuer des notes.' })
  }
  try {
    const result = queries.setNote(req.body)
    // Émettre une notification grade:new à l'étudiant concerné
    try {
      const io = req.app.get('io')
      if (io) {
        const { getDb } = require('../db/connection')
        const depot = getDb().prepare(`
          SELECT d.student_id, d.travail_id, t.title AS devoir_title, t.category, t.type AS devoir_type
          FROM depots d JOIN travaux t ON d.travail_id = t.id
          WHERE d.id = ?
        `).get(req.body.depot_id)
        if (depot) {
          io.to(`user:${depot.student_id}`).emit('grade:new', {
            devoirTitle: depot.devoir_title,
            note: req.body.note,
            feedback: null,
            devoirId: depot.travail_id,
            category: depot.category || depot.devoir_type,
          })
        }
      }
    } catch (emitErr) { console.warn('[grade:new] Erreur émission socket:', emitErr.message) }
    res.json({ ok: true, data: result })
  }
  catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})
router.post('/feedback', validate(feedbackSchema), (req, res) => {
  if (req.user.type === 'student') {
    return res.status(403).json({ ok: false, error: 'Seuls les pilotes peuvent donner un feedback.' })
  }
  try {
    const result = queries.setFeedback(req.body)
    // Émettre une notification grade:new à l'étudiant concerné
    try {
      const io = req.app.get('io')
      if (io) {
        const { getDb } = require('../db/connection')
        const depot = getDb().prepare(`
          SELECT d.student_id, d.travail_id, t.title AS devoir_title, t.category, t.type AS devoir_type
          FROM depots d JOIN travaux t ON d.travail_id = t.id
          WHERE d.id = ?
        `).get(req.body.depot_id)
        if (depot) {
          io.to(`user:${depot.student_id}`).emit('grade:new', {
            devoirTitle: depot.devoir_title,
            note: null,
            feedback: req.body.feedback,
            devoirId: depot.travail_id,
            category: depot.category || depot.devoir_type,
          })
        }
      }
    } catch (emitErr) { console.warn('[grade:new] Erreur émission socket:', emitErr.message) }
    res.json({ ok: true, data: result })
  }
  catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

module.exports = router
