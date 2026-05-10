/**
 * useMobileKeyboard - detecte l'ouverture du clavier mobile via Visual
 * Viewport API et expose la hauteur sous forme de variable CSS.
 *
 * Pourquoi : sur Chrome Android, quand le clavier s'ouvre dans une
 * conversation, la barre de saisie `.message-input-area` reste a
 * `bottom: 0` du viewport layout (qui n'a pas bouge), donc elle est
 * cachee derriere le clavier. iOS Safari resize le viewport
 * automatiquement, mais pas Chrome Android. Le composable pose
 * `--mobile-kb-h` sur `<html>`, la hauteur du clavier visible.
 *
 * Usage cote CSS :
 *   .message-input-area { padding-bottom: var(--mobile-kb-h, 0); }
 *   .mobile-nav         { display: none quand --mobile-kb-h > 0 }
 *
 * Active uniquement quand `window.visualViewport` existe et qu'on est
 * en mode mobile (≤ 768px). No-op desktop.
 */
import { onMounted, onUnmounted } from 'vue'

const CSS_VAR = '--mobile-kb-h'
const KB_OPEN_CLASS = 'has-mobile-keyboard'

function isMobile(): boolean {
  return window.matchMedia('(max-width: 768px)').matches
}

export function useMobileKeyboard(): void {
  let lastH = 0

  function update(): void {
    if (!window.visualViewport) return
    if (!isMobile()) return

    const layoutH = window.innerHeight
    const visualH = window.visualViewport.height
    const kbH = Math.max(0, Math.round(layoutH - visualH))

    if (kbH === lastH) return
    lastH = kbH

    document.documentElement.style.setProperty(CSS_VAR, `${kbH}px`)
    if (kbH > 50) {
      document.documentElement.classList.add(KB_OPEN_CLASS)
    } else {
      document.documentElement.classList.remove(KB_OPEN_CLASS)
    }
  }

  onMounted(() => {
    if (!window.visualViewport) return
    update()
    window.visualViewport.addEventListener('resize', update)
    window.visualViewport.addEventListener('scroll', update)
  })

  onUnmounted(() => {
    if (!window.visualViewport) return
    window.visualViewport.removeEventListener('resize', update)
    window.visualViewport.removeEventListener('scroll', update)
    document.documentElement.style.removeProperty(CSS_VAR)
    document.documentElement.classList.remove(KB_OPEN_CLASS)
  })
}
