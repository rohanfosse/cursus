/**
 * Routes admin SMTP — diagnostic et test d'envoi.
 *
 * Cas d'usage : le pilote CESI doit savoir si l'envoi de mails (campagnes,
 * confirmations RDV) marche sans avoir a SSH sur le VPS. Deux endpoints :
 *
 *   GET  /api/admin/smtp/status — etat de la config (host, port, user
 *        masque, fromMatchesUser) + test de connexion non-bloquant.
 *        N'expose JAMAIS le mot de passe.
 *   POST /api/admin/smtp/test   — envoie un mail de test a l'adresse
 *        passee en body. Reservee aux teacher+admin.
 */
const router = require('express').Router()
const { z } = require('zod')
const nodemailer = require('nodemailer')
const { validate } = require('../../middleware/validate')
const wrap = require('../../utils/wrap')
const log = require('../../utils/logger')
const { ValidationError } = require('../../utils/errors')

function readSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@cursus.school',
  }
}

/** Masque la partie locale d'un email pour les retours API : ne***@domaine.fr */
function maskEmail(email) {
  if (!email || !email.includes('@')) return email || ''
  const [local, domain] = email.split('@')
  if (local.length <= 2) return `${local[0] || ''}*@${domain}`
  return `${local.slice(0, 2)}***@${domain}`
}

function extractDomain(email) {
  if (!email || !email.includes('@')) return null
  return email.split('@')[1].toLowerCase()
}

function buildStatus(cfg) {
  const fromAddress = (cfg.from.match(/<([^>]+)>/)?.[1] || cfg.from).trim()
  const userDomain = extractDomain(cfg.user)
  const fromDomain = extractDomain(fromAddress)
  const fromMatchesUser = !!(userDomain && fromDomain && userDomain === fromDomain)
  return {
    configured: !!cfg.host,
    host: cfg.host || null,
    port: cfg.port,
    secure: cfg.port === 465,
    userMasked: maskEmail(cfg.user),
    from: cfg.from || null,
    fromAddress,
    fromMatchesUser,
    // Source des vars : pratique pour le diagnostic en prod (vois si on
    // tourne sur le default vs un vrai .env charge).
    sourceLabel: cfg.host ? 'env' : 'default',
  }
}

// ── GET /status ──────────────────────────────────────────────────────────

router.get('/smtp/status', wrap(async (_req) => {
  const cfg = readSmtpConfig()
  const status = buildStatus(cfg)
  if (!status.configured) {
    return { ...status, reachable: false, error: 'SMTP_HOST non defini' }
  }
  // Verifie que le serveur SMTP repond et accepte l'auth — non-bloquant
  // (timeout 5s). Si verify() echoue, on remonte la raison sans crasher
  // l'API : c'est un GET diagnostic, pas un envoi.
  try {
    const t = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 5000,
    })
    await t.verify()
    return { ...status, reachable: true, error: null }
  } catch (err) {
    log.warn('smtp_verify_failed', { error: err.message, code: err.code })
    return {
      ...status,
      reachable: false,
      error: err.message,
      errorCode: err.code || null,
    }
  }
}))

// ── POST /test ────────────────────────────────────────────────────────────

const testSchema = z.object({
  to: z.string().email(),
}).strict()

router.post('/smtp/test', validate(testSchema), wrap(async (req) => {
  const cfg = readSmtpConfig()
  if (!cfg.host) throw new ValidationError('SMTP_HOST non defini sur le serveur')

  const { to } = req.body
  const t = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  })

  const subject = `Cursus — Test SMTP (${new Date().toISOString().slice(0, 16).replace('T', ' ')})`
  const text = [
    'Ceci est un test de configuration SMTP envoye depuis Cursus.',
    '',
    `Demande par : ${req.user.name || 'inconnu'} (${req.user.type})`,
    `Serveur SMTP : ${cfg.host}:${cfg.port}`,
    `From : ${cfg.from}`,
    '',
    'Si tu recois ce mail, l\'envoi automatique des invitations de campagne fonctionnera.',
  ].join('\n')

  try {
    const info = await t.sendMail({
      from: cfg.from,
      to,
      subject,
      text,
    })
    log.info('smtp_test_sent', {
      requestedBy: req.user.id,
      to,
      messageId: info.messageId,
      response: info.response?.slice(0, 200),
    })
    return {
      ok: true,
      messageId: info.messageId,
      accepted: info.accepted ?? [],
      response: info.response?.slice(0, 200) ?? null,
    }
  } catch (err) {
    log.error('smtp_test_failed', {
      requestedBy: req.user.id,
      to,
      error: err.message,
      code: err.code,
    })
    // On remonte le message brut au client : utile pour le diagnostic,
    // c'est une route admin (pas de leak utilisateur final).
    throw new ValidationError(`Echec envoi : ${err.message}`)
  }
}))

module.exports = router
