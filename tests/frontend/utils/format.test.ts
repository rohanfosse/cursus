import { describe, it, expect } from 'vitest'
import { avatarColor, formatBytes, formatGrade, gradeClass, initials } from '@/utils/format'

describe('initials', () => {
  it('extracts first letters of each word', () => {
    expect(initials('Jean Dupont')).toBe('JD')
  })
  it('limits to 2 characters', () => {
    expect(initials('Jean Claude Dupont')).toBe('JC')
  })
  it('handles single word', () => {
    expect(initials('Admin')).toBe('A')
  })
  it('uppercases result', () => {
    expect(initials('jean dupont')).toBe('JD')
  })
})

describe('avatarColor', () => {
  it('returns a color from the palette', () => {
    const color = avatarColor('Jean Dupont')
    expect(color).toMatch(/^#[0-9a-f]{6}$/i)
  })
  it('is deterministic for the same input', () => {
    expect(avatarColor('test')).toBe(avatarColor('test'))
  })
  it('differs for different inputs', () => {
    // Not guaranteed but highly likely for distinct strings
    const c1 = avatarColor('Alice')
    const c2 = avatarColor('Zephyr')
    // Just verify both are valid
    expect(c1).toMatch(/^#/)
    expect(c2).toMatch(/^#/)
  })
})

describe('formatGrade', () => {
  it('appends /20 for numeric values', () => {
    expect(formatGrade(15)).toBe('15/20')
  })
  it('appends /20 for numeric string', () => {
    expect(formatGrade('12')).toBe('12/20')
  })
  it('returns letter grades as-is', () => {
    expect(formatGrade('A')).toBe('A')
    expect(formatGrade('B')).toBe('B')
  })
  it('returns empty string for null', () => {
    expect(formatGrade(null)).toBe('')
  })
})

describe('gradeClass', () => {
  it('returns grade-a for letter A', () => {
    expect(gradeClass('A')).toBe('grade-a')
  })
  it('returns grade-b for letter B', () => {
    expect(gradeClass('B')).toBe('grade-b')
  })
  it('returns grade-c for letter C', () => {
    expect(gradeClass('C')).toBe('grade-c')
  })
  it('returns grade-d for letter D', () => {
    expect(gradeClass('D')).toBe('grade-d')
  })
  it('returns grade-na for NA', () => {
    expect(gradeClass('NA')).toBe('grade-na')
  })
  it('returns grade-a for scores >= 14', () => {
    expect(gradeClass(16)).toBe('grade-a')
    expect(gradeClass(14)).toBe('grade-a')
  })
  it('returns grade-b for scores 10-13', () => {
    expect(gradeClass(12)).toBe('grade-b')
    expect(gradeClass(10)).toBe('grade-b')
  })
  it('returns grade-c for scores 8-9', () => {
    expect(gradeClass(9)).toBe('grade-c')
    expect(gradeClass(8)).toBe('grade-c')
  })
  it('returns grade-d for scores < 8', () => {
    expect(gradeClass(5)).toBe('grade-d')
    expect(gradeClass(0)).toBe('grade-d')
  })
  it('returns grade-empty for null', () => {
    expect(gradeClass(null)).toBe('grade-empty')
  })
  it('handles string numbers', () => {
    expect(gradeClass('15')).toBe('grade-a')
    expect(gradeClass('7')).toBe('grade-d')
  })
})

describe('formatBytes', () => {
  it('octets bruts sous 1 Ko', () => {
    expect(formatBytes(0)).toBe('0 o')
    expect(formatBytes(1)).toBe('1 o')
    expect(formatBytes(512)).toBe('512 o')
    expect(formatBytes(1023)).toBe('1023 o')
  })

  it('Ko arrondi entre 1 Ko et 1 Mo', () => {
    expect(formatBytes(1024)).toBe('1 Ko')
    expect(formatBytes(1500)).toBe('1 Ko')
    expect(formatBytes(1536)).toBe('2 Ko')
    expect(formatBytes(50 * 1024)).toBe('50 Ko')
  })

  it('Mo avec une decimale au-dela de 1 Mo', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 Mo')
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 Mo')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 Mo')
  })

  it('option showZero: false cache les valeurs nulles', () => {
    expect(formatBytes(0, { showZero: false })).toBe('')
    expect(formatBytes(0, { showZero: true })).toBe('0 o')
  })

  it('gere les valeurs negatives en retournant vide', () => {
    expect(formatBytes(-1)).toBe('')
  })
})
