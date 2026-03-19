import { ref, watch, nextTick, onUnmounted, type Ref } from 'vue'

/**
 * Piège le focus à l'intérieur d'un conteneur (modal, dialog, etc.)
 * Gère Tab / Shift+Tab pour cycler entre les éléments focusables.
 */
export function useFocusTrap(containerRef: Ref<HTMLElement | null>, active: Ref<boolean>) {
  const previouslyFocused = ref<HTMLElement | null>(null)

  const FOCUSABLE = [
    'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
    'input:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  function getFocusable(): HTMLElement[] {
    if (!containerRef.value) return []
    return Array.from(containerRef.value.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(el => el.offsetParent !== null) // visible only
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return
    const elements = getFocusable()
    if (!elements.length) return

    const first = elements[0]
    const last  = elements[elements.length - 1]

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault()
        last.focus()
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  watch(active, async (isActive) => {
    if (isActive) {
      previouslyFocused.value = document.activeElement as HTMLElement
      await nextTick()
      // Focus first focusable element in the container
      const elements = getFocusable()
      if (elements.length) elements[0].focus()
      document.addEventListener('keydown', onKeydown)
    } else {
      document.removeEventListener('keydown', onKeydown)
      previouslyFocused.value?.focus()
      previouslyFocused.value = null
    }
  }, { immediate: true })

  onUnmounted(() => {
    document.removeEventListener('keydown', onKeydown)
  })
}
