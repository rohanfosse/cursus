import { apiFetch, escHtml, fmtDate, timeAgo, avatar, skeleton, emptyState, toast, confirmAction } from '../app.js'

function parseBrowser(ua) {
  if (!ua) return { name: 'Inconnu', icon: '\ud83c\udf10' }
  if (ua.includes('Firefox')) return { name: 'Firefox', icon: '\ud83e\udd8a' }
  if (ua.includes('Edg/')) return { name: 'Edge', icon: '\ud83c\udf0a' }
  if (ua.includes('Chrome')) return { name: 'Chrome', icon: '\ud83d\udfe1' }
  if (ua.includes('Safari')) return { name: 'Safari', icon: '\ud83e\udded' }
  if (ua.includes('Electron')) return { name: 'App Desktop', icon: '\ud83d\udcbb' }
  return { name: 'Navigateur', icon: '\ud83c\udf10' }
}

function parseOS(ua) {
  if (!ua) return ''
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac OS')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'
  return ''
}

export async function loadSessions() {
  const el = document.getElementById('sessions-content')
  el.innerHTML = skeleton(5)
  const json = await apiFetch('/api/admin/sessions')
  if (!json?.ok) { el.innerHTML = emptyState('Erreur', '\u26a0\ufe0f'); return }
  const sessions = json.data

  if (!sessions.length) { el.innerHTML = emptyState('Aucune session active', '\ud83d\udcf4'); return }

  // Group by user for summary
  const byUser = {}
  for (const s of sessions) {
    if (!byUser[s.user_id]) byUser[s.user_id] = []
    byUser[s.user_id].push(s)
  }
  const uniqueUsers = Object.keys(byUser).length

  el.innerHTML = `
    <div style="display:flex;gap:1rem;margin-bottom:1rem">
      <div class="counter" style="flex:1;max-width:180px;padding:.65rem">
        <div class="counter-value" style="font-size:1.3rem">${sessions.length}</div>
        <div class="counter-label">Sessions actives</div>
      </div>
      <div class="counter" style="flex:1;max-width:180px;padding:.65rem">
        <div class="counter-value" style="font-size:1.3rem">${uniqueUsers}</div>
        <div class="counter-label">Utilisateurs uniques</div>
      </div>
    </div>
    <table class="data-table">
      <tr><th>Utilisateur</th><th>Type</th><th>Derni\u00e8re activit\u00e9</th><th>IP</th><th>Navigateur</th><th style="text-align:right">Actions</th></tr>
      ${sessions.map(s => {
        const browser = parseBrowser(s.user_agent)
        const os = parseOS(s.user_agent)
        return `<tr>
        <td><div class="user-cell">${avatar(s.user_name, s.user_type, 24)}<strong>${escHtml(s.user_name)}</strong></div></td>
        <td><span class="badge ${s.user_type}">${s.user_type}</span></td>
        <td style="font-size:.75rem" title="${fmtDate(s.last_seen)}">${timeAgo(s.last_seen)}</td>
        <td style="color:var(--text-muted);font-size:.75rem;font-family:monospace">${escHtml(s.ip || '\u2014')}</td>
        <td style="font-size:.75rem" title="${escHtml(s.user_agent || '')}">${browser.icon} ${browser.name}${os ? ' \u2022 ' + os : ''}</td>
        <td style="text-align:right"><div class="row-actions" style="justify-content:flex-end">
          <button class="btn btn-danger btn-sm" onclick="revokeSession(${s.id})">R\u00e9voquer</button>
          <button class="btn btn-sm" style="background:var(--orange);color:#fff" onclick="revokeAllSessions(${s.user_id})">Tout</button>
        </div></td>
      </tr>`}).join('')}
    </table>`
}

export async function revokeSession(id) {
  const ok = await confirmAction('R\u00e9voquer cette session ?', { title: 'R\u00e9voquer la session', danger: true, confirmText: 'R\u00e9voquer' })
  if (!ok) return
  await apiFetch(`/api/admin/sessions/${id}`, { method: 'DELETE' })
  toast('Session r\u00e9voqu\u00e9e', 'success')
  loadSessions()
}

export async function revokeAllSessions(userId) {
  const ok = await confirmAction('R\u00e9voquer toutes les sessions de cet utilisateur ?', { title: 'R\u00e9voquer toutes les sessions', danger: true, confirmText: 'Tout r\u00e9voquer' })
  if (!ok) return
  await apiFetch('/api/admin/sessions/revoke-user', { method: 'POST', body: JSON.stringify({ userId }) })
  toast('Toutes les sessions r\u00e9voqu\u00e9es', 'success')
  loadSessions()
}
