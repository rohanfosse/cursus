/**
 * Tests des routes generiques /api/games/:gameId/* (Snake, Space Invaders, ...).
 * TypeRace teste separement dans typerace-routes.test.js (schema riche).
 */
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app
let studentToken
let teacherToken
let otherStudentToken

beforeAll(() => {
  setupTestDb()
  studentToken = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  teacherToken = jwt.sign({ id: 1, name: 'Prof Test',    type: 'teacher' },              JWT_SECRET)

  const db = getTestDb()
  db.prepare(`INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
              VALUES (2, 1, 'Alice Martin', 'alice@test.fr', 'AM', 'x', 0)`).run()
  otherStudentToken = jwt.sign({ id: 2, name: 'Alice Martin', type: 'student', promo_id: 1 }, JWT_SECRET)

  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/games', auth, require('../../../server/routes/games'))
})

afterAll(() => teardownTestDb())

beforeEach(() => {
  getTestDb().prepare('DELETE FROM game_scores').run()
})

describe('POST /api/games/:gameId/scores', () => {
  it('enregistre un score Snake valide', async () => {
    const res = await request(app)
      .post('/api/games/snake/scores')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ score: 120, durationMs: 45_000 })
    expect(res.status).toBe(200)
    expect(res.body.data.score).toBe(120)
  })

  it('enregistre un score Space Invaders avec meta JSON', async () => {
    const res = await request(app)
      .post('/api/games/space_invaders/scores')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ score: 2500, durationMs: 60_000, meta: { wave: 3, aliensKilled: 42 } })
    expect(res.status).toBe(200)
    const row = getTestDb().prepare('SELECT meta FROM game_scores ORDER BY id DESC LIMIT 1').get()
    expect(JSON.parse(row.meta)).toEqual({ wave: 3, aliensKilled: 42 })
  })

  it('rejette un game_id inconnu', async () => {
    const res = await request(app)
      .post('/api/games/pacman/scores')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ score: 100, durationMs: 10000 })
    expect(res.status).toBe(404)
  })

  it('rejette score negatif ou hors bornes', async () => {
    const r1 = await request(app).post('/api/games/snake/scores')
      .set('Authorization', `Bearer ${studentToken}`).send({ score: -5, durationMs: 1000 })
    expect(r1.status).toBe(400)

    const r2 = await request(app).post('/api/games/snake/scores')
      .set('Authorization', `Bearer ${studentToken}`).send({ score: 9_999_999, durationMs: 1000 })
    expect(r2.status).toBe(400)
  })

  it('rejette un score aberrant vs duree (anti-triche)', async () => {
    // Snake : max 15 pts/sec. 10 secondes = 150 max. 5000 est aberrant.
    const res = await request(app)
      .post('/api/games/snake/scores')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ score: 5000, durationMs: 10_000 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/incoherent|anti-triche/i)
  })

  it('promo_id stocke pour student, null pour teacher', async () => {
    await request(app).post('/api/games/snake/scores')
      .set('Authorization', `Bearer ${studentToken}`).send({ score: 10, durationMs: 5000 })
    await request(app).post('/api/games/snake/scores')
      .set('Authorization', `Bearer ${teacherToken}`).send({ score: 20, durationMs: 5000 })

    const rows = getTestDb().prepare('SELECT user_type, promo_id FROM game_scores ORDER BY id').all()
    expect(rows[0]).toEqual({ user_type: 'student', promo_id: 1 })
    expect(rows[1]).toEqual({ user_type: 'teacher', promo_id: null })
  })

  it('rejette sans auth', async () => {
    const res = await request(app).post('/api/games/snake/scores')
      .send({ score: 50, durationMs: 5000 })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/games/:gameId/leaderboard', () => {
  beforeEach(async () => {
    await request(app).post('/api/games/snake/scores').set('Authorization', `Bearer ${studentToken}`)
      .send({ score: 100, durationMs: 30_000 })
    await request(app).post('/api/games/snake/scores').set('Authorization', `Bearer ${otherStudentToken}`)
      .send({ score: 250, durationMs: 60_000 })
    await request(app).post('/api/games/snake/scores').set('Authorization', `Bearer ${teacherToken}`)
      .send({ score: 180, durationMs: 40_000 })
    // Un score Space Invaders pour verifier l'isolation par gameId
    // (3000 sur 60s = 50 pts/sec, sous la limite anti-triche 60)
    await request(app).post('/api/games/space_invaders/scores').set('Authorization', `Bearer ${studentToken}`)
      .send({ score: 3000, durationMs: 60_000 })
  })

  it('top du jour pour Snake (Alice > Prof > Jean)', async () => {
    const res = await request(app)
      .get('/api/games/snake/leaderboard?scope=day')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(3)
    expect(res.body.data[0].name).toBe('Alice Martin')
    expect(res.body.data[0].bestScore).toBe(250)
    expect(res.body.data[1].name).toBe('Prof Test')
    expect(res.body.data[2].name).toBe('Jean Dupont')
  })

  it('isole les scores par gameId (le score SI ne pollue pas Snake)', async () => {
    const res = await request(app)
      .get('/api/games/snake/leaderboard?scope=day')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.body.data.every((e) => e.bestScore < 1000)).toBe(true)
  })

  it('Space Invaders a son propre leaderboard', async () => {
    const res = await request(app)
      .get('/api/games/space_invaders/leaderboard?scope=day')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].bestScore).toBe(3000)
  })

  it('aggregation = meilleur score par user', async () => {
    // Jean rejoue plus bas : 50 ne doit pas ecraser 100
    await request(app).post('/api/games/snake/scores').set('Authorization', `Bearer ${studentToken}`)
      .send({ score: 50, durationMs: 20_000 })
    const res = await request(app)
      .get('/api/games/snake/leaderboard?scope=day')
      .set('Authorization', `Bearer ${studentToken}`)
    const jean = res.body.data.find((e) => e.name === 'Jean Dupont')
    expect(jean.bestScore).toBe(100)
    expect(jean.plays).toBe(2)
  })
})

describe('GET /api/games/:gameId/me', () => {
  it('stats vides pour un nouveau joueur', async () => {
    const res = await request(app)
      .get('/api/games/snake/me')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.allTime.plays).toBe(0)
    expect(res.body.data.history).toEqual([])
  })

  it('aggrege apres parties multiples, isolation par gameId', async () => {
    await request(app).post('/api/games/snake/scores').set('Authorization', `Bearer ${studentToken}`)
      .send({ score: 80, durationMs: 30_000 })
    await request(app).post('/api/games/snake/scores').set('Authorization', `Bearer ${studentToken}`)
      .send({ score: 150, durationMs: 50_000 })
    // SI : 1 partie - ne doit pas apparaitre dans les stats Snake
    await request(app).post('/api/games/space_invaders/scores').set('Authorization', `Bearer ${studentToken}`)
      .send({ score: 500, durationMs: 30_000 })

    const res = await request(app)
      .get('/api/games/snake/me')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.body.data.allTime.plays).toBe(2) // pas 3
    expect(res.body.data.allTime.bestScore).toBe(150)
  })
})
