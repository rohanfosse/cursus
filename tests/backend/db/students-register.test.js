
const { setupTestDb, teardownTestDb } = require('../helpers/setup')
const { TEST_PASSWORD, WEAK_PASSWORD, NO_UPPER_PASSWORD, NO_DIGIT_PASSWORD, NO_SPECIAL_PASSWORD } = require('../helpers/fixtures')

let students

beforeAll(() => {
  setupTestDb()
  students = require('../../../server/db/models/students')
})
afterAll(() => teardownTestDb())

describe('registerStudent', () => {
  it('creates a student with valid data', () => {
    const result = students.registerStudent({
      name: 'Alice Martin',
      email: 'alice.martin@viacesi.fr',
      promoId: 1,
      photoData: null,
      password: TEST_PASSWORD,
    })
    expect(result.changes).toBe(1)
  })

  it('generates correct initials from name', () => {
    const stu = students.getStudentByEmail('alice.martin@viacesi.fr')
    expect(stu).not.toBeNull()
    expect(stu.avatar_initials).toBe('AM')
  })

  it('normalizes email to lowercase', () => {
    const stu = students.getStudentByEmail('alice.martin@viacesi.fr')
    expect(stu.email).toBe('alice.martin@viacesi.fr')
  })

  it('accepts non-@viacesi.fr email (external school)', () => {
    const result = students.registerStudent({
      name: 'Bob External',
      email: 'bob@autreschool.fr',
      promoId: 1,
      photoData: null,
      password: TEST_PASSWORD,
    })
    expect(result.changes).toBe(1)
  })

  it('throws for duplicate email', () => {
    expect(() => students.registerStudent({
      name: 'Alice Doublon',
      email: 'alice.martin@viacesi.fr',
      promoId: 1,
      photoData: null,
      password: TEST_PASSWORD,
    })).toThrow(/déjà utilisée/)
  })

  it('throws for duplicate email case-insensitive', () => {
    expect(() => students.registerStudent({
      name: 'Alice Upper',
      email: 'ALICE.MARTIN@VIACESI.FR',
      promoId: 1,
      photoData: null,
      password: TEST_PASSWORD,
    })).toThrow(/déjà utilisée/)
  })

  it('throws for weak password (too short)', () => {
    expect(() => students.registerStudent({
      name: 'Weak User',
      email: 'weak@viacesi.fr',
      promoId: 1,
      photoData: null,
      password: WEAK_PASSWORD,
    })).toThrow(/8 caractères/)
  })

  it('throws for password without uppercase', () => {
    expect(() => students.registerStudent({
      name: 'NoUpper User',
      email: 'noupper@viacesi.fr',
      promoId: 1,
      photoData: null,
      password: NO_UPPER_PASSWORD,
    })).toThrow(/majuscule/)
  })

  it('throws for password without digit', () => {
    expect(() => students.registerStudent({
      name: 'NoDigit User',
      email: 'nodigit@viacesi.fr',
      promoId: 1,
      photoData: null,
      password: NO_DIGIT_PASSWORD,
    })).toThrow(/chiffre/)
  })

  it('throws for password without special char', () => {
    expect(() => students.registerStudent({
      name: 'NoSpecial User',
      email: 'nospecial@viacesi.fr',
      promoId: 1,
      photoData: null,
      password: NO_SPECIAL_PASSWORD,
    })).toThrow(/spécial/)
  })
})
