/**
 * Add-document modal : form state + submit (fichier ou lien).
 *
 * La partie file handling (picker, drag-drop, progression, validation
 * extensions) vit dans useDocumentsFileUpload. Ce composable se concentre
 * sur les champs du formulaire (nom, categorie, description, lien, projet,
 * devoir associe) et l'orchestration submit -> upload -> addDocument.
 */
import { ref, computed } from 'vue'
import { useAppStore }       from '@/stores/app'
import { useDocumentsStore } from '@/stores/documents'
import { useTravauxStore }   from '@/stores/travaux'
import { useToast }          from '@/composables/useToast'
import { useDocumentsFileUpload } from '@/composables/useDocumentsFileUpload'

const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:'])

function isValidLink(url: string): boolean {
  try {
    const u = new URL(url.trim())
    return ALLOWED_LINK_PROTOCOLS.has(u.protocol)
  } catch {
    return false
  }
}

// Re-export pour retrocompat des imports consommateurs
export type { PendingFile } from '@/composables/useDocumentsFileUpload'

export function useDocumentsAdd() {
  const api      = window.api
  const appStore = useAppStore()
  const docStore = useDocumentsStore()
  const travauxStore = useTravauxStore()
  const { showToast } = useToast()

  const fileUpload = useDocumentsFileUpload()
  const {
    addFiles, uploadProgress, uploadCurrentIndex, uploadTotal,
    resetFiles, onModalDrop,
  } = fileUpload

  // ── Form state ──────────────────────────────────────────────────────────
  const showAddModal   = ref(false)
  const addName        = ref('')
  const addCategory    = ref('')
  const addDescription = ref('')
  const addType        = ref<'file' | 'link'>('file')
  const addLink        = ref('')
  const addProject     = ref('')
  const addTravailId   = ref<number | null>(null)
  const newCatName     = ref('')
  const adding         = ref(false)

  // Liste des projets disponibles (derives des devoirs)
  const projectList = computed(() => {
    const cats = new Set<string>()
    for (const t of travauxStore.ganttData) {
      if (t.category?.trim()) cats.add(t.category.trim())
    }
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'fr'))
  })

  // Liste des devoirs disponibles (pour le lien vers un devoir)
  const travailList = computed(() =>
    travauxStore.ganttData
      .filter((t) => t.published !== 0)
      .map((t) => ({ id: t.id, title: t.title, category: t.category ?? '' }))
      .sort((a, b) => a.title.localeCompare(b.title, 'fr'))
  )

  // Detection automatique de categorie depuis une URL
  function detectCategory(url: string) {
    if (!url) return
    const lower = url.toLowerCase()
    if (lower.includes('moodle'))                                        { addCategory.value = 'Moodle';   return }
    if (lower.includes('github'))                                        { addCategory.value = 'GitHub';   return }
    if (lower.includes('linkedin'))                                      { addCategory.value = 'LinkedIn'; return }
    if (lower.includes('npm') || lower.includes('pypi') || lower.includes('packag')) { addCategory.value = 'Package'; return }
    addCategory.value = 'Site Web'
  }

  function openAddModal() {
    addName.value        = ''
    addCategory.value    = 'Autre'
    addDescription.value = ''
    addType.value        = 'file'
    addLink.value        = ''
    addProject.value     = appStore.activeProject ?? ''
    addTravailId.value   = null
    newCatName.value     = ''
    resetFiles()
    showAddModal.value   = true

    // Charger les devoirs a la demande
    const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
    if (promoId && travauxStore.ganttData.length === 0) {
      travauxStore.fetchGantt(promoId)
    }
  }

  // ── Drop enrichi : pre-remplit le nom + force le mode fichier ───────────
  async function onDropInModal(e: DragEvent) {
    const hasFiles = await onModalDrop(e)
    if (!hasFiles) return
    if (!addName.value && addFiles.value.length === 1) {
      addName.value = addFiles.value[0].name
    }
    addType.value = 'file'
  }

  // ── Pick enrichi : pre-remplit le nom apres selection ───────────────────
  async function pickFile() {
    await fileUpload.pickFile()
    if (!addName.value && addFiles.value.length === 1) {
      addName.value = addFiles.value[0].name
    }
  }

  // ── Submit ──────────────────────────────────────────────────────────────
  async function submitAdd() {
    if (addType.value === 'link') {
      if (!addName.value.trim() || !addLink.value.trim()) return
      return submitLink()
    }
    if (!addFiles.value.length) return
    if (addFiles.value.length === 1 && !addName.value.trim()) return

    adding.value = true
    uploadTotal.value = addFiles.value.length
    uploadCurrentIndex.value = 0
    uploadProgress.value = 0
    let successCount = 0

    try {
      for (let i = 0; i < addFiles.value.length; i++) {
        uploadCurrentIndex.value = i + 1
        uploadProgress.value = Math.round((i / addFiles.value.length) * 100)
        const file = addFiles.value[i]
        const uploadRes = await api.uploadFile(file.path)
        if (!uploadRes?.ok || !uploadRes.data) {
          showToast(`Erreur upload : ${file.name}`, 'error')
          continue
        }
        const docName = addFiles.value.length === 1 ? addName.value.trim() : file.name
        const ok = await docStore.addDocument({
          promoId:     appStore.activePromoId ?? appStore.currentUser?.promo_id,
          project:     addProject.value.trim() || appStore.activeProject || null,
          name:        docName,
          type:        'file',
          pathOrUrl:   uploadRes.data.url,
          category:    resolveCategoryName(),
          description: addDescription.value.trim() || null,
          travailId:   addTravailId.value ?? null,
          fileSize:    uploadRes.data.file_size ?? null,
          authorName:  appStore.currentUser?.name ?? 'Système',
          authorType:  appStore.currentUser?.type ?? 'teacher',
        })
        if (ok) successCount++
      }
      uploadProgress.value = 100

      if (successCount > 0) {
        const msg = successCount === 1
          ? `"${addFiles.value[0]?.name ?? 'Document'}" ajouté avec succès`
          : `${successCount} documents ajoutés avec succès`
        showToast(msg, 'success')
        showAddModal.value = false
      } else {
        showToast('Erreur lors de l\'ajout.', 'error')
      }
    } finally {
      adding.value = false
      uploadProgress.value = 0
      uploadCurrentIndex.value = 0
      uploadTotal.value = 0
    }
  }

  async function submitLink() {
    if (!isValidLink(addLink.value)) {
      showToast('URL invalide : seuls les liens http:// et https:// sont autorises.', 'error')
      return
    }
    adding.value = true
    try {
      const ok = await docStore.addDocument({
        promoId:     appStore.activePromoId ?? appStore.currentUser?.promo_id,
        project:     addProject.value.trim() || appStore.activeProject || null,
        name:        addName.value.trim(),
        type:        'link',
        pathOrUrl:   addLink.value.trim(),
        category:    resolveCategoryName(),
        description: addDescription.value.trim() || null,
        travailId:   addTravailId.value ?? null,
        authorName:  appStore.currentUser?.name ?? 'Système',
        authorType:  appStore.currentUser?.type ?? 'teacher',
      })
      if (ok) {
        showToast('Document ajouté.', 'success')
        showAddModal.value = false
      } else {
        showToast('Erreur lors de l\'ajout.', 'error')
      }
    } finally {
      adding.value = false
    }
  }

  function resolveCategoryName(): string | null {
    const raw = addCategory.value === '__new__' ? newCatName.value.trim() : addCategory.value.trim()
    return raw || null
  }

  return {
    // Form state
    showAddModal,
    addName,
    addCategory,
    addDescription,
    addType,
    addLink,
    addProject,
    addTravailId,
    newCatName,
    projectList,
    travailList,
    adding,
    // File state (re-exposition retrocompat) + actions renvoyees directement
    addFiles: fileUpload.addFiles,
    addFile: fileUpload.addFile,
    addFileName: fileUpload.addFileName,
    uploadProgress: fileUpload.uploadProgress,
    uploadCurrentIndex: fileUpload.uploadCurrentIndex,
    uploadTotal: fileUpload.uploadTotal,
    modalDragOver: fileUpload.modalDragOver,
    removeFile: fileUpload.removeFile,
    clearFile: fileUpload.clearFile,
    onModalDragEnter: fileUpload.onModalDragEnter,
    onModalDragLeave: fileUpload.onModalDragLeave,
    onModalDragOver: fileUpload.onModalDragOver,
    // Actions
    openAddModal,
    pickFile,
    submitAdd,
    detectCategory,
    onModalDrop: onDropInModal,
  }
}
