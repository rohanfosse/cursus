import { apiFetch, escHtml, authHeaders, timeAgo, skeleton, emptyState, toast } from '../app.js'

const API = window.location.origin
let feedbackFilter = ''

export async function loadFeedback() {
  const el = document.getElementById('feedback-content')
  el.innerHTML = skeleton(5)
  try {
    const qs = feedbackFilter ? `?status=${feedbackFilter}` : ''
    const r = await fetch(`${API}/api/admin/feedback${qs}`, { headers: authHeaders() })
    const json = await r.json()
    if (!json.ok) { el.innerHTML = emptyState(json.error || 'Erreur', '\u26a0\ufe0f'); return }
    const { items, stats } = json.data

    const statusLabels = { open: 'Ouvert', in_progress: 'En cours', resolved: 'R\u00e9solu', wontfix: 'Refus\u00e9' }
    const typeLabels = { bug: '\ud83d\udc1b Bug', improvement: '\ud83d\udca1 Am\u00e9lioration', question: '\u2753 Question' }
    const statusColors = { open: '#fbbf24', in_progress: '#60a5fa', resolved: '#22c55e', wontfix: '#9ca3af' }

    let html = `<div style="display:flex;gap:.75rem;margin-bottom:1.25rem;flex-wrap:wrap">
      <div class="stat-card" style="flex:1;min-width:100px"><div class="stat-value" style="color:#fbbf24">${stats.open}</div><div class="stat-label">Ouverts</div></div>
      <div class="stat-card" style="flex:1;min-width:100px"><div class="stat-value" style="color:#60a5fa">${stats.in_progress}</div><div class="stat-label">En cours</div></div>
      <div class="stat-card" style="flex:1;min-width:100px"><div class="stat-value" style="color:#22c55e">${stats.resolved}</div><div class="stat-label">R\u00e9solus</div></div>
      <div class="stat-card" style="flex:1;min-width:100px"><div class="stat-value">${stats.total}</div><div class="stat-label">Total</div></div>
    </div>`

    html += `<div style="display:flex;gap:.35rem;margin-bottom:1rem">
      <button class="action-btn ${!feedbackFilter ? 'action-primary' : ''}" onclick="feedbackFilter=''">Tous</button>
      <button class="action-btn ${feedbackFilter === 'open' ? 'action-primary' : ''}" onclick="feedbackFilter='open'">Ouverts</button>
      <button class="action-btn ${feedbackFilter === 'in_progress' ? 'action-primary' : ''}" onclick="feedbackFilter='in_progress'">En cours</button>
      <button class="action-btn ${feedbackFilter === 'resolved' ? 'action-primary' : ''}" onclick="feedbackFilter='resolved'">R\u00e9solus</button>
    </div>`

    if (!items.length) {
      html += emptyState('Aucun feedback pour le moment', '\ud83d\udcec')
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:.6rem">'
      for (const f of items) {
        const typeBadge = typeLabels[f.type] || f.type
        const statusBadge = statusLabels[f.status] || f.status
        const color = statusColors[f.status] || '#9ca3af'

        html += `<div class="card" style="padding:1rem;transition:border-color .2s">
          <div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.5rem">
            <span class="badge info" style="font-size:.65rem">${typeBadge}</span>
            <span style="font-size:.65rem;font-weight:600;color:${color};padding:2px 6px;border:1px solid ${color}33;border-radius:4px">${statusBadge}</span>
            <span style="flex:1"></span>
            <span style="font-size:.7rem;color:var(--text-muted)">${escHtml(f.user_name)} \u00b7 ${timeAgo(f.created_at)}</span>
          </div>
          <div style="font-size:.9rem;font-weight:600;margin-bottom:.3rem">${escHtml(f.title)}</div>
          ${f.description ? `<p style="font-size:.8rem;color:var(--text-secondary);margin:0 0 .6rem;line-height:1.5">${escHtml(f.description)}</p>` : ''}
          ${f.admin_reply ? `<div style="font-size:.8rem;color:var(--text-secondary);padding:.5rem .75rem;background:rgba(74,144,217,.06);border-radius:var(--radius-sm);border-left:2px solid var(--accent);margin-bottom:.6rem;line-height:1.4">${escHtml(f.admin_reply)}</div>` : ''}
          <div style="display:flex;gap:.4rem;align-items:center">
            <select id="fb-status-${f.id}" class="status-select">
              <option value="open" ${f.status === 'open' ? 'selected' : ''}>Ouvert</option>
              <option value="in_progress" ${f.status === 'in_progress' ? 'selected' : ''}>En cours</option>
              <option value="resolved" ${f.status === 'resolved' ? 'selected' : ''}>R\u00e9solu</option>
              <option value="wontfix" ${f.status === 'wontfix' ? 'selected' : ''}>Refus\u00e9</option>
            </select>
            <input id="fb-reply-${f.id}" placeholder="R\u00e9ponse admin..." value="${escHtml(f.admin_reply || '')}"
              style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:.3rem .6rem;font-size:.8rem;outline:none" />
            <button class="btn btn-primary btn-sm" onclick="updateFeedback(${f.id})">Envoyer</button>
          </div>
        </div>`
      }
      html += '</div>'
    }
    el.innerHTML = html
  } catch (err) {
    el.innerHTML = emptyState('Erreur : ' + err.message, '\u26a0\ufe0f')
  }
}

export async function updateFeedback(id) {
  const status = document.getElementById(`fb-status-${id}`).value
  const adminReply = document.getElementById(`fb-reply-${id}`).value
  try {
    await fetch(`${API}/api/admin/feedback/${id}/status`, {
      method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminReply }),
    })
    toast('Feedback mis \u00e0 jour', 'success')
    loadFeedback()
  } catch (err) { toast('Erreur: ' + err.message, 'error') }
}

export async function checkFeedbackBadge() {
  try {
    const r = await fetch(`${API}/api/admin/feedback/stats`, { headers: authHeaders() })
    const json = await r.json()
    const badge = document.getElementById('feedback-badge')
    if (json.ok && json.data.open > 0) {
      badge.textContent = json.data.open
      badge.style.display = 'inline-flex'
    } else {
      badge.style.display = 'none'
    }
  } catch { document.getElementById('feedback-badge').style.display = 'none' }
}

export function setFeedbackFilter(val) {
  feedbackFilter = val
  loadFeedback()
}
