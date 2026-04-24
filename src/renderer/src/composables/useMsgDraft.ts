/**
 * Sauvegarde et restauration des brouillons de message par canal/DM via localStorage.
 * Used by MessageInput.vue
 */
import { ref, computed, watch, nextTick, onUnmounted, getCurrentInstance, type Ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { renderMessageContent } from '@/utils/html'
import { safeGet, safeSet, safeRemove } from '@/utils/safeStorage'
import { STORAGE_KEYS } from '@/constants'

const DRAFT_DEBOUNCE_MS = 500
const SAVED_INDICATOR_MS = 1500

function keyFor(channelId: number | null | undefined, dmStudentId: number | null | undefined): string | null {
  if (channelId)   return STORAGE_KEYS.draftChannel(channelId)
  if (dmStudentId) return STORAGE_KEYS.draftDm(dmStudentId)
  return null
}

/**
 * Draft auto-save par canal/DM + toggle de prévisualisation markdown.
 *
 * Robustesse :
 *  - Les brouillons en cours de frappe sont **flushés** vers l'ancien canal
 *    avant chargement du nouveau (pas de perte au switch rapide).
 *  - Les erreurs localStorage (quota, mode privé) sont avalées silencieusement.
 *  - Timer et watcher sont nettoyés à l'unmount.
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
  let draftTimer: ReturnType<typeof setTimeout> | null = null
  let savedTimer: ReturnType<typeof setTimeout> | null = null
  const justSaved = ref(false)

  const draftKey = computed(() => keyFor(appStore.activeChannelId, appStore.activeDmStudentId))

  function flashSaved(): void {
    justSaved.value = true
    if (savedTimer) clearTimeout(savedTimer)
    savedTimer = setTimeout(() => { justSaved.value = false }, SAVED_INDICATOR_MS)
  }

  function writeDraft(key: string, value: string): void {
    if (value.trim()) { safeSet(key, value); flashSaved() }
    else              { safeRemove(key) }
  }

  function saveDraft(): void {
    if (draftTimer) { clearTimeout(draftTimer); draftTimer = null }
    const key = draftKey.value
    if (!key) return
    writeDraft(key, content.value)
  }

  function clearDraft(): void {
    if (draftTimer) { clearTimeout(draftTimer); draftTimer = null }
    const key = draftKey.value
    if (key) safeRemove(key)
  }

  function scheduleDraftSave(): void {
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      draftTimer = null
      saveDraft()
    }, DRAFT_DEBOUNCE_MS)
  }

  // Restaurer le brouillon quand le canal change
  const stopWatch = watch(
    () => [appStore.activeChannelId, appStore.activeDmStudentId] as const,
    (_newVals, oldVals) => {
      // 1) Flush du save en attente vers l'ANCIEN canal (préserve la frappe en cours)
      if (draftTimer) {
        clearTimeout(draftTimer)
        draftTimer = null
        const [oldCh, oldDm] = oldVals ?? [null, null]
        const oldKey = keyFor(oldCh, oldDm)
        if (oldKey) writeDraft(oldKey, content.value)
      }
      // 2) Charger le brouillon du NOUVEAU canal
      const key = draftKey.value
      content.value = key ? (safeGet(key) ?? '') : ''
      nextTick(() => {
        autoResize()
        inputEl.value?.focus()
      })
    },
  )

  if (getCurrentInstance()) {
    onUnmounted(() => {
      // Flush final : préserve tout draft en cours de frappe
      if (draftTimer) {
        clearTimeout(draftTimer)
        draftTimer = null
        const key = draftKey.value
        if (key) writeDraft(key, content.value)
      }
      if (savedTimer) { clearTimeout(savedTimer); savedTimer = null }
      stopWatch()
    })
  }

  return {
    showPreview,
    previewHtml,
    clearDraft,
    scheduleDraftSave,
    saveDraft,
    justSaved,
  }
}
