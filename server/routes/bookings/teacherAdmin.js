/**
 * Routes Booking admin enseignant :
 *   event-types CRUD, availability rules, overrides, tokens, my-bookings.
 * Toutes ces routes requierent requireRole('teacher').
 */
const router = require('express').Router()
const { z }  = require('zod')
const crypto = require('crypto')
const queries = require('../../db/index')
const { validate } = require('../../middleware/validate')
const wrap    = require('../../utils/wrap')
const { requireRole } = require('../../middleware/authorize')
const { ForbiddenError, ValidationError } = require('../../utils/errors')
const { SERVER_URL } = require('./_shared')

/** Genere un slug derive en y collant un suffixe hex de 5 chars. */
function lengthenSlugForPublic(baseSlug) {
  const suffix = crypto.randomBytes(3).toString('hex').slice(0, 5)
  return `${baseSlug}-${suffix}`
}

/** Heuristique : un slug deja allonge porte un suffixe `-XXXXX` final hex. */
const RANDOMIZED_SLUG_RE = /-[0-9a-f]{5}$/

/**
 * A l'activation de is_public, on rallonge SYSTEMATIQUEMENT le slug avec un
 * suffixe aleatoire — sauf s'il en a deja un (rejeu d'activation). Defense
 * contre l'enumeration : meme un slug "cesi-rohan" devient "cesi-rohan-a3f2c"
 * inscrutable. Modifie `fields.slug` en place pour que l'UPDATE le persiste.
 */
function ensurePublicSlug(currentSlug, fields) {
  const wantsPublic = fields.is_public === 1 || fields.is_public === true
  if (!wantsPublic) return currentSlug
  if (currentSlug && RANDOMIZED_SLUG_RE.test(currentSlug)) return currentSlug
  for (let i = 0; i < 5; i++) {
    const candidate = lengthenSlugForPublic(currentSlug || 'rdv')
    if (!queries.getEventTypeBySlug(candidate)) {
      fields.slug = candidate
      return candidate
    }
  }
  throw new ValidationError('Impossible de generer un slug public unique')
}

// ── Schemas ────────────────────────────────────────────────────────────

// Validateur URL HTTPS-only — z.string().url() autorise javascript:/data:,
// donc on ajoute un refine pour bloquer ces schemes des l'entree.
// Preprocesseur : "" / null / undefined -> undefined (skip la validation).
const httpUrl = z.preprocess(
  v => (v == null || v === '' ? undefined : v),
  z.string().url().refine(
    v => /^https?:\/\//i.test(v),
    { message: 'URL doit commencer par http:// ou https://' },
  ),
)

const createEventTypeSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  description: z.string().max(1000).optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  color: z.string().max(20).regex(/^#[0-9a-fA-F]{3,8}$/).optional(),
  fallbackVisioUrl: httpUrl.optional().nullable(),
  bufferMinutes: z.number().int().min(0).max(60).optional(),
  timezone: z.string().max(50).optional(),
  isPublic: z.boolean().optional(),
})
// .partial() laisse passer les champs additionnels (zod n'est pas strict par
// defaut). Le modele filtre ensuite via une liste blanche (is_active, is_public...)
// donc le client peut envoyer directement les noms snake_case.
const updateEventTypeSchema = createEventTypeSchema.partial()

const availabilitySchema = z.object({
  rules: z.array(z.object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime:   z.string().regex(/^\d{2}:\d{2}$/),
  })).refine(
    rules => rules.every(r => r.startTime < r.endTime),
    { message: 'startTime doit etre avant endTime' },
  ),
})

const bulkTokensSchema = z.object({
  eventTypeId: z.number().int().positive(),
  promoId:     z.number().int().positive(),
})

// ── Event Types ────────────────────────────────────────────────────────

router.get('/event-types', requireRole('teacher'), wrap((req) => {
  return queries.getEventTypes(req.user.id)
}))

router.post('/event-types', requireRole('teacher'), validate(createEventTypeSchema), wrap((req) => {
  return queries.createEventType({ teacherId: req.user.id, ...req.body })
}))

router.patch('/event-types/:id', requireRole('teacher'), validate(updateEventTypeSchema), wrap((req) => {
  const et = queries.getEventTypeById(Number(req.params.id))
  if (!et || et.teacher_id !== req.user.id) throw new ForbiddenError()
  // Si le prof active is_public, garantit un slug long (anti-enumeration).
  // Mute req.body en place pour forcer le nouveau slug dans l'UPDATE.
  ensurePublicSlug(et.slug, req.body)
  return queries.updateEventType(Number(req.params.id), req.body)
}))

router.delete('/event-types/:id', requireRole('teacher'), wrap((req) => {
  const et = queries.getEventTypeById(Number(req.params.id))
  if (!et || et.teacher_id !== req.user.id) throw new ForbiddenError()
  queries.deleteEventType(Number(req.params.id))
  return null
}))

// Renvoie l'URL publique pour un event-type (ne necessite pas que is_public
// soit deja active — pratique pour previewer l'URL avant activation).
router.get('/event-types/:id/public-link', requireRole('teacher'), wrap((req) => {
  const et = queries.getEventTypeById(Number(req.params.id))
  if (!et || et.teacher_id !== req.user.id) throw new ForbiddenError()
  return {
    publicUrl: `${SERVER_URL}/#/book/e/${et.slug}`,
    isPublic: !!et.is_public,
    isActive: !!et.is_active,
    slug: et.slug,
  }
}))

// ── Availability Rules ─────────────────────────────────────────────────

router.get('/availability', requireRole('teacher'), wrap((req) => {
  return queries.getAvailabilityRules(req.user.id)
}))

router.put('/availability', requireRole('teacher'), validate(availabilitySchema), wrap((req) => {
  return queries.setAvailabilityRules(req.user.id, req.body.rules)
}))

// ── Availability Overrides ─────────────────────────────────────────────

router.get('/event-types/:id/overrides', requireRole('teacher'), wrap((req) => {
  const et = queries.getEventTypeById(Number(req.params.id))
  if (!et || et.teacher_id !== req.user.id) throw new ForbiddenError()
  return queries.getAvailabilityOverrides(et.id)
}))

router.put('/event-types/:id/overrides', requireRole('teacher'), wrap((req) => {
  const et = queries.getEventTypeById(Number(req.params.id))
  if (!et || et.teacher_id !== req.user.id) throw new ForbiddenError()
  const overrides = req.body.overrides || []
  return queries.setAvailabilityOverrides(et.id, overrides)
}))

// ── Booking Tokens ─────────────────────────────────────────────────────

router.post('/tokens', requireRole('teacher'), wrap((req) => {
  const { eventTypeId, studentId } = req.body
  if (!eventTypeId || !studentId) throw new ValidationError('eventTypeId et studentId requis')
  const et = queries.getEventTypeById(eventTypeId)
  if (!et || et.teacher_id !== req.user.id) throw new ForbiddenError()
  const tokenData = queries.getOrCreateToken(eventTypeId, studentId)
  return { ...tokenData, bookingUrl: `${SERVER_URL}/#/book/${tokenData.token}` }
}))

router.post('/tokens/bulk', requireRole('teacher'), validate(bulkTokensSchema), wrap((req) => {
  const { eventTypeId, promoId } = req.body
  const et = queries.getEventTypeById(eventTypeId)
  if (!et || et.teacher_id !== req.user.id) throw new ForbiddenError()
  const students = queries.getStudents(promoId)
  return students.map(s => {
    const tokenData = queries.getOrCreateToken(eventTypeId, s.id)
    return {
      studentId: s.id,
      studentName: s.name,
      bookingUrl: `${SERVER_URL}/#/book/${tokenData.token}`,
    }
  })
}))

// ── My Bookings ────────────────────────────────────────────────────────

router.get('/my-bookings', requireRole('teacher'), wrap((req) => {
  const from = req.query.from && !isNaN(Date.parse(req.query.from)) ? req.query.from : undefined
  const to   = req.query.to   && !isNaN(Date.parse(req.query.to))   ? req.query.to   : undefined
  // Transforme le shape DB (start_datetime ISO + event_title) vers le shape
  // attendu par le frontend (date YYYY-MM-DD + start_time HH:MM:SS +
  // event_type_title). Sans cette projection, sortedBookings.value cote
  // composable expose `bk.date` undefined → cards "Invalid Date" partout.
  return queries.getBookingsForTeacher(req.user.id, { from, to }).map(bk => {
    const start = new Date(bk.start_datetime)
    const end   = new Date(bk.end_datetime)
    const pad = (n) => String(n).padStart(2, '0')
    const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    const isoTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    return {
      ...bk,
      date:                isoDate(start),
      start_time:          isoTime(start),
      end_time:            isoTime(end),
      event_type_title:    bk.event_title,
      visio_url:           bk.teams_join_url || null,
    }
  })
}))

// ── Creation directe (style Outlook) ───────────────────────────────────
//
// Le prof cree un RDV pour 1+ etudiants sans passer par le flow
// public-token (pas d'email d'invite, pas de tutorEmail requis). Cas
// d'usage : ajouter un creneau a l'arrache depuis la sidebar ou en
// cliquant sur la grille calendrier.
//
// Si plusieurs studentIds sont fournis, on cree une serie de bookings
// au meme creneau (utile pour reservation en groupe), un par etudiant,
// dans une seule transaction. Si un seul slot conflict avec un booking
// existant, la transaction est annulee et on remonte 409.

const createDirectSchema = z.object({
  eventTypeId:    z.number().int().positive(),
  studentIds:     z.array(z.number().int().positive()).min(1).max(40),
  startDatetime:  z.string().refine(v => !isNaN(Date.parse(v)), { message: 'startDatetime invalide' }),
  durationMinutes: z.number().int().min(5).max(480).optional(),
}).strict()

const MAX_DIRECT_BOOKING_HORIZON_DAYS = 365

router.post('/direct', requireRole('teacher'), validate(createDirectSchema), wrap((req) => {
  const { eventTypeId, studentIds, startDatetime, durationMinutes } = req.body

  const eventType = queries.getEventTypeById(eventTypeId)
  if (!eventType) throw new ValidationError('Type de RDV introuvable')
  if (eventType.teacher_id !== req.user.id) throw new ForbiddenError()

  const startMs = new Date(startDatetime).getTime()
  const now = Date.now()
  if (Number.isNaN(startMs)) throw new ValidationError('startDatetime invalide')
  if (startMs > now + MAX_DIRECT_BOOKING_HORIZON_DAYS * 24 * 3600000) {
    throw new ValidationError('Le creneau est trop eloigne dans le futur')
  }

  // Recharge les students en bloc — evite N requetes pour 1..40 students.
  const { getDb } = require('../../db/connection')
  const placeholders = studentIds.map(() => '?').join(',')
  const studentsRows = getDb().prepare(
    `SELECT id, name, email FROM students WHERE id IN (${placeholders})`
  ).all(...studentIds)
  const studentsById = new Map(studentsRows.map(s => [s.id, s]))

  const duration = durationMinutes ?? eventType.duration_minutes
  const endDatetime = new Date(startMs + duration * 60000).toISOString()

  // Cree un booking par etudiant. createBookingAtomic est TOCTOU-safe.
  // Si un seul des slots conflicte, on continue : a la fin on remonte
  // un mix `created` + `skipped` pour que l'UI montre le delta.
  const created = []
  const skipped = []
  for (const studentId of studentIds) {
    const student = studentsById.get(studentId)
    if (!student) {
      skipped.push({ studentId, studentName: `#${studentId}`, reason: 'not_found' })
      continue
    }
    const booking = queries.createBookingAtomic({
      eventTypeId,
      studentId,
      teacherId: req.user.id,
      // tutor_* champs NOT NULL en schema : la "creation directe" n'a
      // pas de tuteur tiers, on reuse les coordonnees de l'etudiant
      // pour satisfaire la contrainte sans introduire de migration.
      tutorName:  student.name,
      tutorEmail: student.email,
      startDatetime,
      endDatetime,
      bufferMinutes: eventType.buffer_minutes || 0,
    })
    if (booking) {
      created.push({ id: booking.id, studentId, studentName: student.name })
    } else {
      skipped.push({ studentId, studentName: student.name, reason: 'conflict' })
    }
  }

  if (created.length === 0) {
    // Tous les creneaux ont ete rejetes : on rend 409 plutot que ok:true
    // avec une liste vide, pour que l'UI sache qu'il faut reessayer.
    const err = new ValidationError('Le creneau est deja pris pour tous les etudiants selectionnes')
    err.statusCode = 409
    throw err
  }

  // Notifie en temps reel (1 event par booking cree, comme la route public)
  const io = req.app.get('io')
  if (io) {
    for (const c of created) {
      io.to(`user:${req.user.id}`).emit('booking:new', {
        bookingId: c.id,
        tutorName: c.studentName,
        studentName: c.studentName,
        eventTitle: eventType.title,
        startDatetime,
      })
    }
  }

  return { created, skipped, eventTypeTitle: eventType.title }
}))

module.exports = router
