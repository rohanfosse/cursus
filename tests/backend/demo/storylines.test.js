/**
 * Tests des trames narratives demo (cf. server/services/demoStorylines.js).
 *
 * On teste les fonctions internes (insertPost, addReaction, pickStoryline)
 * sans declencher le scheduler setTimeout (skippe en NODE_ENV=test pour
 * laisser les tests deterministes).
 *
 * Verifie principalement :
 *  - Chaque storyline a une structure valide (events tries chronologiquement,
 *    auteurs/canaux qui existent dans le seed)
 *  - insertPost cree un message avec la bonne shape (channel + author resolu)
 *  - addReaction utilise le format enrichi { count, users[] }
 *  - Les targets des events 'react' resolvent vers un message reel
 */
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!!'

const { getDemoDb } = require('../../../server/db/demo-connection')
const { seedTenant } = require('../../../server/db/demo-seed')
const stories = require('../../../server/services/demoStorylines')

describe('demoStorylines: structure', () => {
  it('expose 3 trames avec au moins 10 events chacune', () => {
    expect(stories.ALL_STORIES.length).toBe(3)
    for (const story of stories.ALL_STORIES) {
      expect(story.length).toBeGreaterThanOrEqual(10)
    }
  })

  it('events tries chronologiquement et caples sur ~5 min', () => {
    for (const story of stories.ALL_STORIES) {
      let prevAt = -1
      for (const ev of story) {
        expect(ev.at).toBeGreaterThanOrEqual(prevAt)
        expect(ev.at).toBeGreaterThan(0)
        expect(ev.at).toBeLessThan(360) // 6 min max
        prevAt = ev.at
      }
    }
  })

  it('chaque event a un type connu', () => {
    const knownTypes = new Set(['post', 'typing-then-post', 'react'])
    for (const story of stories.ALL_STORIES) {
      for (const ev of story) {
        expect(knownTypes.has(ev.type)).toBe(true)
      }
    }
  })

  it('events post/typing-then-post ont channel + author + content', () => {
    for (const story of stories.ALL_STORIES) {
      for (const ev of story) {
        if (ev.type === 'post' || ev.type === 'typing-then-post') {
          expect(ev.channel).toBeTruthy()
          expect(ev.author).toBeTruthy()
          expect(ev.content).toBeTruthy()
          expect(ev.content.length).toBeLessThan(500)
        }
      }
    }
  })

  it('events react ont target + emoji + reactor', () => {
    for (const story of stories.ALL_STORIES) {
      for (const ev of story) {
        if (ev.type === 'react') {
          expect(ev.target).toBeTruthy()
          expect(ev.target.channel).toBeTruthy()
          expect(ev.target.author).toBeTruthy()
          expect(ev.target.contains).toBeTruthy()
          expect(ev.emoji).toBeTruthy()
          expect(ev.reactor).toBeTruthy()
        }
      }
    }
  })

  it('targets de react referencent un post defini ANTERIEUREMENT dans la meme story', () => {
    for (const story of stories.ALL_STORIES) {
      for (const ev of story) {
        if (ev.type !== 'react') continue
        // Cherche un post precedent qui matche channel + author + contains
        const previousPosts = story.filter((e, i) =>
          (e.type === 'post' || e.type === 'typing-then-post') &&
          e.at < ev.at &&
          e.channel === ev.target.channel &&
          e.author === ev.target.author &&
          e.content.includes(ev.target.contains),
        )
        expect(previousPosts.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('demoStorylines: insertPost + addReaction', () => {
  let db, tenantId

  beforeEach(() => {
    db = getDemoDb()
    tenantId = require('crypto').randomUUID()
    seedTenant(db, tenantId, 'student')
  })

  it('insertPost cree un message d\'un prof (id negatif)', () => {
    const result = stories.insertPost(db, tenantId, 'general', 'Prof. Lemaire', 'Test prof')
    expect(result).toBeTruthy()
    const row = db.prepare(
      `SELECT author_id, author_type, author_name, content FROM demo_messages WHERE id = ?`
    ).get(result.id)
    expect(row.author_type).toBe('teacher')
    expect(row.author_id).toBeLessThan(0)
    expect(row.content).toBe('Test prof')
  })

  it('insertPost cree un message d\'un student (id positif)', () => {
    const result = stories.insertPost(db, tenantId, 'general', 'Lucas Bernard', 'Test student')
    expect(result).toBeTruthy()
    const row = db.prepare(
      `SELECT author_id, author_type, author_name, content FROM demo_messages WHERE id = ?`
    ).get(result.id)
    expect(row.author_type).toBe('student')
    expect(row.author_id).toBeGreaterThan(0)
    expect(row.author_name).toBe('Lucas Bernard')
  })

  it('insertPost retourne null pour un canal inexistant', () => {
    const result = stories.insertPost(db, tenantId, 'canal-jamais-vu', 'Lucas Bernard', 'X')
    expect(result).toBeNull()
  })

  it('insertPost ne re-insere pas si meme contenu en haut du canal', () => {
    const r1 = stories.insertPost(db, tenantId, 'general', 'Lucas Bernard', 'doublon')
    const r2 = stories.insertPost(db, tenantId, 'general', 'Lucas Bernard', 'doublon')
    expect(r1).toBeTruthy()
    expect(r2).toBeNull()
  })

  it('addReaction utilise le format enrichi { count, users[] }', () => {
    const post = stories.insertPost(db, tenantId, 'general', 'Lucas Bernard', 'reagis-moi')
    const r1 = stories.addReaction(db, tenantId, post.id, '🔥', 'Sara Bouhassoun')
    expect(r1).toBeTruthy()
    const row = db.prepare(`SELECT reactions FROM demo_messages WHERE id = ?`).get(post.id)
    const parsed = JSON.parse(row.reactions)
    expect(parsed['🔥']).toEqual({ count: 1, users: ['Sara Bouhassoun'] })

    // Une 2eme reaction du meme user est ignoree
    const r2 = stories.addReaction(db, tenantId, post.id, '🔥', 'Sara Bouhassoun')
    expect(r2).toBeNull()
    // Mais un autre user passe a 2
    const r3 = stories.addReaction(db, tenantId, post.id, '🔥', 'Jean Durand')
    expect(r3).toBeTruthy()
    const row2 = db.prepare(`SELECT reactions FROM demo_messages WHERE id = ?`).get(post.id)
    expect(JSON.parse(row2.reactions)['🔥'].count).toBe(2)
  })
})

describe('demoStorylines: pickStoryline', () => {
  it('pickStoryline retourne une des 3 stories', () => {
    const seen = new Set()
    for (let i = 0; i < 50; i++) {
      const s = stories.pickStoryline()
      expect(stories.ALL_STORIES.includes(s)).toBe(true)
      seen.add(s)
    }
    // Sur 50 tirages on devrait voir au moins 2 stories differentes
    expect(seen.size).toBeGreaterThanOrEqual(2)
  })
})

describe('demoStorylines: scheduler skippe en NODE_ENV=test', () => {
  it('startStoryline en NODE_ENV=test ne fait rien et retourne null', () => {
    const before = Date.now()
    const result = stories.startStoryline('fake-tenant')
    const after = Date.now()
    expect(result).toBeNull()
    expect(after - before).toBeLessThan(50) // pas de setTimeout pose
  })
})
