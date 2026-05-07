/**
 * Scheduler : toutes les 30s, execute les taches planifiees.
 * Chaque tache est un module isole dans schedulerTasks/.
 */
const processScheduledMessages = require('./schedulerTasks/messages')
const processScheduledDevoirs  = require('./schedulerTasks/devoirs')
const processBookingReminders  = require('./schedulerTasks/reminders')
const processExpiredStatuses   = require('./schedulerTasks/statuses')
const processPromoCalendars    = require('./schedulerTasks/promoCalendars')
const { purgeExpiredLinkPreviews } = require('../db/models/linkPreviews')
const log = require('../utils/logger')

module.exports = function startScheduler(io, queries) {
  let linkPurgeTick = 0
  let promoCalTick = 0
  return setInterval(async () => {
    processScheduledMessages(io, queries)
    processScheduledDevoirs(io, queries)
    processExpiredStatuses(io)
    await processBookingReminders(io)
    // Purge link_previews expires toutes les ~15 min (30 ticks de 30s)
    linkPurgeTick = (linkPurgeTick + 1) % 30
    if (linkPurgeTick === 0) {
      try {
        const n = purgeExpiredLinkPreviews()
        if (n > 0) log.info('link_previews_purged', { count: n })
      } catch (err) { log.warn('link_previews_purge_failed', { error: err.message }) }
    }
    // Refresh ICS toutes les ~5 min (10 ticks de 30s) — la fonction elle-meme
    // skippe les subs deja recents (debounce 30 min cote service).
    promoCalTick = (promoCalTick + 1) % 10
    if (promoCalTick === 0) {
      processPromoCalendars().catch((err) => log.warn('promo_calendars_tick_failed', { error: err.message }))
    }
  }, 30000)
}
