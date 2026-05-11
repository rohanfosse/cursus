// ─── Logger structure JSON + persistance error_reports ──────────────────────
//
// Niveau "error" : ecrit aussi dans la table `error_reports` (si DB up) en
// plus du JSON stdout. Permet a l'admin de retrouver les errors via le
// dashboard sans avoir besoin de SSH pour `docker logs`. Particulierement
// utile pour les uncaughtException / unhandledRejection captures dans
// server/index.js qui appellent log.error() avec un contexte structure.
//
// Niveau "warn" est aussi capture si meta.persist = true (cas par cas, par
// defaut juste stdout). Cela permet aux endpoints critiques (auth, depots)
// de tagger leurs warns importants sans pollluer la table avec du bruit.
//
// La capture en DB est BEST EFFORT : si la table n'existe pas (boot avant
// init schema), ou si la DB est verouillee, on swallow l'erreur — l'objet
// log primaire (stdout JSON) reste fiable.

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }
const MIN_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] || 1

// La capture DB s'active SEULEMENT apres init() pour eviter de tenter
// d'inserer pendant le bootstrap (avant que la table error_reports existe).
let dbCaptureEnabled = false

function enableDbCapture() {
  dbCaptureEnabled = true
}

function persistToDb(level, message, meta) {
  if (!dbCaptureEnabled) return
  const source = meta?.source ?? 'server'
  try {
    const { reportError } = require('../db/models/admin')
    reportError({
      userId: meta?.userId ?? null,
      userName: meta?.userName ?? null,
      userType: meta?.userType ?? null,
      page: meta?.page ?? meta?.path ?? null,
      message: String(message).substring(0, 2000),
      stack: meta?.stack ? String(meta.stack).substring(0, 5000) : null,
      userAgent: meta?.userAgent ?? null,
      appVersion: meta?.appVersion ?? null,
      source,
      level,
      meta: meta?.context ?? meta,
    })
  } catch {
    /* Best effort : si la DB est down ou la table absente, on ne casse pas
       le serveur. Le stdout JSON reste l'oracle primaire. */
    return
  }
  // Alerte burst : opt-in via ADMIN_NOTIFY_EMAIL. Fire-and-forget : la
  // promise est await en interne mais on ne bloque pas l'appelant logger.
  try {
    const { maybeAlert } = require('../services/errorAlerts')
    maybeAlert(source).catch(() => { /* swallow : voir errorAlerts pour le log */ })
  } catch {
    /* errorAlerts non chargeable (ex: SMTP pas dispo) : silencieux. */
  }
}

function emit(level, message, meta = {}) {
  if (LOG_LEVELS[level] < MIN_LEVEL) return
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...meta,
  }
  const line = JSON.stringify(entry)
  if (level === 'error') process.stderr.write(line + '\n')
  else process.stdout.write(line + '\n')

  // Persistance DB pour `error` (toujours) et `warn` opt-in (via meta.persist).
  if (level === 'error' || (level === 'warn' && meta?.persist === true)) {
    persistToDb(level, message, meta)
  }
}

const logger = {
  debug: (msg, meta) => emit('debug', msg, meta),
  info:  (msg, meta) => emit('info',  msg, meta),
  warn:  (msg, meta) => emit('warn',  msg, meta),
  error: (msg, meta) => emit('error', msg, meta),
  // Active la capture DB. A appeler une fois apres `queries.init()`.
  enableDbCapture,
}

module.exports = logger
