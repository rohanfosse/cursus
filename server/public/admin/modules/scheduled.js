import { apiFetch, escHtml, fmtDate, showModal, closeModal } from '../app.js'

export async function loadScheduled() {
  const el = document.getElementById('scheduled-content')
  el.innerHTML = 'Chargement...'
  const json = await apiFetch('/api/admin/scheduled')
  if (!json?.ok) { el.innerHTML = 'Erreur'; return }
  const msgs = json.data

  if (!msgs.length) { el.innerHTML = '<div class="card"><div class="card-sub">Aucune annonce planifi\u00e9e</div></div>'; return }

  el.innerHTML = `<table class="data-table">
    <tr><th>Envoi pr\u00e9vu</th><th>Canal</th><th>Promo</th><th>Message</th><th>Status</th><th>Actions</th></tr>
    ${msgs.map(m => `<tr>
      <td style="white-space:nowrap;font-size:.75rem">${fmtDate(m.send_at)}</td>
      <td>${escHtml(m.channel_name)}</td>
      <td style="color:var(--text-secondary)">${escHtml(m.promo_name)}</td>
      <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(m.content.substring(0, 150))}</td>
      <td>${m.sent ? '<span class="badge online">Envoy\u00e9</span>' : '<span class="badge warn">En attente</span>'}</td>
      <td>${!m.sent ? `<button class="btn btn-danger btn-sm" onclick="cancelScheduled(${m.id})">Annuler</button>` : ''}</td>
    </tr>`).join('')}
  </table>`
}

export async function showScheduleModal() {
  // Charger la liste des canaux d'annonce
  const cJson = await apiFetch('/api/admin/channels')
  const channels = cJson?.ok ? cJson.data.filter(c => c.type === 'annonce') : []

  showModal(`<div class="modal-overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <h3>Planifier une annonce</h3>
      <label style="font-size:.75rem;color:var(--text-muted)">Canal d'annonce</label>
      <select id="sched-channel">
        ${channels.map(c => `<option value="${c.id}">${escHtml(c.name)} (${escHtml(c.promo_name)})</option>`).join('')}
        ${!channels.length ? '<option disabled>Aucun canal d\'annonce</option>' : ''}
      </select>
      <label style="font-size:.75rem;color:var(--text-muted)">Date et heure d'envoi</label>
      <input type="datetime-local" id="sched-date" />
      <label style="font-size:.75rem;color:var(--text-muted)">Message</label>
      <textarea id="sched-content" rows="4" placeholder="Contenu de l'annonce..."></textarea>
      <div class="modal-actions">
        <button class="btn" style="background:var(--border);color:var(--text)" onclick="closeModal()">Annuler</button>
        <button class="btn btn-primary" onclick="submitScheduled()">Planifier</button>
      </div>
    </div>
  </div>`)
}

export async function submitScheduled() {
  const channelId = document.getElementById('sched-channel')?.value
  const sendAt = document.getElementById('sched-date')?.value
  const content = document.getElementById('sched-content')?.value
  if (!channelId || !sendAt || !content) { alert('Tous les champs sont requis.'); return }
  const json = await apiFetch('/api/admin/scheduled', {
    method: 'POST', body: JSON.stringify({ channelId: Number(channelId), content, sendAt }),
  })
  if (json?.ok) { closeModal(); loadScheduled() }
  else alert('Erreur: ' + (json?.error || 'inconnue'))
}

export async function cancelScheduled(id) {
  if (!confirm('Annuler cette annonce planifi\u00e9e ?')) return
  await apiFetch(`/api/admin/scheduled/${id}`, { method: 'DELETE' })
  loadScheduled()
}
