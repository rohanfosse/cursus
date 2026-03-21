
const { setupTestDb, teardownTestDb } = require('../helpers/setup')
const { TEST_PASSWORD } = require('../helpers/fixtures')

let students

beforeAll(() => {
  setupTestDb()
  students = require('../../../server/db/models/students')
})
afterAll(() => teardownTestDb())

describe('loginWithCredentials', () => {
  it('returns user for valid credentials', () => {
    const user = students.loginWithCredentials('jean@test.fr', TEST_PASSWORD)
    expect(user).not.toBeNull()
    expect(user.type).toBe('student')
    expect(user.id).toBe(1)
  })

  it('returns null for wrong password', () => {
    const user = students.loginWithCredentials('jean@test.fr', 'WrongPass1!')
    expect(user).toBeNull()
  })

  it('returns null for non-existent email', () => {
    const user = students.loginWithCredentials('nonexistent@test.fr', TEST_PASSWORD)
    expect(user).toBeNull()
  })

  it('can login as teacher', () => {
    const user = students.loginWithCredentials('prof@test.fr', TEST_PASSWORD)
    expect(user).not.toBeNull()
    expect(user.type).toBe('teacher')
  })
})

describe('getStudents', () => {
  it('returns students for a promo', () => {
    const list = students.getStudents(1)
    expect(list.length).toBeGreaterThan(0)
    expect(list[0].name).toBe('Jean Dupont')
    // Should not expose password
    expect(list[0].password).toBeUndefined()
  })
})
