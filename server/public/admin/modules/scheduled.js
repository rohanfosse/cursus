import { apiFetch, escHtml, fmtDate, timeAgo, showModal, closeModal, skeleton, emptyState, toast, confirmAction } from '../app.js'

export async function loadScheduled() {
  const el = document.getElementById('scheduled-content')
  el.innerHTML = skeleton(4)
  const json = await apiFetch('/api/admin/scheduled')
  if (!json?.ok) { el.innerHTML = emptyState('Erreur', '\u26a0\ufe0f'); return }
  const msgs = json.data

  if (!msgs.length) { el.innerHTML = emptyState('Aucune annonce planifi\u00e9e', '\ud83d\udce2'); return }

  // Separate pending and sent
  const pending = msgs.filter(m => !m.sent)
  const sent = msgs.filter(m => m.sent)

  let html = ''
  if (pending.length) {
    html += `<div class="section-title" style="font-size:.8rem">En attente (${pending.length})</div>
    <div style="display:flex;flex-direction:column;gap:.5rem;margin-bottom:1.5rem">
      ${pending.map(m => `<div class="card" style="padding:.85rem;border-left:3px solid var(--orange)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.4rem">
          <div style="display:flex;align-items:center;gap:.5rem">
            <span class="badge warn">En attente</span>
            <span style="font-size:.75rem;color:var(--text-secondary)">${escHtml(m.channel_name)} \u2022 ${escHtml(m.promo_name)}</span>
          </div>
          <button class="btn btn-danger btn-sm" onclick="cancelScheduled(${m.id})">Annuler</button>
        </div>
        <div style="font-size:.8rem;margin-bottom:.3rem">${escHtml(m.content.substring(0, 200))}</div>
        <div style="font-size:.7rem;color:var(--text-muted)">Envoi pr\u00e9vu : ${fmtDate(m.send_at)}</div>
      </div>`).join('')}
    </div>`
  }

  if (sent.length) {
    html += `<div class="section-title" style="font-size:.8rem">Envoy\u00e9es (${sent.length})</div>
    <table class="data-table">
      <tr><th>Date d'envoi</th><th>Canal</th><th>Message</th></tr>
      ${sent.map(m => `<tr>
        <td style="white-space:nowrap;font-size:.75rem" title="${fmtDate(m.send_at)}">${timeAgo(m.send_at)}</td>
        <td style="font-size:.8rem">${escHtml(m.channel_name)} <span style="color:var(--text-muted)">(${escHtml(m.promo_name)})</span></td>
        <td style="max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem">${escHtml(m.content.substring(0, 150))}</td>
      </tr>`).join('')}
    </table>`
  }

  el.innerHTML = html
}

export async function showScheduleModal() {
  const cJson = await apiFetch('/api/admin/channels')
  const channels = cJson?.ok ? cJson.data.filter(c => c.type === 'annonce') : []

  showModal(`<div class="modal-overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <h3>Planifier une annonce</h3>
      <label style="font-size:.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.2rem;display:block">Canal d'annonce</label>
      <select id="sched-channel">
        ${channels.map(c => `<option value="${c.id}">${escHtml(c.name)} (${escHtml(c.promo_name)})</option>`).join('')}
        ${!channels.length ? '<option disabled>Aucun canal d\'annonce</option>' : ''}
      </select>
      <label style="font-size:.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.2rem;display:block">Date et heure d'envoi</label>
      <input type="datetime-local" id="sched-date" />
      <label style="font-size:.7rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.2rem;display:block">Message</label>
      <textarea id="sched-content" rows="4" placeholder="Contenu de l'annonce..." style="resize:vertical"></textarea>
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
  if (!channelId || !sendAt || !content) { toast('Tous les champs sont requis', 'warn'); return }
  const json = await apiFetch('/api/admin/scheduled', {
    method: 'POST', body: JSON.stringify({ channelId: Number(channelId), content, sendAt }),
  })
  if (json?.ok) { closeModal(); toast('Annonce planifi\u00e9e', 'success'); loadScheduled() }
  else toast(json?.error || 'Erreur', 'error')
}

export async function cancelScheduled(id) {
  const ok = await confirmAction('Annuler cette annonce planifi\u00e9e ?', { title: 'Annuler l\'annonce', danger: true, confirmText: 'Annuler l\'annonce' })
  if (!ok) return
  await apiFetch(`/api/admin/scheduled/${id}`, { method: 'DELETE' })
  toast('Annonce annul\u00e9e', 'success')
  loadScheduled()
}
