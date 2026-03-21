/**
 * Sauvegarde et restauration des brouillons de message par canal/DM via localStorage.
 * Used by MessageInput.vue
 */
import { ref, computed, watch, nextTick, type Ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { renderMessageContent } from '@/utils/html'

/**
 * Draft auto-save per channel/DM + markdown preview toggle.
 */
export function useMsgDraft(
  content: Ref<string>,
  inputEl: Ref<HTMLTextAreaElement | null>,
  autoResize: () => void,
) {
  const appStore = useAppStore()

  const showPreview = ref(false)
  const previewHtml = computed(() => showPreview.value ? renderMessageContent(content.value) : '')

  // ── Brouillons (auto-save localStorage) ──────────────────────────────────
  let _draftTimer: ReturnType<typeof setTimeout> | null = null

  const draftKey = computed(() => {
    if (appStore.activeChannelId)   return `draft_ch_${appStore.activeChannelId}`
    if (appStore.activeDmStudentId) return `draft_dm_${appStore.activeDmStudentId}`
    return null
  })

  function saveDraft() {
    if (!draftKey.value) return
    if (content.value.trim()) localStorage.setItem(draftKey.value, content.value)
    else                      localStorage.removeItem(draftKey.value)
  }

  function clearDraft() {
    if (_draftTimer) { clearTimeout(_draftTimer); _draftTimer = null }
    if (draftKey.value) localStorage.removeItem(draftKey.value)
  }

  function scheduleDraftSave() {
    if (_draftTimer) clearTimeout(_draftTimer)
    _draftTimer = setTimeout(saveDraft, 500)
  }

  // Restaurer le brouillon quand le canal change
  watch(
    () => [appStore.activeChannelId, appStore.activeDmStudentId],
    () => {
      if (_draftTimer) { clearTimeout(_draftTimer); _draftTimer = null }
      const key = draftKey.value
      content.value = key ? (localStorage.getItem(key) ?? '') : ''
      nextTick(() => {
        autoResize()
        inputEl.value?.focus()
      })
    },
  )

  return {
    showPreview,
    previewHtml,
    clearDraft,
    scheduleDraftSave,
  }
}
