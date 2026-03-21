import { apiFetch } from '../app.js'
import { loadStats } from './stats.js'

export async function checkReadOnlyBanner() {
  try {
    const json = await apiFetch('/api/admin/config')
    const banner = document.getElementById('readonly-banner')
    if (json?.ok && json.data.read_only) {
      banner.style.display = 'block'
    } else {
      banner.style.display = 'none'
    }
  } catch {}
}

export async function toggleReadOnly(checked) {
  await apiFetch('/api/admin/config', { method: 'POST', body: JSON.stringify({ key: 'read_only', value: checked ? '1' : '0' }) })
  checkReadOnlyBanner()
}

export async function toggleArchivePromo(promoId, archived) {
  await apiFetch(`/api/admin/promos/${promoId}/archive`, { method: 'POST', body: JSON.stringify({ archived }) })
  loadStats()
}
