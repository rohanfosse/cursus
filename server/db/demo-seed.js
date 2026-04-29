/**
 * Seed du mode demo : peuple un nouveau tenant avec un dataset coherent.
 *
 * Appele a chaque fois qu'un visiteur clique "Tester en demo" (cf.
 * `routes/demo.js` -> POST /api/demo/start). Le tenant_id genere isole
 * la session des autres visiteurs.
 *
 * Dataset minimal pour MVP : 1 promo, 4 canaux, 6 students + 1 teacher,
 * ~25 messages historiques, 3 devoirs, sur la base de "CPIA2 25-26"
 * (cf. screenshots du projet pour la coherence visuelle).
 */

// Avatars colores stables (pas d'aleatoire pour des seeds reproductibles).
const AVATAR_COLORS = ['#6366F1', '#059669', '#F59E0B', '#EF4444', '#0EA5E9', '#D97706', '#8B5CF6']

// Pool de 33 prenoms+noms varies. La promo Licence en utilise 20, le
// Master 13 — listes disjointes via slice. Volontairement neutres (pas de
// reference CESI ou ecole specifique).
const STUDENT_POOL = [
  // Licence (20 premiers)
  { name: 'Emma Lefevre',    email: 'emma.lefevre@demo.cursus',    initials: 'EL' },
  { name: 'Lucas Bernard',   email: 'lucas.bernard@demo.cursus',   initials: 'LB' },
  { name: 'Sara Bouhassoun', email: 'sara.bouhassoun@demo.cursus', initials: 'SB' },
  { name: 'Jean Durand',     email: 'jean.durand@demo.cursus',     initials: 'JD' },
  { name: 'Alice Martin',    email: 'alice.martin@demo.cursus',    initials: 'AM' },
  { name: 'Mehdi Chaouki',   email: 'mehdi.chaouki@demo.cursus',   initials: 'MC' },
  { name: 'Hugo Petit',      email: 'hugo.petit@demo.cursus',      initials: 'HP' },
  { name: 'Lea Rousseau',    email: 'lea.rousseau@demo.cursus',    initials: 'LR' },
  { name: 'Ibrahim Diallo',  email: 'ibrahim.diallo@demo.cursus',  initials: 'ID' },
  { name: 'Camille Robert',  email: 'camille.robert@demo.cursus',  initials: 'CR' },
  { name: 'Theo Garcia',     email: 'theo.garcia@demo.cursus',     initials: 'TG' },
  { name: 'Ines Moreau',     email: 'ines.moreau@demo.cursus',     initials: 'IM' },
  { name: 'Nathan Dubois',   email: 'nathan.dubois@demo.cursus',   initials: 'ND' },
  { name: 'Yasmine Benali',  email: 'yasmine.benali@demo.cursus',  initials: 'YB' },
  { name: 'Paul Leroy',      email: 'paul.leroy@demo.cursus',      initials: 'PL' },
  { name: 'Manon Fournier',  email: 'manon.fournier@demo.cursus',  initials: 'MF' },
  { name: 'Antoine Roux',    email: 'antoine.roux@demo.cursus',    initials: 'AR' },
  { name: 'Clara Vincent',   email: 'clara.vincent@demo.cursus',   initials: 'CV' },
  { name: 'Maxime Girard',   email: 'maxime.girard@demo.cursus',   initials: 'MG' },
  { name: 'Sofia Lopez',     email: 'sofia.lopez@demo.cursus',     initials: 'SL' },

  // Master (13 suivants)
  { name: 'Romain Carpentier', email: 'romain.carpentier@demo.cursus', initials: 'RC' },
  { name: 'Chloe Marchand',    email: 'chloe.marchand@demo.cursus',    initials: 'CM' },
  { name: 'Adrien Lambert',    email: 'adrien.lambert@demo.cursus',    initials: 'AL' },
  { name: 'Naomi Bertrand',    email: 'naomi.bertrand@demo.cursus',    initials: 'NB' },
  { name: 'Karim El Amrani',   email: 'karim.elamrani@demo.cursus',    initials: 'KE' },
  { name: 'Juliette Faure',    email: 'juliette.faure@demo.cursus',    initials: 'JF' },
  { name: 'Quentin Morel',     email: 'quentin.morel@demo.cursus',     initials: 'QM' },
  { name: 'Anna Schneider',    email: 'anna.schneider@demo.cursus',    initials: 'AS' },
  { name: 'Bastien Henry',     email: 'bastien.henry@demo.cursus',     initials: 'BH' },
  { name: 'Marion Vidal',      email: 'marion.vidal@demo.cursus',      initials: 'MV' },
  { name: 'Tristan Olivier',   email: 'tristan.olivier@demo.cursus',   initials: 'TO' },
  { name: 'Salma Berrada',     email: 'salma.berrada@demo.cursus',     initials: 'SB' },
  { name: 'Leo Perez',         email: 'leo.perez@demo.cursus',         initials: 'LP' },
]

const LICENCE_STUDENTS = STUDENT_POOL.slice(0, 20)
const MASTER_STUDENTS  = STUDENT_POOL.slice(20, 33)

// Promotions : 2 cursus generiques L3 / M1 informatique. La principale
// (Licence) recoit le seed complet (canaux, messages, devoirs) ; la
// secondaire (Master) sert juste a montrer l'UX multi-promo cote prof
// (le PromoRail dans la sidebar) sans exploser le volume du seed.
const PROMOS = [
  { name: 'Licence Informatique L3',   color: '#6366F1', students: LICENCE_STUDENTS, withSeed: true  },
  { name: 'Master Informatique M1',    color: '#0EA5E9', students: MASTER_STUDENTS,  withSeed: false },
]

const CHANNELS = [
  { name: 'general',         description: 'Canal general de la promo',          category: 'Promotion' },
  { name: 'developpement-web', description: 'Cours et TPs developpement web',  category: 'Cours' },
  { name: 'algorithmique',   description: 'Cours et exercices algorithmique',  category: 'Cours' },
  { name: 'projets',         description: 'Coordination projets de groupe',    category: 'Projets' },
]

// Messages historiques (relatifs au moment du seed pour rester coherents).
//
// Le visiteur demo doit voir des canaux **deja habites** : threads longs avec
// markdown, code blocks, mentions, reactions, messages epingles. Si on lui
// montre 3 lignes par canal, il pense que l'app est vide. La densite seedee
// ici (~50 messages, 4 canaux) est calibree pour ressembler a une vraie
// promo en milieu de semestre.
function makeMessages(channelIds, students, teacher) {
  const now = Date.now()
  const min = (n) => new Date(now - n * 60_000).toISOString()
  const hr  = (n) => new Date(now - n * 3600_000).toISOString()
  const day = (n) => new Date(now - n * 86400_000).toISOString()

  const [chGeneral, chWeb, chAlgo, chProjets] = channelIds
  const [emma, lucas, sara, jean, alice, mehdi, hugo, lea] = students

  // Format reactions : le frontend (stores/messages.ts initReactions) attend
  // soit un nombre, soit { count, users: string[] }. On passe le format
  // enrichi pour avoir la liste des reacteurs en tooltip. Si on lui envoie
  // juste un array (ancien bug), il l'interprete comme nombre et affiche
  // [38,35] dans la pill au lieu du compteur.
  const idToName = new Map([[teacher.id, teacher.name], ...students.map(s => [s.id, s.name])])
  const rx = (counts) => {
    const out = {}
    for (const [emoji, userIds] of Object.entries(counts)) {
      const users = userIds.map(uid => idToName.get(uid) ?? '').filter(Boolean)
      out[emoji] = { count: userIds.length, users }
    }
    return JSON.stringify(out)
  }

  return [
    // ────────────────────────────────────────────────────────────────────
    // #general — accueil de la promo, rythmé par les annonces du prof
    // ────────────────────────────────────────────────────────────────────
    { channel_id: chGeneral, author: teacher, content: 'Bienvenue sur Cursus pour cette nouvelle annee ! La **premiere session** a lieu lundi 9h en B204. Pensez a installer l\'app desktop si vous etes encore sur le web.', created_at: day(5), is_pinned: 1, reactions: rx({ '👋': [emma.id, lucas.id, sara.id, jean.id], '🎉': [alice.id, mehdi.id] }) },
    { channel_id: chGeneral, author: emma,    content: 'Merci ! On a deja recu le programme du semestre ?', created_at: day(5) },
    { channel_id: chGeneral, author: teacher, content: 'Oui, le syllabus est dans Documents > _Administratif_, et les ressources de cours dans **Lumen** (icone livre dans la barre laterale).', created_at: day(5) },
    { channel_id: chGeneral, author: alice,   content: 'L\'app est dispo en mode hors-ligne ? Je prends souvent le train.', created_at: day(4) },
    { channel_id: chGeneral, author: teacher, content: 'Oui, c\'est une PWA — installable, ca synchronise au retour en ligne.', created_at: day(4), reactions: rx({ '👍': [alice.id, hugo.id, lea.id] }) },
    { channel_id: chGeneral, author: lucas,   content: 'Quelqu\'un a la liste des binomes pour le projet web ?', created_at: day(3) },
    { channel_id: chGeneral, author: sara,    content: 'Je suis avec Mehdi, on a rejoint #developpement-web pour discuter.', created_at: day(3) },
    { channel_id: chGeneral, author: emma,    content: 'Je cherche encore un binome. @lucas tu es seul ?', created_at: day(3) },
    { channel_id: chGeneral, author: lucas,   content: 'Carrement, on fait equipe @emma !', created_at: day(3), reactions: rx({ '🤝': [emma.id, sara.id] }) },
    { channel_id: chGeneral, author: teacher, content: 'Reunion de mi-semestre **mardi 14h** en B204. Ordre du jour pousse dans Documents > _Comptes rendus_.', created_at: day(1), is_pinned: 1, reactions: rx({ '✅': [emma.id, lucas.id, sara.id, jean.id, alice.id, mehdi.id, hugo.id] }) },
    { channel_id: chGeneral, author: hugo,    content: 'Je note. Merci pour le rappel.', created_at: hr(20) },

    // ────────────────────────────────────────────────────────────────────
    // #developpement-web — coeur de la demo, thread long sur le projet
    // ────────────────────────────────────────────────────────────────────
    { channel_id: chWeb, author: teacher, content: '**Projet Web E4** : rendu vendredi 17h dans le tab _Devoirs_. CDC complet et bareme dans Lumen > Projet Web E4.', created_at: day(4), is_pinned: 1, reactions: rx({ '👀': [emma.id, lucas.id, alice.id, jean.id], '😅': [sara.id] }) },
    { channel_id: chWeb, author: emma,    content: 'On peut travailler en equipe de 2 ou 3 ?', created_at: day(4) },
    { channel_id: chWeb, author: teacher, content: 'Oui, groupes de 2-3. Utilisez ce canal pour coordonner. Pensez a `/devoir Projet Web E4` pour epingler vos questions.', created_at: day(4) },
    { channel_id: chWeb, author: lucas,   content: 'On a commence avec @sara sur la partie auth. Quelqu\'un fait le front ?', created_at: day(2) },
    { channel_id: chWeb, author: alice,   content: 'Je peux faire le front avec Vue, j\'ai deja fait un truc similaire l\'an dernier.', created_at: day(2), reactions: rx({ '🚀': [lucas.id, sara.id, emma.id] }) },
    { channel_id: chWeb, author: jean,    content: 'Je m\'occupe de la CI/CD. J\'ai un setup GitHub Actions pret :\n\n```yaml\nname: CI\non: [push, pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with: { node-version: 22 }\n      - run: npm ci && npm test\n```\n\nFork-le si vous voulez, ca lint + teste sur chaque push.', created_at: day(1), reactions: rx({ '🔥': [emma.id, lucas.id, alice.id, sara.id, mehdi.id], '💯': [hugo.id] }) },
    { channel_id: chWeb, author: sara,    content: 'Question auth : on prend `bcrypt` ou `argon2` pour le hash ? J\'ai lu que argon2 est recommande maintenant.', created_at: hr(20) },
    { channel_id: chWeb, author: teacher, content: 'Argon2id est l\'OWASP recommendation 2024. Mais bcrypt reste accepte si vous montrez que vous savez pourquoi. Documentez votre choix dans le README.', created_at: hr(19), reactions: rx({ '📚': [sara.id, lucas.id, emma.id] }) },
    { channel_id: chWeb, author: lucas,   content: 'OK on part sur argon2. @jean tu peux verifier que le pipeline `npm audit` passe ?', created_at: hr(18) },
    { channel_id: chWeb, author: jean,    content: 'Vu, je rajoute `npm audit --audit-level=high` au workflow. Ca break si une dep critique est detectee.', created_at: hr(17) },
    { channel_id: chWeb, author: emma,    content: 'On bloque sur le CORS en local. Le front sur :5173 et l\'api sur :3001, le navigateur refuse les cookies cross-origin.', created_at: hr(6) },
    { channel_id: chWeb, author: alice,   content: 'Tu as bien `credentials: "include"` dans le fetch + `Access-Control-Allow-Credentials: true` cote serveur ? Sinon ca passe pas.', created_at: hr(5) },
    { channel_id: chWeb, author: emma,    content: 'Ah oui c\'etait ca, merci ! `Access-Control-Allow-Credentials` manquait. Bonus : pense a `Access-Control-Allow-Origin` qui doit etre l\'origine exacte (pas `*`) quand `credentials: include`.', created_at: hr(4), reactions: rx({ '✅': [alice.id, lucas.id], '💡': [sara.id, hugo.id] }) },
    { channel_id: chWeb, author: teacher, content: 'Bon reflex Emma. Pour la prod, vous fixerez l\'origine via env var, pas en dur.', created_at: hr(3) },

    // ────────────────────────────────────────────────────────────────────
    // #algorithmique — entraide entre etudiants, plus dense en code
    // ────────────────────────────────────────────────────────────────────
    { channel_id: chAlgo, author: teacher, content: 'Rappel : la correction du TP3 est en ligne (Documents > Algo). Le prochain **quiz Spark** portera sur les arbres AVL — pensez a reviser les rotations.', created_at: day(2), is_pinned: 1 },
    { channel_id: chAlgo, author: sara,    content: 'Quelqu\'un a compris la rotation double ? Je bloque sur le cas gauche-droite.', created_at: day(1) },
    { channel_id: chAlgo, author: jean,    content: 'Regarde le `balanceFactor`. Si > 1 et fils gauche < 0 -> rotation gauche-droite (= rotation gauche du fils, puis rotation droite du noeud).\n\n```python\ndef rotate_lr(node):\n    node.left = rotate_left(node.left)\n    return rotate_right(node)\n```\n\nL\'astuce : tu fais 2 rotations simples plutot que de coder 4 cas.', created_at: day(1), reactions: rx({ '🙏': [sara.id, mehdi.id, emma.id], '💡': [hugo.id, lea.id] }) },
    { channel_id: chAlgo, author: sara,    content: '@jean genie, ca s\'eclaire merci ! Je teste sur mon arbre des que possible.', created_at: day(1) },
    { channel_id: chAlgo, author: mehdi,   content: 'J\'ai fait un schema clair sur GitHub avec les 4 cas (LL, RR, LR, RL). Lien dans #projets.', created_at: hr(10), reactions: rx({ '📎': [sara.id, emma.id, jean.id] }) },
    { channel_id: chAlgo, author: hugo,    content: 'Quelqu\'un peut me confirmer la complexite de l\'insertion AVL ? `O(log n)` worst case ?', created_at: hr(8) },
    { channel_id: chAlgo, author: jean,    content: 'Oui : descente `O(log n)` + au plus 2 rotations (chacune `O(1)`). Donc bien `O(log n)` worst case, contrairement a un BST classique qui peut degenerer en `O(n)`.', created_at: hr(7), reactions: rx({ '✅': [hugo.id, sara.id, lea.id] }) },
    { channel_id: chAlgo, author: lea,     content: 'Le quiz Spark, c\'est en classe ou async ?', created_at: hr(2) },
    { channel_id: chAlgo, author: teacher, content: 'En classe demain 10h, 20 min chrono. Notation participation, pas dans la moyenne.', created_at: hr(1) },

    // ────────────────────────────────────────────────────────────────────
    // #projets — coordination, partage de liens, kanban
    // ────────────────────────────────────────────────────────────────────
    { channel_id: chProjets, author: teacher, content: 'Pensez a creer un **projet Kanban** pour organiser vos taches. Le bouton est dans la sidebar (icone +). Tres utile pour les soutenances.', created_at: day(6), is_pinned: 1 },
    { channel_id: chProjets, author: alice,   content: 'On a fait notre Kanban hier, c\'est super clair pour repartir les taches. On utilise les colonnes _A faire / En cours / Review / Fait_.', created_at: day(4), reactions: rx({ '👏': [emma.id, lucas.id, sara.id] }) },
    { channel_id: chProjets, author: mehdi,   content: 'Mon schema rotations AVL : https://github.com/mehdi-c/avl-cheatsheet\n\n4 cas illustres avec couleurs + GIF anime. N\'hesitez pas a fork.', created_at: hr(11), reactions: rx({ '🔥': [sara.id, jean.id, hugo.id, lea.id, emma.id] }) },
    { channel_id: chProjets, author: emma,    content: 'Top, merci Mehdi ! Je t\'ajoute en collaborateur sur notre repo projet web ?', created_at: hr(10) },
    { channel_id: chProjets, author: mehdi,   content: 'Carrement, mon handle est `mehdi-c`.', created_at: hr(9) },
    { channel_id: chProjets, author: lucas,   content: 'Question ouverte : qui prefere Trello vs Notion vs le Kanban Cursus pour suivre un projet ? On utilise quoi ensuite en stage ?', created_at: hr(4) },
    { channel_id: chProjets, author: jean,    content: 'En stage j\'avais Jira, plus puissant mais lourd. Le Kanban Cursus c\'est entre Trello (simple) et Jira (lourd) — assez pour de la pedagogie.', created_at: hr(3) },
    { channel_id: chProjets, author: alice,   content: 'Je trouve que l\'integration `/devoir` -> kanban est bien pensee, ca evite de jongler. Mais on peut exporter ICS si besoin du calendrier perso.', created_at: hr(2), reactions: rx({ '👍': [lucas.id, emma.id] }) },

    // ────────────────────────────────────────────────────────────────────
    // Activite des dernieres heures : echanges courts qui donnent une
    // sensation "promo encore active". On evite de tout poster a la
    // meme heure pour que la timeline paraisse organique.
    // ────────────────────────────────────────────────────────────────────
    { channel_id: chWeb,     author: hugo,     content: 'Petit retex sur la PR auth : les tests `verifyToken` etaient flaky a cause d\'un Date.now() non mocke. Fixe avec `vi.useFakeTimers()` + `vi.setSystemTime()`.', created_at: min(95) },
    { channel_id: chWeb,     author: emma,     content: 'Bonne idee, je rajoute la meme convention sur mes tests middleware. @hugo tu peux push la config dans `vitest.setup.ts` ?', created_at: min(80) },
    { channel_id: chWeb,     author: hugo,     content: 'Vu, push fait. PR `chore/test-utils` ouverte, deux lignes a review.', created_at: min(75), reactions: rx({ '👀': [emma.id, lucas.id] }) },

    { channel_id: chAlgo,    author: lea,      content: 'Question rapide : l\'AVL c\'est `O(log n)` insertion, mais avec **rebalance amortise**, c\'est toujours `O(log n)` ou ca peut grimper ?', created_at: min(45) },
    { channel_id: chAlgo,    author: jean,     content: 'Toujours `O(log n)` worst case grace a l\'invariant |bf| <= 1. Pas d\'amortissement necessaire, contrairement aux arbres splay.', created_at: min(40), reactions: rx({ '🎯': [lea.id, sara.id, hugo.id] }) },
    { channel_id: chAlgo,    author: sara,     content: 'J\'ai fini mon TP4 ! Reste plus qu\'a verifier les tests E2E.', created_at: min(25), reactions: rx({ '🎉': [emma.id, jean.id, lea.id, mehdi.id] }) },

    { channel_id: chProjets, author: emma,     content: 'Quelqu\'un sait si le jury de soutenance accepte un pitch en anglais ? On a pense le faire bilingue.', created_at: min(35) },
    { channel_id: chProjets, author: teacher,  content: 'Bilingue OK pour la soutenance, du moment que la doc reste lisible pour tout le jury. Privilegiez l\'anglais sur les **commentaires de code**, c\'est plus pro.', created_at: min(30), reactions: rx({ '✅': [emma.id, lucas.id, alice.id] }) },
    { channel_id: chProjets, author: lucas,    content: 'On part sur ca. Je traduis le README ce soir.', created_at: min(15) },

    { channel_id: chGeneral, author: alice,    content: 'Petit rappel : la page de la promo a maintenant un raccourci `Ctrl+K` pour la recherche globale. Tres pratique pour retrouver un message ancien.', created_at: min(20), reactions: rx({ '💡': [emma.id, lea.id, hugo.id, mehdi.id] }) },
    { channel_id: chGeneral, author: jean,     content: 'Bon plan. Je teste tout de suite.', created_at: min(12) },
    // Le tout dernier message : quelques minutes a peine, sans reaction (pas
    // encore eu le temps), pour donner cette sensation "ca vient de tomber".
    // Note : 8 minutes (et pas 3) pour ne PAS tomber dans la fenetre de 5
    // minutes que le bot d'edition (botEditOwn) considere comme candidat.
    // Si on laisse ce message dans la fenetre + qu'il a un `?` final, il
    // matche `/ ?\?$/` et le test bots.test.js > "applique un EDIT_PATTERN"
    // se met a flake (ce message gagne la course contre le message-test).
    { channel_id: chGeneral, author: emma,     content: 'On se retrouve en bibli a 17h pour le sprint final ? Je ramene cafe + viennoiseries.', created_at: min(8) },
  ]
}

function makeAssignments(channelIds) {
  // chGeneral n'est volontairement pas utilise : aucun devoir dans le canal
  // d'accueil de la promo. La destructuration documente l'ordre attendu.
  const [, chWeb, chAlgo, chProjets] = channelIds
  const days = (n) => {
    const d = new Date(Date.now() + n * 86400_000)
    return d.toISOString().slice(0, 10)
  }
  // Mix passe + futur : un dashboard etudiant vide laisse l'impression que
  // l'app n'a pas demarre. On seed 4 devoirs deja rendus + notes (passes)
  // pour peupler "Mes notes", "Recents feedbacks" et les statistiques, et
  // 4 devoirs a venir pour les widgets "Echeances", "A rendre" et la frise.
  return [
    // ── Passes (ranges chronologiquement) : notes + feedback synthetises
    //    cote endpoint a partir de l'id (cf. real.js, /students/:id/assignments).
    { channel_id: chAlgo,    title: 'TP3 Tri rapide',          description: 'Implementation d\'un quicksort optimise et benchmark vs tri fusion.', type: 'livrable',   deadline: days(-32) },
    { channel_id: chAlgo,    title: 'Quiz Spark 1',            description: 'Quiz de 10 questions sur la complexite asymptotique.',                  type: 'cctl',       deadline: days(-21) },
    { channel_id: chWeb,     title: 'TP HTML/CSS Layout',      description: 'Reproduction d\'une maquette Figma en flexbox + grid responsive.',     type: 'livrable',   deadline: days(-16) },
    { channel_id: chProjets, title: 'Soutenance projet S1',    description: 'Presentation du projet de groupe semestre 1 (10 min + Q/R).',           type: 'soutenance', deadline: days(-9)  },

    // ── A venir : 3 deja prevus + 1 soutenance pour avoir les 3 types couverts
    { channel_id: chAlgo,    title: 'Quiz Spark 2',            description: 'Quiz de 10 questions sur les arbres equilibres (en classe).',          type: 'cctl',       deadline: days(2)   },
    { channel_id: chAlgo,    title: 'TP4 Arbres AVL',          description: 'Implementation d\'un AVL avec rotations simples et doubles.',          type: 'livrable',   deadline: days(3)   },
    { channel_id: chWeb,     title: 'Projet Web E4',           description: 'Application web responsive avec auth + CRUD. Equipes de 2-3.',         type: 'livrable',   deadline: days(7)   },
    { channel_id: chProjets, title: 'Soutenance Projet Web',   description: 'Presentation du Projet Web E4 devant le jury (15 min + Q/R).',         type: 'soutenance', deadline: days(14)  },
  ]
}

/**
 * Peuple un tenant complet et retourne les IDs cree, plus le `currentUser`
 * fictif (prof ou eleve selon `role`) que la session demo va utiliser.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} tenantId  UUID stable pour cette session
 * @param {'teacher'|'student'} role
 * @returns {{ currentUser: object, promoId: number }}
 */
function seedTenant(db, tenantId, role) {
  const now = new Date().toISOString()

  const txn = db.transaction(() => {
    const insertPromo = db.prepare(
      `INSERT INTO demo_promotions (tenant_id, name, color) VALUES (?, ?, ?)`
    )
    const insertChannel = db.prepare(
      `INSERT INTO demo_channels (tenant_id, promo_id, name, type, description, category)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    const insertStudent = db.prepare(
      `INSERT INTO demo_students (tenant_id, promo_id, name, email, avatar_initials)
       VALUES (?, ?, ?, ?, ?)`
    )

    // ── 2 promos (Licence L3 + Master M1) avec leurs etudiants respectifs.
    // Seule la promo "principale" (Licence, withSeed=true) recoit les
    // canaux + messages + devoirs : ca reste lisible et evite de noyer la
    // demo dans des donnees redondantes.
    const promosCreated = []
    let mainPromoId = null
    let mainStudentRecords = []
    let mainChannelIds = []

    for (const promo of PROMOS) {
      const promoId = insertPromo.run(tenantId, promo.name, promo.color).lastInsertRowid
      promosCreated.push({ id: promoId, name: promo.name, withSeed: promo.withSeed })

      // Etudiants de cette promo
      const records = promo.students.map((s, i) => {
        const id = insertStudent.run(tenantId, promoId, s.name, s.email, s.initials).lastInsertRowid
        return { id, name: s.name, type: 'student', initials: s.initials, color: AVATAR_COLORS[i % AVATAR_COLORS.length] }
      })

      // La promo principale reçoit aussi les channels (et plus tard messages + devoirs)
      if (promo.withSeed) {
        mainPromoId = promoId
        mainStudentRecords = records
        mainChannelIds = CHANNELS.map(c =>
          insertChannel.run(tenantId, promoId, c.name, 'chat', c.description, c.category).lastInsertRowid,
        )
      }
    }

    // ── Teacher : un seul prof responsable des 2 promos. Renomme "Prof. Lemaire"
    // (neutre, pas de reference a une ecole specifique).
    const teacherRes = db.prepare(
      `INSERT INTO demo_teachers (tenant_id, name, email, role) VALUES (?, ?, ?, ?)`
    ).run(tenantId, 'Prof. Lemaire', 'lemaire@demo.cursus', 'teacher')
    const teacherRecord = {
      id: -teacherRes.lastInsertRowid,
      name: 'Prof. Lemaire',
      type: 'teacher',
      initials: 'PL',
      color: '#6366F1',
    }

    // ── Messages (uniquement dans la promo principale)
    // Le seed peut maintenant inclure des messages epingles (is_pinned) et
    // des reactions JSON {emoji: [user_ids]} pour donner de la densite —
    // c'est le canal #developpement-web qui est le plus fourni car c'est
    // la qu'un visiteur etudiant va naturellement aller (Projet Web E4).
    const insertMessage = db.prepare(
      `INSERT INTO demo_messages
         (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content, reactions, is_pinned, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const msg of makeMessages(mainChannelIds, mainStudentRecords, teacherRecord)) {
      insertMessage.run(
        tenantId, msg.channel_id,
        msg.author.id, msg.author.name, msg.author.type, msg.author.initials,
        msg.content,
        msg.reactions ?? null,
        msg.is_pinned ? 1 : 0,
        msg.created_at,
      )
    }

    // ── Assignments (uniquement dans la promo principale)
    const insertAssign = db.prepare(
      `INSERT INTO demo_assignments (tenant_id, channel_id, title, description, type, deadline)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    for (const a of makeAssignments(mainChannelIds)) {
      insertAssign.run(tenantId, a.channel_id, a.title, a.description, a.type, a.deadline)
    }

    return {
      promoId: mainPromoId,
      channelIds: mainChannelIds,
      studentRecords: mainStudentRecords,
      teacherRecord,
      promos: promosCreated,
    }
  })

  const { promoId, studentRecords, teacherRecord } = txn()

  // Construire le `currentUser` selon le role choisi : si etudiant, on pioche
  // le premier de la Licence (Emma) ; si prof, on prend Lemaire (responsable
  // des deux promos). Cette identite est signee dans le JWT demo et envoyee
  // au front.
  let currentUser
  if (role === 'teacher') {
    currentUser = {
      id:               teacherRecord.id,
      name:             teacherRecord.name,
      email:            'lemaire@demo.cursus',
      avatar_initials:  teacherRecord.initials,
      photo_data:       null,
      type:             'teacher',
      promo_id:         promoId,
      promo_name:       'Licence Informatique L3',
      must_change_password: 0,
      onboarding_done:  1,
      demo:             true,
    }
  } else {
    const emma = studentRecords[0]
    currentUser = {
      id:               emma.id,
      name:             emma.name,
      email:            'emma.lefevre@demo.cursus',
      avatar_initials:  emma.initials,
      photo_data:       null,
      type:             'student',
      promo_id:         promoId,
      promo_name:       'Licence Informatique L3',
      must_change_password: 0,
      onboarding_done:  1,
      demo:             true,
    }
  }

  return { currentUser, promoId, createdAt: now }
}

module.exports = { seedTenant }
