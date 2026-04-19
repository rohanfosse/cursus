import { apiFetch, toast } from '../app.js'

export async function loadModulesConfig() {
  const container = document.getElementById('modules-config-content')
  if (!container) return

  // Recuperer le role pour savoir si les toggles sont modifiables
  let isAdmin = false
  try {
    const me = await apiFetch('/api/admin/me')
    isAdmin = me?.ok && me.data?.type === 'admin'
  } catch { /* non-admin par defaut */ }

  const [states, meta] = await Promise.all([
    apiFetch('/api/admin/modules'),
    apiFetch('/api/admin/modules/meta'),
  ])
  if (!states?.ok || !meta?.ok) {
    container.innerHTML = '<p style="color:var(--red)">Erreur chargement modules</p>'
    return
  }

  const modules = Object.entries(meta.data).map(([key, m]) => ({ key, ...m }))

  container.innerHTML = `
    <p class="modules-intro">
      ${isAdmin
        ? 'Activez ou desactivez les modules enrichissement. Les modules desactives sont masques pour tous les utilisateurs (enseignants et etudiants).'
        : 'Etat des modules enrichissement. Seul l\'administrateur systeme peut les activer ou desactiver.'}
      Les fonctions responsable (chat, devoirs, documents, tableau de bord) restent toujours actives.
    </p>
    ${modules.map(m => `
      <div class="module-row">
        <div class="module-info">
          <strong>${m.label}</strong>
          <span class="module-desc">${m.desc}</span>
        </div>
        <label class="toggle">
          <input type="checkbox" ${states.data[m.key] ? 'checked' : ''}
                 ${!isAdmin ? 'disabled' : ''}
                 data-module="${m.key}"
                 onchange="window.toggleModule('${m.key}', this.checked)" />
          <span class="toggle-slider"></span>
        </label>
      </div>
    `).join('')}
  `
}

export async function toggleModule(key, enabled) {
  const res = await apiFetch('/api/admin/modules', {
    method: 'POST',
    body: JSON.stringify({ module: key, enabled }),
  })
  if (res?.ok) {
    toast(`Module "${key}" ${enabled ? 'active' : 'desactive'}`, 'success')
  } else {
    toast(res?.error || 'Erreur', 'error')
    // Revert checkbox
    const cb = document.querySelector(`[data-module="${key}"]`)
    if (cb) cb.checked = !enabled
  }
}
