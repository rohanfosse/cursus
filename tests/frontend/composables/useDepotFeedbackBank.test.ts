/**
 * Tests pour useDepotFeedbackBank — banque de commentaires rapides.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDepotFeedbackBank } from '@/composables/useDepotFeedbackBank'

// Mock localStorage
const storage: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, val: string) => { storage[key] = val },
  removeItem: (key: string) => { delete storage[key] },
})

beforeEach(() => {
  for (const key of Object.keys(storage)) delete storage[key]
})

describe('useDepotFeedbackBank', () => {
  it('returns default feedback bank', () => {
    const { feedbackBank } = useDepotFeedbackBank()
    expect(feedbackBank.value.length).toBeGreaterThanOrEqual(8)
    expect(feedbackBank.value).toContain('Excellent travail, bravo !')
  })

  it('adds custom feedback', () => {
    const { feedbackBank, newFeedbackText, addCustomFeedback } = useDepotFeedbackBank()
    const initialCount = feedbackBank.value.length
    newFeedbackText.value = 'Nouveau commentaire test'
    addCustomFeedback()
    expect(feedbackBank.value.length).toBe(initialCount + 1)
    expect(feedbackBank.value[0]).toBe('Nouveau commentaire test')
  })

  it('persists custom feedback to localStorage', () => {
    const { newFeedbackText, addCustomFeedback } = useDepotFeedbackBank()
    newFeedbackText.value = 'Persiste moi'
    addCustomFeedback()
    const stored = JSON.parse(storage['cc_custom_feedback'])
    expect(stored).toContain('Persiste moi')
  })

  it('does not add empty feedback', () => {
    const { feedbackBank, newFeedbackText, addCustomFeedback } = useDepotFeedbackBank()
    const count = feedbackBank.value.length
    newFeedbackText.value = '   '
    addCustomFeedback()
    expect(feedbackBank.value.length).toBe(count)
  })

  it('does not add duplicate feedback', () => {
    const { feedbackBank, newFeedbackText, addCustomFeedback } = useDepotFeedbackBank()
    newFeedbackText.value = 'Unique'
    addCustomFeedback()
    const count = feedbackBank.value.length
    newFeedbackText.value = 'Unique'
    addCustomFeedback()
    expect(feedbackBank.value.length).toBe(count)
  })

  it('removes custom feedback', () => {
    const { feedbackBank, customFeedback, newFeedbackText, addCustomFeedback, removeCustomFeedback } = useDepotFeedbackBank()
    newFeedbackText.value = 'A supprimer'
    addCustomFeedback()
    expect(customFeedback.value).toContain('A supprimer')
    removeCustomFeedback('A supprimer')
    expect(customFeedback.value).not.toContain('A supprimer')
  })

  it('does not remove default feedback', () => {
    const { feedbackBank, removeCustomFeedback } = useDepotFeedbackBank()
    const count = feedbackBank.value.length
    removeCustomFeedback('Excellent travail, bravo !')
    // Default feedback is not in customFeedback, so nothing changes
    expect(feedbackBank.value.length).toBe(count)
  })

  it('clears newFeedbackText after adding', () => {
    const { newFeedbackText, addCustomFeedback } = useDepotFeedbackBank()
    newFeedbackText.value = 'Test clear'
    addCustomFeedback()
    expect(newFeedbackText.value).toBe('')
  })

  it('hides add form after adding', () => {
    const { showAddFeedback, newFeedbackText, addCustomFeedback } = useDepotFeedbackBank()
    showAddFeedback.value = true
    newFeedbackText.value = 'Test hide'
    addCustomFeedback()
    expect(showAddFeedback.value).toBe(false)
  })

  it('insertFeedback appends to existing text', () => {
    const { insertFeedback } = useDepotFeedbackBank()
    const target = { value: 'Debut' }
    insertFeedback(target, 'suite')
    expect(target.value).toBe('Debut suite')
  })

  it('insertFeedback sets text when empty', () => {
    const { insertFeedback } = useDepotFeedbackBank()
    const target = { value: '' }
    insertFeedback(target, 'premier')
    expect(target.value).toBe('premier')
  })

  it('loads custom feedback from localStorage on init', () => {
    storage['cc_custom_feedback'] = JSON.stringify(['Preexistant'])
    const { customFeedback } = useDepotFeedbackBank()
    expect(customFeedback.value).toContain('Preexistant')
  })

  it('handles corrupted localStorage gracefully', () => {
    storage['cc_custom_feedback'] = 'not json'
    const { customFeedback } = useDepotFeedbackBank()
    expect(customFeedback.value).toEqual([])
  })
})
