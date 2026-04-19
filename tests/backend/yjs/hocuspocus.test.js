/**
 * Tests unitaires du guard cote Hocuspocus :
 *   - parseCahierId : extrait l'id depuis le documentName
 *   - checkCahierAccess : autorise/refuse selon promo + groupe (mirror
 *     du middleware HTTP requireCahierAccess)
 */
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

let parseCahierId, checkCahierAccess

beforeAll(() => {
  setupTestDb()
  ;({ parseCahierId, checkCahierAccess } = require('../../../server/yjs/hocuspocus'))

  // Seed
  const db = getTestDb()
  db.exec(`INSERT OR IGNORE INTO promotions (id, name, color) VALUES (2, 'Promo 2', '#888')`)
  db.prepare(
    `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
     VALUES (2, 2, 'Bob', 'bob@test.fr', 'BB', 'xxxxx', 0)`
  ).run()
  // Cahier promo 1 (student 1 est dans promo 1)
  db.prepare('INSERT INTO cahiers (id, promo_id, project, title, created_by) VALUES (10, 1, NULL, ?, 1)')
    .run('Cahier P1')
  // Cahier promo 2
  db.prepare('INSERT INTO cahiers (id, promo_id, project, title, created_by) VALUES (11, 2, NULL, ?, 2)')
    .run('Cahier P2')
  // Cahier group-scope : promo 1, group_id = 1 (avec group_members=[1])
  db.prepare('INSERT OR IGNORE INTO groups (id, promo_id, name) VALUES (1, 1, ?)').run('Groupe A')
  db.prepare('INSERT OR IGNORE INTO group_members (group_id, student_id) VALUES (1, 1)').run()
  db.prepare('INSERT INTO cahiers (id, promo_id, group_id, project, title, created_by) VALUES (12, 1, 1, NULL, ?, 1)')
    .run('Cahier Groupe A')
})

afterAll(() => teardownTestDb())

describe('parseCahierId', () => {
  it('parses "cahier-42" -> 42', () => {
    expect(parseCahierId('cahier-42')).toBe(42)
  })
  it('returns null on bad names', () => {
    expect(parseCahierId('cahier-')).toBeNull()
    expect(parseCahierId('other-42')).toBeNull()
    expect(parseCahierId('cahier-abc')).toBeNull()
    expect(parseCahierId('')).toBeNull()
  })
})

describe('checkCahierAccess', () => {
  const adminUser   = { id: 1, type: 'admin' }
  const teacherUser = { id: 1, type: 'teacher' }
  const studentP1   = { id: 1, type: 'student', promo_id: 1 }
  const studentP2   = { id: 2, type: 'student', promo_id: 2 }

  it('admin bypasses all checks', () => {
    expect(checkCahierAccess(adminUser, 10).ok).toBe(true)
    expect(checkCahierAccess(adminUser, 11).ok).toBe(true)
    expect(checkCahierAccess(adminUser, 99999).ok).toBe(false) // not found
  })

  it('teacher with promo access is allowed', () => {
    // Teacher 1 est assigne a promo 1 (fixture), pas a promo 2
    expect(checkCahierAccess(teacherUser, 10).ok).toBe(true)
    expect(checkCahierAccess(teacherUser, 11).ok).toBe(false) // promo 2
  })

  it('student in matching promo is allowed on promo-scope cahier', () => {
    expect(checkCahierAccess(studentP1, 10).ok).toBe(true)
    expect(checkCahierAccess(studentP2, 10).ok).toBe(false)
  })

  it('student in matching promo+group is allowed on group-scope cahier', () => {
    expect(checkCahierAccess(studentP1, 12).ok).toBe(true)
  })

  it('student in matching promo but NOT in group is denied on group-scope cahier', () => {
    // Seed student 3 dans promo 1 mais pas dans group 1
    const db = getTestDb()
    db.prepare(
      `INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
       VALUES (3, 1, 'Carl', 'c@test.fr', 'CL', 'x', 0)`
    ).run()
    const studentP1notInGroup = { id: 3, type: 'student', promo_id: 1 }
    const res = checkCahierAccess(studentP1notInGroup, 12)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('not_in_group')
  })

  it('returns structured reason on denial', () => {
    expect(checkCahierAccess(studentP2, 10).reason).toBe('wrong_promo')
    expect(checkCahierAccess(null, 10).reason).toBe('no_user')
    expect(checkCahierAccess(studentP1, 99999).reason).toBe('cahier_not_found')
  })
})
