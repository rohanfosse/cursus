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
// Le shim attend un array Message[], pas un objet : cf. note dans
// real.js sur /messages/channel/:channelId/page.
router.get('/messages/dm/:studentId/page', (_req, res) =>
  res.json({ ok: true, data: [] }),
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
//
// On materialise 2 repos pedagogiques pour que la sidebar Lumen ne soit
// pas vide en demo : "cesi/algo-l1" (3 chapitres markdown lies aux devoirs
// d'algo) et "cesi/web-fullstack" (3 chapitres dont le projet web). Le
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
    owner: 'cesi',
    repo: 'algo-l1',
    fullName: 'cesi/algo-l1',
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
    owner: 'cesi',
    repo: 'web-fullstack',
    fullName: 'cesi/web-fullstack',
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
    content: '# HTML / CSS Layout\n\nDeux outils principaux pour structurer une page : **Flexbox** (1D) et **Grid** (2D).\n\n## Flexbox\n\n```css\n.container {\n  display: flex;\n  gap: 16px;\n  justify-content: space-between;\n  align-items: center;\n}\n```\n\nIdeal pour : barre de nav, alignement vertical, distribution d\'elements en ligne.\n\n## Grid\n\n```css\n.grid {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));\n  gap: 20px;\n}\n```\n\nIdeal pour : layouts a 2 dimensions, galleries, dashboards.\n\n## Responsive\n\n```css\n@media (max-width: 768px) {\n  .grid { grid-template-columns: 1fr; }\n}\n```\n\n## Exercice\n\nReproduire la maquette **TP HTML/CSS Layout** (figma.com/cesi).',
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

router.get('/lumen/repos/promo/:id', (req, res) => {
  res.json({ ok: true, data: getLumenRepos(Number(req.params.id)) })
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
router.get('/lumen/github/me',                (_req, res) => res.json({ ok: true, data: { connected: false } }))
// Note: ces endpoints retournent un OBJET (pas un array). Le wildcard
// renverrait `[]` qui ferait crasher `data.notes.slice()` cote front.
// On les materialise explicitement avec le shape attendu (notes: array,
// counts: object) — cf. WidgetLumenNotes / WidgetLumenTopRead.
router.get('/lumen/my-notes',                 (_req, res) => res.json({ ok: true, data: { notes: [] } }))
router.get('/lumen/my-noted-chapters',        (_req, res) => res.json({ ok: true, data: [] }))
router.get('/lumen/my-reads',                 (_req, res) => res.json({ ok: true, data: [] }))
router.get('/lumen/repos/:id/read-counts',    (_req, res) => res.json({ ok: true, data: { counts: [] } }))
router.get('/lumen/read-counts/promo/:id',    (_req, res) => res.json({ ok: true, data: { counts: [] } }))
router.get('/lumen/stats/promo/:id',          (_req, res) => res.json({ ok: true, data: { repos: 2, reads: 28 } }))
// Liens chapitre <-> devoirs : vide en demo (acceptable, le contenu markdown
// reference deja les devoirs en texte).
router.get('/lumen/repos/:id/chapters/travaux', (_req, res) => res.json({ ok: true, data: [] }))
router.get('/lumen/travaux/:travailId/chapters', (_req, res) => res.json({ ok: true, data: [] }))

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

// ── Assignments (vues avancees : gantt, rendus) ──────────────────────
// Le wildcard `[]` ne suffit pas : le widget Gantt fait `data.tasks.map`,
// les rendus utilisent `data.rendus` etc. On retourne le shape attendu.
router.get('/assignments/gantt',  (_req, res) => res.json({ ok: true, data: { tasks: [], links: [] } }))
router.get('/assignments/rendus', (_req, res) => res.json({ ok: true, data: [] }))

// ── Groupes ──────────────────────────────────────────────────────────
router.get('/groups',                (_req, res) => res.json({ ok: true, data: [] }))
router.get('/groups/:id/members',    (_req, res) => res.json({ ok: true, data: [] }))

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
