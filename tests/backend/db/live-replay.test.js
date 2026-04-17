/**
 * Tests du mode replay (live_responses_v2 + live_scores avec colonne mode).
 * v66 : un etudiant peut soumettre une reponse live ET une reponse replay pour la meme
 * activite, les deux sont persistees separement (UNIQUE(activity_id, student_id, mode)).
 */
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

let queries

beforeAll(() => {
  setupTestDb()
  queries = require('../../../server/db/models/live-unified')
})
afterAll(() => teardownTestDb())

describe('live replay mode', () => {
  let session
  let activity

  beforeAll(() => {
    const db = getTestDb()
    db.prepare("INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password) VALUES (42, 1, 'Replay Student', 'rs@test.fr', 'RS', 'hash', 0)").run()

    session = queries.createLiveSession({ teacherId: 1, promoId: 1, title: 'Replay Session' })
    // Hack tests-only : live_scores.session_id a une FK vers live_sessions (v1) qu'on doit satisfaire
    // car v2 partage la table live_scores. En prod, la v1 existe via migrations anciennes.
    db.prepare('INSERT OR IGNORE INTO live_sessions (id, teacher_id, promo_id, title, join_code) VALUES (?, 1, 1, ?, ?)')
      .run(session.id, 'FK stub', 'FK' + session.id)
    activity = queries.addLiveActivity({
      sessionId: session.id, type: 'qcm', title: 'Spark Q1', position: 0,
      timerSeconds: 30, correctAnswers: '[0]', options: JSON.stringify(['Juste', 'Faux']),
    })
    // Idem pour live_activities (FK activity_id)
    db.prepare('INSERT OR IGNORE INTO live_activities (id, session_id, type, title, position) VALUES (?, ?, ?, ?, ?)')
      .run(activity.id, session.id, 'qcm', 'Spark Q1', 0)
    queries.setLiveActivityStatus(activity.id, 'live')
  })

  it('accepts live and replay responses for the same student+activity', () => {
    const rLive = queries.submitLiveResponse({ activityId: activity.id, studentId: 42, answer: '0', mode: 'live' })
    expect(rLive.mode).toBe('live')

    const rReplay = queries.submitLiveResponse({ activityId: activity.id, studentId: 42, answer: '1', mode: 'replay' })
    expect(rReplay.mode).toBe('replay')
    expect(rReplay.answer).toBe('1')

    // Les deux coexistent en base
    const db = getTestDb()
    const rows = db.prepare('SELECT mode, answer FROM live_responses_v2 WHERE activity_id = ? AND student_id = ? ORDER BY mode').all(activity.id, 42)
    expect(rows).toHaveLength(2)
    expect(rows[0].mode).toBe('live')
    expect(rows[1].mode).toBe('replay')
    expect(rows[0].answer).toBe('0')
    expect(rows[1].answer).toBe('1')
  })

  it('scores replay attempts separately from live (distinct live_scores rows)', () => {
    const live = queries.calculateLiveScore(activity.id, 42, 'Replay Student', 3000, true, 'live')
    const replay = queries.calculateLiveScore(activity.id, 42, 'Replay Student', 3000, true, 'replay')
    expect(live.points).toBeGreaterThan(0)
    expect(replay.points).toBeGreaterThan(0)

    const db = getTestDb()
    const rows = db.prepare('SELECT mode, points FROM live_scores WHERE activity_id = ? AND student_id = ? ORDER BY mode').all(activity.id, 42)
    expect(rows).toHaveLength(2)
    expect(rows[0].mode).toBe('live')
    expect(rows[1].mode).toBe('replay')
  })

  it('leaderboard filters by mode', () => {
    const boardLive = queries.getLiveLeaderboard(session.id, 'live')
    const boardReplay = queries.getLiveLeaderboard(session.id, 'replay')
    expect(boardLive.find(e => e.studentId === 42)).toBeDefined()
    expect(boardReplay.find(e => e.studentId === 42)).toBeDefined()
    // Les deux ont des points car on a score en live ET en replay
    expect(boardLive.find(e => e.studentId === 42).points).toBeGreaterThan(0)
    expect(boardReplay.find(e => e.studentId === 42).points).toBeGreaterThan(0)
  })

  it('hasStudentRespondedLive respects mode', () => {
    expect(queries.hasStudentRespondedLive(activity.id, 42, 'live')).toBe(true)
    expect(queries.hasStudentRespondedLive(activity.id, 42, 'replay')).toBe(true)
    // Student inconnu n'a pas repondu
    expect(queries.hasStudentRespondedLive(activity.id, 999, 'live')).toBe(false)
  })

  it('aggregated results filter by mode', () => {
    const liveAgg = queries.getLiveActivityResultsAggregated(activity.id, 'live')
    const replayAgg = queries.getLiveActivityResultsAggregated(activity.id, 'replay')
    expect(liveAgg.total).toBeGreaterThan(0)
    expect(replayAgg.total).toBeGreaterThan(0)
    // Les reponses attendues sont differentes : live='0', replay='1'
    expect(liveAgg.counts['0']).toBeGreaterThan(0)
    expect(replayAgg.counts['1']).toBeGreaterThan(0)
  })
})
