import { apiFetch, escHtml, fmtDate, timeAgo, skeleton, emptyState } from '../app.js'

export async function loadSecurity() {
  const el = document.getElementById('security-content')
  el.innerHTML = skeleton(6)

  const json = await apiFetch('/api/admin/security')
  if (!json?.ok) { el.innerHTML = emptyState('Erreur de chargement', '\u26a0\ufe0f'); return }
  const { recentLogins, failedByEmail } = json.data

  const alerts = failedByEmail.filter(f => f.fail_count >= 3)

  el.innerHTML = `
    ${alerts.length ? `<div class="alert alert-danger" style="display:flex;align-items:center;gap:.5rem">
      <span style="font-size:1.2rem">\ud83d\udea8</span>
      <div><strong>Alerte brute force</strong><br><span style="font-size:.8rem">${alerts.map(a => `${escHtml(a.email)} (${a.fail_count} \u00e9checs)`).join(' \u2022 ')}</span></div>
    </div>` : ''}

    <div class="grid">
      <div class="card">
        <div class="card-title">\u00c9checs de connexion (24h)</div>
        ${failedByEmail.length ? `<div style="display:flex;flex-direction:column;gap:.4rem">
          ${failedByEmail.map(f => `<div style="display:flex;align-items:center;justify-content:space-between;padding:.4rem .6rem;background:var(--bg);border-radius:var(--radius-sm)">
            <span style="font-size:.8rem;font-weight:500">${escHtml(f.email)}</span>
            <span class="badge ${f.fail_count >= 3 ? 'danger' : 'warn'}" style="min-width:24px;text-align:center">${f.fail_count}</span>
          </div>`).join('')}
        </div>` : emptyState('Aucun \u00e9chec de connexion', '\u2705')}
      </div>

      <div class="card">
        <div class="card-title">Derni\u00e8res connexions</div>
        ${recentLogins.length ? `<table class="data-table">
          <tr><th>Date</th><th>Email</th><th>Status</th><th>IP</th></tr>
          ${recentLogins.slice(0, 25).map(l => `<tr>
            <td style="white-space:nowrap;font-size:.75rem" title="${fmtDate(l.created_at)}">${timeAgo(l.created_at)}</td>
            <td style="font-size:.8rem;font-weight:500">${escHtml(l.email)}</td>
            <td><span class="badge ${l.success ? 'online' : 'stopped'}">${l.success ? '\u2713 OK' : '\u2717 \u00c9chec'}</span></td>
            <td style="color:var(--text-muted);font-size:.75rem;font-family:monospace">${escHtml(l.ip || '\u2014')}</td>
          </tr>`).join('')}
        </table>` : emptyState('Aucune tentative', '\ud83d\udd12')}
      </div>
    </div>`
}
