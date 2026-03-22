import { apiFetch, escHtml, fmtBytes, fmtDate, skeleton, toast, confirmAction } from '../app.js'

export async function loadMaintenance() {
  const el = document.getElementById('maintenance-content')
  el.innerHTML = skeleton(6)

  const [backupsJson, dbInfoJson, configJson] = await Promise.all([
    apiFetch('/api/admin/backups'),
    apiFetch('/api/admin/db-info'),
    apiFetch('/api/admin/config'),
  ])

  const backups  = backupsJson?.ok ? backupsJson.data : []
  const dbInfo   = dbInfoJson?.ok ? dbInfoJson.data : []
  const readOnly = configJson?.ok ? configJson.data.read_only : false

  // Calculate total DB rows
  const totalRows = dbInfo.reduce((sum, t) => sum + t.rowCount, 0)

  el.innerHTML = `
    <div class="grid">
      <div class="card">
        <div class="card-title">Mode plateforme</div>
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:.5rem">
          <label class="toggle">
            <input type="checkbox" ${readOnly ? 'checked' : ''} onchange="toggleReadOnly(this.checked)">
            <span class="toggle-slider"></span>
          </label>
          <span style="font-size:.85rem">${readOnly ? '<span style="color:var(--orange);font-weight:600">\ud83d\udd12 Lecture seule</span>' : '\u2705 Mode normal'}</span>
        </div>
        <div class="card-sub">En mode lecture seule, les \u00e9tudiants ne peuvent plus poster de messages ni soumettre de d\u00e9p\u00f4ts.</div>
      </div>

      <div class="card">
        <div class="card-title">Politique de r\u00e9tention</div>
        <button class="btn btn-primary" onclick="purgeOldData()" style="margin-bottom:.5rem">Purger les donn\u00e9es anciennes</button>
        <div class="card-sub">Audit &gt; 90j \u2022 Logins &gt; 30j \u2022 Sessions &gt; 30j \u2022 Visites &gt; 90j</div>
      </div>
    </div>

    <div class="grid" style="margin-top:1rem">
      <div class="card">
        <div class="card-title">Sauvegardes</div>
        <button class="btn btn-primary btn-sm" onclick="createBackup()" style="margin-bottom:.75rem">Cr\u00e9er un backup</button>
        ${backups.length ? `<table class="data-table">
          <tr><th>Fichier</th><th>Taille</th><th>Date</th><th style="text-align:right">Actions</th></tr>
          ${backups.map(b => `<tr>
            <td style="font-size:.8rem;font-family:monospace">${escHtml(b.filename)}</td>
            <td style="font-size:.8rem">${fmtBytes(b.size)}</td>
            <td style="font-size:.75rem">${fmtDate(b.created)}</td>
            <td style="text-align:right"><div class="row-actions" style="justify-content:flex-end"><button class="btn btn-danger btn-sm" onclick="deleteBackup('${escHtml(b.filename)}')">Suppr.</button></div></td>
          </tr>`).join('')}
        </table>` : '<div class="card-sub" style="color:var(--text-muted)">Aucun backup</div>'}
      </div>

      <div class="card">
        <div class="card-title">Base de donn\u00e9es <span style="font-size:.65rem;color:var(--text-muted);text-transform:none;letter-spacing:0;font-weight:400">(${totalRows.toLocaleString('fr-FR')} lignes)</span></div>
        <div style="display:flex;flex-direction:column;gap:.3rem">
          ${dbInfo.map(t => `<div style="display:flex;align-items:center;justify-content:space-between;padding:.3rem .5rem;background:var(--bg);border-radius:4px;font-size:.8rem">
            <span style="font-family:monospace;font-size:.75rem">${escHtml(t.name)}</span>
            <span style="font-weight:600;min-width:40px;text-align:right">${t.rowCount.toLocaleString('fr-FR')}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>

    <div class="grid" style="margin-top:1rem">
      <div class="card">
        <div class="card-title">Actions de maintenance</div>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap">
          <button class="btn" style="background:var(--orange);color:#fff" onclick="cleanupLogs()">\ud83e\uddf9 Nettoyer les logs</button>
          <button class="btn btn-danger" onclick="resetSeed()">\u26a0\ufe0f Reset & Seed BDD</button>
        </div>
        <div class="card-sub" style="margin-top:.75rem;color:var(--red);font-size:.75rem">
          Reset & Seed supprimera <strong>toutes</strong> les donn\u00e9es et recr\u00e9era les donn\u00e9es de d\u00e9mo.
        </div>
      </div>
    </div>`
}

export async function createBackup() {
  const json = await apiFetch('/api/admin/backup', { method: 'POST' })
  if (json?.ok) {
    toast(`Backup cr\u00e9\u00e9 : ${json.data.filename} (${fmtBytes(json.data.size)})`, 'success')
    loadMaintenance()
  } else {
    toast(json?.error || 'Erreur', 'error')
  }
}

export async function deleteBackup(filename) {
  const ok = await confirmAction(`Supprimer le backup ${filename} ?`, { title: 'Supprimer le backup', danger: true, confirmText: 'Supprimer' })
  if (!ok) return
  const json = await apiFetch(`/api/admin/backups/${encodeURIComponent(filename)}`, { method: 'DELETE' })
  if (json?.ok) { toast('Backup supprim\u00e9', 'success'); loadMaintenance() }
  else toast(json?.error || 'Erreur', 'error')
}

export async function cleanupLogs() {
  const ok = await confirmAction('Supprimer tous les fichiers de logs ?', { title: 'Nettoyer les logs', confirmText: 'Nettoyer' })
  if (!ok) return
  const json = await apiFetch('/api/admin/cleanup-logs', { method: 'POST' })
  if (json?.ok) { toast(`${json.data.deleted} fichiers supprim\u00e9s`, 'success'); loadMaintenance() }
  else toast(json?.error || 'Erreur', 'error')
}

export async function resetSeed() {
  const ok = await confirmAction('ATTENTION : Ceci va supprimer TOUTES les donn\u00e9es de la base et recr\u00e9er les donn\u00e9es de d\u00e9mo.\n\n\u00cates-vous absolument s\u00fbr ?', { title: '\u26a0\ufe0f Reset complet', danger: true, confirmText: 'Reset & Seed' })
  if (!ok) return
  const ok2 = await confirmAction('Derni\u00e8re confirmation. Cette action est irr\u00e9versible.', { title: 'Confirmation finale', danger: true, confirmText: 'Confirmer le reset' })
  if (!ok2) return
  const json = await apiFetch('/api/admin/reset-seed', { method: 'POST' })
  if (json?.ok) { toast('Base de donn\u00e9es r\u00e9initialis\u00e9e', 'success'); setTimeout(() => location.reload(), 1500) }
  else toast(json?.error || 'Erreur', 'error')
}

export async function purgeOldData() {
  const ok = await confirmAction('Purger les donn\u00e9es anciennes ?\n\n\u2022 Audit > 90 jours\n\u2022 Tentatives login > 30 jours\n\u2022 Sessions > 30 jours\n\u2022 Visites > 90 jours', { title: 'Purger les donn\u00e9es', confirmText: 'Purger' })
  if (!ok) return
  const json = await apiFetch('/api/admin/purge', { method: 'POST', body: JSON.stringify({}) })
  if (json?.ok) {
    const d = json.data
    const total = (d.audit || 0) + (d.logins || 0) + (d.sessions || 0) + (d.reports || 0) + (d.visits || 0)
    toast(`${total} entr\u00e9es purg\u00e9es`, 'success')
    loadMaintenance()
  } else toast(json?.error || 'Erreur', 'error')
}
