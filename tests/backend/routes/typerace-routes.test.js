/**
 * Tests pour les routes TypeRace (mini-jeu typing speed).
 *
 * Couvre :
 *   - GET /phrases/random (+ exclusion ids)
 *   - POST /scores (validation Zod, anti-triche, teachers vs students)
 *   - GET /leaderboard (filtrage teachers, scope day/week/all, par promo)
 *   - GET /me (stats + historique)
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
  studentToken      = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  teacherToken      = jwt.sign({ id: 1, name: 'Prof Test',    type: 'teacher' },              JWT_SECRET)

  // Seed un 2e etudiant pour tester le leaderboard multi-users
  const db = getTestDb()
  db.prepare(`INSERT OR IGNORE INTO students (id, promo_id, name, email, avatar_initials, password, must_change_password)
              VALUES (2, 1, 'Alice Martin', 'alice@test.fr', 'AM', 'x', 0)`).run()
  otherStudentToken = jwt.sign({ id: 2, name: 'Alice Martin', type: 'student', promo_id: 1 }, JWT_SECRET)

  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/typerace', auth, require('../../../server/routes/typerace'))
})

afterAll(() => teardownTestDb())

beforeEach(() => {
  // Reset les scores entre les tests pour isolation
  getTestDb().prepare('DELETE FROM typerace_scores').run()
})

describe('GET /api/typerace/phrases/random', () => {
  it('retourne une phrase avec id + texte', async () => {
    const res = await request(app)
      .get('/api/typerace/phrases/random')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data).toHaveProperty('id')
    expect(res.body.data).toHaveProperty('text')
    expect(typeof res.body.data.text).toBe('string')
    expect(res.body.data.text.length).toBeGreaterThan(20)
  })

  it('exclut les ids passes en query string', async () => {
    const seen = new Set()
    // On pioche 20 fois en excluant a chaque fois ce qu'on a deja vu
    for (let i = 0; i < 20; i++) {
      const exclude = [...seen].join(',')
      const res = await request(app)
        .get(`/api/typerace/phrases/random${exclude ? `?exclude=${exclude}` : ''}`)
        .set('Authorization', `Bearer ${studentToken}`)
      if (seen.has(res.body.data.id) && seen.size < 100) {
        throw new Error(`ID ${res.body.data.id} renvoye alors qu'il etait exclu (pool encore disponible)`)
      }
      seen.add(res.body.data.id)
    }
    expect(seen.size).toBeGreaterThan(5) // diversite
  })

  it('rejette sans token', async () => {
    const res = await request(app).get('/api/typerace/phrases/random')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/typerace/scores', () => {
  it('enregistre un score valide et retourne id + score', async () => {
    const res = await request(app)
      .post('/api/typerace/scores')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ phraseId: 1, wpm: 50, accuracy: 0.95, durationMs: 10000 })
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveProperty('id')
    expect(res.body.data.score).toBe(Math.round(50 * 0.95))
  })

  it('stocke promo_id pour un etudiant', async () => {
    await request(app)
      .post('/api/typerace/scores')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ phraseId: 1, wpm: 50, accuracy: 0.9, durationMs: 10000 })
    const row = getTestDb().prepare('SELECT promo_id, user_type FROM typerace_scores ORDER BY id DESC LIMIT 1').get()
    expect(row.promo_id).toBe(1)
    expect(row.user_type).toBe('student')
  })

  it('stocke promo_id=null pour un teacher', async () => {
    await request(app)
      .post('/api/typerace/scores')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ phraseId: 1, wpm: 70, accuracy: 0.9, durationMs: 10000 })
    const row = getTestDb().prepare('SELECT promo_id, user_type FROM typerace_scores ORDER BY id DESC LIMIT 1').get()
    expect(row.promo_id).toBeNull()
    expect(row.user_type).toBe('teacher')
  })

  it('rejette un wpm > 300 (borne Zod)', async () => {
    const res = await request(app)
      .post('/api/typerace/scores')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ phraseId: 1, wpm: 999, accuracy: 0.9, durationMs: 10000 })
    expect(res.status).toBe(400)
  })

  it('rejette une accuracy > 1', async () => {
    const res = await request(app)
      .post('/api/typerace/scores')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ phraseId: 1, wpm: 50, accuracy: 1.5, durationMs: 10000 })
    expect(res.status).toBe(400)
  })

  it('rejette une duree > 65s', async () => {
    const res = await request(app)
      .post('/api/typerace/scores')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ phraseId: 1, wpm: 50, accuracy: 0.9, durationMs: 999999 })
    expect(res.status).toBe(400)
  })

  it('rejette un phrase_id inconnu', async () => {
    const res = await request(app)
      .post('/api/typerace/scores')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ phraseId: 9999, wpm: 50, accuracy: 0.9, durationMs: 10000 })
    expect(res.status).toBe(404)
  })

  it('rejette un score incoherent (anti-triche : WPM surhumain sur phrase courte)', async () => {
    // Phrase "Je pense, donc je suis." = 5 mots, en 100ms = 3000 WPM max
    // mais le check serveur accepte x3 tolerance => ~9000 WPM accepte, 300 passe
    // Test avec wpm 250 sur durationMs 500ms sur une phrase de 5 mots :
    // wordCount/(0.5/60) = 5/0.00833 = 600 WPM max * 3 = 1800. 250 <= 1800 => accepte
    // Il faut un cas vraiment aberrant : 299 WPM sur 1000ms de phrase 5 mots
    // = 5/(1/60) = 300 WPM max * 3 = 900, 299 < 900 accepte.
    // Donc on construit : phrase id 2 = "Je pense, donc je suis." (5 mots)
    // durationMs = 60000 (1 min), wordCount / durationMin = 5 WPM max * 3 = 15 WPM.
    // wpm declare = 100 -> doit etre rejete.
    const res = await request(app)
      .post('/api/typerace/scores')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ phraseId: 2, wpm: 100, accuracy: 0.9, durationMs: 60000 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/incoherent|anti-triche/i)
  })

  it('rejette sans auth', async () => {
    const res = await request(app)
      .post('/api/typerace/scores')
      .send({ phraseId: 1, wpm: 50, accuracy: 0.9, durationMs: 10000 })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/typerace/leaderboard', () => {
  beforeEach(async () => {
    // Seed 3 parties : student 1 (50), student 2 (80), teacher (100)
    await request(app).post('/api/typerace/scores').set('Authorization', `Bearer ${studentToken}`)
      .send({ phraseId: 1, wpm: 50, accuracy: 1.0, durationMs: 10000 })
    await request(app).post('/api/typerace/scores').set('Authorization', `Bearer ${otherStudentToken}`)
      .send({ phraseId: 1, wpm: 80, accuracy: 1.0, durationMs: 10000 })
    await request(app).post('/api/typerace/scores').set('Authorization', `Bearer ${teacherToken}`)
      .send({ phraseId: 1, wpm: 100, accuracy: 1.0, durationMs: 10000 })
  })

  it('retourne le top etudiants de la promo (teacher exclu)', async () => {
    const res = await request(app)
      .get('/api/typerace/leaderboard?scope=day')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0].name).toBe('Alice Martin') // score 80 > 50
    expect(res.body.data[0].rank).toBe(1)
    expect(res.body.data[0].bestScore).toBe(80)
    expect(res.body.data[1].name).toBe('Jean Dupont')
    expect(res.body.data[1].rank).toBe(2)
    // Teacher absent
    expect(res.body.data.find((e) => e.name === 'Prof Test')).toBeUndefined()
  })

  it('aggrege le meilleur score par user (pas la somme)', async () => {
    // Jean rejoue avec un score plus bas : 30 ne doit pas ecraser 50
    await request(app).post('/api/typerace/scores').set('Authorization', `Bearer ${studentToken}`)
      .send({ phraseId: 1, wpm: 30, accuracy: 1.0, durationMs: 10000 })
    const res = await request(app)
      .get('/api/typerace/leaderboard?scope=day')
      .set('Authorization', `Bearer ${studentToken}`)
    const jean = res.body.data.find((e) => e.name === 'Jean Dupont')
    expect(jean.bestScore).toBe(50) // pas 30, pas 80
    expect(jean.plays).toBe(2)
  })

  it('scope=day remet a zero les scores trop anciens', async () => {
    // Simuler un ancien score en manipulant created_at
    getTestDb().prepare(`
      INSERT INTO typerace_scores (user_type, user_id, promo_id, phrase_id, wpm, accuracy, score, duration_ms, created_at)
      VALUES ('student', 1, 1, 1, 200, 1.0, 200, 10000, datetime('now', '-2 days'))
    `).run()
    const res = await request(app)
      .get('/api/typerace/leaderboard?scope=day')
      .set('Authorization', `Bearer ${studentToken}`)
    // Le score 200 d'il y a 2 jours ne doit PAS apparaitre en scope day
    const jean = res.body.data.find((e) => e.name === 'Jean Dupont')
    expect(jean.bestScore).toBe(50)
  })

  it('scope=all inclut tous les scores all-time', async () => {
    getTestDb().prepare(`
      INSERT INTO typerace_scores (user_type, user_id, promo_id, phrase_id, wpm, accuracy, score, duration_ms, created_at)
      VALUES ('student', 1, 1, 1, 200, 1.0, 200, 10000, datetime('now', '-30 days'))
    `).run()
    const res = await request(app)
      .get('/api/typerace/leaderboard?scope=all')
      .set('Authorization', `Bearer ${studentToken}`)
    const jean = res.body.data.find((e) => e.name === 'Jean Dupont')
    expect(jean.bestScore).toBe(200)
  })

  it('respecte la limite (max 50)', async () => {
    const res = await request(app)
      .get('/api/typerace/leaderboard?scope=day&limit=1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.body.data).toHaveLength(1)
  })
})

describe('GET /api/typerace/me', () => {
  it('retourne des stats vides pour un nouveau user', async () => {
    const res = await request(app)
      .get('/api/typerace/me')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.allTime.plays).toBe(0)
    expect(res.body.data.allTime.bestScore).toBe(0)
    expect(res.body.data.today.plays).toBe(0)
    expect(res.body.data.history).toEqual([])
  })

  it('aggrege all-time + today + semaine apres quelques parties', async () => {
    for (const wpm of [40, 60, 50]) {
      await request(app).post('/api/typerace/scores').set('Authorization', `Bearer ${studentToken}`)
        .send({ phraseId: 1, wpm, accuracy: 1.0, durationMs: 10000 })
    }
    const res = await request(app)
      .get('/api/typerace/me')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.body.data.allTime.plays).toBe(3)
    expect(res.body.data.allTime.bestScore).toBe(60)
    expect(res.body.data.allTime.bestWpm).toBe(60)
    expect(res.body.data.today.plays).toBe(3)
    expect(res.body.data.today.bestScore).toBe(60)
    expect(res.body.data.history).toHaveLength(3)
  })

  it('isole les stats par user', async () => {
    await request(app).post('/api/typerace/scores').set('Authorization', `Bearer ${studentToken}`)
      .send({ phraseId: 1, wpm: 50, accuracy: 1.0, durationMs: 10000 })
    const resOther = await request(app)
      .get('/api/typerace/me')
      .set('Authorization', `Bearer ${otherStudentToken}`)
    expect(resOther.body.data.allTime.plays).toBe(0) // alice n'a rien joue
  })
})
