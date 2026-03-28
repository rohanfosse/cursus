
const { setupTestDb, teardownTestDb } = require('../helpers/setup')
const { TEST_PASSWORD, WEAK_PASSWORD, NO_UPPER_PASSWORD, NO_DIGIT_PASSWORD, NO_SPECIAL_PASSWORD } = require('../helpers/fixtures')

let students

beforeAll(() => {
  setupTestDb()
  students = require('../../../server/db/models/students')
})
afterAll(() => teardownTestDb())

describe('changePassword (student)', () => {
  it('succeeds with correct current password', () => {
    const result = students.changePassword(1, false, TEST_PASSWORD, 'NewValid1!')
    expect(result).toBe(true)
  })

  it('can login with new password after change', () => {
    const user = students.loginWithCredentials('jean@test.fr', 'NewValid1!')
    expect(user).not.toBeNull()
    expect(user.type).toBe('student')
  })

  it('sets must_change_password to 0', () => {
    const user = students.loginWithCredentials('jean@test.fr', 'NewValid1!')
    expect(user.must_change_password).toBe(0)
  })

  it('rejects wrong current password', () => {
    expect(() => students.changePassword(1, false, 'WrongPass1!', 'Another1!'))
      .toThrow(/incorrect/)
  })

  it('rejects non-existent user', () => {
    expect(() => students.changePassword(9999, false, TEST_PASSWORD, 'Another1!'))
      .toThrow(/introuvable/)
  })

  it('rejects weak new password (too short)', () => {
    expect(() => students.changePassword(1, false, 'NewValid1!', WEAK_PASSWORD))
      .toThrow(/8 caractères/)
  })

  it('rejects new password without uppercase', () => {
    expect(() => students.changePassword(1, false, 'NewValid1!', NO_UPPER_PASSWORD))
      .toThrow(/majuscule/)
  })

  it('rejects new password without digit', () => {
    expect(() => students.changePassword(1, false, 'NewValid1!', NO_DIGIT_PASSWORD))
      .toThrow(/chiffre/)
  })

  it('rejects new password without special char', () => {
    expect(() => students.changePassword(1, false, 'NewValid1!', NO_SPECIAL_PASSWORD))
      .toThrow(/spécial/)
  })
})

describe('changePassword (teacher)', () => {
  it('succeeds with correct current password', () => {
    const result = students.changePassword(1, true, TEST_PASSWORD, 'TeacherNew1!')
    expect(result).toBe(true)
  })

  it('can login as teacher with new password', () => {
    const user = students.loginWithCredentials('prof@test.fr', 'TeacherNew1!')
    expect(user).not.toBeNull()
    expect(user.type).toBe('teacher')
  })

  it('rejects wrong current password for teacher', () => {
    expect(() => students.changePassword(1, true, 'WrongPass1!', 'Another1!'))
      .toThrow(/incorrect/)
  })

  it('rejects non-existent teacher', () => {
    expect(() => students.changePassword(9999, true, TEST_PASSWORD, 'Another1!'))
      .toThrow(/introuvable/)
  })
})
