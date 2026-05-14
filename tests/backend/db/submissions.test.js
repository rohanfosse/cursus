/**
 * Tests unitaires pour le modele submissions (depots, ressources).
 */
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

let queries

beforeAll(() => {
  setupTestDb()
  queries = require('../../../server/db/models/submissions')

  const db = getTestDb()
  // Seed: travaux for submission tests
  db.exec(`
    INSERT OR IGNORE INTO travaux (id, promo_id, channel_id, title, deadline, type, published, requires_submission, category)
    VALUES (20, 1, 1, 'Devoir Soumission', '2099-12-31T23:59:00Z', 'livrable', 1, 1, 'Web Dev')
  `)
  db.exec(`
    INSERT OR IGNORE INTO travaux (id, promo_id, channel_id, title, deadline, type, published, requires_submission)
    VALUES (21, 1, 1, 'Devoir Expire', '2020-01-01T00:00:00Z', 'livrable', 1, 1)
  `)
  db.exec(`
    INSERT OR IGNORE INTO travaux (id, promo_id, channel_id, title, deadline, type, published, requires_submission)
    VALUES (22, 1, 1, 'Devoir Sans Soumission', '2020-01-01T00:00:00Z', 'livrable', 1, 0)
  `)
})

afterAll(() => teardownTestDb())

describe('addDepot', () => {
  it('creates a file depot with snake_case payload', () => {
    const result = queries.addDepot({
      travail_id: 20,
      student_id: 1,
      type: 'file',
      file_name: 'rapport.pdf',
      content: '/uploads/rapport.pdf',
    })
    expect(result).toBeDefined()
    expect(result.changes).toBe(1)
  })

  it('creates a link depot', () => {
    const db = getTestDb()
    // Need a second student for unique constraint
    db.exec(`
      INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
      VALUES (5, 1, 'Luc Perrin', 'luc@test.fr', 'LP', 'hash', 0)
    `)
    const result = queries.addDepot({
      travail_id: 20,
      student_id: 5,
      type: 'link',
      linkUrl: 'https://github.com/example',
    })
    expect(result.changes).toBe(1)
  })

  it('upserts on conflict (same travail+student)', () => {
    queries.addDepot({
      travail_id: 20,
      student_id: 1,
      type: 'file',
      file_name: 'v2.pdf',
      content: '/uploads/v2.pdf',
    })
    const depots = queries.getDepots(20)
    const student1Depots = depots.filter(d => d.student_id === 1)
    // Should have exactly 1 due to UNIQUE constraint with upsert
    expect(student1Depots.length).toBe(1)
    expect(student1Depots[0].file_name).toBe('v2.pdf')
  })

  it('rejects submission after deadline for requires_submission travail', () => {
    expect(() => {
      queries.addDepot({
        travail_id: 21,
        student_id: 1,
        type: 'file',
        file_name: 'late.pdf',
        content: '/uploads/late.pdf',
      })
    }).toThrow('expiré')
  })

  it('allows submission after deadline when requires_submission is false', () => {
    const result = queries.addDepot({
      travail_id: 22,
      student_id: 1,
      type: 'file',
      file_name: 'ok.pdf',
      content: '/uploads/ok.pdf',
    })
    expect(result.changes).toBe(1)
  })

  it('stores code submission via type=code into code_content (mode exam)', () => {
    const db = getTestDb()
    // Travail exam_mode dedie + un nouvel etudiant pour eviter le conflit upsert.
    db.exec(`
      INSERT OR IGNORE INTO travaux (id, promo_id, channel_id, title, deadline, type, published, requires_submission, exam_mode)
      VALUES (25, 1, 1, 'Examen Code', '2099-12-31T23:59:00Z', 'cctl', 1, 1, 1);
      INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
      VALUES (6, 1, 'Carla Code', 'carla@test.fr', 'CC', 'h', 0);
    `)
    const py = 'def somme(a, b):\n    return a + b\n'
    const result = queries.addDepot({
      travail_id: 25, student_id: 6, type: 'code', content: py,
    })
    expect(result.changes).toBe(1)
    const row = db.prepare('SELECT code_content, file_path, link_url FROM depots WHERE travail_id = ? AND student_id = ?').get(25, 6)
    expect(row.code_content).toBe(py)
    // Les colonnes "file" et "link" doivent rester vides pour un rendu code.
    expect(row.file_path).toBe('')
    expect(row.link_url).toBeNull()
  })
})

describe('addDepot — devoirs de groupe v2.199', () => {
  beforeAll(() => {
    const db = getTestDb()
    // Seed : 3 etudiants de plus, 1 groupe de 4, 1 travail de groupe.
    db.exec(`
      INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
      VALUES
        (10, 1, 'Alice Martin',  'alice@test.fr',  'AM', 'h', 0),
        (11, 1, 'Bob Durand',    'bob@test.fr',    'BD', 'h', 0),
        (12, 1, 'Chloe Leroux',  'chloe@test.fr',  'CL', 'h', 0),
        (13, 1, 'David Moreau',  'david@test.fr',  'DM', 'h', 0);

      INSERT OR IGNORE INTO groups (id, promo_id, name) VALUES (100, 1, 'Equipe A');
      INSERT OR IGNORE INTO group_members (group_id, student_id) VALUES
        (100, 10), (100, 11), (100, 12), (100, 13);

      INSERT OR IGNORE INTO travaux (id, promo_id, channel_id, group_id, title, deadline, type, published, requires_submission)
      VALUES (30, 1, 1, 100, 'Projet de groupe', '2099-12-31T23:59:00Z', 'livrable', 1, 1);
    `)
  })

  it('Alice depose pour le groupe → un seul depot avec group_id renseigne', () => {
    queries.addDepot({
      travail_id: 30,
      student_id: 10,
      type: 'file',
      file_name: 'projet-v1.pdf',
      content: '/uploads/projet-v1.pdf',
    })
    const depots = queries.getDepots(30)
    expect(depots.length).toBe(1)
    expect(depots[0].student_id).toBe(10)
    expect(depots[0].group_id).toBe(100)
    expect(depots[0].file_name).toBe('projet-v1.pdf')
  })

  it("Bob ecrase le depot d'Alice → toujours 1 seul depot, student_id = Bob", () => {
    queries.addDepot({
      travail_id: 30,
      student_id: 11,
      type: 'file',
      file_name: 'projet-v2.pdf',
      content: '/uploads/projet-v2.pdf',
    })
    const depots = queries.getDepots(30)
    expect(depots.length).toBe(1)
    expect(depots[0].student_id).toBe(11)
    expect(depots[0].group_id).toBe(100)
    expect(depots[0].file_name).toBe('projet-v2.pdf')
  })

  it("Chloe et David voient le depot partage quand ils ouvrent leur vue devoirs", () => {
    const assignments = require('../../../server/db/models/assignments')
    const chloeTravaux = assignments.getStudentTravaux(12)
    const groupTravail = chloeTravaux.find(t => t.id === 30)
    expect(groupTravail).toBeDefined()
    expect(groupTravail.depot_id).not.toBeNull()
    expect(groupTravail.depot_author_id).toBe(11)
    expect(groupTravail.depot_author_name).toBe('Bob Durand')
    expect(groupTravail.file_name).toBe('projet-v2.pdf')
  })

  it("markNonSubmittedAsD ne marque PAS D sur les membres d'un groupe qui a rendu", () => {
    const assignments = require('../../../server/db/models/assignments')
    const touched = assignments.markNonSubmittedAsD(30)
    expect(touched).toBe(0) // aucun D ajoute car le groupe a rendu
    const depots = queries.getDepots(30)
    expect(depots.length).toBe(1) // toujours 1 seul depot (celui de Bob)
    expect(depots[0].note).toBeNull() // pas de D sur ce depot
  })

  it("markNonSubmittedAsD ajoute 1 D de groupe si aucun depot existant", () => {
    const db = getTestDb()
    db.exec(`
      INSERT OR IGNORE INTO groups (id, promo_id, name) VALUES (101, 1, 'Equipe B');
      INSERT OR IGNORE INTO group_members (group_id, student_id) VALUES (101, 10), (101, 11);
      INSERT OR IGNORE INTO travaux (id, promo_id, channel_id, group_id, title, deadline, type, published, requires_submission)
      VALUES (31, 1, 1, 101, 'Projet sans rendu', '2020-01-01T00:00:00Z', 'livrable', 1, 1);
    `)
    const assignments = require('../../../server/db/models/assignments')
    const touched = assignments.markNonSubmittedAsD(31)
    expect(touched).toBe(1)
    const depots = queries.getDepots(31)
    expect(depots.length).toBe(1)
    expect(depots[0].group_id).toBe(101)
    expect(depots[0].note).toBe('D')
  })
})

describe('getDepots', () => {
  it('returns depots for a travail with student info', () => {
    const depots = queries.getDepots(20)
    expect(Array.isArray(depots)).toBe(true)
    expect(depots.length).toBeGreaterThan(0)
    expect(depots[0]).toHaveProperty('student_name')
    expect(depots[0]).toHaveProperty('avatar_initials')
    expect(depots[0]).toHaveProperty('late_seconds')
  })

  it('returns empty array for travail with no depots', () => {
    const depots = queries.getDepots(9999)
    expect(depots).toEqual([])
  })
})

describe('setNote', () => {
  it('sets a numeric note on a depot', () => {
    const depots = queries.getDepots(20)
    const depotId = depots[0].id
    const result = queries.setNote({ depotId, note: 15.5 })
    expect(result.changes).toBe(1)

    const db = getTestDb()
    const updated = db.prepare('SELECT note FROM depots WHERE id = ?').get(depotId)
    expect(updated.note).toBe(15.5)
  })
})

describe('setFeedback', () => {
  it('sets feedback text on a depot', () => {
    const depots = queries.getDepots(20)
    const depotId = depots[0].id
    const result = queries.setFeedback({ depotId, feedback: 'Bon travail' })
    expect(result.changes).toBe(1)

    const db = getTestDb()
    const updated = db.prepare('SELECT feedback FROM depots WHERE id = ?').get(depotId)
    expect(updated.feedback).toBe('Bon travail')
  })
})

describe('getRessources', () => {
  it('returns resources for a travail', () => {
    const resources = queries.getRessources(20)
    expect(Array.isArray(resources)).toBe(true)
  })

  it('returns empty array for travail with no resources', () => {
    const resources = queries.getRessources(9999)
    expect(resources).toEqual([])
  })
})

describe('addRessource', () => {
  it('creates a resource linked to a travail', () => {
    const result = queries.addRessource({
      travailId: 20,
      type: 'link',
      name: 'Documentation MDN',
      pathOrUrl: 'https://developer.mozilla.org',
      category: 'reference',
    })
    expect(result).toBeDefined()
    expect(result.changes).toBe(1)
  })

  it('throws for non-existent travail', () => {
    expect(() => {
      queries.addRessource({
        travailId: 99999,
        type: 'link',
        name: 'Invalid',
        pathOrUrl: 'https://example.com',
      })
    }).toThrow('introuvable')
  })
})

describe('deleteRessource', () => {
  it('deletes a ressource from the ressources table', () => {
    const db = getTestDb()
    // travail_id 20 exists from beforeAll seed
    db.prepare(
      "INSERT INTO ressources (travail_id, type, name, path_or_url) VALUES (?, ?, ?, ?)"
    ).run(20, 'link', 'To Delete', 'https://delete.me')
    const row = db.prepare("SELECT id FROM ressources WHERE name = 'To Delete'").get()
    const result = queries.deleteRessource(row.id)
    expect(result.changes).toBe(1)
  })

  it('returns changes=0 for non-existent ressource', () => {
    const result = queries.deleteRessource(99999)
    expect(result.changes).toBe(0)
  })
})
