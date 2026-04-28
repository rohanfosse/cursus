/**
 * Tests du scheduler de soutenances (utils/optimization/scheduler.ts).
 *
 * Verifie le placement de soutenances avec contraintes (jurys, salles,
 * preferences, conflits) et la generation de slots.
 */
import { describe, it, expect } from 'vitest'
import {
  scheduleSoutenances,
  generateSlots,
  type Soutenance,
  type Jury,
  type Room,
  type TimeSlot,
} from '@/utils/optimization/scheduler'

function mkSlots(n: number): TimeSlot[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `slot-${i}`,
    start: `2026-01-01T${String(9 + i).padStart(2, '0')}:00:00Z`,
    end:   `2026-01-01T${String(9 + i).padStart(2, '0')}:30:00Z`,
    label: `Slot ${i}`,
  }))
}

describe('scheduleSoutenances: cas de base', () => {
  it('place 1 soutenance avec 2 jurys disponibles', () => {
    const slots = mkSlots(3)
    const jurys: Jury[] = [
      { id: 1, name: 'A', availableSlotIds: ['slot-0', 'slot-1', 'slot-2'] },
      { id: 2, name: 'B', availableSlotIds: ['slot-0', 'slot-1', 'slot-2'] },
    ]
    const rooms: Room[] = [{ id: 1, name: 'B204', availableSlotIds: ['slot-0', 'slot-1', 'slot-2'] }]
    const soutenances: Soutenance[] = [{ id: 100, candidate: 'Emma' }]

    const r = scheduleSoutenances(soutenances, jurys, rooms, slots)
    expect(r.assignments).toHaveLength(1)
    expect(r.unscheduled).toHaveLength(0)
    expect(r.assignments[0].juryIds).toHaveLength(2)
    expect(r.assignments[0].roomId).toBe(1)
  })

  it('place 3 soutenances sur 3 slots avec 2 jurys (jurys reutilises)', () => {
    const slots = mkSlots(3)
    const jurys: Jury[] = [
      { id: 1, name: 'A', availableSlotIds: ['slot-0', 'slot-1', 'slot-2'] },
      { id: 2, name: 'B', availableSlotIds: ['slot-0', 'slot-1', 'slot-2'] },
    ]
    const rooms: Room[] = [{ id: 1, name: 'B204', availableSlotIds: ['slot-0', 'slot-1', 'slot-2'] }]
    const soutenances: Soutenance[] = [
      { id: 1, candidate: 'Emma' },
      { id: 2, candidate: 'Lucas' },
      { id: 3, candidate: 'Sara' },
    ]
    const r = scheduleSoutenances(soutenances, jurys, rooms, slots)
    expect(r.assignments).toHaveLength(3)
    expect(r.unscheduled).toHaveLength(0)
    // Chaque slot utilise 1 fois (pas de double booking)
    const usedSlots = r.assignments.map(a => a.slotId)
    expect(new Set(usedSlots).size).toBe(3)
  })

  it('respecte les forbidden slots d un etudiant', () => {
    const slots = mkSlots(3)
    const jurys: Jury[] = [
      { id: 1, name: 'A', availableSlotIds: ['slot-0', 'slot-1', 'slot-2'] },
      { id: 2, name: 'B', availableSlotIds: ['slot-0', 'slot-1', 'slot-2'] },
    ]
    const rooms: Room[] = [{ id: 1, name: 'B204', availableSlotIds: ['slot-0', 'slot-1', 'slot-2'] }]
    const soutenances: Soutenance[] = [
      { id: 1, candidate: 'Emma', forbiddenSlotIds: ['slot-0', 'slot-1'] },
    ]
    const r = scheduleSoutenances(soutenances, jurys, rooms, slots)
    expect(r.assignments).toHaveLength(1)
    expect(r.assignments[0].slotId).toBe('slot-2')
  })

  it('respecte les preferred jurys', () => {
    const slots = mkSlots(2)
    const jurys: Jury[] = [
      { id: 1, name: 'Lemaire', availableSlotIds: ['slot-0', 'slot-1'] },
      { id: 2, name: 'Dupont',  availableSlotIds: ['slot-0', 'slot-1'] },
      { id: 3, name: 'Martin',  availableSlotIds: ['slot-0', 'slot-1'] },
    ]
    const rooms: Room[] = [{ id: 1, name: 'B204', availableSlotIds: ['slot-0', 'slot-1'] }]
    const soutenances: Soutenance[] = [
      { id: 1, candidate: 'Emma', preferredJuryIds: [1, 2] }, // doit avoir Lemaire+Dupont
    ]
    const r = scheduleSoutenances(soutenances, jurys, rooms, slots)
    expect(r.assignments).toHaveLength(1)
    expect(r.assignments[0].juryIds.sort()).toEqual([1, 2])
  })

  it('si infaisable et allowPartial, marque les non-places', () => {
    const slots = mkSlots(1) // 1 seul slot
    const jurys: Jury[] = [
      { id: 1, name: 'A', availableSlotIds: ['slot-0'] },
      { id: 2, name: 'B', availableSlotIds: ['slot-0'] },
    ]
    const rooms: Room[] = [{ id: 1, name: 'B204', availableSlotIds: ['slot-0'] }]
    const soutenances: Soutenance[] = [
      { id: 1, candidate: 'Emma' },
      { id: 2, candidate: 'Lucas' }, // pas de slot dispo apres Emma
    ]
    const r = scheduleSoutenances(soutenances, jurys, rooms, slots, { allowPartial: true })
    expect(r.assignments).toHaveLength(1)
    expect(r.unscheduled).toHaveLength(1)
  })

  it('ne place pas si moins de jurySize jurys dispo', () => {
    const slots = mkSlots(1)
    const jurys: Jury[] = [
      { id: 1, name: 'A', availableSlotIds: ['slot-0'] }, // 1 seul jury
    ]
    const rooms: Room[] = [{ id: 1, name: 'B204', availableSlotIds: ['slot-0'] }]
    const soutenances: Soutenance[] = [{ id: 1, candidate: 'Emma' }]
    const r = scheduleSoutenances(soutenances, jurys, rooms, slots, { jurySize: 2 })
    expect(r.assignments).toHaveLength(0)
    expect(r.unscheduled).toHaveLength(1)
  })

  it('priorise les jurys de moindre cout', () => {
    const slots = mkSlots(1)
    const jurys: Jury[] = [
      { id: 1, name: 'Cher',  availableSlotIds: ['slot-0'], cost: 10 },
      { id: 2, name: 'Bon',   availableSlotIds: ['slot-0'], cost: 0 },
      { id: 3, name: 'Moyen', availableSlotIds: ['slot-0'], cost: 5 },
    ]
    const rooms: Room[] = [{ id: 1, name: 'B204', availableSlotIds: ['slot-0'] }]
    const soutenances: Soutenance[] = [{ id: 1, candidate: 'Emma' }]
    const r = scheduleSoutenances(soutenances, jurys, rooms, slots)
    // Doit choisir les 2 moins chers : 2 et 3
    expect(r.assignments[0].juryIds.sort()).toEqual([2, 3])
    expect(r.stats.totalCost).toBe(5)
  })
})

describe('scheduleSoutenances: stats', () => {
  it('compte slots utilises et jurys mobilises', () => {
    const slots = mkSlots(3)
    const jurys: Jury[] = [
      { id: 1, name: 'A', availableSlotIds: ['slot-0', 'slot-1', 'slot-2'] },
      { id: 2, name: 'B', availableSlotIds: ['slot-0', 'slot-1', 'slot-2'] },
    ]
    const rooms: Room[] = [{ id: 1, name: 'B204', availableSlotIds: ['slot-0', 'slot-1', 'slot-2'] }]
    const soutenances: Soutenance[] = [
      { id: 1, candidate: 'A' }, { id: 2, candidate: 'B' },
    ]
    const r = scheduleSoutenances(soutenances, jurys, rooms, slots)
    expect(r.stats.totalSlotsUsed).toBe(2)
    expect(r.stats.totalJurysUsed).toBe(2)
    expect(r.stats.slotEfficiency).toBeCloseTo(2 / 3, 2)
  })
})

describe('generateSlots', () => {
  // Note: le generator travaille en local time (l'ecole planifie en local).
  // Les tests utilisent `new Date(year, month, day, hour)` pour rester
  // independant du fuseau horaire de la machine de test.
  it('genere les slots de 9h a 12h en sautant le weekend', () => {
    const start = new Date(2026, 0, 5, 8, 0, 0) // lundi 8h local
    const end   = new Date(2026, 0, 5, 13, 0, 0)
    const slots = generateSlots(start, end, 30, { skipLunch: false, dayStart: 9, dayEnd: 12 })
    expect(slots.length).toBe(6) // 9h, 9h30, 10h, 10h30, 11h, 11h30
    expect(new Date(slots[0].start).getHours()).toBe(9)
  })

  it('saute le creneau dejeuner 12-13h', () => {
    const start = new Date(2026, 0, 5, 11, 0, 0)
    const end   = new Date(2026, 0, 5, 15, 0, 0)
    const slots = generateSlots(start, end, 60, { skipLunch: true, dayStart: 11, dayEnd: 15 })
    // Slots possibles : 11h, 13h, 14h (12h saute)
    const hours = slots.map(s => new Date(s.start).getHours())
    expect(hours).not.toContain(12)
  })

  it('saute le weekend par defaut', () => {
    const start = new Date(2026, 0, 9, 9, 0, 0)  // vendredi 9h local
    const end   = new Date(2026, 0, 13, 12, 0, 0) // mardi 12h local
    const slots = generateSlots(start, end, 60, { skipLunch: false })
    // On doit passer du vendredi a lundi sans samedi/dimanche
    const days = new Set(slots.map(s => new Date(s.start).getDay()))
    expect(days.has(0)).toBe(false) // pas de dimanche
    expect(days.has(6)).toBe(false) // pas de samedi
  })
})
