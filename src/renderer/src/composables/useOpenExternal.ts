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

  function openExternal(rawUrl: string): boolean {
    const url = normalizeUrl(rawUrl)
    if (!url) {
      showToast('Lien vide.')
      return false
    }
    if (!appStore.isOnline) {
      showToast('Hors-ligne — impossible d\'ouvrir le lien externe.', 'error')
      return false
    }
    // Call synchronously to stay within the user gesture for popup blocker
    const res = window.api.openExternal(url)
    // Handle the promise result asynchronously for error feedback
    Promise.resolve(res).then((r) => {
      if (!r?.ok) {
        showToast(r?.error ?? 'Impossible d\'ouvrir le lien.', 'error')
      }
    })
    return true
  }

  return { openExternal }
}
