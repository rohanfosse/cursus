/**
 * Verification d'acces a un cahier.
 *
 * Source unique de verite partagee entre :
 *   - middleware HTTP (authorize.js#requireCahierAccess)
 *   - serveur WebSocket Yjs (yjs/hocuspocus.js#onAuthenticate)
 *
 * Toute evolution (nouveau role, regle projet-specifique, TA...) doit se
 * faire ici pour eviter qu'HTTP et WS divergent silencieusement.
 */
const { getDb } = require('../db/connection')

/**
 * @param {{ id: number, type: string, promo_id?: number } | null} user
 * @param {number} cahierId
 * @returns {{ ok: true } | { ok: false, reason: string, status?: number }}
 */
function canAccessCahier(user, cahierId) {
  if (!user) return { ok: false, reason: 'no_user', status: 401 }
  if (!cahierId || !Number.isFinite(cahierId)) {
    return { ok: false, reason: 'bad_cahier_id', status: 400 }
  }
  const cahier = getDb().prepare('SELECT promo_id, group_id FROM cahiers WHERE id = ?').get(cahierId)
  if (!cahier) return { ok: false, reason: 'cahier_not_found', status: 404 }

  if (user.type === 'admin') return { ok: true }

  if (user.type === 'student') {
    if (user.promo_id !== cahier.promo_id) {
      return { ok: false, reason: 'wrong_promo', status: 403 }
    }
    if (cahier.group_id != null) {
      const inGroup = getDb().prepare(
        'SELECT 1 FROM group_members WHERE group_id = ? AND student_id = ? LIMIT 1'
      ).get(cahier.group_id, user.id)
      if (!inGroup) return { ok: false, reason: 'not_in_group', status: 403 }
    }
    return { ok: true }
  }

  // teacher / ta : doit enseigner la promo du cahier (teacher_promos).
  // Les JWT enseignants stockent l'ID en negatif, on normalise avec Math.abs.
  const teacherId = Math.abs(user.id)
  const owns = getDb().prepare(
    'SELECT 1 FROM teacher_promos WHERE teacher_id = ? AND promo_id = ? LIMIT 1'
  ).get(teacherId, cahier.promo_id)
  if (!owns) return { ok: false, reason: 'not_teacher_of_promo', status: 403 }
  return { ok: true }
}

module.exports = { canAccessCahier }
