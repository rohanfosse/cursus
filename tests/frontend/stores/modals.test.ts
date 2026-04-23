import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useModalsStore } from '@/stores/modals'

describe('modals store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('all modals are closed by default', () => {
    const s = useModalsStore()
    expect(s.depots).toBe(false)
    expect(s.suivi).toBe(false)
    expect(s.gestionDevoir).toBe(false)
    expect(s.ressources).toBe(false)
    expect(s.timeline).toBe(false)
    expect(s.echeancier).toBe(false)
    expect(s.settings).toBe(false)
    expect(s.documentPreview).toBe(false)
    expect(s.newDevoir).toBe(false)
    expect(s.createChannel).toBe(false)
    expect(s.cmdPalette).toBe(false)
    expect(s.impersonate).toBe(false)
    expect(s.newProject).toBe(false)
    expect(s.studentTimeline).toBe(false)
    expect(s.rubric).toBe(false)
    expect(s.importStudents).toBe(false)
    expect(s.intervenants).toBe(false)
    expect(s.classe).toBe(false)
    expect(s.createPromo).toBe(false)
    expect(s.signatureRequest).toBeNull()
    // Builders slash (v2.232+)
    expect(s.createPoll).toBe(false)
    expect(s.createTable).toBe(false)
    expect(s.createCode).toBe(false)
    expect(s.createAnnounce).toBe(false)
    expect(s.createChecklist).toBe(false)
    expect(s.createDate).toBe(false)
    expect(s.createMath).toBe(false)
    expect(s.help).toBe(false)
  })

  it('can open individual modals', () => {
    const s = useModalsStore()
    s.settings = true
    s.depots = true
    expect(s.settings).toBe(true)
    expect(s.depots).toBe(true)
    expect(s.suivi).toBe(false)
  })

  it('closeAll resets all modals to false/null', () => {
    const s = useModalsStore()
    s.settings = true
    s.depots = true
    s.cmdPalette = true
    s.signatureRequest = { id: 1 } as any
    s.closeAll()
    expect(s.settings).toBe(false)
    expect(s.depots).toBe(false)
    expect(s.cmdPalette).toBe(false)
    expect(s.signatureRequest).toBeNull()
  })

  it('closeAll does not leave any modal open', () => {
    const s = useModalsStore()
    // Open everything
    s.depots = true
    s.suivi = true
    s.gestionDevoir = true
    s.ressources = true
    s.timeline = true
    s.echeancier = true
    s.settings = true
    s.documentPreview = true
    s.newDevoir = true
    s.createChannel = true
    s.cmdPalette = true
    s.impersonate = true
    s.newProject = true
    s.studentTimeline = true
    s.rubric = true
    s.importStudents = true
    s.intervenants = true
    s.classe = true
    s.createPromo = true
    s.createPoll = true
    s.createTable = true
    s.createCode = true
    s.createAnnounce = true
    s.createChecklist = true
    s.createDate = true
    s.createMath = true
    s.help = true

    s.closeAll()

    const booleanFields = [
      'depots', 'suivi', 'gestionDevoir', 'ressources', 'timeline',
      'echeancier', 'settings', 'documentPreview', 'newDevoir',
      'createChannel', 'cmdPalette', 'impersonate', 'newProject',
      'studentTimeline', 'rubric', 'importStudents', 'intervenants',
      'classe', 'createPromo',
      'createPoll', 'createTable', 'createCode', 'createAnnounce',
      'createChecklist', 'createDate', 'createMath', 'help',
    ] as const
    for (const field of booleanFields) {
      expect(s[field], `${field} should be false`).toBe(false)
    }
  })
})
