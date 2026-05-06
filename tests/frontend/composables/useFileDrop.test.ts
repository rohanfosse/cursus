/**
 * Tests pour useFileDrop — drag & drop de fichiers, upload, soumission document.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockShowToast = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@/utils/auth', () => ({
  getAuthToken: () => 'test-token',
}))

vi.mock('@/constants', () => ({
  STORAGE_KEYS: { SESSION: 's', NAV_STATE: 'n', PREFS: 'p', MUTED_DMS: 'm' },
  NOTIFICATION_HISTORY_LIMIT: 50,
  MAX_MESSAGE_LENGTH: 5000,
  MESSAGE_PAGE_SIZE: 50,
  GROUP_THRESHOLD_MS: 300000,
  TYPING_TIMEOUT_MS: 3000,
}))

const mockAddChannelDocument = vi.fn()

;(window as unknown as { api: Record<string, unknown> }).api = {
  setToken: vi.fn(),
  onSocketStateChange: vi.fn(() => () => {}),
  onNewMessage: vi.fn(() => () => {}),
  onPresenceUpdate: vi.fn(() => () => {}),
  getTeacherChannels: vi.fn().mockResolvedValue({ ok: true, data: [] }),
  addChannelDocument: mockAddChannelDocument,
  // Mock du wrapper webUtils.getPathForFile expose v2.301 : renvoie la
  // valeur stockee dans `.path` du File (mockee via makeElectronFile).
  getPathForFile: vi.fn((f: File) => (f as File & { path?: string }).path || ''),
}

import { useFileDrop } from '@/composables/useFileDrop'
import { useAppStore } from '@/stores/app'

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeDragEvent(type: string, opts: { files?: File[]; types?: string[] } = {}): DragEvent {
  const files = opts.files ?? []
  const types = opts.types ?? (files.length > 0 ? ['Files'] : [])
  const dt = {
    types,
    files,
    dropEffect: 'none',
  } as unknown as DataTransfer
  return {
    type,
    preventDefault: vi.fn(),
    dataTransfer: dt,
  } as unknown as DragEvent
}

function makeElectronFile(name: string, filePath: string): File {
  const f = new File(['content'], name) as File & { path: string }
  Object.defineProperty(f, 'path', { value: filePath, writable: false })
  return f
}

describe('useFileDrop', () => {
  let appStore: ReturnType<typeof useAppStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    appStore = useAppStore()
    appStore.activeChannelId = 1
    appStore.activePromoId = 1
    appStore.activeProject = null
    mockAddChannelDocument.mockReset()
  })

  // ── Drag enter / leave toggle state ──────────────────────────────────────
  describe('drag enter/leave', () => {
    it('sets isDragOver to true on dragenter with files', () => {
      const { isDragOver, onDragEnter } = useFileDrop()
      const e = makeDragEvent('dragenter', { files: [new File([], 'a.txt')] })

      onDragEnter(e)
      expect(isDragOver.value).toBe(true)
    })

    it('ignores dragenter without Files type', () => {
      const { isDragOver, onDragEnter } = useFileDrop()
      const e = makeDragEvent('dragenter', { types: ['text/plain'] })

      // dataTransfer.types does not include 'Files'
      ;(e.dataTransfer as unknown as { types: string[] }).types = ['text/plain']
      onDragEnter(e)
      expect(isDragOver.value).toBe(false)
    })

    it('sets isDragOver to false when all dragleaves fire', () => {
      const { isDragOver, onDragEnter, onDragLeave } = useFileDrop()

      // Simulate nested enter (parent + child)
      onDragEnter(makeDragEvent('dragenter', { files: [new File([], 'a.txt')] }))
      onDragEnter(makeDragEvent('dragenter', { files: [new File([], 'a.txt')] }))
      expect(isDragOver.value).toBe(true)

      onDragLeave()
      expect(isDragOver.value).toBe(true) // still one level in

      onDragLeave()
      expect(isDragOver.value).toBe(false)
    })

    it('does not go below zero on extra dragleaves', () => {
      const { isDragOver, onDragLeave } = useFileDrop()

      onDragLeave()
      onDragLeave()
      expect(isDragOver.value).toBe(false)
    })
  })

  // ── dragOver ────────────────────────────────────────────────────────────
  describe('onDragOver', () => {
    it('prevents default and sets dropEffect to copy', () => {
      const { onDragOver } = useFileDrop()
      const e = makeDragEvent('dragover', { files: [new File([], 'a.txt')] })

      onDragOver(e)
      expect(e.preventDefault).toHaveBeenCalled()
      expect(e.dataTransfer!.dropEffect).toBe('copy')
    })
  })

  // ── Drop handler processes files (Electron path) ─────────────────────────
  describe('onDrop — Electron file', () => {
    it('sets pendingFile with Electron path', async () => {
      const { onDrop, pendingFile, isDragOver } = useFileDrop()
      const file = makeElectronFile('doc.pdf', '/home/user/doc.pdf')
      const e = makeDragEvent('drop', { files: [file] })

      await onDrop(e)

      expect(e.preventDefault).toHaveBeenCalled()
      expect(isDragOver.value).toBe(false)
      expect(pendingFile.value).toEqual({ name: 'doc.pdf', path: '/home/user/doc.pdf' })
    })
  })

  // ── Drop handler processes files (Web upload) ────────────────────────────
  describe('onDrop — Web upload', () => {
    it('uploads via fetch and sets pendingFile on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: true, data: '/uploads/img.png' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const { onDrop, pendingFile, uploading } = useFileDrop()
      const file = new File(['data'], 'img.png', { type: 'image/png' })
      const e = makeDragEvent('drop', { files: [file] })

      await onDrop(e)

      expect(pendingFile.value).toEqual({
        name: 'img.png',
        path: expect.stringContaining('/uploads/img.png'),
      })
      expect(uploading.value).toBe(false)

      vi.unstubAllGlobals()
    })

    it('shows error toast on failed upload response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: false, error: 'Trop gros' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const { onDrop, pendingFile } = useFileDrop()
      const file = new File(['data'], 'big.zip')
      const e = makeDragEvent('drop', { files: [file] })

      await onDrop(e)

      expect(mockShowToast).toHaveBeenCalledWith('Trop gros', 'error')
      expect(pendingFile.value).toBeNull()

      vi.unstubAllGlobals()
    })

    it('shows generic error toast on fetch exception', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))

      const { onDrop, pendingFile } = useFileDrop()
      const file = new File(['data'], 'f.txt')
      const e = makeDragEvent('drop', { files: [file] })

      await onDrop(e)

      expect(mockShowToast).toHaveBeenCalledWith('Erreur lors de l\'upload du fichier.', 'error')
      expect(pendingFile.value).toBeNull()

      vi.unstubAllGlobals()
    })
  })

  // ── Ignores non-file drops ──────────────────────────────────────────────
  describe('onDrop — no files', () => {
    it('does nothing when no file in dataTransfer', async () => {
      const { onDrop, pendingFile } = useFileDrop()
      const e = {
        preventDefault: vi.fn(),
        dataTransfer: { files: [] },
      } as unknown as DragEvent

      await onDrop(e)

      expect(pendingFile.value).toBeNull()
    })

    it('does nothing when dataTransfer is null', async () => {
      const { onDrop, pendingFile } = useFileDrop()
      const e = {
        preventDefault: vi.fn(),
        dataTransfer: null,
      } as unknown as DragEvent

      await onDrop(e)

      expect(pendingFile.value).toBeNull()
    })
  })

  // ── submitDocument ──────────────────────────────────────────────────────
  describe('submitDocument', () => {
    it('submits pending file and clears it on success', async () => {
      mockAddChannelDocument.mockResolvedValue({ ok: true, data: { id: 1 } })

      const { onDrop, submitDocument, pendingFile } = useFileDrop()
      // Set pendingFile via Electron drop
      const file = makeElectronFile('report.pdf', '/tmp/report.pdf')
      await onDrop(makeDragEvent('drop', { files: [file] }))
      expect(pendingFile.value).not.toBeNull()

      const result = await submitDocument({ name: 'Mon rapport', category: 'Cours' })

      expect(result).toBe(true)
      expect(mockAddChannelDocument).toHaveBeenCalledWith(expect.objectContaining({
        channelId: 1,
        name: 'Mon rapport',
        pathOrUrl: '/tmp/report.pdf',
        category: 'Cours',
      }))
      expect(pendingFile.value).toBeNull()
      expect(mockShowToast).toHaveBeenCalledWith('"Mon rapport" ajouté.', 'success')
    })

    it('returns false when no pending file', async () => {
      const { submitDocument } = useFileDrop()
      const result = await submitDocument({})
      expect(result).toBe(false)
      expect(mockAddChannelDocument).not.toHaveBeenCalled()
    })

    it('shows error toast on API failure', async () => {
      mockAddChannelDocument.mockResolvedValue({ ok: false })

      const { onDrop, submitDocument } = useFileDrop()
      const file = makeElectronFile('a.txt', '/tmp/a.txt')
      await onDrop(makeDragEvent('drop', { files: [file] }))

      const result = await submitDocument({})
      expect(result).toBe(false)
      expect(mockShowToast).toHaveBeenCalledWith('Erreur lors de l\'ajout.', 'error')
    })
  })

  // ── cancelDrop ──────────────────────────────────────────────────────────
  describe('cancelDrop', () => {
    it('clears pendingFile', async () => {
      const { onDrop, cancelDrop, pendingFile } = useFileDrop()
      const file = makeElectronFile('a.txt', '/tmp/a.txt')
      await onDrop(makeDragEvent('drop', { files: [file] }))
      expect(pendingFile.value).not.toBeNull()

      cancelDrop()
      expect(pendingFile.value).toBeNull()
    })
  })
})
