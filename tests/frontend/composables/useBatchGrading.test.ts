/**
 * Tests unitaires pour le composable useBatchGrading.
 * Logique pure : navigation, filtres, grades, auto-save, keyboard.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useBatchGrading } from '@/composables/useBatchGrading'
import type { Depot } from '@/types'

function makeDepot(overrides: Partial<Depot> & { id: number; student_name: string }): Depot {
  return {
    travail_id: 1,
    student_id: overrides.id,
    type: 'file',
    content: '/tmp/file.pdf',
    submitted_at: '2026-04-01T10:00:00Z',
    note: null,
    feedback: null,
    ...overrides,
  } as Depot
}

const DEPOTS: Depot[] = [
  makeDepot({ id: 1, student_name: 'Alice Martin', note: 'A', feedback: 'Bien' }),
  makeDepot({ id: 2, student_name: 'Bob Dupont', note: null, feedback: null }),
  makeDepot({ id: 3, student_name: 'Claire Petit', note: 'C', feedback: null }),
  makeDepot({ id: 4, student_name: 'David Roy', note: null, feedback: null }),
  makeDepot({ id: 5, student_name: 'Emma Laurent', note: 'B', feedback: 'Bon effort' }),
]

describe('useBatchGrading', () => {
  let onSave: ReturnType<typeof vi.fn>
  let depots: ReturnType<typeof ref<Depot[]>>

  beforeEach(() => {
    onSave = vi.fn().mockResolvedValue(undefined)
    depots = ref([...DEPOTS])
  })

  function createBatch() {
    return useBatchGrading({ depots, onSave })
  }

  // ── Toggle ──────────────────────────────────────────────────────────

  describe('toggle', () => {
    it('starts inactive', () => {
      const batch = createBatch()
      expect(batch.active.value).toBe(false)
    })

    it('toggles active state', () => {
      const batch = createBatch()
      batch.toggle()
      expect(batch.active.value).toBe(true)
      batch.toggle()
      expect(batch.active.value).toBe(false)
    })

    it('resets activeIndex to 0 on activate', () => {
      const batch = createBatch()
      batch.active.value = true
      batch.selectIndex(3)
      batch.toggle() // deactivate
      batch.toggle() // reactivate
      expect(batch.activeIndex.value).toBe(0)
    })
  })

  // ── Navigation ──────────────────────────────────────────────────────

  describe('navigation', () => {
    it('next() advances activeIndex', () => {
      const batch = createBatch()
      batch.toggle()
      expect(batch.activeIndex.value).toBe(0)
      batch.next()
      expect(batch.activeIndex.value).toBe(1)
    })

    it('prev() decrements activeIndex', () => {
      const batch = createBatch()
      batch.toggle()
      batch.selectIndex(2)
      batch.prev()
      expect(batch.activeIndex.value).toBe(1)
    })

    it('next() clamps at end of list', () => {
      const batch = createBatch()
      batch.toggle()
      batch.selectIndex(4)
      batch.next()
      expect(batch.activeIndex.value).toBe(4)
    })

    it('prev() clamps at 0', () => {
      const batch = createBatch()
      batch.toggle()
      batch.prev()
      expect(batch.activeIndex.value).toBe(0)
    })

    it('selectDepot() finds correct index', () => {
      const batch = createBatch()
      batch.toggle()
      batch.selectDepot(3) // Claire Petit
      // filteredList is sorted by name, so Claire is at index 1 (after Alice, before Bob)
      const idx = batch.filteredList.value.findIndex(d => d.id === 3)
      expect(batch.activeIndex.value).toBe(idx)
    })
  })

  // ── Filters ─────────────────────────────────────────────────────────

  describe('filter', () => {
    it('all filter shows all depots', () => {
      const batch = createBatch()
      batch.filter.value = 'all'
      expect(batch.filteredList.value.length).toBe(5)
    })

    it('ungraded filter shows only ungraded', () => {
      const batch = createBatch()
      batch.filter.value = 'ungraded'
      expect(batch.filteredList.value.length).toBe(2)
      expect(batch.filteredList.value.every(d => d.note == null)).toBe(true)
    })

    it('graded filter shows only graded', () => {
      const batch = createBatch()
      batch.filter.value = 'graded'
      expect(batch.filteredList.value.length).toBe(3)
      expect(batch.filteredList.value.every(d => d.note != null)).toBe(true)
    })

    it('list is sorted alphabetically', () => {
      const batch = createBatch()
      const names = batch.filteredList.value.map(d => d.student_name)
      const sorted = [...names].sort((a, b) => a.localeCompare(b))
      expect(names).toEqual(sorted)
    })
  })

  // ── Grade setting ───────────────────────────────────────────────────

  describe('setGrade', () => {
    it('sets pendingNote to the grade', () => {
      const batch = createBatch()
      batch.toggle()
      batch.setGrade('B')
      expect(batch.pendingNote.value).toBe('B')
    })

    it('overrides previous grade', () => {
      const batch = createBatch()
      batch.toggle()
      batch.setGrade('A')
      batch.setGrade('D')
      expect(batch.pendingNote.value).toBe('D')
    })
  })

  // ── Progress ────────────────────────────────────────────────────────

  describe('progress', () => {
    it('totalCount matches depots length', () => {
      const batch = createBatch()
      expect(batch.totalCount.value).toBe(5)
    })

    it('gradedCount counts noted depots', () => {
      const batch = createBatch()
      expect(batch.gradedCount.value).toBe(3) // Alice A, Claire C, Emma B
    })

    it('progressPct computes percentage', () => {
      const batch = createBatch()
      expect(batch.progressPct.value).toBe(60) // 3/5
    })
  })

  // ── Distribution ────────────────────────────────────────────────────

  describe('distribution', () => {
    it('counts grades correctly', () => {
      const batch = createBatch()
      const dist = batch.distribution.value
      expect(dist.find(g => g.grade === 'A')?.count).toBe(1)
      expect(dist.find(g => g.grade === 'B')?.count).toBe(1)
      expect(dist.find(g => g.grade === 'C')?.count).toBe(1)
      expect(dist.find(g => g.grade === 'D')).toBeUndefined()
    })
  })

  // ── Save ────────────────────────────────────────────────────────────

  describe('save', () => {
    it('calls onSave with depot id, note, and feedback', async () => {
      const batch = createBatch()
      batch.toggle()
      batch.setGrade('A')
      batch.pendingFeedback.value = 'Excellent'
      await batch.save()
      const activeId = batch.filteredList.value[0].id
      expect(onSave).toHaveBeenCalledWith(activeId, 'A', 'Excellent')
    })

    it('does not save when no active depot', async () => {
      const emptyDepots = ref<Depot[]>([])
      const batch = useBatchGrading({ depots: emptyDepots, onSave })
      batch.toggle()
      const result = await batch.save()
      expect(result).toBe(false)
      expect(onSave).not.toHaveBeenCalled()
    })

    it('sets savedFlash briefly after save', async () => {
      const batch = createBatch()
      batch.toggle()
      batch.setGrade('B')
      await batch.save()
      expect(batch.savedFlash.value).toBe(true)
    })

    it('prevents double save while saving', async () => {
      let resolveFirst: () => void
      const slowSave = vi.fn().mockImplementation(() => new Promise<void>(r => { resolveFirst = r }))
      const batch = useBatchGrading({ depots, onSave: slowSave })
      batch.toggle()
      batch.setGrade('A')
      const p1 = batch.save()
      const p2 = batch.save()
      expect(await p2).toBe(false)
      resolveFirst!()
      expect(await p1).toBe(true)
      expect(slowSave).toHaveBeenCalledTimes(1)
    })
  })

  // ── saveAndNext ─────────────────────────────────────────────────────

  describe('saveAndNext', () => {
    it('saves and advances to next student', async () => {
      const batch = createBatch()
      batch.toggle()
      batch.setGrade('A')
      await batch.saveAndNext()
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(batch.activeIndex.value).toBe(1)
    })
  })

  // ── Keyboard handler ────────────────────────────────────────────────

  describe('handleKeydown', () => {
    function makeEvent(key: string, opts: Partial<KeyboardEvent> = {}): KeyboardEvent {
      return { key, preventDefault: vi.fn(), target: { tagName: 'DIV' }, ...opts } as unknown as KeyboardEvent
    }

    it('Escape deactivates batch mode', () => {
      const batch = createBatch()
      batch.toggle()
      expect(batch.active.value).toBe(true)
      batch.handleKeydown(makeEvent('Escape'))
      expect(batch.active.value).toBe(false)
    })

    it('ArrowDown moves to next student', () => {
      const batch = createBatch()
      batch.toggle()
      batch.handleKeydown(makeEvent('ArrowDown'))
      expect(batch.activeIndex.value).toBe(1)
    })

    it('ArrowUp moves to previous student', () => {
      const batch = createBatch()
      batch.toggle()
      batch.selectIndex(2)
      batch.handleKeydown(makeEvent('ArrowUp'))
      expect(batch.activeIndex.value).toBe(1)
    })

    it('A/B/C/D keys set grade when not in textarea', () => {
      const batch = createBatch()
      batch.toggle()
      batch.handleKeydown(makeEvent('b'))
      expect(batch.pendingNote.value).toBe('B')
    })

    it('grade keys are ignored inside textarea', () => {
      const batch = createBatch()
      batch.toggle()
      batch.pendingNote.value = ''
      batch.handleKeydown(makeEvent('a', { target: { tagName: 'TEXTAREA' } } as any))
      expect(batch.pendingNote.value).toBe('')
    })

    it('does nothing when batch is inactive', () => {
      const batch = createBatch()
      const e = makeEvent('ArrowDown')
      batch.handleKeydown(e)
      expect(e.preventDefault).not.toHaveBeenCalled()
    })
  })
})
