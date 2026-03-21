import { apiFetch, escHtml, fmtDate, pagination } from '../app.js'

let modPage = 1

export async function loadModeration(page) {
  modPage = page || 1
  const el = document.getElementById('moderation-content')
  el.innerHTML = 'Chargement...'
  loadReports() // charger les signalements en parallèle

  const params = new URLSearchParams({ page: modPage, limit: 50 })
  const search = document.getElementById('mod-search').value
  const author = document.getElementById('mod-author').value
  const promoId = document.getElementById('mod-promo-filter').value
  const from = document.getElementById('mod-from').value
  const to   = document.getElementById('mod-to').value
  if (search)  params.set('search', search)
  if (author)  params.set('author', author)
  if (promoId) params.set('promo_id', promoId)
  if (from)    params.set('from', from)
  if (to)      params.set('to', to)

  const json = await apiFetch(`/api/admin/messages?${params}`)
  if (!json?.ok) { el.innerHTML = 'Erreur de chargement'; return }
  const { messages, total, page: pg, limit } = json.data

  el.innerHTML = `
    <table class="data-table">
      <tr><th>Date</th><th>Auteur</th><th>Canal</th><th>Message</th><th>Actions</th></tr>
      ${messages.map(m => `<tr>
        <td style="white-space:nowrap;font-size:.75rem">${fmtDate(m.created_at)}</td>
        <td><span class="badge ${m.author_type}">${escHtml(m.author_name)}</span></td>
        <td style="color:var(--text-secondary);font-size:.75rem">${escHtml(m.channel_name || 'DM')} ${m.promo_name ? '(' + escHtml(m.promo_name) + ')' : ''}</td>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(m.content.substring(0, 150))}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteMessage(${m.id})">Supprimer</button></td>
      </tr>`).join('')}
    </table>
    ${pagination(total, pg, limit, 'loadModeration')}`
}

export async function deleteMessage(id) {
  const reason = prompt('Raison de la suppression (optionnel) :')
  if (reason === null) return
  const json = await apiFetch(`/api/admin/messages/${id}`, {
    method: 'DELETE', body: JSON.stringify({ reason }),
  })
  if (json?.ok) loadModeration(modPage)
  else alert('Erreur: ' + (json?.error || 'inconnue'))
}

// ── Reports (integrated into moderation tab) ──

let reportsPage = 1

export async function loadReports(page) {
  reportsPage = page || 1
  const el = document.getElementById('reports-list')
  if (!el) return
  el.innerHTML = 'Chargement...'
  const statusFilter = document.getElementById('report-status-filter')?.value || ''
  const params = new URLSearchParams({ page: reportsPage, limit: 30 })
  if (statusFilter) params.set('status', statusFilter)

  const json = await apiFetch(`/api/admin/reports?${params}`)
  if (!json?.ok) { el.innerHTML = 'Erreur'; return }
  const { entries, total, page: pg, limit } = json.data

  if (!entries.length) { el.innerHTML = '<div class="card-sub">Aucun signalement</div>'; return }

  const reasonLabels = { spam: 'Spam', harassment: 'Harc\u00e8lement', inappropriate: 'Inappropri\u00e9', off_topic: 'Hors-sujet', other: 'Autre' }

  el.innerHTML = `<table class="data-table">
    <tr><th>Date</th><th>Signal\u00e9 par</th><th>Raison</th><th>Message</th><th>Auteur msg</th><th>Status</th><th>Actions</th></tr>
    ${entries.map(r => `<tr>
      <td style="white-space:nowrap;font-size:.75rem">${fmtDate(r.created_at)}</td>
      <td>${escHtml(r.reporter_name)}</td>
      <td><span class="badge warn">${reasonLabels[r.reason] || r.reason}</span></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml((r.message_content || '[supprim\u00e9]').substring(0, 100))}</td>
      <td style="color:var(--text-secondary)">${escHtml(r.message_author || '\u2014')}</td>
      <td><span class="badge ${r.status}">${r.status}</span></td>
      <td>${r.status === 'pending' ? `
        <button class="btn btn-primary btn-sm" onclick="resolveReport(${r.id},'reviewed')">Trait\u00e9</button>
        <button class="btn btn-sm" style="background:var(--text-muted);color:#fff" onclick="resolveReport(${r.id},'dismissed')">Rejeter</button>
        ${r.message_content ? `<button class="btn btn-danger btn-sm" onclick="deleteMessage(${r.message_id});resolveReport(${r.id},'reviewed')">Suppr. msg</button>` : ''}
      ` : `${r.resolved_by ? escHtml(r.resolved_by) : ''}`}</td>
    </tr>`).join('')}
  </table>
  ${pagination(total, pg, limit, 'loadReports')}`
}

export async function resolveReport(id, status) {
  await apiFetch(`/api/admin/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ status }) })
  loadReports(reportsPage)
  checkReportsBadge()
}

export async function checkReportsBadge() {
  try {
    const json = await apiFetch('/api/admin/reports?status=pending&limit=1')
    const badge = document.getElementById('reports-badge')
    if (json?.ok && json.data.pendingCount > 0) {
      badge.textContent = json.data.pendingCount
      badge.style.display = 'inline'
    } else {
      badge.style.display = 'none'
    }
  } catch {}
}
