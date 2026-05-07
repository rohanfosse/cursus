/**
 * schedulerTasks/promoCalendars.js — Refresh des abonnements ICS externes.
 *
 * Strategie : tick toutes les 30s comme les autres tasks, mais on ne refresh
 * un abonnement que si son `last_fetched_at` est > 30 min, pour eviter de
 * spam Outlook/Google. Outlook republie son ICS toutes les ~3h donc 30 min
 * c'est tres conservateur (on hit le cache 6 fois pour 1 changement).
 *
 * Echecs silencieux : on log + on stocke dans last_error, on ne plante jamais
 * le scheduler. Si l'URL est down, le calendrier reste affiche avec les
 * derniers events caches (graceful degradation).
 */
const log = require('../../utils/logger')
const queries = require('../../db/index')
const { fetchAndParseIcs } = require('../icsParser')

const REFRESH_INTERVAL_MS = 30 * 60 * 1000 // 30 minutes

let isRunning = false

module.exports = async function processPromoCalendars() {
  if (isRunning) return // re-entrance guard
  isRunning = true
  try {
    const subs = queries.promoCalendarSubscriptions
    const now = Date.now()
    const all = subs.listAllActive()
    for (const sub of all) {
      const last = sub.last_fetched_at ? Date.parse(sub.last_fetched_at + 'Z') : 0
      if (last && (now - last) < REFRESH_INTERVAL_MS) continue
      try {
        const raw = subs.getRawById(sub.id)
        if (!raw?.ics_url) continue
        const result = await fetchAndParseIcs(raw.ics_url)
        if (!result.ok) {
          subs.markFetched(sub.id, { eventCount: 0, error: result.error })
          log.warn('promo_calendar_fetch_failed', { id: sub.id, error: result.error })
          continue
        }
        subs.replaceEvents(sub.id, result.events)
        subs.markFetched(sub.id, { eventCount: result.events.length, error: null })
        log.info('promo_calendar_refreshed', { id: sub.id, count: result.events.length })
      } catch (err) {
        log.error('promo_calendar_refresh_error', { id: sub.id, error: err?.message })
      }
    }
  } catch (err) {
    log.error('promo_calendars_task_failed', { error: err?.message })
  } finally {
    isRunning = false
  }
}
