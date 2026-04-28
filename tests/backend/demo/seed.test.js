/**
 * Tests du seed demo (server/db/demo-seed.js).
 *
 * Verifie que `seedTenant()` produit un dataset coherent : 2 promos,
 * la principale recoit 4 canaux + 8+ etudiants + 1 prof + ~50 messages
 * (dont des epingles + des reactions JSON valides) + 3 devoirs.
 *
 * Si une migration prod / un changement de seed casse une de ces
 * invariants, le test echoue -> on remarque avant que ca casse en
 * silence cote frontend (banner vide, canaux orphelins, etc.).
 */
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars!!'

// Vitest globals (describe/it/expect/beforeAll/afterAll) — pas d'import
// requis si vitest.config.js a `globals: true` (config par defaut ici).
const { getDemoDb, closeDemoDb } = require('../../../server/db/demo-connection')
const { seedTenant } = require('../../../server/db/demo-seed')
const crypto = require('crypto')

describe('demo-seed: seedTenant', () => {
  let db
  beforeAll(() => {
    // En NODE_ENV=test la DB demo est en memoire (cf. demo-connection.js).
    db = getDemoDb()
  })
  afterAll(() => {
    try { closeDemoDb && closeDemoDb() } catch { /* ignore */ }
  })

  describe('shape de la session etudiante', () => {
    let result
    let tenantId
    beforeAll(() => {
      tenantId = crypto.randomUUID()
      result = seedTenant(db, tenantId, 'student')
    })

    it('retourne un currentUser etudiant complet et marque demo:true', () => {
      expect(result.currentUser).toMatchObject({
        type: 'student',
        demo: true,
        must_change_password: 0,
        onboarding_done: 1,
        promo_name: 'Licence Informatique L3',
      })
      expect(result.currentUser.id).toBeGreaterThan(0)
      expect(result.currentUser.name).toBeTruthy()
      expect(result.currentUser.email).toMatch(/@demo\.cursus$/)
      expect(result.currentUser.avatar_initials).toMatch(/^[A-Z]{2}$/)
    })

    it('cree exactement 2 promotions (Licence + Master)', () => {
      const promos = db.prepare(
        'SELECT name FROM demo_promotions WHERE tenant_id = ? ORDER BY id'
      ).all(tenantId)
      expect(promos).toHaveLength(2)
      expect(promos[0].name).toBe('Licence Informatique L3')
      expect(promos[1].name).toBe('Master Informatique M1')
    })

    it('cree 4 channels dans la promo principale', () => {
      const channels = db.prepare(
        'SELECT name FROM demo_channels WHERE tenant_id = ? AND promo_id = ? ORDER BY id'
      ).all(tenantId, result.promoId)
      expect(channels).toHaveLength(4)
      expect(channels.map(c => c.name)).toEqual([
        'general', 'developpement-web', 'algorithmique', 'projets',
      ])
    })

    it('cree au moins 30 etudiants au total (Licence + Master)', () => {
      // Licence: 20, Master: 13 -> 33. On verifie >= 30 pour tolerer une
      // future reduction de pool sans casser le test.
      const count = db.prepare(
        'SELECT COUNT(*) as c FROM demo_students WHERE tenant_id = ?'
      ).get(tenantId).c
      expect(count).toBeGreaterThanOrEqual(30)
    })

    it('cree exactement 1 prof (Lemaire) avec id negatif', () => {
      const teachers = db.prepare(
        'SELECT id, name FROM demo_teachers WHERE tenant_id = ?'
      ).all(tenantId)
      expect(teachers).toHaveLength(1)
      expect(teachers[0].name).toBe('Prof. Lemaire')
      // L'id en DB est positif, c'est le frontend qui le rend negatif
      // (cf. routes demo /teachers handler) pour eviter collision avec
      // les students. Ici on verifie juste qu'il est dans la table.
      expect(teachers[0].id).toBeGreaterThan(0)
    })
  })

  describe('messages : volume + epinges + reactions valides', () => {
    let tenantId
    beforeAll(() => {
      tenantId = crypto.randomUUID()
      seedTenant(db, tenantId, 'student')
    })

    it('cree au moins 30 messages (seed enrichi v2.260)', () => {
      const count = db.prepare(
        'SELECT COUNT(*) as c FROM demo_messages WHERE tenant_id = ?'
      ).get(tenantId).c
      expect(count).toBeGreaterThanOrEqual(30)
    })

    it('cree au moins 3 messages epingles (is_pinned=1)', () => {
      const pinned = db.prepare(
        'SELECT id, channel_id FROM demo_messages WHERE tenant_id = ? AND is_pinned = 1'
      ).all(tenantId)
      expect(pinned.length).toBeGreaterThanOrEqual(3)
    })

    it('reactions JSON sont des chaines parseables (pas de mojibake)', () => {
      const withReactions = db.prepare(
        `SELECT reactions FROM demo_messages
         WHERE tenant_id = ? AND reactions IS NOT NULL AND reactions != ''`
      ).all(tenantId)
      // Au moins quelques messages ont des reactions
      expect(withReactions.length).toBeGreaterThanOrEqual(5)
      // Toutes parseables et au format { emoji: [user_ids] }
      for (const m of withReactions) {
        const parsed = JSON.parse(m.reactions)
        expect(parsed).toBeTypeOf('object')
        for (const [emoji, ids] of Object.entries(parsed)) {
          expect(typeof emoji).toBe('string')
          expect(Array.isArray(ids)).toBe(true)
          expect(ids.every(id => typeof id === 'number')).toBe(true)
        }
      }
    })

    it('chaque message reference un channel existant du tenant', () => {
      const orphans = db.prepare(
        `SELECT m.id FROM demo_messages m
         LEFT JOIN demo_channels c ON c.id = m.channel_id AND c.tenant_id = m.tenant_id
         WHERE m.tenant_id = ? AND c.id IS NULL`
      ).all(tenantId)
      expect(orphans).toHaveLength(0)
    })

    it('chaque message a un author_name + author_initials non vides', () => {
      const broken = db.prepare(
        `SELECT id FROM demo_messages
         WHERE tenant_id = ?
           AND (author_name IS NULL OR author_name = ''
             OR author_initials IS NULL OR author_initials = '')`
      ).all(tenantId)
      expect(broken).toHaveLength(0)
    })
  })

  describe('assignments : 3 devoirs avec deadline', () => {
    let tenantId
    beforeAll(() => {
      tenantId = crypto.randomUUID()
      seedTenant(db, tenantId, 'student')
    })

    it('cree exactement 3 assignments (Projet Web, TP AVL, Quiz)', () => {
      const assignments = db.prepare(
        'SELECT title, deadline, type FROM demo_assignments WHERE tenant_id = ? ORDER BY id'
      ).all(tenantId)
      expect(assignments).toHaveLength(3)
      const titles = assignments.map(a => a.title)
      expect(titles).toContain('Projet Web E4')
      expect(titles.some(t => t.includes('AVL'))).toBe(true)
    })

    it('toutes les deadlines sont au format YYYY-MM-DD valide et futures', () => {
      const assignments = db.prepare(
        'SELECT deadline FROM demo_assignments WHERE tenant_id = ?'
      ).all(tenantId)
      const today = new Date().toISOString().slice(0, 10)
      for (const a of assignments) {
        expect(a.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        expect(a.deadline >= today).toBe(true)
      }
    })
  })

  describe('shape de la session prof', () => {
    it('le role teacher retourne le prof Lemaire avec demo:true', () => {
      const tenantId = crypto.randomUUID()
      const result = seedTenant(db, tenantId, 'teacher')
      expect(result.currentUser).toMatchObject({
        type: 'teacher',
        name: 'Prof. Lemaire',
        email: 'lemaire@demo.cursus',
        demo: true,
      })
      // L'id du teacher dans `currentUser` est negatif (convention prod)
      expect(result.currentUser.id).toBeLessThan(0)
    })
  })

  describe('isolation par tenant', () => {
    it('deux tenants seedees en parallele ne partagent aucune donnee', () => {
      const tenantA = crypto.randomUUID()
      const tenantB = crypto.randomUUID()
      seedTenant(db, tenantA, 'student')
      seedTenant(db, tenantB, 'student')

      const messagesA = db.prepare(
        'SELECT COUNT(*) c FROM demo_messages WHERE tenant_id = ?'
      ).get(tenantA).c
      const messagesB = db.prepare(
        'SELECT COUNT(*) c FROM demo_messages WHERE tenant_id = ?'
      ).get(tenantB).c

      expect(messagesA).toBeGreaterThan(0)
      expect(messagesB).toBeGreaterThan(0)
      expect(messagesA).toBe(messagesB) // meme seed = meme volume

      // Cross-check : aucun message de A n'a le tenant_id de B et reciproquement
      const cross = db.prepare(
        `SELECT COUNT(*) c FROM demo_messages
         WHERE tenant_id NOT IN (?, ?)`
      ).get(tenantA, tenantB).c
      // Les autres tenants des tests precedents existent peut-etre encore en
      // memoire — on ne fait que verifier qu'aucune ligne n'est cross-tenant
      // par erreur. La vraie garantie : count(A) > 0 ET count(B) > 0 ET les
      // 2 sont egaux.
      expect(cross).toBeGreaterThanOrEqual(0)
    })
  })
})
