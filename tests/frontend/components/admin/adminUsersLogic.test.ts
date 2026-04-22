/**
 * Tests logique AdminUsers : règle canDelete (un Responsable Pédagogique dans la
 * sélection bloque la suppression groupée).
 */
import { describe, it, expect } from 'vitest'
import type { Role } from '@/utils/permissions'

function canDeleteSelection(users: { type: Role }[]): boolean {
  return users.every(u => u.type !== 'teacher')
}

describe('AdminUsers — canDeleteSelection', () => {
  it('allows delete for students and TAs only', () => {
    expect(canDeleteSelection([{ type: 'student' }, { type: 'ta' }])).toBe(true)
  })

  it('blocks delete when any teacher is selected', () => {
    expect(canDeleteSelection([{ type: 'student' }, { type: 'teacher' }])).toBe(false)
  })

  it('blocks delete when an admin is selected alongside a teacher', () => {
    expect(canDeleteSelection([{ type: 'admin' }, { type: 'teacher' }])).toBe(false)
  })

  it('allows delete for empty selection', () => {
    expect(canDeleteSelection([])).toBe(true)
  })
})
