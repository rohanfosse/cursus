import { apiFetch, escHtml, fmtDate, pagination, tabLoaded } from '../app.js'

let usersPage = 1

export async function loadUsers(page) {
  usersPage = page || 1
  const el = document.getElementById('users-content')
  el.innerHTML = 'Chargement...'

  // Load promo filter options
  if (!tabLoaded.usersPromos) {
    try {
      const sJson = await apiFetch('/api/admin/stats')
      if (sJson?.ok) {
        const sel = document.getElementById('user-promo-filter')
        const sel2 = document.getElementById('mod-promo-filter')
        sJson.data.promosSummary.forEach(p => {
          sel.innerHTML += `<option value="${p.id}">${escHtml(p.name)}</option>`
          sel2.innerHTML += `<option value="${p.id}">${escHtml(p.name)}</option>`
        })
        tabLoaded.usersPromos = true
      }
    } catch {}
  }

  const search  = document.getElementById('user-search').value
  const type    = document.getElementById('user-type-filter').value
  const promoId = document.getElementById('user-promo-filter').value
  const params  = new URLSearchParams({ page: usersPage, limit: 50 })
  if (search)  params.set('search', search)
  if (type)    params.set('type', type)
  if (promoId) params.set('promo_id', promoId)

  const json = await apiFetch(`/api/admin/users?${params}`)
  if (!json?.ok) { el.innerHTML = 'Erreur de chargement'; return }
  const { users, total, page: pg, limit } = json.data

  el.innerHTML = `
    <table class="data-table">
      <tr><th>Nom</th><th>Email</th><th>Type</th><th>Promotion</th><th>Actions</th></tr>
      ${users.map(u => `<tr>
        <td><strong>${escHtml(u.name)}</strong></td>
        <td style="color:var(--text-secondary)">${escHtml(u.email)}</td>
        <td><span class="badge ${u.type}">${u.type}</span></td>
        <td>${u.promo_name ? escHtml(u.promo_name) : '\u2014'}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="showUserDetail(${u.id})">D\u00e9tail</button>
          <button class="btn btn-sm" style="background:var(--orange);color:#fff" onclick="resetUserPassword(${u.id}, '${escHtml(u.name)}')">Reset MDP</button>
          ${u.type !== 'teacher' ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${escHtml(u.name)}')">Suppr.</button>` : ''}
        </td>
      </tr>`).join('')}
    </table>
    ${pagination(total, pg, limit, 'loadUsers')}`
}

export async function showUserDetail(userId) {
  const { showModal, closeModal } = await import('../app.js')
  const json = await apiFetch(`/api/admin/users/${userId}`)
  if (!json?.ok) return
  const u = json.data
  showModal(`<div class="modal-overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <h3>${escHtml(u.name)}</h3>
      <table class="data-table" style="margin-bottom:1rem">
        <tr><td style="color:var(--text-muted)">Email</td><td>${escHtml(u.email)}</td></tr>
        <tr><td style="color:var(--text-muted)">Type</td><td><span class="badge ${u.type}">${u.type}</span></td></tr>
        <tr><td style="color:var(--text-muted)">Promotion</td><td>${u.promo_name || '\u2014'}</td></tr>
        <tr><td style="color:var(--text-muted)">Messages</td><td>${u.messageCount}</td></tr>
        <tr><td style="color:var(--text-muted)">D\u00e9p\u00f4ts</td><td>${u.depotCount}</td></tr>
        <tr><td style="color:var(--text-muted)">Dernier message</td><td>${fmtDate(u.lastMessageAt)}</td></tr>
      </table>
      <div class="modal-actions"><button class="btn btn-primary" onclick="closeModal()">Fermer</button></div>
    </div>
  </div>`)
}

export async function resetUserPassword(userId, name) {
  if (!confirm(`R\u00e9initialiser le mot de passe de ${name} ?`)) return
  const json = await apiFetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' })
  if (json?.ok) {
    alert(`Nouveau mot de passe temporaire :\n\n${json.data.tempPassword}\n\nL'utilisateur devra le changer \u00e0 la prochaine connexion.`)
  } else {
    alert('Erreur: ' + (json?.error || 'inconnue'))
  }
}

export async function deleteUser(userId, name) {
  if (!confirm(`Supprimer d\u00e9finitivement ${name} ? Cette action est irr\u00e9versible.`)) return
  const json = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
  if (json?.ok) loadUsers(usersPage)
  else alert('Erreur: ' + (json?.error || 'inconnue'))
}
