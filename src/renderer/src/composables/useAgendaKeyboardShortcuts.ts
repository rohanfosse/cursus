/**
 * useAgendaKeyboardShortcuts : raccourcis globaux de la vue Agenda.
 *  T          - aujourd'hui
 *  M / S / J  - vues mois / semaine / jour
 *  N          - nouveau rappel (teacher)
 *  Left/Right - nav periode precedente/suivante
 *  Escape     - close context menu | close detail | close form
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
}

export function useAgendaKeyboardShortcuts(h: AgendaShortcutHandlers) {
  function onKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
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
      case 'escape':
        if (h.ctxMenu.value) h.closeCtxMenu()
        else if (h.detailOpen.value) h.closeDetail()
        else if (h.showForm.value) { h.showForm.value = false; h.editingId.value = null }
        break
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}
