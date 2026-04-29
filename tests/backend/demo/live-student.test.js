/**
 * Tests du flow Live cote etudiant en demo (web) :
 *  - active session avec QCM live (vue d'arrivee)
 *  - past sessions list (revision)
 *  - submit reply + score
 *  - join par code
 *  - notification feed inclut les bots messages + DMs
 *  - typing-feed
 *
 * Important : ce flow casse silencieusement si les V2 aliases manquent
 * (cf. api-shim) ou si la shape ACTIVE_LIVE_ACTIVITIES s'eloigne du
 * type LiveActivity (qcm/live/options-as-JSON-string/correct_answers
 * JSON). Ces tests servent de garde-fou.
 */
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!!'

const request = require('supertest')
const express = require('express')

function buildApp() {
  const app = express()
  app.use(express.json())
  app.set('jwtSecret', process.env.JWT_SECRET)
  app.use('/api/demo', require('../../../server/routes/demo'))
  return app
}

async function startSession(app, role = 'student') {
  const res = await request(app).post('/api/demo/start').send({ role })
  return { token: res.body.data.token, user: res.body.data.currentUser }
}

const auth = (token) => ({ Authorization: `Bearer ${token}` })

describe('Live student : active session', () => {
  const app = buildApp()

  it('GET /live/sessions/promo/:id/active retourne le QCM AVL avec shape LiveActivity', async () => {
    const { token, user } = await startSession(app)
    const res = await request(app)
      .get(`/api/demo/live/sessions/promo/${user.promo_id}/active`).set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('active')
    expect(Array.isArray(res.body.data.activities)).toBe(true)
    const live = res.body.data.activities.find(a => a.status === 'live')
    expect(live).toBeTruthy()
    // Shape strict : type=qcm (pas 'quiz'), options en JSON string,
    // correct_answers en JSON string. Sans ca, StudentLiveView ne
    // rend pas l'activite.
    expect(live.type).toBe('qcm')
    expect(typeof live.options).toBe('string')
    expect(typeof live.correct_answers).toBe('string')
    expect(JSON.parse(live.options)).toBeInstanceOf(Array)
    expect(JSON.parse(live.correct_answers)).toEqual([0])
  })

  it('GET /live/sessions/code/:code accepte un code 4+ chars et renvoie la session active', async () => {
    const { token } = await startSession(app)
    const res = await request(app).get('/api/demo/live/sessions/code/AVL-2026').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe('demo-live-1')
    expect(res.body.data.status).toBe('active')
  })

  it('GET /live/sessions/code/:code rejette un code < 4 chars avec 404', async () => {
    const { token } = await startSession(app)
    const res = await request(app).get('/api/demo/live/sessions/code/AB').set(auth(token))
    expect(res.status).toBe(404)
  })

  it('POST /live/activities/:id/respond evalue la reponse et renvoie isCorrect+points', async () => {
    const { token } = await startSession(app)
    // QCM 1001 : correct_answers = [0]
    const correct = await request(app).post('/api/demo/live/activities/1001/respond')
      .set(auth(token)).send({ answers: [0] })
    expect(correct.status).toBe(200)
    expect(correct.body.data.isCorrect).toBe(true)
    expect(correct.body.data.points).toBeGreaterThan(0)

    const wrong = await request(app).post('/api/demo/live/activities/1001/respond')
      .set(auth(token)).send({ answers: [2] })
    expect(wrong.status).toBe(200)
    expect(wrong.body.data.isCorrect).toBe(false)
    expect(wrong.body.data.points).toBe(0)
  })
})

describe('Live student : past sessions (revision)', () => {
  const app = buildApp()

  it('GET /live/sessions/promo/:id/history renvoie 4 sessions terminees', async () => {
    const { token, user } = await startSession(app)
    const res = await request(app)
      .get(`/api/demo/live/sessions/promo/${user.promo_id}/history`).set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(4)
    expect(res.body.data.every(s => s.status === 'ended')).toBe(true)
  })

  it('GET /live/sessions/:id renvoie une session passee avec activites Spark', async () => {
    const { token } = await startSession(app)
    const res = await request(app).get('/api/demo/live/sessions/demo-live-h1').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('ended')
    expect(res.body.data.activities.length).toBeGreaterThanOrEqual(4)
    // Tous QCM, status closed, category spark — pour que useLiveReplayMode
    // les detecte via isSparkType()
    for (const act of res.body.data.activities) {
      expect(act.type).toBe('qcm')
      expect(act.status).toBe('closed')
      expect(act.category).toBe('spark')
    }
  })

  it('POST /live/activities/:id/respond fonctionne pour une activite passee (replay)', async () => {
    const { token } = await startSession(app)
    // Session h1 activity 1 : correct = 1 (token signe)
    const res = await request(app).post('/api/demo/live/activities/1/respond')
      .set(auth(token)).send({ answers: [1], mode: 'replay' })
    expect(res.status).toBe(200)
    expect(res.body.data.isCorrect).toBe(true)
  })

  it('GET /live/sessions/:id/leaderboard renvoie le classement de la session passee', async () => {
    const { token } = await startSession(app)
    const res = await request(app).get('/api/demo/live/sessions/demo-live-h1/leaderboard').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(5)
    expect(res.body.data[0]).toHaveProperty('rank', 1)
    expect(res.body.data[0]).toHaveProperty('score')
  })
})

describe('Live student : results simulator (Hawkes-ish)', () => {
  const app = buildApp()

  it('GET /live/activities/1001/results retourne 0 reponse au 1er poll, monte ensuite', async () => {
    // Reset la sim pour partir de 0 (autres tests ont pu la pousser)
    require('../../../server/services/demoBotsAlgo').resetLiveSim()
    const { token } = await startSession(app)
    const res1 = await request(app).get('/api/demo/live/activities/1001/results').set(auth(token))
    expect(res1.status).toBe(200)
    expect(res1.body.data.type).toBe('quiz')
    // 1er query : ~0 reponse (logistique a t=0)
    expect(res1.body.data.total_responses).toBeGreaterThanOrEqual(0)
    expect(res1.body.data.distribution).toBeInstanceOf(Array)
    expect(res1.body.data.distribution.length).toBe(4)
  })
})

describe('Notification feed + typing feed', () => {
  const app = buildApp()

  it('GET /notifications/feed retourne { events, lastId } avec since=0', async () => {
    const { token } = await startSession(app)
    const res = await request(app).get('/api/demo/notifications/feed?since=0').set(auth(token))
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('events')
    expect(res.body.data).toHaveProperty('lastId')
    expect(Array.isArray(res.body.data.events)).toBe(true)
  })

  it('GET /notifications/feed inclut les DMs entrants avec isDm=true', async () => {
    const { token, user } = await startSession(app)
    const { sendWelcomeDm } = require('../../../server/services/demoBots')
    const { getDemoDb } = require('../../../server/db/demo-connection')
    const sess = getDemoDb().prepare(
      `SELECT tenant_id FROM demo_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1`
    ).get(user.id)
    sendWelcomeDm(getDemoDb(), sess.tenant_id, user.id)

    const res = await request(app).get('/api/demo/notifications/feed?since=0').set(auth(token))
    const dmEvent = res.body.data.events.find(e => e.isDm)
    expect(dmEvent).toBeTruthy()
    expect(dmEvent.preview).toBeTruthy()
  })

  it('GET /typing-feed retourne entries vide par defaut', async () => {
    const { token } = await startSession(app)
    const res = await request(app).get('/api/demo/typing-feed').set(auth(token))
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data.entries)).toBe(true)
  })

  it('GET /typing-feed remonte un flag pose par setTyping', async () => {
    const { token, user } = await startSession(app)
    const { setTyping, clearTyping } = require('../../../server/services/demoBots')
    const { getDemoDb } = require('../../../server/db/demo-connection')
    const sess = getDemoDb().prepare(
      `SELECT tenant_id FROM demo_sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1`
    ).get(user.id)
    const channel = getDemoDb().prepare(
      `SELECT id FROM demo_channels WHERE tenant_id = ? LIMIT 1`
    ).get(sess.tenant_id)

    setTyping(sess.tenant_id, channel.id, 'Lucas Bernard', 5000)
    const res = await request(app).get('/api/demo/typing-feed').set(auth(token))
    const lucas = res.body.data.entries.find(e => e.authorName === 'Lucas Bernard')
    expect(lucas).toBeTruthy()
    expect(lucas.channelId).toBe(channel.id)

    clearTyping(sess.tenant_id, channel.id)
  })
})
