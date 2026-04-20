/**
 * useAgendaKeyboardShortcuts : raccourcis globaux de la vue Agenda.
 *  T          - aujourd'hui
 *  M / S / J  - vues mois / semaine / jour
 *  N          - nouveau rappel (teacher)
 *  Left/Right - nav periode precedente/suivante
 *  Escape     - close context menu | close detail | close form
 *
 * Robustesse :
 *  - Ignore les touches pendant la composition IME (évite les faux positifs JA/ZH).
 *  - Ignore les frappes dans les champs éditables (input/textarea/contenteditable).
 *  - Cleanup du listener via onBeforeUnmount + garde contre double-registration.
 */
import { onMounted, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'

export interface AgendaShortcutHandlers {
  isTeacher: Ref<boolean>
  detailOpen: Ref<boolean>
  showForm: Ref<boolean>
  editingId: Ref<number | null>
  ctxMenu: Ref<unknown>
  goToday: () => void
  switchView: (view: 'month' | 'week' | 'day') => void
  goPrev: () => void
  goNext: () => void
  closeCtxMenu: () => void
  closeDetail: () => void
  focusSearch?: () => void
}

/** Détecte si l'évènement provient d'un champ éditable (ne déclenche pas de raccourci). */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  // Ancestor contentEditable (au cas où l'event vient d'un descendant)
  if (target.closest('[contenteditable="true"], [contenteditable=""]')) return true
  return false
}

export function useAgendaKeyboardShortcuts(h: AgendaShortcutHandlers) {
  let bound = false

  function onKeydown(e: KeyboardEvent): void {
    // IME composition (Japonais/Chinois/Coréen) : la touche sert à la composition, pas au raccourci.
    // `isComposing` ET `keyCode === 229` sont tous deux vérifiés pour compat navigateurs.
    if (e.isComposing || e.keyCode === 229) return

    if (isEditableTarget(e.target)) return
    if (e.ctrlKey || e.metaKey || e.altKey) return

    switch (e.key.toLowerCase()) {
      case 't':
        h.goToday()
        break
      case 'm':
        h.switchView('month')
        break
      case 's':
        h.switchView('week')
        break
      case 'j':
        h.switchView('day')
        break
      case 'n':
        if (h.isTeacher.value) { h.showForm.value = true; e.preventDefault() }
        break
      case 'arrowleft':
        if (!h.detailOpen.value) h.goPrev()
        break
      case 'arrowright':
        if (!h.detailOpen.value) h.goNext()
        break
      case '/':
        if (h.focusSearch) { h.focusSearch(); e.preventDefault() }
        break
      case 'escape':
        if (h.ctxMenu.value) h.closeCtxMenu()
        else if (h.detailOpen.value) h.closeDetail()
        else if (h.showForm.value) { h.showForm.value = false; h.editingId.value = null }
        break
    }
  }

  onMounted(() => {
    if (bound) return
    window.addEventListener('keydown', onKeydown)
    bound = true
  })

  onBeforeUnmount(() => {
    if (!bound) return
    window.removeEventListener('keydown', onKeydown)
    bound = false
  })
}
