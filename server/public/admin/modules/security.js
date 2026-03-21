import { apiFetch, escHtml, fmtDate } from '../app.js'

export async function loadSecurity() {
  const el = document.getElementById('security-content')
  el.innerHTML = 'Chargement...'

  const json = await apiFetch('/api/admin/security')
  if (!json?.ok) { el.innerHTML = 'Erreur de chargement'; return }
  const { recentLogins, failedByEmail } = json.data

  const alerts = failedByEmail.filter(f => f.fail_count >= 3)

  el.innerHTML = `
    ${alerts.length ? `<div class="alert alert-danger">
      <strong>Alerte brute force :</strong> ${alerts.map(a => `${escHtml(a.email)} (${a.fail_count} \u00e9checs)`).join(', ')}
    </div>` : ''}

    <div class="grid">
      <div class="card">
        <div class="card-title">\u00c9checs par email (24h)</div>
        ${failedByEmail.length ? `<table class="data-table">
          <tr><th>Email</th><th>\u00c9checs</th></tr>
          ${failedByEmail.map(f => `<tr>
            <td>${escHtml(f.email)}</td>
            <td><span class="badge ${f.fail_count >= 3 ? 'danger' : 'warn'}">${f.fail_count}</span></td>
          </tr>`).join('')}
        </table>` : '<div class="card-sub">Aucun \u00e9chec</div>'}
      </div>

      <div class="card">
        <div class="card-title">Derni\u00e8res connexions</div>
        ${recentLogins.length ? `<table class="data-table">
          <tr><th>Date</th><th>Email</th><th>Status</th><th>IP</th></tr>
          ${recentLogins.slice(0, 20).map(l => `<tr>
            <td style="white-space:nowrap;font-size:.75rem">${fmtDate(l.created_at)}</td>
            <td style="font-size:.8rem">${escHtml(l.email)}</td>
            <td><span class="badge ${l.success ? 'online' : 'stopped'}">${l.success ? 'OK' : '\u00c9chec'}</span></td>
            <td style="color:var(--text-muted);font-size:.75rem">${escHtml(l.ip || '\u2014')}</td>
          </tr>`).join('')}
        </table>` : '<div class="card-sub">Aucune tentative</div>'}
      </div>
    </div>`
}
