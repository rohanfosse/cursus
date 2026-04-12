/**
 * Tests unitaires pour le modèle live (sessions interactives en direct).
 */
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

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

describe('getSessionsForPromo', () => {
  it('returns non-ended sessions for a promo', () => {
    const s1 = queries.createSession({ teacherId: 1, promoId: 1, title: 'List Session 1' })
    queries.updateSessionStatus(s1.id, 'active')
    const sessions = queries.getSessionsForPromo(1)
    expect(Array.isArray(sessions)).toBe(true)
    expect(sessions.length).toBeGreaterThan(0)
  })

  it('returns empty for promo with no sessions', () => {
    const sessions = queries.getSessionsForPromo(9999)
    expect(sessions).toEqual([])
  })
})

describe('updateActivity', () => {
  it('updates activity title and type', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Update Activity' })
    const activity = queries.addActivity({ sessionId: session.id, type: 'qcm', title: 'Old Title', position: 0 })
    const updated = queries.updateActivity(activity.id, { title: 'New Title', type: 'sondage' })
    expect(updated.title).toBe('New Title')
    expect(updated.type).toBe('sondage')
  })

  it('updates timer_seconds', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Timer Update' })
    const activity = queries.addActivity({ sessionId: session.id, type: 'qcm', title: 'Q', position: 0, timerSeconds: 30 })
    const updated = queries.updateActivity(activity.id, { timer_seconds: 60 })
    expect(updated.timer_seconds).toBe(60)
  })

  it('updates correct_answers', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Correct Answers' })
    const activity = queries.addActivity({ sessionId: session.id, type: 'qcm', title: 'Q', position: 0 })
    const updated = queries.updateActivity(activity.id, { correct_answers: '[0,2]' })
    expect(updated.correct_answers).toBe('[0,2]')
  })

  it('returns unchanged activity when no fields provided', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'No Update' })
    const activity = queries.addActivity({ sessionId: session.id, type: 'qcm', title: 'Unchanged', position: 0 })
    const same = queries.updateActivity(activity.id, {})
    expect(same.title).toBe('Unchanged')
  })
})

describe('deleteActivity', () => {
  it('deletes an activity', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Del Activity' })
    const activity = queries.addActivity({ sessionId: session.id, type: 'qcm', title: 'Del', position: 0 })
    const result = queries.deleteActivity(activity.id)
    expect(result.changes).toBe(1)
    expect(queries.getActivityResultsAggregated(activity.id)).toBeNull()
  })
})

describe('reorderActivities', () => {
  it('reorders activities by position', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Reorder' })
    const a1 = queries.addActivity({ sessionId: session.id, type: 'qcm', title: 'First', position: 0 })
    const a2 = queries.addActivity({ sessionId: session.id, type: 'sondage', title: 'Second', position: 1 })
    // Reverse the order
    queries.reorderActivities(session.id, [a2.id, a1.id])
    const full = queries.getSession(session.id)
    expect(full.activities[0].id).toBe(a2.id)
    expect(full.activities[0].position).toBe(0)
    expect(full.activities[1].id).toBe(a1.id)
    expect(full.activities[1].position).toBe(1)
  })
})

describe('cloneSession', () => {
  it('clones a session with all activities', () => {
    const source = queries.createSession({ teacherId: 1, promoId: 1, title: 'Source Session' })
    queries.addActivity({ sessionId: source.id, type: 'qcm', title: 'Q1', options: '["A","B"]', position: 0 })
    queries.addActivity({ sessionId: source.id, type: 'sondage', title: 'S1', position: 1 })

    const cloned = queries.cloneSession(source.id, { teacherId: 1, promoId: 1, title: 'Cloned Session' })
    expect(cloned).not.toBeNull()
    expect(cloned.title).toBe('Cloned Session')
    expect(cloned.id).not.toBe(source.id)
    expect(cloned.activities).toHaveLength(2)
    expect(cloned.activities[0].title).toBe('Q1')
    expect(cloned.activities[1].title).toBe('S1')
  })

  it('returns null for non-existent source', () => {
    const cloned = queries.cloneSession(99999, { teacherId: 1, promoId: 1 })
    expect(cloned).toBeNull()
  })

  it('uses source title when no title provided', () => {
    const source = queries.createSession({ teacherId: 1, promoId: 1, title: 'Keep Title' })
    const cloned = queries.cloneSession(source.id, { teacherId: 1, promoId: 1 })
    expect(cloned.title).toBe('Keep Title')
  })
})

describe('getActivityResults', () => {
  it('returns raw responses for an activity', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Raw Results' })
    const activity = queries.addActivity({ sessionId: session.id, type: 'qcm', title: 'Q', position: 0 })
    queries.submitResponse({ activityId: activity.id, studentId: 1, answer: 'B' })
    const results = queries.getActivityResults(activity.id)
    expect(Array.isArray(results)).toBe(true)
    expect(results.length).toBe(1)
    expect(results[0].answer).toBe('B')
  })
})

describe('hasStudentResponded', () => {
  it('returns true when student has responded', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Has Responded' })
    const activity = queries.addActivity({ sessionId: session.id, type: 'qcm', title: 'Q', position: 0 })
    queries.submitResponse({ activityId: activity.id, studentId: 1, answer: 'C' })
    expect(queries.hasStudentResponded(activity.id, 1)).toBe(true)
  })

  it('returns false when student has not responded', () => {
    const session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Not Responded' })
    const activity = queries.addActivity({ sessionId: session.id, type: 'qcm', title: 'Q', position: 0 })
    expect(queries.hasStudentResponded(activity.id, 1)).toBe(false)
  })
})

describe('scoring', () => {
  let session, activity

  beforeAll(() => {
    session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Scoring Session' })
    activity = queries.addActivity({
      sessionId: session.id, type: 'qcm', title: 'Score Q',
      options: '["A","B","C"]', position: 0, timerSeconds: 30,
      correctAnswers: '[0]',
    })
  })

  it('checkCorrectness returns true for correct answer', () => {
    expect(queries.checkCorrectness(activity.id, '0')).toBe(true)
  })

  it('checkCorrectness returns false for wrong answer', () => {
    expect(queries.checkCorrectness(activity.id, '1')).toBe(false)
  })

  it('checkCorrectness returns null for non-existent activity', () => {
    expect(queries.checkCorrectness(99999, '0')).toBeNull()
  })

  it('checkCorrectness returns null for activity without correct_answers', () => {
    const s = queries.createSession({ teacherId: 1, promoId: 1, title: 'No Correct' })
    const a = queries.addActivity({ sessionId: s.id, type: 'qcm', title: 'Q', position: 0 })
    expect(queries.checkCorrectness(a.id, '0')).toBeNull()
  })

  it('calculateScore returns points for correct answer', () => {
    const result = queries.calculateScore(activity.id, 1, 'Jean Dupont', 5000, true)
    expect(result.points).toBeGreaterThan(0)
    expect(result.points).toBeLessThanOrEqual(1000)
    expect(result.streak).toBeGreaterThanOrEqual(1)
  })

  it('calculateScore returns 0 for incorrect answer', () => {
    const result = queries.calculateScore(activity.id, 1, 'Jean Dupont', 5000, false)
    expect(result.points).toBe(0)
    expect(result.streak).toBe(0)
  })

  it('calculateScore returns 0 for non-existent activity', () => {
    const result = queries.calculateScore(99999, 1, 'Test', 5000, true)
    expect(result.points).toBe(0)
  })
})

describe('leaderboard', () => {
  let session

  beforeAll(() => {
    const db = getTestDb()
    db.prepare("INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password) VALUES (2, 1, 'Alice', 'alice@test.fr', 'AL', 'hash', 0)").run()

    session = queries.createSession({ teacherId: 1, promoId: 1, title: 'Leaderboard Session' })
    const a1 = queries.addActivity({
      sessionId: session.id, type: 'qcm', title: 'LB Q1', position: 0,
      timerSeconds: 30, correctAnswers: '[0]',
    })
    queries.calculateScore(a1.id, 1, 'Jean Dupont', 3000, true)
    queries.calculateScore(a1.id, 2, 'Alice', 5000, true)
  })

  it('getLeaderboard returns ranked students', () => {
    const board = queries.getLeaderboard(session.id)
    expect(Array.isArray(board)).toBe(true)
    expect(board.length).toBe(2)
    expect(board[0].rank).toBe(1)
    expect(board[0].points).toBeGreaterThanOrEqual(board[1].points)
  })

  it('getLeaderboardWithRound includes per-round points', () => {
    const activities = queries.getSession(session.id).activities
    const board = queries.getLeaderboardWithRound(session.id, activities[0].id)
    expect(board.length).toBe(2)
    expect(board[0]).toHaveProperty('pointsThisRound')
  })

  it('getActivityScores returns scores for an activity', () => {
    const activities = queries.getSession(session.id).activities
    const scores = queries.getActivityScores(activities[0].id)
    expect(Array.isArray(scores)).toBe(true)
    expect(scores.length).toBe(2)
    expect(scores[0]).toHaveProperty('points')
  })

  it('getStudentRank returns correct rank', () => {
    const rank = queries.getStudentRank(session.id, 1)
    expect(typeof rank).toBe('number')
    expect(rank).toBeGreaterThanOrEqual(1)
  })

  it('getStudentRank returns length+1 for non-participant', () => {
    const rank = queries.getStudentRank(session.id, 9999)
    const board = queries.getLeaderboard(session.id)
    expect(rank).toBe(board.length + 1)
  })
})

describe('getEndedSessionsForPromo', () => {
  beforeAll(() => {
    const s = queries.createSession({ teacherId: 1, promoId: 1, title: 'Ended Session For History' })
    queries.addActivity({ sessionId: s.id, type: 'qcm', title: 'Q', position: 0 })
    queries.updateSessionStatus(s.id, 'active')
    queries.updateSessionStatus(s.id, 'ended')
  })

  it('returns ended sessions with counts', () => {
    const sessions = queries.getEndedSessionsForPromo(1)
    expect(Array.isArray(sessions)).toBe(true)
    expect(sessions.length).toBeGreaterThan(0)
    expect(sessions[0]).toHaveProperty('activity_count')
    expect(sessions[0]).toHaveProperty('participant_count')
    expect(sessions[0].status).toBe('ended')
  })

  it('returns empty for promo with no ended sessions', () => {
    const sessions = queries.getEndedSessionsForPromo(9999)
    expect(sessions).toEqual([])
  })

  it('filters by search', () => {
    const sessions = queries.getEndedSessionsForPromo(1, { search: 'History' })
    expect(sessions.length).toBeGreaterThan(0)
  })

  it('filters by date range', () => {
    const sessions = queries.getEndedSessionsForPromo(1, { dateFrom: '2000-01-01', dateTo: '2099-12-31' })
    expect(sessions.length).toBeGreaterThan(0)
  })
})

describe('getLiveStatsForPromo', () => {
  it('returns stats object with all fields', () => {
    const stats = queries.getLiveStatsForPromo(1)
    expect(stats).toHaveProperty('totalSessions')
    expect(stats).toHaveProperty('avgParticipationRate')
    expect(stats).toHaveProperty('enrolledStudents')
    expect(stats).toHaveProperty('activityTypeDistribution')
    expect(stats).toHaveProperty('participationTrend')
    expect(typeof stats.totalSessions).toBe('number')
    expect(typeof stats.avgParticipationRate).toBe('number')
  })

  it('returns zero stats for promo with no sessions', () => {
    const stats = queries.getLiveStatsForPromo(9999)
    expect(stats.totalSessions).toBe(0)
    expect(stats.avgParticipationRate).toBe(0)
  })
})
