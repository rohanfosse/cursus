import { describe, it, expect } from 'vitest'
import { parseCategoryIcon, CATEGORY_ICONS } from '@/utils/categoryIcon'

describe('parseCategoryIcon', () => {
  it('parses "monitor Informatique" correctly', () => {
    const result = parseCategoryIcon('monitor Informatique')
    expect(result.label).toBe('Informatique')
    expect(result.icon).not.toBeNull()
  })

  it('parses "code-2 Développement" correctly', () => {
    const result = parseCategoryIcon('code-2 Développement')
    expect(result.label).toBe('Développement')
    expect(result.icon).not.toBeNull()
  })

  it('returns null icon for unknown prefix', () => {
    const result = parseCategoryIcon('unknown-icon Some Label')
    expect(result.icon).toBeNull()
    expect(result.label).toBe('unknown-icon Some Label')
  })

  it('returns null icon and empty label for null input', () => {
    const result = parseCategoryIcon(null)
    expect(result.icon).toBeNull()
    expect(result.label).toBe('')
  })

  it('returns null icon and empty label for undefined', () => {
    const result = parseCategoryIcon(undefined)
    expect(result.icon).toBeNull()
    expect(result.label).toBe('')
  })

  it('returns plain string when no space separator', () => {
    const result = parseCategoryIcon('NoSpace')
    expect(result.icon).toBeNull()
    expect(result.label).toBe('NoSpace')
  })

  it('handles all registered icon keys', () => {
    for (const entry of CATEGORY_ICONS) {
      const result = parseCategoryIcon(`${entry.key} TestLabel`)
      expect(result.icon).not.toBeNull()
      expect(result.label).toBe('TestLabel')
    }
  })
})
