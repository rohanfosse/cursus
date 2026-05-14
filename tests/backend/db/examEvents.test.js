/**
 * Tests unitaires pour le model examEvents (mode examen surveille).
 */
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

let queries

beforeAll(() => {
  setupTestDb()
  queries = require('../../../server/db/models/examEvents')

  const db = getTestDb()
  // Seed : deux travaux dont un exam_mode, deux students
  db.exec(`
    INSERT OR IGNORE INTO travaux (id, promo_id, channel_id, title, deadline, type, published, requires_submission, exam_mode)
    VALUES
      (300, 1, 1, 'Examen Python',   '2099-12-31T23:59:00Z', 'cctl',     1, 1, 1),
      (301, 1, 1, 'Devoir classique','2099-12-31T23:59:00Z', 'livrable', 1, 1, 0);
    INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
    VALUES
      (30, 1, 'Alice Test', 'alice@t.fr', 'AT', 'h', 0),
      (31, 1, 'Bob Test',   'bob@t.fr',   'BT', 'h', 0);
  `)
})

afterAll(() => teardownTestDb())

describe('addExamEvent', () => {
  it('inserts a focus_loss event with payload', () => {
    const r = queries.addExamEvent({
      travailId: 300, studentId: 30, type: 'focus_loss',
      ts: 1_700_000_000_000, payload: { durationMs: 3200 },
    })
    expect(r.changes).toBe(1)
    const events = queries.getExamEvents(300, 30)
    expect(events.length).toBeGreaterThan(0)
    const ev = events.find(e => e.type === 'focus_loss')
    expect(ev).toBeDefined()
    expect(ev.payload).toEqual({ durationMs: 3200 })
  })

  it('accepts all 7 declared event types', () => {
    const types = ['exam_start','exam_submit','exam_timeout','paste_blocked','heartbeat','crash_recovered']
    for (const type of types) {
      const r = queries.addExamEvent({ travailId: 300, studentId: 31, type, ts: Date.now(), payload: null })
      expect(r.changes).toBe(1)
    }
  })

  it('rejects an unknown type with a clear error', () => {
    expect(() => queries.addExamEvent({
      travailId: 300, studentId: 30, type: 'screenshot', ts: Date.now(),
    })).toThrow(/invalide/i)
  })

  it('defaults ts to Date.now() if absent', () => {
    const before = Date.now()
    queries.addExamEvent({ travailId: 300, studentId: 30, type: 'heartbeat' })
    const after = Date.now()
    const events = queries.getExamEvents(300, 30)
    const last = events[events.length - 1]
    expect(last.ts).toBeGreaterThanOrEqual(before)
    expect(last.ts).toBeLessThanOrEqual(after + 5)
  })

  it('stores null payload when none provided', () => {
    queries.addExamEvent({ travailId: 300, studentId: 31, type: 'heartbeat', ts: 1, payload: undefined })
    const events = queries.getExamEvents(300, 31).filter(e => e.ts === 1)
    expect(events.length).toBe(1)
    expect(events[0].payload).toBeNull()
  })
})

describe('getExamEventSummary', () => {
  it('aggregates counts + jalons par etudiant', () => {
    // Reset events pour ce test sur une nouvelle paire (travail, students)
    const db = getTestDb()
    db.exec('DELETE FROM exam_events WHERE travail_id = 300')
    db.exec(`
      INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
      VALUES (40, 1, 'Carol Test', 'carol@t.fr', 'CT', 'h', 0)
    `)

    queries.addExamEvent({ travailId: 300, studentId: 30, type: 'exam_start',  ts: 1000 })
    queries.addExamEvent({ travailId: 300, studentId: 30, type: 'focus_loss',  ts: 2000, payload: { durationMs: 2000 } })
    queries.addExamEvent({ travailId: 300, studentId: 30, type: 'focus_loss',  ts: 3000, payload: { durationMs: 1500 } })
    queries.addExamEvent({ travailId: 300, studentId: 30, type: 'paste_blocked', ts: 4000 })
    queries.addExamEvent({ travailId: 300, studentId: 30, type: 'exam_submit', ts: 5000 })

    queries.addExamEvent({ travailId: 300, studentId: 40, type: 'exam_start', ts: 1500 })
    queries.addExamEvent({ travailId: 300, studentId: 40, type: 'exam_timeout', ts: 9000 })

    const summary = queries.getExamEventSummary(300)
    const alice = summary.find(s => s.student_id === 30)
    const carol = summary.find(s => s.student_id === 40)

    expect(alice.focus_loss_count).toBe(2)
    expect(alice.paste_blocked_count).toBe(1)
    expect(alice.started_at).toBe(1000)
    expect(alice.submitted_at).toBe(5000)
    expect(alice.timed_out_at).toBeNull()

    expect(carol.focus_loss_count).toBe(0)
    expect(carol.timed_out_at).toBe(9000)
    expect(carol.submitted_at).toBeNull()
  })
})

describe('getExamEvents', () => {
  it('returns all events for a travail without studentId filter', () => {
    const all = queries.getExamEvents(300, null)
    const studentIds = new Set(all.map(e => e.student_id))
    expect(studentIds.size).toBeGreaterThan(1)
  })

  it('filters by studentId when provided', () => {
    const events = queries.getExamEvents(300, 30)
    expect(events.every(e => e.student_id === 30)).toBe(true)
  })

  it('returns events sorted by ts ascending', () => {
    const events = queries.getExamEvents(300, 30)
    for (let i = 1; i < events.length; i++) {
      expect(events[i].ts).toBeGreaterThanOrEqual(events[i - 1].ts)
    }
  })
})
