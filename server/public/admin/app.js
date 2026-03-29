// ═══════════════════════════════════════════════════════════════════════════════
// Core: state, auth, helpers
// ═══════════════════════════════════════════════════════════════════════════════

const API = window.location.origin
let token = localStorage.getItem('admin_token')
let activeTab = 'serveur'
let serverInterval = null
export const tabLoaded = {}

/** Role de l'utilisateur connecte ('admin' | 'teacher') */
let currentUserRole = null

/** Modules reserves a l'admin systeme */
const SYSTEM_MODULES = ['audit', 'security', 'sessions', 'deploy', 'maintenance']

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

export function showModal(html) {
  const root = document.getElementById('modal-root')
  root.innerHTML = html
  root.querySelector('.modal')?.classList.add('modal-enter')
  requestAnimationFrame(() => root.querySelector('.modal')?.classList.add('modal-visible'))
}
export function closeModal() {
  const modal = document.getElementById('modal-root').querySelector('.modal')
  if (modal) {
    modal.classList.add('modal-exit')
    setTimeout(() => { document.getElementById('modal-root').innerHTML = '' }, 150)
  } else {
    document.getElementById('modal-root').innerHTML = ''
  }
}

export function pagination(total, page, limit, loadFn) {
  const pages = Math.ceil(total / limit) || 1
  if (pages <= 1 && total <= limit) return `<div class="pagination"><span>${total} r\u00e9sultat${total > 1 ? 's' : ''}</span></div>`
  let btns = ''
  const start = Math.max(1, page - 2)
  const end = Math.min(pages, page + 2)
  btns += `<button ${page <= 1 ? 'disabled' : ''} onclick="${loadFn}(1)" title="Premi\u00e8re page">&laquo;</button>`
  btns += `<button ${page <= 1 ? 'disabled' : ''} onclick="${loadFn}(${page - 1})">&lsaquo;</button>`
  for (let i = start; i <= end; i++) {
    btns += `<button class="${i === page ? 'pg-active' : ''}" onclick="${loadFn}(${i})">${i}</button>`
  }
  btns += `<button ${page >= pages ? 'disabled' : ''} onclick="${loadFn}(${page + 1})">&rsaquo;</button>`
  btns += `<button ${page >= pages ? 'disabled' : ''} onclick="${loadFn}(${pages})" title="Derni\u00e8re page">&raquo;</button>`
  return `<div class="pagination">${btns}<span class="pg-info">${total} r\u00e9sultat${total > 1 ? 's' : ''}</span></div>`
}

// ── Toast notifications ──────────────────────────────────────────────────────

let toastContainer = null
function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.className = 'toast-container'
    document.body.appendChild(toastContainer)
  }
  return toastContainer
}

export function toast(message, type = 'info', duration = 4000) {
  const container = ensureToastContainer()
  const el = document.createElement('div')
  el.className = `toast toast-${type}`
  const icons = { success: '\u2713', error: '\u2717', info: '\u24d8', warn: '\u26a0' }
  el.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg">${escHtml(message)}</span><button class="toast-close" onclick="this.parentElement.remove()">\u00d7</button>`
  container.appendChild(el)
  requestAnimationFrame(() => el.classList.add('toast-visible'))
  if (duration > 0) {
    setTimeout(() => {
      el.classList.remove('toast-visible')
      setTimeout(() => el.remove(), 300)
    }, duration)
  }
  return el
}

// ── Confirm modal (replaces native confirm()) ────────────────────────────────

export function confirmAction(message, { title = 'Confirmer', danger = false, confirmText = 'Confirmer', cancelText = 'Annuler' } = {}) {
  return new Promise(resolve => {
    showModal(`<div class="modal-overlay" onclick="if(event.target===this){closeModal();window._confirmResolve(false)}">
      <div class="modal confirm-modal">
        <h3>${escHtml(title)}</h3>
        <p style="color:var(--text-secondary);font-size:.85rem;margin-bottom:1.25rem;line-height:1.5">${escHtml(message)}</p>
        <div class="modal-actions">
          <button class="btn" style="background:var(--border);color:var(--text)" onclick="closeModal();window._confirmResolve(false)">${escHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" onclick="closeModal();window._confirmResolve(true)">${escHtml(confirmText)}</button>
        </div>
      </div>
    </div>`)
    window._confirmResolve = resolve
  })
}

// ── Prompt modal (replaces native prompt()) ──────────────────────────────────

export function promptAction(message, { title = '', defaultValue = '', placeholder = '' } = {}) {
  return new Promise(resolve => {
    showModal(`<div class="modal-overlay" onclick="if(event.target===this){closeModal();window._promptResolve(null)}">
      <div class="modal confirm-modal">
        ${title ? `<h3>${escHtml(title)}</h3>` : ''}
        <p style="color:var(--text-secondary);font-size:.85rem;margin-bottom:.75rem">${escHtml(message)}</p>
        <input type="text" id="prompt-input" value="${escHtml(defaultValue)}" placeholder="${escHtml(placeholder)}" style="width:100%;padding:.5rem .75rem;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:.85rem;outline:none" />
        <div class="modal-actions" style="margin-top:1rem">
          <button class="btn" style="background:var(--border);color:var(--text)" onclick="closeModal();window._promptResolve(null)">Annuler</button>
          <button class="btn btn-primary" onclick="closeModal();window._promptResolve(document.getElementById('prompt-input').value)">OK</button>
        </div>
      </div>
    </div>`)
    window._promptResolve = resolve
    setTimeout(() => document.getElementById('prompt-input')?.focus(), 100)
  })
}

// ── Relative time ────────────────────────────────────────────────────────────

export function timeAgo(dateStr) {
  if (!dateStr) return '\u2014'
  const now = Date.now()
  const d = new Date(dateStr + (dateStr.includes('Z') || dateStr.includes('+') ? '' : 'Z'))
  const diff = Math.floor((now - d.getTime()) / 1000)
  if (diff < 60) return 'il y a quelques secondes'
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`
  if (diff < 172800) return 'hier'
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`
  return fmtDate(dateStr)
}

// ── User avatar helper ───────────────────────────────────────────────────────

export function avatar(name, type, size = 32) {
  const initials = (name || '??').split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
  const colors = { student: 'var(--accent)', teacher: 'var(--green)', ta: 'var(--orange)' }
  const bg = colors[type] || 'var(--text-muted)'
  return `<span class="avatar" style="width:${size}px;height:${size}px;background:${bg};font-size:${Math.round(size * 0.4)}px">${escHtml(initials)}</span>`
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

export function skeleton(lines = 3) {
  return `<div class="skeleton-container">${Array.from({ length: lines }, (_, i) =>
    `<div class="skeleton-line" style="width:${75 + Math.random() * 25}%;animation-delay:${i * 0.1}s"></div>`
  ).join('')}</div>`
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function emptyState(message, icon = '\ud83d\udcad') {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-msg">${escHtml(message)}</div></div>`
}

// ── Debounce ─────────────────────────────────────────────────────────────────

export function debounce(fn, ms = 300) {
  let timer
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms) }
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
    if (json.data.type !== 'teacher') throw new Error('Acc\u00e8s r\u00e9serv\u00e9 aux responsables.')
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

async function showDashboard() {
  document.getElementById('login-overlay').style.display = 'none'
  document.getElementById('dashboard').style.display = 'block'

  // Recuperer le role pour masquer les modules systeme si besoin
  try {
    const r = await fetch(`${API}/api/admin/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (r.ok) {
      const json = await r.json()
      currentUserRole = json.data?.type || 'teacher'
    } else {
      currentUserRole = 'teacher'
    }
  } catch {
    currentUserRole = 'teacher'
  }
  applyRoleVisibility()
  switchTab('serveur')
}

/** Cache les onglets systeme pour les utilisateurs non-admin */
function applyRoleVisibility() {
  const isAdmin = currentUserRole === 'admin'
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    const tab = btn.dataset.tab
    if (SYSTEM_MODULES.includes(tab)) {
      btn.style.display = isAdmin ? '' : 'none'
    }
  })
  // Egalement cacher les separateurs superflus quand les onglets systeme sont masques
  if (!isAdmin) {
    document.querySelectorAll('.tab-separator').forEach(sep => {
      const next = sep.nextElementSibling
      const prev = sep.previousElementSibling
      const nextHidden = next && next.style.display === 'none'
      const prevHidden = prev && prev.style.display === 'none'
      if (nextHidden || prevHidden) sep.style.display = 'none'
    })
  }
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
import { loadErrors, clearErrors, showErrorStack, checkErrorsBadge } from './modules/errors.js'
import { loadAdoption, changeInactiveDays } from './modules/adoption.js'
import { loadModulesConfig, toggleModule } from './modules/modules-config.js'

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
    errors: loadErrors,
    adoption: loadAdoption,
    modules: loadModulesConfig,
  }
  if (loaders[activeTab]) loaders[activeTab]()
  checkReadOnlyBanner()
  checkReportsBadge()
  checkFeedbackBadge()
  checkErrorsBadge()
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

// Errors
window.loadErrors = loadErrors
window.clearErrors = clearErrors
window.showErrorStack = showErrorStack

// Adoption
window.loadAdoption = loadAdoption
window.changeInactiveDays = changeInactiveDays

// Modules
window.loadModulesConfig = loadModulesConfig
window.toggleModule = toggleModule

// Modal
window.closeModal = closeModal
window.showModal = showModal
window.toast = toast
window.confirmAction = confirmAction
window.promptAction = promptAction

// ── Dark mode toggle ─────────────────────────────────────────────────────────

function initDarkMode() {
  const saved = localStorage.getItem('admin_theme')
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
}
function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  if (isDark) {
    document.documentElement.removeAttribute('data-theme')
    localStorage.setItem('admin_theme', 'light')
  } else {
    document.documentElement.setAttribute('data-theme', 'dark')
    localStorage.setItem('admin_theme', 'dark')
  }
}
window.toggleDarkMode = toggleDarkMode
initDarkMode()

// ── Focus trap for modals ────────────────────────────────────────────────────

const origShowModal = showModal
window.showModal = function(html) {
  origShowModal(html)
  // Trap focus inside modal
  const root = document.getElementById('modal-root')
  const focusable = root.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
  if (focusable.length) focusable[0].focus()
}

// ── Init ────────────────────────────────────────────────────────────────────

// Search debounce on inputs
const debouncedUserSearch = debounce(() => loadUsers(), 400)
const debouncedModSearch = debounce(() => loadModeration(), 400)
document.getElementById('user-search').addEventListener('input', debouncedUserSearch)
document.getElementById('user-search').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); loadUsers() } })
document.getElementById('mod-search').addEventListener('input', debouncedModSearch)
document.getElementById('mod-search').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); loadModeration() } })

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal()
})

// Vérifier que le token sauvegardé est encore valide
if (token) {
  fetch(`${API}/api/admin/feedback/stats`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => {
      if (r.ok) { showDashboard() }
      else { logout() }
    })
    .catch(() => {
      // Serveur injoignable mais token existe - tenter quand même
      showDashboard()
    })
} else {
  document.getElementById('login-overlay').style.display = 'flex'
}
