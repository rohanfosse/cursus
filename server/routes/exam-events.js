// ─── Routes exam-events ──────────────────────────────────────────────────────
// Endpoint qui recoit la timeline des comportements pendant un examen
// surveille (focus_loss, paste_blocked, heartbeat, ...). Cf. model
// db/models/examEvents et table exam_events (migration v95).
//
// Securite :
//   - L'utilisateur authentifie est force comme student_id (un eleve ne
//     peut pas attribuer ses events a un autre).
//   - On verifie que travail_id existe et que exam_mode = 1 ; sinon refus
//     (evite que ces events polluent un devoir normal).
//   - requirePromo : l'eleve doit appartenir a la promo du travail.

const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { getDb } = require('../db/connection')
const { validate } = require('../middleware/validate')
const wrap         = require('../utils/wrap')
const { requirePromo, requireRole } = require('../middleware/authorize')

const eventSchema = z.object({
  travailId: z.number().int().positive(),
  type:      z.enum([
    'exam_start', 'exam_submit', 'exam_timeout',
    'focus_loss', 'paste_blocked', 'heartbeat', 'crash_recovered',
  ]),
  ts:        z.number().int().nonnegative().optional(),
  payload:   z.unknown().optional(),
})

function recordEvent(req) {
  const { travailId, type, ts, payload } = req.body
  const travail = queries.getTravailById(travailId)
  if (!travail) {
    const err = new Error('Devoir introuvable.'); err.status = 404; throw err
  }
  if (!travail.exam_mode) {
    const err = new Error('Devoir non marque comme examen surveille.'); err.status = 400; throw err
  }
  const studentId = req.user?.id
  if (!studentId) {
    const err = new Error('Utilisateur non authentifie.'); err.status = 401; throw err
  }
  queries.addExamEvent({
    travailId,
    studentId,
    type,
    ts: ts ?? Date.now(),
    payload: payload ?? null,
  })
  return { ok: true }
}

// Le travail dicte la promo : on lookup directement (le middleware existant
// promoFromTravail ne lit que req.params, pas req.body).
function promoFromBodyTravail(req) {
  const travailId = Number(req.body?.travailId)
  if (!travailId) return null
  const t = getDb().prepare('SELECT promo_id FROM travaux WHERE id = ?').get(travailId)
  return t?.promo_id ?? null
}

router.post('/',
  validate(eventSchema),
  requirePromo(promoFromBodyTravail),
  wrap(recordEvent),
)

// ── Lecture cote prof (post-mortem) ──────────────────────────────────────
// Restreint aux profs/admins de la promo du travail.

function promoFromQueryTravail(req) {
  const travailId = Number(req.query?.travailId)
  if (!travailId) return null
  const t = getDb().prepare('SELECT promo_id FROM travaux WHERE id = ?').get(travailId)
  return t?.promo_id ?? null
}

function readEvents(req) {
  const travailId = Number(req.query.travailId)
  const studentId = req.query.studentId ? Number(req.query.studentId) : null
  return queries.getExamEvents(travailId, studentId)
}

function readSummary(req) {
  const travailId = Number(req.query.travailId)
  return queries.getExamEventSummary(travailId)
}

router.get('/',
  requireRole('teacher'),
  requirePromo(promoFromQueryTravail),
  wrap(readEvents),
)

router.get('/summary',
  requireRole('teacher'),
  requirePromo(promoFromQueryTravail),
  wrap(readSummary),
)

module.exports = router
