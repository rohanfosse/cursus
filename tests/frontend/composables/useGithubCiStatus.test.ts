/**
 * Tests pour useGithubCiStatus — polling CI GitHub.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { Depot } from '@/types'

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Import after mocks
import { useGithubCiStatus } from '@/composables/useGithubCiStatus'

function makeDepot(content: string, type: 'file' | 'link' = 'link'): Depot {
  return {
    id: Math.random(),
    travail_id: 1,
    student_id: 1,
    student_name: 'Test',
    type,
    content,
    submitted_at: null,
    note: null,
    feedback: null,
  } as Depot
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('useGithubCiStatus', () => {
  describe('parseGithubRepo', () => {
    it('extracts owner/repo from GitHub URL', () => {
      const depots = ref<Depot[]>([])
      const { parseGithubRepo } = useGithubCiStatus(depots)
      expect(parseGithubRepo('https://github.com/rohanfosse/cursus')).toEqual({ owner: 'rohanfosse', repo: 'cursus' })
    })

    it('strips .git suffix', () => {
      const depots = ref<Depot[]>([])
      const { parseGithubRepo } = useGithubCiStatus(depots)
      expect(parseGithubRepo('https://github.com/owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' })
    })

    it('returns null for non-GitHub URLs', () => {
      const depots = ref<Depot[]>([])
      const { parseGithubRepo } = useGithubCiStatus(depots)
      expect(parseGithubRepo('https://gitlab.com/owner/repo')).toBeNull()
    })

    it('returns null for invalid URLs', () => {
      const depots = ref<Depot[]>([])
      const { parseGithubRepo } = useGithubCiStatus(depots)
      expect(parseGithubRepo('not a url')).toBeNull()
    })

    it('returns null for GitHub URLs without repo', () => {
      const depots = ref<Depot[]>([])
      const { parseGithubRepo } = useGithubCiStatus(depots)
      expect(parseGithubRepo('https://github.com/owner')).toBeNull()
    })
  })

  describe('CI_ICON and CI_TITLE', () => {
    it('has icons for all states', () => {
      const depots = ref<Depot[]>([])
      const { CI_ICON, CI_TITLE } = useGithubCiStatus(depots)
      expect(CI_ICON.success).toBeDefined()
      expect(CI_ICON.failure).toBeDefined()
      expect(CI_ICON.pending).toBeDefined()
      expect(CI_ICON.unknown).toBeDefined()
      expect(CI_TITLE.success).toBeDefined()
    })
  })

  describe('fetch behavior', () => {
    it('fetches CI status for GitHub link depots', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ state: 'success' }),
      })

      const depots = ref([
        makeDepot('https://github.com/rohanfosse/cursus'),
      ])

      const { ciStatus } = useGithubCiStatus(depots)

      // Wait for the watcher to trigger
      await new Promise(r => setTimeout(r, 10))

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/rohanfosse/cursus/commits/HEAD/status',
        expect.objectContaining({ headers: { Accept: 'application/vnd.github+json' } }),
      )
    })

    it('skips non-link depots', async () => {
      const depots = ref([
        makeDepot('/tmp/file.pdf', 'file'),
      ])

      useGithubCiStatus(depots)
      await new Promise(r => setTimeout(r, 10))

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('skips non-GitHub links', async () => {
      const depots = ref([
        makeDepot('https://gitlab.com/owner/repo'),
      ])

      useGithubCiStatus(depots)
      await new Promise(r => setTimeout(r, 10))

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('limits to 5 requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ state: 'success' }),
      })

      const depots = ref(
        Array.from({ length: 10 }, (_, i) =>
          makeDepot(`https://github.com/owner/repo${i}`),
        ),
      )

      useGithubCiStatus(depots)
      await new Promise(r => setTimeout(r, 50))

      expect(mockFetch).toHaveBeenCalledTimes(5)
    })

    it('handles API error gracefully', async () => {
      mockFetch.mockResolvedValue({ ok: false })

      const depots = ref([
        makeDepot('https://github.com/owner/repo'),
      ])

      const { ciStatus } = useGithubCiStatus(depots)
      await new Promise(r => setTimeout(r, 10))

      expect(ciStatus.value['https://github.com/owner/repo']).toBe('unknown')
    })

    it('handles fetch exception gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('network'))

      const depots = ref([
        makeDepot('https://github.com/owner/repo'),
      ])

      const { ciStatus } = useGithubCiStatus(depots)
      await new Promise(r => setTimeout(r, 10))

      expect(ciStatus.value['https://github.com/owner/repo']).toBe('unknown')
    })

    it('maps failure/error state correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ state: 'failure' }),
      })

      const depots = ref([
        makeDepot('https://github.com/owner/repo'),
      ])

      const { ciStatus } = useGithubCiStatus(depots)
      await new Promise(r => setTimeout(r, 10))

      expect(ciStatus.value['https://github.com/owner/repo']).toBe('failure')
    })
  })
})
