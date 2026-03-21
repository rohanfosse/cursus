const { getDb } = require('../connection')

/** Tous les intervenants (role = 'ta') */
function getIntervenants() {
  return getDb().prepare(
    "SELECT id, name, email, role FROM teachers WHERE role = 'ta' ORDER BY name"
  ).all()
}

/**
 * Crée un intervenant (role = 'ta').
 * Lève une erreur si l'email est déjà utilisé.
 */
function createIntervenant({ name, email, password }) {
  const db = getDb()
  const existing = db.prepare('SELECT id FROM teachers WHERE LOWER(email) = LOWER(?)').get(email.trim())
  if (existing) throw new Error('Cette adresse email est déjà utilisée.')
  const pwd = (password ?? '').trim() || 'admin'
  return db.prepare(
    "INSERT INTO teachers (name, email, password, role) VALUES (?, ?, ?, 'ta')"
  ).run(name.trim(), email.trim().toLowerCase(), pwd).lastInsertRowid
}

/**
 * Supprime un intervenant (ne peut pas supprimer un teacher).
 * teacherId peut être négatif (convention renderer) — Math.abs() appliqué.
 */
function deleteIntervenant(teacherId) {
  const realId = Math.abs(teacherId)
  const t = getDb().prepare("SELECT role FROM teachers WHERE id = ?").get(realId)
  if (!t) throw new Error('Intervenant introuvable.')
  if (t.role === 'teacher') throw new Error('Impossible de supprimer un Responsable Pédagogique.')
  return getDb().prepare('DELETE FROM teachers WHERE id = ?').run(realId)
}

/**
 * Canaux assignés à un intervenant — renvoie un tableau d'ids (number[]).
 * Si aucune assignation : tableau vide (l'intervenant voit tous les canaux).
 */
function getTeacherChannels(teacherId) {
  return getDb().prepare(
    'SELECT channel_id FROM teacher_channels WHERE teacher_id = ?'
  ).all(Math.abs(teacherId)).map(r => r.channel_id)
}

/**
 * Remplace entièrement les canaux d'un intervenant.
 * Wrappé dans une transaction.
 */
function setTeacherChannels({ teacherId, channelIds }) {
  const db     = getDb()
  const realId = Math.abs(teacherId)
  db.transaction(() => {
    db.prepare('DELETE FROM teacher_channels WHERE teacher_id = ?').run(realId)
    const ins = db.prepare(
      'INSERT OR IGNORE INTO teacher_channels (teacher_id, channel_id) VALUES (?, ?)'
    )
    for (const cid of (channelIds ?? [])) {
      ins.run(realId, Number(cid))
    }
  })()
}

module.exports = {
  getIntervenants, createIntervenant, deleteIntervenant,
  getTeacherChannels, setTeacherChannels,
}
