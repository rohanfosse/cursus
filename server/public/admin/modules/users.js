import { apiFetch, escHtml, fmtDate, timeAgo, pagination, tabLoaded, avatar, skeleton, emptyState, toast, confirmAction } from '../app.js'

let usersPage = 1

export async function loadUsers(page) {
  usersPage = page || 1
  const el = document.getElementById('users-content')
  el.innerHTML = skeleton(8)

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
  if (!json?.ok) { el.innerHTML = emptyState('Erreur de chargement', '\u26a0\ufe0f'); return }
  const { users, total, page: pg, limit } = json.data

  if (!users.length) { el.innerHTML = emptyState('Aucun utilisateur trouv\u00e9', '\ud83d\udc64'); return }

  el.innerHTML = `
    <table class="data-table">
      <tr><th>Utilisateur</th><th>Email</th><th>Type</th><th>Promotion</th><th style="text-align:right">Actions</th></tr>
      ${users.map(u => `<tr>
        <td><div class="user-cell">${avatar(u.name, u.type, 28)}<strong>${escHtml(u.name)}</strong></div></td>
        <td style="color:var(--text-secondary)">${escHtml(u.email)}</td>
        <td><span class="badge ${u.type}">${u.type}</span></td>
        <td>${u.promo_name ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${u.promo_color || 'var(--accent)'};margin-right:4px;vertical-align:middle"></span>${escHtml(u.promo_name)}` : '\u2014'}</td>
        <td style="text-align:right"><div class="row-actions" style="justify-content:flex-end">
          <button class="btn btn-primary btn-sm" onclick="showUserDetail(${u.id})">D\u00e9tail</button>
          <button class="btn btn-sm" style="background:var(--orange);color:#fff" onclick="resetUserPassword(${u.id}, '${escHtml(u.name)}')">Reset MDP</button>
          ${u.type !== 'teacher' ? `<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id}, '${escHtml(u.name)}')">Suppr.</button>` : ''}
        </div></td>
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
    <div class="modal" style="min-width:440px">
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem">
        ${avatar(u.name, u.type, 48)}
        <div>
          <h3 style="margin:0;font-size:1.1rem">${escHtml(u.name)}</h3>
          <div style="font-size:.8rem;color:var(--text-secondary);margin-top:2px">${escHtml(u.email)}</div>
        </div>
      </div>
      <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:.75rem;margin-bottom:1rem">
        <div class="counter" style="padding:.65rem">
          <div class="counter-value" style="font-size:1.3rem">${u.messageCount}</div>
          <div class="counter-label">Messages</div>
        </div>
        <div class="counter" style="padding:.65rem">
          <div class="counter-value" style="font-size:1.3rem">${u.depotCount}</div>
          <div class="counter-label">D\u00e9p\u00f4ts</div>
        </div>
        <div class="counter" style="padding:.65rem">
          <div class="counter-value" style="font-size:.85rem;margin-top:.2rem">${timeAgo(u.lastMessageAt)}</div>
          <div class="counter-label">Dernier msg</div>
        </div>
      </div>
      <table class="data-table" style="margin-bottom:1rem">
        <tr><td style="color:var(--text-muted)">Type</td><td><span class="badge ${u.type}">${u.type}</span></td></tr>
        <tr><td style="color:var(--text-muted)">Promotion</td><td>${u.promo_name || '\u2014'}</td></tr>
      </table>
      <div class="modal-actions"><button class="btn btn-primary" onclick="closeModal()">Fermer</button></div>
    </div>
  </div>`)
}

export async function resetUserPassword(userId, name) {
  const ok = await confirmAction(`R\u00e9initialiser le mot de passe de ${name} ?`, { title: 'Reset mot de passe', confirmText: 'R\u00e9initialiser' })
  if (!ok) return
  const json = await apiFetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' })
  if (json?.ok) {
    const pwd = json.data.tempPassword
    const { showModal, closeModal } = await import('../app.js')
    showModal(`<div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal confirm-modal">
        <h3>Mot de passe r\u00e9initialis\u00e9</h3>
        <p style="color:var(--text-secondary);font-size:.85rem;margin-bottom:.75rem">Nouveau mot de passe temporaire pour <strong>${escHtml(name)}</strong> :</p>
        <div style="display:flex;align-items:center;gap:.5rem;background:var(--bg);padding:.6rem .8rem;border-radius:var(--radius-sm);border:1px solid var(--border)">
          <code style="flex:1;font-size:1rem;font-weight:700;letter-spacing:.05em">${escHtml(pwd)}</code>
          <button class="copy-btn" onclick="navigator.clipboard.writeText('${escHtml(pwd)}').then(()=>{this.textContent='Copi\u00e9 !';this.classList.add('copied')})">Copier</button>
        </div>
        <p style="color:var(--text-muted);font-size:.75rem;margin-top:.5rem">L'utilisateur devra changer ce mot de passe \u00e0 sa prochaine connexion.</p>
        <div class="modal-actions" style="margin-top:1rem"><button class="btn btn-primary" onclick="closeModal()">Fermer</button></div>
      </div>
    </div>`)
  } else {
    toast(json?.error || 'Erreur inconnue', 'error')
  }
}

export async function deleteUser(userId, name) {
  const ok = await confirmAction(`Supprimer d\u00e9finitivement ${name} ? Cette action est irr\u00e9versible.`, { title: 'Supprimer l\'utilisateur', danger: true, confirmText: 'Supprimer' })
  if (!ok) return
  const json = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
  if (json?.ok) { toast(`${name} supprim\u00e9`, 'success'); loadUsers(usersPage) }
  else toast(json?.error || 'Erreur', 'error')
}
