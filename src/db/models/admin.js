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
    SELECT p.id, p.name, p.color,
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

module.exports = {
  getAdminStats,
  getAdminUsers, getAdminUserDetail,
  getAdminMessages, getAdminChannels,
}
