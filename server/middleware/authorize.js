// ─── Middlewares d'autorisation (rôle + isolation promo) ──────────────────────
const { getDb } = require('../db/connection')

/** Bloque les étudiants — seuls les profs et intervenants passent. */
function requireTeacher(req, res, next) {
  if (req.user?.type === 'student') {
    return res.status(403).json({ ok: false, error: 'Accès réservé aux enseignants.' })
  }
  next()
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
    if (targetPromo != null && req.user.promo_id !== targetPromo) {
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
  const msg = getDb().prepare('SELECT author_name FROM messages WHERE id = ?').get(msgId)
  if (!msg) return res.status(404).json({ ok: false, error: 'Message introuvable.' })
  if (msg.author_name !== req.user.name) {
    return res.status(403).json({ ok: false, error: 'Vous ne pouvez modifier que vos propres messages.' })
  }
  next()
}

/**
 * Vérifie que l'utilisateur est l'un des deux participants du DM.
 * Le paramètre :studentId identifie la "boîte" DM (toujours l'ID étudiant positif).
 * - Un étudiant ne peut accéder qu'à sa propre boîte (studentId === req.user.id)
 * - Un enseignant ne peut accéder qu'aux DMs des étudiants dans les promos
 *   où il est affecté (via teacher_channels). Si aucune affectation n'existe,
 *   l'accès est total (rétrocompatibilité admin).
 */
function requireDmParticipant(req, res, next) {
  // Étudiants : uniquement leur propre boîte
  if (req.user?.type === 'student') {
    const boxId = Number(req.params.studentId)
    if (boxId && boxId !== req.user.id) {
      return res.status(403).json({ ok: false, error: 'Vous ne pouvez accéder qu\'à vos propres conversations.' })
    }
    return next()
  }

  // Enseignants / TAs : vérifier l'affectation promo via teacher_channels
  const studentId = Number(req.params.studentId)
  if (studentId) {
    const student = getDb().prepare('SELECT promo_id FROM students WHERE id = ?').get(studentId)
    if (student) {
      const teacherId = Math.abs(req.user.id)
      // Si le prof a des affectations de canaux, vérifier qu'il est dans la promo de l'étudiant
      const hasAnyAssignment = getDb().prepare(
        'SELECT 1 FROM teacher_channels WHERE teacher_id = ? LIMIT 1'
      ).get(teacherId)
      if (hasAnyAssignment) {
        const hasPromoAccess = getDb().prepare(`
          SELECT 1 FROM teacher_channels tc
          JOIN channels c ON tc.channel_id = c.id
          WHERE tc.teacher_id = ? AND c.promo_id = ?
          LIMIT 1
        `).get(teacherId, student.promo_id)
        if (!hasPromoAccess) {
          return res.status(403).json({ ok: false, error: 'Vous n\'êtes pas affecté à la promotion de cet étudiant.' })
        }
      }
      // Si pas d'affectation du tout → accès total (admin / rétrocompatibilité)
    }
  }
  next()
}

module.exports = {
  requireTeacher,
  requirePromo,
  promoFromChannel,
  promoFromParam,
  promoFromTravail,
  requireMessageOwner,
  requireDmParticipant,
}
