/**
 * Tests unitaires pour la logique extraite de BookingFlow.vue (refonte Calendly v2.250.0).
 *
 * Le composant Vue lui-meme n'est pas monte ici : on reproduit les helpers purs
 * qui calculent la grille mensuelle, le mapping slots/jour, la validation du
 * formulaire, le mapping errorCode -> titre, et le formatage ISO. C'est la meme
 * approche que gestionDevoirModal.test.ts.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type {
  BookingFlowSlot,
  BookingFlowInfo,
} from '@/components/booking/bookingFlow.types'

// ── Helpers reproduisant la logique de BookingFlow.vue ────────────────────────

interface MonthCell {
  iso: string
  day: number
  inMonth: boolean
  hasSlots: boolean
  isPast: boolean
  isToday: boolean
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildSlotsByDate(slots: BookingFlowSlot[]): Record<string, BookingFlowSlot[]> {
  const m: Record<string, BookingFlowSlot[]> = {}
  for (const s of slots) (m[s.date] ??= []).push(s)
  return m
}

function buildMonthGrid(
  currentMonth: Date,
  slotsByDate: Record<string, BookingFlowSlot[]>,
  todayIso: string,
): MonthCell[] {
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const dayOfWeek = firstOfMonth.getDay()
  const offsetMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const start = new Date(year, month, 1 - offsetMonday)
  const cells: MonthCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const iso = toIso(d)
    cells.push({
      iso,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      hasSlots: !!slotsByDate[iso],
      isPast: iso < todayIso,
      isToday: iso === todayIso,
    })
  }
  return cells
}

function canGoPrev(currentMonth: Date, today: Date): boolean {
  return currentMonth > new Date(today.getFullYear(), today.getMonth(), 1)
}

interface CanSubmitInputs {
  formName: string
  formEmail: string
  formTutorName: string
  formTutorEmail: string
  captchaToken: string
  requireTutor: boolean
  captchaEnabled: boolean
}

function canSubmit(i: CanSubmitInputs): boolean {
  if (!i.formName.trim() || !i.formEmail.trim()) return false
  if (i.requireTutor && (!i.formTutorName.trim() || !i.formTutorEmail.trim())) return false
  if (i.captchaEnabled && !i.captchaToken) return false
  return true
}

function errorTitle(code?: string): string {
  switch (code) {
    case 'closed':         return 'Reservations fermees'
    case 'inactive':       return 'Type de RDV indisponible'
    case 'not_found':      return 'Lien introuvable'
    case 'already_booked': return 'Tu as deja reserve'
    case 'invalid_link':   return 'Lien invalide'
    default:               return 'Lien invalide'
  }
}

function firstAvailableIso(grid: MonthCell[]): string | null {
  const f = grid.find((c) => c.inMonth && c.hasSlots && !c.isPast)
  return f ? f.iso : null
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSlot(iso: string, hour: number, durMin = 30): BookingFlowSlot {
  const start = `${iso}T${String(hour).padStart(2, '0')}:00:00`
  const endDate = new Date(`${iso}T${String(hour).padStart(2, '0')}:00:00`)
  endDate.setMinutes(endDate.getMinutes() + durMin)
  const endIso = `${iso}T${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:00`
  return { start, end: endIso, date: iso, time: `${String(hour).padStart(2, '0')}:00` }
}

const baseInfo: BookingFlowInfo = {
  title: 'Suivi memoire',
  description: 'Point de suivi 30 min',
  durationMinutes: 30,
  color: '#3b82f6',
  hostName: 'Jean Dupont',
  attendeeName: null,
  attendeeEmail: null,
  withTutor: false,
}

// ── Tests : toIso ────────────────────────────────────────────────────────────

describe('toIso', () => {
  it('formate une date locale en YYYY-MM-DD', () => {
    expect(toIso(new Date(2026, 3, 27))).toBe('2026-04-27')
    expect(toIso(new Date(2026, 0, 1))).toBe('2026-01-01')
    expect(toIso(new Date(2026, 11, 31))).toBe('2026-12-31')
  })

  it('zero-pad mois et jour < 10', () => {
    expect(toIso(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toIso(new Date(2026, 8, 9))).toBe('2026-09-09')
  })
})

// ── Tests : buildSlotsByDate ─────────────────────────────────────────────────

describe('buildSlotsByDate', () => {
  it('groupe les slots par date', () => {
    const slots = [
      makeSlot('2026-04-27', 9),
      makeSlot('2026-04-27', 10),
      makeSlot('2026-04-28', 14),
    ]
    const map = buildSlotsByDate(slots)
    expect(Object.keys(map).sort()).toEqual(['2026-04-27', '2026-04-28'])
    expect(map['2026-04-27']).toHaveLength(2)
    expect(map['2026-04-28']).toHaveLength(1)
  })

  it('retourne objet vide pour liste vide', () => {
    expect(buildSlotsByDate([])).toEqual({})
  })

  it('preserve l\'ordre d\'insertion des slots d\'un meme jour', () => {
    const map = buildSlotsByDate([
      makeSlot('2026-04-27', 14),
      makeSlot('2026-04-27', 9),
      makeSlot('2026-04-27', 11),
    ])
    expect(map['2026-04-27'].map((s) => s.time)).toEqual(['14:00', '09:00', '11:00'])
  })
})

// ── Tests : buildMonthGrid ───────────────────────────────────────────────────

describe('buildMonthGrid', () => {
  it('produit toujours 42 cellules (6 semaines x 7 jours)', () => {
    const grid = buildMonthGrid(new Date(2026, 3, 1), {}, '2026-04-27')
    expect(grid).toHaveLength(42)
  })

  it('commence par un lundi', () => {
    // Avril 2026 : 1er = mercredi. La grille doit demarrer le lundi 30 mars.
    const grid = buildMonthGrid(new Date(2026, 3, 1), {}, '2026-04-27')
    expect(grid[0].iso).toBe('2026-03-30')
    const firstWeekday = new Date(grid[0].iso).getDay() // 0=dim, 1=lun
    expect(firstWeekday).toBe(1)
  })

  it('gere correctement un mois qui commence un dimanche', () => {
    // Mars 2026 : 1er = dimanche. Le lundi precedent est 23 fevrier.
    const grid = buildMonthGrid(new Date(2026, 2, 1), {}, '2026-04-27')
    expect(grid[0].iso).toBe('2026-02-23')
  })

  it('gere correctement un mois qui commence un lundi', () => {
    // Juin 2026 : 1er = lundi. La grille demarre le 1er juin lui-meme.
    const grid = buildMonthGrid(new Date(2026, 5, 1), {}, '2026-04-27')
    expect(grid[0].iso).toBe('2026-06-01')
    expect(grid[0].inMonth).toBe(true)
  })

  it('marque inMonth=true pour les jours du mois courant uniquement', () => {
    const grid = buildMonthGrid(new Date(2026, 3, 1), {}, '2026-04-27')
    const inMonthCells = grid.filter((c) => c.inMonth)
    expect(inMonthCells).toHaveLength(30) // avril 2026 = 30 jours
    expect(inMonthCells[0].iso).toBe('2026-04-01')
    expect(inMonthCells[inMonthCells.length - 1].iso).toBe('2026-04-30')
  })

  it('marque hasSlots=true uniquement si le jour a des slots', () => {
    const slotsByDate = buildSlotsByDate([
      makeSlot('2026-04-27', 9),
      makeSlot('2026-04-30', 14),
    ])
    const grid = buildMonthGrid(new Date(2026, 3, 1), slotsByDate, '2026-04-27')
    const withSlots = grid.filter((c) => c.hasSlots)
    expect(withSlots.map((c) => c.iso)).toEqual(['2026-04-27', '2026-04-30'])
  })

  it('marque isPast=true pour les jours strictement anterieurs a today', () => {
    const grid = buildMonthGrid(new Date(2026, 3, 1), {}, '2026-04-27')
    const past = grid.filter((c) => c.isPast)
    expect(past.every((c) => c.iso < '2026-04-27')).toBe(true)
    const today = grid.find((c) => c.iso === '2026-04-27')
    expect(today?.isPast).toBe(false)
  })

  it('marque isToday=true uniquement pour la cellule du jour', () => {
    const grid = buildMonthGrid(new Date(2026, 3, 1), {}, '2026-04-27')
    const todays = grid.filter((c) => c.isToday)
    expect(todays).toHaveLength(1)
    expect(todays[0].iso).toBe('2026-04-27')
  })
})

// ── Tests : firstAvailableIso ────────────────────────────────────────────────

describe('firstAvailableIso', () => {
  it('retourne le premier jour du mois courant qui a des slots et n\'est pas passe', () => {
    const slotsByDate = buildSlotsByDate([
      makeSlot('2026-04-15', 9), // passe
      makeSlot('2026-04-28', 9),
      makeSlot('2026-04-30', 14),
    ])
    const grid = buildMonthGrid(new Date(2026, 3, 1), slotsByDate, '2026-04-27')
    expect(firstAvailableIso(grid)).toBe('2026-04-28')
  })

  it('retourne null si aucun slot dispo dans le mois', () => {
    const grid = buildMonthGrid(new Date(2026, 3, 1), {}, '2026-04-27')
    expect(firstAvailableIso(grid)).toBeNull()
  })

  it('ignore les slots du mois precedent visibles dans la grille', () => {
    // Le 30 mars 2026 (lundi) est dans la grille d'avril (1ere cellule) mais hors mois.
    const slotsByDate = buildSlotsByDate([makeSlot('2026-03-30', 9)])
    const grid = buildMonthGrid(new Date(2026, 3, 1), slotsByDate, '2026-04-27')
    // Le 30 mars a hasSlots=true mais inMonth=false, donc ignore.
    expect(firstAvailableIso(grid)).toBeNull()
  })
})

// ── Tests : canGoPrev ────────────────────────────────────────────────────────

describe('canGoPrev', () => {
  it('false si on est sur le mois courant', () => {
    const today = new Date(2026, 3, 27)
    const currentMonth = new Date(2026, 3, 1)
    expect(canGoPrev(currentMonth, today)).toBe(false)
  })

  it('true si on est sur un mois futur', () => {
    const today = new Date(2026, 3, 27)
    const currentMonth = new Date(2026, 4, 1) // mai
    expect(canGoPrev(currentMonth, today)).toBe(true)
  })

  it('false si on est sur un mois passe (ne devrait pas arriver mais coherent)', () => {
    const today = new Date(2026, 3, 27)
    const currentMonth = new Date(2026, 2, 1) // mars
    expect(canGoPrev(currentMonth, today)).toBe(false)
  })
})

// ── Tests : canSubmit ────────────────────────────────────────────────────────

describe('canSubmit', () => {
  const validBase: CanSubmitInputs = {
    formName: 'Alice Martin',
    formEmail: 'alice@exemple.fr',
    formTutorName: '',
    formTutorEmail: '',
    captchaToken: '',
    requireTutor: false,
    captchaEnabled: false,
  }

  it('true quand nom + email remplis et pas de tuteur ni captcha', () => {
    expect(canSubmit(validBase)).toBe(true)
  })

  it('false si nom vide ou que des espaces', () => {
    expect(canSubmit({ ...validBase, formName: '' })).toBe(false)
    expect(canSubmit({ ...validBase, formName: '   ' })).toBe(false)
  })

  it('false si email vide ou que des espaces', () => {
    expect(canSubmit({ ...validBase, formEmail: '' })).toBe(false)
    expect(canSubmit({ ...validBase, formEmail: '   ' })).toBe(false)
  })

  it('exige les champs tuteur quand requireTutor=true', () => {
    expect(canSubmit({ ...validBase, requireTutor: true })).toBe(false)
    expect(canSubmit({ ...validBase, requireTutor: true, formTutorName: 'Bob' })).toBe(false)
    expect(canSubmit({
      ...validBase,
      requireTutor: true,
      formTutorName: 'Bob',
      formTutorEmail: 'bob@entreprise.fr',
    })).toBe(true)
  })

  it('exige le captcha quand captchaEnabled=true', () => {
    expect(canSubmit({ ...validBase, captchaEnabled: true })).toBe(false)
    expect(canSubmit({ ...validBase, captchaEnabled: true, captchaToken: 'tok_abc' })).toBe(true)
  })

  it('combine toutes les contraintes (tuteur + captcha)', () => {
    expect(canSubmit({
      ...validBase,
      requireTutor: true,
      formTutorName: 'Bob',
      formTutorEmail: 'bob@entreprise.fr',
      captchaEnabled: true,
      captchaToken: 'tok_abc',
    })).toBe(true)
    expect(canSubmit({
      ...validBase,
      requireTutor: true,
      formTutorName: 'Bob',
      formTutorEmail: 'bob@entreprise.fr',
      captchaEnabled: true,
      captchaToken: '', // captcha manquant
    })).toBe(false)
  })
})

// ── Tests : errorTitle ───────────────────────────────────────────────────────

describe('errorTitle', () => {
  it('mappe les codes d\'erreur connus', () => {
    expect(errorTitle('closed')).toBe('Reservations fermees')
    expect(errorTitle('inactive')).toBe('Type de RDV indisponible')
    expect(errorTitle('not_found')).toBe('Lien introuvable')
    expect(errorTitle('already_booked')).toBe('Tu as deja reserve')
    expect(errorTitle('invalid_link')).toBe('Lien invalide')
  })

  it('fallback sur "Lien invalide" pour code inconnu ou absent', () => {
    expect(errorTitle()).toBe('Lien invalide')
    expect(errorTitle('')).toBe('Lien invalide')
    expect(errorTitle('weird_unknown_code')).toBe('Lien invalide')
  })
})

// ── Tests : selection automatique de la 1ere date dispo (logique watch) ───────

describe('auto-selection de la premiere date dispo', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-27T08:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('selectionne le 1er jour dispo quand aucune date n\'est selectionnee', () => {
    const slots = [makeSlot('2026-04-29', 10), makeSlot('2026-04-30', 14)]
    const slotsByDate = buildSlotsByDate(slots)
    const grid = buildMonthGrid(new Date(2026, 3, 1), slotsByDate, '2026-04-27')

    const selectedDate = ''
    // Si la date selectionnee est vide ou n'a plus de slots, on prend la 1ere dispo
    const newSelection =
      selectedDate && slotsByDate[selectedDate]
        ? selectedDate
        : firstAvailableIso(grid)

    expect(newSelection).toBe('2026-04-29')
  })

  it('garde la date deja selectionnee si elle a toujours des slots', () => {
    const slotsByDate = buildSlotsByDate([
      makeSlot('2026-04-29', 10),
      makeSlot('2026-04-30', 14),
    ])
    const grid = buildMonthGrid(new Date(2026, 3, 1), slotsByDate, '2026-04-27')

    const selectedDate = '2026-04-30'
    const newSelection =
      selectedDate && slotsByDate[selectedDate]
        ? selectedDate
        : firstAvailableIso(grid)

    expect(newSelection).toBe('2026-04-30')
  })

  it('reselectionne quand la date precedente n\'a plus de slots', () => {
    const slotsByDate = buildSlotsByDate([makeSlot('2026-04-30', 14)])
    const grid = buildMonthGrid(new Date(2026, 3, 1), slotsByDate, '2026-04-27')

    const selectedDate = '2026-04-29' // n'a plus de slots
    const newSelection =
      selectedDate && slotsByDate[selectedDate]
        ? selectedDate
        : firstAvailableIso(grid)

    expect(newSelection).toBe('2026-04-30')
  })
})

// ── Tests : pre-remplissage email/nom (props.info) ───────────────────────────

describe('pre-remplissage du formulaire depuis info', () => {
  it('pre-remplit nom et email quand info les fournit (mode token nominatif)', () => {
    const info: BookingFlowInfo = {
      ...baseInfo,
      attendeeName: 'Alice Martin',
      attendeeEmail: 'alice@exemple.fr',
    }
    let formName = ''
    let formEmail = ''
    if (info?.attendeeName) formName = info.attendeeName
    if (info?.attendeeEmail) formEmail = info.attendeeEmail
    expect(formName).toBe('Alice Martin')
    expect(formEmail).toBe('alice@exemple.fr')
  })

  it('laisse les champs vides en mode public ouvert (pas d\'attendee)', () => {
    let formName = ''
    let formEmail = ''
    if (baseInfo.attendeeName) formName = baseInfo.attendeeName
    if (baseInfo.attendeeEmail) formEmail = baseInfo.attendeeEmail
    expect(formName).toBe('')
    expect(formEmail).toBe('')
  })
})
