/**
 * Helpers et middlewares partages entre les sous-routes booking.
 */
const rateLimit = require('express-rate-limit')
const queries   = require('../../db/index')
const log       = require('../../utils/logger')
const graph     = require('../../services/microsoftGraph')
const { getValidMsToken } = require('../../utils/msToken')

// SERVER_URL est utilise pour generer les liens publics envoyes par mail
// (campagnes, tokens etudiants, cancel link). Si l'env var n'est pas set
// en production, on tombe sur app.cursus.school plutot que localhost
// (qui faisait que les liens d'invitation pointaient vers la machine
// locale du serveur, inutilisables en mail). Pour un deploiement custom,
// override via la var d'env SERVER_URL.
const SERVER_URL = process.env.SERVER_URL
  || (process.env.NODE_ENV === 'production' ? 'https://app.cursus.school' : 'http://localhost:3001')
const GRAPH_TIMEOUT_MS = 8_000

// ── Rate limiters publics ────────────────────────────────────────────────

// IP-level : garde globale anti-scan large (keyGenerator defaut = IPv6-safe)
const publicBookingLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'Trop de tentatives. Reessayez dans une minute.' },
})

// Token-level : empeche un attaquant de bruteforcer un token depuis plusieurs IP
const publicBookingPerTokenLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `token:${req.params.token || req.params.cancelToken || 'none'}`,
  message: { ok: false, error: 'Trop de tentatives sur ce lien.' },
})

/** Middleware: resolve booking token et attache les donnees a req.bookingData. */
function requireBookingToken(req, res, next) {
  const data = queries.getTokenData(req.params.token)
  if (!data || !data.event_type_active) {
    return res.status(404).json({ ok: false, error: 'Lien de reservation invalide ou desactive' })
  }
  req.bookingData = data
  next()
}

/** Timeout wrapper pour les appels Microsoft Graph. */
function withTimeout(promise, ms = GRAPH_TIMEOUT_MS, label = 'graph') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}_timeout`)), ms)),
  ])
}

// Validation format Outlook eventId (base64url + padding).
const OUTLOOK_EVENT_ID_RE = /^[A-Za-z0-9_+/=-]{10,200}$/
function isValidOutlookEventId(id) { return typeof id === 'string' && OUTLOOK_EVENT_ID_RE.test(id) }

/** Supprime l'evenement Outlook si token valide + eventId valide. Best-effort. */
async function tryDeleteOutlookEvent(teacherId, eventId) {
  if (!isValidOutlookEventId(eventId)) return
  const msAccessToken = await getValidMsToken(teacherId)
  if (!msAccessToken) return
  try {
    await withTimeout(graph.deleteEvent(msAccessToken, eventId), GRAPH_TIMEOUT_MS, 'deleteEvent')
  } catch (err) {
    log.warn('outlook_event_delete_failed', { error: err.message, eventId })
  }
}

module.exports = {
  SERVER_URL,
  GRAPH_TIMEOUT_MS,
  publicBookingLimiter,
  publicBookingPerTokenLimiter,
  requireBookingToken,
  withTimeout,
  isValidOutlookEventId,
  tryDeleteOutlookEvent,
}
