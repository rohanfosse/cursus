/**
 * Tests securite Lumen :
 *   - Filtre de visibilite is_visible : un student ne voit pas les repos
 *     masques, un teacher/admin voit tout
 *   - Verification appliquee sur les 4 endpoints concernes :
 *       GET /repos/promo/:id
 *       GET /repos/:id
 *       GET /repos/:id/content
 *       GET /repos/by-project-name
 *
 * userKey() est une fonction privee non exportee : on la teste indirectement
 * via les routes (le scoping de req.user.id se reflete dans les reponses).
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only-32chars!!'
const express = require('express')
const request = require('supertest')
const jwt = require('jsonwebtoken')
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app
let studentToken, teacherToken, adminToken
let visibleRepoId, hiddenRepoId

beforeAll(() => {
  setupTestDb()
  const db = getTestDb()

  // Promo 1 deja seedee dans setupTestDb. On ajoute 2 repos Lumen :
  // un visible et un masque.
  db.prepare(
    `INSERT INTO lumen_repos (promo_id, owner, repo, default_branch, manifest_json, is_visible)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(1, 'cesi', 'cours-visible', 'main', JSON.stringify({
    project: 'Cours Visible',
    chapters: [{ title: 'Intro', path: 'README.md' }],
  }), 1)
  visibleRepoId = db.prepare('SELECT id FROM lumen_repos WHERE repo = ?').get('cours-visible').id

  db.prepare(
    `INSERT INTO lumen_repos (promo_id, owner, repo, default_branch, manifest_json, is_visible)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(1, 'cesi', 'cours-masque', 'main', JSON.stringify({
    project: 'Cours Masque',
    chapters: [{ title: 'Secret', path: 'README.md' }],
  }), 0)
  hiddenRepoId = db.prepare('SELECT id FROM lumen_repos WHERE repo = ?').get('cours-masque').id

  // Tokens
  studentToken = jwt.sign({ id: 1, name: 'Jean', type: 'student', promo_id: 1 }, JWT_SECRET)
  teacherToken = jwt.sign({ id: -1, name: 'Prof', type: 'teacher', promo_id: null }, JWT_SECRET)
  // 'admin' est un role de la table teachers, JWT id negatif comme pour teacher
  adminToken = jwt.sign({ id: -1, name: 'Prof Admin', type: 'admin', promo_id: null }, JWT_SECRET)

  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/lumen', auth, require('../../../server/routes/lumen'))
})

afterAll(() => teardownTestDb())

describe('Lumen visibility filtering — student vs teacher', () => {
  describe('GET /api/lumen/repos/promo/:promoId', () => {
    it('student ne voit que les repos visibles', async () => {
      const res = await request(app).get('/api/lumen/repos/promo/1').set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(200)
      const repos = res.body.data?.repos ?? []
      expect(repos.find((r) => r.id === visibleRepoId)).toBeDefined()
      expect(repos.find((r) => r.id === hiddenRepoId)).toBeUndefined()
    })

    it('teacher voit tous les repos (y compris masques)', async () => {
      const res = await request(app).get('/api/lumen/repos/promo/1').set('Authorization', `Bearer ${teacherToken}`)
      expect(res.status).toBe(200)
      const repos = res.body.data?.repos ?? []
      expect(repos.find((r) => r.id === visibleRepoId)).toBeDefined()
      expect(repos.find((r) => r.id === hiddenRepoId)).toBeDefined()
    })

    it('admin (role teacher) voit tous les repos', async () => {
      const res = await request(app).get('/api/lumen/repos/promo/1').set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      const repos = res.body.data?.repos ?? []
      expect(repos.find((r) => r.id === hiddenRepoId)).toBeDefined()
    })
  })

  describe('GET /api/lumen/repos/:id', () => {
    it('student → 404 sur un repo masque', async () => {
      const res = await request(app).get(`/api/lumen/repos/${hiddenRepoId}`).set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(404)
    })

    it('student → 200 sur un repo visible', async () => {
      const res = await request(app).get(`/api/lumen/repos/${visibleRepoId}`).set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data?.id).toBe(visibleRepoId)
    })

    it('teacher → 200 sur un repo masque', async () => {
      const res = await request(app).get(`/api/lumen/repos/${hiddenRepoId}`).set('Authorization', `Bearer ${teacherToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data?.id).toBe(hiddenRepoId)
    })
  })

  describe('GET /api/lumen/repos/:id/content', () => {
    it('student → 404 sur le contenu d\'un repo masque', async () => {
      const res = await request(app)
        .get(`/api/lumen/repos/${hiddenRepoId}/content?path=README.md`)
        .set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(404)
    })

    it('refuse un path contenant .. (security, v2.181 : 400 avant manifest check)', async () => {
      const res = await request(app)
        .get(`/api/lumen/repos/${visibleRepoId}/content?path=evil/../etc/passwd`)
        .set('Authorization', `Bearer ${studentToken}`)
      // Normalisation defensive avant manifest : refuse traversal
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    })

    it('refuse un path absolu (security, v2.181)', async () => {
      const res = await request(app)
        .get(`/api/lumen/repos/${visibleRepoId}/content?path=/etc/passwd`)
        .set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    })

    it('refuse un path absent du manifest', async () => {
      const res = await request(app)
        .get(`/api/lumen/repos/${visibleRepoId}/content?path=fichier-inexistant.md`)
        .set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(404)
    })
  })
})

describe('userKey() — type safety via routes', () => {
  // userKey() retourne null si req.user.id n'est pas un nombre fini.
  // On verifie indirectement : un JWT avec id non-numerique tombe sur une
  // route qui appelle userKey via /github/me (qui retourne connected:false).
  it('JWT avec id non-numerique → connected: false (pas de crash)', async () => {
    const badToken = jwt.sign({ id: 'string-id', name: 'X', type: 'student', promo_id: 1 }, JWT_SECRET)
    const res = await request(app).get('/api/lumen/github/me').set('Authorization', `Bearer ${badToken}`)
    // userKey return null → la route renvoie connected: false sans crash
    expect(res.status).toBe(200)
    expect(res.body.data?.connected).toBe(false)
  })

  it('JWT teacher id negatif → userKey OK', async () => {
    const res = await request(app).get('/api/lumen/github/me').set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    // Pas de github auth en DB pour ce teacher → connected: false mais sans erreur
    expect(res.body.data).toEqual(expect.objectContaining({ connected: false }))
  })

  it('JWT admin → normalise vers teacher (aucun crash)', async () => {
    const res = await request(app).get('/api/lumen/github/me').set('Authorization', `Bearer ${adminToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data?.connected).toBe(false)
  })
})
