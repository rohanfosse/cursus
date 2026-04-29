/**
 * Endpoints fictifs de la demo : retournent des donnees hardcoded ou
 * vides pour les features prod non couvertes par le seed (booking,
 * documents avances, live history, lumen, kanban, signatures, etc.).
 *
 * Le shim web (src/web/api-shim.ts) reroute /api/* -> /api/demo/* quand
 * le token est `demo-`. Sans ces handlers, les fetchs des pages
 * Booking/Documents/Lumen/etc. tomberaient dans le wildcard generique
 * et rendraient l'app vide.
 *
 * Distinction avec real.js : ici les payloads ne dependent pas du
 * tenant_id — meme reponse pour tous les visiteurs. Si un endpoint doit
 * lire / ecrire les tables demo_*, il appartient a real.js.
 *
 * ──────────────────────────────────────────────────────────────────────
 *  Comment ajouter un nouveau mock ?
 * ──────────────────────────────────────────────────────────────────────
 *  1. Identifier l'URL prod (ex: /api/booking/event-types)
 *  2. Identifier le shape attendu cote frontend (Devtools + types)
 *  3. Ajouter `router.get('/booking/event-types', (_, res) => res.json({...}))`
 *     dans la section thematique correspondante
 *  4. Si le shape doit ressembler a la realite, regarder
 *     server/db/models/<feature>.js pour les colonnes effectives
 *  5. Tester en mode demo : ouvrir la page concernee, verifier l'UI
 *
 *  Si l'utilisateur DOIT pouvoir ecrire (POST/PATCH/DELETE), reflechir
 *  d'abord a si c'est un vrai usage demo (creation de message OK,
 *  changement de mot de passe NON). Le wildcard final refuse tout
 *  POST/PATCH/DELETE non-explicite.
 */
const router = require('express').Router()
const { getDemoDb } = require('../../db/demo-connection')

// ── Booking ──────────────────────────────────────────────────────────
// Cote prof, l'onglet Rendez-vous etait totalement vide en demo (3 listes
// renvoyaient []). On peuple avec des donnees realistes pour montrer la
// feature : 3 types de RDV (suivi, soutenance, rattrapage), une grille de
// disponibilites generee pour la semaine courante, 4 bookings deja places.
const BOOKING_EVENT_TYPES = [
  { id: 1, slug: 'suivi-individuel',  name: 'Suivi individuel',  duration_minutes: 30, color: '#0EA5E9', description: 'Point hebdomadaire projet · 30 min en visio',           is_active: 1, location: 'Teams',     created_at: new Date(Date.now() - 30 * 86400_000).toISOString() },
  { id: 2, slug: 'soutenance',        name: 'Soutenance',        duration_minutes: 60, color: '#8B5CF6', description: 'Présentation 20 min + jury (3 personnes)',              is_active: 1, location: 'Salle B204', created_at: new Date(Date.now() - 25 * 86400_000).toISOString() },
  { id: 3, slug: 'rattrapage-cctl',   name: 'Rattrapage CCTL',   duration_minutes: 45, color: '#F59E0B', description: 'Session de rattrapage pour étudiant absent',           is_active: 1, location: 'Teams',     created_at: new Date(Date.now() - 20 * 86400_000).toISOString() },
]
function genBookingAvailabilities() {
  // Genere ~12 creneaux pour les 5 prochains jours ouvres (matin + apres-midi)
  // avec un mix des 3 types. Stable au sein d'une session demo.
  const slots = []
  const days = [1, 2, 3, 4, 5]  // demain a +5 jours
  const hours = [['09:00', 30], ['10:00', 30], ['11:00', 60], ['14:00', 30], ['15:30', 45]]
  let id = 100
  for (const dOff of days) {
    const date = new Date(Date.now() + dOff * 86400_000)
    date.setHours(0, 0, 0, 0)
    for (const [hhmm, dur] of hours) {
      const [h, m] = hhmm.split(':').map(Number)
      const start = new Date(date); start.setHours(h, m, 0, 0)
      const end   = new Date(start); end.setMinutes(end.getMinutes() + dur)
      const eventTypeId = dur === 60 ? 2 : (dur === 45 ? 3 : 1)
      slots.push({
        id: id++,
        event_type_id: eventTypeId,
        start_datetime: start.toISOString(),
        end_datetime:   end.toISOString(),
        is_booked: 0,
      })
    }
  }
  return slots
}
const BOOKING_BOOKINGS = [
  { id: 5001, event_type_id: 1, event_type_name: 'Suivi individuel',  event_type_color: '#0EA5E9', student_id: 1, student_name: 'Emma Lefevre',   student_email: 'emma.lefevre@demo.cursus',   start_datetime: new Date(Date.now() + 1 * 86400_000 + 9  * 3600_000).toISOString(), end_datetime: new Date(Date.now() + 1 * 86400_000 + 9  * 3600_000 + 30 * 60_000).toISOString(), topic: 'Avancement Projet Web E4 — review architecture',     teams_url: 'https://teams.microsoft.com/l/meetup-join/demo-emma',  ics_url: null, status: 'confirmed', created_at: new Date(Date.now() - 3 * 86400_000).toISOString() },
  { id: 5002, event_type_id: 1, event_type_name: 'Suivi individuel',  event_type_color: '#0EA5E9', student_id: 2, student_name: 'Jean Dupont',    student_email: 'jean.dupont@demo.cursus',    start_datetime: new Date(Date.now() + 1 * 86400_000 + 14 * 3600_000).toISOString(), end_datetime: new Date(Date.now() + 1 * 86400_000 + 14 * 3600_000 + 30 * 60_000).toISOString(), topic: 'Question sur les rotations AVL (TP Algo)',           teams_url: 'https://teams.microsoft.com/l/meetup-join/demo-jean',  ics_url: null, status: 'confirmed', created_at: new Date(Date.now() - 2 * 86400_000).toISOString() },
  { id: 5003, event_type_id: 2, event_type_name: 'Soutenance',        event_type_color: '#8B5CF6', student_id: 3, student_name: 'Sara Bouhassoun', student_email: 'sara.bouhassoun@demo.cursus', start_datetime: new Date(Date.now() + 4 * 86400_000 + 10 * 3600_000 + 30 * 60_000).toISOString(), end_datetime: new Date(Date.now() + 4 * 86400_000 + 11 * 3600_000 + 30 * 60_000).toISOString(), topic: 'Soutenance mémoire de stage',                        teams_url: null, ics_url: null, status: 'confirmed', created_at: new Date(Date.now() - 1 * 86400_000).toISOString() },
  { id: 5004, event_type_id: 3, event_type_name: 'Rattrapage CCTL',   event_type_color: '#F59E0B', student_id: 4, student_name: 'Thomas Martin',   student_email: 'thomas.martin@demo.cursus',   start_datetime: new Date(Date.now() + 5 * 86400_000 + 14 * 3600_000).toISOString(), end_datetime: new Date(Date.now() + 5 * 86400_000 + 14 * 3600_000 + 45 * 60_000).toISOString(), topic: 'Rattrapage CCTL Algo — chapitre arbres équilibrés', teams_url: 'https://teams.microsoft.com/l/meetup-join/demo-thomas', ics_url: null, status: 'confirmed', created_at: new Date().toISOString() },
]
const BOOKING_CAMPAIGNS = [
  { id: 91, title: 'Soutenances Projet Web E4 - Janvier', token: 'demo-camp-1', event_type_id: 2, event_type_name: 'Soutenance', target: 'promo', target_id: 1, opens_at: new Date(Date.now() - 2 * 86400_000).toISOString(), closes_at: new Date(Date.now() + 7 * 86400_000).toISOString(), bookings_count: 3, slots_count: 12, status: 'open', created_at: new Date(Date.now() - 5 * 86400_000).toISOString() },
]
router.get('/booking/event-types',    (_req, res) => res.json({ ok: true, data: BOOKING_EVENT_TYPES }))
router.get('/booking/availabilities', (_req, res) => res.json({ ok: true, data: genBookingAvailabilities() }))
router.get('/booking/bookings',       (_req, res) => res.json({ ok: true, data: BOOKING_BOOKINGS }))
router.get('/booking/campaigns',      (_req, res) => res.json({ ok: true, data: BOOKING_CAMPAIGNS }))

// ── Documents ────────────────────────────────────────────────────────
// Le visiteur qui ouvre le panneau Documents d'un canal doit voir un mini
// catalogue : sinon il pense que la feature est vide. On renvoie des docs
// fictifs avec types varies (PDF/DOCX/XLSX/lien externe/notebook) — la
// liste est partagee entre tous les canaux pour rester simple.
const DEMO_DOCUMENTS = (channelId, promoId) => {
  const day = (n) => new Date(Date.now() - n * 86400_000).toISOString()
  return [
    { id: 1001, channel_id: channelId, promo_id: promoId, category: 'Cours',     type: 'pdf',      name: 'Cours - Tri rapide.pdf',     path_or_url: 'https://example.com/cours-tri.pdf',     content: 'https://example.com/cours-tri.pdf',     description: '12 pages - complexite et implementations',    file_size: 2_413_120, travail_id: null, travail_title: null, created_at: day(20) },
    { id: 1002, channel_id: channelId, promo_id: promoId, category: 'Cours',     type: 'pdf',      name: 'Cours - Arbres AVL.pdf',      path_or_url: 'https://example.com/cours-avl.pdf',     content: 'https://example.com/cours-avl.pdf',     description: '8 pages - rotations et invariant equilibre',  file_size: 1_184_320, travail_id: null, travail_title: null, created_at: day(15) },
    { id: 1003, channel_id: channelId, promo_id: promoId, category: 'TP',        type: 'docx',     name: 'Sujet TP - Routage.docx',     path_or_url: 'https://example.com/tp-routage.docx',  content: 'https://example.com/tp-routage.docx',  description: 'Sujet du TP4 - 3 pages',                       file_size:   181_248, travail_id: null, travail_title: null, created_at: day(10) },
    { id: 1004, channel_id: channelId, promo_id: promoId, category: 'TP',        type: 'xlsx',     name: 'Notes - Algo S1.xlsx',        path_or_url: 'https://example.com/notes-s1.xlsx',    content: 'https://example.com/notes-s1.xlsx',    description: 'Releve des notes du semestre 1',              file_size:    96_768, travail_id: null, travail_title: null, created_at: day(8) },
    { id: 1005, channel_id: channelId, promo_id: promoId, category: 'Externe',   type: 'link',     name: 'GitHub - Projet Web E4',       path_or_url: 'https://github.com/cursus-demo/projet-web-e4', content: 'https://github.com/cursus-demo/projet-web-e4', description: 'Repo template avec CI deja configuree',       file_size: null,      travail_id: null, travail_title: null, created_at: day(5) },
    { id: 1006, channel_id: channelId, promo_id: promoId, category: 'Externe',   type: 'link',     name: 'Visualiseur AVL interactif',   path_or_url: 'https://www.cs.usfca.edu/~galles/visualization/AVLtree.html', content: 'https://www.cs.usfca.edu/~galles/visualization/AVLtree.html', description: 'Outil web pour voir les rotations en direct', file_size: null, travail_id: null, travail_title: null, created_at: day(4) },
    { id: 1007, channel_id: channelId, promo_id: promoId, category: 'Ressource', type: 'notebook', name: 'main_test.ipynb',              path_or_url: 'https://example.com/notebook.ipynb',   content: 'https://example.com/notebook.ipynb',   description: 'Tests interactifs Python pour le tri',        file_size:    62_464, travail_id: null, travail_title: null, created_at: day(2) },
  ]
}
router.get('/documents/channel/:id', (req, res) => {
  res.json({ ok: true, data: DEMO_DOCUMENTS(Number(req.params.id), null) })
})
router.get('/documents/promo/:promoId', (req, res) => {
  res.json({ ok: true, data: DEMO_DOCUMENTS(null, Number(req.params.promoId)) })
})
// /documents/project est appele par DocumentsView (page complete des
// documents d'une promo). Sans donnees, le visiteur voit "aucun document"
// et pense que la feature est cassee. On re-utilise DEMO_DOCUMENTS.
router.get('/documents/project', (req, res) => {
  const promoId = req.query.promoId ? Number(req.query.promoId) : null
  res.json({ ok: true, data: DEMO_DOCUMENTS(null, promoId) })
})
router.get('/documents/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim()
  if (!q) return res.json({ ok: true, data: [] })
  const all = DEMO_DOCUMENTS(null, null)
  res.json({ ok: true, data: all.filter(d => d.name.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q)) })
})

// ── Bookmarks / signets etudiant ─────────────────────────────────────
// 4 messages epingles par l'utilisateur courant : un de chaque categorie
// (annonce prof, lien repo, code snippet, devoir). Le widget Signets de
// l'etudiant affiche ces favoris pour acces rapide.
const DEMO_BOOKMARKS = [
  { id: 9001, message_id: 101, channel_id: 1, channel_name: 'annonces', author_name: 'Prof. Lemaire', content: 'Le sujet du Projet Web E4 est en ligne. Equipes de 2-3, deadline vendredi 17h.',  created_at: new Date(Date.now() - 14 * 86400_000).toISOString(), bookmarked_at: new Date(Date.now() - 14 * 86400_000).toISOString() },
  { id: 9002, message_id: 142, channel_id: 2, channel_name: 'algo',     author_name: 'Prof. Lemaire', content: 'Pour la rotation AVL, regardez balanceFactor. Si > 1 et fils gauche < 0 → rotation gauche-droite.', created_at: new Date(Date.now() -  7 * 86400_000).toISOString(), bookmarked_at: new Date(Date.now() -  7 * 86400_000).toISOString() },
  { id: 9003, message_id: 178, channel_id: 3, channel_name: 'projet-web', author_name: 'Emma Lefevre', content: 'J\'ai push l\'archi initiale sur feat/auth-module. Quelqu\'un peut review ?',                       created_at: new Date(Date.now() -  3 * 86400_000).toISOString(), bookmarked_at: new Date(Date.now() -  3 * 86400_000).toISOString() },
  { id: 9004, message_id: 195, channel_id: 2, channel_name: 'algo',     author_name: 'Jean Dupont',   content: 'Visualiseur AVL interactif : https://www.cs.usfca.edu/~galles/visualization/AVLtree.html',          created_at: new Date(Date.now() -  1 * 86400_000).toISOString(), bookmarked_at: new Date(Date.now() -  1 * 86400_000).toISOString() },
]
router.get('/bookmarks',     (_req, res) => res.json({ ok: true, data: DEMO_BOOKMARKS }))
router.get('/bookmarks/ids', (_req, res) => res.json({ ok: true, data: DEMO_BOOKMARKS.map(b => b.message_id) }))

// ── DMs : conversations directes pre-remplies ───────────────────────
// Pour montrer la feature "messages directs" en demo, on genere une
// conversation realiste avec chaque interlocuteur. Le studentId 0 ou -1
// = prof Lemaire (id negatif pour distinguer). Les messages sont alternes
// entre l'utilisateur courant et l'autre, avec timestamps recents.
function genDmConversation(otherId, otherName) {
  const minAgo = (n) => new Date(Date.now() - n * 60_000).toISOString()
  // Conversation differente selon l'interlocuteur
  if (otherId < 0) {
    // DM avec prof Lemaire : suivi pedagogique
    return [
      { id: 4001, channel_id: null, dm_partner_id: otherId, author_id: otherId,  author_name: otherName,        is_self: 0, content: 'Salut Emma, ou tu en es sur le module d\'auth du Projet Web ?', is_pinned: 0, created_at: minAgo(620) },
      { id: 4002, channel_id: null, dm_partner_id: otherId, author_id: 0,        author_name: 'Toi',           is_self: 1, content: 'Le JWT est en place, je termine le refresh token ce soir.',     is_pinned: 0, created_at: minAgo(615) },
      { id: 4003, channel_id: null, dm_partner_id: otherId, author_id: otherId,  author_name: otherName,        is_self: 0, content: 'Top. Push sur feat/auth-module quand tu peux, je review demain matin.', is_pinned: 0, created_at: minAgo(610) },
      { id: 4004, channel_id: null, dm_partner_id: otherId, author_id: 0,        author_name: 'Toi',           is_self: 1, content: 'Ca marche, merci !',                                              is_pinned: 0, created_at: minAgo(608) },
      { id: 4005, channel_id: null, dm_partner_id: otherId, author_id: otherId,  author_name: otherName,        is_self: 0, content: 'Au passage, ton TP3 etait excellent. A. Continue comme ca.',     is_pinned: 0, created_at: minAgo(120) },
    ]
  }
  if (otherId === 1 || otherId === 2) {
    // DM avec un binome / camarade : entraide TP
    return [
      { id: 4101 + otherId * 10, channel_id: null, dm_partner_id: otherId, author_id: otherId, author_name: otherName, is_self: 0, content: 'Tu as commence le TP4 AVL ?',                          is_pinned: 0, created_at: minAgo(180) },
      { id: 4102 + otherId * 10, channel_id: null, dm_partner_id: otherId, author_id: 0,        author_name: 'Toi',     is_self: 1, content: 'Oui, je bloque sur la rotation double. Tu veux qu\'on regarde ensemble ?', is_pinned: 0, created_at: minAgo(175) },
      { id: 4103 + otherId * 10, channel_id: null, dm_partner_id: otherId, author_id: otherId, author_name: otherName, is_self: 0, content: 'Carrement. On se voit a 16h en bibli ?',                is_pinned: 0, created_at: minAgo(170) },
      { id: 4104 + otherId * 10, channel_id: null, dm_partner_id: otherId, author_id: 0,        author_name: 'Toi',     is_self: 1, content: 'Deal.',                                                 is_pinned: 0, created_at: minAgo(168) },
    ]
  }
  // DM par defaut : echange court
  return [
    { id: 4200 + otherId, channel_id: null, dm_partner_id: otherId, author_id: otherId, author_name: otherName, is_self: 0, content: 'Tu sais ou trouver le sujet du TP ?',           is_pinned: 0, created_at: minAgo(60) },
    { id: 4201 + otherId, channel_id: null, dm_partner_id: otherId, author_id: 0,        author_name: 'Toi',     is_self: 1, content: 'Dans #annonces, l\'epingle avec le PDF.',       is_pinned: 0, created_at: minAgo(55) },
    { id: 4202 + otherId, channel_id: null, dm_partner_id: otherId, author_id: otherId, author_name: otherName, is_self: 0, content: 'Trouve, merci !',                                is_pinned: 0, created_at: minAgo(50) },
  ]
}
router.get('/messages/dm/:studentId/page', (req, res) => {
  const sid = Number(req.params.studentId)
  let name = `Etudiant ${sid}`
  try {
    const row = getDemoDb().prepare(
      `SELECT name FROM demo_students WHERE id = ? AND tenant_id = ?`
    ).get(sid, req.tenantId)
    if (row?.name) name = row.name
  } catch { /* fallback */ }
  if (sid < 0) name = 'Prof. Lemaire'

  // Union de la conversation factice (historique) + des messages REELS
  // postes par le visiteur en demo (POST /api/demo/messages avec
  // dmStudentId). Sans ca le visiteur envoie un DM mais ne le voit pas
  // a l'ecran : silencieux + frustrant.
  const fake = genDmConversation(sid, name)
  let real = []
  try {
    const u = req.demoUser
    if (u) {
      // Combine :
      //  - messages sortants : visiteur -> peer (dm_student_id=sid, author=u)
      //  - messages entrants : peer    -> visiteur (dm_student_id=u.id, author=sid)
      // C'est ainsi que les DMs des bots (cf. sendWelcomeDm + bots futurs)
      // remontent dans la conversation que le visiteur ouvre.
      real = getDemoDb().prepare(
        `SELECT id, dm_student_id, author_id, author_name, author_initials,
                content, is_pinned, created_at
         FROM demo_messages
         WHERE tenant_id = ?
           AND channel_id IS NULL
           AND (
                (dm_student_id = ? AND author_id = ?)
             OR (dm_student_id = ? AND author_id = ?)
           )
         ORDER BY datetime(created_at) ASC`
      ).all(req.tenantId, sid, u.id, u.id, sid).map(r => {
        const isSelf = r.author_id === u.id
        return {
          id: 50000 + r.id,
          channel_id: null,
          dm_partner_id: sid,
          author_id: r.author_id,
          author_name: isSelf ? 'Toi' : r.author_name,
          is_self: isSelf ? 1 : 0,
          content: r.content,
          is_pinned: r.is_pinned ? 1 : 0,
          created_at: r.created_at,
        }
      })
    }
  } catch { /* on retombe sur le fake seul */ }
  // Tri chronologique : factice puis real.
  const all = [...fake, ...real].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  res.json({ ok: true, data: all })
})
// Recents DM contacts pour le widget "Conversations directes" du dashboard
router.get('/messages/recent-dm-contacts', (_req, res) => res.json({
  ok: true,
  data: [
    { partner_id: -1, partner_name: 'Prof. Lemaire',     partner_role: 'teacher', avatar_initials: 'PL', last_message: 'Au passage, ton TP3 etait excellent. A. Continue comme ca.',  last_message_at: new Date(Date.now() - 120 * 60_000).toISOString(), unread: 0 },
    { partner_id: 1,  partner_name: 'Emma Lefevre',      partner_role: 'student', avatar_initials: 'EL', last_message: 'Deal.',                                                       last_message_at: new Date(Date.now() - 168 * 60_000).toISOString(), unread: 0 },
    { partner_id: 2,  partner_name: 'Jean Dupont',       partner_role: 'student', avatar_initials: 'JD', last_message: 'Trouve, merci !',                                              last_message_at: new Date(Date.now() - 50 * 60_000).toISOString(),  unread: 1 },
  ],
}))
// Fichiers partages en DM (pour le widget "Mes fichiers")
router.get('/messages/dm-files', (_req, res) => res.json({
  ok: true,
  data: [
    { id: 7001, partner_id: -1, partner_name: 'Prof. Lemaire', file_name: 'Sujet TP4 AVL.pdf',         file_url: 'https://example.com/tp4-avl.pdf',        file_size: 412_000, mime_type: 'application/pdf', shared_at: new Date(Date.now() -  3 * 86400_000).toISOString() },
    { id: 7002, partner_id:  1, partner_name: 'Emma Lefevre',  file_name: 'maquette-projet.fig',        file_url: 'https://example.com/maquette.fig',        file_size: 1_240_000, mime_type: 'application/octet-stream', shared_at: new Date(Date.now() -  2 * 86400_000).toISOString() },
    { id: 7003, partner_id:  1, partner_name: 'Emma Lefevre',  file_name: 'archi-decision.md',          file_url: 'https://example.com/archi.md',           file_size:    8_400, mime_type: 'text/markdown', shared_at: new Date(Date.now() - 18 * 3600_000).toISOString() },
  ],
}))
router.post('/messages/reactions', (_req, res) => res.json({ ok: true, data: null }))

// ── Recherche : LIKE simple sur les messages du seed (pas de FTS) ───
// Le visiteur qui tape "auth" ou "AVL" doit voir des resultats coherents
// avec ce qu'il vient de lire dans les canaux. Limite a 20 hits.
function searchDemoMessages(req, q) {
  if (!q || q.length < 2) return []
  try {
    const rows = getDemoDb().prepare(`
      SELECT m.id, m.channel_id, m.author_name, m.author_initials, m.content, m.created_at,
             c.name AS channel_name
      FROM demo_messages m JOIN demo_channels c ON c.id = m.channel_id AND c.tenant_id = m.tenant_id
      WHERE m.tenant_id = ? AND LOWER(m.content) LIKE LOWER(?)
      ORDER BY m.created_at DESC
      LIMIT 20
    `).all(req.tenantId, `%${q}%`)
    return rows.map(r => ({
      id: r.id, channel_id: r.channel_id, channel_name: r.channel_name,
      author_name: r.author_name, author_initials: r.author_initials,
      content: r.content, created_at: r.created_at,
      // Highlight basique : encadre le terme dans <mark>...</mark>
      preview: r.content.replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>').slice(0, 200),
    }))
  } catch { return [] }
}
router.get('/messages/search', (req, res) => {
  const q = String(req.query.q || '').trim()
  res.json({ ok: true, data: searchDemoMessages(req, q) })
})
router.post('/messages/search-all', (req, res) => {
  const q = String(req.body?.q || '').trim()
  res.json({ ok: true, data: searchDemoMessages(req, q) })
})

// ── Live ─────────────────────────────────────────────────────────────
// Session Live "fake en cours" : permet au visiteur etudiant de voir
// immediatement le bouton "Rejoindre la session" sur le dashboard. La
// session est purement decorative (rejoindre redirige vers /live qui
// affichera le LiveBoard vide), mais elle materialise la feature.
// Activites pretes-a-pousser dans la session active : 4 brouillons couvrant
// les 4 types Live (Spark quiz, Pulse poll, Code, Board). Le prof voit un
// panneau "ready" pretes a etre lancees, l'etudiant qui rejoint voit la
// premiere activite "active" (Quiz Spark) avec ses options.
const ACTIVE_LIVE_ACTIVITIES = [
  {
    id: 1001, type: 'quiz', status: 'active', position: 0,
    title: 'Quel est l\'invariant d\'un arbre AVL ?',
    payload: {
      options: [
        '|balanceFactor| <= 1 sur chaque noeud',
        'profondeur gauche = profondeur droite',
        'tous les fils sont equilibres',
        'la hauteur est exactement log(n)',
      ],
      correct: 0,
      duration_seconds: 30,
    },
    response_count: 7,
    created_at: new Date(Date.now() - 4 * 60_000).toISOString(),
  },
  {
    id: 1002, type: 'pulse', status: 'ready', position: 1,
    title: 'Comment ressens-tu la veille de soutenance ?',
    payload: {
      max_words_per_user: 3,
      placeholder: 'Un mot...',
    },
    response_count: 0,
    created_at: new Date(Date.now() - 2 * 60_000).toISOString(),
  },
  {
    id: 1003, type: 'code', status: 'ready', position: 2,
    title: 'Implementation collaborative : binary_search',
    payload: {
      language: 'python',
      starter: 'def binary_search(arr, target):\n    # complete ici\n    pass',
      duration_seconds: 600,
    },
    response_count: 0,
    created_at: new Date(Date.now() - 90_000).toISOString(),
  },
  {
    id: 1004, type: 'board', status: 'ready', position: 3,
    title: 'Brainstorm : que retenir du sprint ?',
    payload: {
      max_stickies_per_user: 5,
      duration_seconds: 300,
    },
    response_count: 0,
    created_at: new Date(Date.now() - 60_000).toISOString(),
  },
]

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
      title: 'Live Algo · Arbres AVL & soutenance',
      status: 'active',
      join_code: 'AVL-2026',
      is_async: 0,
      open_until: null,
      created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      ended_at: null,
      activities: ACTIVE_LIVE_ACTIVITIES,
    },
  })
})
router.get('/live/sessions/promo/:id/history', (_req, res) => {
  // Historique des sessions Live finies — donne du contexte au dashboard
  // etudiant (vu deja, peut y revenir pour reviser via "Sessions passees"
  // dans StudentLiveView).
  const day = (n) => new Date(Date.now() - n * 86400_000).toISOString()
  res.json({
    ok: true,
    data: [
      { id: 'demo-live-h1', title: 'Quiz Web - Auth & JWT',      status: 'ended', participant_count: 18, activity_count: 4,  ended_at: day(2) },
      { id: 'demo-live-h4', title: 'Quiz Algo - Arbres AVL',     status: 'ended', participant_count: 17, activity_count: 4,  ended_at: day(4) },
      { id: 'demo-live-h2', title: 'Pulse - Retour mi-semestre', status: 'ended', participant_count: 16, activity_count: 2,  ended_at: day(7) },
      { id: 'demo-live-h3', title: 'Code partage - Tri rapide',  status: 'ended', participant_count: 14, activity_count: 1,  ended_at: day(10) },
    ],
  })
})

// Detail d'une session live passee : activites + leaderboard. Affiche
// dans le viewer "Historique" cote prof et permet aux etudiants de
// reviser en mode entrainement (cf. useLiveReplayMode).
//
// Shape des activites = LiveActivity (cf. types/index.ts):
//   - type='qcm' (Spark) avec options en JSON string et correct_answers
//     JSON `[idx]` pour que useLiveReplayMode + buildResponsePayload
//     fonctionnent.
//   - status='closed' + category='spark' pour passer le filtre isSparkType().
const _qcm = (id, title, options, correctIdx) => ({
  id, session_id: 0,
  type: 'qcm', category: 'spark',
  title, options: JSON.stringify(options),
  correct_answers: JSON.stringify([correctIdx]),
  multi: 0, max_words: 0, position: id,
  status: 'closed', started_at: null, closed_at: null,
  timer_seconds: 30,
  content: null, language: null,
})
const LIVE_SESSION_DETAILS = {
  'demo-live-h1': {
    id: 'demo-live-h1', title: 'Quiz Web - Auth & JWT', status: 'ended',
    started_at: new Date(Date.now() - 2 * 86400_000 - 30 * 60_000).toISOString(),
    ended_at:   new Date(Date.now() - 2 * 86400_000).toISOString(),
    activities: [
      _qcm(1, 'Que stocke un JWT ?',                    ['Le mot de passe', 'Un token signe', 'Une session DB', 'Un cookie HTTP'], 1),
      _qcm(2, 'Algo de hash recommande 2024 ?',         ['MD5', 'SHA1', 'argon2id', 'bcrypt seul'], 2),
      _qcm(3, 'CORS empeche...',                        ['Les attaques XSS', 'Les requetes cross-origin non autorisees', 'Les cookies tiers', 'Les redirections'], 1),
      _qcm(4, 'Bonne pratique pour le secret JWT ?',    ['Hardcoder dans le code', 'Variable env + rotation', 'Dans le README', 'Dans localStorage'], 1),
    ],
    leaderboard: [
      { rank: 1, student_id: 1, student_name: 'Emma Lefevre',     score: 4 },
      { rank: 2, student_id: 4, student_name: 'Jean Durand',      score: 4 },
      { rank: 3, student_id: 5, student_name: 'Alice Martin',     score: 3 },
      { rank: 4, student_id: 2, student_name: 'Lucas Bernard',    score: 3 },
      { rank: 5, student_id: 3, student_name: 'Sara Bouhassoun',  score: 2 },
    ],
  },
  'demo-live-h4': {
    id: 'demo-live-h4', title: 'Quiz Algo - Arbres AVL', status: 'ended',
    started_at: new Date(Date.now() - 4 * 86400_000 - 25 * 60_000).toISOString(),
    ended_at:   new Date(Date.now() - 4 * 86400_000).toISOString(),
    activities: [
      _qcm(11, 'Invariant d\'un arbre AVL ?',                ['height(L)=height(R)', '|height(L) - height(R)| <= 1', 'Tous les noeuds equilibres a 0', 'Profondeur fixe O(log n)'], 1),
      _qcm(12, 'Cas necessitant une rotation gauche-droite', ['Insertion a gauche du fils gauche', 'Insertion a droite du fils gauche', 'Insertion a droite du fils droit', 'Insertion a gauche du fils droit'], 1),
      _qcm(13, 'Complexite garantie d\'une insertion AVL ?',  ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], 1),
      _qcm(14, 'Rotation simple : le pivot devient...',      ['Le nouveau fils gauche', 'Le nouveau fils droit', 'La nouvelle racine du sous-arbre', 'Le nouveau frere'], 2),
    ],
    leaderboard: [
      { rank: 1, student_id: 4, student_name: 'Jean Durand',      score: 4 },
      { rank: 2, student_id: 1, student_name: 'Emma Lefevre',     score: 3 },
      { rank: 3, student_id: 6, student_name: 'Mehdi Chaouki',    score: 3 },
      { rank: 4, student_id: 5, student_name: 'Alice Martin',     score: 2 },
      { rank: 5, student_id: 3, student_name: 'Sara Bouhassoun',  score: 2 },
    ],
  },
  'demo-live-h2': {
    id: 'demo-live-h2', title: 'Pulse - Retour mi-semestre', status: 'ended',
    started_at: new Date(Date.now() - 7 * 86400_000 - 20 * 60_000).toISOString(),
    ended_at:   new Date(Date.now() - 7 * 86400_000).toISOString(),
    activities: [
      { id: 5, type: 'pulse', title: 'Comment vous sentez-vous sur le projet ?', words: [{ w: 'motive', s: 14 }, { w: 'curieux', s: 11 }, { w: 'fatigue', s: 8 }, { w: 'stresse', s: 6 }, { w: 'serein', s: 5 }, { w: 'enthousiaste', s: 4 }] },
      { id: 6, type: 'pulse', title: 'Un mot pour la semaine prochaine ?',         words: [{ w: 'sprint', s: 9 }, { w: 'soutenance', s: 7 }, { w: 'reviser', s: 5 }, { w: 'finir', s: 4 }] },
    ],
    leaderboard: [],
  },
  'demo-live-h3': {
    id: 'demo-live-h3', title: 'Code partage - Tri rapide', status: 'ended',
    started_at: new Date(Date.now() - 10 * 86400_000 - 45 * 60_000).toISOString(),
    ended_at:   new Date(Date.now() - 10 * 86400_000).toISOString(),
    activities: [
      { id: 7, type: 'code', title: 'Implementation collaborative quicksort', language: 'python', edit_count: 47, contributor_count: 9 },
    ],
    leaderboard: [],
  },
}
router.get('/live/sessions/:id', (req, res) => {
  const id = req.params.id
  // Session active : on retourne le meme shape que /promo/:id/active mais
  // accessible directement par id (utilise par certains widgets).
  if (id === 'demo-live-1') {
    return res.json({
      ok: true,
      data: {
        id, title: 'Live Algo · Arbres AVL & soutenance',
        status: 'active', join_code: 'AVL-2026', is_async: 0,
        teacher_name: 'Prof. Lemaire',
        created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
        ended_at: null,
        activities: ACTIVE_LIVE_ACTIVITIES,
      },
    })
  }
  const detail = LIVE_SESSION_DETAILS[id]
  if (!detail) return res.status(404).json({ ok: false, error: 'Session introuvable' })
  res.json({ ok: true, data: detail })
})
router.get('/live/sessions/:id/leaderboard', (req, res) => {
  const detail = LIVE_SESSION_DETAILS[req.params.id]
  res.json({ ok: true, data: detail?.leaderboard ?? [] })
})

// Resultats temps-reel d'une activite donnee (utilise par le panneau prof
// "Resultats" en cours de session). Le simulateur (cf. demoBotsAlgo.js)
// fait croitre le compteur et la distribution selon une courbe logistique
// + tirage multinomial. Le prof voit donc 7 -> 12 -> 16 reponses sur 60s
// avec une distribution qui tend vers la verite-terrain.
router.get('/live/activities/:id/results', (req, res) => {
  const { simulateLiveResults } = require('../../services/demoBotsAlgo')
  const aid = Number(req.params.id)
  if (aid === 1001) {
    // Cible : 17 etudiants, 70% sur la bonne reponse, distractors degressifs
    return res.json({
      ok: true,
      data: simulateLiveResults(`${req.tenantId}|${aid}`, {
        type: 'quiz',
        total: 17,
        distribution: [12, 2, 1, 2], // 70% / 12% / 6% / 12%
        correct: 0,
      }),
    })
  }
  // Activites ready : pas encore de reponses
  res.json({ ok: true, data: { type: 'unknown', total_responses: 0, distribution: [], last_response_at: null } })
})

// Soumission d'une reponse depuis l'etudiant (utilise par le mode entrainement
// "Sessions passees" cote StudentLiveView). On retrouve l'activite dans nos
// LIVE_SESSION_DETAILS, on compare la reponse aux correct_answers, et on
// renvoie le shape LiveScoreResult attendu par useLiveReplayMode.submit().
router.post('/live/activities/:id/respond', (req, res) => {
  const aid = Number(req.params.id)
  // Cherche l'activite dans toutes les sessions historiques
  let activity = null
  for (const s of Object.values(LIVE_SESSION_DETAILS)) {
    activity = s.activities.find(a => a.id === aid)
    if (activity) break
  }
  if (!activity) {
    // Activite inconnue (ex. session active) : fallback neutre
    return res.json({ ok: true, data: { isCorrect: null, points: 0, rank: null } })
  }

  const submitted = Array.isArray(req.body?.answers) ? req.body.answers : []
  let correct = []
  try { correct = JSON.parse(activity.correct_answers || '[]') } catch { /* fallback []*/ }
  const isCorrect = correct.length > 0
    && submitted.length === correct.length
    && correct.every(idx => submitted.includes(idx))
  const points = isCorrect ? 1000 : 0
  res.json({ ok: true, data: { isCorrect, points, rank: null } })
})

// Stats agregees de la promo cote Live (widget "Stats Live" dashboard prof)
router.get('/live/sessions/promo/:id/stats', (_req, res) => res.json({
  ok: true,
  data: {
    sessions_total: 4,
    sessions_this_month: 2,
    avg_participation: 16,        // moy 16 etudiants par session
    avg_correct_rate: 0.74,       // 74% de bonnes reponses moyenne
    activities_total: 24,
    most_active_student: { id: 1, name: 'Emma Lefevre', sessions: 4, avg_score: 0.92 },
  },
}))

// ── Lumen ────────────────────────────────────────────────────────────
//
// On materialise 2 repos pedagogiques pour que la sidebar Lumen ne soit
// pas vide en demo : "cursus-demo/algo-l1" (3 chapitres markdown lies aux
// devoirs d'algo) et "cursus-demo/web-fullstack" (3 chapitres dont le
// projet web). Le
// contenu markdown est sert depuis ce fichier — pas de vraie connexion
// GitHub en demo. Les paths "ch01.md" sont stables, le content endpoint
// les retrouve par path.
//
// promoId varie par session demo, mais le reste est statique : on memoize
// par promoId pour eviter de reconstruire l'array a chaque GET.
const _lumenReposCache = new Map()
function buildLumenRepos(promoId) {
  return [
  {
    id: 9001,
    promoId,
    owner: 'cursus-demo',
    repo: 'algo-l1',
    fullName: 'cursus-demo/algo-l1',
    defaultBranch: 'main',
    manifest: {
      project: 'Algorithmique L1',
      module: 'Informatique fondamentale',
      author: 'Prof. Lemaire',
      summary: 'Cours d\'algorithmique de la Licence Informatique L3 : structures de donnees, complexite et algorithmes classiques.',
      kind: 'course',
      audience: 'promo',
      autoGenerated: true,
      chapters: [
        { title: 'Tri rapide',                path: 'ch01-tri-rapide.md',  duration: 30, summary: 'Quicksort, partitionnement et complexite.', kind: 'markdown' },
        { title: 'Arbres AVL',                path: 'ch02-arbres-avl.md',  duration: 45, summary: 'Arbres binaires equilibres et rotations.',   kind: 'markdown' },
        { title: 'Programmation dynamique',   path: 'ch03-prog-dyn.md',    duration: 40, summary: 'Memoization, sous-problemes optimaux.',     kind: 'markdown' },
      ],
      resources: [],
    },
    manifestError: null,
    lastCommitSha: 'a1b2c3d4',
    lastSyncedAt: new Date(Date.now() - 6 * 3600_000).toISOString(),
    projectId: null,
    projectName: 'Algorithmique',
    isVisible: true,
  },
  {
    id: 9002,
    promoId,
    owner: 'cursus-demo',
    repo: 'web-fullstack',
    fullName: 'cursus-demo/web-fullstack',
    defaultBranch: 'main',
    manifest: {
      project: 'Developpement Web Fullstack',
      module: 'Projet E4',
      author: 'Prof. Lemaire',
      summary: 'Du HTML/CSS au deploiement : fondamentaux frontend, auth JWT et CI/CD pour le Projet Web E4.',
      kind: 'course',
      audience: 'promo',
      autoGenerated: true,
      chapters: [
        { title: 'HTML / CSS Layout',         path: 'ch01-layout.md',      duration: 35, summary: 'Flexbox, grid, responsive design.',         kind: 'markdown' },
        { title: 'Authentification & JWT',    path: 'ch02-auth-jwt.md',    duration: 40, summary: 'Sessions, JWT, hashing avec argon2.',       kind: 'markdown' },
        { title: 'Projet Web E4',             path: 'ch03-projet-e4.md',   duration: 60, summary: 'Cahier des charges complet du livrable.',   kind: 'markdown' },
      ],
      resources: [],
    },
    manifestError: null,
    lastCommitSha: 'e5f6g7h8',
    lastSyncedAt: new Date(Date.now() - 24 * 3600_000).toISOString(),
    projectId: null,
    projectName: 'Developpement Web',
    isVisible: true,
  },
  ]
}
function getLumenRepos(promoId) {
  let cached = _lumenReposCache.get(promoId)
  if (!cached) { cached = buildLumenRepos(promoId); _lumenReposCache.set(promoId, cached) }
  return cached
}

// Contenus markdown courts mais credibles pour les chapitres seedes. Un
// visiteur qui ouvre Lumen verra des cours rendus avec titres, paragraphes,
// blocs de code et formules KaTeX — pas une page vide.
const LUMEN_CHAPTER_CONTENTS = {
  'ch01-tri-rapide.md': {
    content: '# Tri rapide (Quicksort)\n\nLe **tri rapide** est un algorithme de tri par comparaison qui suit le paradigme **diviser pour regner**.\n\n## Principe\n\n1. Choisir un *pivot* dans le tableau.\n2. Partitionner : tous les elements plus petits a gauche, plus grands a droite.\n3. Trier recursivement chaque sous-tableau.\n\n## Complexite\n\n- Cas moyen : $O(n \\log n)$\n- Pire cas : $O(n^2)$ (pivot deja trie)\n- Espace : $O(\\log n)$ (pile recursive)\n\n## Implementation\n\n```python\ndef quicksort(arr):\n    if len(arr) <= 1:\n        return arr\n    pivot = arr[len(arr) // 2]\n    left = [x for x in arr if x < pivot]\n    middle = [x for x in arr if x == pivot]\n    right = [x for x in arr if x > pivot]\n    return quicksort(left) + middle + quicksort(right)\n```\n\n> **Astuce** : pour eviter le pire cas, choisir un pivot aleatoire (Lomuto random) ou le median-of-three.\n\n## Exercice\n\nVoir le devoir lie : **TP3 Tri rapide** (rendu dans le tab Devoirs).',
    sha: 'sha-tri-rapide',
  },
  'ch02-arbres-avl.md': {
    content: '# Arbres AVL\n\nUn **arbre AVL** est un arbre binaire de recherche **auto-equilibre** : la difference de hauteur entre les sous-arbres gauche et droit de chaque noeud est au plus 1.\n\n## Invariant\n\nPour chaque noeud $v$ : $|h(\\text{gauche}) - h(\\text{droite})| \\leq 1$\n\n## Rotations\n\nQuand un desequilibre apparait apres insertion ou suppression, on retablit avec :\n\n- **Rotation gauche** (cas RR)\n- **Rotation droite** (cas LL)\n- **Rotation gauche-droite** (cas LR)\n- **Rotation droite-gauche** (cas RL)\n\n```python\ndef rotate_lr(node):\n    """Cas LR : rotation gauche du fils gauche, puis rotation droite."""\n    node.left = rotate_left(node.left)\n    return rotate_right(node)\n```\n\n## Complexite\n\n- Recherche, insertion, suppression : $O(\\log n)$ **garanti**\n- Espace : $O(n)$\n\n## Devoir lie\n\n**TP4 Arbres AVL** : implementer les 4 rotations et un benchmark vs BST classique.',
    sha: 'sha-arbres-avl',
  },
  'ch03-prog-dyn.md': {
    content: '# Programmation dynamique\n\nLa **programmation dynamique** (PD) resout des problemes en les decoupant en sous-problemes qui se chevauchent. La cle : memoiser pour ne pas recalculer.\n\n## Pattern\n\n1. Identifier la **structure recursive** du probleme.\n2. Definir l\'**etat** (souvent un tuple).\n3. Ecrire la **recurrence**.\n4. Memoiser (top-down) ou tabuler (bottom-up).\n\n## Exemple : Fibonacci\n\n```python\nfrom functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)\n```\n\nSans memoization : $O(2^n)$. Avec : $O(n)$.\n\n## Probleme classique : sac a dos 0/1\n\n$$f(i, c) = \\max(f(i-1, c), \\; v_i + f(i-1, c - w_i))$$\n\nComplexite : $O(n \\cdot C)$ ou $C$ est la capacite.',
    sha: 'sha-prog-dyn',
  },
  'ch01-layout.md': {
    content: '# HTML / CSS Layout\n\nDeux outils principaux pour structurer une page : **Flexbox** (1D) et **Grid** (2D).\n\n## Flexbox\n\n```css\n.container {\n  display: flex;\n  gap: 16px;\n  justify-content: space-between;\n  align-items: center;\n}\n```\n\nIdeal pour : barre de nav, alignement vertical, distribution d\'elements en ligne.\n\n## Grid\n\n```css\n.grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));\n  gap: 20px;\n}\n```\n\nIdeal pour : layouts a 2 dimensions, galleries, dashboards.\n\n## Responsive\n\n```css\n@media (max-width: 768px) {\n  .grid { grid-template-columns: 1fr; }\n}\n```\n\n## Exercice\n\nReproduire la maquette **TP HTML/CSS Layout** (figma.com/cursus-demo).',
    sha: 'sha-layout',
  },
  'ch02-auth-jwt.md': {
    content: '# Authentification et JWT\n\n## Hash de mot de passe\n\nNe **jamais** stocker un mot de passe en clair. Utiliser un algorithme de hash lent et resistant aux GPU :\n\n```js\nimport argon2 from "argon2"\n\nconst hash = await argon2.hash(password, {\n  type: argon2.argon2id,\n  memoryCost: 19_456,\n  timeCost: 2,\n})\n```\n\nOWASP 2024 recommande **argon2id**. `bcrypt` reste accepte si bien parametre.\n\n## JWT\n\nUn JSON Web Token est un trio `header.payload.signature` encode en base64url :\n\n```\neyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxw...\n```\n\n```js\nimport jwt from "jsonwebtoken"\n\nconst token = jwt.sign({ sub: user.id }, SECRET, { expiresIn: "7d" })\n```\n\n## Pieges courants\n\n1. **Stocker en localStorage** : XSS-able. Preferer `httpOnly` cookie.\n2. **Pas de revocation** : prevoir une blocklist en DB ou des tokens courts + refresh.\n3. **Algorithme `none`** : valider explicitement l\'algo cote serveur.',
    sha: 'sha-auth-jwt',
  },
  'ch03-projet-e4.md': {
    content: '# Projet Web E4\n\n## Cahier des charges\n\nApplication web fullstack realisee en equipe de 2-3, deployee en ligne. Themes au choix (consulter la liste sur GitHub).\n\n### Stack obligatoire\n\n- **Frontend** : Vue 3 ou React 18, responsive (mobile-first).\n- **Backend** : Node.js + Express ou Python + FastAPI.\n- **DB** : PostgreSQL ou SQLite.\n- **Auth** : JWT avec hash argon2id ou bcrypt.\n- **Tests** : couverture >= 60% (unitaires + integration).\n- **CI/CD** : GitHub Actions, deploiement automatise sur Render / Fly.io / Vercel.\n\n### Livrables\n\n1. Code source sur GitHub (repo public ou prive partage).\n2. URL de prod fonctionnelle.\n3. README : install, lancement, choix techniques.\n4. Soutenance 15 min : demo live + Q/R.\n\n### Bareme indicatif\n\n| Critere               | Pts |\n|-----------------------|-----|\n| Fonctionnalites       | 30  |\n| Qualite du code       | 25  |\n| Tests                 | 15  |\n| CI/CD & deploiement   | 15  |\n| UX / Design           | 10  |\n| Soutenance            | 5   |\n\n## Devoir lie\n\nDepot dans **Projet Web E4** (rendu vendredi 17h).',
    sha: 'sha-projet-e4',
  },
}

// Shape attendu par le store Lumen : { repos, org }. Le wildcard ne doit pas
// renvoyer juste un array sinon promoOrg reste null et la sidebar Lumen
// affiche "Aucune organisation GitHub" en demo. cf. lumen.ts fetchReposForPromo.
router.get('/lumen/repos/promo/:id', (req, res) => {
  const promoId = Number(req.params.id)
  res.json({ ok: true, data: { repos: getLumenRepos(promoId), org: 'cursus-demo' } })
})
router.get('/lumen/repos/:id', (req, res) => {
  const repoId = Number(req.params.id)
  const repo = getLumenRepos(0).find(r => r.id === repoId)
  if (!repo) return res.status(404).json({ ok: false, error: 'Repo introuvable' })
  res.json({ ok: true, data: repo })
})
router.get('/lumen/repos/:id/content', (req, res) => {
  const path = String(req.query.path || '')
  const entry = LUMEN_CHAPTER_CONTENTS[path]
  if (!entry) {
    // Compat retour : un chapitre absent renvoie un placeholder court plutot
    // qu\'une 404 qui afficherait "Erreur" cote front.
    return res.json({
      ok: true,
      data: {
        content: '# Chapitre en preparation\n\nCe chapitre n\'a pas encore ete redige. Reviens plus tard !',
        sha: 'sha-empty',
      },
    })
  }
  res.json({ ok: true, data: entry })
})
// Lumen GitHub : on simule un compte deja connecte pour eviter de bloquer
// le visiteur de la demo sur l'ecran "Connecter ton GitHub" (qui ne peut
// rien donner en demo car il n'y a pas de vraie OAuth GitHub configuree).
// Le login affiche est generique pour garder la demo neutre.
router.get('/lumen/github/me', (_req, res) => res.json({
  ok: true,
  data: {
    connected: true,
    login: 'cursus-demo',
    name: 'Compte démo',
    avatarUrl: 'https://avatars.githubusercontent.com/u/0?v=4',
  },
}))
// POST connect : si le visiteur clique malgre tout sur "Connecter", on
// retourne le meme shape pour que le store passe en mode connecte.
router.post('/lumen/github/connect', (_req, res) => res.json({
  ok: true,
  data: { login: 'cursus-demo', name: 'Compte démo', avatarUrl: 'https://avatars.githubusercontent.com/u/0?v=4' },
}))
router.post('/lumen/github/disconnect', (_req, res) => res.json({ ok: true, data: null }))
// Note: ces endpoints retournent un OBJET (pas un array). Le wildcard
// renverrait `[]` qui ferait crasher `data.notes.slice()` cote front.
// On les materialise explicitement avec le shape attendu (notes: array,
// counts: object) — cf. WidgetLumenNotes / WidgetLumenTopRead.
// Lumen : mes notes prises sur les chapitres + chapitres notes + lectures
const LUMEN_MY_NOTES = [
  { id: 1, repo_id: 1, chapter_path: 'cours/01-tri-rapide.md', chapter_title: 'Tri rapide',         note: 'La complexite pire cas O(n²) arrive si pivot mal choisi : random shuffle avant tri.',     created_at: new Date(Date.now() - 12 * 86400_000).toISOString(), updated_at: new Date(Date.now() - 12 * 86400_000).toISOString() },
  { id: 2, repo_id: 1, chapter_path: 'cours/02-arbres-avl.md', chapter_title: 'Arbres AVL',         note: 'balanceFactor = height(L) - height(R), invariant |bf| <= 1. Rotation simple/double selon signe.', created_at: new Date(Date.now() - 8 * 86400_000).toISOString(),  updated_at: new Date(Date.now() - 5 * 86400_000).toISOString() },
  { id: 3, repo_id: 2, chapter_path: 'projet/01-cdc.md',       chapter_title: 'Projet Web E4',      note: 'Bareme : 30 pts fonctionnalites, 25 code, 15 tests, 15 CI, 10 UX, 5 soutenance.',           created_at: new Date(Date.now() - 3 * 86400_000).toISOString(),  updated_at: new Date(Date.now() - 3 * 86400_000).toISOString() },
]
router.get('/lumen/my-notes', (_req, res) => res.json({ ok: true, data: { notes: LUMEN_MY_NOTES } }))
router.get('/lumen/my-noted-chapters', (_req, res) => res.json({
  ok: true,
  data: [
    { repo_id: 1, chapter_path: 'cours/01-tri-rapide.md', chapter_title: 'Tri rapide',  notes_count: 1 },
    { repo_id: 1, chapter_path: 'cours/02-arbres-avl.md', chapter_title: 'Arbres AVL',  notes_count: 1 },
    { repo_id: 2, chapter_path: 'projet/01-cdc.md',       chapter_title: 'Projet Web E4', notes_count: 1 },
  ],
}))
// Mes lectures : 5 chapitres deja lus avec last_read pour la timeline
router.get('/lumen/my-reads', (_req, res) => res.json({
  ok: true,
  data: [
    { repo_id: 1, chapter_path: 'cours/01-tri-rapide.md',     chapter_title: 'Tri rapide',     repo_name: 'cours-algo-l3', read_at: new Date(Date.now() - 12 * 86400_000).toISOString() },
    { repo_id: 1, chapter_path: 'cours/02-arbres-avl.md',     chapter_title: 'Arbres AVL',     repo_name: 'cours-algo-l3', read_at: new Date(Date.now() -  6 * 86400_000).toISOString() },
    { repo_id: 1, chapter_path: 'cours/03-graphes.md',        chapter_title: 'Parcours graphes', repo_name: 'cours-algo-l3', read_at: new Date(Date.now() -  4 * 86400_000).toISOString() },
    { repo_id: 2, chapter_path: 'projet/01-cdc.md',           chapter_title: 'Projet Web E4',  repo_name: 'projet-web-e4', read_at: new Date(Date.now() -  3 * 86400_000).toISOString() },
    { repo_id: 1, chapter_path: 'cours/04-prog-dynamique.md', chapter_title: 'Prog. dynamique',repo_name: 'cours-algo-l3', read_at: new Date(Date.now() -  1 * 86400_000).toISOString() },
  ],
}))
// Counts de lectures par chapitre (pour le widget "top read")
router.get('/lumen/repos/:id/read-counts', (_req, res) => res.json({
  ok: true,
  data: {
    counts: [
      { chapter_path: 'cours/01-tri-rapide.md',     chapter_title: 'Tri rapide',      reads: 18 },
      { chapter_path: 'cours/02-arbres-avl.md',     chapter_title: 'Arbres AVL',      reads: 14 },
      { chapter_path: 'cours/03-graphes.md',        chapter_title: 'Parcours graphes', reads: 9  },
      { chapter_path: 'cours/04-prog-dynamique.md', chapter_title: 'Prog. dynamique', reads: 5  },
    ],
  },
}))
router.get('/lumen/read-counts/promo/:id', (_req, res) => res.json({
  ok: true,
  data: {
    counts: [
      { chapter_title: 'Tri rapide',       repo_name: 'cours-algo-l3', reads: 18 },
      { chapter_title: 'Projet Web E4',    repo_name: 'projet-web-e4', reads: 16 },
      { chapter_title: 'Arbres AVL',       repo_name: 'cours-algo-l3', reads: 14 },
      { chapter_title: 'Parcours graphes', repo_name: 'cours-algo-l3', reads: 9  },
    ],
  },
}))
router.get('/lumen/stats/promo/:id',          (_req, res) => res.json({ ok: true, data: { repos: 2, reads: 28 } }))
// Liens chapitre <-> devoirs : vide en demo (acceptable, le contenu markdown
// reference deja les devoirs en texte).
router.get('/lumen/repos/:id/chapters/travaux', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/lumen/travaux/:travailId/chapters', (_req, res) => res.json({ ok: true, data: [] }))
// Org GitHub configure pour la promo (vue prof). En demo on simule
// l'org "cursus-demo" lie. Permet a la page Lumen Settings d'afficher
// l'org connecte au lieu d'un ecran "Aucune organisation".
router.get('/lumen/promos/:id/github-org', (_req, res) => res.json({
  ok: true,
  data: { org: 'cursus-demo', repos_count: 2, last_synced_at: new Date(Date.now() - 6 * 3600_000).toISOString() },
}))
router.put('/lumen/promos/:id/github-org', (req, res) => res.json({
  ok: true,
  data: { org: req.body?.org ?? 'cursus-demo' },
}))

// ── Kanban (cartes de tache pour un projet d'equipe) ─────────────────
// Affiche dans le panneau Kanban d'un travail (modal "Suivi"). 3 colonnes
// implicites par status : todo, doing, done. Avatar des assignes rendu
// cote front depuis student_initials.
router.get('/kanban/travaux/:travailId/groups/:groupId', (req, res) => {
  const tid = Number(req.params.travailId)
  const gid = Number(req.params.groupId)
  // 6 cartes simulees pour le Projet Web E4 - Equipe B (Jean + Thomas)
  res.json({
    ok: true,
    data: [
      { id: 1, travail_id: tid, group_id: gid, title: 'Setup repo + CI',         description: 'Init Vite + GitHub Actions. Premier deploy Render.',     status: 'done',  position: 0, assignee_id: 2, assignee_name: 'Jean Dupont',   assignee_initials: 'JD', due_date: null, created_at: new Date(Date.now() - 14 * 86400_000).toISOString() },
      { id: 2, travail_id: tid, group_id: gid, title: 'Maquette Figma',          description: 'Login + dashboard + page projet. Mobile first.',         status: 'done',  position: 1, assignee_id: 4, assignee_name: 'Thomas Martin', assignee_initials: 'TM', due_date: null, created_at: new Date(Date.now() - 12 * 86400_000).toISOString() },
      { id: 3, travail_id: tid, group_id: gid, title: 'Auth JWT + bcrypt',       description: 'Endpoints /login + /me, middleware verify, hash bcrypt.', status: 'doing', position: 0, assignee_id: 2, assignee_name: 'Jean Dupont',   assignee_initials: 'JD', due_date: new Date(Date.now() + 2 * 86400_000).toISOString(), created_at: new Date(Date.now() - 7 * 86400_000).toISOString() },
      { id: 4, travail_id: tid, group_id: gid, title: 'CRUD utilisateurs',       description: 'API REST + UI admin. Validation cote serveur.',          status: 'doing', position: 1, assignee_id: 4, assignee_name: 'Thomas Martin', assignee_initials: 'TM', due_date: new Date(Date.now() + 3 * 86400_000).toISOString(), created_at: new Date(Date.now() - 5 * 86400_000).toISOString() },
      { id: 5, travail_id: tid, group_id: gid, title: 'Tests E2E Playwright',    description: 'Couvrir login + parcours utilisateur principal.',         status: 'todo',  position: 0, assignee_id: 4, assignee_name: 'Thomas Martin', assignee_initials: 'TM', due_date: new Date(Date.now() + 5 * 86400_000).toISOString(), created_at: new Date(Date.now() - 2 * 86400_000).toISOString() },
      { id: 6, travail_id: tid, group_id: gid, title: 'Deploiement prod',        description: 'Render + custom domain + HTTPS Let\'s Encrypt.',         status: 'todo',  position: 1, assignee_id: 2, assignee_name: 'Jean Dupont',   assignee_initials: 'JD', due_date: new Date(Date.now() + 6 * 86400_000).toISOString(), created_at: new Date(Date.now() - 1 * 86400_000).toISOString() },
    ],
  })
})

// ── Calendar ─────────────────────────────────────────────────────────
router.get('/calendar/feed-token', (_req, res) =>
  res.json({ ok: true, data: { token: null } }),
)

// ── Reminders / rappels prof ─────────────────────────────────────────
// Liste des rappels personnels du prof : echeances + tags promo + statut.
// Affiches dans le widget RappelsCard du dashboard prof.
const day = (n) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10)
router.get('/admin/rappels', (_req, res) => res.json({
  ok: true,
  data: [
    { id: 1, promo_tag: 'L3 INFO',  date: day(-3), title: 'Corriger TP3 Tri rapide',         description: 'Reste 8 rendus a noter. Bareme : 30/30 algo + 20/20 tests.', bloc: 'Algorithmique', done: 1 },
    { id: 2, promo_tag: 'L3 INFO',  date: day(0),  title: 'Recap quiz Spark complexite',     description: 'Faire un point en cours sur les questions <50% de bonnes reponses.', bloc: 'Algorithmique', done: 0 },
    { id: 3, promo_tag: 'L3 INFO',  date: day(2),  title: 'Lancer la campagne soutenances',  description: 'Ouvrir le lien de booking pour les soutenances Projet Web E4.',     bloc: 'Projet Web', done: 0 },
    { id: 4, promo_tag: 'L3 INFO',  date: day(5),  title: 'Preparer le sujet TP4 AVL',       description: 'Finaliser le sujet, generer les tests automatises CI.',              bloc: 'Algorithmique', done: 0 },
    { id: 5, promo_tag: 'L2 INFO',  date: day(7),  title: 'Reunion responsable promo L2',    description: 'Bilan mi-semestre + ajustement planning.',                          bloc: null, done: 0 },
    { id: 6, promo_tag: 'L3 INFO',  date: day(14), title: 'Jury Soutenances Projet Web',     description: 'Inviter les 2 intervenants externes (M. Durand, Mme Lopez).',       bloc: 'Projet Web', done: 0 },
  ],
}))
router.get('/admin/feedback/mine', (_req, res) => res.json({ ok: true, data: [] }))

// Teacher notes : annotations privees du prof sur des etudiants.
// Affichees dans le panneau lateral d'un etudiant (StudentTimelineModal).
router.get('/teacher-notes/student/:id', (req, res) => {
  const sid = Number(req.params.id)
  // Genere 2-3 notes pseudo-deterministes selon student id
  const notes = []
  if (sid % 3 !== 0) {
    notes.push({ id: sid * 10 + 1, student_id: sid, author_name: 'Prof. Lemaire', content: 'Eleve serieux et regulier. Bonne participation en TD.',                  created_at: new Date(Date.now() - 30 * 86400_000).toISOString() })
    notes.push({ id: sid * 10 + 2, student_id: sid, author_name: 'Prof. Lemaire', content: 'A renforce sa rigueur sur les tests unitaires depuis le TP2.',          created_at: new Date(Date.now() - 14 * 86400_000).toISOString() })
  }
  if (sid % 2 === 0) {
    notes.push({ id: sid * 10 + 3, student_id: sid, author_name: 'Prof. Martin',  content: 'A pris du retard sur le rendu du Projet Web - relance envoyee.',       created_at: new Date(Date.now() -  3 * 86400_000).toISOString() })
  }
  res.json({ ok: true, data: notes })
})
router.get('/teacher-notes/promo/:id', (_req, res) => res.json({
  ok: true,
  data: [
    { id: 11, student_id: 1, student_name: 'Emma Lefevre',     author_name: 'Prof. Lemaire', content: 'Excellente review du code de son binome. Niveau Lead Dev.', created_at: new Date(Date.now() - 5 * 86400_000).toISOString() },
    { id: 12, student_id: 2, student_name: 'Jean Dupont',      author_name: 'Prof. Lemaire', content: 'Tres a l\'aise sur les structures de donnees. Bon esprit critique.', created_at: new Date(Date.now() - 10 * 86400_000).toISOString() },
    { id: 13, student_id: 3, student_name: 'Sara Bouhassoun',  author_name: 'Prof. Martin',  content: 'Bloque sur les bases de l\'OO. Prevoir un point individuel.', created_at: new Date(Date.now() - 2 * 86400_000).toISOString() },
  ],
}))
router.get('/teacher-notes/promo/:id/summary', (_req, res) => res.json({
  ok: true,
  data: [
    { student_id: 1, student_name: 'Emma Lefevre',     notes_count: 3, last_note_at: new Date(Date.now() - 5 * 86400_000).toISOString() },
    { student_id: 2, student_name: 'Jean Dupont',      notes_count: 2, last_note_at: new Date(Date.now() - 10 * 86400_000).toISOString() },
    { student_id: 3, student_name: 'Sara Bouhassoun',  notes_count: 1, last_note_at: new Date(Date.now() - 2 * 86400_000).toISOString() },
    { student_id: 4, student_name: 'Thomas Martin',    notes_count: 1, last_note_at: new Date(Date.now() - 18 * 86400_000).toISOString() },
  ],
}))

// ── Engagement / scheduled ───────────────────────────────────────────
// Engagement par etudiant pour la promo : metriques de participation
// (messages envoyes, devoirs rendus a temps, lectures Lumen, %).
router.get('/engagement/:promoId', (_req, res) => res.json({
  ok: true,
  data: [
    { student_id: 1, student_name: 'Emma Lefevre',     messages: 87, devoirs_on_time: 4, devoirs_late: 0, lumen_reads: 12, last_active_at: new Date(Date.now() -    3600_000).toISOString(), score: 92 },
    { student_id: 2, student_name: 'Jean Dupont',      messages: 64, devoirs_on_time: 4, devoirs_late: 0, lumen_reads: 8,  last_active_at: new Date(Date.now() -  2 * 3600_000).toISOString(), score: 85 },
    { student_id: 3, student_name: 'Sara Bouhassoun',  messages: 41, devoirs_on_time: 3, devoirs_late: 1, lumen_reads: 5,  last_active_at: new Date(Date.now() -  6 * 3600_000).toISOString(), score: 64 },
    { student_id: 4, student_name: 'Thomas Martin',    messages: 28, devoirs_on_time: 3, devoirs_late: 0, lumen_reads: 4,  last_active_at: new Date(Date.now() - 24 * 3600_000).toISOString(), score: 58 },
    { student_id: 5, student_name: 'Lina Fernandez',   messages: 52, devoirs_on_time: 4, devoirs_late: 0, lumen_reads: 9,  last_active_at: new Date(Date.now() -  4 * 3600_000).toISOString(), score: 78 },
    { student_id: 6, student_name: 'Lucas Bernard',    messages: 19, devoirs_on_time: 2, devoirs_late: 2, lumen_reads: 3,  last_active_at: new Date(Date.now() - 48 * 3600_000).toISOString(), score: 38 },
  ],
}))
// Messages programmes : 2 messages prepares pour envoi differe
router.get('/scheduled', (_req, res) => res.json({
  ok: true,
  data: [
    { id: 1, channel_id: 1, channel_name: 'annonces',   content: 'Pensez à pousser votre code avant 17h vendredi pour le rendu Projet Web E4.', send_at: new Date(Date.now() + 2 * 86400_000 +  9 * 3600_000).toISOString(), status: 'pending' },
    { id: 2, channel_id: 2, channel_name: 'algo',       content: 'Le corrigé du TP3 Tri rapide est disponible dans Documents.',                  send_at: new Date(Date.now() + 4 * 86400_000 + 14 * 3600_000).toISOString(), status: 'pending' },
  ],
}))

// ── Assignments (vues avancees : gantt, rendus) ──────────────────────
// Le shim renderer attend `data: GanttRow[]` (pas `{ tasks, links }` qui
// etait une fausse hypothese de l'ancienne version : aucun consommateur
// dans src/renderer ne lit `.tasks`). Le dashboard prof faisait
// `ganttAll.value.filter(...)` -> crash quand on lui donnait un objet.
//
// On synthetise une liste GanttRow depuis demo_assignments + demo_channels
// + demo_promotions avec quelques champs derives (start_date = deadline-3j,
// depots_count = 0, students_total compte les eleves de la promo).
router.get('/assignments/gantt', (req, res) => {
  try {
    const db = getDemoDb()
    const rows = db.prepare(`
      SELECT
        a.id,
        a.title,
        a.type,
        COALESCE(c.category, a.type) AS category,
        a.is_published AS published,
        a.is_published AS is_published,
        datetime(a.deadline, '-3 days') AS start_date,
        a.deadline,
        NULL AS group_id,
        NULL AS group_name,
        NULL AS room,
        NULL AS aavs,
        1 AS requires_submission,
        c.name AS channel_name,
        c.id AS channel_id,
        p.name AS promo_name,
        p.color AS promo_color,
        p.id AS promo_id,
        0 AS depots_count,
        (SELECT COUNT(*) FROM demo_students s WHERE s.tenant_id = a.tenant_id AND s.promo_id = p.id) AS students_total
      FROM demo_assignments a
      JOIN demo_channels    c ON c.id = a.channel_id  AND c.tenant_id = a.tenant_id
      JOIN demo_promotions  p ON p.id = c.promo_id    AND p.tenant_id = a.tenant_id
      WHERE a.tenant_id = ?
      ORDER BY a.deadline ASC
    `).all(req.tenantId)
    res.json({ ok: true, data: rows })
  } catch (e) {
    // Pas un blocker en demo : on renvoie une liste vide plutot que de
    // casser le dashboard. Le warn aide le debug si la schema bouge.
    console.warn('[demo/gantt] failed:', e?.message)
    res.json({ ok: true, data: [] })
  }
})
// ── Rendus (depots des etudiants) ────────────────────────────────────
// Synthetises depuis demo_assignments (passes uniquement). Pour chaque
// devoir passe, on suppose que la majorite des etudiants ont rendu et
// genere une note pseudo-aleatoire mais stable. Le widget RecentRendus
// du dashboard prof affiche ces depots en timeline.
router.get('/assignments/rendus', (req, res) => {
  try {
    const { getSimulatedSubmissions } = require('../../services/demoBotsAlgo')
    const db = getDemoDb()
    const tenantId = req.tenantId
    // 4 derniers devoirs deja rendus + 3 a venir (deadline future) :
    // les passes ont des notes/feedback, les a-venir n'en ont pas mais
    // affichent les rendus qui arrivent au fil de la session demo.
    const pastAssigns = db.prepare(`
      SELECT a.id, a.title, a.type, a.deadline, c.id AS channel_id, c.name AS channel_name, c.promo_id
      FROM demo_assignments a JOIN demo_channels c ON c.id = a.channel_id AND c.tenant_id = a.tenant_id
      WHERE a.tenant_id = ? AND a.is_published = 1 AND a.deadline < datetime('now')
      ORDER BY a.deadline DESC
      LIMIT 4
    `).all(tenantId)
    const upcomingAssigns = db.prepare(`
      SELECT a.id, a.title, a.type, a.deadline, c.id AS channel_id, c.name AS channel_name, c.promo_id
      FROM demo_assignments a JOIN demo_channels c ON c.id = a.channel_id AND c.tenant_id = a.tenant_id
      WHERE a.tenant_id = ? AND a.is_published = 1 AND a.deadline >= datetime('now')
      ORDER BY a.deadline ASC
      LIMIT 3
    `).all(tenantId)
    const students = db.prepare(`
      SELECT id, name, promo_id, avatar_initials FROM demo_students WHERE tenant_id = ? ORDER BY id
    `).all(tenantId)
    const grades = ['A', 'A', 'B', 'B', 'B', 'C', 'C', 'D']
    const feedbacks = [
      'Tres bon travail, code propre et tests complets.',
      'Solide. Quelques points a creuser sur l\'efficacite.',
      'Bon rendu, la doc reste a etoffer.',
      'Convenable, manque de tests.',
      'Fonctionne mais structure perfectible.',
    ]
    const rendus = []
    let id = 6000
    // Devoirs passes : tout le monde a rendu, notes + feedback
    for (const a of pastAssigns) {
      const promoStudents = students.filter(s => s.promo_id === a.promo_id)
      const submitters = promoStudents.slice(0, Math.max(1, Math.floor(promoStudents.length * 0.85)))
      submitters.forEach((s, i) => {
        const submittedAt = new Date(new Date(a.deadline).getTime() - (1 + i) * 3600_000)
        const note = grades[(s.id + a.id) % grades.length]
        const feedback = feedbacks[(s.id + a.id) % feedbacks.length]
        rendus.push({
          id: id++,
          travail_id: a.id,
          travail_title: a.title,
          channel_id: a.channel_id,
          channel_name: a.channel_name,
          student_id: s.id,
          student_name: s.name,
          student_initials: s.avatar_initials,
          submitted_at: submittedAt.toISOString(),
          note,
          feedback,
          file_name: `rendu-${a.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${s.name.split(' ')[0].toLowerCase()}.zip`,
          file_size: 800_000 + (s.id * 17_000),
        })
      })
    }
    // Devoirs a venir : simulateur progressif (cf. getSimulatedSubmissions)
    // qui retourne les rendus tels qu'ils existeraient au temps t. Plus la
    // deadline approche et plus la session demo dure, plus de rendus
    // apparaissent. Pas de note (pas encore corrige).
    for (const a of upcomingAssigns) {
      const promoStudents = students.filter(s => s.promo_id === a.promo_id)
      const subs = getSimulatedSubmissions(tenantId, a, promoStudents)
      for (const sub of subs) {
        const s = sub.student
        rendus.push({
          id: id++,
          travail_id: a.id,
          travail_title: a.title,
          channel_id: a.channel_id,
          channel_name: a.channel_name,
          student_id: s.id,
          student_name: s.name,
          student_initials: s.avatar_initials,
          submitted_at: sub.submittedAt,
          note: null,
          feedback: null,
          file_name: `rendu-${a.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${s.name.split(' ')[0].toLowerCase()}.zip`,
          file_size: 800_000 + (s.id * 17_000),
        })
      }
    }
    // Tri global : plus recents en premier (le widget affiche un fil)
    rendus.sort((x, y) => new Date(y.submitted_at).getTime() - new Date(x.submitted_at).getTime())
    res.json({ ok: true, data: rendus })
  } catch (e) {
    console.warn('[demo/rendus] failed:', e?.message)
    res.json({ ok: true, data: [] })
  }
})

// ── Groupes (equipes pour les projets en binome / trinome) ───────────
const DEMO_GROUPS = [
  { id: 1, name: 'Equipe A',  travail_id: null, promo_id: 1, color: '#6366F1', created_at: new Date(Date.now() - 30 * 86400_000).toISOString() },
  { id: 2, name: 'Equipe B',  travail_id: null, promo_id: 1, color: '#059669', created_at: new Date(Date.now() - 30 * 86400_000).toISOString() },
  { id: 3, name: 'Equipe C',  travail_id: null, promo_id: 1, color: '#F59E0B', created_at: new Date(Date.now() - 30 * 86400_000).toISOString() },
]
const DEMO_GROUP_MEMBERS = {
  1: [
    { group_id: 1, student_id: 1, student_name: 'Emma Lefevre',    avatar_initials: 'EL', role: 'leader' },
    { group_id: 1, student_id: 5, student_name: 'Lina Fernandez',  avatar_initials: 'LF', role: 'member' },
  ],
  2: [
    { group_id: 2, student_id: 2, student_name: 'Jean Dupont',     avatar_initials: 'JD', role: 'leader' },
    { group_id: 2, student_id: 4, student_name: 'Thomas Martin',   avatar_initials: 'TM', role: 'member' },
  ],
  3: [
    { group_id: 3, student_id: 3, student_name: 'Sara Bouhassoun', avatar_initials: 'SB', role: 'leader' },
    { group_id: 3, student_id: 6, student_name: 'Lucas Bernard',   avatar_initials: 'LB', role: 'member' },
  ],
}
router.get('/groups',             (_req, res) => res.json({ ok: true, data: DEMO_GROUPS }))
router.get('/groups/:id/members', (req,  res) => res.json({ ok: true, data: DEMO_GROUP_MEMBERS[Number(req.params.id)] ?? [] }))

// ── Channels archives (panneau "Restaurer un canal") ─────────────────
router.get('/promotions/:id/channels/archived', (_req, res) => res.json({ ok: true, data: [] }))

// ── TypeRace (mini-jeu) ──────────────────────────────────────────────
// `myStats` retourne un objet structure (allTime/today/week/history) — le
// wildcard `[]` ferait crasher WidgetTypeRace qui fait `stats.week.bestScore`.
router.get('/typerace/leaderboard', (_req, res) => res.json({
  ok: true,
  data: [
    { rank: 1, userId: 1,  name: 'Sara Bouhassoun', bestScore: 142, bestWpm: 78 },
    { rank: 2, userId: 2,  name: 'Lucas Bernard',   bestScore: 128, bestWpm: 71 },
    { rank: 3, userId: 3,  name: 'Mehdi Chaouki',   bestScore: 117, bestWpm: 65 },
  ],
}))
router.get('/typerace/me', (_req, res) => res.json({
  ok: true,
  data: {
    allTime: { plays: 4, bestScore: 92 },
    today:   { plays: 1 },
    week:    { bestScore: 92 },
    history: [{ wpm: 48 }, { wpm: 52 }, { wpm: 55 }, { wpm: 51 }, { wpm: 58 }, { wpm: 62 }, { wpm: 60 }],
  },
}))

// ── Modules (admin opt-in/out) ───────────────────────────────────────
// Retourne tous les modules actives par defaut pour que le visiteur voie
// toute l'app (Live, Lumen, Games...). C'est un Record<string, boolean>,
// pas un array — le wildcard renverrait [] et useModules.loadModules
// ferait `m in []` qui retourne false -> defaults preservees, OK en
// pratique mais on documente le shape pour eviter une regression.
router.get('/modules', (_req, res) => res.json({
  ok: true,
  data: { kanban: true, frise: true, live: true, signatures: true, lumen: true, games: true },
}))

// ── Signatures ───────────────────────────────────────────────────────
router.get('/signatures',               (_req, res) => res.json({ ok: true, data: [] }))
router.get('/signatures/pending-count', (_req, res) => res.json({ ok: true, data: { count: 0 } }))

// ──────────────────────────────────────────────────────────────────────
//  Fallback global : tout endpoint non explicitement defini retourne un
//  payload "vide" pour les GET et un refus 403 pour les ecritures.
//
//  En NODE_ENV=test ou si DEMO_STRICT=1, on log a INFO et retourne 501
//  Not Implemented pour rendre les trous visibles (sinon une route
//  manquante ressemble juste a "feature vide" cote front).
// ──────────────────────────────────────────────────────────────────────
const DEMO_STRICT = () => process.env.DEMO_STRICT === '1'

router.use((req, res) => {
  const isWrite = req.method !== 'GET' && req.method !== 'HEAD'

  // Log toutes les wildcard hits — utile pour reperer les nouvelles
  // routes prod qui meritent un mock dedie. console.warn plutot que
  // console.info pour qu'elles remontent dans les analyses CI.
  console.warn(`[demo] fallback hit: ${req.method} ${req.originalUrl || req.path}`)

  if (DEMO_STRICT()) {
    return res.status(501).json({
      ok: false,
      error: `Route demo non implementee : ${req.method} ${req.path}. Ajouter un mock dans server/routes/demo/mocks.js.`,
      _demoFallback: true,
    })
  }

  if (isWrite) {
    return res.status(403).json({
      ok: false,
      error: 'Cette action n\'est pas disponible en mode demo. Cree un compte pour la debloquer.',
      _demoFallback: true,
    })
  }
  return res.json({ ok: true, data: [], _demoFallback: true })
})

module.exports = router
