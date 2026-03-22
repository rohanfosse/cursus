import { apiFetch, escHtml, fmtDate, timeAgo, pagination, skeleton, emptyState, toast, confirmAction, promptAction } from '../app.js'

let modPage = 1

export async function loadModeration(page) {
  modPage = page || 1
  const el = document.getElementById('moderation-content')
  el.innerHTML = skeleton(6)
  loadReports()

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
  if (!json?.ok) { el.innerHTML = emptyState('Erreur de chargement', '\u26a0\ufe0f'); return }
  const { messages, total, page: pg, limit } = json.data

  if (!messages.length) { el.innerHTML = emptyState('Aucun message trouv\u00e9', '\ud83d\udcac'); return }

  el.innerHTML = `
    <table class="data-table">
      <tr><th>Date</th><th>Auteur</th><th>Canal</th><th>Message</th><th style="text-align:right">Actions</th></tr>
      ${messages.map(m => `<tr>
        <td style="white-space:nowrap;font-size:.75rem" title="${fmtDate(m.created_at)}">${timeAgo(m.created_at)}</td>
        <td><span class="badge ${m.author_type}">${escHtml(m.author_name)}</span></td>
        <td style="color:var(--text-secondary);font-size:.75rem">${escHtml(m.channel_name || 'DM')} ${m.promo_name ? '<span style="opacity:.6">(' + escHtml(m.promo_name) + ')</span>' : ''}</td>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(m.content)}">${escHtml(m.content.substring(0, 150))}</td>
        <td style="text-align:right"><div class="row-actions" style="justify-content:flex-end">
          <button class="btn btn-danger btn-sm" onclick="deleteMessage(${m.id})">Supprimer</button>
        </div></td>
      </tr>`).join('')}
    </table>
    ${pagination(total, pg, limit, 'loadModeration')}`
}

export async function deleteMessage(id) {
  const reason = await promptAction('Raison de la suppression (optionnel) :', { title: 'Supprimer le message', placeholder: 'Spam, harc\u00e8lement, contenu inappropri\u00e9...' })
  if (reason === null) return
  const json = await apiFetch(`/api/admin/messages/${id}`, {
    method: 'DELETE', body: JSON.stringify({ reason }),
  })
  if (json?.ok) { toast('Message supprim\u00e9', 'success'); loadModeration(modPage) }
  else toast(json?.error || 'Erreur', 'error')
}

// ── Reports ──

let reportsPage = 1

export async function loadReports(page) {
  reportsPage = page || 1
  const el = document.getElementById('reports-list')
  if (!el) return
  el.innerHTML = skeleton(4)
  const statusFilter = document.getElementById('report-status-filter')?.value || ''
  const params = new URLSearchParams({ page: reportsPage, limit: 30 })
  if (statusFilter) params.set('status', statusFilter)

  const json = await apiFetch(`/api/admin/reports?${params}`)
  if (!json?.ok) { el.innerHTML = emptyState('Erreur', '\u26a0\ufe0f'); return }
  const { entries, total, page: pg, limit } = json.data

  if (!entries.length) { el.innerHTML = emptyState('Aucun signalement', '\u2705'); return }

  const reasonLabels = { spam: 'Spam', harassment: 'Harc\u00e8lement', inappropriate: 'Inappropri\u00e9', off_topic: 'Hors-sujet', other: 'Autre' }

  el.innerHTML = `<table class="data-table">
    <tr><th>Date</th><th>Signal\u00e9 par</th><th>Raison</th><th>Message</th><th>Auteur</th><th>Status</th><th style="text-align:right">Actions</th></tr>
    ${entries.map(r => `<tr>
      <td style="white-space:nowrap;font-size:.75rem" title="${fmtDate(r.created_at)}">${timeAgo(r.created_at)}</td>
      <td style="font-weight:500">${escHtml(r.reporter_name)}</td>
      <td><span class="badge warn">${reasonLabels[r.reason] || r.reason}</span></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.message_content || '')}">${escHtml((r.message_content || '[supprim\u00e9]').substring(0, 100))}</td>
      <td style="color:var(--text-secondary)">${escHtml(r.message_author || '\u2014')}</td>
      <td><span class="badge ${r.status}">${r.status}</span></td>
      <td style="text-align:right"><div class="row-actions" style="justify-content:flex-end;gap:.3rem">${r.status === 'pending' ? `
        <button class="btn btn-primary btn-sm" onclick="resolveReport(${r.id},'reviewed')">Trait\u00e9</button>
        <button class="btn btn-sm" style="background:var(--text-muted);color:#fff" onclick="resolveReport(${r.id},'dismissed')">Rejeter</button>
        ${r.message_content ? `<button class="btn btn-danger btn-sm" onclick="deleteMessage(${r.message_id});resolveReport(${r.id},'reviewed')">Suppr.</button>` : ''}
      ` : `<span style="font-size:.7rem;color:var(--text-muted)">${r.resolved_by ? escHtml(r.resolved_by) : ''}</span>`}</div></td>
    </tr>`).join('')}
  </table>
  ${pagination(total, pg, limit, 'loadReports')}`
}

export async function resolveReport(id, status) {
  await apiFetch(`/api/admin/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ status }) })
  toast(status === 'reviewed' ? 'Signalement trait\u00e9' : 'Signalement rejet\u00e9', 'success')
  loadReports(reportsPage)
  checkReportsBadge()
}

export async function checkReportsBadge() {
  try {
    const json = await apiFetch('/api/admin/reports?status=pending&limit=1')
    const badge = document.getElementById('reports-badge')
    if (json?.ok && json.data.total > 0) {
      badge.textContent = json.data.total
      badge.style.display = 'inline'
    } else {
      badge.style.display = 'none'
    }
  } catch {}
}
