// ─── Alertes mail sur burst d'errors ──────────────────────────────────────
//
// Pourquoi : sans alerte proactive, l'admin doit ouvrir le dashboard
// `/admin-monitor` pour decouvrir un incident. Avec : un mail arrive
// dans la boite si un certain nombre d'errors s'accumule sur une fenetre
// glissante — typiquement quand un bug touche tous les utilisateurs.
//
// Anti-spam : cooldown 60 min entre deux alertes (sinon une vague d'errors
// = des dizaines de mails identiques). On garde aussi un threshold flexible
// par source (boot failures = 1, uncaught = 3, frontend = 10) pour ne pas
// noyer sous les errors mineures cote client.
//
// Opt-in : la fonctionnalite ne s'active que si `ADMIN_NOTIFY_EMAIL` est
// configure dans .env ET que le SMTP est configure. Sans ces deux, no-op
// silencieux pour ne pas casser le boot ni les tests.

const log = require('../utils/logger')
const { isConfigured: smtpConfigured } = require('./email')

const ADMIN_EMAIL = process.env.ADMIN_NOTIFY_EMAIL || ''
const COOLDOWN_MS = 60 * 60 * 1000

// Seuils par source : nombre d'errors dans la fenetre de 5 minutes au-dela
// duquel on declenche une alerte. boot = 1 (toute boot failure est critique).
const THRESHOLDS = {
  boot: 1,        // 1 boot failure = alerte immediate
  uncaught: 3,    // 3 uncaughtException en 5min = serieux
  rejection: 10,  // unhandledRejection plus tolerant (souvent network)
  server: 10,
  frontend: 20,
}

const WINDOW_MS = 5 * 60 * 1000

// State en memoire : derniere alerte envoyee par source pour le cooldown.
const lastAlertAt = Object.create(null)

/**
 * Verifie s'il faut envoyer une alerte pour une source donnee, et l'envoie
 * si c'est le cas. A appeler apres chaque persist d'error.
 *
 * @param {string} source  'boot' | 'uncaught' | 'rejection' | 'server' | 'frontend'
 * @returns {Promise<boolean>}  true si une alerte a ete envoyee
 */
async function maybeAlert(source) {
  if (!ADMIN_EMAIL || !smtpConfigured()) return false
  const threshold = THRESHOLDS[source]
  if (!threshold) return false

  // Cooldown : skip si une alerte de cette source a deja ete envoyee dans
  // l'heure. Evite de spammer pour un meme incident continu.
  const lastAt = lastAlertAt[source] || 0
  if (Date.now() - lastAt < COOLDOWN_MS) return false

  try {
    const { getDb } = require('../db/connection')
    const since = new Date(Date.now() - WINDOW_MS).toISOString()
    const row = getDb().prepare(
      `SELECT COUNT(*) AS count FROM error_reports WHERE source = ? AND created_at >= ?`
    ).get(source, since)
    const count = row?.count ?? 0
    if (count < threshold) return false

    // Recupere les 5 derniers messages distincts pour le contenu du mail.
    const samples = getDb().prepare(`
      SELECT message, COUNT(*) AS occurrences, MAX(created_at) AS last_seen
      FROM error_reports
      WHERE source = ? AND created_at >= ?
      GROUP BY message
      ORDER BY occurrences DESC
      LIMIT 5
    `).all(source, since)

    await sendAlertMail(source, count, samples)
    lastAlertAt[source] = Date.now()
    log.info('error_alert_sent', { source, count, threshold })
    return true
  } catch (err) {
    // Ne pas faire boucler maybeAlert sur lui-meme via log.error -> persist
    // -> maybeAlert. log.warn ne persiste pas par defaut.
    log.warn('error_alert_failed', { error: err.message, source })
    return false
  }
}

async function sendAlertMail(source, count, samples) {
  const nodemailer = require('nodemailer')
  const SMTP_HOST = process.env.SMTP_HOST
  const SMTP_PORT = Number(process.env.SMTP_PORT || 587)
  const SMTP_USER = process.env.SMTP_USER
  const SMTP_PASS = process.env.SMTP_PASS
  const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  })

  const subject = `[Cursus] ${count} errors ${source} dans les 5 dernieres minutes`
  const samplesText = samples.map(s =>
    `  - ${s.occurrences}x : ${s.message.substring(0, 150)}\n    (derniere : ${s.last_seen})`
  ).join('\n')

  const text = `Une vague d'errors a ete detectee sur Cursus.

Source : ${source}
Nombre : ${count}
Fenetre : 5 dernieres minutes
Seuil declencheur : ${THRESHOLDS[source]}

Top 5 messages :
${samplesText}

Dashboard : ${process.env.SERVER_URL || 'https://app.cursus.school'}/admin-monitor

Cette alerte est sujette a un cooldown de 60 min — si l'incident persiste,
les alertes suivantes seront supprimees jusqu'a ce que la fenetre se vide.
`

  await transporter.sendMail({
    from: SMTP_FROM,
    to: ADMIN_EMAIL,
    subject,
    text,
  })
}

module.exports = { maybeAlert, THRESHOLDS }
