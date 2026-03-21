// ═══════════════════════════════════════════════════════════════════════════════
// Core: state, auth, helpers
// ═══════════════════════════════════════════════════════════════════════════════

const API = window.location.origin
let token = localStorage.getItem('admin_token')
let activeTab = 'serveur'
let serverInterval = null
export const tabLoaded = {}

// ── Helpers (exported for modules) ──────────────────────────────────────────

export function fmtBytes(b) {
  if (b == null) return '\u2014'
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB'
  return (b / 1073741824).toFixed(1) + ' GB'
}
export function fmtDuration(seconds) {
  if (seconds < 60) return Math.floor(seconds) + 's'
  if (seconds < 3600) return Math.floor(seconds / 60) + 'min'
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'min'
  return Math.floor(seconds / 86400) + 'j ' + Math.floor((seconds % 86400) / 3600) + 'h'
}
export function barColor(pct) { return pct > 85 ? 'red' : pct > 60 ? 'orange' : 'green' }
export function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML }
export function fmtDate(d) { if (!d) return '\u2014'; return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

export function showModal(html) { document.getElementById('modal-root').innerHTML = html }
export function closeModal() { document.getElementById('modal-root').innerHTML = '' }

export function pagination(total, page, limit, loadFn) {
  const pages = Math.ceil(total / limit) || 1
  return `<div class="pagination">
    <button ${page <= 1 ? 'disabled' : ''} onclick="${loadFn}(${page - 1})">&laquo;</button>
    <span>Page ${page} / ${pages} (${total} r\u00e9sultats)</span>
    <button ${page >= pages ? 'disabled' : ''} onclick="${loadFn}(${page + 1})">&raquo;</button>
  </div>`
}

export function authHeaders() {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export async function apiFetch(url, opts = {}) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    const r = await fetch(`${API}${url}`, {
      ...opts, signal: ctrl.signal,
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    })
    clearTimeout(timer)
    if (r.status === 401 || r.status === 403) { logout(); return null }
    return r.json()
  } catch (e) {
    if (e.name === 'AbortError') {
      console.warn('[Admin] Timeout sur', url)
      return { ok: false, error: 'Timeout \u2014 serveur lent ou injoignable' }
    }
    console.error('[Admin] Fetch error:', e)
    return { ok: false, error: 'Erreur r\u00e9seau' }
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────

async function doLogin() {
  const email = document.getElementById('login-email').value.trim()
  const pwd   = document.getElementById('login-password').value
  const errEl = document.getElementById('login-error')
  const btn   = document.getElementById('login-btn')
  errEl.style.display = 'none'

  if (!email || !pwd) {
    errEl.textContent = 'Veuillez remplir tous les champs.'
    errEl.style.display = 'block'
    return
  }

  btn.disabled = true
  btn.textContent = 'Connexion\u2026'
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10000)
    const r = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pwd }),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    const json = await r.json()
    if (!json.ok) throw new Error(json.error || 'Identifiants incorrects.')
    if (json.data.type !== 'teacher') throw new Error('Acc\u00e8s r\u00e9serv\u00e9 aux enseignants.')
    token = json.data.token
    localStorage.setItem('admin_token', token)
    showDashboard()
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Serveur injoignable \u2014 v\u00e9rifiez votre connexion.' : e.message
    errEl.textContent = msg
    errEl.style.display = 'block'
  } finally {
    btn.disabled = false
    btn.textContent = 'Connexion'
  }
}

function logout() {
  token = null
  localStorage.removeItem('admin_token')
  document.getElementById('dashboard').style.display = 'none'
  document.getElementById('login-overlay').style.display = 'flex'
  document.getElementById('login-email').value = ''
  document.getElementById('login-password').value = ''
  document.getElementById('login-error').style.display = 'none'
}

function showDashboard() {
  document.getElementById('login-overlay').style.display = 'none'
  document.getElementById('dashboard').style.display = 'block'
  switchTab('serveur')
}

// ── Import modules ──────────────────────────────────────────────────────────

import { refreshServer } from './modules/monitor.js'
import { loadStats } from './modules/stats.js'
import { loadUsers, showUserDetail, resetUserPassword, deleteUser } from './modules/users.js'
import { loadModeration, deleteMessage, loadReports, resolveReport, checkReportsBadge } from './modules/moderation.js'
import { loadAudit } from './modules/audit.js'
import { loadSecurity } from './modules/security.js'
import { loadDeploy, gitPull, dockerRebuild, nginxApply } from './modules/deploy.js'
import { loadImport, seedAll, importRappels, importExamens } from './modules/import.js'
import { loadMaintenance, createBackup, deleteBackup, cleanupLogs, resetSeed, purgeOldData } from './modules/maintenance.js'
import { loadScheduled, showScheduleModal, submitScheduled, cancelScheduled } from './modules/scheduled.js'
import { loadSessions, revokeSession, revokeAllSessions } from './modules/sessions.js'
import { loadFeedback, updateFeedback, checkFeedbackBadge, setFeedbackFilter } from './modules/feedback.js'
import { exportCsv, exportUsers, exportAudit, exportStats } from './modules/exports.js'
import { loadHeatmap } from './modules/heatmap.js'
import { checkReadOnlyBanner, toggleReadOnly, toggleArchivePromo } from './modules/settings.js'

// ── Tabs ────────────────────────────────────────────────────────────────────

function switchTab(tab) {
  activeTab = tab
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab))
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`))

  if (serverInterval) { clearInterval(serverInterval); serverInterval = null }
  if (tab === 'serveur') {
    refreshServer()
    serverInterval = setInterval(refreshServer, 15000)
  } else {
    refreshActiveTab()
  }
}

export function refreshActiveTab() {
  const loaders = {
    serveur: refreshServer, stats: loadStats, users: loadUsers,
    moderation: loadModeration, audit: loadAudit, security: loadSecurity,
    scheduled: loadScheduled, sessions: loadSessions, deploy: loadDeploy,
    import: loadImport, maintenance: loadMaintenance, feedback: loadFeedback,
  }
  if (loaders[activeTab]) loaders[activeTab]()
  checkReadOnlyBanner()
  checkReportsBadge()
  checkFeedbackBadge()
}

// ── Expose functions to window for onclick handlers ─────────────────────────

window.doLogin = doLogin
window.logout = logout
window.switchTab = switchTab
window.refreshActiveTab = refreshActiveTab

// Monitor
window.refreshServer = refreshServer

// Stats
window.loadStats = loadStats

// Users
window.loadUsers = loadUsers
window.showUserDetail = showUserDetail
window.resetUserPassword = resetUserPassword
window.deleteUser = deleteUser

// Moderation
window.loadModeration = loadModeration
window.deleteMessage = deleteMessage
window.loadReports = loadReports
window.resolveReport = resolveReport

// Audit
window.loadAudit = loadAudit

// Security
window.loadSecurity = loadSecurity

// Deploy
window.loadDeploy = loadDeploy
window.gitPull = gitPull
window.dockerRebuild = dockerRebuild
window.nginxApply = nginxApply

// Import
window.loadImport = loadImport
window.seedAll = seedAll
window.importRappels = importRappels
window.importExamens = importExamens

// Maintenance
window.loadMaintenance = loadMaintenance
window.createBackup = createBackup
window.deleteBackup = deleteBackup
window.cleanupLogs = cleanupLogs
window.resetSeed = resetSeed
window.purgeOldData = purgeOldData

// Scheduled
window.loadScheduled = loadScheduled
window.showScheduleModal = showScheduleModal
window.submitScheduled = submitScheduled
window.cancelScheduled = cancelScheduled

// Sessions
window.loadSessions = loadSessions
window.revokeSession = revokeSession
window.revokeAllSessions = revokeAllSessions

// Feedback
window.loadFeedback = loadFeedback
window.updateFeedback = updateFeedback
window.feedbackFilter = ''
// Override feedbackFilter as a property so onclick can set it
Object.defineProperty(window, 'feedbackFilter', {
  get() { return undefined },
  set(val) { setFeedbackFilter(val) },
})

// Exports
window.exportCsv = exportCsv
window.exportUsers = exportUsers
window.exportAudit = exportAudit
window.exportStats = exportStats

// Settings
window.checkReadOnlyBanner = checkReadOnlyBanner
window.toggleReadOnly = toggleReadOnly
window.toggleArchivePromo = toggleArchivePromo

// Modal
window.closeModal = closeModal
window.showModal = showModal

// ── Init ────────────────────────────────────────────────────────────────────

document.getElementById('user-search').addEventListener('keydown', e => { if (e.key === 'Enter') loadUsers() })
document.getElementById('mod-search').addEventListener('keydown', e => { if (e.key === 'Enter') loadModeration() })

// Vérifier que le token sauvegardé est encore valide
if (token) {
  fetch(`${API}/api/admin/feedback/stats`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => {
      if (r.ok) { showDashboard() }
      else { logout() }
    })
    .catch(() => {
      // Serveur injoignable mais token existe — tenter quand même
      showDashboard()
    })
} else {
  document.getElementById('login-overlay').style.display = 'flex'
}
