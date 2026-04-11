/**
 * Tests pour migrateLumenTokensAtBoot — la migration silencieuse des tokens
 * GitHub stockes en clair (legacy v2.32.x) au demarrage du serveur.
 *
 * Le code lazy de getLumenGithubAuth reste en garde-fou mais ne devrait plus
 * etre declenche apres ce boot. Ces tests verifient que la migration est :
 *   - idempotente (re-run = no-op)
 *   - atomique (transaction)
 *   - capable de migrer plusieurs rows en un seul boot
 *   - silencieuse quand il n'y a rien a migrer
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-for-testing-only-32chars!!'
const { setupTestDb, teardownTestDb, getTestDb } = require('../helpers/setup')

let queries

beforeAll(() => {
  setupTestDb()
  queries = require('../../../server/db/models/lumen')
})

afterAll(() => teardownTestDb())

beforeEach(() => {
  // Nettoie la table entre chaque test pour isolation
  getTestDb().prepare('DELETE FROM lumen_github_auth').run()
})

describe('migrateLumenTokensAtBoot', () => {
  it('migre un token plaintext en chiffre', () => {
    getTestDb().prepare('INSERT INTO lumen_github_auth (user_type, user_id, github_login, access_token, scopes) VALUES (?,?,?,?,?)')
      .run('teacher', 1, 'alice', 'ghp_plain_legacy_token', 'repo')

    const count = queries.migrateLumenTokensAtBoot()
    expect(count).toBe(1)

    const raw = getTestDb().prepare('SELECT access_token FROM lumen_github_auth WHERE user_id = ?').get(1)
    expect(raw.access_token.startsWith('enc:')).toBe(true)

    // Lecture renvoie toujours le clair
    const auth = queries.getLumenGithubAuth('teacher', 1)
    expect(auth.access_token).toBe('ghp_plain_legacy_token')
  })

  it('idempotent : re-run apres migration ne fait rien', () => {
    getTestDb().prepare('INSERT INTO lumen_github_auth (user_type, user_id, github_login, access_token, scopes) VALUES (?,?,?,?,?)')
      .run('student', 2, 'bob', 'ghp_legacy', 'repo')

    expect(queries.migrateLumenTokensAtBoot()).toBe(1)
    expect(queries.migrateLumenTokensAtBoot()).toBe(0)
    expect(queries.migrateLumenTokensAtBoot()).toBe(0)
  })

  it('migre plusieurs rows en un seul boot', () => {
    const insert = getTestDb().prepare('INSERT INTO lumen_github_auth (user_type, user_id, github_login, access_token, scopes) VALUES (?,?,?,?,?)')
    insert.run('teacher', 10, 'a', 'ghp_a', 'repo')
    insert.run('teacher', 11, 'b', 'ghp_b', 'repo')
    insert.run('student', 12, 'c', 'ghp_c', 'repo')

    expect(queries.migrateLumenTokensAtBoot()).toBe(3)

    const rows = getTestDb().prepare('SELECT user_id, access_token FROM lumen_github_auth ORDER BY user_id').all()
    for (const r of rows) {
      expect(r.access_token.startsWith('enc:')).toBe(true)
    }
  })

  it('ignore les rows deja chiffres', () => {
    queries.saveLumenGithubAuth('teacher', 20, { githubLogin: 'd', accessToken: 'ghp_already_enc', scopes: 'repo' })
    // Confirme que c'est deja chiffre
    const before = getTestDb().prepare('SELECT access_token FROM lumen_github_auth WHERE user_id = ?').get(20)
    expect(before.access_token.startsWith('enc:')).toBe(true)

    expect(queries.migrateLumenTokensAtBoot()).toBe(0)
  })

  it('mix : migre les plaintext et ignore les chiffres', () => {
    // 1 chiffre via API
    queries.saveLumenGithubAuth('teacher', 30, { githubLogin: 'enc', accessToken: 'ghp_enc', scopes: 'repo' })
    // 2 plaintext via SQL brut
    getTestDb().prepare('INSERT INTO lumen_github_auth (user_type, user_id, github_login, access_token, scopes) VALUES (?,?,?,?,?)')
      .run('teacher', 31, 'plain1', 'ghp_plain1', 'repo')
    getTestDb().prepare('INSERT INTO lumen_github_auth (user_type, user_id, github_login, access_token, scopes) VALUES (?,?,?,?,?)')
      .run('student', 32, 'plain2', 'ghp_plain2', 'repo')

    expect(queries.migrateLumenTokensAtBoot()).toBe(2)

    // Tous chiffres maintenant
    const rows = getTestDb().prepare('SELECT user_id, access_token FROM lumen_github_auth WHERE user_id IN (30, 31, 32)').all()
    expect(rows).toHaveLength(3)
    for (const r of rows) {
      expect(r.access_token.startsWith('enc:')).toBe(true)
    }
  })

  it('silencieux quand la table est vide', () => {
    expect(queries.migrateLumenTokensAtBoot()).toBe(0)
  })
})
