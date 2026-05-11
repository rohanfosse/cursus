// ─── Health check enrichi (admin only) ───────────────────────────────────────
//
// Agglomere tout ce qu'il faut savoir pour diagnostiquer l'etat du pilote en
// un seul appel : ressources systeme, DB, backup, sockets, modules,
// scheduler, errors 24h, activite.
//
// L'endpoint /health public reste minimaliste (uptime + db ok + memoire +
// disque) pour le monitoring externe ; ce service est expose seulement sur
// `/api/admin/health` derriere requireRole('admin') car il leak des stats
// pedagogiques (compte messages/depots) qui n'ont pas a etre publiques.
//
// Chaque section est wrappe try/catch : si la collecte d'une partie echoue
// (ex: pas de Linux donc df pas dispo), on renvoie quand meme le reste avec
// un champ `errors[]` pour ne pas masquer le probleme.

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups')
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'db', 'cursus.db')
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'uploads')
  : path.join(__dirname, '..', '..', 'uploads')

function safeJsonRead(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) } catch { return null }
}

function tryStatBytes(filePath) {
  try { return fs.statSync(filePath).size } catch { return null }
}

function dirSizeShallow(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath)
    let total = 0
    for (const name of entries) {
      try { total += fs.statSync(path.join(dirPath, name)).size } catch { /* skip */ }
    }
    return { bytes: total, count: entries.length }
  } catch {
    return { bytes: null, count: null }
  }
}

function collectSystem() {
  const pkg = safeJsonRead(path.join(__dirname, '..', '..', 'package.json'))
  const mem = process.memoryUsage()
  return {
    version: pkg?.version ?? 'unknown',
    nodeVersion: process.version,
    pid: process.pid,
    uptime_s: Math.floor(process.uptime()),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    platform: process.platform,
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
      externalMB: Math.round(mem.external / 1024 / 1024),
    },
  }
}

function collectDisk(errors) {
  const out = { rootDisk: null, dbBytes: null, uploadsBytes: null, backupsBytes: null }
  try {
    if (process.platform !== 'win32') {
      const df = execSync("df -B1 / | tail -1", { encoding: 'utf8', timeout: 2000 }).trim().split(/\s+/)
      out.rootDisk = {
        totalGB: Math.round(Number(df[1]) / 1024 / 1024 / 1024 * 10) / 10,
        usedGB: Math.round(Number(df[2]) / 1024 / 1024 / 1024 * 10) / 10,
        availGB: Math.round(Number(df[3]) / 1024 / 1024 / 1024 * 10) / 10,
        usedPct: parseInt(df[4]),
      }
    }
  } catch (err) { errors.push({ section: 'disk', error: err.message }) }

  out.dbBytes = tryStatBytes(DB_PATH)
  out.uploads = dirSizeShallow(UPLOAD_DIR)
  out.backups = dirSizeShallow(BACKUP_DIR)
  return out
}

function collectDb(errors) {
  try {
    const { getDb } = require('../db/connection')
    const db = getDb()
    const version = db.pragma('user_version', { simple: true })
    const walFrames = db.pragma('wal_checkpoint(passive)', { simple: false })
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length
    const rowsByTable = {}
    for (const tbl of ['students', 'teachers', 'messages', 'depots', 'channels', 'promotions', 'cahiers', 'error_reports', 'audit_log', 'page_visits']) {
      try { rowsByTable[tbl] = db.prepare(`SELECT COUNT(*) AS c FROM ${tbl}`).get().c } catch { /* table absente */ }
    }
    return {
      ok: true,
      migrationVersion: version,
      tables,
      walFrames: Array.isArray(walFrames) ? walFrames : null,
      rowsByTable,
    }
  } catch (err) {
    errors.push({ section: 'db', error: err.message })
    return { ok: false, error: err.message }
  }
}

function collectBackup(errors) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return { configured: false, lastBackup: null }
    const entries = fs.readdirSync(BACKUP_DIR)
      .map(name => {
        try {
          const stat = fs.statSync(path.join(BACKUP_DIR, name))
          return { name, mtime: stat.mtime.toISOString(), bytes: stat.size }
        } catch { return null }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime.localeCompare(a.mtime))
    const last = entries[0] ?? null
    const ageHours = last ? (Date.now() - new Date(last.mtime).getTime()) / 3600_000 : null
    return {
      configured: true,
      total: entries.length,
      lastBackup: last,
      lastBackupAgeHours: ageHours ? Math.round(ageHours * 10) / 10 : null,
      stale: ageHours != null && ageHours > 24,
    }
  } catch (err) {
    errors.push({ section: 'backup', error: err.message })
    return { configured: false, error: err.message }
  }
}

function collectSockets(io, hocuspocus, errors) {
  const out = { socketIo: null, hocuspocus: null }
  try {
    out.socketIo = { clients: io?.engine?.clientsCount ?? 0 }
  } catch (err) { errors.push({ section: 'socketio', error: err.message }) }
  try {
    if (hocuspocus?.documents) {
      out.hocuspocus = { openDocs: hocuspocus.documents.size ?? Object.keys(hocuspocus.documents).length }
    }
  } catch (err) { errors.push({ section: 'hocuspocus', error: err.message }) }
  return out
}

function collectScheduler(errors) {
  try {
    const { getDb } = require('../db/connection')
    const pending = getDb().prepare(
      `SELECT COUNT(*) AS c FROM scheduled_messages WHERE sent_at IS NULL AND cancelled_at IS NULL`
    ).get().c
    const nextRow = getDb().prepare(
      `SELECT scheduled_at FROM scheduled_messages WHERE sent_at IS NULL AND cancelled_at IS NULL ORDER BY scheduled_at ASC LIMIT 1`
    ).get()
    return {
      pendingMessages: pending,
      nextScheduledAt: nextRow?.scheduled_at ?? null,
    }
  } catch (err) {
    errors.push({ section: 'scheduler', error: err.message })
    return { pendingMessages: null }
  }
}

function collectModules(errors) {
  try {
    const { getDb } = require('../db/connection')
    const rows = getDb().prepare(`SELECT key, value FROM app_config WHERE key LIKE 'module_%'`).all()
    const modules = {}
    for (const r of rows) {
      const name = r.key.replace(/^module_/, '')
      modules[name] = r.value === '1' || r.value === 'true'
    }
    return modules
  } catch (err) {
    errors.push({ section: 'modules', error: err.message })
    return {}
  }
}

function collectSmtp() {
  return {
    configured: !!process.env.SMTP_HOST,
    host: process.env.SMTP_HOST ?? null,
    port: Number(process.env.SMTP_PORT || 587),
    fromConfigured: !!process.env.SMTP_FROM,
    adminNotifyEmail: !!process.env.ADMIN_NOTIFY_EMAIL,
  }
}

function collectErrors24h(errors) {
  try {
    const { getDb } = require('../db/connection')
    const rows = getDb().prepare(`
      SELECT source, level, COUNT(*) AS count
      FROM error_reports
      WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY source, level
    `).all()
    const bySource = {}
    let total = 0
    let critical = 0
    for (const r of rows) {
      const src = r.source ?? 'unknown'
      bySource[src] = (bySource[src] ?? 0) + r.count
      total += r.count
      if (src === 'boot' || src === 'uncaught') critical += r.count
    }
    return { total, critical, bySource }
  } catch (err) {
    errors.push({ section: 'errors_24h', error: err.message })
    return null
  }
}

function collectActivity(errors) {
  try {
    const { getDb } = require('../db/connection')
    const active5min = getDb().prepare(`
      SELECT COUNT(DISTINCT user_id) AS c FROM page_visits WHERE visited_at >= datetime('now', '-5 minutes')
    `).get()?.c ?? 0
    const msgs1h = getDb().prepare(
      `SELECT COUNT(*) AS c FROM messages WHERE created_at >= datetime('now', '-1 hour')`
    ).get()?.c ?? 0
    const depots24h = getDb().prepare(
      `SELECT COUNT(*) AS c FROM depots WHERE submitted_at >= datetime('now', '-24 hours')`
    ).get()?.c ?? 0
    return { activeUsers5min: active5min, messagesLast1h: msgs1h, depotsLast24h: depots24h }
  } catch (err) {
    errors.push({ section: 'activity', error: err.message })
    return null
  }
}

/**
 * Build a complete health snapshot. Best effort : sections qui echouent sont
 * remontees dans `errors[]` mais le reste est servi quand meme.
 *
 * @param {object} ctx
 * @param {import('socket.io').Server} [ctx.io]
 * @param {object} [ctx.hocuspocus]
 */
function buildHealthSnapshot(ctx = {}) {
  const errors = []
  return {
    ts: new Date().toISOString(),
    system: collectSystem(),
    disk: collectDisk(errors),
    db: collectDb(errors),
    backup: collectBackup(errors),
    sockets: collectSockets(ctx.io, ctx.hocuspocus, errors),
    scheduler: collectScheduler(errors),
    modules: collectModules(errors),
    smtp: collectSmtp(),
    errors24h: collectErrors24h(errors),
    activity: collectActivity(errors),
    collectionErrors: errors,
  }
}

module.exports = { buildHealthSnapshot }
