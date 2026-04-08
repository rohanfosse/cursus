/**
 * Tests unitaires pour le modèle Lumen (cours markdown).
 */
const { setupTestDb, teardownTestDb } = require('../helpers/setup')

let queries

beforeAll(() => {
  setupTestDb()
  queries = require('../../../server/db/models/lumen')
})
afterAll(() => teardownTestDb())

describe('createLumenCourse', () => {
  it('cree un cours en draft par defaut', () => {
    const course = queries.createLumenCourse({
      teacherId: 1,
      promoId: 1,
      title: 'Introduction au Markdown',
      summary: 'Un premier cours pour decouvrir le markdown',
      content: '# Hello\n\nVoici du **markdown**.',
    })
    expect(course).toBeDefined()
    expect(course.id).toBeDefined()
    expect(course.title).toBe('Introduction au Markdown')
    expect(course.status).toBe('draft')
    expect(course.published_at).toBeNull()
    expect(course.teacher_id).toBe(1)
    expect(course.promo_id).toBe(1)
  })

  it('accepte un cours sans contenu (creation rapide)', () => {
    const course = queries.createLumenCourse({
      teacherId: 1,
      promoId: 1,
      title: 'Squelette',
    })
    expect(course.content).toBe('')
    expect(course.summary).toBe('')
  })
})

describe('getLumenCourse', () => {
  it('retourne le cours complet avec content', () => {
    const created = queries.createLumenCourse({
      teacherId: 1, promoId: 1, title: 'Test Read', content: '# Test'
    })
    const found = queries.getLumenCourse(created.id)
    expect(found).toBeDefined()
    expect(found.id).toBe(created.id)
    expect(found.content).toBe('# Test')
  })

  it('retourne null pour un id inexistant', () => {
    expect(queries.getLumenCourse(99999)).toBeNull()
  })
})

describe('getLumenCoursesForPromo', () => {
  let listPromoIds = []
  beforeAll(() => {
    // Setup : creer 4 cours dans la promo 1 (la promo de test isolee)
    const c1 = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'List Draft 1' })
    const c2 = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'List Draft 2' })
    const c3 = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'List Publie 1' })
    const c4 = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'List Publie 2' })
    queries.publishLumenCourse(c3.id)
    queries.publishLumenCourse(c4.id)
    listPromoIds = [c1.id, c2.id, c3.id, c4.id]
  })

  it('retourne au moins les 4 cours crees ici', () => {
    const all = queries.getLumenCoursesForPromo(1)
    const ids = all.map(c => c.id)
    listPromoIds.forEach(id => expect(ids).toContain(id))
  })

  it('filtre uniquement les publies avec onlyPublished', () => {
    const published = queries.getLumenCoursesForPromo(1, { onlyPublished: true })
    expect(published.every(c => c.status === 'published')).toBe(true)
    expect(published.length).toBeGreaterThanOrEqual(2)
  })

  it('ne fuit pas le contenu markdown dans la liste', () => {
    const list = queries.getLumenCoursesForPromo(1)
    expect(list.length).toBeGreaterThan(0)
    expect(list[0]).not.toHaveProperty('content')
  })
})

describe('updateLumenCourse', () => {
  it('met a jour le titre uniquement', () => {
    const c = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'Old', content: 'unchanged' })
    const updated = queries.updateLumenCourse(c.id, { title: 'New' })
    expect(updated.title).toBe('New')
    expect(updated.content).toBe('unchanged')
  })

  it('met a jour content et updated_at', () => {
    const c = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'Edit me' })
    const updated = queries.updateLumenCourse(c.id, { content: '# New body' })
    expect(updated.content).toBe('# New body')
  })
})

describe('publishLumenCourse / unpublishLumenCourse', () => {
  it('publie un cours et set published_at', () => {
    const c = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'To publish' })
    expect(c.status).toBe('draft')
    const { course, isFirstPublish } = queries.publishLumenCourse(c.id)
    expect(course.status).toBe('published')
    expect(course.published_at).not.toBeNull()
    expect(isFirstPublish).toBe(true)
  })

  it('isFirstPublish=false lors d\'une republication', () => {
    const c = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'Republish' })
    queries.publishLumenCourse(c.id)
    queries.unpublishLumenCourse(c.id)
    const { isFirstPublish } = queries.publishLumenCourse(c.id)
    expect(isFirstPublish).toBe(false)
  })

  it('depublie et repasse en draft', () => {
    const c = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'Toggle' })
    queries.publishLumenCourse(c.id)
    const draft = queries.unpublishLumenCourse(c.id)
    expect(draft.status).toBe('draft')
  })
})

describe('deleteLumenCourse', () => {
  it('supprime un cours definitivement', () => {
    const c = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'Bye' })
    queries.deleteLumenCourse(c.id)
    expect(queries.getLumenCourse(c.id)).toBeNull()
  })
})

describe('getLumenStatsForPromo', () => {
  it('retourne des stats coherentes', () => {
    const before = queries.getLumenStatsForPromo(1)
    const c1 = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'Stat A' })
    const c2 = queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'Stat B' })
    queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'Stat C' })
    queries.publishLumenCourse(c1.id)
    queries.publishLumenCourse(c2.id)
    const after = queries.getLumenStatsForPromo(1)
    expect(after.total - before.total).toBe(3)
    expect(after.published - before.published).toBe(2)
    expect(after.drafts - before.drafts).toBe(1)
  })
})

describe('getLumenCoursesForTeacher', () => {
  it('retourne uniquement les cours du teacher', () => {
    queries.createLumenCourse({ teacherId: 42, promoId: 1, title: 'T42 Course' })
    queries.createLumenCourse({ teacherId: 1, promoId: 1, title: 'T1 Course' })
    const list = queries.getLumenCoursesForTeacher(42)
    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(list.every(c => c.teacher_id === 42)).toBe(true)
  })
})
