/**
 * Tests pour useWidgetPresets — presets de layout pour dashboards.
 */
import { describe, it, expect } from 'vitest'
import {
  STUDENT_PRESETS,
  TEACHER_PRESETS,
  type LayoutPreset,
} from '@/composables/useWidgetPresets'

function validatePreset(preset: LayoutPreset) {
  expect(preset.id).toBeDefined()
  expect(typeof preset.id).toBe('string')
  expect(preset.label).toBeDefined()
  expect(typeof preset.label).toBe('string')
  expect(preset.description).toBeDefined()
  expect(typeof preset.description).toBe('string')
  expect(preset.config).toBeDefined()
  expect(Array.isArray(preset.config.order)).toBe(true)
  expect(Array.isArray(preset.config.hidden)).toBe(true)
  expect(typeof preset.config.sizes).toBe('object')
  expect(preset.config.preset).toBe(preset.id)
}

describe('useWidgetPresets', () => {
  // ── STUDENT_PRESETS ─────────────────────────────────────────────────────
  describe('STUDENT_PRESETS', () => {
    it('exports 3 student presets', () => {
      expect(STUDENT_PRESETS.length).toBe(3)
    })

    it('each student preset has valid structure', () => {
      for (const preset of STUDENT_PRESETS) {
        validatePreset(preset)
      }
    })

    it('has essentiel, complet, and focus presets', () => {
      const ids = STUDENT_PRESETS.map(p => p.id)
      expect(ids).toContain('essentiel')
      expect(ids).toContain('complet')
      expect(ids).toContain('focus')
    })

    it('essentiel preset has order and hidden arrays', () => {
      const essentiel = STUDENT_PRESETS.find(p => p.id === 'essentiel')!
      expect(essentiel.config.order.length).toBeGreaterThan(0)
      expect(essentiel.config.hidden.length).toBeGreaterThan(0)
    })

    it('complet preset shows more widgets than essentiel', () => {
      const essentiel = STUDENT_PRESETS.find(p => p.id === 'essentiel')!
      const complet = STUDENT_PRESETS.find(p => p.id === 'complet')!
      expect(complet.config.order.length).toBeGreaterThanOrEqual(essentiel.config.order.length)
    })

    it('focus preset hides more widgets than essentiel', () => {
      const essentiel = STUDENT_PRESETS.find(p => p.id === 'essentiel')!
      const focus = STUDENT_PRESETS.find(p => p.id === 'focus')!
      expect(focus.config.hidden.length).toBeGreaterThanOrEqual(essentiel.config.hidden.length)
    })

    it('order and hidden do not overlap in any preset', () => {
      for (const preset of STUDENT_PRESETS) {
        const overlap = preset.config.order.filter(id => preset.config.hidden.includes(id))
        expect(overlap).toEqual([])
      }
    })

    it('sizes only reference widgets in order', () => {
      for (const preset of STUDENT_PRESETS) {
        const sizedIds = Object.keys(preset.config.sizes)
        for (const id of sizedIds) {
          expect(preset.config.order).toContain(id)
        }
      }
    })

    it('all sizes are valid WidgetSize values', () => {
      const validSizes = ['1x1', '2x1', '2x2', '4x1']
      for (const preset of STUDENT_PRESETS) {
        for (const size of Object.values(preset.config.sizes)) {
          expect(validSizes).toContain(size)
        }
      }
    })
  })

  // ── TEACHER_PRESETS ─────────────────────────────────────────────────────
  describe('TEACHER_PRESETS', () => {
    it('exports 3 teacher presets', () => {
      expect(TEACHER_PRESETS.length).toBe(3)
    })

    it('each teacher preset has valid structure', () => {
      for (const preset of TEACHER_PRESETS) {
        validatePreset(preset)
      }
    })

    it('has overview, communication, and tracking presets', () => {
      const ids = TEACHER_PRESETS.map(p => p.id)
      expect(ids).toContain('overview')
      expect(ids).toContain('communication')
      expect(ids).toContain('tracking')
    })

    it('order and hidden do not overlap in any preset', () => {
      for (const preset of TEACHER_PRESETS) {
        const overlap = preset.config.order.filter(id => preset.config.hidden.includes(id))
        expect(overlap).toEqual([])
      }
    })

    it('sizes only reference widgets in order', () => {
      for (const preset of TEACHER_PRESETS) {
        const sizedIds = Object.keys(preset.config.sizes)
        for (const id of sizedIds) {
          expect(preset.config.order).toContain(id)
        }
      }
    })

    it('all sizes are valid WidgetSize values', () => {
      const validSizes = ['1x1', '2x1', '2x2', '4x1']
      for (const preset of TEACHER_PRESETS) {
        for (const size of Object.values(preset.config.sizes)) {
          expect(validSizes).toContain(size)
        }
      }
    })

    it('overview preset includes focus tile in order', () => {
      const overview = TEACHER_PRESETS.find(p => p.id === 'overview')!
      expect(overview.config.order).toContain('focus')
    })

    it('communication preset prioritizes messages', () => {
      const comm = TEACHER_PRESETS.find(p => p.id === 'communication')!
      expect(comm.config.order[0]).toBe('messages')
    })

    it('tracking preset includes todo in large size', () => {
      const tracking = TEACHER_PRESETS.find(p => p.id === 'tracking')!
      expect(tracking.config.sizes['todo']).toBe('2x2')
    })
  })

  // ── Cross-preset uniqueness ─────────────────────────────────────────────
  it('all student preset ids are unique', () => {
    const ids = STUDENT_PRESETS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('all teacher preset ids are unique', () => {
    const ids = TEACHER_PRESETS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
