/**
 * Model Booking — CRUD pour types d'evenements, regles de dispo,
 * tokens de reservation et reservations.
 */
const { getDb } = require('../connection');
const { v4: uuidv4 } = require('uuid');

// ── Event Types ─────────────────────────────────────────────────────────

function getEventTypes(teacherId) {
  return getDb().prepare(
    'SELECT * FROM booking_event_types WHERE teacher_id = ? ORDER BY created_at DESC'
  ).all(teacherId);
}

function getEventTypeBySlug(slug) {
  return getDb().prepare('SELECT * FROM booking_event_types WHERE slug = ?').get(slug) || null;
}

function getEventTypeById(id) {
  return getDb().prepare('SELECT * FROM booking_event_types WHERE id = ?').get(id) || null;
}

function createEventType({ teacherId, title, slug, description, durationMinutes, color, fallbackVisioUrl }) {
  const res = getDb().prepare(
    'INSERT INTO booking_event_types (teacher_id, title, slug, description, duration_minutes, color, fallback_visio_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(teacherId, title, slug, description || null, durationMinutes || 30, color || '#3b82f6', fallbackVisioUrl || null);
  return getDb().prepare('SELECT * FROM booking_event_types WHERE id = ?').get(res.lastInsertRowid);
}

function updateEventType(id, fields) {
  const allowed = ['title', 'description', 'duration_minutes', 'color', 'fallback_visio_url', 'is_active'];
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

// ── Booking Tokens ──────────────────────────────────────────────────────

function getOrCreateToken(eventTypeId, studentId) {
  const db = getDb();
  const existing = db.prepare(
    'SELECT * FROM booking_tokens WHERE event_type_id = ? AND student_id = ?'
  ).get(eventTypeId, studentId);
  if (existing) return existing;
  const token = uuidv4();
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
           bet.duration_minutes, bet.color, bet.fallback_visio_url,
           bet.is_active AS event_type_active,
           s.name AS student_name, s.email AS student_email, u.name AS teacher_name
    FROM booking_tokens bt
    JOIN booking_event_types bet ON bet.id = bt.event_type_id
    JOIN students s ON s.id = bt.student_id
    JOIN users u ON u.id = bet.teacher_id
    WHERE bt.token = ?
  `).get(token);
  return row || null;
}

// ── Bookings ────────────────────────────────────────────────────────────

function createBooking({ eventTypeId, studentId, teacherId, tutorName, tutorEmail, startDatetime, endDatetime, teamsJoinUrl, outlookEventId }) {
  const cancelToken = uuidv4();
  const res = getDb().prepare(`
    INSERT INTO bookings (event_type_id, student_id, teacher_id, tutor_name, tutor_email, start_datetime, end_datetime, teams_join_url, outlook_event_id, cancel_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(eventTypeId, studentId, teacherId, tutorName, tutorEmail, startDatetime, endDatetime, teamsJoinUrl || null, outlookEventId || null, cancelToken);
  return getDb().prepare('SELECT * FROM bookings WHERE id = ?').get(res.lastInsertRowid);
}

function getBookingByCancelToken(cancelToken) {
  return getDb().prepare(`
    SELECT b.*, bet.title AS event_title, bet.duration_minutes,
           s.name AS student_name, u.name AS teacher_name
    FROM bookings b
    JOIN booking_event_types bet ON bet.id = b.event_type_id
    JOIN students s ON s.id = b.student_id
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
  if (from) { sql += ' AND b.start_datetime >= ?'; params.push(from); }
  if (to) { sql += ' AND b.start_datetime <= ?'; params.push(to); }
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

module.exports = {
  getEventTypes, getEventTypeBySlug, getEventTypeById,
  createEventType, updateEventType, deleteEventType,
  getAvailabilityRules, setAvailabilityRules,
  getOrCreateToken, getTokenData,
  createBooking, getBookingByCancelToken, cancelBooking,
  getBookingsForTeacher, getBookingsForSlot,
  getMicrosoftToken, saveMicrosoftToken, deleteMicrosoftToken,
};
