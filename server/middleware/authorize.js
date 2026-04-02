// ─── Middlewares d'autorisation (hierarchie + isolation promo + projets) ──────
const { getDb } = require('../db/connection')
const { hasRole } = require('../permissions')

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
    if (req.user?.type === 'admin') return next()
    if (!hasRole(req.user?.type, 'teacher')) {
      return res.status(403).json({ ok: false, error: 'Accès réservé aux enseignants.' })
    }
    const promoId = getPromoId(req)
    if (promoId == null) return next()
    const teacherId = Math.abs(req.user.id)
    const assigned = getDb().prepare(
      'SELECT 1 FROM teacher_promos WHERE teacher_id = ? AND promo_id = ? LIMIT 1'
    ).get(teacherId, promoId)
    if (!assigned) {
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

    const teacherId = Math.abs(req.user.id)
    const assigned = getDb().prepare(
      'SELECT 1 FROM teacher_projects WHERE teacher_id = ? AND project_id = ? LIMIT 1'
    ).get(teacherId, projectId)

    if (!assigned) {
      return res.status(403).json({ ok: false, error: 'Vous n\'êtes pas assigné à ce projet.' })
    }
    next()
  }
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
}
