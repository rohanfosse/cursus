/**
 * Endpoints demo qui lisent / ecrivent reellement les tables demo_*
 * (le visiteur a une session active, un tenant_id, et peut interagir).
 *
 * Distinction avec mocks.js : ici les donnees sont persistees pendant
 * la duree de la session et reflechissent ce que l'utilisateur a fait
 * (son message, ses messages epingles, la presence calculee). Les
 * donnees evolutives doivent etre ici, les donnees statiques dans mocks.
 *
 * Tous les handlers supposent `req.tenantId` et `req.demoUser` populates
 * par le middleware `demoMode` (mount fait dans index.js).
 */
const router  = require('express').Router()
const { getDemoDb } = require('../../db/demo-connection')

// ────────────────────────────────────────────────────────────────────
//  Promotions / channels / students
// ────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────
//  Messages (lecture par canal + envoi + epingles)
// ────────────────────────────────────────────────────────────────────

// GET /api/demo/messages/channel/:channelId/page
//
// Le shim cote front (src/web/api-shim.ts getChannelMessagesPage) ainsi que
// le handler prod (server/routes/messages.js) retournent UN ARRAY de Message
// directement dans `data` (le store consomme `page.slice().reverse()`).
// On renvoie donc le meme shape ici, sinon le store en demo lit `data` comme
// un objet { messages, hasMore } et le `.slice()` echoue silencieusement,
// laissant le canal vide a l'ecran. Tri DESC pour matcher la prod.
router.get('/messages/channel/:channelId/page', (req, res) => {
  const rows = getDemoDb().prepare(
    `SELECT
       id, channel_id, dm_student_id, author_id, author_name, author_type,
       author_initials, author_photo, content, reactions, is_pinned, edited, created_at
     FROM demo_messages
     WHERE tenant_id = ? AND channel_id = ?
     ORDER BY id DESC
     LIMIT 100`
  ).all(req.tenantId, Number(req.params.channelId))
  res.json({ ok: true, data: rows })
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

// GET /api/demo/messages/pinned/:channelId
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

// ────────────────────────────────────────────────────────────────────
//  Assignments
// ────────────────────────────────────────────────────────────────────

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

// GET /api/demo/students/:studentId/assignments
//
// Devoirs vus par un etudiant (tous les passes deja notes + tous les futurs).
// L'endpoint synthetise les champs absents du seed (note, feedback, depot_id,
// category) a partir du titre / type / deadline pour rendre le dashboard
// etudiant immediatement parlant : "Mes notes" peuple, "Recents feedbacks"
// peuple, projets categorises, deadlines non vides.
//
// On ne stocke pas note/feedback/depot dans le schema demo_assignments :
// les devoirs etant deterministes par id de seed, generer a la volee evite
// une migration ALTER TABLE. Stable au sein d'une session demo : meme tenant
// -> meme ids -> memes notes affichees.
router.get('/students/:studentId/assignments', (req, res) => {
  const db = getDemoDb()
  // Join sur demo_channels pour exposer channel_name + categorie heritee.
  const rows = db.prepare(
    `SELECT a.id, a.channel_id, a.title, a.description, a.type, a.deadline,
            a.is_published, a.created_at,
            c.name AS channel_name, c.category AS channel_category, c.promo_id
     FROM demo_assignments a
     JOIN demo_channels    c ON c.id = a.channel_id AND c.tenant_id = a.tenant_id
     WHERE a.tenant_id = ?
     ORDER BY a.deadline ASC NULLS LAST`
  ).all(req.tenantId)

  // Pool de feedbacks realistes par type pour la rotation deterministe.
  // Chaque feedback est un paragraphe court qui pourrait sortir d'une vraie
  // grille de notation. La rotation par id evite l'effet "tous identiques".
  const FEEDBACKS = {
    livrable: [
      'Bon travail dans l\'ensemble. Architecture claire, tests presents. Manque un peu de documentation sur les choix de structure de donnees.',
      'Solution correcte et bien documentee. Les benchmarks sont rigoureux. Penser a expliciter la complexite spatiale dans le rapport.',
      'Code propre et lisible. La gestion des cas limites est complete. Quelques noms de variables pourraient gagner en clarte.',
    ],
    soutenance: [
      'Presentation claire, bonne maitrise du sujet. Les Q/R ont montre une bonne comprehension des points sensibles. Diapos un peu chargees.',
      'Demonstration vivante, l\'equipe a su repondre aux questions techniques avec aisance. Travailler la conclusion pour la prochaine soutenance.',
    ],
    cctl: [
      null, // Les cctl/quiz n\'ont pas toujours de feedback ecrit.
      'Bons reflexes sur les complexites, faites attention aux pieges sur les tableaux a indices negatifs.',
    ],
    autre: [null],
  }
  // Notes deterministes : seed sur l'id. Distribution mix (B majoritaire,
  // un peu de A et de C) pour ne pas afficher que des excellents resultats.
  const GRADES = ['B', 'A', 'B', 'C', 'B']

  const now = Date.now()
  const data = rows.map((r) => {
    const isPast = r.deadline && new Date(r.deadline).getTime() < now
    const noteIdx = r.id % GRADES.length
    const note = isPast ? GRADES[noteIdx] : null
    const fbPool = FEEDBACKS[r.type] || FEEDBACKS.autre
    const feedback = isPast ? fbPool[r.id % fbPool.length] : null

    return {
      id: r.id,
      title: r.title,
      description: r.description,
      channel_id: r.channel_id,
      channel_name: r.channel_name,
      type: r.type,
      // Categorie : pour les soutenances et cctls on utilise un libelle
      // explicite afin que les onglets "CCTL/Livrables/Soutenances" du
      // dashboard se peuplent ; pour le reste on prend la categorie du canal.
      category: r.type === 'soutenance' ? 'Soutenances'
              : r.type === 'cctl'       ? 'CCTLs'
              : (r.channel_category || 'Livrables'),
      deadline: r.deadline,
      start_date: null,
      is_published: 1,
      is_graded: isPast ? 1 : 0,
      assigned_to: 'all',
      group_id: null,
      // depot_id non-null = "rendu". Synthetise a `id + 10000` pour les
      // passes ; null pour les futurs (le visiteur peut "soumettre" via
      // l'UI, l'action sera juste mockee).
      depot_id: isPast ? r.id + 10000 : null,
      group_name: null,
      note,
      feedback,
      requires_submission: r.type === 'cctl' ? 0 : 1,
      promo_id: r.promo_id,
      submitted_at: isPast ? new Date(new Date(r.deadline).getTime() - 86400_000).toISOString() : null,
    }
  })

  res.json({ ok: true, data })
})

// ────────────────────────────────────────────────────────────────────
//  Presence (calculee a la volee + 30s window)
// ────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────
//  Status (compteurs de session)
// ────────────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────────────
//  Teachers (pour les DMs cote etudiant)
// ────────────────────────────────────────────────────────────────────

// GET /api/demo/teachers
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

module.exports = router
