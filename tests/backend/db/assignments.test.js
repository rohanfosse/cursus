/**
 * Tests unitaires pour le modèle assignments (travaux/devoirs).
 */
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

let queries

beforeAll(() => {
  setupTestDb()
  queries = require('../../../server/db/models/assignments')
})

afterAll(() => teardownTestDb())

describe('createTravail', () => {
  it('creates a devoir with required fields', () => {
    const result = queries.createTravail({
      title: 'CCTL Module 1',
      description: 'Session Initiale\nDurée : 20 min',
      type: 'cctl',
      channelId: 1,
      promoId: 1,
      deadline: '2026-04-15T10:00:00Z',
      published: true,
    })
    expect(result).toBeDefined()
    expect(result.changes).toBe(1)
    expect(Number(result.lastInsertRowid)).toBeGreaterThan(0)
  })

  it('creates a livrable with all fields', () => {
    const result = queries.createTravail({
      title: 'Rapport Final',
      description: 'Rapport de projet',
      type: 'livrable',
      channelId: 1,
      promoId: 1,
      deadline: '2026-05-01T23:59:00Z',
      startDate: '2026-03-01T00:00:00Z',
      category: 'monitor Développement Web',
      published: false,
      room: null,
      aavs: 'Compétence 1\nCompétence 2',
      requiresSubmission: true,
    })
    expect(result).toBeDefined()
    expect(result.changes).toBe(1)
  })

  it('creates a soutenance without submission', () => {
    const result = queries.createTravail({
      title: 'Soutenance Projet',
      type: 'soutenance',
      channelId: 1,
      promoId: 1,
      deadline: '2026-06-15T14:00:00Z',
      published: true,
      room: 'B204',
      requiresSubmission: false,
    })
    expect(result).toBeDefined()
    expect(result.changes).toBe(1)
  })

  it('retrieves created devoir by id', () => {
    const result = queries.createTravail({
      title: 'Test Retrieval',
      type: 'autre',
      channelId: 1,
      promoId: 1,
      deadline: '2026-04-20T10:00:00Z',
      published: true,
    })
    const id = Number(result.lastInsertRowid)
    const devoir = queries.getTravailById(id)
    expect(devoir).toBeDefined()
    expect(devoir.title).toBe('Test Retrieval')
    expect(devoir.type).toBe('autre')
  })
})

describe('getTravaux', () => {
  it('returns travaux for a channel', () => {
    const result = queries.getTravaux(1)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBeGreaterThan(0)
  })

  it('returns empty array for non-existent channel', () => {
    const result = queries.getTravaux(9999)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(0)
  })
})

describe('updateTravailPublished', () => {
  it('publishes a draft', () => {
    const result = queries.createTravail({
      title: 'Draft Test',
      type: 'livrable',
      channelId: 1,
      promoId: 1,
      deadline: '2026-05-01T00:00:00Z',
      published: false,
    })
    const id = Number(result.lastInsertRowid)
    queries.updateTravailPublished({ travailId: id, published: true })
    const devoir = queries.getTravailById(id)
    expect(devoir.is_published).toBe(1)
  })

  it('unpublishes a devoir', () => {
    const result = queries.createTravail({
      title: 'Unpublish Test',
      type: 'cctl',
      channelId: 1,
      promoId: 1,
      deadline: '2026-05-01T00:00:00Z',
      published: true,
    })
    const id = Number(result.lastInsertRowid)
    queries.updateTravailPublished({ travailId: id, published: false })
    const devoir = queries.getTravailById(id)
    expect(devoir.is_published).toBe(0)
  })
})

describe('deleteTravail', () => {
  it('deletes a devoir', () => {
    const result = queries.createTravail({
      title: 'Delete Me',
      type: 'autre',
      channelId: 1,
      promoId: 1,
      deadline: '2026-05-01T00:00:00Z',
      published: false,
    })
    const id = Number(result.lastInsertRowid)
    queries.deleteTravail(id)
    const devoir = queries.getTravailById(id)
    expect(devoir).toBeUndefined()
  })
})

describe('updateTravail', () => {
  let travailId

  beforeAll(() => {
    const result = queries.createTravail({
      title: 'Update Target',
      type: 'livrable',
      channelId: 1,
      promoId: 1,
      deadline: '2026-06-01T00:00:00Z',
      published: true,
    })
    travailId = Number(result.lastInsertRowid)
  })

  it('updates title', () => {
    queries.updateTravail(travailId, { title: 'Updated Title' })
    const t = queries.getTravailById(travailId)
    expect(t.title).toBe('Updated Title')
  })

  it('updates deadline', () => {
    queries.updateTravail(travailId, { deadline: '2026-07-01T00:00:00Z' })
    const t = queries.getTravailById(travailId)
    expect(t.deadline).toBe('2026-07-01T00:00:00Z')
  })

  it('updates description', () => {
    queries.updateTravail(travailId, { description: 'Nouvelle description' })
    const t = queries.getTravailById(travailId)
    expect(t.description).toBe('Nouvelle description')
  })

  it('updates room', () => {
    queries.updateTravail(travailId, { room: 'B305' })
    const t = queries.getTravailById(travailId)
    expect(t.room).toBe('B305')
  })

  it('returns changes 0 when no field provided', () => {
    const result = queries.updateTravail(travailId, {})
    expect(result).toEqual({ changes: 0 })
  })
})

describe('getStudentTravaux', () => {
  it('returns published travaux for student promo', () => {
    const result = queries.getStudentTravaux(1)
    expect(Array.isArray(result)).toBe(true)
    // Only published travaux
    for (const t of result) {
      // getTravailById uses `published AS is_published`, getStudentTravaux filters by published=1
      expect(t).toHaveProperty('title')
    }
  })

  it('returns empty for student with no promo match', () => {
    const result = queries.getStudentTravaux(9999)
    expect(result).toEqual([])
  })
})

describe('getTravauxSuivi', () => {
  it('returns suivi data for a travail', () => {
    // Create a travail and check suivi (student 1 is in promo 1)
    const result = queries.createTravail({
      title: 'Suivi Test',
      type: 'livrable',
      channelId: 1,
      promoId: 1,
      deadline: '2026-08-01T00:00:00Z',
      published: true,
      requiresSubmission: true,
    })
    const id = Number(result.lastInsertRowid)
    const suivi = queries.getTravauxSuivi(id)
    expect(Array.isArray(suivi)).toBe(true)
    expect(suivi.length).toBeGreaterThan(0)
    expect(suivi[0]).toHaveProperty('student_id')
    expect(suivi[0]).toHaveProperty('student_name')
  })
})

describe('getGanttData', () => {
  it('returns gantt data for a promo', () => {
    const data = queries.getGanttData(1)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
    expect(data[0]).toHaveProperty('title')
    expect(data[0]).toHaveProperty('promo_name')
  })

  it('returns gantt data for a channel', () => {
    const data = queries.getGanttData(null, 1)
    expect(Array.isArray(data)).toBe(true)
  })

  it('returns all gantt data when no filters', () => {
    const data = queries.getGanttData(null, null)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })
})

describe('getAllRendus', () => {
  beforeAll(() => {
    // Add a depot so we have rendus
    const db = getTestDb()
    const t = queries.createTravail({
      title: 'Rendu Test', type: 'livrable', channelId: 1, promoId: 1,
      deadline: '2099-12-31T23:59:00Z', published: true, requiresSubmission: true,
    })
    const tid = Number(t.lastInsertRowid)
    db.prepare(`INSERT OR IGNORE INTO depots (travail_id, student_id, file_name, file_path) VALUES (?, 1, 'rendu.pdf', '/tmp/rendu.pdf')`).run(tid)
  })

  it('returns all rendus for a promo', () => {
    const rendus = queries.getAllRendus(1)
    expect(Array.isArray(rendus)).toBe(true)
    expect(rendus.length).toBeGreaterThan(0)
    expect(rendus[0]).toHaveProperty('student_name')
    expect(rendus[0]).toHaveProperty('travail_title')
  })

  it('returns all rendus without promo filter', () => {
    const rendus = queries.getAllRendus()
    expect(Array.isArray(rendus)).toBe(true)
    expect(rendus.length).toBeGreaterThan(0)
  })
})

describe('markNonSubmittedAsD', () => {
  it('marks non-submitted students as D', () => {
    const t = queries.createTravail({
      title: 'Mark D Test', type: 'livrable', channelId: 1, promoId: 1,
      deadline: '2026-01-01T00:00:00Z', published: true, requiresSubmission: true,
    })
    const tid = Number(t.lastInsertRowid)
    const count = queries.markNonSubmittedAsD(tid)
    expect(count).toBeGreaterThan(0)
  })

  it('returns 0 for non-existent travail', () => {
    expect(queries.markNonSubmittedAsD(99999)).toBe(0)
  })

  it('returns 0 for travail without requires_submission', () => {
    const t = queries.createTravail({
      title: 'No Sub', type: 'soutenance', channelId: 1, promoId: 1,
      deadline: '2026-01-01T00:00:00Z', published: true, requiresSubmission: false,
    })
    const tid = Number(t.lastInsertRowid)
    expect(queries.markNonSubmittedAsD(tid)).toBe(0)
  })
})

describe('getTravailCategories', () => {
  beforeAll(() => {
    queries.createTravail({
      title: 'Cat Test', type: 'livrable', channelId: 1, promoId: 1,
      deadline: '2026-01-01T00:00:00Z', published: true, category: 'Web Dev',
    })
  })

  it('returns distinct categories for a promo', () => {
    const cats = queries.getTravailCategories(1)
    expect(Array.isArray(cats)).toBe(true)
    expect(cats).toContain('Web Dev')
  })

  it('returns empty for promo with no categories', () => {
    const cats = queries.getTravailCategories(9999)
    expect(cats).toEqual([])
  })
})

describe('getUpcomingNotifications', () => {
  it('returns an array', () => {
    const notifs = queries.getUpcomingNotifications()
    expect(Array.isArray(notifs)).toBe(true)
  })
})

describe('getTeacherSchedule', () => {
  it('returns schedule with all sections', () => {
    const schedule = queries.getTeacherSchedule()
    expect(schedule).toHaveProperty('aNoter')
    expect(schedule).toHaveProperty('jalons')
    expect(schedule).toHaveProperty('brouillons')
    expect(schedule).toHaveProperty('urgents')
    expect(Array.isArray(schedule.aNoter)).toBe(true)
    expect(Array.isArray(schedule.jalons)).toBe(true)
    expect(Array.isArray(schedule.brouillons)).toBe(true)
    expect(Array.isArray(schedule.urgents)).toBe(true)
  })
})

describe('travail group members', () => {
  let travailId, groupId

  beforeAll(() => {
    const db = getTestDb()
    // Create a group
    db.prepare("INSERT OR IGNORE INTO groups (id, promo_id, name) VALUES (10, 1, 'Groupe Test')").run()
    db.prepare("INSERT OR IGNORE INTO group_members (group_id, student_id) VALUES (10, 1)").run()
    const result = queries.createTravail({
      title: 'Group Travail', type: 'livrable', channelId: 1, promoId: 1,
      deadline: '2026-09-01T00:00:00Z', published: true, groupId: 10,
    })
    travailId = Number(result.lastInsertRowid)
    groupId = 10
  })

  it('getTravailGroupMembers returns members', () => {
    const members = queries.getTravailGroupMembers(travailId)
    expect(Array.isArray(members)).toBe(true)
    expect(members.length).toBeGreaterThan(0)
    expect(members[0]).toHaveProperty('student_name')
    expect(members[0]).toHaveProperty('group_name')
  })

  it('setTravailGroupMember assigns student to group', () => {
    const db = getTestDb()
    db.prepare("INSERT OR IGNORE INTO groups (id, promo_id, name) VALUES (11, 1, 'Groupe B')").run()
    db.prepare("INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password) VALUES (3, 1, 'Marie', 'marie@test.fr', 'MA', 'hash', 0)").run()
    queries.setTravailGroupMember({ travailId, studentId: 3, groupId: 11 })
    const members = queries.getTravailGroupMembers(travailId)
    const marie = members.find(m => m.student_id === 3)
    expect(marie).toBeDefined()
    expect(marie.group_id).toBe(11)
  })

  it('setTravailGroupMember removes student when groupId is null', () => {
    queries.setTravailGroupMember({ travailId, studentId: 3, groupId: null })
    const members = queries.getTravailGroupMembers(travailId)
    const marie = members.find(m => m.student_id === 3)
    expect(marie).toBeUndefined()
  })
})

// ── Publication programmee (#91-#94) ─────────────────────────────────────────

describe('scheduled publishing', () => {
  it('creates a devoir with scheduled_publish_at', () => {
    const result = queries.createTravail({
      title: 'Scheduled Devoir',
      type: 'livrable',
      channelId: 1,
      promoId: 1,
      deadline: '2026-06-01T23:59:00Z',
      published: false,
      scheduledPublishAt: '2026-05-01T08:00:00Z',
    })
    const id = Number(result.lastInsertRowid)
    const devoir = queries.getTravailById(id)
    expect(devoir.scheduled_publish_at).toBe('2026-05-01T08:00:00Z')
    expect(devoir.is_published).toBe(0)
  })

  it('creates a devoir without scheduled_publish_at (defaults to null)', () => {
    const result = queries.createTravail({
      title: 'Non-Scheduled Devoir',
      type: 'cctl',
      channelId: 1,
      promoId: 1,
      deadline: '2026-06-15T10:00:00Z',
      published: true,
    })
    const id = Number(result.lastInsertRowid)
    const devoir = queries.getTravailById(id)
    expect(devoir.scheduled_publish_at).toBeNull()
  })

  it('updates scheduled_publish_at via updateTravail', () => {
    const result = queries.createTravail({
      title: 'Update Schedule Test',
      type: 'livrable',
      channelId: 1,
      promoId: 1,
      deadline: '2026-07-01T00:00:00Z',
      published: false,
    })
    const id = Number(result.lastInsertRowid)
    queries.updateTravail(id, { scheduledPublishAt: '2026-06-15T09:00:00Z' })
    const devoir = queries.getTravailById(id)
    expect(devoir.scheduled_publish_at).toBe('2026-06-15T09:00:00Z')
  })

  it('clears scheduled_publish_at by setting null', () => {
    const result = queries.createTravail({
      title: 'Clear Schedule Test',
      type: 'livrable',
      channelId: 1,
      promoId: 1,
      deadline: '2026-07-01T00:00:00Z',
      published: false,
      scheduledPublishAt: '2026-06-20T10:00:00Z',
    })
    const id = Number(result.lastInsertRowid)
    queries.updateTravail(id, { scheduledPublishAt: null })
    const devoir = queries.getTravailById(id)
    expect(devoir.scheduled_publish_at).toBeNull()
  })
})

describe('getDueScheduledDevoirs', () => {
  it('returns devoirs due for publication', () => {
    // Create a devoir scheduled in the past (should be due)
    queries.createTravail({
      title: 'Due Devoir',
      type: 'livrable',
      channelId: 1,
      promoId: 1,
      deadline: '2026-12-01T00:00:00Z',
      published: false,
      scheduledPublishAt: '2020-01-01T00:00:00Z',
    })
    const due = queries.getDueScheduledDevoirs()
    expect(Array.isArray(due)).toBe(true)
    const found = due.find(d => d.title === 'Due Devoir')
    expect(found).toBeDefined()
    expect(found.published).toBe(0)
  })

  it('does not return already published devoirs', () => {
    queries.createTravail({
      title: 'Already Published',
      type: 'livrable',
      channelId: 1,
      promoId: 1,
      deadline: '2026-12-01T00:00:00Z',
      published: true,
      scheduledPublishAt: '2020-01-01T00:00:00Z',
    })
    const due = queries.getDueScheduledDevoirs()
    const found = due.find(d => d.title === 'Already Published')
    expect(found).toBeUndefined()
  })

  it('does not return devoirs scheduled in the future', () => {
    queries.createTravail({
      title: 'Future Devoir',
      type: 'livrable',
      channelId: 1,
      promoId: 1,
      deadline: '2099-12-01T00:00:00Z',
      published: false,
      scheduledPublishAt: '2099-01-01T00:00:00Z',
    })
    const due = queries.getDueScheduledDevoirs()
    const found = due.find(d => d.title === 'Future Devoir')
    expect(found).toBeUndefined()
  })
})

describe('publishScheduledDevoir', () => {
  it('publishes devoir and clears scheduled_publish_at', () => {
    const result = queries.createTravail({
      title: 'Publish Me',
      type: 'livrable',
      channelId: 1,
      promoId: 1,
      deadline: '2026-12-01T00:00:00Z',
      published: false,
      scheduledPublishAt: '2020-01-01T00:00:00Z',
    })
    const id = Number(result.lastInsertRowid)
    queries.publishScheduledDevoir(id)
    const devoir = queries.getTravailById(id)
    expect(devoir.is_published).toBe(1)
    expect(devoir.scheduled_publish_at).toBeNull()
  })
})
