/**
 * Modele : Abonnements ICS externes par promo.
 *
 * Une "subscription" pointe vers une URL ICS publique (Outlook publie /
 * Google Calendar public / iCloud share). Les events parses sont caches
 * dans promo_calendar_events et rafraichis periodiquement par le scheduler.
 *
 * URL est stockee chiffree (la decryption se fait a la lecture, jamais
 * exposee au frontend en clair une fois enregistree — seul un masque
 * affiche les 12 derniers chars).
 */
const { getDb } = require('../connection')
const { encrypt, decrypt } = require('../../utils/crypto')

/** Masque l'URL pour affichage (cache le token : `https://outlook.office365.com/.../...4321/calendar.ics`). */
function maskIcsUrl(url) {
  if (!url || typeof url !== 'string') return ''
  // Garde le host + 12 derniers chars du path
  try {
    const u = new URL(url)
    const tail = url.slice(-16)
    return `${u.host}/...${tail}`
  } catch {
    return url.length > 24 ? `...${url.slice(-20)}` : url
  }
}

function rowToPublic(row) {
  if (!row) return null
  let url = ''
  try { url = decrypt(row.ics_url_enc) } catch { /* leave empty */ }
  return {
    id: row.id,
    promo_id: row.promo_id,
    teacher_id: row.teacher_id,
    label: row.label,
    color: row.color || null,
    ics_url_masked: maskIcsUrl(url),
    is_active: row.is_active,
    last_fetched_at: row.last_fetched_at,
    last_error: row.last_error,
    last_event_count: row.last_event_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/** Cree un abonnement. URL chiffree avant insert. Retourne la version publique. */
function createSubscription({ promoId, teacherId, label, icsUrl, color }) {
  if (!promoId || !teacherId || !label || !icsUrl) {
    throw new Error('promoId, teacherId, label et icsUrl sont requis')
  }
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO promo_calendar_subscriptions (promo_id, teacher_id, label, ics_url_enc, color, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(promoId, teacherId, label, encrypt(icsUrl), color || null)
  const row = db.prepare('SELECT * FROM promo_calendar_subscriptions WHERE id = ?').get(result.lastInsertRowid)
  return rowToPublic(row)
}

function listForTeacher(teacherId) {
  return getDb().prepare(`
    SELECT pcs.*, p.name AS promo_name, p.color AS promo_color
    FROM promo_calendar_subscriptions pcs
    JOIN promotions p ON p.id = pcs.promo_id
    WHERE pcs.teacher_id = ?
    ORDER BY p.name, pcs.label
  `).all(teacherId).map(r => ({ ...rowToPublic(r), promo_name: r.promo_name, promo_color: r.promo_color }))
}

function listForPromo(promoId) {
  return getDb().prepare(`
    SELECT * FROM promo_calendar_subscriptions
    WHERE promo_id = ? AND is_active = 1
    ORDER BY label
  `).all(promoId).map(rowToPublic)
}

/** Liste TOUS les abonnements actifs (utilisee par le cron de rafraichissement). */
function listAllActive() {
  return getDb().prepare(`
    SELECT * FROM promo_calendar_subscriptions WHERE is_active = 1
  `).all()
}

/** Recupere un abonnement par id avec son URL en clair (callers internes uniquement). */
function getRawById(id) {
  const row = getDb().prepare('SELECT * FROM promo_calendar_subscriptions WHERE id = ?').get(id)
  if (!row) return null
  let url = ''
  try { url = decrypt(row.ics_url_enc) } catch { url = '' }
  return { ...row, ics_url: url }
}

/** Update label / color / is_active (pas l'URL : la convention est de supprimer + recreer). */
function updateSubscription(id, { label, color, isActive }) {
  const db = getDb()
  const fields = []
  const params = []
  if (label !== undefined) { fields.push('label = ?'); params.push(label) }
  if (color !== undefined) { fields.push('color = ?'); params.push(color || null) }
  if (isActive !== undefined) { fields.push('is_active = ?'); params.push(isActive ? 1 : 0) }
  if (fields.length === 0) return getById(id)
  fields.push("updated_at = datetime('now')")
  params.push(id)
  db.prepare(`UPDATE promo_calendar_subscriptions SET ${fields.join(', ')} WHERE id = ?`).run(...params)
  return getById(id)
}

function deleteSubscription(id) {
  return getDb().prepare('DELETE FROM promo_calendar_subscriptions WHERE id = ?').run(id).changes > 0
}

function getById(id) {
  const row = getDb().prepare('SELECT * FROM promo_calendar_subscriptions WHERE id = ?').get(id)
  return rowToPublic(row)
}

/** Marque l'abonnement comme refresh : met a jour stats et eventuelle erreur. */
function markFetched(id, { eventCount = 0, error = null } = {}) {
  getDb().prepare(`
    UPDATE promo_calendar_subscriptions
    SET last_fetched_at = datetime('now'),
        last_error = ?,
        last_event_count = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(error, eventCount, id)
}

/**
 * Remplace tous les events caches d'un abonnement par la nouvelle liste.
 * Strategie "wipe & insert" : Outlook republie le calendrier complet a
 * chaque fetch, donc plus simple que de diff (et le volume est minuscule :
 * ~quelques centaines d'events par calendrier de promo).
 */
function replaceEvents(subscriptionId, events) {
  const db = getDb()
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM promo_calendar_events WHERE subscription_id = ?').run(subscriptionId)
    const insert = db.prepare(`
      INSERT INTO promo_calendar_events (subscription_id, uid, start_at, end_at, is_all_day, summary, location, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    for (const ev of events) {
      if (!ev.start || !ev.end) continue
      insert.run(
        subscriptionId,
        ev.uid || null,
        ev.start,
        ev.end,
        ev.isAllDay ? 1 : 0,
        ev.summary || '',
        ev.location || '',
        ev.description || '',
      )
    }
  })
  tx()
}

/**
 * Recupere les events d'une promo dans la fenetre [from, to] (ISO).
 * JOIN sur subscription pour avoir label + color.
 */
function getEventsForPromo(promoId, { from, to } = {}) {
  let sql = `
    SELECT pce.*, pcs.label AS subscription_label, pcs.color AS subscription_color
    FROM promo_calendar_events pce
    JOIN promo_calendar_subscriptions pcs ON pcs.id = pce.subscription_id
    WHERE pcs.promo_id = ? AND pcs.is_active = 1
  `
  const params = [promoId]
  if (from) { sql += ' AND pce.end_at > ?'; params.push(from) }
  if (to)   { sql += ' AND pce.start_at < ?'; params.push(to) }
  sql += ' ORDER BY pce.start_at ASC'
  return getDb().prepare(sql).all(...params)
}

module.exports = {
  createSubscription,
  listForTeacher,
  listForPromo,
  listAllActive,
  getById,
  getRawById,
  updateSubscription,
  deleteSubscription,
  markFetched,
  replaceEvents,
  getEventsForPromo,
  maskIcsUrl,
}
