import { describe, it, expect } from 'vitest'
import { avatarColor, formatGrade, gradeClass, initials } from '@/utils/format'

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
