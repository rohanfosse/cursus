import { apiFetch, escHtml, fmtDate, timeAgo, pagination, skeleton, emptyState } from '../app.js'

let auditPage = 1

export async function loadAudit(page) {
  auditPage = page || 1
  const el = document.getElementById('audit-content')
  el.innerHTML = skeleton(8)

  const params = new URLSearchParams({ page: auditPage, limit: 100 })
  const action = document.getElementById('audit-action-filter').value
  const actor  = document.getElementById('audit-actor').value
  const from   = document.getElementById('audit-from').value
  const to     = document.getElementById('audit-to').value
  if (action) params.set('action', action)
  if (actor)  params.set('actor', actor)
  if (from)   params.set('from', from)
  if (to)     params.set('to', to)

  const json = await apiFetch(`/api/admin/audit?${params}`)
  if (!json?.ok) { el.innerHTML = emptyState('Erreur de chargement', '\u26a0\ufe0f'); return }
  const { entries, total, page: pg, limit } = json.data

  if (!entries.length) { el.innerHTML = emptyState('Aucune entr\u00e9e d\'audit', '\ud83d\udcdd'); return }

  const actionColors = { 'message.delete': 'danger', 'grade.update': 'warn', 'user.delete': 'danger', 'db.reset': 'danger', 'password.reset': 'warn', 'user.create': 'info' }
  const actionIcons = { 'message.delete': '\ud83d\uddd1', 'grade.update': '\ud83d\udcdd', 'user.delete': '\ud83d\udeab', 'db.reset': '\u26a0\ufe0f', 'password.reset': '\ud83d\udd11', 'user.create': '\u2795' }

  el.innerHTML = `
    <table class="data-table">
      <tr><th style="width:140px">Date</th><th>Acteur</th><th>Action</th><th>Cible</th><th>D\u00e9tails</th></tr>
      ${entries.map(e => `<tr>
        <td style="white-space:nowrap;font-size:.75rem" title="${fmtDate(e.created_at)}">${timeAgo(e.created_at)}</td>
        <td><div class="user-cell" style="gap:.4rem">
          <strong style="font-size:.8rem">${escHtml(e.actor_name)}</strong>
          <span class="badge ${e.actor_type}" style="font-size:.6rem">${e.actor_type}</span>
        </div></td>
        <td><span class="badge ${actionColors[e.action] || 'info'}">${actionIcons[e.action] || '\u2022'} ${escHtml(e.action)}</span></td>
        <td style="color:var(--text-secondary);font-size:.8rem">${escHtml(e.target || '\u2014')}</td>
        <td style="font-size:.75rem;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(e.details || '')}">${escHtml((e.details || '').substring(0, 100))}</td>
      </tr>`).join('')}
    </table>
    ${pagination(total, pg, limit, 'loadAudit')}`
}
