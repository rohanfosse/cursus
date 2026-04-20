/**
 * useSlashFocusSearch - raccourci '/' pour focaliser un champ de recherche.
 *
 * Convention partagee entre les vues principales (devoirs, documents, fichiers,
 * messages, cahier...) pour offrir une UX clavier homogene. Ignore les frappes
 * deja dans un input, la composition IME et les combinaisons avec Ctrl/Meta/Alt.
 *
 * Usage :
 *   const searchEl = ref<HTMLInputElement | null>(null)
 *   useSlashFocusSearch(() => searchEl.value)
 *   // ou par selecteur :
 *   useSlashFocusSearch('.my-search-input')
 */
import { onMounted, onBeforeUnmount } from 'vue'

type Target = string | (() => HTMLInputElement | HTMLTextAreaElement | null)

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

function resolve(target: Target): HTMLInputElement | HTMLTextAreaElement | null {
  if (typeof target === 'string') {
    return document.querySelector(target) as HTMLInputElement | HTMLTextAreaElement | null
  }
  return target()
}

export function useSlashFocusSearch(target: Target): void {
  function onKeydown(e: KeyboardEvent) {
    if (e.isComposing || e.keyCode === 229) return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key !== '/') return
    if (isEditable(e.target)) return
    const el = resolve(target)
    if (!el) return
    e.preventDefault()
    el.focus()
    if ('select' in el && typeof el.select === 'function') el.select()
  }
  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
