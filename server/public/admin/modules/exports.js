import { apiFetch } from '../app.js'

export function exportCsv(filename, headers, rows) {
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [headers.join(',')]
  for (const r of rows) lines.push(r.map(escape).join(','))
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export async function exportUsers() {
  const json = await apiFetch('/api/admin/users?limit=10000')
  if (!json?.ok) return
  exportCsv('utilisateurs.csv',
    ['Nom', 'Email', 'Type', 'Promotion'],
    json.data.users.map(u => [u.name, u.email, u.type, u.promo_name || ''])
  )
}

export async function exportAudit() {
  const json = await apiFetch('/api/admin/audit?limit=10000')
  if (!json?.ok) return
  exportCsv('audit.csv',
    ['Date', 'Acteur', 'Type', 'Action', 'Cible', 'D\u00e9tails'],
    json.data.entries.map(e => [e.created_at, e.actor_name, e.actor_type, e.action, e.target || '', e.details || ''])
  )
}

export async function exportStats() {
  const json = await apiFetch('/api/admin/stats')
  if (!json?.ok) return
  exportCsv('promos-stats.csv',
    ['Promotion', '\u00c9tudiants', 'Canaux', 'Travaux', 'Moyenne'],
    json.data.promosSummary.map(p => [p.name, p.student_count, p.channel_count, p.travaux_count, p.avg_grade ? Math.round(p.avg_grade * 100) / 100 : ''])
  )
}
