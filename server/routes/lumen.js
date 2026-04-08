/** Routes API Lumen — cours markdown publies par les enseignants. */
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap    = require('../utils/wrap')
const { requireRole, requirePromo, requirePromoAdmin, promoFromParam } = require('../middleware/authorize')
const { getDb } = require('../db/connection')

// ─── Schemas Zod (strict : refuse les champs inconnus) ──────────────────────

const createCourseSchema = z.object({
  promoId:   z.number().int().positive('promoId requis'),
  projectId: z.number().int().positive().nullable().optional(),
  title:     z.string().min(1, 'Titre requis').max(200),
  summary:   z.string().max(500).optional(),
  content:   z.string().max(200_000).optional(),
}).strict()

const updateCourseSchema = z.object({
  title:     z.string().min(1).max(200).optional(),
  summary:   z.string().max(500).optional(),
  content:   z.string().max(200_000).optional(),
  projectId: z.number().int().positive().nullable().optional(),
}).strict()

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Lookup : courseId → promo_id (pour requirePromo) */
function promoFromCourse(req) {
  const id = Number(req.params.id)
  if (!id) return null
  const c = getDb().prepare('SELECT promo_id FROM lumen_courses WHERE id = ?').get(id)
  return c?.promo_id ?? null
}

/** Lookup : promoId depuis le body (pour requirePromoAdmin sur POST /courses) */
function promoFromBody(req) {
  return Number(req.body?.promoId) || null
}

/** Normalisation : les JWT enseignants stockent id en negatif. */
function getTeacherIdFromReq(req) {
  return Math.abs(req.user.id)
}

/** requirePromoAdmin uniquement pour les teachers ; passe pour les students. */
function teacherPromoGuard(getPromoId) {
  const inner = requirePromoAdmin(getPromoId)
  return (req, res, next) => {
    if (req.user?.type === 'student') return next()
    return inner(req, res, next)
  }
}

/** Verifie que le user enseignant est l'auteur du cours OU admin. */
function requireCourseOwner(req, res, next) {
  if (req.user?.type === 'admin') return next()
  if (req.user?.type !== 'teacher') {
    return res.status(403).json({ ok: false, error: 'Accès réservé aux enseignants.' })
  }
  const id = Number(req.params.id)
  if (!id) return res.status(400).json({ ok: false, error: 'ID cours manquant.' })
  const course = getDb().prepare('SELECT teacher_id FROM lumen_courses WHERE id = ?').get(id)
  if (!course) return res.status(404).json({ ok: false, error: 'Cours introuvable.' })
  if (course.teacher_id !== getTeacherIdFromReq(req)) {
    return res.status(403).json({ ok: false, error: 'Vous n\'êtes pas l\'auteur de ce cours.' })
  }
  next()
}

// ─── Liste des cours ─────────────────────────────────────────────────────────

// GET /api/lumen/courses/promo/:promoId — liste les cours d'une promo
// Student : uniquement sa promo (requirePromo) + filtre publies
// Teacher : uniquement ses promos affectees (requirePromoAdmin) + drafts + publies
router.get('/courses/promo/:promoId',
  requirePromo(promoFromParam),
  teacherPromoGuard(promoFromParam),
  wrap((req) => {
    const promoId = Number(req.params.promoId)
    const onlyPublished = req.user?.type === 'student'
    return queries.getLumenCoursesForPromo(promoId, { onlyPublished })
  })
)

// GET /api/lumen/courses/:id — recuperer un cours complet (avec content markdown)
// Etudiant : uniquement si publie et meme promo
router.get('/courses/:id',
  requirePromo(promoFromCourse),
  teacherPromoGuard(promoFromCourse),
  wrap((req) => {
    const id = Number(req.params.id)
    const course = queries.getLumenCourse(id)
    if (!course) {
      const err = new Error('Cours introuvable')
      err.statusCode = 404
      throw err
    }
    if (req.user?.type === 'student' && course.status !== 'published') {
      const err = new Error('Cours non publié')
      err.statusCode = 404
      throw err
    }
    return course
  })
)

// ─── Mutations (enseignants uniquement) ──────────────────────────────────────

// POST /api/lumen/courses — creer un cours (draft)
// requirePromoAdmin verifie que le teacher appartient bien a la promo cible
router.post('/courses',
  requireRole('teacher'),
  validate(createCourseSchema),
  teacherPromoGuard(promoFromBody),
  wrap((req) => {
    const { promoId, projectId = null, title, summary = '', content = '' } = req.body
    return queries.createLumenCourse({
      teacherId: getTeacherIdFromReq(req),
      promoId, projectId, title, summary, content,
    })
  })
)

// PATCH /api/lumen/courses/:id — modifier un cours
router.patch('/courses/:id', requireCourseOwner, validate(updateCourseSchema), wrap((req) => {
  const id = Number(req.params.id)
  return queries.updateLumenCourse(id, req.body)
}))

// POST /api/lumen/courses/:id/publish — publier un cours
// A la PREMIERE publication (published_at etait NULL), poste un message
// systeme dans le canal du projet associe (si projet et channel definis)
// et emet un evenement socket pour rafraichir les compteurs cote clients.
// En cas d'echec du side-effect, la publication reste valide (best-effort).
router.post('/courses/:id/publish', requireCourseOwner, (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const { course, isFirstPublish } = queries.publishLumenCourse(id)
    if (isFirstPublish) {
      try {
        notifyCoursePublished(req, course)
      } catch (err) {
        // Notification non bloquante : on log et on retourne le cours.
        // eslint-disable-next-line no-console
        console.warn('[lumen] notification publish failed:', err.message)
      }
    }
    res.json({ ok: true, data: course })
  } catch (err) {
    next(err)
  }
})

/**
 * Side-effect de premiere publication : poste un message systeme dans le
 * canal du projet associe (s'il en existe un avec un channel_id) et emet
 * lumen:course-published sur la room promo pour que les clients connectes
 * rafraichissent leur badge / widget de cours non-lus.
 */
function notifyCoursePublished(req, course) {
  if (!course) return

  // Pas de projet → publication silencieuse cote chat (decision produit).
  // Le badge rail et le widget dashboard fonctionneront quand meme via
  // l'evenement socket ci-dessous.
  const project = course.project_id ? queries.getProjectById(course.project_id) : null
  const channelId = project?.channel_id ?? null

  if (channelId) {
    // Convention : auteur 'Cursus' avec type 'teacher' (pas de valeur 'system'
    // dans la CHECK constraint actuelle de messages.author_type). Le frontend
    // identifiera le bot par author_name === 'Cursus'.
    const content = `Nouveau cours publie : \\[${course.title}](lumen:${course.id})`
    const result = queries.sendMessage({
      channelId,
      authorName: 'Cursus',
      authorType: 'teacher',
      content,
    })
    const messageId = Number(result.lastInsertRowid)
    const message = queries.getMessageById(messageId)

    const io = req.app.get('io')
    if (io && message) {
      const pushPayload = {
        channelId,
        dmStudentId: null,
        authorName: 'Cursus',
        channelName: null,
        promoId: course.promo_id,
        preview: content.replace(/[*_`>#[\]!\\]/g, '').slice(0, 80),
        mentionEveryone: false,
        mentionNames: [],
      }
      io.to(`promo:${course.promo_id}`).emit('msg:new', pushPayload)
    }
  }

  // Toujours emettre l'evenement Lumen pour les surfaces hors chat
  // (badge rail + widget dashboard), meme sans projet/canal.
  const io = req.app.get('io')
  if (io) {
    io.to(`promo:${course.promo_id}`).emit('lumen:course-published', {
      promoId: course.promo_id,
      courseId: course.id,
    })
  }
}

// POST /api/lumen/courses/:id/unpublish — repasser en draft
router.post('/courses/:id/unpublish', requireCourseOwner, wrap((req) => {
  const id = Number(req.params.id)
  return queries.unpublishLumenCourse(id)
}))

// DELETE /api/lumen/courses/:id — supprimer un cours
router.delete('/courses/:id', requireCourseOwner, wrap((req) => {
  const id = Number(req.params.id)
  queries.deleteLumenCourse(id)
  return { id, deleted: true }
}))

// GET /api/lumen/stats/promo/:promoId — stats pour le dashboard enseignant
router.get('/stats/promo/:promoId',
  requireRole('teacher'),
  teacherPromoGuard(promoFromParam),
  wrap((req) => {
    const promoId = Number(req.params.promoId)
    return queries.getLumenStatsForPromo(promoId)
  })
)

// ─── Tracking lecture etudiant ──────────────────────────────────────────────

// POST /api/lumen/courses/:id/read — marque un cours comme lu par l'etudiant
// courant. Idempotent : rappeler ne fait que mettre a jour read_at.
router.post('/courses/:id/read',
  requireRole('student'),
  requirePromo(promoFromCourse),
  wrap((req) => {
    const courseId = Number(req.params.id)
    const studentId = req.user.id
    queries.markLumenCourseRead(studentId, courseId)
    return { ok: true, courseId }
  })
)

// GET /api/lumen/unread/promo/:promoId — renvoie le compteur + la liste des
// cours publies non-lus par l'etudiant courant pour la promo donnee. Sert
// a alimenter le badge de la rail et le widget dashboard "Nouveaux cours".
router.get('/unread/promo/:promoId',
  requireRole('student'),
  requirePromo(promoFromParam),
  wrap((req) => {
    const promoId = Number(req.params.promoId)
    const studentId = req.user.id
    const courses = queries.getUnreadLumenCoursesForStudent(studentId, promoId)
    return { count: courses.length, courses }
  })
)

module.exports = router
