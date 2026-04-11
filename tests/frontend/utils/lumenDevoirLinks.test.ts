/**
 * Tests pour les helpers purs partages entre :
 *  - DevoirChapterLinksSection (vue prof)
 *  - LumenChapterPickerModal   (picker)
 *  - LumenChapterViewer        (deep-link ancre)
 *
 * On teste les fonctions pures pour ne pas dependre du DOM ni du store
 * Vue. Les composants ne sont que des wrappers reactifs au-dessus.
 */
import { describe, it, expect } from 'vitest'
import {
  chapterKey,
  toDisplayChapter,
  buildLinkedKeys,
  buildPickerEntries,
  filterPickerEntries,
  resolveAnchorTarget,
} from '@/utils/lumenDevoirLinks'
import type { LumenLinkedChapter, LumenRepo } from '@/types'

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeLinked(overrides: Partial<LumenLinkedChapter> = {}): LumenLinkedChapter {
  return {
    travail_id: 1,
    repo_id: 42,
    chapter_path: 'chapitres/01-intro.md',
    created_at: '2026-04-11T10:00:00Z',
    owner: 'cesi-cours',
    repo: 'algo-l1',
    manifest_json: JSON.stringify({
      project: 'Algorithmique L1',
      chapters: [
        { path: 'chapitres/01-intro.md', title: 'Introduction aux algorithmes' },
        { path: 'chapitres/02-tris.md', title: 'Algorithmes de tri' },
      ],
    }),
    ...overrides,
  }
}

function makeRepo(overrides: Partial<LumenRepo> = {}): LumenRepo {
  return {
    id: 42,
    promoId: 1,
    owner: 'cesi-cours',
    repo: 'algo-l1',
    fullName: 'cesi-cours/algo-l1',
    defaultBranch: 'main',
    manifest: {
      project: 'Algorithmique L1',
      chapters: [
        { title: 'Introduction', path: 'chapitres/01-intro.md' },
        { title: 'Tris', path: 'chapitres/02-tris.md' },
      ],
    },
    manifestError: null,
    lastCommitSha: null,
    lastSyncedAt: null,
    projectId: null,
    projectName: null,
    isVisible: true,
    ...overrides,
  }
}

// ── chapterKey ───────────────────────────────────────────────────────────────

describe('chapterKey', () => {
  it('builds a stable composite key from repoId and path', () => {
    expect(chapterKey(42, 'chapitres/01-intro.md')).toBe('42::chapitres/01-intro.md')
  })

  it('produces distinct keys for the same path on different repos', () => {
    expect(chapterKey(1, 'a.md')).not.toBe(chapterKey(2, 'a.md'))
  })
})

// ── toDisplayChapter ─────────────────────────────────────────────────────────

describe('toDisplayChapter', () => {
  it('extracts title and project name from a valid manifest', () => {
    const linked = makeLinked()
    const display = toDisplayChapter(linked)
    expect(display).toEqual({
      repoId: 42,
      path: 'chapitres/01-intro.md',
      title: 'Introduction aux algorithmes',
      projectName: 'Algorithmique L1',
      key: '42::chapitres/01-intro.md',
    })
  })

  it('falls back to chapter_path when manifest is null', () => {
    const display = toDisplayChapter(makeLinked({ manifest_json: null }))
    expect(display.title).toBe('chapitres/01-intro.md')
    expect(display.projectName).toBe('cesi-cours/algo-l1')
  })

  it('falls back gracefully when manifest JSON is malformed', () => {
    const display = toDisplayChapter(makeLinked({ manifest_json: '{not valid json' }))
    expect(display.title).toBe('chapitres/01-intro.md')
    expect(display.projectName).toBe('cesi-cours/algo-l1')
  })

  it('falls back to chapter_path when manifest has no matching chapter entry', () => {
    const linked = makeLinked({
      chapter_path: 'chapitres/99-introuvable.md',
      manifest_json: JSON.stringify({
        project: 'Algo L1',
        chapters: [{ path: 'chapitres/01-intro.md', title: 'Intro' }],
      }),
    })
    const display = toDisplayChapter(linked)
    expect(display.title).toBe('chapitres/99-introuvable.md')
    expect(display.projectName).toBe('Algo L1')
  })

  it('uses owner/repo when manifest has no project field', () => {
    const linked = makeLinked({
      manifest_json: JSON.stringify({
        chapters: [{ path: 'chapitres/01-intro.md', title: 'Intro' }],
      }),
    })
    const display = toDisplayChapter(linked)
    expect(display.title).toBe('Intro')
    expect(display.projectName).toBe('cesi-cours/algo-l1')
  })
})

// ── buildLinkedKeys ──────────────────────────────────────────────────────────

describe('buildLinkedKeys', () => {
  it('returns a Set of composite keys', () => {
    const displays = [
      toDisplayChapter(makeLinked({ repo_id: 1, chapter_path: 'a.md' })),
      toDisplayChapter(makeLinked({ repo_id: 1, chapter_path: 'b.md' })),
      toDisplayChapter(makeLinked({ repo_id: 2, chapter_path: 'a.md' })),
    ]
    const keys = buildLinkedKeys(displays)
    expect(keys.size).toBe(3)
    expect(keys.has('1::a.md')).toBe(true)
    expect(keys.has('1::b.md')).toBe(true)
    expect(keys.has('2::a.md')).toBe(true)
    expect(keys.has('3::a.md')).toBe(false)
  })

  it('returns an empty Set for empty input', () => {
    expect(buildLinkedKeys([]).size).toBe(0)
  })
})

// ── buildPickerEntries ───────────────────────────────────────────────────────

describe('buildPickerEntries', () => {
  it('flattens repos into per-chapter entries', () => {
    const entries = buildPickerEntries([makeRepo()], new Set())
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      repoId: 42,
      repoLabel: 'Algorithmique L1',
      key: '42::chapitres/01-intro.md',
      alreadyLinked: false,
    })
  })

  it('marks entries already linked', () => {
    const linked = new Set(['42::chapitres/01-intro.md'])
    const entries = buildPickerEntries([makeRepo()], linked)
    expect(entries[0].alreadyLinked).toBe(true)
    expect(entries[1].alreadyLinked).toBe(false)
  })

  it('falls back to fullName when manifest has no project', () => {
    const repo = makeRepo({
      manifest: { chapters: [{ title: 'X', path: 'x.md' }] } as LumenRepo['manifest'],
    })
    const entries = buildPickerEntries([repo], new Set())
    expect(entries[0].repoLabel).toBe('cesi-cours/algo-l1')
  })

  it('skips repos with null manifest cleanly', () => {
    const repo = makeRepo({ manifest: null })
    const entries = buildPickerEntries([repo], new Set())
    expect(entries).toHaveLength(0)
  })

  it('handles multiple repos in order', () => {
    const repoA = makeRepo({ id: 1, fullName: 'org/a' })
    const repoB = makeRepo({ id: 2, fullName: 'org/b' })
    const entries = buildPickerEntries([repoA, repoB], new Set())
    expect(entries).toHaveLength(4)
    expect(entries[0].repoId).toBe(1)
    expect(entries[2].repoId).toBe(2)
  })
})

// ── filterPickerEntries ──────────────────────────────────────────────────────

describe('filterPickerEntries', () => {
  const entries = buildPickerEntries(
    [makeRepo({
      manifest: {
        project: 'Algo L1',
        chapters: [
          { title: 'Introduction aux algorithmes', path: 'chapitres/01-intro.md' },
          { title: 'Recursivite', path: 'chapitres/02-recursion.md' },
          { title: 'Algorithmes de tri', path: 'chapitres/03-tris.md' },
        ],
      } as LumenRepo['manifest'],
    })],
    new Set(),
  )

  it('returns a copy of all entries when query is empty', () => {
    const result = filterPickerEntries(entries, '')
    expect(result).toHaveLength(3)
    expect(result).not.toBe(entries)
  })

  it('matches on chapter title (case-insensitive)', () => {
    const result = filterPickerEntries(entries, 'RECURSIVITE')
    expect(result).toHaveLength(1)
    expect(result[0].chapter.title).toBe('Recursivite')
  })

  it('matches on chapter path', () => {
    const result = filterPickerEntries(entries, '02-recursion')
    expect(result).toHaveLength(1)
  })

  it('matches on project label', () => {
    const result = filterPickerEntries(entries, 'algo l1')
    expect(result).toHaveLength(3)
  })

  it('returns empty array when nothing matches', () => {
    const result = filterPickerEntries(entries, 'inexistant')
    expect(result).toEqual([])
  })

  it('trims whitespace from the query', () => {
    const result = filterPickerEntries(entries, '  tri  ')
    expect(result).toHaveLength(1)
    expect(result[0].chapter.title).toBe('Algorithmes de tri')
  })
})

// ── resolveAnchorTarget ──────────────────────────────────────────────────────

describe('resolveAnchorTarget', () => {
  const headings = ['intro', 'definitions', 'exercices', 'pour-aller-plus-loin']

  it('returns the anchor when it matches a heading id', () => {
    expect(resolveAnchorTarget('definitions', headings)).toBe('definitions')
  })

  it('returns null when anchor does not match any heading', () => {
    expect(resolveAnchorTarget('introuvable', headings)).toBeNull()
  })

  it('returns null for null/undefined/empty anchor', () => {
    expect(resolveAnchorTarget(null, headings)).toBeNull()
    expect(resolveAnchorTarget(undefined, headings)).toBeNull()
    expect(resolveAnchorTarget('', headings)).toBeNull()
  })

  it('returns null when no headings have been extracted yet', () => {
    expect(resolveAnchorTarget('intro', [])).toBeNull()
  })

  it('is case-sensitive (matches the DOM id contract)', () => {
    expect(resolveAnchorTarget('INTRO', headings)).toBeNull()
    expect(resolveAnchorTarget('intro', headings)).toBe('intro')
  })
})
