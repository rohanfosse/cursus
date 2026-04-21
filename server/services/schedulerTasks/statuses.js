/**
 * schedulerTasks/statuses.js — Purge les statuts personnalises expires.
 * Execute toutes les 30s via scheduler.js. Pour chaque user purge, emit
 * status:change vers la room 'all' pour que les UIs clients retirent le
 * badge sans attendre le prochain presence:update.
 */
const log = require('../../utils/logger')
const { purgeExpiredStatuses } = require('../../db/models/statuses')

module.exports = function processExpiredStatuses(io) {
  let expired
  try {
    expired = purgeExpiredStatuses()
  } catch (err) {
    log.error('statuses_purge_failed', { error: err.message })
    return
  }
  if (!expired.length) return
  log.info('statuses_expired', { count: expired.length })
  if (!io) return
  for (const userId of expired) {
    io.to('all').emit('status:change', { userId, status: null })
  }
}
