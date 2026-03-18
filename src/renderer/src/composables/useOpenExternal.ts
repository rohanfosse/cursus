import { useToast }    from './useToast'
import { useAppStore } from '@/stores/app'

function normalizeUrl(url: string): string {
  const u = url.trim()
  if (!u) return u
  return /^(https?:\/\/|mailto:)/i.test(u) ? u : 'https://' + u
}

export function useOpenExternal() {
  const { showToast } = useToast()
  const appStore = useAppStore()

  async function openExternal(rawUrl: string): Promise<boolean> {
    const url = normalizeUrl(rawUrl)
    if (!url) {
      showToast('Lien vide.')
      return false
    }
    if (!appStore.isOnline) {
      showToast('Hors-ligne — impossible d\'ouvrir le lien externe.', 'error')
      return false
    }
    const res = await window.api.openExternal(url)
    if (!res?.ok) {
      showToast(res?.error ?? 'Impossible d\'ouvrir le lien.')
      return false
    }
    showToast('Lien ouvert dans le navigateur.', 'success')
    return true
  }

  return { openExternal }
}
