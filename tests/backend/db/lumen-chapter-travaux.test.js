/**
 * Tests de la liaison devoirs <-> chapitres (lumen_chapter_travaux).
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only-32chars!!'
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

let lumen
let travailId
let repoId

beforeAll(() => {
  setupTestDb()
  lumen = require('../../../server/db/models/lumen')

  const db = getTestDb()
  // Promo 1 + une promo existante depuis fixtures
  // Cree un travail dans la promo 1
  db.prepare(`
    INSERT INTO travaux (promo_id, title, deadline, type, published)
    VALUES (1, 'DS Python fondamentaux', '2026-10-01T14:00:00Z', 'livrable', 1)
  `).run()
  travailId = db.prepare('SELECT id FROM travaux WHERE title = ?').get('DS Python fondamentaux').id

  // Cree un repo Lumen avec manifest
  const repo = lumen.upsertLumenRepo({ promoId: 1, owner: 'cesi', repo: 'python-fonda' })
  repoId = repo.id
  const manifest = {
    project: 'Python Fondamentaux',
    chapters: [
      { title: 'Intro', path: 'cours/01-intro.md' },
      { title: 'Variables', path: 'cours/02-variables.md' },
      { title: 'Structures de controle', path: 'cours/03-controles.md' },
    ],
  }
  lumen.updateLumenRepoManifest(repoId, {
    manifestJson: JSON.stringify(manifest),
    manifestError: null,
    lastCommitSha: 'abc123',
  })
})

afterAll(() => teardownTestDb())

describe('linkChapterToTravail / unlinkChapterFromTravail', () => {
  it('cree une liaison', () => {
    lumen.linkChapterToTravail(travailId, repoId, 'cours/01-intro.md')
    const chapters = lumen.getChaptersForTravail(travailId)
    expect(chapters.length).toBe(1)
    expect(chapters[0].chapter_path).toBe('cours/01-intro.md')
  })

  it('est idempotent (INSERT OR IGNORE)', () => {
    lumen.linkChapterToTravail(travailId, repoId, 'cours/01-intro.md')
    lumen.linkChapterToTravail(travailId, repoId, 'cours/01-intro.md')
    const chapters = lumen.getChaptersForTravail(travailId)
    expect(chapters.length).toBe(1)
  })

  it('permet de lier plusieurs chapitres au meme devoir', () => {
    lumen.linkChapterToTravail(travailId, repoId, 'cours/02-variables.md')
    lumen.linkChapterToTravail(travailId, repoId, 'cours/03-controles.md')
    const chapters = lumen.getChaptersForTravail(travailId)
    expect(chapters.length).toBe(3)
  })

  it('deliaison fonctionne', () => {
    lumen.unlinkChapterFromTravail(travailId, repoId, 'cours/02-variables.md')
    const chapters = lumen.getChaptersForTravail(travailId)
    expect(chapters.length).toBe(2)
    expect(chapters.map((c) => c.chapter_path)).not.toContain('cours/02-variables.md')
  })
})

describe('getTravauxForChapter', () => {
  it('retourne les devoirs lies a un chapitre', () => {
    const travaux = lumen.getTravauxForChapter(repoId, 'cours/01-intro.md')
    expect(travaux.length).toBe(1)
    expect(travaux[0].title).toBe('DS Python fondamentaux')
    expect(travaux[0].deadline).toBe('2026-10-01T14:00:00Z')
  })

  it('retourne vide pour un chapitre sans lien', () => {
    const travaux = lumen.getTravauxForChapter(repoId, 'cours/nonexistent.md')
    expect(travaux).toEqual([])
  })

  it('un meme chapitre peut etre lie a plusieurs devoirs', () => {
    const db = getTestDb()
    db.prepare(`
      INSERT INTO travaux (promo_id, title, deadline, type, published)
      VALUES (1, 'Rattrapage DS', '2026-10-15T14:00:00Z', 'livrable', 1)
    `).run()
    const t2Id = db.prepare('SELECT id FROM travaux WHERE title = ?').get('Rattrapage DS').id
    lumen.linkChapterToTravail(t2Id, repoId, 'cours/01-intro.md')
    const travaux = lumen.getTravauxForChapter(repoId, 'cours/01-intro.md')
    expect(travaux.length).toBe(2)
  })
})

describe('getChaptersForTravail', () => {
  it('retourne les metadonnees repo (owner, repo, manifest_json)', () => {
    const chapters = lumen.getChaptersForTravail(travailId)
    expect(chapters[0]).toMatchObject({
      travail_id: travailId,
      repo_id: repoId,
      owner: 'cesi',
      repo: 'python-fonda',
    })
    expect(chapters[0].manifest_json).toBeTruthy()
    const manifest = JSON.parse(chapters[0].manifest_json)
    expect(manifest.chapters.length).toBe(3)
  })
})

describe('getChapterTravailCountsForRepo', () => {
  it('compte les liaisons par chapitre dans un repo', () => {
    const counts = lumen.getChapterTravailCountsForRepo(repoId)
    const byPath = Object.fromEntries(counts.map((c) => [c.chapter_path, c.count]))
    expect(byPath['cours/01-intro.md']).toBe(2)
    expect(byPath['cours/03-controles.md']).toBe(1)
  })
})

describe('cascading deletes', () => {
  it('supprimer le devoir supprime les liens', () => {
    const db = getTestDb()
    db.prepare(`
      INSERT INTO travaux (promo_id, title, deadline, type, published)
      VALUES (1, 'Devoir a supprimer', '2026-10-20T14:00:00Z', 'livrable', 1)
    `).run()
    const tId = db.prepare('SELECT id FROM travaux WHERE title = ?').get('Devoir a supprimer').id
    lumen.linkChapterToTravail(tId, repoId, 'cours/03-controles.md')
    expect(lumen.getChaptersForTravail(tId).length).toBe(1)

    db.prepare('DELETE FROM travaux WHERE id = ?').run(tId)
    expect(lumen.getChaptersForTravail(tId).length).toBe(0)
  })

  it('supprimer le repo supprime les liens', () => {
    const db = getTestDb()
    const repo = lumen.upsertLumenRepo({ promoId: 1, owner: 'c', repo: 'deletable' })
    db.prepare(`
      INSERT INTO travaux (promo_id, title, deadline, type, published)
      VALUES (1, 'Devoir lie', '2026-10-25T14:00:00Z', 'livrable', 1)
    `).run()
    const tId = db.prepare('SELECT id FROM travaux WHERE title = ?').get('Devoir lie').id
    // Seed manifest pour ce repo
    lumen.updateLumenRepoManifest(repo.id, {
      manifestJson: JSON.stringify({ project: 'X', chapters: [{ title: 'T', path: 't.md' }] }),
      manifestError: null,
      lastCommitSha: 'x',
    })
    lumen.linkChapterToTravail(tId, repo.id, 't.md')
    expect(lumen.getTravauxForChapter(repo.id, 't.md').length).toBe(1)

    db.prepare('DELETE FROM lumen_repos WHERE id = ?').run(repo.id)
    expect(lumen.getTravauxForChapter(repo.id, 't.md').length).toBe(0)
  })
})
