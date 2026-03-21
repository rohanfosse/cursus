import { escHtml, authHeaders } from '../app.js'

const API = window.location.origin
let feedbackFilter = ''

export async function loadFeedback() {
  const el = document.getElementById('feedback-content')
  try {
    const qs = feedbackFilter ? `?status=${feedbackFilter}` : ''
    const r = await fetch(`${API}/api/admin/feedback${qs}`, { headers: authHeaders() })
    const json = await r.json()
    if (!json.ok) { el.innerHTML = `<p style="color:var(--color-danger)">${json.error}</p>`; return }
    const { items, stats } = json.data

    const statusLabels = { open: 'Ouvert', in_progress: 'En cours', resolved: 'R\u00e9solu', wontfix: 'Refus\u00e9' }
    const typeLabels = { bug: '\ud83d\udc1b Bug', improvement: '\ud83d\udca1 Am\u00e9lioration', question: '\u2753 Question' }
    const statusColors = { open: '#fbbf24', in_progress: '#60a5fa', resolved: '#22c55e', wontfix: '#9ca3af' }

    let html = `<div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <div class="stat-card" style="flex:1;min-width:80px"><div class="stat-value" style="color:#fbbf24">${stats.open}</div><div class="stat-label">Ouverts</div></div>
      <div class="stat-card" style="flex:1;min-width:80px"><div class="stat-value" style="color:#60a5fa">${stats.in_progress}</div><div class="stat-label">En cours</div></div>
      <div class="stat-card" style="flex:1;min-width:80px"><div class="stat-value" style="color:#22c55e">${stats.resolved}</div><div class="stat-label">R\u00e9solus</div></div>
      <div class="stat-card" style="flex:1;min-width:80px"><div class="stat-value">${stats.total}</div><div class="stat-label">Total</div></div>
    </div>`

    html += `<div style="display:flex;gap:6px;margin-bottom:12px">
      <button class="action-btn ${!feedbackFilter?'action-primary':''}" onclick="feedbackFilter='';loadFeedback()">Tous</button>
      <button class="action-btn ${feedbackFilter==='open'?'action-primary':''}" onclick="feedbackFilter='open';loadFeedback()">Ouverts</button>
      <button class="action-btn ${feedbackFilter==='in_progress'?'action-primary':''}" onclick="feedbackFilter='in_progress';loadFeedback()">En cours</button>
      <button class="action-btn ${feedbackFilter==='resolved'?'action-primary':''}" onclick="feedbackFilter='resolved';loadFeedback()">R\u00e9solus</button>
    </div>`

    if (!items.length) {
      html += '<p style="color:var(--text-muted);text-align:center;padding:40px">Aucun feedback pour le moment.</p>'
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:8px">'
      for (const f of items) {
        const typeBadge = typeLabels[f.type] || f.type
        const statusBadge = statusLabels[f.status] || f.status
        const color = statusColors[f.status] || '#9ca3af'
        const date = new Date(f.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

        html += `<div class="card" style="padding:12px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;background:rgba(255,255,255,.06)">${typeBadge}</span>
            <span style="font-size:11px;font-weight:600;color:${color}">${statusBadge}</span>
            <span style="flex:1"></span>
            <span style="font-size:11px;color:var(--text-muted)">${f.user_name} \u00b7 ${date}</span>
          </div>
          <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px">${escHtml(f.title)}</div>
          ${f.description ? `<p style="font-size:12px;color:var(--text-secondary);margin:0 0 8px">${escHtml(f.description)}</p>` : ''}
          ${f.admin_reply ? `<div style="font-size:12px;color:var(--text-secondary);padding:6px 8px;background:rgba(255,255,255,.04);border-radius:6px;border-left:2px solid var(--accent);margin-bottom:8px">${escHtml(f.admin_reply)}</div>` : ''}
          <div style="display:flex;gap:6px;align-items:center">
            <select id="fb-status-${f.id}" style="background:var(--bg-input);border:1px solid var(--border-input);border-radius:6px;color:var(--text-primary);padding:4px 8px;font-size:12px">
              <option value="open" ${f.status==='open'?'selected':''}>Ouvert</option>
              <option value="in_progress" ${f.status==='in_progress'?'selected':''}>En cours</option>
              <option value="resolved" ${f.status==='resolved'?'selected':''}>R\u00e9solu</option>
              <option value="wontfix" ${f.status==='wontfix'?'selected':''}>Refus\u00e9</option>
            </select>
            <input id="fb-reply-${f.id}" placeholder="R\u00e9ponse admin..." value="${escHtml(f.admin_reply||'')}" style="flex:1;background:var(--bg-input);border:1px solid var(--border-input);border-radius:6px;color:var(--text-primary);padding:4px 8px;font-size:12px" />
            <button class="action-btn action-primary" onclick="updateFeedback(${f.id})">Mettre \u00e0 jour</button>
          </div>
        </div>`
      }
      html += '</div>'
    }
    el.innerHTML = html
  } catch (err) {
    el.innerHTML = `<p style="color:var(--color-danger)">Erreur : ${err.message}</p>`
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
    loadFeedback()
  } catch (err) { alert('Erreur: ' + err.message) }
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

// Expose feedbackFilter setter for onclick handlers
export function setFeedbackFilter(val) {
  feedbackFilter = val
}
