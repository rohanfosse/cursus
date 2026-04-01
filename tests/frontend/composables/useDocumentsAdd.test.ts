/**
 * Tests pour useDocumentsAdd — validation, detection categorie, gestion fichiers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock stores
vi.mock('@/stores/app', () => ({
  useAppStore: vi.fn(() => ({
    currentUser: { id: 1, promo_id: 1 },
    activePromoId: 1,
    activeProject: null,
  })),
}))

vi.mock('@/stores/documents', () => ({
  useDocumentsStore: vi.fn(() => ({
    addDocument: vi.fn().mockResolvedValue(undefined),
    fetchDocuments: vi.fn(),
  })),
}))

vi.mock('@/stores/travaux', () => ({
  useTravauxStore: vi.fn(() => ({
    ganttData: [],
    devoirs: [],
    fetchGantt: vi.fn(),
  })),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(() => ({
    showToast: vi.fn(),
  })),
}))

vi.mock('@/utils/auth', () => ({
  getAuthToken: () => 'test-token',
}))

vi.stubGlobal('window', {
  api: {
    openFileDialog: vi.fn().mockResolvedValue({ ok: true, data: ['/tmp/test.pdf'] }),
    uploadFile: vi.fn().mockResolvedValue({ ok: true, data: { url: '/uploads/test.pdf' } }),
    addChannelDocument: vi.fn().mockResolvedValue({ ok: true, data: { id: 1 } }),
    addProjectDocument: vi.fn().mockResolvedValue({ ok: true, data: { id: 1 } }),
    getChannels: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    getTravaux: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  },
})

import { useDocumentsAdd } from '@/composables/useDocumentsAdd'

describe('useDocumentsAdd', () => {
  let add: ReturnType<typeof useDocumentsAdd>

  beforeEach(() => {
    add = useDocumentsAdd()
  })

  describe('openAddModal', () => {
    it('resets form state and opens modal', () => {
      add.addName.value = 'old name'
      add.addFiles.value = [{ path: '/old', name: 'old.pdf' }]
      add.openAddModal()
      expect(add.showAddModal.value).toBe(true)
      expect(add.addName.value).toBe('')
      expect(add.addFiles.value).toEqual([])
      expect(add.addCategory.value).toBe('Autre')
    })
  })

  describe('detectCategory', () => {
    it('detects Moodle URLs', () => {
      add.detectCategory('https://moodle.cesi.fr/course/123')
      expect(add.addCategory.value).toBe('Moodle')
    })

    it('detects GitHub URLs', () => {
      add.detectCategory('https://github.com/user/repo')
      expect(add.addCategory.value).toBe('GitHub')
    })

    it('detects LinkedIn URLs', () => {
      add.detectCategory('https://linkedin.com/in/profile')
      expect(add.addCategory.value).toBe('LinkedIn')
    })

    it('detects npm/package URLs', () => {
      add.detectCategory('https://www.npmjs.com/package/vue')
      expect(add.addCategory.value).toBe('Package')
    })

    it('defaults to Site Web for unknown URLs', () => {
      add.detectCategory('https://example.com')
      expect(add.addCategory.value).toBe('Site Web')
    })

    it('does nothing for empty string', () => {
      add.addCategory.value = 'Existant'
      add.detectCategory('')
      expect(add.addCategory.value).toBe('Existant')
    })
  })

  describe('file management', () => {
    it('removeFile removes by index', () => {
      add.addFiles.value = [
        { path: '/a.pdf', name: 'a.pdf' },
        { path: '/b.pdf', name: 'b.pdf' },
        { path: '/c.pdf', name: 'c.pdf' },
      ]
      add.removeFile(1)
      expect(add.addFiles.value.length).toBe(2)
      expect(add.addFiles.value[1].name).toBe('c.pdf')
    })

    it('clearFile empties the list', () => {
      add.addFiles.value = [{ path: '/test', name: 'test.pdf' }]
      add.clearFile()
      expect(add.addFiles.value).toEqual([])
    })
  })

  describe('pickFile', () => {
    it('adds files from dialog result', async () => {
      await add.pickFile()
      expect(add.addFiles.value.length).toBe(1)
      expect(add.addFiles.value[0].name).toBe('test.pdf')
    })

    it('prefills name from first file', async () => {
      expect(add.addName.value).toBe('')
      await add.pickFile()
      expect(add.addName.value).toBe('test.pdf')
    })

    it('rejects blocked extensions', async () => {
      ;(window.api.openFileDialog as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        data: ['/tmp/virus.exe'],
      })
      await add.pickFile()
      expect(add.addFiles.value.length).toBe(0)
    })

    it('avoids duplicate files', async () => {
      await add.pickFile()
      await add.pickFile() // same path /tmp/test.pdf
      expect(add.addFiles.value.length).toBe(1)
    })
  })

  describe('modal drag state', () => {
    it('tracks drag enter/leave', () => {
      const dragEvent = { dataTransfer: { types: ['Files'] }, preventDefault: () => {} } as unknown as DragEvent
      add.onModalDragEnter(dragEvent)
      expect(add.modalDragOver.value).toBe(true)
      add.onModalDragLeave()
      expect(add.modalDragOver.value).toBe(false)
    })
  })
})
