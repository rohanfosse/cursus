// ─── Requêtes administration ─────────────────────────────────────────────────
const { getDb } = require('../connection')

// ── Statistiques applicatives ────────────────────────────────────────────────

function getAdminStats() {
  const db = getDb()

  // Compteurs globaux
  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM students)   AS students,
      (SELECT COUNT(*) FROM teachers)   AS teachers,
      (SELECT COUNT(*) FROM promotions) AS promotions,
      (SELECT COUNT(*) FROM channels)   AS channels,
      (SELECT COUNT(*) FROM messages)   AS messages,
      (SELECT COUNT(*) FROM travaux)    AS travaux,
      (SELECT COUNT(*) FROM depots)     AS depots
  `).get()

  // Activité dernières 24h
  const activity24h = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM messages WHERE created_at >= datetime('now', '-1 day')) AS messages_24h,
      (SELECT COUNT(*) FROM depots   WHERE submitted_at >= datetime('now', '-1 day')) AS depots_24h
  `).get()

  // Messages par jour (30 derniers jours)
  const messagesPerDay = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS count
    FROM messages
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all()

  // Dépôts par jour (30 derniers jours)
  const depotsPerDay = db.prepare(`
    SELECT date(submitted_at) AS day, COUNT(*) AS count
    FROM depots
    WHERE submitted_at >= datetime('now', '-30 days')
    GROUP BY date(submitted_at)
    ORDER BY day ASC
  `).all()

  // Top 10 canaux par volume de messages
  const topChannels = db.prepare(`
    SELECT c.name, p.name AS promo_name, COUNT(m.id) AS message_count
    FROM channels c
    JOIN promotions p ON c.promo_id = p.id
    JOIN messages m ON m.channel_id = c.id
    GROUP BY c.id
    ORDER BY message_count DESC
    LIMIT 10
  `).all()

  // Distribution des notes
  const gradeDistribution = db.prepare(`
    SELECT
      CASE
        WHEN CAST(note AS REAL) >= 16 THEN 'A (16-20)'
        WHEN CAST(note AS REAL) >= 14 THEN 'B (14-16)'
        WHEN CAST(note AS REAL) >= 12 THEN 'C (12-14)'
        WHEN CAST(note AS REAL) >= 10 THEN 'D (10-12)'
        WHEN CAST(note AS REAL) >= 8  THEN 'E (8-10)'
        ELSE 'F (<8)'
      END AS range,
      COUNT(*) AS count
    FROM depots
    WHERE note IS NOT NULL AND note != ''
    GROUP BY range
    ORDER BY range ASC
  `).all()

  // Dépôts en retard
  const lateCount = db.prepare(`
    SELECT COUNT(*) AS count
    FROM depots d
    JOIN travaux t ON d.travail_id = t.id
    WHERE d.submitted_at > t.deadline
  `).get()

  // Non notés
  const ungradedCount = db.prepare(`
    SELECT COUNT(*) AS count
    FROM depots WHERE note IS NULL OR note = ''
  `).get()

  // Moyenne générale
  const avgGrade = db.prepare(`
    SELECT AVG(CAST(note AS REAL)) AS avg
    FROM depots WHERE note IS NOT NULL AND note != ''
  `).get()

  // Résumé par promo
  const promosSummary = db.prepare(`
    SELECT p.id, p.name, p.color, COALESCE(p.archived, 0) AS archived,
      (SELECT COUNT(*) FROM students s WHERE s.promo_id = p.id) AS student_count,
      (SELECT COUNT(*) FROM channels c WHERE c.promo_id = p.id) AS channel_count,
      (SELECT COUNT(*) FROM travaux t WHERE t.promo_id = p.id AND t.published = 1) AS travaux_count,
      (SELECT AVG(CAST(d.note AS REAL))
       FROM depots d JOIN travaux t2 ON d.travail_id = t2.id
       WHERE t2.promo_id = p.id AND d.note IS NOT NULL AND d.note != '') AS avg_grade
    FROM promotions p
    ORDER BY p.name
  `).all()

  return {
    counts,
    activity24h,
    messagesPerDay,
    depotsPerDay,
    topChannels,
    gradeDistribution,
    lateCount: lateCount.count,
    ungradedCount: ungradedCount.count,
    avgGrade: avgGrade.avg ? Math.round(avgGrade.avg * 100) / 100 : null,
    promosSummary,
  }
}

// ── Gestion des utilisateurs ─────────────────────────────────────────────────

function getAdminUsers({ search, promo_id, type, page = 1, limit = 50 }) {
  const db = getDb()
  const offset = (page - 1) * limit

  let users = []

  // Étudiants
  if (!type || type === 'student') {
    let sql = `
      SELECT s.id, s.name, s.email, s.avatar_initials, s.photo_data,
             'student' AS type, s.promo_id, p.name AS promo_name, p.color AS promo_color,
             s.must_change_password
      FROM students s JOIN promotions p ON s.promo_id = p.id
      WHERE 1=1
    `
    const params = []
    if (search) { sql += ` AND (s.name LIKE ? OR s.email LIKE ?)`; params.push(`%${search}%`, `%${search}%`) }
    if (promo_id) { sql += ` AND s.promo_id = ?`; params.push(promo_id) }
    sql += ` ORDER BY s.name`
    users.push(...db.prepare(sql).all(...params))
  }

  // Enseignants / TAs
  if (!type || type === 'teacher' || type === 'ta') {
    let sql = `
      SELECT t.id, t.name, t.email, t.role AS type, t.must_change_password
      FROM teachers t WHERE 1=1
    `
    const params = []
    if (type === 'teacher') { sql += ` AND t.role = 'teacher'`; }
    else if (type === 'ta') { sql += ` AND t.role = 'ta'`; }
    if (search) { sql += ` AND (t.name LIKE ? OR t.email LIKE ?)`; params.push(`%${search}%`, `%${search}%`) }
    sql += ` ORDER BY t.name`

    const teachers = db.prepare(sql).all(...params).map(t => ({
      ...t,
      id: -(t.id),
      avatar_initials: t.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2),
      photo_data: null,
      promo_id: null,
      promo_name: null,
      promo_color: null,
    }))
    users.push(...teachers)
  }

  const total = users.length
  return { users: users.slice(offset, offset + limit), total, page, limit }
}

function getAdminUserDetail(userId) {
  const db = getDb()
  const isTeacher = userId < 0
  const realId = Math.abs(userId)

  let user
  if (isTeacher) {
    const t = db.prepare('SELECT * FROM teachers WHERE id = ?').get(realId)
    if (!t) return null
    user = {
      id: -(t.id), name: t.name, email: t.email, type: t.role,
      avatar_initials: t.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2),
      promo_name: null, promo_id: null,
    }
  } else {
    user = db.prepare(`
      SELECT s.id, s.name, s.email, s.avatar_initials, s.photo_data,
             'student' AS type, s.promo_id, p.name AS promo_name
      FROM students s JOIN promotions p ON s.promo_id = p.id
      WHERE s.id = ?
    `).get(realId)
    if (!user) return null
  }

  // Activité
  const messageCount = db.prepare(
    `SELECT COUNT(*) AS count FROM messages WHERE author_name = ?`
  ).get(user.name)

  const lastMessage = db.prepare(
    `SELECT MAX(created_at) AS last FROM messages WHERE author_name = ?`
  ).get(user.name)

  const depotCount = isTeacher ? { count: 0 } : db.prepare(
    `SELECT COUNT(*) AS count FROM depots WHERE student_id = ?`
  ).get(realId)

  return {
    ...user,
    messageCount: messageCount.count,
    lastMessageAt: lastMessage.last,
    depotCount: depotCount.count,
  }
}

// ── Modération de contenu ────────────────────────────────────────────────────

function getAdminMessages({ search, promo_id, channel_id, author, from, to, page = 1, limit = 50 }) {
  const db = getDb()
  const offset = (page - 1) * limit
  const params = []

  let sql = `
    SELECT m.id, m.content, m.author_name, m.author_type, m.created_at, m.edited,
           c.name AS channel_name, p.name AS promo_name
    FROM messages m
    LEFT JOIN channels c ON m.channel_id = c.id
    LEFT JOIN promotions p ON c.promo_id = p.id
    WHERE m.channel_id IS NOT NULL
  `
  if (search)     { sql += ` AND m.content LIKE ?`;      params.push(`%${search}%`) }
  if (promo_id)   { sql += ` AND c.promo_id = ?`;        params.push(promo_id) }
  if (channel_id) { sql += ` AND m.channel_id = ?`;      params.push(channel_id) }
  if (author)     { sql += ` AND m.author_name LIKE ?`;   params.push(`%${author}%`) }
  if (from)       { sql += ` AND m.created_at >= ?`;      params.push(from) }
  if (to)         { sql += ` AND m.created_at <= ?`;      params.push(to) }

  const countSql = sql.replace(/SELECT .+? FROM/, 'SELECT COUNT(*) AS total FROM')
  const total = db.prepare(countSql).get(...params).total

  sql += ` ORDER BY m.created_at DESC LIMIT ? OFFSET ?`
  params.push(limit, offset)

  return { messages: db.prepare(sql).all(...params), total, page, limit }
}

function getAdminChannels() {
  return getDb().prepare(`
    SELECT c.id, c.name, c.type, c.category, c.is_private,
           p.name AS promo_name, p.color AS promo_color,
           (SELECT COUNT(*) FROM messages m WHERE m.channel_id = c.id) AS message_count,
           (SELECT MAX(m.created_at) FROM messages m WHERE m.channel_id = c.id) AS last_activity
    FROM channels c
    JOIN promotions p ON c.promo_id = p.id
    ORDER BY last_activity DESC NULLS LAST
  `).all()
}

// ── Signalements ─────────────────────────────────────────────────────────────

function createReport({ messageId, reporterId, reporterName, reporterType, reason, details }) {
  return getDb().prepare(`
    INSERT INTO reports (message_id, reporter_id, reporter_name, reporter_type, reason, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(messageId, reporterId, reporterName, reporterType, reason || 'other', details || null)
}

function getReports({ status, page = 1, limit = 50 }) {
  const db = getDb()
  const offset = (page - 1) * limit
  const params = []
  let where = ''
  if (status) { where = ' WHERE r.status = ?'; params.push(status) }

  const total = db.prepare(`SELECT COUNT(*) AS c FROM reports r${where}`).get(...params).c

  const entries = db.prepare(`
    SELECT r.*, m.content AS message_content, m.author_name AS message_author,
           c.name AS channel_name, p.name AS promo_name
    FROM reports r
    LEFT JOIN messages m ON r.message_id = m.id
    LEFT JOIN channels c ON m.channel_id = c.id
    LEFT JOIN promotions p ON c.promo_id = p.id
    ${where}
    ORDER BY r.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset)

  return { entries, total, page, limit }
}

function resolveReport(reportId, status, resolvedBy) {
  return getDb().prepare(`
    UPDATE reports SET status = ?, resolved_at = datetime('now'), resolved_by = ? WHERE id = ?
  `).run(status, resolvedBy, reportId)
}

function getPendingReportsCount() {
  return getDb().prepare(`SELECT COUNT(*) AS count FROM reports WHERE status = 'pending'`).get().count
}

// ── Heatmap d'activité ───────────────────────────────────────────────────────

function getActivityHeatmap() {
  return getDb().prepare(`
    SELECT
      CAST(strftime('%w', created_at) AS INTEGER) AS day_of_week,
      CAST(strftime('%H', created_at) AS INTEGER) AS hour,
      COUNT(*) AS count
    FROM messages
    WHERE created_at >= datetime('now', '-90 days')
    GROUP BY day_of_week, hour
    ORDER BY day_of_week, hour
  `).all()
}

// ── Annonces planifiées ──────────────────────────────────────────────────────

function getScheduledMessages() {
  return getDb().prepare(`
    SELECT sm.*, c.name AS channel_name, p.name AS promo_name
    FROM scheduled_messages sm
    JOIN channels c ON sm.channel_id = c.id
    JOIN promotions p ON c.promo_id = p.id
    ORDER BY sm.send_at ASC
  `).all()
}

function createScheduledMessage({ channelId, authorName, authorType, content, sendAt }) {
  return getDb().prepare(`
    INSERT INTO scheduled_messages (channel_id, author_name, author_type, content, send_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(channelId, authorName, authorType, content, sendAt)
}

function deleteScheduledMessage(id) {
  return getDb().prepare('DELETE FROM scheduled_messages WHERE id = ? AND sent = 0').run(id)
}

function getDueScheduledMessages() {
  return getDb().prepare(`
    SELECT * FROM scheduled_messages
    WHERE sent = 0 AND send_at <= datetime('now')
  `).all()
}

function markScheduledSent(id) {
  return getDb().prepare('UPDATE scheduled_messages SET sent = 1 WHERE id = ?').run(id)
}

// ── Sessions actives ─────────────────────────────────────────────────────────

function upsertSession({ userId, userName, userType, tokenHash, ip, userAgent }) {
  return getDb().prepare(`
    INSERT INTO active_sessions (user_id, user_name, user_type, token_hash, ip, user_agent)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(token_hash) DO UPDATE SET last_seen = datetime('now'), ip = excluded.ip
  `).run(userId, userName, userType, tokenHash, ip, userAgent)
}

function getActiveSessions() {
  return getDb().prepare(`
    SELECT * FROM active_sessions
    WHERE last_seen >= datetime('now', '-7 days')
    ORDER BY last_seen DESC
  `).all()
}

function revokeSession(sessionId) {
  return getDb().prepare('DELETE FROM active_sessions WHERE id = ?').run(sessionId)
}

function revokeUserSessions(userId) {
  return getDb().prepare('DELETE FROM active_sessions WHERE user_id = ?').run(userId)
}

// ── Config globale ───────────────────────────────────────────────────────────

function getAppConfig(key) {
  const row = getDb().prepare('SELECT value FROM app_config WHERE key = ?').get(key)
  return row ? row.value : null
}

function setAppConfig(key, value) {
  return getDb().prepare(`
    INSERT INTO app_config (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value))
}

// ── Archivage promos ─────────────────────────────────────────────────────────

function togglePromoArchive(promoId, archived) {
  return getDb().prepare('UPDATE promotions SET archived = ? WHERE id = ?').run(archived ? 1 : 0, promoId)
}

// ── Feedback étudiants ───────────────────────────────────────────────────────

function createFeedback({ userId, userName, userType, type, title, description }) {
  return getDb().prepare(`
    INSERT INTO feedback (user_id, user_name, user_type, type, title, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, userName, userType, type, title, description || '').lastInsertRowid
}

function getFeedbackList({ status, type, limit = 50, offset = 0 }) {
  const db = getDb()
  let where = '1=1'
  const params = []
  if (status) { where += ' AND f.status = ?'; params.push(status) }
  if (type)   { where += ' AND f.type = ?';   params.push(type) }
  const total = db.prepare(`SELECT COUNT(*) AS c FROM feedback f WHERE ${where}`).get(...params).c
  const items = db.prepare(`
    SELECT f.* FROM feedback f
    WHERE ${where}
    ORDER BY f.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset)
  return { total, items }
}

function updateFeedbackStatus(id, status, adminReply) {
  const resolvedAt = (status === 'resolved' || status === 'wontfix') ? new Date().toISOString() : null
  return getDb().prepare(`
    UPDATE feedback SET status = ?, admin_reply = ?, resolved_at = ? WHERE id = ?
  `).run(status, adminReply || null, resolvedAt, id)
}

function getFeedbackStats() {
  const db = getDb()
  return {
    open:        db.prepare(`SELECT COUNT(*) AS c FROM feedback WHERE status = 'open'`).get().c,
    in_progress: db.prepare(`SELECT COUNT(*) AS c FROM feedback WHERE status = 'in_progress'`).get().c,
    resolved:    db.prepare(`SELECT COUNT(*) AS c FROM feedback WHERE status = 'resolved'`).get().c,
    total:       db.prepare(`SELECT COUNT(*) AS c FROM feedback`).get().c,
  }
}

function getUserFeedback(userId) {
  return getDb().prepare(`SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC`).all(userId)
}

// ── Métriques de visites ────────────────────────────────────────────────────

function recordVisit({ userId, userName, userType, path }) {
  try {
    return getDb().prepare(`
      INSERT INTO page_visits (user_id, user_name, user_type, path)
      VALUES (?, ?, ?, ?)
    `).run(userId, userName, userType, path)
  } catch { /* table peut ne pas exister en migration */ }
}

function getVisitStats() {
  const db = getDb()

  const dau = db.prepare(`
    SELECT COUNT(DISTINCT user_id) AS count
    FROM page_visits WHERE created_at >= datetime('now', '-1 day')
  `).get()

  const wau = db.prepare(`
    SELECT COUNT(DISTINCT user_id) AS count
    FROM page_visits WHERE created_at >= datetime('now', '-7 days')
  `).get()

  const mau = db.prepare(`
    SELECT COUNT(DISTINCT user_id) AS count
    FROM page_visits WHERE created_at >= datetime('now', '-30 days')
  `).get()

  const visitsPerDay = db.prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS count, COUNT(DISTINCT user_id) AS unique_users
    FROM page_visits
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all()

  const topPages = db.prepare(`
    SELECT path, COUNT(*) AS count
    FROM page_visits
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY path
    ORDER BY count DESC
    LIMIT 10
  `).all()

  const visitsPerHour = db.prepare(`
    SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hour, COUNT(*) AS count
    FROM page_visits
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY hour
    ORDER BY hour ASC
  `).all()

  // Connexions réussies / échouées (depuis login_attempts existant)
  const loginStats = db.prepare(`
    SELECT
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successful,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed
    FROM login_attempts
    WHERE created_at >= datetime('now', '-30 days')
  `).get()

  const loginsPerDay = db.prepare(`
    SELECT date(created_at) AS day,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successful,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed
    FROM login_attempts
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all()

  return {
    dau: dau.count,
    wau: wau.count,
    mau: mau.count,
    visitsPerDay,
    topPages,
    visitsPerHour,
    loginStats: { successful: loginStats?.successful ?? 0, failed: loginStats?.failed ?? 0 },
    loginsPerDay,
  }
}

// ── Politique de rétention ───────────────────────────────────────────────────

function purgeOldData({ auditDays = 90, loginDays = 30, sessionDays = 30 }) {
  const db = getDb()
  const results = {}
  try { results.audit = db.prepare(`DELETE FROM audit_log WHERE created_at < datetime('now', '-' || ? || ' days')`).run(auditDays).changes } catch { results.audit = 0 }
  try { results.logins = db.prepare(`DELETE FROM login_attempts WHERE created_at < datetime('now', '-' || ? || ' days')`).run(loginDays).changes } catch { results.logins = 0 }
  try { results.sessions = db.prepare(`DELETE FROM active_sessions WHERE last_seen < datetime('now', '-' || ? || ' days')`).run(sessionDays).changes } catch { results.sessions = 0 }
  try { results.reports = db.prepare(`DELETE FROM reports WHERE status != 'pending' AND created_at < datetime('now', '-' || ? || ' days')`).run(auditDays).changes } catch { results.reports = 0 }
  try { results.visits = db.prepare(`DELETE FROM page_visits WHERE created_at < datetime('now', '-' || ? || ' days')`).run(auditDays).changes } catch { results.visits = 0 }
  return results
}

module.exports = {
  getAdminStats,
  getAdminUsers, getAdminUserDetail,
  getAdminMessages, getAdminChannels,
  // Signalements
  createReport, getReports, resolveReport, getPendingReportsCount,
  // Heatmap
  getActivityHeatmap,
  // Annonces planifiées
  getScheduledMessages, createScheduledMessage, deleteScheduledMessage,
  getDueScheduledMessages, markScheduledSent,
  // Sessions
  upsertSession, getActiveSessions, revokeSession, revokeUserSessions,
  // Config
  getAppConfig, setAppConfig,
  // Archivage
  togglePromoArchive,
  // Rétention
  purgeOldData,
  // Feedback
  createFeedback, getFeedbackList, updateFeedbackStatus, getFeedbackStats, getUserFeedback,
  // Visites
  recordVisit, getVisitStats,
}
