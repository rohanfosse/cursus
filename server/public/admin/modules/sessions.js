import { apiFetch, escHtml, fmtDate } from '../app.js'

export async function loadSessions() {
  const el = document.getElementById('sessions-content')
  el.innerHTML = 'Chargement...'
  const json = await apiFetch('/api/admin/sessions')
  if (!json?.ok) { el.innerHTML = 'Erreur'; return }
  const sessions = json.data

  if (!sessions.length) { el.innerHTML = '<div class="card"><div class="card-sub">Aucune session active</div></div>'; return }

  el.innerHTML = `
    <div class="card-sub" style="margin-bottom:1rem">${sessions.length} session(s) active(s) ces 7 derniers jours</div>
    <table class="data-table">
      <tr><th>Utilisateur</th><th>Type</th><th>Derni\u00e8re activit\u00e9</th><th>IP</th><th>Navigateur</th><th>Actions</th></tr>
      ${sessions.map(s => `<tr>
        <td><strong>${escHtml(s.user_name)}</strong></td>
        <td><span class="badge ${s.user_type}">${s.user_type}</span></td>
        <td style="font-size:.75rem">${fmtDate(s.last_seen)}</td>
        <td style="color:var(--text-muted);font-size:.75rem">${escHtml(s.ip || '\u2014')}</td>
        <td style="color:var(--text-muted);font-size:.7rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml((s.user_agent || '').substring(0, 60))}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="revokeSession(${s.id})">R\u00e9voquer</button>
          <button class="btn btn-sm" style="background:var(--orange);color:#fff" onclick="revokeAllSessions(${s.user_id})">Tout r\u00e9voquer</button>
        </td>
      </tr>`).join('')}
    </table>`
}

export async function revokeSession(id) {
  if (!confirm('R\u00e9voquer cette session ?')) return
  await apiFetch(`/api/admin/sessions/${id}`, { method: 'DELETE' })
  loadSessions()
}

export async function revokeAllSessions(userId) {
  if (!confirm('R\u00e9voquer toutes les sessions de cet utilisateur ?')) return
  await apiFetch('/api/admin/sessions/revoke-user', { method: 'POST', body: JSON.stringify({ userId }) })
  loadSessions()
}
