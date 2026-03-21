import { apiFetch, escHtml, fmtBytes, fmtDate } from '../app.js'

export async function loadMaintenance() {
  const el = document.getElementById('maintenance-content')
  el.innerHTML = 'Chargement...'

  const [backupsJson, dbInfoJson, configJson] = await Promise.all([
    apiFetch('/api/admin/backups'),
    apiFetch('/api/admin/db-info'),
    apiFetch('/api/admin/config'),
  ])

  const backups  = backupsJson?.ok ? backupsJson.data : []
  const dbInfo   = dbInfoJson?.ok ? dbInfoJson.data : []
  const readOnly = configJson?.ok ? configJson.data.read_only : false

  el.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="card-title">Mode plateforme</div>
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:.5rem">
          <label class="toggle">
            <input type="checkbox" ${readOnly ? 'checked' : ''} onchange="toggleReadOnly(this.checked)">
            <span class="toggle-slider"></span>
          </label>
          <span style="font-size:.85rem">${readOnly ? '<span style="color:var(--orange)">Lecture seule activ\u00e9e</span>' : 'Mode normal'}</span>
        </div>
        <div class="card-sub">En mode lecture seule, les \u00e9tudiants ne peuvent plus poster de messages ni soumettre de d\u00e9p\u00f4ts.</div>
      </div>

      <div class="card">
        <div class="card-title">Politique de r\u00e9tention</div>
        <button class="btn" style="background:var(--accent);color:#fff" onclick="purgeOldData()">Purger les donn\u00e9es anciennes</button>
        <div class="card-sub" style="margin-top:.5rem">Supprime : audit > 90j, logins > 30j, sessions > 30j, signalements trait\u00e9s > 90j</div>
      </div>
    </div>

    <div class="grid" style="margin-top:1rem">
      <div class="card">
        <div class="card-title">Sauvegardes</div>
        <button class="btn btn-primary" onclick="createBackup()" style="margin-bottom:1rem">Cr\u00e9er un backup</button>
        ${backups.length ? `<table class="data-table">
          <tr><th>Fichier</th><th>Taille</th><th>Date</th><th>Actions</th></tr>
          ${backups.map(b => `<tr>
            <td style="font-size:.8rem">${escHtml(b.filename)}</td>
            <td>${fmtBytes(b.size)}</td>
            <td style="font-size:.75rem">${fmtDate(b.created)}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteBackup('${escHtml(b.filename)}')">Suppr.</button></td>
          </tr>`).join('')}
        </table>` : '<div class="card-sub">Aucun backup</div>'}
      </div>

      <div class="card">
        <div class="card-title">Tables de la base</div>
        <table class="data-table">
          <tr><th>Table</th><th>Lignes</th></tr>
          ${dbInfo.map(t => `<tr><td>${escHtml(t.name)}</td><td><strong>${t.rowCount}</strong></td></tr>`).join('')}
        </table>
      </div>
    </div>

    <div class="grid" style="margin-top:1rem">
      <div class="card">
        <div class="card-title">Actions de maintenance</div>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap">
          <button class="btn" style="background:var(--orange);color:#fff" onclick="cleanupLogs()">Nettoyer les logs</button>
          <button class="btn btn-danger" onclick="resetSeed()">Reset & Seed BDD</button>
        </div>
        <div class="card-sub" style="margin-top:.75rem;color:var(--red)">
          Reset & Seed supprimera toutes les donn\u00e9es et recr\u00e9era les donn\u00e9es de d\u00e9mo.
        </div>
      </div>

    </div>`
}

export async function createBackup() {
  const json = await apiFetch('/api/admin/backup', { method: 'POST' })
  if (json?.ok) {
    alert(`Backup cr\u00e9\u00e9 : ${json.data.filename} (${fmtBytes(json.data.size)})`)
    loadMaintenance()
  } else {
    alert('Erreur: ' + (json?.error || 'inconnue'))
  }
}

export async function deleteBackup(filename) {
  if (!confirm(`Supprimer le backup ${filename} ?`)) return
  const json = await apiFetch(`/api/admin/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' })
  if (json?.ok) loadMaintenance()
  else alert('Erreur: ' + (json?.error || 'inconnue'))
}

export async function cleanupLogs() {
  if (!confirm('Supprimer tous les fichiers de logs ?')) return
  const json = await apiFetch('/api/admin/cleanup-logs', { method: 'POST' })
  if (json?.ok) { alert(`${json.data.deleted} fichiers supprim\u00e9s`); loadMaintenance() }
  else alert('Erreur: ' + (json?.error || 'inconnue'))
}

export async function resetSeed() {
  if (!confirm('ATTENTION : Ceci va supprimer TOUTES les donn\u00e9es.\n\nContinuer ?')) return
  if (!confirm('Derni\u00e8re chance. \u00cates-vous absolument s\u00fbr ?')) return
  const json = await apiFetch('/api/admin/reset-seed', { method: 'POST' })
  if (json?.ok) { alert('Base de donn\u00e9es r\u00e9initialis\u00e9e.'); location.reload() }
  else alert('Erreur: ' + (json?.error || 'inconnue'))
}

export async function purgeOldData() {
  if (!confirm('Purger les donn\u00e9es anciennes ?\n\n- Audit > 90 jours\n- Tentatives login > 30 jours\n- Sessions > 30 jours\n- Signalements trait\u00e9s > 90 jours')) return
  const json = await apiFetch('/api/admin/purge', { method: 'POST', body: JSON.stringify({}) })
  if (json?.ok) {
    const d = json.data
    alert(`Purge termin\u00e9e :\n- ${d.audit} entr\u00e9es audit\n- ${d.logins} tentatives login\n- ${d.sessions} sessions\n- ${d.reports} signalements`)
    loadMaintenance()
  } else alert('Erreur: ' + (json?.error || 'inconnue'))
}
