/**
 * Model Booking Campaigns — visites tripartites planifiees sur une periode.
 *
 * Concept : un prof cree une campagne ("Bilan A4"), choisit une periode
 * (start_date / end_date), une regle hebdo + exclusions, une promo cible.
 * Cursus genere une `booking_campaign_invites` par etudiant + un token unique
 * et envoie un mail. Chaque etudiant reserve 1 RDV via /book/c/:token.
 *
 * Stockage JSON pour `hebdo_rules` et `excluded_dates` car SQLite n'a pas
 * de type tableau natif et la donnee est purement consultee par-campagne
 * (pas de query croisee a optimiser).
 */
const { getDb } = require('../connection')
const { secureToken } = require('../../utils/secureToken')

// ── Campaigns ────────────────────────────────────────────────────────────

/** Liste les campagnes d'un prof, plus recente en premier. Inclut le compteur d'invites. */
function getCampaigns(teacherId) {
  return getDb().prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM booking_campaign_invites WHERE campaign_id = c.id) AS invite_count,
      (SELECT COUNT(*) FROM booking_campaign_invites WHERE campaign_id = c.id AND booking_id IS NOT NULL) AS booked_count
    FROM booking_campaigns c
    WHERE c.teacher_id = ?
    ORDER BY c.created_at DESC
  `).all(teacherId)
}

function getCampaignById(id) {
  return getDb().prepare('SELECT * FROM booking_campaigns WHERE id = ?').get(id) || null
}

/** Charge une campagne via le token d'invitation etudiant (page publique /book/c/:token). */
function getCampaignByInviteToken(token) {
  return getDb().prepare(`
    SELECT c.*, ci.id AS invite_id, ci.student_id, ci.booking_id,
           s.name AS student_name, s.email AS student_email,
           u.name AS teacher_name
    FROM booking_campaign_invites ci
    JOIN booking_campaigns c ON c.id = ci.campaign_id
    JOIN students s ON s.id = ci.student_id
    JOIN users u ON u.id = c.teacher_id
    WHERE ci.token = ?
  `).get(token) || null
}

function createCampaign({
  teacherId, title, description, durationMinutes, bufferMinutes, color,
  startDate, endDate, hebdoRules, excludedDates, promoId,
  withTutor, notifyEmail, useJitsi, fallbackVisioUrl, timezone,
}) {
  const db = getDb()
  // Atomic : event_type fantome + campagne dans la meme tx pour cohérence FK.
  const tx = db.transaction(() => {
    // 1. Cree un event_type "fantome" (slug __campaign_<random>) pour satisfaire
    //    la FK bookings.event_type_id sans polluer la liste publique des event-types.
    const ghostSlug = `__campaign_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const etRes = db.prepare(`
      INSERT INTO booking_event_types
        (teacher_id, title, slug, description, duration_minutes, color, fallback_visio_url, buffer_minutes, timezone, is_active, is_public, use_jitsi)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
    `).run(
      teacherId, title, ghostSlug, description || null,
      durationMinutes || 30, color || '#6366f1',
      fallbackVisioUrl || null, bufferMinutes || 0,
      timezone || 'Europe/Paris',
      useJitsi ? 1 : 0,
    )
    const eventTypeId = etRes.lastInsertRowid

    // 2. Cree la campagne
    const res = db.prepare(`
      INSERT INTO booking_campaigns
        (teacher_id, event_type_id, title, description, duration_minutes, buffer_minutes, color,
         start_date, end_date, hebdo_rules, excluded_dates, promo_id,
         with_tutor, notify_email, use_jitsi, fallback_visio_url, timezone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      teacherId,
      eventTypeId,
      title,
      description || null,
      durationMinutes || 30,
      bufferMinutes || 0,
      color || '#6366f1',
      startDate,
      endDate,
      JSON.stringify(hebdoRules || []),
      JSON.stringify(excludedDates || []),
      promoId || null,
      withTutor ? 1 : 0,
      notifyEmail || null,
      useJitsi ? 1 : 0,
      fallbackVisioUrl || null,
      timezone || 'Europe/Paris',
    )
    return res.lastInsertRowid
  })
  const id = tx()
  return getCampaignById(id)
}

function updateCampaign(id, fields) {
  const allowed = ['title', 'description', 'duration_minutes', 'buffer_minutes', 'color',
    'start_date', 'end_date', 'hebdo_rules', 'excluded_dates', 'promo_id',
    'with_tutor', 'notify_email', 'use_jitsi', 'fallback_visio_url', 'timezone', 'status', 'launched_at']
  const sets = []
  const vals = []
  for (const k of allowed) {
    if (fields[k] !== undefined) {
      sets.push(`${k} = ?`)
      // hebdo_rules / excluded_dates en JSON si on recoit un tableau
      const v = (k === 'hebdo_rules' || k === 'excluded_dates') && Array.isArray(fields[k])
        ? JSON.stringify(fields[k])
        : fields[k]
      vals.push(v)
    }
  }
  if (sets.length === 0) return getCampaignById(id)
  vals.push(id)
  getDb().prepare(`UPDATE booking_campaigns SET ${sets.join(', ')} WHERE id = ?`).run(...vals)
  return getCampaignById(id)
}

function deleteCampaign(id) {
  const db = getDb()
  const c = db.prepare('SELECT event_type_id FROM booking_campaigns WHERE id = ?').get(id)
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM booking_campaigns WHERE id = ?').run(id)
    if (c && c.event_type_id) {
      // L'event_type "fantome" peut avoir des bookings si la campagne a deja
      // genere des reservations. SQLite refusera le DELETE si la FK est ON
      // DELETE NO ACTION (default) -> on swallow l'erreur pour laisser l'orphelin
      // plutot que de casser. Plus tard : ajout colonne `is_internal` + cleanup
      // job pour purger les fantomes orphelins sans bookings.
      try {
        db.prepare('DELETE FROM booking_event_types WHERE id = ?').run(c.event_type_id)
      } catch { /* booking referencing event_type, leave it orphaned */ }
    }
  })
  tx()
}

/**
 * Transition atomique de status. Renvoie le nb de lignes affectees (0 si la
 * campagne n'etait pas dans `fromStatus`). Permet a la route de detecter un
 * double-launch sans send les mails 2x.
 */
function transitionCampaignStatus(id, fromStatus, toStatus, extra = {}) {
  const db = getDb()
  const sets = ['status = ?']
  const vals = [toStatus]
  if (extra.launched_at) { sets.push('launched_at = ?'); vals.push(extra.launched_at) }
  vals.push(id, fromStatus)
  const res = db.prepare(`UPDATE booking_campaigns SET ${sets.join(', ')} WHERE id = ? AND status = ?`).run(...vals)
  return res.changes
}

function countCampaignBookings(campaignId) {
  return getDb().prepare(
    "SELECT COUNT(*) as n FROM bookings WHERE campaign_id = ? AND status = 'confirmed'"
  ).get(campaignId).n
}

// ── Invites ──────────────────────────────────────────────────────────────

/**
 * Cree (ou recupere si existant) une invitation par etudiant pour la campagne.
 * Idempotent : safe a rejouer (relance, ajout d'etudiants).
 */
function ensureInvitesForStudents(campaignId, studentIds) {
  const db = getDb()
  const existing = db.prepare(
    'SELECT student_id, token FROM booking_campaign_invites WHERE campaign_id = ?'
  ).all(campaignId)
  const seen = new Set(existing.map(r => r.student_id))
  const ins = db.prepare(
    'INSERT INTO booking_campaign_invites (campaign_id, student_id, token) VALUES (?, ?, ?)'
  )
  const tx = db.transaction(() => {
    for (const sid of studentIds) {
      if (seen.has(sid)) continue
      ins.run(campaignId, sid, secureToken())
    }
  })
  tx()
  return listInvites(campaignId)
}

/** Liste les invites de la campagne avec status (booked/pending) + infos etudiant. */
function listInvites(campaignId) {
  return getDb().prepare(`
    SELECT ci.id, ci.token, ci.invited_at, ci.last_reminded_at, ci.booking_id, ci.created_at,
           s.id AS student_id, s.name AS student_name, s.email AS student_email,
           b.start_datetime, b.end_datetime, b.tutor_name, b.tutor_email, b.status AS booking_status,
           b.teams_join_url, b.cancel_token
    FROM booking_campaign_invites ci
    JOIN students s ON s.id = ci.student_id
    LEFT JOIN bookings b ON b.id = ci.booking_id
    WHERE ci.campaign_id = ?
    ORDER BY s.name COLLATE NOCASE
  `).all(campaignId)
}

/** Renvoie les invites pas encore reservees ou avec une reservation annulee. */
function listPendingInvites(campaignId) {
  return getDb().prepare(`
    SELECT ci.id, ci.token, ci.invited_at, ci.last_reminded_at,
           s.id AS student_id, s.name AS student_name, s.email AS student_email
    FROM booking_campaign_invites ci
    JOIN students s ON s.id = ci.student_id
    LEFT JOIN bookings b ON b.id = ci.booking_id
    WHERE ci.campaign_id = ?
      AND (b.id IS NULL OR b.status = 'cancelled')
    ORDER BY s.name COLLATE NOCASE
  `).all(campaignId)
}

function markInviteSent(inviteIds, kind = 'invited') {
  if (!inviteIds.length) return
  const col = kind === 'reminder' ? 'last_reminded_at' : 'invited_at'
  const db = getDb()
  const stmt = db.prepare(`UPDATE booking_campaign_invites SET ${col} = datetime('now') WHERE id = ?`)
  const tx = db.transaction(() => { for (const id of inviteIds) stmt.run(id) })
  tx()
}

function attachBookingToInvite(inviteId, bookingId) {
  getDb().prepare('UPDATE booking_campaign_invites SET booking_id = ? WHERE id = ?')
    .run(bookingId, inviteId)
}

function getInviteById(inviteId) {
  return getDb().prepare(`
    SELECT ci.*, s.name AS student_name, s.email AS student_email, c.teacher_id
    FROM booking_campaign_invites ci
    JOIN booking_campaigns c ON c.id = ci.campaign_id
    JOIN students s ON s.id = ci.student_id
    WHERE ci.id = ?
  `).get(inviteId) || null
}

module.exports = {
  getCampaigns, getCampaignById, getCampaignByInviteToken,
  createCampaign, updateCampaign, deleteCampaign,
  transitionCampaignStatus, countCampaignBookings,
  ensureInvitesForStudents, listInvites, listPendingInvites,
  markInviteSent, attachBookingToInvite, getInviteById,
}
