/**
 * useImageLightbox : overlay plein ecran pour visualiser une image en grand.
 *
 * Click sur une image markdown -> overlay (sauf si l'image est dans un lien,
 * auquel cas on respecte la navigation). Escape ou click hors-image pour
 * fermer. Pas de carrousel : un click = un agrandissement (cf. Notion,
 * GitHub README).
 */
import { ref, onMounted, onBeforeUnmount } from 'vue'

export function useImageLightbox() {
  const lightboxSrc = ref<string | null>(null)
  const lightboxAlt = ref<string>('')

  function open(src: string, alt: string): void {
    lightboxSrc.value = src
    lightboxAlt.value = alt
  }

  function close(): void {
    lightboxSrc.value = null
    lightboxAlt.value = ''
  }

  function onEscape(e: KeyboardEvent): void {
    if (e.key === 'Escape' && lightboxSrc.value) close()
  }

  onMounted(() => {
    document.addEventListener('keydown', onEscape)
  })
  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onEscape)
  })

  /**
   * Helper pour brancher la lightbox sur le click delegue d'un body
   * markdown : detecte si la cible est une <img> hors-lien et ouvre
   * l'overlay. Renvoie true si l'event a ete consomme.
   */
  function tryOpenFromClick(e: MouseEvent): boolean {
    const target = e.target as HTMLElement
    if (target?.tagName !== 'IMG') return false
    if (target.closest('a')) return false
    const img = target as HTMLImageElement
    if (!img.src) return false
    e.preventDefault()
    open(img.src, img.alt || '')
    return true
  }

  return { src: lightboxSrc, alt: lightboxAlt, open, close, tryOpenFromClick }
}
