// ─── Tests route Lumen — cours markdown ─────────────────────────────────────
const express = require('express')
const request = require('supertest')
const jwt     = require('jsonwebtoken')
const { setupTestDb, teardownTestDb } = require('../helpers/setup')
const { JWT_SECRET } = require('../helpers/fixtures')

let app, teacherToken, studentToken, otherTeacherToken, otherPromoStudentToken

beforeAll(() => {
  setupTestDb()

  teacherToken = jwt.sign({ id: -1, name: 'Prof Test', type: 'teacher', promo_id: null }, JWT_SECRET)
  otherTeacherToken = jwt.sign({ id: -2, name: 'Prof Autre', type: 'teacher', promo_id: null }, JWT_SECRET)
  studentToken = jwt.sign({ id: 1, name: 'Jean Dupont', type: 'student', promo_id: 1 }, JWT_SECRET)
  otherPromoStudentToken = jwt.sign({ id: 2, name: 'Autre Eleve', type: 'student', promo_id: 2 }, JWT_SECRET)

  app = express()
  app.use(express.json())
  app.set('jwtSecret', JWT_SECRET)
  const auth = require('../../../server/middleware/auth')
  app.use('/api/lumen', auth, require('../../../server/routes/lumen'))
})

afterAll(() => teardownTestDb())

describe('Lumen courses CRUD', () => {
  let courseId

  it('student NE PEUT PAS creer un cours (403)', async () => {
    const res = await request(app)
      .post('/api/lumen/courses')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ promoId: 1, title: 'Cours Etudiant' })
    expect(res.status).toBe(403)
  })

  it('teacher PEUT creer un cours (200)', async () => {
    const res = await request(app)
      .post('/api/lumen/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'Mon Premier Cours', content: '# Hello' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.status).toBe('draft')
    courseId = res.body.data.id
  })

  it('teacher peut recuperer son cours', async () => {
    const res = await request(app)
      .get(`/api/lumen/courses/${courseId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.content).toBe('# Hello')
  })

  it('student NE VOIT PAS un cours en draft (404)', async () => {
    const res = await request(app)
      .get(`/api/lumen/courses/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(404)
    expect(res.body.ok).toBe(false)
  })

  it('teacher peut publier son cours', async () => {
    const res = await request(app)
      .post(`/api/lumen/courses/${courseId}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('published')
    expect(res.body.data.published_at).not.toBeNull()
  })

  it('student VOIT le cours une fois publie', async () => {
    const res = await request(app)
      .get(`/api/lumen/courses/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.content).toBe('# Hello')
  })

  it('liste publique pour student : uniquement publies', async () => {
    // Creer un draft supplementaire
    await request(app)
      .post('/api/lumen/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'Draft a cacher' })

    const res = await request(app)
      .get('/api/lumen/courses/promo/1')
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.every(c => c.status === 'published')).toBe(true)
  })

  it('liste enseignant : drafts + publies', async () => {
    const res = await request(app)
      .get('/api/lumen/courses/promo/1')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.some(c => c.status === 'draft')).toBe(true)
    expect(res.body.data.some(c => c.status === 'published')).toBe(true)
  })

  it('autre enseignant NE PEUT PAS modifier un cours qu\'il n\'a pas cree (403)', async () => {
    const res = await request(app)
      .patch(`/api/lumen/courses/${courseId}`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .send({ title: 'Hijack' })
    expect(res.status).toBe(403)
  })

  it('proprietaire peut modifier le cours', async () => {
    const res = await request(app)
      .patch(`/api/lumen/courses/${courseId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ content: '# Updated' })
    expect(res.status).toBe(200)
    expect(res.body.data.content).toBe('# Updated')
  })

  it('proprietaire peut depublier', async () => {
    const res = await request(app)
      .post(`/api/lumen/courses/${courseId}/unpublish`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('draft')
  })

  it('student NE PEUT PAS supprimer un cours (403)', async () => {
    const res = await request(app)
      .delete(`/api/lumen/courses/${courseId}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(403)
  })

  it('student d\'une autre promo NE PEUT PAS lire un cours de la promo 1 (403)', async () => {
    // Recreer un cours publie pour la promo 1
    const create = await request(app)
      .post('/api/lumen/courses')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ promoId: 1, title: 'Promo 1 only', content: '# Secret' })
    const id = create.body.data.id
    await request(app)
      .post(`/api/lumen/courses/${id}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)

    const res = await request(app)
      .get(`/api/lumen/courses/${id}`)
      .set('Authorization', `Bearer ${otherPromoStudentToken}`)
    expect(res.status).toBe(403)
  })

  it('proprietaire peut supprimer son cours (soft delete)', async () => {
    const res = await request(app)
      .delete(`/api/lumen/courses/${courseId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.deleted).toBe(true)
    expect(res.body.data.soft).toBe(true)
  })

  it('GET /trash : liste les cours soft-deleted du teacher', async () => {
    const queries = require('../../../server/db/index')
    const c = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'Trash list test' })
    queries.deleteLumenCourse(c.id)
    const res = await request(app)
      .get('/api/lumen/trash')
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    const ids = res.body.data.map((x) => x.id)
    expect(ids).toContain(c.id)
  })

  it('POST /courses/:id/restore : restaure un cours soft-deleted', async () => {
    const queries = require('../../../server/db/index')
    const c = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'Restore test' })
    queries.deleteLumenCourse(c.id)
    const res = await request(app)
      .post(`/api/lumen/courses/${c.id}/restore`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.restored).toBe(true)
    // Le cours reapparait dans la liste normale
    const list = queries.getLumenCoursesForPromo(1)
    expect(list.find((x) => x.id === c.id)).toBeDefined()
  })

  it('DELETE /courses/:id/purge : supprime definitivement', async () => {
    const queries = require('../../../server/db/index')
    const c = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'Purge test' })
    const res = await request(app)
      .delete(`/api/lumen/courses/${c.id}/purge`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.purged).toBe(true)
    expect(queries.getLumenCourse(c.id)).toBeNull()
  })
})

// ─── Routes snapshot (repo git d'exemple) ───────────────────────────────────

describe('Lumen snapshot routes', () => {
  // Requires charges lazily dans beforeAll pour ne pas capturer le getDb
  // non-patche (cf. setupTestDb qui patche connection.getDb).
  let queries, lumenSnapshot
  const sampleSnapshot = {
    repo_url: 'https://github.com/owner/repo',
    default_branch: 'main',
    commit_sha: 'sha-first',
    fetched_at: '2026-04-08T12:00:00Z',
    files: [
      { path: 'main.py',        size: 5, content_base64: Buffer.from('hello').toString('base64') },
      { path: 'utils/helpers.py', size: 3, content_base64: Buffer.from('bye').toString('base64') },
    ],
    total_size: 8,
    file_count: 2,
  }

  let courseWithRepo

  beforeAll(() => {
    queries = require('../../../server/db/index')
    lumenSnapshot = require('../../../server/services/lumenSnapshot')
    // Cree un cours avec un repo_url et un snapshot deja stocke, pour eviter
    // d'avoir a mocker fetch dans chaque test (on teste le service separement).
    const course = queries.createLumenCourse({
      teacherId: 1,
      promoId: 1,
      title: 'Cours avec projet',
      content: '# TP Python',
    })
    queries.updateLumenCourse(course.id, { repoUrl: 'https://github.com/owner/repo' })
    queries.setLumenCourseSnapshot(course.id, {
      url: sampleSnapshot.repo_url,
      snapshot: sampleSnapshot,
      commitSha: sampleSnapshot.commit_sha,
      defaultBranch: sampleSnapshot.default_branch,
    })
    // Publie pour que les etudiants puissent y acceder
    queries.publishLumenCourse(course.id)
    courseWithRepo = course.id
  })

  it('GET /snapshot/tree : teacher recupere l arborescence sans les contenus', async () => {
    const res = await request(app)
      .get(`/api/lumen/courses/${courseWithRepo}/snapshot/tree`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.file_count).toBe(2)
    expect(res.body.data.files).toHaveLength(2)
    // Le tree ne doit PAS contenir les contenus
    expect(res.body.data.files[0].content_base64).toBeUndefined()
    expect(res.body.data.files[0].path).toBe('main.py')
  })

  it('GET /snapshot/tree : student de la promo voit le tree', async () => {
    const res = await request(app)
      .get(`/api/lumen/courses/${courseWithRepo}/snapshot/tree`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.file_count).toBe(2)
  })

  it('GET /snapshot/tree : student d une autre promo est bloque (403)', async () => {
    const res = await request(app)
      .get(`/api/lumen/courses/${courseWithRepo}/snapshot/tree`)
      .set('Authorization', `Bearer ${otherPromoStudentToken}`)
    expect(res.status).toBe(403)
  })

  it('GET /snapshot/file : retourne le contenu base64 d un fichier precis', async () => {
    const res = await request(app)
      .get(`/api/lumen/courses/${courseWithRepo}/snapshot/file?path=main.py`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.path).toBe('main.py')
    expect(Buffer.from(res.body.data.content_base64, 'base64').toString()).toBe('hello')
  })

  it('GET /snapshot/file : 404 sur un path inconnu', async () => {
    const res = await request(app)
      .get(`/api/lumen/courses/${courseWithRepo}/snapshot/file?path=nothing.py`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(404)
  })

  it('GET /snapshot/file : 400 sans param path', async () => {
    const res = await request(app)
      .get(`/api/lumen/courses/${courseWithRepo}/snapshot/file`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(400)
  })

  it('GET /snapshot/download : stream un zip valide', async () => {
    const res = await request(app)
      .get(`/api/lumen/courses/${courseWithRepo}/snapshot/download`)
      .set('Authorization', `Bearer ${studentToken}`)
      .buffer(true)
      .parse((resp, cb) => {
        const chunks = []
        resp.on('data', (c) => chunks.push(c))
        resp.on('end', () => cb(null, Buffer.concat(chunks)))
      })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('application/zip')
    expect(res.headers['content-disposition']).toContain('attachment; filename="cours-avec-projet-exemple.zip"')
    // Signature ZIP
    expect(Buffer.isBuffer(res.body)).toBe(true)
    expect(res.body.slice(0, 4).toString('hex')).toBe('504b0304')
  })

  it('POST /snapshot : rafraichit le snapshot via le service (fetch mocke)', async () => {
    // Mock buildSnapshot pour retourner un SHA different → changed: true
    const spy = vi.spyOn(lumenSnapshot, 'buildSnapshot').mockResolvedValue({
      ...sampleSnapshot,
      commit_sha: 'sha-updated',
      fetched_at: '2026-04-08T13:00:00Z',
    })
    const res = await request(app)
      .post(`/api/lumen/courses/${courseWithRepo}/snapshot`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(res.body.data.commit_sha).toBe('sha-updated')
    expect(res.body.data.changed).toBe(true)
    spy.mockRestore()
  })

  it('POST /snapshot : refuse si aucun repo_url attache', async () => {
    const noRepoCourse = queries.createLumenCourse({
      teacherId: 1, promoId: 1, title: 'Pas de repo',
    })
    const res = await request(app)
      .post(`/api/lumen/courses/${noRepoCourse.id}/snapshot`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('NO_REPO_URL')
  })

  it('POST /snapshot : mappe les erreurs du service en HTTP', async () => {
    const spy = vi.spyOn(lumenSnapshot, 'buildSnapshot').mockRejectedValue(
      new lumenSnapshot.SnapshotError(
        lumenSnapshot.ErrorCodes.REPO_NOT_FOUND,
        'Repo introuvable.',
      )
    )
    const res = await request(app)
      .post(`/api/lumen/courses/${courseWithRepo}/snapshot`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('REPO_NOT_FOUND')
    spy.mockRestore()
  })

  it('POST /publish : declenche un snapshot si repo_url defini et pas de snapshot', async () => {
    const freshCourse = queries.createLumenCourse({
      teacherId: 1, promoId: 1, title: 'Fresh avec repo',
    })
    queries.updateLumenCourse(freshCourse.id, { repoUrl: 'https://github.com/owner/repo' })
    // Au moment de publish, il n'y a PAS de snapshot — le route doit fetcher
    const spy = vi.spyOn(lumenSnapshot, 'buildSnapshot').mockResolvedValue(sampleSnapshot)
    const res = await request(app)
      .post(`/api/lumen/courses/${freshCourse.id}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(200)
    expect(spy).toHaveBeenCalledWith('https://github.com/owner/repo')
    spy.mockRestore()
  })

  it('POST /publish : bloque la publication si le snapshot echoue', async () => {
    const freshCourse = queries.createLumenCourse({
      teacherId: 1, promoId: 1, title: 'Fresh repo KO',
    })
    queries.updateLumenCourse(freshCourse.id, { repoUrl: 'https://github.com/owner/repo' })
    const spy = vi.spyOn(lumenSnapshot, 'buildSnapshot').mockRejectedValue(
      new lumenSnapshot.SnapshotError(
        lumenSnapshot.ErrorCodes.RATE_LIMIT,
        'Rate limit GitHub.',
      )
    )
    const res = await request(app)
      .post(`/api/lumen/courses/${freshCourse.id}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
    expect(res.status).toBe(429)
    const after = queries.getLumenCourse(freshCourse.id)
    expect(after.status).toBe('draft')
    spy.mockRestore()
  })

  it('PATCH : modifier repo_url efface le snapshot existant', async () => {
    const course = queries.createLumenCourse({
      teacherId: 1, promoId: 1, title: 'Change repo',
    })
    queries.setLumenCourseSnapshot(course.id, {
      url: 'https://github.com/old/repo',
      snapshot: sampleSnapshot,
      commitSha: 'old-sha',
      defaultBranch: 'main',
    })
    const res = await request(app)
      .patch(`/api/lumen/courses/${course.id}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ repoUrl: 'https://github.com/new/repo' })
    expect(res.status).toBe(200)
    const after = queries.getLumenCourse(course.id)
    expect(after.repo_url).toBe('https://github.com/new/repo')
    expect(after.repo_snapshot).toBeNull()
    expect(after.repo_commit_sha).toBeNull()
  })

  // ─── Notes privees ──────────────────────────────────────────────────────

  describe('Notes privees etudiant', () => {
    let notedCourseId
    beforeAll(async () => {
      // Publie un cours pour que l'etudiant puisse y acceder
      const course = queries.createLumenCourse({
        teacherId: 1, promoId: 1, title: 'Cours avec notes',
      })
      queries.publishLumenCourse(course.id)
      notedCourseId = course.id
    })

    it('GET /note : 200 null si l etudiant n a pas encore ecrit', async () => {
      // Reset pour avoir un etat propre
      queries.deleteLumenCourseNote(1, notedCourseId)
      const res = await request(app)
        .get(`/api/lumen/courses/${notedCourseId}/note`)
        .set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toBeNull()
    })

    it('PUT /note : cree une note pour l etudiant', async () => {
      const res = await request(app)
        .put(`/api/lumen/courses/${notedCourseId}/note`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: 'Ma premiere note sur ce cours' })
      expect(res.status).toBe(200)
      expect(res.body.data.content).toBe('Ma premiere note sur ce cours')
      expect(res.body.data.student_id).toBe(1)
      expect(res.body.data.course_id).toBe(notedCourseId)
    })

    it('GET /note : retourne la note sauvegardee', async () => {
      const res = await request(app)
        .get(`/api/lumen/courses/${notedCourseId}/note`)
        .set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.content).toBe('Ma premiere note sur ce cours')
    })

    it('PUT /note : met a jour une note existante', async () => {
      const res = await request(app)
        .put(`/api/lumen/courses/${notedCourseId}/note`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: 'Note mise a jour' })
      expect(res.status).toBe(200)
      expect(res.body.data.content).toBe('Note mise a jour')
    })

    it('DELETE /note : efface la note', async () => {
      const res = await request(app)
        .delete(`/api/lumen/courses/${notedCourseId}/note`)
        .set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.ok).toBe(true)
      const after = await request(app)
        .get(`/api/lumen/courses/${notedCourseId}/note`)
        .set('Authorization', `Bearer ${studentToken}`)
      expect(after.body.data).toBeNull()
    })

    it('teacher NE PEUT PAS acceder aux notes (403)', async () => {
      const res = await request(app)
        .get(`/api/lumen/courses/${notedCourseId}/note`)
        .set('Authorization', `Bearer ${teacherToken}`)
      expect(res.status).toBe(403)
    })

    it('student d une autre promo est bloque (403)', async () => {
      const res = await request(app)
        .get(`/api/lumen/courses/${notedCourseId}/note`)
        .set('Authorization', `Bearer ${otherPromoStudentToken}`)
      expect(res.status).toBe(403)
    })

    it('PUT refuse un contenu > 10 000 caracteres', async () => {
      const huge = 'x'.repeat(10_001)
      const res = await request(app)
        .put(`/api/lumen/courses/${notedCourseId}/note`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: huge })
      expect(res.status).toBe(400)
    })

    it('GET /my-noted-courses : retourne les IDs des cours annotes', async () => {
      // L'etudiant a deja une note vide apres DELETE precedent. On en cree deux nouvelles.
      const a = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'NC A' })
      const b = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'NC B' })
      queries.publishLumenCourse(a.id)
      queries.publishLumenCourse(b.id)
      queries.upsertLumenCourseNote(1, a.id, 'note reelle A')
      queries.upsertLumenCourseNote(1, b.id, 'note reelle B')

      const res = await request(app)
        .get('/api/lumen/my-noted-courses')
        .set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.course_ids).toEqual(expect.arrayContaining([a.id, b.id]))
    })

    it('GET /my-noted-courses : refuse les teachers (403)', async () => {
      const res = await request(app)
        .get('/api/lumen/my-noted-courses')
        .set('Authorization', `Bearer ${teacherToken}`)
      expect(res.status).toBe(403)
    })

    it('GET /my-notes/export : telecharge un .md avec toutes les notes', async () => {
      // Ajoute une note pour avoir au moins un contenu
      const c = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'Export test course' })
      queries.publishLumenCourse(c.id)
      queries.upsertLumenCourseNote(1, c.id, 'Contenu note unique a exporter')

      const res = await request(app)
        .get('/api/lumen/my-notes/export')
        .set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toContain('text/markdown')
      expect(res.headers['content-disposition']).toContain('attachment')
      expect(res.text).toContain('# Mes notes Lumen')
      expect(res.text).toContain('## Export test course')
      expect(res.text).toContain('Contenu note unique a exporter')
    })

    it('GET /my-notes/export : refuse les teachers', async () => {
      const res = await request(app)
        .get('/api/lumen/my-notes/export')
        .set('Authorization', `Bearer ${teacherToken}`)
      expect(res.status).toBe(403)
    })

    it('GET /my-notes/export : retourne un .md vide structure si aucune note', async () => {
      // Cree un nouveau student artificiellement (id 99) sans aucune note
      // mais on va juste effacer toutes les notes de student 1 et tester
      const existingNotes = queries.getStudentNotesWithCourseTitles(1)
      for (const n of existingNotes) {
        queries.deleteLumenCourseNote(1, n.course_id)
      }
      const res = await request(app)
        .get('/api/lumen/my-notes/export')
        .set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(200)
      expect(res.text).toContain('Aucune note pour le moment')
    })
  })

  describe('Routes read-all + read-counts', () => {
    it('POST /courses/read-all/promo/:id : marque tous les cours publies', async () => {
      const a = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'Read all A' })
      const b = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'Read all B' })
      queries.publishLumenCourse(a.id)
      queries.publishLumenCourse(b.id)

      const res = await request(app)
        .post('/api/lumen/courses/read-all/promo/1')
        .set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.marked).toBeGreaterThanOrEqual(0)

      // Apres l'appel, aucun cours publie ne doit rester non lu
      const unreadRes = await request(app)
        .get('/api/lumen/unread/promo/1')
        .set('Authorization', `Bearer ${studentToken}`)
      expect(unreadRes.body.data.count).toBe(0)
    })

    it('POST /courses/read-all : refuse les teachers (403)', async () => {
      const res = await request(app)
        .post('/api/lumen/courses/read-all/promo/1')
        .set('Authorization', `Bearer ${teacherToken}`)
      expect(res.status).toBe(403)
    })

    it('GET /read-counts/promo/:id : retourne un map pour les teachers', async () => {
      const res = await request(app)
        .get('/api/lumen/read-counts/promo/1')
        .set('Authorization', `Bearer ${teacherToken}`)
      expect(res.status).toBe(200)
      expect(typeof res.body.data).toBe('object')
    })

    it('GET /read-counts/promo/:id : refuse les etudiants (403)', async () => {
      const res = await request(app)
        .get('/api/lumen/read-counts/promo/1')
        .set('Authorization', `Bearer ${studentToken}`)
      expect(res.status).toBe(403)
    })
  })

  it('POST /snapshot : cooldown anti-abuse en prod (429 REFRESH_COOLDOWN)', async () => {
    // Fake "prod" pour activer le check de cooldown
    const prev = { node: process.env.NODE_ENV, vitest: process.env.VITEST }
    process.env.NODE_ENV = 'production'
    delete process.env.VITEST
    try {
      const course = queries.createLumenCourse({
        teacherId: 1, promoId: 1, title: 'Cooldown test',
      })
      queries.updateLumenCourse(course.id, { repoUrl: 'https://github.com/owner/repo' })
      const spy = vi.spyOn(lumenSnapshot, 'buildSnapshot').mockResolvedValue(sampleSnapshot)

      // Premier refresh : OK
      const first = await request(app)
        .post(`/api/lumen/courses/${course.id}/snapshot`)
        .set('Authorization', `Bearer ${teacherToken}`)
      expect(first.status).toBe(200)

      // Deuxieme immediat : bloque par le cooldown
      const second = await request(app)
        .post(`/api/lumen/courses/${course.id}/snapshot`)
        .set('Authorization', `Bearer ${teacherToken}`)
      expect(second.status).toBe(429)
      expect(second.body.code).toBe('REFRESH_COOLDOWN')
      expect(second.body.details.retry_after_seconds).toBeGreaterThan(0)

      spy.mockRestore()
    } finally {
      if (prev.node === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = prev.node
      if (prev.vitest !== undefined) process.env.VITEST = prev.vitest
    }
  })
})
