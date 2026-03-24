/**
 * Pièce jointe de message : sélection de fichier, upload, insertion de lien markdown.
 * Used by MessageInput.vue
 */
import { ref, watch, nextTick, type Ref } from 'vue'
import { useToast } from '@/composables/useToast'

// ── Singleton : injection externe de markdown (ex. DnD depuis MessagesView) ──
const _pendingMd = ref<string | null>(null)
export function injectMd(md: string) { _pendingMd.value = md }

/**
 * File attachment: pick, upload, insert markdown link.
 */
export function useMsgAttachment(
  content: Ref<string>,
  inputEl: Ref<HTMLTextAreaElement | null>,
  autoResize: () => void,
) {
  const { showToast } = useToast()
  const attaching = ref(false)

  // Écoute les injections externes (DnD en DM depuis MessagesView)
  watch(_pendingMd, (md) => {
    if (!md) return
    content.value += content.value ? `\n${md}` : md
    _pendingMd.value = null
    nextTick(() => { autoResize(); inputEl.value?.focus() })
  })

  async function attachFile() {
    if (attaching.value) return
    attaching.value = true
    try {
      const res = await window.api.openFileDialog()
      if (!res?.ok || !res.data) return
      const uploadRes = await window.api.uploadFile(res.data as string)
      if (!uploadRes?.ok) {
        showToast('Erreur lors du chargement du fichier.', 'error')
        return
      }
      const url = uploadRes.data as string
      const fileName = (res.data as string).split(/[\\/]/).pop() || 'fichier'
      const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(fileName)
      const md = isImage ? `![${fileName}](${url})` : `[📎 ${fileName}](${url})`
      content.value += content.value ? `\n${md}` : md
      nextTick(() => { autoResize(); inputEl.value?.focus() })
    } finally {
      attaching.value = false
    }
  }

  return {
    attaching,
    attachFile,
  }
}
