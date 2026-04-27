/**
 * Model Booking — CRUD pour types d'evenements, regles de dispo,
 * tokens de reservation et reservations.
 */
const { getDb } = require('../connection');
const { secureToken } = require('../../utils/secureToken');

// ── Event Types ─────────────────────────────────────────────────────────

function getEventTypes(teacherId) {
  // Filtre les event-types internes generes pour les campagnes (slug __campaign_<id>)
  return getDb().prepare(
    "SELECT * FROM booking_event_types WHERE teacher_id = ? AND slug NOT LIKE '__campaign_%' ORDER BY created_at DESC"
  ).all(teacherId);
}

function getEventTypeBySlug(slug) {
  return getDb().prepare('SELECT * FROM booking_event_types WHERE slug = ?').get(slug) || null;
}

function getEventTypeById(id) {
  return getDb().prepare('SELECT * FROM booking_event_types WHERE id = ?').get(id) || null;
}

function createEventType({ teacherId, title, slug, description, durationMinutes, color, fallbackVisioUrl, bufferMinutes, timezone, isPublic, useJitsi }) {
  const res = getDb().prepare(
    'INSERT INTO booking_event_types (teacher_id, title, slug, description, duration_minutes, color, fallback_visio_url, buffer_minutes, timezone, is_public, use_jitsi) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(teacherId, title, slug, description || null, durationMinutes || 30, color || '#3b82f6', fallbackVisioUrl || null, bufferMinutes || 0, timezone || 'Europe/Paris', isPublic ? 1 : 0, useJitsi ? 1 : 0);
  return getDb().prepare('SELECT * FROM booking_event_types WHERE id = ?').get(res.lastInsertRowid);
}

function updateEventType(id, fields) {
  const allowed = ['title', 'slug', 'description', 'duration_minutes', 'color', 'fallback_visio_url', 'is_active', 'buffer_minutes', 'timezone', 'is_public', 'use_jitsi'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = ?`);
      vals.push(fields[key]);
    }
  }
  if (sets.length === 0) return getEventTypeById(id);
  vals.push(id);
  getDb().prepare(`UPDATE booking_event_types SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  return getEventTypeById(id);
}

function deleteEventType(id) {
  return getDb().prepare('DELETE FROM booking_event_types WHERE id = ?').run(id);
}

// ── Availability Rules ──────────────────────────────────────────────────

function getAvailabilityRules(teacherId) {
  return getDb().prepare(
    'SELECT * FROM booking_availability_rules WHERE teacher_id = ? AND is_active = 1 ORDER BY day_of_week, start_time'
  ).all(teacherId);
}

function setAvailabilityRules(teacherId, rules) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM booking_availability_rules WHERE teacher_id = ?').run(teacherId);
    const ins = db.prepare(
      'INSERT INTO booking_availability_rules (teacher_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)'
    );
    for (const rule of rules) {
      ins.run(teacherId, rule.dayOfWeek, rule.startTime, rule.endTime);
    }
  });
  tx();
  return getAvailabilityRules(teacherId);
}

// ── Availability Overrides ─────────────────────────────────────────────

function getAvailabilityOverrides(eventTypeId, fromDate, toDate) {
  let sql = 'SELECT * FROM booking_availability_overrides WHERE event_type_id = ?';
  const params = [eventTypeId];
  if (fromDate) { sql += ' AND override_date >= ?'; params.push(fromDate); }
  if (toDate) { sql += ' AND override_date <= ?'; params.push(toDate); }
  sql += ' ORDER BY override_date, start_time';
  return getDb().prepare(sql).all(...params);
}

function setAvailabilityOverrides(eventTypeId, overrides) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM booking_availability_overrides WHERE event_type_id = ?').run(eventTypeId);
    const ins = db.prepare(
      'INSERT INTO booking_availability_overrides (event_type_id, override_date, start_time, end_time, is_blocked) VALUES (?, ?, ?, ?, ?)'
    );
    for (const o of overrides) {
      ins.run(eventTypeId, o.overrideDate, o.startTime || null, o.endTime || null, o.isBlocked ? 1 : 0);
    }
  });
  tx();
  return getAvailabilityOverrides(eventTypeId);
}

// ── Booking Tokens ──────────────────────────────────────────────────────

function getOrCreateToken(eventTypeId, studentId) {
  const db = getDb();
  const existing = db.prepare(
    'SELECT * FROM booking_tokens WHERE event_type_id = ? AND student_id = ?'
  ).get(eventTypeId, studentId);
  if (existing) return existing;
  const token = secureToken();
  const res = db.prepare(
    'INSERT INTO booking_tokens (event_type_id, student_id, token) VALUES (?, ?, ?)'
  ).run(eventTypeId, studentId, token);
  return db.prepare('SELECT * FROM booking_tokens WHERE id = ?').get(res.lastInsertRowid);
}

function getTokenData(token) {
  const db = getDb();
  const row = db.prepare(`
    SELECT bt.id, bt.event_type_id, bt.student_id, bt.token, bt.created_at,
           bet.teacher_id, bet.title AS event_title, bet.slug, bet.description,
           bet.duration_minutes, bet.color, bet.fallback_visio_url, bet.buffer_minutes, bet.timezone,
           bet.is_active AS event_type_active, bet.use_jitsi,
           s.name AS student_name, s.email AS student_email, u.name AS teacher_name
    FROM booking_tokens bt
    JOIN booking_event_types bet ON bet.id = bt.event_type_id
    JOIN students s ON s.id = bt.student_id
    JOIN users u ON u.id = bet.teacher_id
    WHERE bt.token = ?
  `).get(token);
  return row || null;
}

/**
 * Charge un event-type "public" via son slug (lien Calendly ouvert).
 * Renvoie le row sans filtrer is_public/is_active : a l'appelant de
 * decider si le statut "desactive" doit etre distingue du "introuvable"
 * (utile pour afficher un message specifique a l'etudiant).
 * Champs alignes sur getTokenData() pour reutiliser generateSlots / createBookingAtomic.
 */
function getPublicEventTypeBySlug(slug) {
  return getDb().prepare(`
    SELECT bet.id           AS event_type_id,
           bet.teacher_id,
           bet.title        AS event_title,
           bet.slug,
           bet.description,
           bet.duration_minutes,
           bet.color,
           bet.fallback_visio_url,
           bet.buffer_minutes,
           bet.timezone,
           bet.is_active    AS event_type_active,
           bet.is_public,
           bet.use_jitsi,
           u.name           AS teacher_name
    FROM booking_event_types bet
    JOIN users u ON u.id = bet.teacher_id
    WHERE bet.slug = ?
  `).get(slug) || null;
}

// ── Bookings ────────────────────────────────────────────────────────────

/**
 * Atomic check-then-insert in a transaction (TOCTOU-safe).
 * `bufferMinutes` etend la fenetre de conflit : on bloque si un autre booking
 * (confirme) tombe dans [start - buffer, end + buffer]. Le buffer vient du
 * booking_event_types et traduit le temps de repos voulu entre 2 RDV.
 */
function createBookingAtomic({ eventTypeId, studentId, teacherId, tutorName, tutorEmail, startDatetime, endDatetime, bufferMinutes = 0 }) {
  const db = getDb();
  const cancelToken = secureToken();
  const bufferMs = Math.max(0, Number(bufferMinutes) || 0) * 60000;
  const windowStart = new Date(new Date(startDatetime).getTime() - bufferMs).toISOString();
  const windowEnd   = new Date(new Date(endDatetime).getTime() + bufferMs).toISOString();
  const tx = db.transaction(() => {
    const conflicts = db.prepare(`
      SELECT id FROM bookings
      WHERE teacher_id = ? AND status = 'confirmed'
      AND start_datetime < ? AND end_datetime > ?
    `).all(teacherId, windowEnd, windowStart);
    if (conflicts.length > 0) return null;
    const res = db.prepare(`
      INSERT INTO bookings (event_type_id, student_id, teacher_id, tutor_name, tutor_email, start_datetime, end_datetime, cancel_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(eventTypeId, studentId, teacherId, tutorName, tutorEmail, startDatetime, endDatetime, cancelToken);
    return db.prepare('SELECT * FROM bookings WHERE id = ?').get(res.lastInsertRowid);
  });
  return tx();
}

/** Update booking with Teams join URL and Outlook event ID after creation */
function updateBookingTeamsInfo(bookingId, { teamsJoinUrl, outlookEventId }) {
  getDb().prepare(
    'UPDATE bookings SET teams_join_url = ?, outlook_event_id = ? WHERE id = ?'
  ).run(teamsJoinUrl || null, outlookEventId || null, bookingId);
}

function getBookingByCancelToken(cancelToken) {
  return getDb().prepare(`
    SELECT b.*, bet.title AS event_title, bet.duration_minutes, bet.slug AS event_slug, bet.is_public,
           s.name AS student_name, u.name AS teacher_name
    FROM bookings b
    JOIN booking_event_types bet ON bet.id = b.event_type_id
    LEFT JOIN students s ON s.id = b.student_id
    JOIN users u ON u.id = b.teacher_id
    WHERE b.cancel_token = ?
  `).get(cancelToken) || null;
}

function cancelBooking(id) {
  getDb().prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(id);
}

function getBookingsForTeacher(teacherId, { from, to } = {}) {
  let sql = 'SELECT b.*, bet.title AS event_title FROM bookings b JOIN booking_event_types bet ON bet.id = b.event_type_id WHERE b.teacher_id = ?';
  const params = [teacherId];
  // Use overlap check: include bookings that overlap with the [from, to] window
  if (from) { sql += ' AND b.end_datetime > ?'; params.push(from); }
  if (to) { sql += ' AND b.start_datetime < ?'; params.push(to); }
  sql += " AND b.status = 'confirmed' ORDER BY b.start_datetime ASC";
  return getDb().prepare(sql).all(...params);
}

function getBookingsForSlot(teacherId, startDatetime, endDatetime) {
  return getDb().prepare(`
    SELECT * FROM bookings
    WHERE teacher_id = ? AND status = 'confirmed'
    AND start_datetime < ? AND end_datetime > ?
  `).all(teacherId, endDatetime, startDatetime);
}

/** Load a booking limited to a booking token's scope (event_type + student). Retourne null si mismatch. */
function getBookingForToken(bookingId, token) {
  return getDb().prepare(`
    SELECT b.*, bet.title AS event_title, bet.duration_minutes, u.name AS teacher_name
    FROM bookings b
    JOIN booking_tokens bt       ON bt.event_type_id = b.event_type_id AND bt.student_id = b.student_id
    JOIN booking_event_types bet ON bet.id = b.event_type_id
    JOIN users u                 ON u.id = b.teacher_id
    WHERE b.id = ? AND bt.token = ?
  `).get(bookingId, token) || null;
}

// ── Microsoft Tokens ────────────────────────────────────────────────────

function getMicrosoftToken(teacherId) {
  return getDb().prepare('SELECT * FROM microsoft_tokens WHERE teacher_id = ?').get(teacherId) || null;
}

function saveMicrosoftToken(teacherId, { accessTokenEnc, refreshTokenEnc, expiresAt }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO microsoft_tokens (teacher_id, access_token_enc, refresh_token_enc, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(teacher_id) DO UPDATE SET
      access_token_enc = excluded.access_token_enc,
      refresh_token_enc = excluded.refresh_token_enc,
      expires_at = excluded.expires_at,
      updated_at = datetime('now')
  `).run(teacherId, accessTokenEnc, refreshTokenEnc, expiresAt);
}

function deleteMicrosoftToken(teacherId) {
  getDb().prepare('DELETE FROM microsoft_tokens WHERE teacher_id = ?').run(teacherId);
}

// ── OAuth State (CSRF protection, DB-backed) ───────────────────────────

function saveOAuthState(nonce, teacherId, ttlMs = 10 * 60 * 1000) {
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  getDb().prepare(
    'INSERT INTO oauth_states (nonce, teacher_id, expires_at) VALUES (?, ?, ?)'
  ).run(nonce, teacherId, expiresAt);
}

/** Consume a one-time OAuth state nonce. Returns teacherId or null. */
function consumeOAuthState(nonce) {
  const db = getDb();
  const row = db.prepare(
    "SELECT teacher_id FROM oauth_states WHERE nonce = ? AND expires_at > datetime('now')"
  ).get(nonce);
  db.prepare('DELETE FROM oauth_states WHERE nonce = ?').run(nonce);
  return row?.teacher_id ?? null;
}

/** Opportunistic cleanup of expired states (called on each generation). */
function pruneExpiredOAuthStates() {
  getDb().prepare("DELETE FROM oauth_states WHERE expires_at <= datetime('now')").run();
}

// ── Reminders ──────────────────────────────────────────────────────────

function createBookingReminder(bookingId, type, scheduledAt) {
  getDb().prepare(
    'INSERT OR IGNORE INTO booking_reminders (booking_id, type, scheduled_at) VALUES (?, ?, ?)'
  ).run(bookingId, type, scheduledAt);
}

function getDueReminders() {
  return getDb().prepare(`
    SELECT br.*, b.tutor_name, b.tutor_email, b.start_datetime, b.end_datetime,
           b.teacher_id, b.teams_join_url, b.status,
           bet.title AS event_title, u.name AS teacher_name
    FROM booking_reminders br
    JOIN bookings b ON b.id = br.booking_id
    JOIN booking_event_types bet ON bet.id = b.event_type_id
    JOIN users u ON u.id = b.teacher_id
    WHERE br.sent_at IS NULL AND br.scheduled_at <= datetime('now')
    AND b.status = 'confirmed'
    LIMIT 50
  `).all();
}

function markReminderSent(id) {
  getDb().prepare("UPDATE booking_reminders SET sent_at = datetime('now') WHERE id = ?").run(id);
}

// ── Reschedule ─────────────────────────────────────────────────────────

function rescheduleBooking(bookingId) {
  const db = getDb();
  db.prepare("UPDATE bookings SET status = 'rescheduled' WHERE id = ? AND status = 'confirmed'").run(bookingId);
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId);
  return booking || null;
}

function getBookingById(id) {
  return getDb().prepare(`
    SELECT b.*, bet.title AS event_title, bet.duration_minutes,
           s.name AS student_name, s.email AS student_email, u.name AS teacher_name
    FROM bookings b
    JOIN booking_event_types bet ON bet.id = b.event_type_id
    LEFT JOIN students s ON s.id = b.student_id
    JOIN users u ON u.id = b.teacher_id
    WHERE b.id = ?
  `).get(id) || null;
}

module.exports = {
  getEventTypes, getEventTypeBySlug, getEventTypeById,
  createEventType, updateEventType, deleteEventType,
  getAvailabilityRules, setAvailabilityRules,
  getAvailabilityOverrides, setAvailabilityOverrides,
  getOrCreateToken, getTokenData, getPublicEventTypeBySlug,
  createBookingAtomic, updateBookingTeamsInfo,
  getBookingByCancelToken, getBookingById, getBookingForToken, cancelBooking, rescheduleBooking,
  getBookingsForTeacher, getBookingsForSlot,
  getMicrosoftToken, saveMicrosoftToken, deleteMicrosoftToken,
  saveOAuthState, consumeOAuthState, pruneExpiredOAuthStates,
  createBookingReminder, getDueReminders, markReminderSent,
};
