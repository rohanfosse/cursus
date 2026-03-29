import { apiFetch, toast } from '../app.js'

const MODULES = [
  { key: 'kanban', label: 'Kanban projet', desc: 'Tableau kanban pour la gestion de projet en groupe' },
  { key: 'frise', label: 'Frise chronologique', desc: 'Vue timeline des evenements et jalons' },
  { key: 'rex', label: 'Retour d\'experience', desc: 'Sessions REX anonymes avec collecte de feedback' },
  { key: 'live', label: 'Quiz interactif', desc: 'Quiz en direct type Kahoot pour les cours' },
  { key: 'signatures', label: 'Signature PDF', desc: 'Demandes de signature electronique de documents' },
]

export async function loadModulesConfig() {
  const container = document.getElementById('modules-config-content')
  if (!container) return

  // Recuperer le role pour savoir si les toggles sont modifiables
  let isAdmin = false
  try {
    const me = await apiFetch('/api/admin/me')
    isAdmin = me?.ok && me.data?.type === 'admin'
  } catch { /* non-admin par defaut */ }

  const res = await apiFetch('/api/admin/modules')
  if (!res?.ok) {
    container.innerHTML = '<p style="color:var(--red)">Erreur chargement modules</p>'
    return
  }

  container.innerHTML = `
    <p class="modules-intro">
      ${isAdmin
        ? 'Activez ou desactivez les modules enrichissement. Les modules desactives sont masques pour tous les utilisateurs (enseignants et etudiants).'
        : 'Etat des modules enrichissement. Seul l\'administrateur systeme peut les activer ou desactiver.'}
      Les fonctions responsable (chat, devoirs, documents, tableau de bord) restent toujours actives.
    </p>
    ${MODULES.map(m => `
      <div class="module-row">
        <div class="module-info">
          <strong>${m.label}</strong>
          <span class="module-desc">${m.desc}</span>
        </div>
        <label class="toggle">
          <input type="checkbox" ${res.data[m.key] ? 'checked' : ''}
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
