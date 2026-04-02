// Set JWT_SECRET before requiring crypto module
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only-32chars'

const { encrypt, decrypt, decryptRow, decryptRows } = require('../../../server/utils/crypto')

describe('encrypt/decrypt', () => {
  it('encrypts and decrypts text correctly', () => {
    const plaintext = 'Bonjour, comment allez-vous ?'
    const encrypted = encrypt(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(encrypted).toMatch(/^enc:/)
    expect(decrypt(encrypted)).toBe(plaintext)
  })

  it('handles empty string', () => {
    expect(encrypt('')).toBe('')
    expect(decrypt('')).toBe('')
  })

  it('handles null', () => {
    expect(encrypt(null)).toBeNull()
    expect(decrypt(null)).toBeNull()
  })

  it('handles undefined', () => {
    expect(encrypt(undefined)).toBeUndefined()
    expect(decrypt(undefined)).toBeUndefined()
  })

  it('returns non-encrypted text as-is (legacy support)', () => {
    expect(decrypt('Plain text message')).toBe('Plain text message')
  })

  it('handles unicode/emoji content', () => {
    const text = '🎉 Félicitations à tous ! ça marche 💯'
    const encrypted = encrypt(text)
    expect(decrypt(encrypted)).toBe(text)
  })

  it('produces different ciphertext for same plaintext (random IV)', () => {
    const text = 'same message'
    const a = encrypt(text)
    const b = encrypt(text)
    expect(a).not.toBe(b)
    // But both decrypt to the same thing
    expect(decrypt(a)).toBe(text)
    expect(decrypt(b)).toBe(text)
  })

  it('returns corrupted data as-is (fallback)', () => {
    const badData = 'enc:not-valid-base64!!!'
    expect(decrypt(badData)).toBe(badData)
  })
})

describe('decryptRow', () => {
  it('returns null for null input', () => {
    expect(decryptRow(null)).toBeNull()
  })

  it('returns row unchanged if no DM content', () => {
    const row = { id: 1, content: 'hello', channel_id: 1 }
    expect(decryptRow(row)).toEqual(row)
  })

  it('decrypts content for DM rows', () => {
    const plaintext = 'Secret DM'
    const encrypted = encrypt(plaintext)
    const row = { id: 1, content: encrypted, dm_student_id: 42 }
    const result = decryptRow(row)
    expect(result.content).toBe(plaintext)
    expect(result.dm_student_id).toBe(42)
  })

  it('decrypts last_message_preview', () => {
    const plaintext = 'Preview text'
    const encrypted = encrypt(plaintext)
    const row = { id: 1, last_message_preview: encrypted }
    const result = decryptRow(row)
    expect(result.last_message_preview).toBe(plaintext)
  })
})

describe('decryptRows', () => {
  it('returns null for null input', () => {
    expect(decryptRows(null)).toBeNull()
  })

  it('decrypts multiple rows', () => {
    const text1 = 'Message 1'
    const text2 = 'Message 2'
    const rows = [
      { id: 1, content: encrypt(text1), dm_student_id: 1 },
      { id: 2, content: encrypt(text2), dm_student_id: 1 },
    ]
    const results = decryptRows(rows)
    expect(results[0].content).toBe(text1)
    expect(results[1].content).toBe(text2)
  })

  it('handles empty array', () => {
    expect(decryptRows([])).toEqual([])
  })
})
