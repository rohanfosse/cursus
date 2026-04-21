// ─── Tests routes /api/me/status + /api/statuses ────────────────────────────
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!!'
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app
let studentToken, teacherToken
let lastEmit

beforeAll(() => {
  setupTestDb()

  studentToken = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  teacherToken = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)

  // Fake io pour capturer les emits status:change
  const fakeIo = {
    to: (room) => ({
      emit: (event, data) => { lastEmit = { room, event, data } },
    }),
  }

  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  app.set('io', fakeIo)
  const auth = require('../../../server/middleware/auth')
  app.use('/api', auth, require('../../../server/routes/statuses'))
})

afterAll(() => teardownTestDb())

beforeEach(() => {
  lastEmit = null
  // Nettoyer la table entre tests
  getTestDb().exec('DELETE FROM user_statuses')
})

describe('PUT /api/me/status', () => {
  test('definit un statut avec emoji + texte', async () => {
    const res = await request(app)
      .put('/api/me/status')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ emoji: '📝', text: 'En examen', expiresAt: null })
    expect(res.status).toBe(200)
    expect(res.body.data.emoji).toBe('📝')
    expect(res.body.data.text).toBe('En examen')
    expect(lastEmit).toEqual(expect.objectContaining({
      room: 'all', event: 'status:change',
    }))
    expect(lastEmit.data.userId).toBe(1)
    expect(lastEmit.data.status.emoji).toBe('📝')
  })

  test('rejette expiresAt dans le passe', async () => {
    const res = await request(app)
      .put('/api/me/status')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ emoji: '☕', text: null, expiresAt: new Date(Date.now() - 10_000).toISOString() })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  test('rejette expiresAt > 30 jours', async () => {
    const res = await request(app)
      .put('/api/me/status')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        emoji: '✈️', text: null,
        expiresAt: new Date(Date.now() + 31 * 24 * 3600 * 1000).toISOString(),
      })
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  test('texte trop long tronque (max 100)', async () => {
    const longText = 'A'.repeat(300)
    const res = await request(app)
      .put('/api/me/status')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ emoji: null, text: longText, expiresAt: null })
    // Zod validation max 100 : doit echouer
    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  test('update remplace le statut existant', async () => {
    await request(app)
      .put('/api/me/status')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ emoji: '📝', text: 'avant', expiresAt: null })
    const res = await request(app)
      .put('/api/me/status')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ emoji: '☕', text: 'apres', expiresAt: null })
    expect(res.status).toBe(200)
    expect(res.body.data.text).toBe('apres')
  })
})

describe('GET /api/me/status', () => {
  test('retourne null si pas de statut', async () => {
    const res = await request(app)
      .get('/api/me/status')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })

  test('retourne le statut actif', async () => {
    await request(app)
      .put('/api/me/status')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ emoji: '📝', text: 'En examen', expiresAt: null })
    const res = await request(app)
      .get('/api/me/status')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.text).toBe('En examen')
  })

  test('filtre un statut expire (defense en profondeur)', async () => {
    const db = getTestDb()
    db.prepare(`
      INSERT INTO user_statuses (user_id, user_type, emoji, text, expires_at)
      VALUES (1, 'student', '📝', 'expire', datetime('now', '-1 minute'))
    `).run()
    const res = await request(app)
      .get('/api/me/status')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toBeNull()
  })
})

describe('DELETE /api/me/status', () => {
  test('efface le statut + emit status:change null', async () => {
    await request(app)
      .put('/api/me/status')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ emoji: '📝', text: 'En examen', expiresAt: null })
    lastEmit = null
    const res = await request(app)
      .delete('/api/me/status')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.cleared).toBe(true)
    expect(lastEmit.event).toBe('status:change')
    expect(lastEmit.data.status).toBeNull()
  })
})

describe('GET /api/statuses', () => {
  test('liste les statuts actifs de tous les users', async () => {
    await request(app)
      .put('/api/me/status')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ emoji: '📝', text: 'examen', expiresAt: null })
    await request(app)
      .put('/api/me/status')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ emoji: '🎯', text: 'dispo', expiresAt: null })

    const res = await request(app)
      .get('/api/statuses')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    const ids = res.body.data.map(s => s.userId)
    expect(ids).toEqual(expect.arrayContaining([1, -1]))
  })

  test('exclut les statuts expires', () => {
    const db = getTestDb()
    db.prepare(`
      INSERT INTO user_statuses (user_id, user_type, emoji, expires_at)
      VALUES (999, 'student', '📝', datetime('now', '-5 minutes'))
    `).run()
    return request(app)
      .get('/api/statuses')
      .set('Authorization', `Bearer ${studentToken}`)
      .then(res => {
        expect(res.body.data.every(s => s.userId !== 999)).toBe(true)
      })
  })
})

describe('Scheduler : purgeExpiredStatuses', () => {
  test('supprime les expires et emit status:change', () => {
    const db = getTestDb()
    db.prepare(`
      INSERT INTO user_statuses (user_id, user_type, emoji, expires_at)
      VALUES (42, 'student', '☕', datetime('now', '-5 minutes'))
    `).run()
    db.prepare(`
      INSERT INTO user_statuses (user_id, user_type, emoji, expires_at)
      VALUES (43, 'student', '📝', datetime('now', '+1 hour'))
    `).run()

    let captured = []
    const fakeIo = {
      to: () => ({ emit: (event, data) => captured.push({ event, data }) }),
    }
    const processExpiredStatuses = require('../../../server/services/schedulerTasks/statuses')
    processExpiredStatuses(fakeIo)

    const remaining = db.prepare('SELECT user_id FROM user_statuses').all().map(r => r.user_id)
    expect(remaining).not.toContain(42)
    expect(remaining).toContain(43)

    expect(captured.some(c => c.event === 'status:change' && c.data.userId === 42)).toBe(true)
  })
})
