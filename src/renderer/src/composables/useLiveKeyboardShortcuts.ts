/**
 * useLiveKeyboardShortcuts : raccourcis clavier de la vue enseignant Live.
 *
 * Flow Wooclap-like :
 *   ? / Shift+/  - overlay shortcuts
 *   Space/Enter  - fermer activite | lancer suivante | dismiss leaderboard
 *   Escape       - cancel form | dismiss overlay/leaderboard/preview
 *   T            - toggle preview
 *   N            - nouvelle activite
 *   P            - toggle presentation mode
 *   ArrowRight   - activite suivante (close + launch)
 */
import { onMounted, onUnmounted } from 'vue'
import type { Ref } from 'vue'

export interface LiveShortcutHandlers {
  shortcutsOpen: Ref<boolean>
  showActivityForm: Ref<boolean>
  showLeaderboard: Ref<boolean>
  showPodium: Ref<boolean>
  selectedCategory: Ref<unknown>
  previewMode: Ref<boolean>
  presentationOpen: Ref<boolean>
  hasCurrentActivity: Ref<boolean>
  hasCurrentSession: Ref<boolean>
  currentActivityIsLive: Ref<boolean>
  hasNextPending: Ref<boolean>
  closeCurrentActivity: () => void | Promise<void>
  launchNext: () => void | Promise<void>
  dismissLeaderboard: () => void
  cancelActivityForm: () => void
  togglePreview: () => void
  addActivity: () => void
  openPresentation: () => void
  closePresentation: () => void
  goNext: () => void | Promise<void>
}

export function useLiveKeyboardShortcuts(h: LiveShortcutHandlers) {
  function onKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      e.preventDefault()
      h.shortcutsOpen.value = !h.shortcutsOpen.value
      return
    }

    if (e.code === 'Escape' && h.shortcutsOpen.value) {
      h.shortcutsOpen.value = false
      return
    }

    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      if (h.currentActivityIsLive.value) {
        h.closeCurrentActivity()
      } else if (h.showLeaderboard.value) {
        if (h.hasNextPending.value) h.launchNext()
        else h.dismissLeaderboard()
      } else if (h.showPodium.value) {
        h.showPodium.value = false
      }
    }

    if (e.code === 'Escape') {
      if (h.showActivityForm.value) h.cancelActivityForm()
      else if (h.showLeaderboard.value) h.dismissLeaderboard()
      else if (h.showPodium.value) h.showPodium.value = false
      else if (h.selectedCategory.value) (h.selectedCategory as Ref<unknown>).value = null
      else if (h.previewMode.value) h.previewMode.value = false
    }

    if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && h.hasCurrentSession.value) {
      e.preventDefault()
      h.togglePreview()
    }

    if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey
        && h.hasCurrentSession.value && !h.hasCurrentActivity.value && !h.showActivityForm.value) {
      e.preventDefault()
      h.addActivity()
    }

    if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && h.hasCurrentActivity.value) {
      e.preventDefault()
      if (h.presentationOpen.value) h.closePresentation()
      else h.openPresentation()
    }

    if (e.code === 'ArrowRight' && h.hasCurrentSession.value
        && (h.hasCurrentActivity.value || h.showLeaderboard.value)
        && h.hasNextPending.value) {
      e.preventDefault()
      h.goNext()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
