/**
 * useMessagesDragDrop : gestion du drag & drop de fichiers dans la vue
 * Messages. Comportement different selon le contexte :
 *   - Canal actif : propose d'ajouter le fichier aux documents du canal
 *     (ouvre une modale inline avec nom + categorie editables)
 *   - DM actif   : upload immediat + injection d'un lien markdown dans
 *     le champ de saisie (via injectMd)
 *
 * Le compteur `dragCounter` gere les entree/sortie imbriquees pour eviter
 * le flicker (sans ca, survoler un enfant redeclencherait dragLeave).
 */
import { ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { useApi } from '@/composables/useApi'
import { fetchWithTimeout, DEFAULT_UPLOAD_TIMEOUT_MS } from '@/utils/fetchWithTimeout'
import { injectMd } from '@/composables/useMsgAttachment'
import { getAuthToken } from '@/utils/auth'

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp)$/i

export function useMessagesDragDrop(onAfterDmUpload?: () => void) {
  const appStore = useAppStore()
  const { showToast } = useToast()
  const { api } = useApi()

  const isDragOver = ref(false)
  const dmUploading = ref(false)
  const pendingDoc = ref<{ name: string; path: string } | null>(null)
  const docAddName = ref('')
  const docAddCat = ref('')
  const docAdding = ref(false)
  let dragCounter = 0

  function onDragEnter(e: DragEvent) {
    if (!appStore.activeChannelId && !appStore.activeDmStudentId) return
    if (!e.dataTransfer?.types.includes('Files')) return
    dragCounter++
    isDragOver.value = true
  }

  function onDragLeave() {
    dragCounter--
    if (dragCounter <= 0) { dragCounter = 0; isDragOver.value = false }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  async function uploadDmFile(file: File) {
    // Electron 32+ a supprime file.path (securite Chromium). On passe par
    // window.api.getPathForFile (preload webUtils) qui renvoie '' en web.
    const electronPath = window.api.getPathForFile?.(file) || ''
    if (electronPath) {
      const res = await window.api.uploadFile(electronPath) as { ok: boolean; data?: { url: string; file_size?: number } } | null
      if (res?.ok && res.data) return { url: res.data.url, fileSize: res.data.file_size || 0 }
      return null
    }
    // Web : upload direct via FormData
    const formData = new FormData()
    formData.append('file', file, file.name)
    const token = getAuthToken()
    const resp = await fetchWithTimeout('/api/files/upload', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }, DEFAULT_UPLOAD_TIMEOUT_MS)
    const json = await resp.json() as { ok: boolean; data?: string; file_size?: number }
    if (json.ok && json.data) {
      return { url: window.location.origin + json.data, fileSize: json.file_size || 0 }
    }
    return null
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault()
    dragCounter = 0
    isDragOver.value = false
    const file = e.dataTransfer?.files[0]
    if (!file) return

    // ── Mode canal : ajouter aux documents ─────────────────────────────
    if (appStore.activeChannelId) {
      const path = window.api.getPathForFile?.(file) || ''
      if (!path) {
        // Path indisponible : drop depuis un navigateur ou un site web,
        // pas depuis l'explorateur OS. On signale plutot que de rester
        // silencieux (cas Electron 38+ ou utilisateur sur web build).
        showToast('Glisse le fichier depuis l\'explorateur Windows / Finder, pas depuis un navigateur.', 'error')
        return
      }
      pendingDoc.value = { name: file.name, path }
      docAddName.value = file.name
      docAddCat.value = ''
      return
    }

    // ── Mode DM : upload + injection dans le champ ─────────────────────
    if (!appStore.activeDmStudentId) return
    dmUploading.value = true
    try {
      const up = await uploadDmFile(file)
      if (!up) {
        showToast("Echec de l'upload.", 'error')
        return
      }
      const sizedUrl = up.fileSize ? `${up.url}#size=${up.fileSize}` : up.url
      const isImage = IMAGE_EXT.test(file.name)
      injectMd(isImage ? `![${file.name}](${sizedUrl})` : `[📎 ${file.name}](${sizedUrl})`)
      onAfterDmUpload?.()
    } catch {
      showToast("Erreur lors de l'upload.", 'error')
    } finally {
      dmUploading.value = false
    }
  }

  async function confirmDocAdd() {
    if (!pendingDoc.value || !appStore.activeChannelId) return
    docAdding.value = true
    try {
      const result = await api(
        () => window.api.addChannelDocument({
          channelId:  appStore.activeChannelId ?? 0,
          type:       'file',
          name:       docAddName.value.trim() || pendingDoc.value!.name,
          pathOrUrl:  pendingDoc.value!.path,
          category:   docAddCat.value.trim() || 'General',
          description: null,
        }),
        'upload',
      )
      if (result !== null) {
        showToast(`"${docAddName.value || pendingDoc.value.name}" ajoute aux documents.`, 'success')
        pendingDoc.value = null
      }
    } finally {
      docAdding.value = false
    }
  }

  function cancelDocAdd() {
    pendingDoc.value = null
  }

  return {
    isDragOver, dmUploading,
    pendingDoc, docAddName, docAddCat, docAdding,
    onDragEnter, onDragLeave, onDragOver, onDrop,
    confirmDocAdd, cancelDocAdd,
  }
}
