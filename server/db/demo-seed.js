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

const STUDENTS = [
  { name: 'Emma Lefevre',    email: 'emma.lefevre@demo.cursus',    initials: 'EL' },
  { name: 'Lucas Bernard',   email: 'lucas.bernard@demo.cursus',   initials: 'LB' },
  { name: 'Sara Bouhassoun', email: 'sara.bouhassoun@demo.cursus', initials: 'SB' },
  { name: 'Jean Durand',     email: 'jean.durand@demo.cursus',     initials: 'JD' },
  { name: 'Alice Martin',    email: 'alice.martin@demo.cursus',    initials: 'AM' },
  { name: 'Mehdi Chaouki',   email: 'mehdi.chaouki@demo.cursus',   initials: 'MC' },
]

const CHANNELS = [
  { name: 'general',         description: 'Canal general de la promo',          category: 'Promotion' },
  { name: 'developpement-web', description: 'Cours et TPs developpement web',  category: 'Cours' },
  { name: 'algorithmique',   description: 'Cours et exercices algorithmique',  category: 'Cours' },
  { name: 'projets',         description: 'Coordination projets de groupe',    category: 'Projets' },
]

// Messages historiques (relatifs au moment du seed pour rester coherents).
function makeMessages(channelIds, students, teacher) {
  const now = Date.now()
  const min = (n) => new Date(now - n * 60_000).toISOString()
  const hr  = (n) => new Date(now - n * 3600_000).toISOString()
  const day = (n) => new Date(now - n * 86400_000).toISOString()

  const [chGeneral, chWeb, chAlgo, chProjets] = channelIds
  const [emma, lucas, sara, jean, alice, mehdi] = students

  return [
    // #general
    { channel_id: chGeneral, author: teacher, content: 'Bienvenue sur Cursus pour cette nouvelle annee. La premiere session a lieu lundi 9h en B204.', created_at: day(2) },
    { channel_id: chGeneral, author: emma,    content: 'Merci ! On a deja recu le programme du semestre ?', created_at: day(2) },
    { channel_id: chGeneral, author: teacher, content: 'Oui, le syllabus est dans le canal #cours, et les ressources dans Documents.', created_at: day(2) },
    { channel_id: chGeneral, author: lucas,   content: 'Quelqu\'un a la liste des binomes pour le projet web ?', created_at: day(1) },
    { channel_id: chGeneral, author: sara,    content: 'Je suis avec Mehdi, on a rejoint #developpement-web pour discuter.', created_at: day(1) },

    // #developpement-web
    { channel_id: chWeb, author: teacher, content: 'Le **livrable Projet Web** est a rendre vendredi 17h. Pensez a deposer vos depots ici.', created_at: hr(28) },
    { channel_id: chWeb, author: emma,    content: 'On peut travailler en equipe de 2 ou 3 ?', created_at: hr(27) },
    { channel_id: chWeb, author: teacher, content: 'Oui, groupes de 2-3. Utilisez ce canal pour coordonner.', created_at: hr(27) },
    { channel_id: chWeb, author: lucas,   content: 'On a commence avec @Sara sur la partie auth. Quelqu\'un fait le front ?', created_at: hr(5) },
    { channel_id: chWeb, author: alice,   content: 'Je peux faire le front avec Vue, j\'ai deja fait un truc similaire l\'an dernier.', created_at: hr(4) },
    { channel_id: chWeb, author: jean,    content: 'Je m\'occupe de la CI/CD si vous voulez. J\'ai un setup GitHub Actions pret.', created_at: hr(2) },

    // #algorithmique
    { channel_id: chAlgo, author: teacher, content: 'Rappel : la correction du TP3 est en ligne. Le prochain quiz Spark portera sur les arbres AVL.', created_at: day(1) },
    { channel_id: chAlgo, author: sara,    content: 'Quelqu\'un a compris la rotation double ? Je bloque sur le cas gauche-droite.', created_at: hr(8) },
    { channel_id: chAlgo, author: jean,    content: 'Regarde le `balanceFactor`. Si > 1 et fils gauche < 0 -> rotation gauche-droite.', created_at: hr(7) },
    { channel_id: chAlgo, author: mehdi,   content: 'J\'ai un schema clair sur GitHub, je le partage dans #projets.', created_at: hr(6) },

    // #projets
    { channel_id: chProjets, author: teacher, content: 'Pensez a creer un projet Kanban pour organiser vos taches. Le bouton est dans la sidebar.', created_at: day(3) },
    { channel_id: chProjets, author: alice,   content: 'On a fait notre Kanban hier, c\'est super clair pour repartir les taches.', created_at: day(2) },
    { channel_id: chProjets, author: mehdi,   content: 'Mon schema rotations AVL : voila le lien GitHub. N\'hesitez pas a me ping si bloques.', created_at: hr(5) },
    { channel_id: chProjets, author: emma,    content: 'Top, merci Mehdi !', created_at: hr(4) },
  ]
}

function makeAssignments(channelIds) {
  const [, chWeb, chAlgo] = channelIds
  const days = (n) => {
    const d = new Date(Date.now() + n * 86400_000)
    return d.toISOString().slice(0, 10)
  }
  return [
    { channel_id: chWeb,  title: 'Projet Web E4',     description: 'Application web responsive avec auth + CRUD. Equipes de 2-3.', type: 'livrable', deadline: days(7) },
    { channel_id: chAlgo, title: 'TP4 Arbres AVL',    description: 'Implementation d\'un AVL avec rotations simples et doubles.', type: 'livrable', deadline: days(3) },
    { channel_id: chAlgo, title: 'Quiz Spark 2',      description: 'Quiz de 10 questions sur les arbres equilibres (en classe).', type: 'cctl',     deadline: days(2) },
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
    // ── Promotion
    const promoRes = db.prepare(
      `INSERT INTO demo_promotions (tenant_id, name, color) VALUES (?, ?, ?)`
    ).run(tenantId, 'CPIA2 25-26 (Demo)', '#6366F1')
    const promoId = promoRes.lastInsertRowid

    // ── Channels
    const insertChannel = db.prepare(
      `INSERT INTO demo_channels (tenant_id, promo_id, name, type, description, category)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    const channelIds = CHANNELS.map(c =>
      insertChannel.run(tenantId, promoId, c.name, 'chat', c.description, c.category).lastInsertRowid
    )

    // ── Students
    const insertStudent = db.prepare(
      `INSERT INTO demo_students (tenant_id, promo_id, name, email, avatar_initials)
       VALUES (?, ?, ?, ?, ?)`
    )
    const studentRecords = STUDENTS.map((s, i) => {
      const id = insertStudent.run(tenantId, promoId, s.name, s.email, s.initials).lastInsertRowid
      return { id, name: s.name, type: 'student', initials: s.initials, color: AVATAR_COLORS[i % AVATAR_COLORS.length] }
    })

    // ── Teacher
    const teacherRes = db.prepare(
      `INSERT INTO demo_teachers (tenant_id, name, email, role) VALUES (?, ?, ?, ?)`
    ).run(tenantId, 'Prof. Martin Renaud', 'martin.renaud@demo.cursus', 'teacher')
    const teacherRecord = {
      id: -teacherRes.lastInsertRowid, // negatif comme en prod (cf. students.js:134)
      name: 'Prof. Martin Renaud',
      type: 'teacher',
      initials: 'MR',
      color: '#6366F1',
    }

    // ── Messages
    const insertMessage = db.prepare(
      `INSERT INTO demo_messages
         (tenant_id, channel_id, author_id, author_name, author_type, author_initials, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const msg of makeMessages(channelIds, studentRecords, teacherRecord)) {
      insertMessage.run(
        tenantId, msg.channel_id,
        msg.author.id, msg.author.name, msg.author.type, msg.author.initials,
        msg.content, msg.created_at,
      )
    }

    // ── Assignments
    const insertAssign = db.prepare(
      `INSERT INTO demo_assignments (tenant_id, channel_id, title, description, type, deadline)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    for (const a of makeAssignments(channelIds)) {
      insertAssign.run(tenantId, a.channel_id, a.title, a.description, a.type, a.deadline)
    }

    return { promoId, channelIds, studentRecords, teacherRecord }
  })

  const { promoId, studentRecords, teacherRecord } = txn()

  // Construire le `currentUser` selon le role choisi : si etudiant, on pioche
  // le premier (Emma) ; si prof, on prend Martin. Cette identite est ensuite
  // signee dans le JWT demo et envoyee au front.
  let currentUser
  if (role === 'teacher') {
    currentUser = {
      id:               teacherRecord.id,
      name:             teacherRecord.name,
      email:            'martin.renaud@demo.cursus',
      avatar_initials:  teacherRecord.initials,
      photo_data:       null,
      type:             'teacher',
      promo_id:         promoId,
      promo_name:       'CPIA2 25-26 (Demo)',
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
      promo_name:       'CPIA2 25-26 (Demo)',
      must_change_password: 0,
      onboarding_done:  1,
      demo:             true,
    }
  }

  return { currentUser, promoId, createdAt: now }
}

module.exports = { seedTenant }
