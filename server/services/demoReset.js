/**
 * Cron de purge des sessions demo expirees.
 *
 * Tourne toutes les heures (vs les "04h00 Paris" du brief original : pour
 * MVP/V2 on fait simple, un setInterval suffit). Quand une session JWT
 * passe expires_at, on supprime tout le tenant : promo, channels, students,
 * teachers, messages, assignments, session.
 *
 * En NODE_ENV=test, le cron n'est pas demarre automatiquement (les tests
 * appellent `runOnce()` directement).
 */
const log = require('../utils/logger')
const { purgeExpiredSessions } = require('../db/demo-connection')

const TICK_INTERVAL_MS = 60 * 60_000 // 1h

let tickIv = null

function runOnce() {
  try {
    const purged = purgeExpiredSessions()
    if (purged > 0) {
      log.info('demo_purge', { sessions: purged })
    }
    return { purged }
  } catch (err) {
    log.warn('demo_purge_failed', { error: err.message })
    return { purged: 0, error: err.message }
  }
}

function start() {
  if (tickIv) return
  if (process.env.NODE_ENV === 'test') return
  // Run immediatement au boot (purge le backlog si le serveur a redemarre
  // tard) puis a chaque heure.
  runOnce()
  tickIv = setInterval(runOnce, TICK_INTERVAL_MS)
}

function stop() {
  if (tickIv) { clearInterval(tickIv); tickIv = null }
}

module.exports = { start, stop, runOnce }
