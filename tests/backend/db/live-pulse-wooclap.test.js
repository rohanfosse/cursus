/**
 * Tests Pulse Wooclap — v2.153.0
 * - message_wall : type board reconnu, aggregation
 * - texte_a_trous : correctness check, aggregation
 * - confusion signals : insert/upsert, count
 * - self_paced : session toggle
 */
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

let queries

beforeAll(() => {
  setupTestDb()
  queries = require('../../../server/db/models/live-unified')
})
afterAll(() => teardownTestDb())

describe('message_wall activity type', () => {
  it('getActivityCategory returns board for message_wall', () => {
    expect(queries.getActivityCategory('message_wall')).toBe('board')
  })

  it('creates a message_wall activity and aggregates results', () => {
    const session = queries.createLiveSession({ teacherId: 1, promoId: 1, title: 'Wall Session' })
    const activity = queries.addLiveActivity({
      sessionId: session.id, type: 'message_wall', title: 'Vos questions', position: 0,
    })
    expect(activity.category).toBe('board')
    expect(activity.type).toBe('message_wall')

    // Add some cards (messages)
    queries.addBoardCard({ activityId: activity.id, columnName: 'messages', content: 'Hello', authorId: 1, authorName: 'Alice', color: '#fff' })
    queries.addBoardCard({ activityId: activity.id, columnName: 'messages', content: 'World', authorId: 2, authorName: 'Bob', color: '#fff' })

    const results = queries.getLiveActivityResultsAggregated(activity.id)
    expect(results.type).toBe('message_wall')
    expect(results.total).toBe(2)
    expect(results.cards).toHaveLength(2)
  })
})

describe('texte_a_trous correctness', () => {
  let session, activity

  beforeAll(() => {
    session = queries.createLiveSession({ teacherId: 1, promoId: 1, title: 'TAT Session' })
    activity = queries.addLiveActivity({
      sessionId: session.id, type: 'texte_a_trous',
      title: 'La {{capitale}} de la France est {{Paris}}',
      position: 0, timerSeconds: 30,
      correctAnswers: JSON.stringify(['capitale', 'Paris']),
    })
    expect(activity.category).toBe('spark')
  })

  it('marks correct when all blanks match', () => {
    const ok = queries.checkLiveCorrectness(activity.id, 'capitale,Paris')
    expect(ok).toBe(true)
  })

  it('marks correct with typo tolerance', () => {
    const ok = queries.checkLiveCorrectness(activity.id, 'capitael,paris')
    expect(ok).toBe(true) // levenshtein tolerance
  })

  it('marks incorrect when a blank is wrong', () => {
    const ok = queries.checkLiveCorrectness(activity.id, 'capitale,Lyon')
    expect(ok).toBe(false)
  })

  it('marks incorrect when blanks count mismatches', () => {
    const ok = queries.checkLiveCorrectness(activity.id, 'capitale')
    expect(ok).toBe(false)
  })

  it('aggregates texte_a_trous results', () => {
    queries.setLiveActivityStatus(activity.id, 'live')
    queries.submitLiveResponse({ activityId: activity.id, studentId: 1, answer: 'capitale,Paris' })
    queries.submitLiveResponse({ activityId: activity.id, studentId: 2, answer: 'capitale,Lyon' })

    const results = queries.getLiveActivityResultsAggregated(activity.id)
    expect(results.type).toBe('texte_a_trous')
    expect(results.total).toBe(2)
    expect(results.correctCount).toBe(1)
    expect(results.blanksCount).toBe(2)
  })
})

describe('confusion signals', () => {
  it('inserts and counts confusion signals', () => {
    const db = getTestDb()
    const session = queries.createLiveSession({ teacherId: 1, promoId: 1, title: 'Confusion Session' })

    db.prepare('INSERT INTO live_confusion_signals (session_id, student_id, active) VALUES (?, ?, 1)').run(session.id, 1)
    db.prepare('INSERT INTO live_confusion_signals (session_id, student_id, active) VALUES (?, ?, 1)').run(session.id, 2)

    const { count } = db.prepare('SELECT COUNT(*) as count FROM live_confusion_signals WHERE session_id = ? AND active = 1').get(session.id)
    expect(count).toBe(2)

    // Deactivate one
    db.prepare('UPDATE live_confusion_signals SET active = 0 WHERE session_id = ? AND student_id = ?').run(session.id, 1)
    const { count: c2 } = db.prepare('SELECT COUNT(*) as count FROM live_confusion_signals WHERE session_id = ? AND active = 1').get(session.id)
    expect(c2).toBe(1)
  })
})

describe('self-paced mode', () => {
  it('session has self_paced column defaulting to 0', () => {
    const session = queries.createLiveSession({ teacherId: 1, promoId: 1, title: 'Self-paced Session' })
    expect(session.self_paced).toBe(0)
  })

  it('can toggle self_paced', () => {
    const db = getTestDb()
    const session = queries.createLiveSession({ teacherId: 1, promoId: 1, title: 'SP Toggle' })
    db.prepare('UPDATE live_sessions_v2 SET self_paced = 1 WHERE id = ?').run(session.id)
    const updated = queries.getLiveSession(session.id)
    expect(updated.self_paced).toBe(1)
  })
})

describe('tri (sorting) correctness', () => {
  let session, activity

  beforeAll(() => {
    session = queries.createLiveSession({ teacherId: 1, promoId: 1, title: 'Tri Session' })
    activity = queries.addLiveActivity({
      sessionId: session.id, type: 'tri',
      title: 'Remettre dans l\'ordre',
      position: 0, timerSeconds: 30,
      options: JSON.stringify(['Premier', 'Deuxieme', 'Troisieme']),
      correctAnswers: JSON.stringify([0, 1, 2]),
    })
  })

  it('recognizes tri as spark category', () => {
    expect(activity.category).toBe('spark')
  })

  it('marks correct when order matches', () => {
    expect(queries.checkLiveCorrectness(activity.id, '0,1,2')).toBe(true)
  })

  it('marks incorrect when order differs', () => {
    expect(queries.checkLiveCorrectness(activity.id, '2,1,0')).toBe(false)
  })

  it('marks incorrect when count differs', () => {
    expect(queries.checkLiveCorrectness(activity.id, '0,1')).toBe(false)
  })

  it('aggregates tri results', () => {
    queries.setLiveActivityStatus(activity.id, 'live')
    queries.submitLiveResponse({ activityId: activity.id, studentId: 1, answer: '0,1,2' })
    queries.submitLiveResponse({ activityId: activity.id, studentId: 2, answer: '2,0,1' })

    const results = queries.getLiveActivityResultsAggregated(activity.id)
    expect(results.type).toBe('tri')
    expect(results.total).toBe(2)
    expect(results.correctCount).toBe(1)
  })
})
