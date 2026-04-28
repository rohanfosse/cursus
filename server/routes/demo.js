/**
 * Routes du mode demo (sandbox sans inscription).
 *
 * - POST /start  : cree une nouvelle session demo (token + dataset seed)
 * - POST /end    : termine la session, purge le tenant
 * - GET  /status : health check (sessions actives, prochain reset)
 *
 * Routes "applicatives" en mode demo (lecture/ecriture sur le tenant) :
 * - GET  /promotions
 * - GET  /channels?promoId=
 * - GET  /channels/:id/messages
 * - POST /channels/:id/messages
 * - GET  /assignments?channelId=
 *
 * Toutes les routes /api/demo/* (sauf /start) passent par le middleware
 * `demoMode` qui populate `req.tenantId` et `req.demoUser`.
 */
const router  = require('express').Router()
const jwt     = require('jsonwebtoken')
const crypto  = require('crypto')
const rateLimit = require('express-rate-limit')

const { getDemoDb, purgeExpiredSessions } = require('../db/demo-connection')
const { seedTenant } = require('../db/demo-seed')
const { demoMode } = require('../middleware/demoMode')

const SESSION_TTL_HOURS = 24

// Rate limit anti-abus : 5 demarrages par IP par heure (l'utilisateur n'a
// aucune raison legitime de creer 6 sessions en 1h).
const startLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  skip: () => process.env.NODE_ENV === 'test',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: () => 'demo-start',
  message: { ok: false, error: 'Trop de demarrages de demo. Reessayez dans une heure.' },
  validate: { xForwardedForHeader: false, keyGeneratorIpFallback: false },
})

// ──────────────────────────────────────────────────────────────────────
//  POST /api/demo/start { role: 'teacher'|'student' }
// ──────────────────────────────────────────────────────────────────────
router.post('/start', startLimiter, (req, res) => {
  const role = req.body?.role === 'teacher' ? 'teacher' : 'student'
  const db = getDemoDb()

  // Purge opportuniste avant de creer une nouvelle session (pas de cron en MVP).
  try { purgeExpiredSessions() } catch { /* non-blocking */ }

  const sessionId = crypto.randomUUID()
  const tenantId  = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3600_000).toISOString()

  let seedResult
  try {
    seedResult = seedTenant(db, tenantId, role)
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Erreur creation session demo : ' + err.message })
  }

  const { currentUser } = seedResult

  db.prepare(
    `INSERT INTO demo_sessions (id, tenant_id, role, user_id, user_name, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(sessionId, tenantId, role, currentUser.id, currentUser.name, expiresAt)

  const secret = req.app.get('jwtSecret')
  const token  = 'demo-' + jwt.sign(
    { scope: 'demo', sessionId, tenantId, role },
    secret,
    { expiresIn: SESSION_TTL_HOURS + 'h' },
  )

  res.json({
    ok: true,
    data: {
      token,
      currentUser,
      expiresAt,
      message: 'Session demo demarree. Donnees ephemeres, reset apres 24h.',
    },
  })
})

// ──────────────────────────────────────────────────────────────────────
//  Routes authentifiees (toutes derriere demoMode)
// ──────────────────────────────────────────────────────────────────────
router.use(demoMode)

// POST /api/demo/end : termine la session courante.
router.post('/end', (req, res) => {
  const db = getDemoDb()
  const tenantId = req.tenantId
  const txn = db.transaction(() => {
    const tables = [
      'demo_promotions', 'demo_channels', 'demo_students', 'demo_teachers',
      'demo_messages', 'demo_assignments', 'demo_sessions',
    ]
    for (const t of tables) {
      db.prepare(`DELETE FROM ${t} WHERE tenant_id = ?`).run(tenantId)
    }
  })
  txn()
  res.json({ ok: true, data: null })
})

// ──────────────────────────────────────────────────────────────────────
//  Routes applicatives (lecture/ecriture dans le tenant)
// ──────────────────────────────────────────────────────────────────────

// GET /api/demo/promotions
router.get('/promotions', (req, res) => {
  const rows = getDemoDb()
    .prepare(`SELECT id, name, color FROM demo_promotions WHERE tenant_id = ? ORDER BY id`)
    .all(req.tenantId)
  res.json({ ok: true, data: rows })
})

// GET /api/demo/promotions/:id/channels
router.get('/promotions/:promoId/channels', (req, res) => {
  const rows = getDemoDb().prepare(
    `SELECT id, promo_id, name, type, description, category, is_private, archived, created_at
     FROM demo_channels
     WHERE tenant_id = ? AND promo_id = ?
     ORDER BY id`
  ).all(req.tenantId, Number(req.params.promoId))
  res.json({ ok: true, data: rows })
})

// GET /api/demo/promotions/:id/students
router.get('/promotions/:promoId/students', (req, res) => {
  const rows = getDemoDb().prepare(
    `SELECT id, promo_id, name, email, avatar_initials, photo_data
     FROM demo_students
     WHERE tenant_id = ? AND promo_id = ?
     ORDER BY name`
  ).all(req.tenantId, Number(req.params.promoId))
  res.json({ ok: true, data: rows })
})

// GET /api/demo/messages/channel/:channelId/page
router.get('/messages/channel/:channelId/page', (req, res) => {
  const rows = getDemoDb().prepare(
    `SELECT
       id, channel_id, dm_student_id, author_id, author_name, author_type,
       author_initials, author_photo, content, reactions, is_pinned, edited, created_at
     FROM demo_messages
     WHERE tenant_id = ? AND channel_id = ?
     ORDER BY id ASC
     LIMIT 100`
  ).all(req.tenantId, Number(req.params.channelId))
  res.json({ ok: true, data: { messages: rows, hasMore: false } })
})

// POST /api/demo/messages
router.post('/messages', (req, res) => {
  const { channelId, content } = req.body || {}
  if (!channelId || typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ ok: false, error: 'channelId et content requis.' })
  }
  if (content.length > 10_000) {
    return res.status(400).json({ ok: false, error: 'Message trop long (max 10000 caracteres).' })
  }

  const u = req.demoUser
  // L'init du seed renvoie un objet "currentUser" complet ; ici on a juste
  // les champs minimaux dans le JWT/session, donc on reconstruit pour le
  // message en cherchant les initiales depuis la table students/teachers.
  const db = getDemoDb()
  let initials = ''
  if (u.type === 'teacher') {
    const t = db.prepare(`SELECT name FROM demo_teachers WHERE id = ? AND tenant_id = ?`).get(-u.id, req.tenantId)
    initials = (t?.name || u.name).split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
  } else {
    const s = db.prepare(`SELECT avatar_initials FROM demo_students WHERE id = ? AND tenant_id = ?`).get(u.id, req.tenantId)
    initials = s?.avatar_initials || u.name.slice(0, 2).toUpperCase()
  }

  const result = db.prepare(
    `INSERT INTO demo_messages
       (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(req.tenantId, Number(channelId), u.id, u.name, u.type, initials, content.trim())

  const msg = db.prepare(
    `SELECT id, channel_id, dm_student_id, author_id, author_name, author_type,
            author_initials, author_photo, content, reactions, is_pinned, edited, created_at
     FROM demo_messages WHERE id = ?`
  ).get(result.lastInsertRowid)

  res.json({ ok: true, data: msg })
})

// GET /api/demo/assignments?channelId=
router.get('/assignments', (req, res) => {
  const channelId = Number(req.query.channelId)
  const rows = getDemoDb().prepare(
    `SELECT id, channel_id, title, description, type, deadline, is_published, created_at
     FROM demo_assignments
     WHERE tenant_id = ? ${channelId ? 'AND channel_id = ?' : ''}
     ORDER BY deadline ASC NULLS LAST`
  ).all(...(channelId ? [req.tenantId, channelId] : [req.tenantId]))
  res.json({ ok: true, data: rows })
})

// GET /api/demo/presence
// Retourne une liste fake d'utilisateurs "en ligne" + 0-1 typing en cours.
// La selection varie au cours du temps (rotation toutes les ~30s) pour
// donner l'illusion d'une promo vivante (cf. jalon V3 du brief demo).
router.get('/presence', (req, res) => {
  const db = getDemoDb()
  const tenantId = req.tenantId
  const all = db.prepare(
    `SELECT id, name, avatar_initials FROM demo_students WHERE tenant_id = ?
     UNION ALL
     SELECT -id AS id, name, NULL AS avatar_initials FROM demo_teachers WHERE tenant_id = ?`
  ).all(tenantId, tenantId)
  if (!all.length) return res.json({ ok: true, data: { online: [], typing: null } })

  // Selection deterministe par fenetre de 30s : tous les visiteurs voient
  // la meme rotation a un instant donne, mais ca change toutes les 30s.
  // 3-4 users online sur ~7 disponibles.
  const seed = Math.floor(Date.now() / 30_000)
  const shuffled = [...all].sort((a, b) => {
    const ha = (a.id * 9301 + seed * 49297) % 233280
    const hb = (b.id * 9301 + seed * 49297) % 233280
    return ha - hb
  })
  const onlineCount = 3 + (seed % 2) // 3 ou 4
  const online = shuffled.slice(0, onlineCount).map(u => ({
    id: u.id,
    name: u.name,
    role: u.id < 0 ? 'teacher' : 'student',
    status: null,
  }))

  // Typing : 30% de chance qu'un user (parmi online, pas le current user)
  // soit en train de taper dans un canal aleatoire.
  let typing = null
  if (Math.random() < 0.3) {
    const candidate = online.find(u => u.id !== req.demoUser.id)
    const channels = db.prepare(
      `SELECT id FROM demo_channels WHERE tenant_id = ?`
    ).all(tenantId)
    if (candidate && channels.length) {
      const ch = channels[Math.floor(Math.random() * channels.length)]
      typing = { channelId: ch.id, userName: candidate.name }
    }
  }

  res.json({ ok: true, data: { online, typing } })
})

// GET /api/demo/status (compteurs internes, pas auth-protege puisque post-demoMode)
router.get('/status', (req, res) => {
  const db = getDemoDb()
  const counts = {
    messages:    db.prepare(`SELECT COUNT(*) c FROM demo_messages WHERE tenant_id = ?`).get(req.tenantId).c,
    channels:    db.prepare(`SELECT COUNT(*) c FROM demo_channels WHERE tenant_id = ?`).get(req.tenantId).c,
    assignments: db.prepare(`SELECT COUNT(*) c FROM demo_assignments WHERE tenant_id = ?`).get(req.tenantId).c,
  }
  res.json({ ok: true, data: { tenant: req.tenantId, counts } })
})

// ──────────────────────────────────────────────────────────────────────
//  Endpoints "lecture vide" pour modules non couverts par le MVP (V2).
//
//  Le shim web reroute automatiquement /api/* -> /api/demo/* quand le
//  token est `demo-`. Sans ces handlers, tous les fetchs des pages
//  Booking/Documents/Lumen/Live/etc. tombent en 404 et le frontend
//  affiche des erreurs reseau.
//
//  Strategie : on retourne des listes vides ou des objets minimaux
//  pour que le frontend affiche son empty state naturellement. Les
//  ecritures sont rejetees explicitement avec un code stable que le
//  frontend peut detecter via `restrictAction()` du composable
//  useDemoMode (cf. V3 pour le vrai support).
// ──────────────────────────────────────────────────────────────────────

// ── Booking ──────────────────────────────────────────────────────────
router.get('/booking/event-types', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/booking/availabilities', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/booking/bookings', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/booking/campaigns', (_req, res) => res.json({ ok: true, data: [] }))

// ── Documents ────────────────────────────────────────────────────────
// Le visiteur qui ouvre le panneau Documents d'un canal doit voir un mini
// catalogue : sinon il pense que la feature est vide. On renvoie des docs
// fictifs avec types varies (PDF/DOCX/XLSX/lien externe/notebook) — la
// liste est partagee entre tous les canaux pour rester simple.
const DEMO_DOCUMENTS = (channelId, promoId) => {
  const day = (n) => new Date(Date.now() - n * 86400_000).toISOString()
  return [
    { id: 1001, channel_id: channelId, promo_id: promoId, category: 'Cours',     type: 'pdf',      name: 'Cours - Tri rapide.pdf',       path_or_url: 'https://example.com/cours-tri.pdf',     content: 'https://example.com/cours-tri.pdf',     description: '12 pages - complexite et implementations',    file_size: 2_413_120, travail_id: null, travail_title: null, created_at: day(20) },
    { id: 1002, channel_id: channelId, promo_id: promoId, category: 'Cours',     type: 'pdf',      name: 'Cours - Arbres AVL.pdf',        path_or_url: 'https://example.com/cours-avl.pdf',     content: 'https://example.com/cours-avl.pdf',     description: '8 pages - rotations et invariant equilibre',  file_size: 1_184_320, travail_id: null, travail_title: null, created_at: day(15) },
    { id: 1003, channel_id: channelId, promo_id: promoId, category: 'TP',        type: 'docx',     name: 'Sujet TP - Routage.docx',       path_or_url: 'https://example.com/tp-routage.docx',  content: 'https://example.com/tp-routage.docx',  description: 'Sujet du TP4 - 3 pages',                       file_size:   181_248, travail_id: null, travail_title: null, created_at: day(10) },
    { id: 1004, channel_id: channelId, promo_id: promoId, category: 'TP',        type: 'xlsx',     name: 'Notes - Algo S1.xlsx',          path_or_url: 'https://example.com/notes-s1.xlsx',    content: 'https://example.com/notes-s1.xlsx',    description: 'Releve des notes du semestre 1',              file_size:    96_768, travail_id: null, travail_title: null, created_at: day(8) },
    { id: 1005, channel_id: channelId, promo_id: promoId, category: 'Externe',   type: 'link',     name: 'GitHub - Projet Web E4',         path_or_url: 'https://github.com/cesi/projet-web-e4', content: 'https://github.com/cesi/projet-web-e4', description: 'Repo template avec CI deja configuree',       file_size: null,      travail_id: null, travail_title: null, created_at: day(5) },
    { id: 1006, channel_id: channelId, promo_id: promoId, category: 'Externe',   type: 'link',     name: 'Visualiseur AVL interactif',     path_or_url: 'https://www.cs.usfca.edu/~galles/visualization/AVLtree.html', content: 'https://www.cs.usfca.edu/~galles/visualization/AVLtree.html', description: 'Outil web pour voir les rotations en direct', file_size: null, travail_id: null, travail_title: null, created_at: day(4) },
    { id: 1007, channel_id: channelId, promo_id: promoId, category: 'Ressource', type: 'notebook', name: 'main_test.ipynb',                path_or_url: 'https://example.com/notebook.ipynb',   content: 'https://example.com/notebook.ipynb',   description: 'Tests interactifs Python pour le tri',        file_size:    62_464, travail_id: null, travail_title: null, created_at: day(2) },
  ]
}
router.get('/documents/channel/:id', (req, res) => {
  res.json({ ok: true, data: DEMO_DOCUMENTS(Number(req.params.id), null) })
})
router.get('/documents/promo/:promoId', (req, res) => {
  res.json({ ok: true, data: DEMO_DOCUMENTS(null, Number(req.params.promoId)) })
})
router.get('/documents/project', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/documents/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim()
  if (!q) return res.json({ ok: true, data: [] })
  const all = DEMO_DOCUMENTS(null, null)
  res.json({ ok: true, data: all.filter(d => d.name.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q)) })
})

// ── Bookmarks / signets ──────────────────────────────────────────────
router.get('/bookmarks', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/bookmarks/ids', (_req, res) => res.json({ ok: true, data: [] }))

// ── Teachers (pour les DMs cote etudiant) ─────────────────────────────
router.get('/teachers', (req, res) => {
  // Renvoie le prof demo seul, format identique a la prod (id negatif).
  const t = getDemoDb().prepare(
    `SELECT id, name FROM demo_teachers WHERE tenant_id = ?`
  ).get(req.tenantId)
  if (!t) return res.json({ ok: true, data: [] })
  const initials = t.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
  res.json({ ok: true, data: [{
    id: -t.id,
    name: t.name,
    promo_id: null,
    promo_name: null,
    avatar_initials: initials,
    photo_data: null,
    type: 'teacher',
  }]})
})

// ── DMs (vides en MVP V2 — V3 ajoutera des conversations seedees) ────
router.get('/messages/dm/:studentId/page', (_req, res) =>
  res.json({ ok: true, data: { messages: [], hasMore: false } }),
)
router.get('/messages/dm-files', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/messages/pinned/:channelId', (req, res) => {
  // Lit les messages reellement epingles dans le seed (is_pinned=1) pour
  // que la liste "Messages epingles" affiche du contenu — sinon le visiteur
  // qui clique l'icone epingle voit toujours "Aucun message epingle".
  const rows = getDemoDb().prepare(
    `SELECT id, channel_id, author_id, author_name, author_type, author_initials,
            content, reactions, is_pinned, created_at
     FROM demo_messages
     WHERE tenant_id = ? AND channel_id = ? AND is_pinned = 1
     ORDER BY created_at DESC`
  ).all(req.tenantId, Number(req.params.channelId))
  res.json({ ok: true, data: rows })
})
router.post('/messages/reactions', (_req, res) => res.json({ ok: true, data: null }))

// ── Recherche (pas de FTS en demo, retourne vide) ────────────────────
router.get('/messages/search', (_req, res) => res.json({ ok: true, data: [] }))
router.post('/messages/search-all', (_req, res) => res.json({ ok: true, data: [] }))

// ── Live / Lumen / Kanban / Devoirs avances : non implementes ────────
// Session Live "fake en cours" : permet au visiteur etudiant de voir
// immediatement le bouton "Rejoindre la session" sur le dashboard. La
// session est purement decorative (rejoindre redirige vers /live qui
// affichera le LiveBoard vide), mais elle materialise la feature.
router.get('/live/sessions/promo/:id/active', (req, res) => {
  const teacher = getDemoDb().prepare(
    `SELECT id, name FROM demo_teachers WHERE tenant_id = ?`
  ).get(req.tenantId)
  res.json({
    ok: true,
    data: {
      id: 'demo-live-1',
      promo_id: Number(req.params.id),
      teacher_id: teacher ? -teacher.id : -1,
      teacher_name: teacher?.name || 'Prof. Lemaire',
      title: 'Quiz Algo - Arbres AVL',
      status: 'active',
      join_code: 'AVL-2026',
      is_async: 0,
      open_until: null,
      created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      ended_at: null,
      activities: [],
    },
  })
})
router.get('/live/sessions/promo/:id/history', (_req, res) => {
  // Historique des 3 dernieres sessions Live finies — donne du contexte au
  // dashboard etudiant (vu deja, peux y revenir pour les replays).
  const day = (n) => new Date(Date.now() - n * 86400_000).toISOString()
  res.json({
    ok: true,
    data: [
      { id: 'demo-live-h1', title: 'Quiz Web - Auth & JWT',     status: 'ended', participant_count: 18, activity_count: 8,  ended_at: day(2) },
      { id: 'demo-live-h2', title: 'Pulse - Retour mi-semestre', status: 'ended', participant_count: 16, activity_count: 4,  ended_at: day(7) },
      { id: 'demo-live-h3', title: 'Code partage - Tri rapide', status: 'ended', participant_count: 14, activity_count: 12, ended_at: day(10) },
    ],
  })
})
router.get('/lumen/repos/promo/:id', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/lumen/github/me', (_req, res) =>
  res.json({ ok: true, data: { connected: false } }),
)
router.get('/kanban/travaux/:travailId/groups/:groupId', (_req, res) =>
  res.json({ ok: true, data: [] }),
)

// ── Calendar ─────────────────────────────────────────────────────────
router.get('/calendar/feed-token', (_req, res) =>
  res.json({ ok: true, data: { token: null } }),
)

// ── Reminders / suivi ────────────────────────────────────────────────
router.get('/admin/rappels', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/admin/feedback/mine', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/teacher-notes/student/:id', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/teacher-notes/promo/:id', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/teacher-notes/promo/:id/summary', (_req, res) => res.json({ ok: true, data: [] }))

// ── Engagement / scheduled ───────────────────────────────────────────
router.get('/engagement/:promoId', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/scheduled', (_req, res) => res.json({ ok: true, data: [] }))

// ── Signatures ───────────────────────────────────────────────────────
router.get('/signatures', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/signatures/pending-count', (_req, res) =>
  res.json({ ok: true, data: { count: 0 } }),
)

// ──────────────────────────────────────────────────────────────────────
//  Fallback global : tout endpoint non explicitement defini retourne un
//  payload "vide" pour les GET et un refus explicite pour les ecritures.
//
//  Ca evite que l'app crash quand le frontend appelle un endpoint encore
//  non implemente cote demo (cas typique : une nouvelle feature ajoutee
//  dans la prod sans toucher au shim demo). Le frontend voit `[]` et
//  affiche son empty state.
// ──────────────────────────────────────────────────────────────────────
router.use((req, res) => {
  if (req.method === 'GET') {
    return res.json({ ok: true, data: [], _demoFallback: true })
  }
  res.status(403).json({
    ok: false,
    error: 'Cette action n\'est pas disponible en mode demo. Cree un compte pour la debloquer.',
    _demoFallback: true,
  })
})

module.exports = router
