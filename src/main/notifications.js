// ─── Scheduler de notifications desktop (J-1 deadlines) ──────────────────────
// Tourne dans le processus Main. Vérifie toutes les 30 min si des travaux
// arrivent à échéance dans les prochaines 24h et envoie une Notification native.
// Les IDs déjà notifiés sont gardés en mémoire (reset au redémarrage = OK).

const { Notification } = require('electron')
const queries = require('../db/index')

const notifiedIds = new Set()

function formatHoursLeft(deadlineStr) {
  const ms = new Date(deadlineStr).getTime() - Date.now()
  const h  = Math.round(ms / 3_600_000)
  if (h >= 24) return `${Math.floor(h / 24)}j ${h % 24}h`
  if (h >= 1)  return `${h}h`
  return 'moins d\'1h'
}

function checkAndNotify() {
  try {
    const travaux = queries.getUpcomingNotifications()
    for (const t of travaux) {
      if (notifiedIds.has(t.id)) continue
      notifiedIds.add(t.id)

      new Notification({
        title: `⏰ Rendu demain — ${t.title}`,
        body:  `${t.promo_name} · encore ${formatHoursLeft(t.deadline)}`,
        urgency: 'normal',
      }).show()
    }
  } catch (err) {
    console.error('[Notifications]', err.message)
  }
}

function start() {
  // Première vérification au démarrage (légère pause pour laisser la DB s'init)
  setTimeout(checkAndNotify, 5_000)
  // Puis toutes les 30 minutes
  setInterval(checkAndNotify, 30 * 60 * 1_000)
}

module.exports = { start }
