// ─── Middlewares d'autorisation (hierarchie + isolation promo + projets) ──────
const { getDb } = require('../db/connection')
const { hasRole } = require('../permissions')

// ─── Helpers prives ──────────────────────────────────────────────────────────

/** Admin bypass check */
function isAdmin(req) { return req.user?.type === 'admin' }

/** Normalise teacher ID (JWT stocke les IDs enseignants en negatif) */
function getTeacherId(req) { return Math.abs(req.user.id) }

/** Verifie que l'enseignant est affecte a la promo via teacher_promos */
function teacherOwnsPromo(teacherId, promoId) {
  return !!getDb().prepare(
    'SELECT 1 FROM teacher_promos WHERE teacher_id = ? AND promo_id = ? LIMIT 1'
  ).get(teacherId, promoId)
}

// ─── Middlewares publics ─────────────────────────────────────────────────────

/**
 * Verifie que l'utilisateur a au moins le role requis.
 * admin > teacher > ta > student
 */
function requireRole(minRole) {
  return (req, res, next) => {
    if (!hasRole(req.user?.type, minRole)) {
      return res.status(403).json({ ok: false, error: 'Accès réservé aux enseignants.' })
    }
    next()
  }
}


/**
 * Vérifie que l'étudiant appartient à la promo ciblée.
 * Les profs/intervenants passent toujours.
 * @param {(req: import('express').Request) => number|null} getPromoId — extrait le promoId cible de la requête
 */
function requirePromo(getPromoId) {
  return (req, res, next) => {
    if (req.user?.type !== 'student') return next()
    const targetPromo = getPromoId(req)
    if (targetPromo != null && Number.isFinite(targetPromo) && req.user.promo_id !== targetPromo) {
      return res.status(403).json({ ok: false, error: 'Accès non autorisé à cette promotion.' })
    }
    next()
  }
}

/** Lookup : channelId → promo_id */
function promoFromChannel(req) {
  const channelId = Number(req.params.channelId ?? req.query.channelId)
  if (!channelId) return null
  const ch = getDb().prepare('SELECT promo_id FROM channels WHERE id = ?').get(channelId)
  return ch?.promo_id ?? null
}

/** Lookup : promoId depuis params ou query */
function promoFromParam(req) {
  return Number(req.params.promoId ?? req.query.promoId) || null
}

/** Lookup : travailId → promo_id (supporte :id, :travailId, et query param) */
function promoFromTravail(req) {
  const travailId = Number(req.params.id ?? req.params.travailId ?? req.query.travailId)
  if (!travailId) return null
  const t = getDb().prepare('SELECT promo_id FROM travaux WHERE id = ?').get(travailId)
  return t?.promo_id ?? null
}

/**
 * Vérifie que l'utilisateur est l'auteur du message (pour edit/delete).
 */
function requireMessageOwner(req, res, next) {
  if (req.user?.type !== 'student') return next()
  const msgId = Number(req.params.id)
  if (!msgId) return res.status(400).json({ ok: false, error: 'ID message manquant.' })
  const msg = getDb().prepare('SELECT author_id FROM messages WHERE id = ?').get(msgId)
  if (!msg) return res.status(404).json({ ok: false, error: 'Message introuvable.' })
  if (msg.author_id !== req.user.id) {
    return res.status(403).json({ ok: false, error: 'Vous ne pouvez modifier que vos propres messages.' })
  }
  next()
}

/**
 * Vérifie que l'utilisateur est l'un des deux participants du DM.
 * Le paramètre :studentId identifie la "boîte" DM (toujours l'ID étudiant positif).
 * - Un étudiant ne peut accéder qu'à sa propre boîte (studentId === req.user.id)
 * - Un teacher/admin passe toujours
 * - Un TA doit être assigné à un projet de la promo de l'étudiant
 */
function requireDmParticipant(req, res, next) {
  // Étudiants : propre boîte OU boîte partagée (DM étudiant-étudiant, même promo)
  if (req.user?.type === 'student') {
    const boxId = Number(req.params.studentId)
    if (boxId === req.user.id) return next() // propre boîte
    // Boîte partagée : boxId = min(myId, peerId) → boxId < myId, même promo
    if (boxId && boxId < req.user.id) {
      const boxOwner = getDb().prepare('SELECT promo_id FROM students WHERE id = ?').get(boxId)
      const me = getDb().prepare('SELECT promo_id FROM students WHERE id = ?').get(req.user.id)
      if (boxOwner && me && boxOwner.promo_id === me.promo_id) return next()
    }
    return res.status(403).json({ ok: false, error: 'Vous ne pouvez accéder qu\'à vos propres conversations.' })
  }

  // Teachers et admins passent toujours
  if (hasRole(req.user?.type, 'teacher')) return next()

  // TAs : vérifier l'affectation promo via teacher_projects
  const studentId = Number(req.params.studentId)
  if (!studentId) {
    return res.status(400).json({ ok: false, error: 'Identifiant étudiant manquant.' })
  }
  const teacherId = Math.abs(req.user.id)
  const hasAccess = getDb().prepare(`
    SELECT 1 FROM students s
    JOIN projects p ON p.promo_id = s.promo_id
    JOIN teacher_projects tp ON tp.project_id = p.id
    WHERE s.id = ? AND tp.teacher_id = ?
    LIMIT 1
  `).get(studentId, teacherId)
  if (!hasAccess) {
    return res.status(403).json({ ok: false, error: 'Vous n\'êtes pas affecté à la promotion de cet étudiant.' })
  }
  next()
}

/**
 * Vérifie que l'enseignant est responsable de la promo ciblée (via teacher_promos).
 * Les admins passent toujours.
 */
function requirePromoAdmin(getPromoId) {
  return (req, res, next) => {
    if (isAdmin(req)) return next()
    if (!hasRole(req.user?.type, 'teacher')) {
      return res.status(403).json({ ok: false, error: 'Accès réservé aux enseignants.' })
    }
    const promoId = getPromoId(req)
    if (promoId == null) return next()
    if (!teacherOwnsPromo(getTeacherId(req), promoId)) {
      return res.status(403).json({ ok: false, error: 'Vous n\'êtes pas responsable de cette promotion.' })
    }
    next()
  }
}

/**
 * Verifie que le TA est assigne au projet demande.
 * Les teachers et admins passent toujours.
 */
function requireProject(getProjectId) {
  return (req, res, next) => {
    if (hasRole(req.user?.type, 'teacher')) return next()
    if (req.user?.type !== 'ta') return res.status(403).json({ ok: false, error: 'Accès non autorisé.' })

    const projectId = getProjectId(req)
    if (!projectId) return res.status(400).json({ ok: false, error: 'Projet non spécifié.' })

    const assigned = getDb().prepare(
      'SELECT 1 FROM teacher_projects WHERE teacher_id = ? AND project_id = ? LIMIT 1'
    ).get(getTeacherId(req), projectId)

    if (!assigned) {
      return res.status(403).json({ ok: false, error: 'Vous n\'êtes pas assigné à ce projet.' })
    }
    next()
  }
}

/**
 * Vérifie que l'enseignant est le créateur de la session (live ou rex).
 * Les admins passent toujours.
 * @param {string} table — 'live_sessions' ou 'rex_sessions'
 */
function requireSessionOwner(table) {
  return (req, res, next) => {
    if (isAdmin(req)) return next()
    const sessionId = Number(req.params.id)
    if (!sessionId) return res.status(400).json({ ok: false, error: 'ID session manquant.' })
    const session = getDb().prepare(`SELECT teacher_id FROM ${table} WHERE id = ?`).get(sessionId)
    if (!session) return res.status(404).json({ ok: false, error: 'Session introuvable.' })
    if (Math.abs(session.teacher_id) !== getTeacherId(req)) {
      return res.status(403).json({ ok: false, error: 'Vous ne pouvez modifier que vos propres sessions.' })
    }
    next()
  }
}

/**
 * Vérifie que le devoir appartient à une promo gérée par l'enseignant.
 * Les admins passent toujours.
 * Supporte :id et :travailId comme paramètre.
 */
function requireTravailOwner(req, res, next) {
  if (isAdmin(req)) return next()
  const travailId = Number(req.params.id ?? req.params.travailId ?? req.body?.travailId)
  if (!travailId) return res.status(400).json({ ok: false, error: 'ID devoir manquant.' })
  const travail = getDb().prepare('SELECT promo_id FROM travaux WHERE id = ?').get(travailId)
  if (!travail) return res.status(404).json({ ok: false, error: 'Devoir introuvable.' })
  if (!teacherOwnsPromo(getTeacherId(req), travail.promo_id)) {
    return res.status(403).json({ ok: false, error: 'Ce devoir n\'appartient pas à vos promotions.' })
  }
  next()
}

/**
 * Vérifie que l'activité (live ou rex) appartient à une session créée par l'enseignant.
 * Les admins passent toujours.
 * @param {string} activityTable — 'live_activities' ou 'rex_activities'
 * @param {string} sessionTable — 'live_sessions' ou 'rex_sessions'
 */
function requireActivityOwner(activityTable, sessionTable) {
  return (req, res, next) => {
    if (isAdmin(req)) return next()
    const activityId = Number(req.params.id)
    if (!activityId) return res.status(400).json({ ok: false, error: 'ID activité manquant.' })
    const row = getDb().prepare(
      `SELECT s.teacher_id FROM ${activityTable} a JOIN ${sessionTable} s ON s.id = a.session_id WHERE a.id = ?`
    ).get(activityId)
    if (!row) return res.status(404).json({ ok: false, error: 'Activité introuvable.' })
    if (Math.abs(row.teacher_id) !== getTeacherId(req)) {
      return res.status(403).json({ ok: false, error: 'Vous ne pouvez modifier que vos propres activités.' })
    }
    next()
  }
}

/**
 * Vérifie que le projet a été créé par l'enseignant (via created_by).
 * Les admins passent toujours.
 */
function requireProjectOwner(req, res, next) {
  if (isAdmin(req)) return next()
  const projectId = Number(req.params.id)
  if (!projectId) return res.status(400).json({ ok: false, error: 'ID projet manquant.' })
  const project = getDb().prepare('SELECT created_by FROM projects WHERE id = ?').get(projectId)
  if (!project) return res.status(404).json({ ok: false, error: 'Projet introuvable.' })
  if (Math.abs(project.created_by) !== getTeacherId(req)) {
    return res.status(403).json({ ok: false, error: 'Vous ne pouvez modifier que vos propres projets.' })
  }
  next()
}

/**
 * Vérifie que le groupe appartient à une promo gérée par l'enseignant.
 * Les admins passent toujours.
 */
function requireGroupOwner(req, res, next) {
  if (isAdmin(req)) return next()
  const groupId = Number(req.params.id)
  if (!groupId) return res.status(400).json({ ok: false, error: 'ID groupe manquant.' })
  const group = getDb().prepare('SELECT promo_id FROM groups WHERE id = ?').get(groupId)
  if (!group) return res.status(404).json({ ok: false, error: 'Groupe introuvable.' })
  if (!teacherOwnsPromo(getTeacherId(req), group.promo_id)) {
    return res.status(403).json({ ok: false, error: 'Ce groupe n\'appartient pas à vos promotions.' })
  }
  next()
}

/**
 * Vérifie que la ressource appartient à un devoir d'une promo gérée par l'enseignant.
 * Les admins passent toujours.
 */
function requireResourceOwner(req, res, next) {
  if (isAdmin(req)) return next()
  const resourceId = Number(req.params.id)
  if (!resourceId) return res.status(400).json({ ok: false, error: 'ID ressource manquant.' })
  // Chercher dans ressources (JOIN travaux) puis channel_documents (addRessource insere dans channel_documents)
  const fromRes = getDb().prepare(
    'SELECT t.promo_id FROM ressources r JOIN travaux t ON t.id = r.travail_id WHERE r.id = ?'
  ).get(resourceId)
  const promoId = fromRes?.promo_id
    ?? getDb().prepare('SELECT promo_id FROM channel_documents WHERE id = ?').get(resourceId)?.promo_id
  if (promoId == null) return res.status(404).json({ ok: false, error: 'Ressource introuvable.' })
  if (!teacherOwnsPromo(getTeacherId(req), promoId)) {
    return res.status(403).json({ ok: false, error: 'Cette ressource n\'appartient pas à vos promotions.' })
  }
  next()
}

/**
 * Vérifie que le rappel appartient à une promo gérée par l'enseignant (via promo_tag).
 * Les admins passent toujours.
 */
function requireReminderOwner(req, res, next) {
  if (isAdmin(req)) return next()
  const reminderId = Number(req.params.id)
  if (!reminderId) return res.status(400).json({ ok: false, error: 'ID rappel manquant.' })
  const reminder = getDb().prepare('SELECT promo_tag FROM teacher_reminders WHERE id = ?').get(reminderId)
  if (!reminder) return res.status(404).json({ ok: false, error: 'Rappel introuvable.' })
  // promo_tag = nom de la promo (pas de FK promo_id sur cette table)
  const assigned = getDb().prepare(
    'SELECT 1 FROM teacher_promos tp JOIN promotions p ON p.id = tp.promo_id WHERE tp.teacher_id = ? AND p.name = ? LIMIT 1'
  ).get(getTeacherId(req), reminder.promo_tag)
  if (!assigned) {
    return res.status(403).json({ ok: false, error: 'Ce rappel n\'appartient pas à vos promotions.' })
  }
  next()
}

module.exports = {
  requireRole,
  requirePromo,
  requirePromoAdmin,
  promoFromChannel,
  promoFromParam,
  promoFromTravail,
  requireMessageOwner,
  requireDmParticipant,
  requireProject,
  requireSessionOwner,
  requireTravailOwner,
  requireActivityOwner,
  requireProjectOwner,
  requireGroupOwner,
  requireResourceOwner,
  requireReminderOwner,
}
