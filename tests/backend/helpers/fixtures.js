// ─── Reusable test constants ─────────────────────────────────────────────────

const TEST_PASSWORD = 'Test1234!'
const WEAK_PASSWORD = 'abc'
const NO_UPPER_PASSWORD = 'test1234!'
const NO_DIGIT_PASSWORD = 'TestTest!'
const NO_SPECIAL_PASSWORD = 'Test12345'

const JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars'

const STUDENT = {
  id: 1,
  name: 'Jean Dupont',
  email: 'jean@test.fr',
  promoId: 1,
}

const TEACHER = {
  id: 1,
  name: 'Prof Test',
  email: 'prof@test.fr',
}

module.exports = {
  TEST_PASSWORD,
  WEAK_PASSWORD,
  NO_UPPER_PASSWORD,
  NO_DIGIT_PASSWORD,
  NO_SPECIAL_PASSWORD,
  JWT_SECRET,
  STUDENT,
  TEACHER,
}
