#!/usr/bin/env node
/**
 * scripts/seed.js — peuple la DB locale avec un dataset minimal pour le dev.
 *
 * Usage : `npm run seed` ou `node scripts/seed.js`
 *
 * Idempotent : utilise INSERT OR IGNORE et detecte les rows existants par
 * email/nom pour ne pas dupliquer si on relance. Safe a executer plusieurs
 * fois — relancer recree les rows manquants sans toucher a celles deja la.
 *
 * Resultat apres exec :
 *   - 1 promo "Licence Informatique L3 (Dev)"
 *   - 1 admin    : admin@cursus.dev    / Admin1234!
 *   - 1 prof     : prof@cursus.dev     / Prof1234!
 *   - 1 etudiant : etudiant@cursus.dev / Etudiant1234!
 *   - 3 canaux : general / developpement-web / projets
 *   - ~6 messages (annonces + thread d'exemple)
 *   - 1 cours Lumen factice avec 1 chapitre
 *
 * Variables d'env optionnelles :
 *   DB_PATH=/tmp/test.db npm run seed   -> override le path de la DB
 *   SEED_RESET=1 npm run seed           -> wipe les rows seed avant insert
 */

const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')

// ─── Config ───────────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'cursus.db')
const SEED_RESET = process.env.SEED_RESET === '1'

// ─── Helpers ──────────────────────────────────────────────────────────
function log(msg, ...args) {
  console.log(`[seed] ${msg}`, ...args)
}

function ensureDbDir(dbPath) {
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// ─── Schema bootstrap ─────────────────────────────────────────────────
// On require le schema apres avoir set DB_PATH pour que connection.js
// utilise le bon chemin. Le module exporte `getDb` + `initSchema`.
function bootstrapDb() {
  ensureDbDir(DB_PATH)

  // Force connection module a utiliser notre DB_PATH (override Electron lookup)
  process.env.DB_PATH = DB_PATH

  // Reset les modules require'd qui auraient pu garder un singleton DB
  delete require.cache[require.resolve('../server/db/connection')]
  delete require.cache[require.resolve('../server/db/schema')]

  const connection = require('../server/db/connection')
  const { initSchema } = require('../server/db/schema')

  log('Connexion a la DB :', DB_PATH)
  const db = connection.getDb()
  initSchema()
  log('Schema initialise (migrations a jour)')

  return db
}

// ─── Insertions seed ──────────────────────────────────────────────────
function seedPromo(db) {
  const existing = db.prepare(`SELECT id FROM promotions WHERE name = ?`)
    .get('Licence Informatique L3 (Dev)')
  if (existing) {
    log('Promo deja presente, id =', existing.id)
    return existing.id
  }
  const result = db.prepare(
    `INSERT INTO promotions (name, color) VALUES (?, ?)`
  ).run('Licence Informatique L3 (Dev)', '#6366F1')
  log('Promo creee, id =', result.lastInsertRowid)
  return Number(result.lastInsertRowid)
}

function seedAdmin(db) {
  const email = 'admin@cursus.dev'
  const existing = db.prepare(`SELECT id FROM teachers WHERE email = ?`).get(email)
  if (existing) {
    log('Admin deja present, id =', existing.id)
    return existing.id
  }
  const hash = bcrypt.hashSync('Admin1234!', 10)
  const result = db.prepare(
    `INSERT INTO teachers (name, email, password, role, must_change_password)
     VALUES (?, ?, ?, 'admin', 0)`
  ).run('Admin Dev', email, hash)
  log('Admin cree :', email, '/ Admin1234!')
  return Number(result.lastInsertRowid)
}

function seedTeacher(db, promoId) {
  const email = 'prof@cursus.dev'
  const existing = db.prepare(`SELECT id FROM teachers WHERE email = ?`).get(email)
  let teacherId
  if (existing) {
    log('Prof deja present, id =', existing.id)
    teacherId = existing.id
  } else {
    const hash = bcrypt.hashSync('Prof1234!', 10)
    const result = db.prepare(
      `INSERT INTO teachers (name, email, password, role, must_change_password)
       VALUES (?, ?, ?, 'teacher', 0)`
    ).run('Prof. Dev', email, hash)
    teacherId = Number(result.lastInsertRowid)
    log('Prof cree :', email, '/ Prof1234!')
  }

  // Assigne le prof a la promo (idempotent grace au UNIQUE constraint)
  db.prepare(
    `INSERT OR IGNORE INTO teacher_promos (teacher_id, promo_id) VALUES (?, ?)`
  ).run(teacherId, promoId)
  return teacherId
}

function seedStudent(db, promoId) {
  const email = 'etudiant@cursus.dev'
  const existing = db.prepare(`SELECT id FROM students WHERE email = ?`).get(email)
  if (existing) {
    log('Etudiant deja present, id =', existing.id)
    return existing.id
  }
  const hash = bcrypt.hashSync('Etudiant1234!', 10)
  const result = db.prepare(
    `INSERT INTO students (promo_id, name, email, avatar_initials, password, must_change_password, onboarding_done)
     VALUES (?, ?, ?, ?, ?, 0, 1)`
  ).run(promoId, 'Etudiant Dev', email, 'ED', hash)
  log('Etudiant cree :', email, '/ Etudiant1234!')
  return Number(result.lastInsertRowid)
}

function seedChannels(db, promoId) {
  const channels = [
    { name: 'general',           type: 'chat',     description: 'Canal general de la promo',     category: 'Promotion' },
    { name: 'developpement-web', type: 'chat',     description: 'Cours et TPs developpement web', category: 'Cours' },
    { name: 'projets',           type: 'chat',     description: 'Coordination projets de groupe', category: 'Projets' },
  ]
  const ids = []
  const insert = db.prepare(
    `INSERT INTO channels (promo_id, name, type, description, category)
     VALUES (?, ?, ?, ?, ?)`
  )
  const find = db.prepare(`SELECT id FROM channels WHERE promo_id = ? AND name = ?`)
  for (const c of channels) {
    const existing = find.get(promoId, c.name)
    if (existing) {
      ids.push(existing.id)
      continue
    }
    const r = insert.run(promoId, c.name, c.type, c.description, c.category)
    ids.push(Number(r.lastInsertRowid))
  }
  log(`${ids.length} canaux OK`)
  return ids
}

function seedMessages(db, channelIds, teacherId, studentId) {
  const [chGeneral, chWeb] = channelIds
  // Skip si des messages existent deja sur le general (evite spam au re-run)
  const existingCount = db.prepare(
    `SELECT COUNT(*) c FROM messages WHERE channel_id = ?`
  ).get(chGeneral).c
  if (existingCount > 0) {
    log(`${existingCount} messages deja presents, skip seed messages`)
    return
  }

  const insert = db.prepare(
    `INSERT INTO messages
       (channel_id, author_id, author_name, author_type, content)
     VALUES (?, ?, ?, ?, ?)`
  )

  // teacher_id en negatif pour distinguer des students (convention prod)
  const teacherIdNeg = -teacherId

  insert.run(chGeneral, teacherIdNeg, 'Prof. Dev', 'teacher',
    'Bienvenue dans cette session de dev. La premiere session a lieu lundi 9h en B204.')
  insert.run(chGeneral, studentId, 'Etudiant Dev', 'student',
    'Merci ! Je suis pret pour le projet web.')
  insert.run(chWeb, teacherIdNeg, 'Prof. Dev', 'teacher',
    'Le **livrable Projet Web** est a rendre vendredi 17h. Pensez a deposer vos rendus.')
  insert.run(chWeb, studentId, 'Etudiant Dev', 'student',
    'Question : on peut travailler en equipe de 2 ?')
  insert.run(chWeb, teacherIdNeg, 'Prof. Dev', 'teacher',
    'Oui, equipes de 2-3. Coordination via #projets.')
  insert.run(chWeb, studentId, 'Etudiant Dev', 'student',
    'Note. Je m\'occupe de la CI/CD avec GitHub Actions.')
  log('6 messages seedes')
}

function seedLumenRepo(db, promoId, teacherId) {
  // Verifie si la table lumen_repos existe (peut etre absente sur un schema
  // ancien — on skip silencieusement)
  const hasTable = db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='lumen_repos'`
  ).get()
  if (!hasTable) {
    log('Table lumen_repos absente, skip')
    return null
  }

  const fullName = 'cesi-dev/algo-l3-demo'
  const existing = db.prepare(`SELECT id FROM lumen_repos WHERE full_name = ?`).get(fullName)
  if (existing) {
    log('Lumen repo deja present, id =', existing.id)
    return existing.id
  }

  // Manifest minimal avec 1 chapitre
  const manifest = JSON.stringify({
    project: 'Algorithmique L3',
    description: 'Cours d\'introduction aux algorithmes',
    chapters: [
      { path: 'tri-rapide.md', title: 'Tri rapide' },
    ],
  })

  // Schema lumen_repos peut differer selon les migrations — on cible les
  // colonnes communes. Si une colonne manque, le INSERT echoue et on log.
  try {
    const result = db.prepare(
      `INSERT INTO lumen_repos
         (promo_id, teacher_id, full_name, manifest_json, default_branch, last_synced_at)
       VALUES (?, ?, ?, ?, 'main', datetime('now'))`
    ).run(promoId, teacherId, fullName, manifest)
    log('Lumen repo cree :', fullName)
    return Number(result.lastInsertRowid)
  } catch (err) {
    log('Skip lumen repo (schema incompatible) :', err.message)
    return null
  }
}

// ─── Main ─────────────────────────────────────────────────────────────
function main() {
  log(`Demarrage seed ${SEED_RESET ? '(MODE RESET)' : ''}`)

  const db = bootstrapDb()

  if (SEED_RESET) {
    log('Reset des donnees seed (emails *.cursus.dev)...')
    db.exec(`
      DELETE FROM messages WHERE author_name IN ('Prof. Dev', 'Etudiant Dev');
      DELETE FROM channels WHERE promo_id IN (SELECT id FROM promotions WHERE name LIKE '%(Dev)%');
      DELETE FROM teacher_promos WHERE teacher_id IN (SELECT id FROM teachers WHERE email LIKE '%@cursus.dev');
      DELETE FROM students WHERE email LIKE '%@cursus.dev';
      DELETE FROM teachers WHERE email LIKE '%@cursus.dev';
      DELETE FROM promotions WHERE name LIKE '%(Dev)%';
    `)
    log('Reset OK')
  }

  db.transaction(() => {
    const promoId = seedPromo(db)
    seedAdmin(db)
    const teacherId = seedTeacher(db, promoId)
    const studentId = seedStudent(db, promoId)
    const channelIds = seedChannels(db, promoId)
    seedMessages(db, channelIds, teacherId, studentId)
    seedLumenRepo(db, promoId, teacherId)
  })()

  log('━'.repeat(60))
  log('Seed termine. Comptes de dev :')
  log('  admin     -> admin@cursus.dev     / Admin1234!')
  log('  prof      -> prof@cursus.dev      / Prof1234!')
  log('  etudiant  -> etudiant@cursus.dev  / Etudiant1234!')
  log('━'.repeat(60))
  log('Lance `npm run server` puis ouvre http://localhost:3001')
}

if (require.main === module) {
  try {
    main()
    process.exit(0)
  } catch (err) {
    console.error('[seed] ERREUR :', err.message)
    console.error(err.stack)
    process.exit(1)
  }
}

module.exports = { main }
