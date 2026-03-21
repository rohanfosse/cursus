import { apiFetch, escHtml, fmtDate, pagination } from '../app.js'

let auditPage = 1

export async function loadAudit(page) {
  auditPage = page || 1
  const el = document.getElementById('audit-content')
  el.innerHTML = 'Chargement...'

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
  if (!json?.ok) { el.innerHTML = 'Erreur de chargement'; return }
  const { entries, total, page: pg, limit } = json.data

  if (!entries.length) { el.innerHTML = '<div class="card"><div class="card-sub">Aucune entr\u00e9e d\'audit</div></div>'; return }

  const actionColors = { 'message.delete': 'danger', 'grade.update': 'warn', 'user.delete': 'danger', 'db.reset': 'danger', 'password.reset': 'warn', 'user.create': 'info' }

  el.innerHTML = `
    <table class="data-table">
      <tr><th>Date</th><th>Acteur</th><th>Action</th><th>Cible</th><th>D\u00e9tails</th></tr>
      ${entries.map(e => `<tr>
        <td style="white-space:nowrap;font-size:.75rem">${fmtDate(e.created_at)}</td>
        <td>${escHtml(e.actor_name)} <span class="badge ${e.actor_type}">${e.actor_type}</span></td>
        <td><span class="badge ${actionColors[e.action] || 'info'}">${escHtml(e.action)}</span></td>
        <td style="color:var(--text-secondary);font-size:.75rem">${escHtml(e.target || '\u2014')}</td>
        <td style="font-size:.7rem;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml((e.details || '').substring(0, 100))}</td>
      </tr>`).join('')}
    </table>
    ${pagination(total, pg, limit, 'loadAudit')}`
}
