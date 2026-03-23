/**
 * Tests unitaires pour le modèle live (sessions interactives en direct).
 */
const { setupTestDb, teardownTestDb } = require('../helpers/setup')

let queries

beforeAll(() => {
  setupTestDb()
  queries = require('../../../server/db/models/live')
})
afterAll(() => teardownTestDb())

describe('createSession', () => {
  it('creates a session with a join code', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Quiz Test' })
    expect(session).toBeDefined()
    expect(session.id).toBeDefined()
    expect(session.join_code).toBeDefined()
    expect(session.join_code).toHaveLength(6)
    expect(session.title).toBe('Quiz Test')
    expect(session.teacher_id).toBe(1)
    expect(session.promo_id).toBe(1)
    expect(session.status).toBe('waiting')
  })
})

describe('getSession', () => {
  it('returns session with activities array', () => {
    const created = queries.createSession({ teacherId: 1, promoId: 1, title: 'Session With Activities' })
    const session = queries.getSession(created.id)
    expect(session).toBeDefined()
    expect(session.title).toBe('Session With Activities')
    expect(Array.isArray(session.activities)).toBe(true)
    expect(session.activities).toHaveLength(0)
  })

  it('returns null for non-existent session', () => {
    expect(queries.getSession(99999)).toBeNull()
  })
})

describe('getSessionByCode', () => {
  it('finds session by join code', () => {
    const created = queries.createSession({ teacherId: 1, promoId: 1, title: 'Code Lookup' })
    const found = queries.getSessionByCode(created.join_code)
    expect(found).toBeDefined()
    expect(found.id).toBe(created.id)
    expect(found.title).toBe('Code Lookup')
  })

  it('returns null for non-existent code', () => {
    expect(queries.getSessionByCode('ZZZZZZ')).toBeNull()
  })
})

describe('getActiveSessionForPromo', () => {
  it('returns only active (not waiting) session for a promo', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Active Session' })
    // waiting sessions must NOT be visible to students (draft mode)
    expect(queries.getActiveSessionForPromo(1)).toBeNull()
    queries.updateSessionStatus(session.id, 'active')
    const active = queries.getActiveSessionForPromo(1)
    expect(active).not.toBeNull()
    expect(active.status).toBe('active')
  })

  it('returns null for promo with no active sessions', () => {
    expect(queries.getActiveSessionForPromo(9999)).toBeNull()
  })
})

describe('updateSessionStatus', () => {
  it('transitions waiting → active', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Status Test' })
    expect(session.status).toBe('waiting')
    const updated = queries.updateSessionStatus(session.id, 'active')
    expect(updated.status).toBe('active')
  })

  it('transitions active → ended and sets ended_at', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'End Test' })
    queries.updateSessionStatus(session.id, 'active')
    const ended = queries.updateSessionStatus(session.id, 'ended')
    expect(ended.status).toBe('ended')
    expect(ended.ended_at).toBeDefined()
  })
})

describe('addActivity', () => {
  it('adds an activity to a session', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Activity Session' })
    const activity = queries.addActivity({
      sessionId: session.id,
      type: 'qcm',
      title: 'Question 1',
      options: JSON.stringify(['A', 'B', 'C']),
      position: 0,
    })
    expect(activity).toBeDefined()
    expect(activity.session_id).toBe(session.id)
    expect(activity.type).toBe('qcm')
    expect(activity.title).toBe('Question 1')
    expect(activity.status).toBe('pending')
  })

  it('activity appears in getSession activities', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Activity List' })
    queries.addActivity({ sessionId: session.id, type: 'sondage', title: 'Poll 1', position: 0 })
    queries.addActivity({ sessionId: session.id, type: 'nuage', title: 'Cloud 1', position: 1 })
    const full = queries.getSession(session.id)
    expect(full.activities).toHaveLength(2)
    expect(full.activities[0].title).toBe('Poll 1')
    expect(full.activities[1].title).toBe('Cloud 1')
  })
})

describe('setActivityStatus', () => {
  it('transitions pending → live and sets started_at', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Status Activity' })
    const activity = queries.addActivity({ sessionId: session.id, type: 'qcm', title: 'Q', position: 0 })
    const live = queries.setActivityStatus(activity.id, 'live')
    expect(live.status).toBe('live')
    expect(live.started_at).toBeDefined()
  })

  it('transitions live → closed and sets closed_at', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Close Activity' })
    const activity = queries.addActivity({ sessionId: session.id, type: 'qcm', title: 'Q', position: 0 })
    queries.setActivityStatus(activity.id, 'live')
    const closed = queries.setActivityStatus(activity.id, 'closed')
    expect(closed.status).toBe('closed')
    expect(closed.closed_at).toBeDefined()
  })
})

describe('submitResponse', () => {
  it('stores a response', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Response Session' })
    const activity = queries.addActivity({ sessionId: session.id, type: 'qcm', title: 'Q', position: 0 })
    const response = queries.submitResponse({ activityId: activity.id, studentId: 1, answer: 'A' })
    expect(response).toBeDefined()
    expect(response.activity_id).toBe(activity.id)
    expect(response.student_id).toBe(1)
    expect(response.answer).toBe('A')
  })

  it('handles duplicate (REPLACE) - updates answer', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Dup Response' })
    const activity = queries.addActivity({ sessionId: session.id, type: 'qcm', title: 'Q', position: 0 })
    queries.submitResponse({ activityId: activity.id, studentId: 1, answer: 'A' })
    const updated = queries.submitResponse({ activityId: activity.id, studentId: 1, answer: 'B' })
    expect(updated.answer).toBe('B')
  })
})

describe('getActivityResultsAggregated', () => {
  it('returns correct counts for QCM', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'QCM Results' })
    const activity = queries.addActivity({
      sessionId: session.id, type: 'qcm', title: 'Q',
      options: JSON.stringify(['A', 'B', 'C']), position: 0,
    })
    queries.submitResponse({ activityId: activity.id, studentId: 1, answer: 'A' })
    const results = queries.getActivityResultsAggregated(activity.id)
    expect(results.type).toBe('qcm')
    expect(results.total).toBe(1)
    expect(results.counts['A']).toBe(1)
  })

  it('returns correct counts for sondage', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Sondage Results' })
    const activity = queries.addActivity({ sessionId: session.id, type: 'sondage', title: 'Poll', position: 0 })
    queries.submitResponse({ activityId: activity.id, studentId: 1, answer: 'Oui' })
    const results = queries.getActivityResultsAggregated(activity.id)
    expect(results.type).toBe('sondage')
    expect(results.total).toBe(1)
    expect(results.counts['Oui']).toBe(1)
  })

  it('returns correct freq for nuage de mots', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Nuage Results' })
    const activity = queries.addActivity({ sessionId: session.id, type: 'nuage', title: 'Words', position: 0 })
    queries.submitResponse({ activityId: activity.id, studentId: 1, answer: 'hello,world,hello' })
    const results = queries.getActivityResultsAggregated(activity.id)
    expect(results.type).toBe('nuage')
    expect(results.total).toBe(1)
    expect(results.freq['hello']).toBe(2)
    expect(results.freq['world']).toBe(1)
  })

  it('returns null for non-existent activity', () => {
    expect(queries.getActivityResultsAggregated(99999)).toBeNull()
  })
})

describe('deleteSession', () => {
  it('deletes session and cascades activities and responses', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Delete Me' })
    const activity = queries.addActivity({ sessionId: session.id, type: 'qcm', title: 'Q', position: 0 })
    queries.submitResponse({ activityId: activity.id, studentId: 1, answer: 'A' })
    queries.deleteSession(session.id)
    expect(queries.getSession(session.id)).toBeNull()
    // Activities should be cascaded
    const results = queries.getActivityResultsAggregated(activity.id)
    expect(results).toBeNull()
  })
})
