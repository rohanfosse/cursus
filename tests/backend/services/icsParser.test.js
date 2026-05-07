/**
 * Tests du parser ICS minimaliste utilise pour les abonnements de calendrier
 * Outlook publies par promo. Couverture : VEVENT timed, all-day, line folding,
 * escaping, DTEND manquant, plusieurs events, edge cases.
 */
import { describe, it, expect } from 'vitest'
import { parseIcs, parseIcsDate, unfoldLines } from '../../../server/services/icsParser.js'

describe('icsParser', () => {
  describe('unfoldLines', () => {
    it('joins continuation lines starting with space or tab (RFC 5545)', () => {
      const text = 'SUMMARY:Long subject\n  continuation\n\tand more\nLOCATION:Paris'
      const lines = unfoldLines(text)
      // RFC 5545 unfolding strips ONE leading whitespace char (the fold marker),
      // then concatenates. The space/tab itself is consumed, the rest is glued.
      expect(lines).toEqual(['SUMMARY:Long subject continuationand more', 'LOCATION:Paris'])
    })

    it('handles CRLF line endings', () => {
      const text = 'A\r\nB\r\nC'
      expect(unfoldLines(text)).toEqual(['A', 'B', 'C'])
    })
  })

  describe('parseIcsDate', () => {
    it('parses all-day date (YYYYMMDD with VALUE=DATE param)', () => {
      expect(parseIcsDate('20260415', { VALUE: 'DATE' }))
        .toEqual({ iso: '2026-04-15', isAllDay: true })
    })

    it('detects all-day from format alone (no param needed)', () => {
      expect(parseIcsDate('20260415', {}))
        .toEqual({ iso: '2026-04-15', isAllDay: true })
    })

    it('parses UTC datetime (Z suffix)', () => {
      expect(parseIcsDate('20260415T093000Z', {}))
        .toEqual({ iso: '2026-04-15T09:30:00Z', isAllDay: false })
    })

    it('parses naive datetime (no Z)', () => {
      expect(parseIcsDate('20260415T093000', { TZID: 'Europe/Paris' }))
        .toEqual({ iso: '2026-04-15T09:30:00', isAllDay: false })
    })

    it('returns null for malformed date', () => {
      expect(parseIcsDate('not-a-date', {})).toBeNull()
    })
  })

  describe('parseIcs', () => {
    it('returns empty array for empty input', () => {
      expect(parseIcs('')).toEqual([])
      expect(parseIcs(null)).toEqual([])
    })

    it('parses a single timed VEVENT', () => {
      const ics = [
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:abc-123',
        'SUMMARY:Cours Python',
        'DTSTART:20260415T090000Z',
        'DTEND:20260415T120000Z',
        'LOCATION:Salle B12',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\n')
      const events = parseIcs(ics)
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        uid: 'abc-123',
        summary: 'Cours Python',
        start: '2026-04-15T09:00:00Z',
        end: '2026-04-15T12:00:00Z',
        location: 'Salle B12',
        isAllDay: false,
      })
    })

    it('parses an all-day VEVENT', () => {
      const ics = [
        'BEGIN:VEVENT',
        'UID:all-1',
        'SUMMARY:Vacances',
        'DTSTART;VALUE=DATE:20260420',
        'DTEND;VALUE=DATE:20260424',
        'END:VEVENT',
      ].join('\n')
      const events = parseIcs(ics)
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        uid: 'all-1',
        summary: 'Vacances',
        start: '2026-04-20',
        end: '2026-04-24',
        isAllDay: true,
      })
    })

    it('decodes ICS escaping (\\n \\, \\;)', () => {
      const ics = [
        'BEGIN:VEVENT',
        'SUMMARY:Workshop\\, suite\\; jour 1',
        'DESCRIPTION:Ligne 1\\nLigne 2',
        'DTSTART:20260415T090000Z',
        'END:VEVENT',
      ].join('\n')
      const events = parseIcs(ics)
      expect(events[0].summary).toBe('Workshop, suite; jour 1')
      expect(events[0].description).toBe('Ligne 1\nLigne 2')
    })

    it('falls back end = start when DTEND missing', () => {
      const ics = [
        'BEGIN:VEVENT',
        'SUMMARY:Sans end',
        'DTSTART:20260415T090000Z',
        'END:VEVENT',
      ].join('\n')
      const events = parseIcs(ics)
      expect(events[0].end).toBe('2026-04-15T09:00:00Z')
    })

    it('skips events without DTSTART', () => {
      const ics = [
        'BEGIN:VEVENT',
        'SUMMARY:Pas de start',
        'END:VEVENT',
      ].join('\n')
      expect(parseIcs(ics)).toHaveLength(0)
    })

    it('parses multiple events in order', () => {
      const ics = [
        'BEGIN:VEVENT', 'UID:1', 'SUMMARY:A', 'DTSTART:20260415T090000Z', 'END:VEVENT',
        'BEGIN:VEVENT', 'UID:2', 'SUMMARY:B', 'DTSTART:20260416T090000Z', 'END:VEVENT',
        'BEGIN:VEVENT', 'UID:3', 'SUMMARY:C', 'DTSTART:20260417T090000Z', 'END:VEVENT',
      ].join('\n')
      const events = parseIcs(ics)
      expect(events).toHaveLength(3)
      expect(events.map(e => e.uid)).toEqual(['1', '2', '3'])
    })

    it('ignores VTIMEZONE blocks (not VEVENT)', () => {
      const ics = [
        'BEGIN:VCALENDAR',
        'BEGIN:VTIMEZONE',
        'TZID:Europe/Paris',
        'END:VTIMEZONE',
        'BEGIN:VEVENT',
        'UID:single',
        'SUMMARY:Apres timezone',
        'DTSTART:20260415T090000Z',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\n')
      const events = parseIcs(ics)
      expect(events).toHaveLength(1)
      expect(events[0].uid).toBe('single')
    })

    it('handles long folded SUMMARY line (RFC 5545)', () => {
      const ics = [
        'BEGIN:VEVENT',
        'SUMMARY:This is a really long event subject',
        '  that wraps onto a second line',
        'DTSTART:20260415T090000Z',
        'END:VEVENT',
      ].join('\n')
      const events = parseIcs(ics)
      expect(events[0].summary).toBe('This is a really long event subject that wraps onto a second line')
    })
  })
})
