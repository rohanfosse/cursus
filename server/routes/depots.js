// ─── Routes dépôts ────────────────────────────────────────────────────────────
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap         = require('../utils/wrap')
const log          = require('../utils/logger')
const { requirePromo, promoFromTravail } = require('../middleware/authorize')

/** Émet une notification grade:new à l'étudiant concerné. */
function emitGradeNotification(req, { note, feedback }) {
  try {
    const io = req.app.get('io')
    if (!io) return
    const { getDb } = require('../db/connection')
    const depotId = req.body.depotId ?? req.body.depot_id
    if (depotId == null) return
    const depot = getDb().prepare(`
      SELECT d.student_id, d.travail_id, t.title AS devoir_title, t.category, t.type AS devoir_type
      FROM depots d JOIN travaux t ON d.travail_id = t.id
      WHERE d.id = ?
    `).get(depotId)
    if (depot) {
      io.to(`user:${depot.student_id}`).emit('grade:new', {
        devoirTitle: depot.devoir_title,
        note: note ?? null,
        feedback: feedback ?? null,
        devoirId: depot.travail_id,
        category: depot.category || depot.devoir_type,
      })
    }
  } catch (emitErr) { log.warn('grade_notification_failed', { error: emitErr.message }) }
}

const MAX_DEPOT_CONTENT = 2000

/**
 * Valide que le contenu d un depot est acceptable :
 * - file : chemin relatif /uploads/... (pas d absolu, pas de traversal)
 * - link : URL http/https uniquement (pas de javascript:, data:, file:)
 */
function validateDepotContent(type, content) {
  if (type === 'link') {
    let url
    try { url = new URL(content) } catch { return 'URL invalide' }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'Seules les URLs http(s) sont autorisees'
    }
    return null
  }
  if (type === 'file') {
    if (content.includes('..')) return 'Chemin de fichier invalide'
    if (content.includes('\0')) return 'Chemin de fichier invalide'
    // Refuse les chemins absolus Windows (C:\, D:/) et les chemins UNC (\\server\share)
    if (/^[a-zA-Z]:[\\\/]/.test(content)) return 'Chemin de fichier invalide'
    if (content.startsWith('\\\\'))       return 'Chemin de fichier invalide'
    // Refuse les chemins absolus systeme Unix (/etc, /root, /var, /proc, /sys,
    // /usr, /srv, /home, macOS /Users, /private). Autorise /uploads/... qui
    // est la convention des fichiers servis via /api/files/upload.
    if (content.startsWith('/') && !content.startsWith('/uploads/')) {
      return 'Chemin de fichier invalide'
    }
    return null
  }
  return null
}

const submitDepotSchema = z.object({
  travail_id: z.number().int().positive('Devoir invalide'),
  student_id: z.number().int().optional(),
  studentId:  z.number().int().optional(),
  type:       z.enum(['file', 'link'], { message: 'Type de dépôt invalide (file ou link)' }),
  content:    z.string().min(1, 'Contenu du dépôt requis').max(MAX_DEPOT_CONTENT, 'Contenu du dépôt trop long'),
  file_name:  z.string().max(255).nullable().optional(),
  link_url:   z.string().max(MAX_DEPOT_CONTENT).nullable().optional(),
  deploy_url: z.string().max(MAX_DEPOT_CONTENT).nullable().optional(),
}).passthrough().refine(d => validateDepotContent(d.type, d.content) === null, d => ({
  message: validateDepotContent(d.type, d.content) ?? 'Contenu invalide',
  path: ['content'],
}))

// Accepte depotId (client actuel) OU depot_id (legacy + tests backend).
// Le model submissions.js lit depotId, donc on normalise ici.
const noteSchema = z.object({
  depotId:  z.number().int().positive().optional(),
  depot_id: z.number().int().positive().optional(),
  note:     z.string().max(10).nullable(),
}).refine(d => (d.depotId ?? d.depot_id) != null, { message: 'Dépôt invalide', path: ['depotId'] })

const feedbackSchema = z.object({
  depotId:  z.number().int().positive().optional(),
  depot_id: z.number().int().positive().optional(),
  feedback: z.string().max(5000, 'Feedback trop long (max 5 000 caractères)').nullable(),
}).refine(d => (d.depotId ?? d.depot_id) != null, { message: 'Dépôt invalide', path: ['depotId'] })

function normalizeDepotId(body) {
  return body.depotId ?? body.depot_id
}

router.get('/',         requirePromo(promoFromTravail), wrap((req) => {
  const depots = queries.getDepots(Number(req.query.travailId))
  if (req.user.type === 'student') {
    return depots.filter(d => d.student_id === req.user.id)
  }
  return depots
}))

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
    return res.status(403).json({ ok: false, error: 'Seuls les responsables peuvent attribuer des notes.' })
  }
  try {
    const depotId = normalizeDepotId(req.body)
    const { getDb } = require('../db/connection')
    // Idempotence : si la note est deja identique (double-click prof), on
    // court-circuite la notif socket (evite spam 2x student) mais on renvoie
    // 200 pour que le client traite comme un succes.
    const existing = getDb().prepare('SELECT note FROM depots WHERE id = ?').get(depotId)
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Dépôt introuvable.' })
    }
    if (existing.note === req.body.note) {
      return res.json({ ok: true, data: { changes: 0, unchanged: true } })
    }
    const result = queries.setNote({ depotId, note: req.body.note })
    emitGradeNotification(req, { note: req.body.note })
    res.json({ ok: true, data: result })
  }
  catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})
router.post('/feedback', validate(feedbackSchema), (req, res) => {
  if (req.user.type === 'student') {
    return res.status(403).json({ ok: false, error: 'Seuls les responsables peuvent donner un feedback.' })
  }
  try {
    const depotId = normalizeDepotId(req.body)
    const { getDb } = require('../db/connection')
    const existing = getDb().prepare('SELECT feedback FROM depots WHERE id = ?').get(depotId)
    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Dépôt introuvable.' })
    }
    if (existing.feedback === req.body.feedback) {
      return res.json({ ok: true, data: { changes: 0, unchanged: true } })
    }
    const result = queries.setFeedback({ depotId, feedback: req.body.feedback })
    emitGradeNotification(req, { feedback: req.body.feedback })
    res.json({ ok: true, data: result })
  }
  catch (err) { res.status(400).json({ ok: false, error: err.message }) }
})

module.exports = router
