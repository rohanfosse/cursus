const generateJoinCode = require('../../../server/utils/joinCode')

describe('generateJoinCode', () => {
  it('returns a 6-character string', () => {
    const code = generateJoinCode()
    expect(code).toHaveLength(6)
  })

  it('contains only uppercase alphanumeric characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJoinCode()
      expect(code).toMatch(/^[A-Z0-9]+$/)
    }
  })

  it('excludes ambiguous characters (I, O, 0, 1)', () => {
    // Generate many codes and verify none contain ambiguous chars
    const ambiguous = new Set(['I', 'O', '0', '1'])
    for (let i = 0; i < 100; i++) {
      const code = generateJoinCode()
      for (const char of code) {
        expect(ambiguous.has(char)).toBe(false)
      }
    }
  })

  it('generates different codes on successive calls', () => {
    const codes = new Set()
    for (let i = 0; i < 20; i++) {
      codes.add(generateJoinCode())
    }
    // With 30^6 = 729M possibilities, 20 codes should all be unique
    expect(codes.size).toBe(20)
  })
})
