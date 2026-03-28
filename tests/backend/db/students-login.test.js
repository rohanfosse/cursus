
const { setupTestDb, teardownTestDb } = require('../helpers/setup')
const { TEST_PASSWORD } = require('../helpers/fixtures')

let students

beforeAll(() => {
  setupTestDb()
  students = require('../../../server/db/models/students')
})
afterAll(() => teardownTestDb())

describe('loginWithCredentials edge cases', () => {
  it('trims whitespace from email', () => {
    const user = students.loginWithCredentials('  jean@test.fr  ', TEST_PASSWORD)
    expect(user).not.toBeNull()
    expect(user.name).toBe('Jean Dupont')
  })

  it('is case-insensitive for email', () => {
    const user = students.loginWithCredentials('JEAN@TEST.FR', TEST_PASSWORD)
    expect(user).not.toBeNull()
  })

  it('returns null for empty email', () => {
    const user = students.loginWithCredentials('', TEST_PASSWORD)
    expect(user).toBeNull()
  })

  it('returns null for empty password', () => {
    const user = students.loginWithCredentials('jean@test.fr', '')
    expect(user).toBeNull()
  })

  it('returns student fields without password', () => {
    const user = students.loginWithCredentials('jean@test.fr', TEST_PASSWORD)
    expect(user.password).toBeUndefined()
    expect(user.id).toBeDefined()
    expect(user.name).toBeDefined()
    expect(user.email).toBeDefined()
    expect(user.type).toBe('student')
    expect(user.promo_id).toBeDefined()
    expect(user.promo_name).toBeDefined()
    expect(user.avatar_initials).toBeDefined()
    expect(user.must_change_password).toBeDefined()
  })

  it('returns teacher with negative id', () => {
    const user = students.loginWithCredentials('prof@test.fr', TEST_PASSWORD)
    expect(user).not.toBeNull()
    expect(user.id).toBeLessThan(0)
    expect(user.type).toBe('teacher')
    expect(user.promo_id).toBeNull()
  })

  it('returns teacher fields without password', () => {
    const user = students.loginWithCredentials('prof@test.fr', TEST_PASSWORD)
    expect(user.password).toBeUndefined()
    expect(user.name).toBeDefined()
    expect(user.avatar_initials).toBeDefined()
    expect(user.must_change_password).toBeDefined()
  })
})

describe('getStudentByEmail', () => {
  it('returns student data for valid email', () => {
    const stu = students.getStudentByEmail('jean@test.fr')
    expect(stu).not.toBeNull()
    expect(stu.id).toBe(1)
    expect(stu.name).toBe('Jean Dupont')
    expect(stu.avatar_initials).toBe('JD')
    expect(stu.promo_name).toBe('Promo Test')
  })

  it('does not expose password field', () => {
    const stu = students.getStudentByEmail('jean@test.fr')
    expect(stu.password).toBeUndefined()
  })

  it('returns undefined for non-existent email', () => {
    const stu = students.getStudentByEmail('nobody@test.fr')
    expect(stu).toBeUndefined()
  })
})
