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
  repoUrl:   z.string().url().max(500).nullable().optional(),
}).strict()

// Service snapshot (fetch GitHub + validation + zip)
const lumenSnapshot = require('../services/lumenSnapshot')
const lumenZip      = require('../services/lumenZip')

// Debounce anti-abuse : pas plus d'un refresh par cours par minute pour
// eviter qu'un prof qui clique frenetiquement sur "Resynchroniser" ne
// tape contre le rate limit GitHub (60 req/h par IP non-authentifiee).
// Stockage in-memory — acceptable car le cas d'usage est "un prof qui
// teste pendant la preparation" ; les redemarrages serveur sont rares.
const REFRESH_COOLDOWN_MS = 60_000
const lastRefreshByCourse = new Map()

function checkRefreshCooldown(courseId) {
  // Desactive en environnement de test : les tests font plusieurs refresh
  // du meme cours en < 1s (normal pour valider les differents edge cases).
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return null
  const last = lastRefreshByCourse.get(courseId)
  if (!last) return null
  const elapsed = Date.now() - last
  if (elapsed < REFRESH_COOLDOWN_MS) {
    return Math.ceil((REFRESH_COOLDOWN_MS - elapsed) / 1000)
  }
  return null
}

/**
 * Mappe une SnapshotError vers une reponse HTTP structuree.
 * Les codes sont stables, utilisables cote frontend pour afficher des
 * messages actionables.
 */
function snapshotErrorToResponse(err) {
  const status = lumenSnapshot.httpStatusFor[err.code] ?? 500
  return {
    status,
    body: {
      ok: false,
      error: err.message,
      code: err.code,
      details: err.details,
    },
  }
}

/**
 * Build-and-store : orchestre le fetch du snapshot et la persistance.
 * Retourne le snapshot meta (pas le JSON complet) et le cours mis a jour.
 * Throw SnapshotError si le fetch echoue (a mapper par le handler).
 */
async function buildAndStoreSnapshot(courseId, repoUrl) {
  const snapshot = await lumenSnapshot.buildSnapshot(repoUrl)
  queries.setLumenCourseSnapshot(courseId, {
    url: snapshot.repo_url,
    snapshot,
    commitSha: snapshot.commit_sha,
    defaultBranch: snapshot.default_branch,
  })
  return snapshot
}

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
  // Si l'URL du repo change ou est effacee, le snapshot existant devient
  // obsolete : on le nettoie pour eviter que l'etudiant voie le vieux projet.
  if (Object.prototype.hasOwnProperty.call(req.body, 'repoUrl')) {
    const current = queries.getLumenCourse(id)
    if (current && current.repo_url !== req.body.repoUrl) {
      queries.clearLumenCourseSnapshot(id)
    }
  }
  return queries.updateLumenCourse(id, req.body)
}))

// POST /api/lumen/courses/:id/publish — publier un cours
// A la PREMIERE publication (published_at etait NULL), poste un message
// systeme dans le canal du projet associe (si projet et channel definis)
// et emet un evenement socket pour rafraichir les compteurs cote clients.
// En cas d'echec du side-effect, la publication reste valide (best-effort).
router.post('/courses/:id/publish', requireCourseOwner, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const before = queries.getLumenCourse(id)
    if (!before) {
      return res.status(404).json({ ok: false, error: 'Cours introuvable.' })
    }

    // Si un repo git est attache et qu'aucun snapshot n'a encore ete fait
    // (ou si l'URL a change), on snapshotte avant de publier. Un echec de
    // snapshot bloque la publication : on ne veut pas exposer un cours qui
    // reference un projet fantome cote etudiants.
    if (before.repo_url && !before.repo_snapshot_at) {
      try {
        await buildAndStoreSnapshot(id, before.repo_url)
      } catch (err) {
        if (err instanceof lumenSnapshot.SnapshotError) {
          const { status, body } = snapshotErrorToResponse(err)
          return res.status(status).json(body)
        }
        throw err
      }
    }

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

// ─── Snapshot repo git d'exemple ─────────────────────────────────────────────

/**
 * Middleware : valide qu'un etudiant peut lire le snapshot d'un cours.
 * Un etudiant accede uniquement aux snapshots des cours publies de sa promo.
 * Les teachers/admins passent via requireCourseOwner (pour mutation) ou
 * requirePromo (pour lecture). Ici on combine les deux modes.
 */
function snapshotReadGuard(req, res, next) {
  const id = Number(req.params.id)
  const course = queries.getLumenCourse(id)
  if (!course) return res.status(404).json({ ok: false, error: 'Cours introuvable.' })

  if (req.user?.type === 'student') {
    if (course.status !== 'published') {
      return res.status(404).json({ ok: false, error: 'Cours non publié.' })
    }
    if (req.user.promo_id !== course.promo_id) {
      return res.status(403).json({ ok: false, error: 'Cours hors de votre promotion.' })
    }
  } else if (req.user?.type === 'teacher') {
    // Un teacher peut lire les snapshots des cours de ses promos
    if (course.teacher_id !== getTeacherIdFromReq(req)) {
      // Fallback : verifie qu'il est au moins rattache a la promo
      const authorized = requirePromoAdmin(() => course.promo_id)
      return authorized(req, res, () => { req._lumenCourse = course; next() })
    }
  } else if (req.user?.type !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Accès non autorisé.' })
  }
  req._lumenCourse = course
  next()
}

// POST /api/lumen/courses/:id/snapshot — cree ou rafraichit le snapshot.
// Utilise par le bouton "Resynchroniser" cote prof et implicitement au publish.
router.post('/courses/:id/snapshot', requireCourseOwner, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const course = queries.getLumenCourse(id)
    if (!course) return res.status(404).json({ ok: false, error: 'Cours introuvable.' })
    if (!course.repo_url) {
      return res.status(400).json({
        ok: false,
        error: 'Aucune URL de repo attachee a ce cours.',
        code: 'NO_REPO_URL',
      })
    }

    // Anti-abuse : au moins 60s entre deux refresh du meme cours
    const waitSec = checkRefreshCooldown(id)
    if (waitSec) {
      return res.status(429).json({
        ok: false,
        error: `Patience : reessaie dans ${waitSec}s (cooldown anti-abus).`,
        code: 'REFRESH_COOLDOWN',
        details: { retry_after_seconds: waitSec },
      })
    }

    const previousSha = course.repo_commit_sha
    let snapshot
    try {
      snapshot = await buildAndStoreSnapshot(id, course.repo_url)
      lastRefreshByCourse.set(id, Date.now())
    } catch (err) {
      if (err instanceof lumenSnapshot.SnapshotError) {
        const { status, body } = snapshotErrorToResponse(err)
        return res.status(status).json(body)
      }
      throw err
    }

    res.json({
      ok: true,
      data: {
        commit_sha: snapshot.commit_sha,
        default_branch: snapshot.default_branch,
        file_count: snapshot.file_count,
        total_size: snapshot.total_size,
        fetched_at: snapshot.fetched_at,
        changed: previousSha !== snapshot.commit_sha,
      },
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/lumen/courses/:id/snapshot/tree — retourne uniquement l'arborescence
// (paths + sizes) sans les contenus. Sert au rendu cote reader etudiant.
router.get('/courses/:id/snapshot/tree', snapshotReadGuard, wrap((req) => {
  const snapshot = queries.getLumenCourseSnapshot(Number(req.params.id))
  if (!snapshot) {
    const err = new Error('Aucun snapshot disponible')
    err.statusCode = 404
    throw err
  }
  return {
    repo_url: snapshot.repo_url,
    default_branch: snapshot.default_branch,
    commit_sha: snapshot.commit_sha,
    fetched_at: snapshot.fetched_at,
    file_count: snapshot.file_count,
    total_size: snapshot.total_size,
    files: snapshot.files.map(f => ({ path: f.path, size: f.size })),
  }
}))

// GET /api/lumen/courses/:id/snapshot/file?path=... — retourne le contenu
// base64 d'un fichier individuel. Lazy loading cote reader : on ne charge
// qu'au clic de l'etudiant, pas en eager.
router.get('/courses/:id/snapshot/file', snapshotReadGuard, wrap((req) => {
  const requestedPath = typeof req.query.path === 'string' ? req.query.path : null
  if (!requestedPath) {
    const err = new Error('Parametre path requis')
    err.statusCode = 400
    throw err
  }
  const snapshot = queries.getLumenCourseSnapshot(Number(req.params.id))
  if (!snapshot) {
    const err = new Error('Aucun snapshot disponible')
    err.statusCode = 404
    throw err
  }
  // Comparaison stricte : pas de normalisation (pas de .. possible puisque
  // les paths du snapshot viennent directement de l'API GitHub et n'ont
  // jamais de segments relatifs).
  const file = snapshot.files.find(f => f.path === requestedPath)
  if (!file) {
    const err = new Error('Fichier introuvable dans le snapshot')
    err.statusCode = 404
    throw err
  }
  return {
    path: file.path,
    size: file.size,
    content_base64: file.content_base64,
  }
}))

// GET /api/lumen/courses/:id/snapshot/download — streaming du zip
router.get('/courses/:id/snapshot/download', snapshotReadGuard, async (req, res, next) => {
  try {
    const id = Number(req.params.id)
    const snapshot = queries.getLumenCourseSnapshot(id)
    if (!snapshot) return res.status(404).json({ ok: false, error: 'Aucun snapshot disponible.' })

    const course = req._lumenCourse
    const slug = (course.title || 'cours')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'cours'
    const filename = `${slug}-exemple.zip`

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    await lumenZip.streamZipFromSnapshot(snapshot, res)
  } catch (err) {
    next(err)
  }
})

module.exports = router
