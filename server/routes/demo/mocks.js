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
router.get('/booking/event-types',   (_req, res) => res.json({ ok: true, data: [] }))
router.get('/booking/availabilities', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/booking/bookings',      (_req, res) => res.json({ ok: true, data: [] }))
router.get('/booking/campaigns',     (_req, res) => res.json({ ok: true, data: [] }))

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
    { id: 1005, channel_id: channelId, promo_id: promoId, category: 'Externe',   type: 'link',     name: 'GitHub - Projet Web E4',       path_or_url: 'https://github.com/cesi/projet-web-e4', content: 'https://github.com/cesi/projet-web-e4', description: 'Repo template avec CI deja configuree',       file_size: null,      travail_id: null, travail_title: null, created_at: day(5) },
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
router.get('/documents/project', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/documents/search', (req, res) => {
  const q = String(req.query.q || '').toLowerCase().trim()
  if (!q) return res.json({ ok: true, data: [] })
  const all = DEMO_DOCUMENTS(null, null)
  res.json({ ok: true, data: all.filter(d => d.name.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q)) })
})

// ── Bookmarks / signets ──────────────────────────────────────────────
router.get('/bookmarks',     (_req, res) => res.json({ ok: true, data: [] }))
router.get('/bookmarks/ids', (_req, res) => res.json({ ok: true, data: [] }))

// ── DMs (vides en MVP V2 — V3 ajoutera des conversations seedees) ────
router.get('/messages/dm/:studentId/page', (_req, res) =>
  res.json({ ok: true, data: { messages: [], hasMore: false } }),
)
router.get('/messages/dm-files', (_req, res) => res.json({ ok: true, data: [] }))
router.post('/messages/reactions', (_req, res) => res.json({ ok: true, data: null }))

// ── Recherche (pas de FTS en demo, retourne vide) ────────────────────
router.get('/messages/search',      (_req, res) => res.json({ ok: true, data: [] }))
router.post('/messages/search-all', (_req, res) => res.json({ ok: true, data: [] }))

// ── Live ─────────────────────────────────────────────────────────────
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
      { id: 'demo-live-h1', title: 'Quiz Web - Auth & JWT',      status: 'ended', participant_count: 18, activity_count: 8,  ended_at: day(2) },
      { id: 'demo-live-h2', title: 'Pulse - Retour mi-semestre', status: 'ended', participant_count: 16, activity_count: 4,  ended_at: day(7) },
      { id: 'demo-live-h3', title: 'Code partage - Tri rapide',  status: 'ended', participant_count: 14, activity_count: 12, ended_at: day(10) },
    ],
  })
})

// ── Lumen ────────────────────────────────────────────────────────────
router.get('/lumen/repos/promo/:id', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/lumen/github/me',       (_req, res) => res.json({ ok: true, data: { connected: false } }))

// ── Kanban ───────────────────────────────────────────────────────────
router.get('/kanban/travaux/:travailId/groups/:groupId', (_req, res) =>
  res.json({ ok: true, data: [] }),
)

// ── Calendar ─────────────────────────────────────────────────────────
router.get('/calendar/feed-token', (_req, res) =>
  res.json({ ok: true, data: { token: null } }),
)

// ── Reminders / suivi / teacher-notes ────────────────────────────────
router.get('/admin/rappels',                   (_req, res) => res.json({ ok: true, data: [] }))
router.get('/admin/feedback/mine',             (_req, res) => res.json({ ok: true, data: [] }))
router.get('/teacher-notes/student/:id',       (_req, res) => res.json({ ok: true, data: [] }))
router.get('/teacher-notes/promo/:id',         (_req, res) => res.json({ ok: true, data: [] }))
router.get('/teacher-notes/promo/:id/summary', (_req, res) => res.json({ ok: true, data: [] }))

// ── Engagement / scheduled ───────────────────────────────────────────
router.get('/engagement/:promoId', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/scheduled',           (_req, res) => res.json({ ok: true, data: [] }))

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
