import { apiFetch, escHtml, fmtDate, skeleton, emptyState, toast, confirmAction, pagination } from '../app.js'

let errorsPage = 1

export async function loadErrors(page = 1) {
  errorsPage = page
  const el = document.getElementById('errors-content')
  el.innerHTML = skeleton(5)
  try {
    const limit = 50
    const offset = (page - 1) * limit
    const data = await apiFetch(`/api/admin/error-reports?limit=${limit}&offset=${offset}`)
    if (!data || !data.ok) {
      el.innerHTML = emptyState(data?.error || 'Erreur de chargement', '\u26a0\ufe0f')
      return
    }
    const { items, total } = data.data

    // Badge
    const badge = document.getElementById('errors-badge')
    if (badge) {
      if (total > 0) {
        badge.textContent = total > 99 ? '99+' : total
        badge.style.display = ''
      } else {
        badge.style.display = 'none'
      }
    }

    if (!items.length) {
      el.innerHTML = emptyState('Aucune erreur enregistree', '\u2705')
      return
    }

    let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <span style="color:var(--text-secondary);font-size:.85rem">${total} erreur${total > 1 ? 's' : ''} enregistree${total > 1 ? 's' : ''}</span>
      <button class="btn btn-sm" style="background:var(--red,#ef4444);color:#fff" onclick="clearErrors()">Vider tout</button>
    </div>`

    html += `<div class="table-wrap"><table>
      <thead><tr>
        <th>Date</th>
        <th>Utilisateur</th>
        <th>Page</th>
        <th>Message</th>
        <th>Stack</th>
        <th>Version</th>
      </tr></thead><tbody>`

    for (const err of items) {
      const stackPreview = err.stack ? escHtml(err.stack.substring(0, 80)) + (err.stack.length > 80 ? '...' : '') : '\u2014'
      const userName = err.user_name ? `${escHtml(err.user_name)} <span style="color:var(--text-muted);font-size:.75rem">(${escHtml(err.user_type || '?')})</span>` : '<span style="color:var(--text-muted)">anonyme</span>'
      html += `<tr>
        <td style="white-space:nowrap;font-size:.8rem">${fmtDate(err.created_at)}</td>
        <td>${userName}</td>
        <td style="font-size:.8rem;max-width:120px;overflow:hidden;text-overflow:ellipsis">${err.page ? escHtml(err.page) : '\u2014'}</td>
        <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;font-size:.8rem" title="${escHtml(err.message)}">${escHtml(err.message.substring(0, 120))}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;font-size:.75rem;color:var(--text-muted);cursor:pointer" onclick="showErrorStack(${err.id})" title="Cliquer pour voir le stack complet">${stackPreview}</td>
        <td style="font-size:.75rem;color:var(--text-muted)">${err.app_version ? escHtml(err.app_version) : '\u2014'}</td>
      </tr>`
    }

    html += `</tbody></table></div>`
    html += pagination(total, page, 50, 'loadErrors')
    el.innerHTML = html

    // Stocker les items pour le detail stack
    window._errorItems = items
  } catch (e) {
    el.innerHTML = emptyState('Erreur reseau', '\u26a0\ufe0f')
  }
}

export async function clearErrors() {
  const ok = await confirmAction('Supprimer toutes les erreurs enregistrees ?', {
    title: 'Vider les erreurs',
    danger: true,
    confirmText: 'Vider',
  })
  if (!ok) return
  const r = await apiFetch('/api/admin/error-reports', { method: 'DELETE' })
  if (r?.ok) {
    toast('Erreurs supprimees', 'success')
    loadErrors()
  } else {
    toast(r?.error || 'Erreur', 'error')
  }
}

export function showErrorStack(id) {
  const items = window._errorItems || []
  const err = items.find(e => e.id === id)
  if (!err) return
  const { showModal } = window
  showModal(`<div class="modal-overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal" style="max-width:700px;max-height:80vh;overflow:auto">
      <h3 style="margin-bottom:.75rem">Erreur #${err.id}</h3>
      <div style="font-size:.85rem;margin-bottom:.5rem"><strong>Message :</strong> ${escHtml(err.message)}</div>
      <div style="font-size:.8rem;margin-bottom:.5rem;color:var(--text-secondary)"><strong>Page :</strong> ${err.page ? escHtml(err.page) : '\u2014'} | <strong>Date :</strong> ${fmtDate(err.created_at)}</div>
      <div style="font-size:.8rem;margin-bottom:.5rem;color:var(--text-secondary)"><strong>User-Agent :</strong> ${err.user_agent ? escHtml(err.user_agent) : '\u2014'}</div>
      <pre style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:.75rem;font-size:.75rem;overflow-x:auto;white-space:pre-wrap;max-height:400px">${err.stack ? escHtml(err.stack) : 'Pas de stack trace'}</pre>
      <div class="modal-actions" style="margin-top:1rem">
        <button class="btn" style="background:var(--border);color:var(--text)" onclick="closeModal()">Fermer</button>
      </div>
    </div>
  </div>`)
}

export async function checkErrorsBadge() {
  try {
    const data = await apiFetch('/api/admin/error-reports?limit=1&offset=0')
    const badge = document.getElementById('errors-badge')
    if (!badge) return
    if (data?.ok && data.data.total > 0) {
      badge.textContent = data.data.total > 99 ? '99+' : data.data.total
      badge.style.display = ''
    } else {
      badge.style.display = 'none'
    }
  } catch {}
}
