/**
 * Tests pour useDocumentsEdit — modal edition de document, soumission.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ─── Mocks ──────────────────────────────────────────────────────────────────

const showToastMock = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: showToastMock }),
}))

const updateDocumentMock = vi.fn()
vi.mock('@/stores/documents', () => ({
  useDocumentsStore: () => ({
    updateDocument: updateDocumentMock,
  }),
}))

const ganttDataMock = [
  { id: 10, title: 'Devoir A', published: 1, category: 'Math' },
  { id: 20, title: 'Devoir B', published: 0, category: 'Info' },
  { id: 30, title: 'Devoir C', published: 1, category: 'Math' },
]
vi.mock('@/stores/travaux', () => ({
  useTravauxStore: () => ({
    ganttData: ganttDataMock,
  }),
}))

import { useDocumentsEdit } from '../../../src/renderer/src/composables/useDocumentsEdit'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: 'Document.pdf',
    category: 'Cours',
    description: 'A description',
    travail_id: null,
    ...overrides,
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useDocumentsEdit', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  // ── travailList ─────────────────────────────────────────────────────────

  describe('travailList', () => {
    it('returns only published travaux sorted by title', () => {
      const { travailList } = useDocumentsEdit()
      expect(travailList.value.length).toBe(2)
      expect(travailList.value[0].title).toBe('Devoir A')
      expect(travailList.value[1].title).toBe('Devoir C')
    })

    it('each entry has id, title, category', () => {
      const { travailList } = useDocumentsEdit()
      expect(travailList.value[0]).toEqual({ id: 10, title: 'Devoir A', category: 'Math' })
    })
  })

  // ── openEditModal ─────────────────────────────────────────────────────

  describe('openEditModal', () => {
    it('populates form fields from document', () => {
      const { openEditModal, showEditModal, editName, editCategory, editDescription, editTravailId } = useDocumentsEdit()
      openEditModal(makeDoc({ id: 5, name: 'Test.pdf', category: 'Exam', description: 'Desc', travail_id: 10 }) as never)
      expect(showEditModal.value).toBe(true)
      expect(editName.value).toBe('Test.pdf')
      expect(editCategory.value).toBe('Exam')
      expect(editDescription.value).toBe('Desc')
      expect(editTravailId.value).toBe(10)
    })

    it('uses "Autre" for null category', () => {
      const { openEditModal, editCategory } = useDocumentsEdit()
      openEditModal(makeDoc({ category: null }) as never)
      expect(editCategory.value).toBe('Autre')
    })

    it('uses empty string for null description', () => {
      const { openEditModal, editDescription } = useDocumentsEdit()
      openEditModal(makeDoc({ description: null }) as never)
      expect(editDescription.value).toBe('')
    })
  })

  // ── submitEdit ────────────────────────────────────────────────────────

  describe('submitEdit', () => {
    it('calls updateDocument with trimmed values on success', async () => {
      updateDocumentMock.mockResolvedValue(true)
      const { openEditModal, editName, submitEdit } = useDocumentsEdit()
      openEditModal(makeDoc({ id: 7 }) as never)
      editName.value = '  New Name.pdf  '
      await submitEdit()
      expect(updateDocumentMock).toHaveBeenCalledWith(7, {
        name: 'New Name.pdf',
        category: 'Cours',
        description: 'A description',
        travailId: null,
      })
      expect(showToastMock).toHaveBeenCalledWith('Document modifié.', 'success')
    })

    it('closes modal on success', async () => {
      updateDocumentMock.mockResolvedValue(true)
      const { openEditModal, submitEdit, showEditModal } = useDocumentsEdit()
      openEditModal(makeDoc() as never)
      await submitEdit()
      expect(showEditModal.value).toBe(false)
    })

    it('shows error toast on failure', async () => {
      updateDocumentMock.mockResolvedValue(false)
      const { openEditModal, submitEdit, showEditModal } = useDocumentsEdit()
      openEditModal(makeDoc() as never)
      await submitEdit()
      expect(showToastMock).toHaveBeenCalledWith('Erreur lors de la modification.', 'error')
      expect(showEditModal.value).toBe(true)
    })

    it('does nothing if name is empty', async () => {
      const { openEditModal, editName, submitEdit } = useDocumentsEdit()
      openEditModal(makeDoc() as never)
      editName.value = '   '
      await submitEdit()
      expect(updateDocumentMock).not.toHaveBeenCalled()
    })

    it('does nothing if editId is null', async () => {
      const { submitEdit } = useDocumentsEdit()
      await submitEdit()
      expect(updateDocumentMock).not.toHaveBeenCalled()
    })

    it('uses "Général" when category is empty', async () => {
      updateDocumentMock.mockResolvedValue(true)
      const { openEditModal, editCategory, submitEdit } = useDocumentsEdit()
      openEditModal(makeDoc() as never)
      editCategory.value = '   '
      await submitEdit()
      expect(updateDocumentMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ category: 'Général' }),
      )
    })

    it('resets saving flag after completion', async () => {
      updateDocumentMock.mockResolvedValue(true)
      const { openEditModal, submitEdit, saving } = useDocumentsEdit()
      openEditModal(makeDoc() as never)
      await submitEdit()
      expect(saving.value).toBe(false)
    })

    it('resets saving flag even on error', async () => {
      updateDocumentMock.mockRejectedValue(new Error('fail'))
      const { openEditModal, submitEdit, saving } = useDocumentsEdit()
      openEditModal(makeDoc() as never)
      await submitEdit().catch(() => {})
      expect(saving.value).toBe(false)
    })
  })
})
