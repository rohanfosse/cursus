/**
 * Scheduler : toutes les 30s, execute les taches planifiees.
 * Chaque tache est un module isole dans schedulerTasks/.
 */
const processScheduledMessages = require('./schedulerTasks/messages')
const processScheduledDevoirs  = require('./schedulerTasks/devoirs')
const processBookingReminders  = require('./schedulerTasks/reminders')
const processExpiredStatuses   = require('./schedulerTasks/statuses')

module.exports = function startScheduler(io, queries) {
  return setInterval(async () => {
    processScheduledMessages(io, queries)
    processScheduledDevoirs(io, queries)
    processExpiredStatuses(io)
    await processBookingReminders(io)
  }, 30000)
}
