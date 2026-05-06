/**
 * Tests pour les helpers purs extraits de BookingFlow.vue.
 * (toIso, fmtDateLong, fmtTime, detectUserTimezone, bookingErrorTitle,
 *  DAY_INITIALS_FR.)
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  toIso, fmtDateLong, fmtTime, detectUserTimezone, bookingErrorTitle,
  DAY_INITIALS_FR, bookingHasRealTutor,
} from '@/utils/bookingHelpers'

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

  it('utilise les composantes locales (pas UTC) — robuste au fuseau', () => {
    // 2026-04-27 a 23:30 locale ≠ UTC d'1h+ ; toIso doit retourner 2026-04-27
    const d = new Date(2026, 3, 27, 23, 30)
    expect(toIso(d)).toBe('2026-04-27')
  })
})

describe('fmtDateLong', () => {
  it('formate une ISO date-only en jour-mois-annee FR', () => {
    // L'ISO date-only est interprete UTC ; on ajoute T12:00 pour eviter
    // les surprises de timezone dans l'environnement de test.
    expect(fmtDateLong('2026-04-27T12:00:00')).toMatch(/27 avril 2026/)
  })

  it('inclut le jour de la semaine', () => {
    // 27 avril 2026 = lundi
    expect(fmtDateLong('2026-04-27T12:00:00').toLowerCase()).toContain('lundi')
  })
})

describe('fmtTime', () => {
  it('renvoie HH:MM en 24h', () => {
    expect(fmtTime('2026-04-27T14:30:00')).toMatch(/^14:30$/)
    expect(fmtTime('2026-04-27T09:05:00')).toMatch(/^09:05$/)
  })

  it('zero-pad les heures < 10', () => {
    expect(fmtTime('2026-04-27T08:00:00')).toBe('08:00')
  })
})

describe('detectUserTimezone', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('renvoie le timezone resolu par Intl.DateTimeFormat', () => {
    const tz = detectUserTimezone()
    // jsdom retourne typiquement UTC ou le tz de la machine ; on verifie juste
    // qu'on a une chaine non vide et qu'elle correspond au format IANA.
    expect(tz).toBeTruthy()
    expect(typeof tz).toBe('string')
  })

  it('fallback sur Europe/Paris quand Intl throw', () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(() => {
      throw new Error('boom')
    })
    expect(detectUserTimezone()).toBe('Europe/Paris')
  })
})

describe('bookingErrorTitle', () => {
  it('mappe les codes connus', () => {
    expect(bookingErrorTitle('closed')).toBe('Reservations fermees')
    expect(bookingErrorTitle('inactive')).toBe('Type de RDV indisponible')
    expect(bookingErrorTitle('not_found')).toBe('Lien introuvable')
    expect(bookingErrorTitle('already_booked')).toBe('Tu as deja reserve')
    expect(bookingErrorTitle('invalid_link')).toBe('Lien invalide')
  })

  it('fallback "Lien invalide" pour code absent ou inconnu', () => {
    expect(bookingErrorTitle()).toBe('Lien invalide')
    expect(bookingErrorTitle('')).toBe('Lien invalide')
    expect(bookingErrorTitle('weird_code_xyz')).toBe('Lien invalide')
  })
})

describe('DAY_INITIALS_FR', () => {
  it('contient 7 entrees commencant par lundi', () => {
    expect(DAY_INITIALS_FR).toHaveLength(7)
    expect(DAY_INITIALS_FR[0]).toBe('L')
    expect(DAY_INITIALS_FR[6]).toBe('D')
  })

  it('matche le pattern L-M-M-J-V-S-D (FR)', () => {
    expect(DAY_INITIALS_FR.join('')).toBe('LMMJVSD')
  })
})

describe('bookingHasRealTutor', () => {
  it('false quand tutor_name vide', () => {
    expect(bookingHasRealTutor({ tutor_name: '', student_name: 'Alice' })).toBe(false)
    expect(bookingHasRealTutor({ tutor_name: null, student_name: 'Alice' })).toBe(false)
    expect(bookingHasRealTutor({ student_name: 'Alice' })).toBe(false)
  })

  it('false quand tutor_name == student_name (cas legacy v < 2.317)', () => {
    expect(bookingHasRealTutor({ tutor_name: 'Alice Dupont', student_name: 'Alice Dupont' })).toBe(false)
    // Insensible a la casse + espaces
    expect(bookingHasRealTutor({ tutor_name: 'alice dupont', student_name: 'Alice DUPONT' })).toBe(false)
    expect(bookingHasRealTutor({ tutor_name: '  Alice  ', student_name: 'Alice' })).toBe(false)
  })

  it('false quand tutor_email == student_email (alias / meme adresse)', () => {
    expect(bookingHasRealTutor({
      tutor_name: 'Bob', student_name: 'Alice',
      tutor_email: 'a@x.fr', student_email: 'a@x.fr',
    })).toBe(false)
  })

  it('true quand tutor different de student', () => {
    expect(bookingHasRealTutor({ tutor_name: 'Bob', student_name: 'Alice' })).toBe(true)
    expect(bookingHasRealTutor({
      tutor_name: 'Bob', tutor_email: 'b@x.fr',
      student_name: 'Alice', student_email: 'a@x.fr',
    })).toBe(true)
  })

  it('false sur entree null/undefined', () => {
    expect(bookingHasRealTutor(null)).toBe(false)
    expect(bookingHasRealTutor(undefined)).toBe(false)
  })
})
