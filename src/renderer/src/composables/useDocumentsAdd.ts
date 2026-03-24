/**
 * Add-document modal: form state, multi-file picker, drag & drop,
 * upload progress, and submit logic.
 * Used by DocumentsView.vue
 */
import { ref, computed } from 'vue'
import { useAppStore }       from '@/stores/app'
import { useDocumentsStore } from '@/stores/documents'
import { useTravauxStore }   from '@/stores/travaux'
import { useToast }          from '@/composables/useToast'

// Extensions bloquées (même liste que le serveur)
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.dll', '.scr', '.pif', '.vbs', '.wsf',
])

export interface PendingFile {
  /** Chemin local (Electron) ou URL serveur (Web, déjà uploadé via openFileDialog) */
  path: string
  /** Nom affiché */
  name: string
}

export function useDocumentsAdd() {
  const api      = window.api
  const appStore = useAppStore()
  const docStore = useDocumentsStore()
  const travauxStore = useTravauxStore()
  const { showToast } = useToast()

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

  // ── Multi-fichiers ──────────────────────────────────────────────────────
  const addFiles = ref<PendingFile[]>([])

  // Progression de l'upload (0–100, par fichier)
  const uploadProgress     = ref(0)
  const uploadCurrentIndex = ref(0)
  const uploadTotal        = ref(0)

  // Compat : getter simple pour le premier fichier
  const addFile     = computed(() => addFiles.value.length ? addFiles.value[0].path : null)
  const addFileName = computed(() => addFiles.value.length ? addFiles.value[0].name : null)

  // Liste des projets disponibles (depuis les devoirs)
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

  // ── Détection automatique de catégorie depuis une URL ───────────────────
  function detectCategory(url: string) {
    if (!url) return
    const lower = url.toLowerCase()
    if (lower.includes('moodle'))                                        { addCategory.value = 'Moodle';   return }
    if (lower.includes('github'))                                        { addCategory.value = 'GitHub';   return }
    if (lower.includes('linkedin'))                                      { addCategory.value = 'LinkedIn'; return }
    if (lower.includes('npm') || lower.includes('pypi') || lower.includes('packag')) { addCategory.value = 'Package'; return }
    addCategory.value = 'Site Web'
  }

  /** Vérifie que l'extension n'est pas bloquée. */
  function isExtensionAllowed(fileName: string): boolean {
    const ext = ('.' + fileName.split('.').pop()!).toLowerCase()
    return !BLOCKED_EXTENSIONS.has(ext)
  }

  function openAddModal() {
    addName.value        = ''
    addCategory.value    = 'Autre'
    addDescription.value = ''
    addType.value        = 'file'
    addLink.value        = ''
    addFiles.value       = []
    addProject.value     = appStore.activeProject ?? ''
    addTravailId.value   = null
    newCatName.value     = ''
    uploadProgress.value     = 0
    uploadCurrentIndex.value = 0
    uploadTotal.value        = 0
    showAddModal.value   = true
    // Charger les devoirs si pas encore fait
    const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
    if (promoId && travauxStore.ganttData.length === 0) {
      travauxStore.fetchGantt(promoId)
    }
  }

  async function pickFile() {
    const res = await api.openFileDialog()
    if (res?.ok && res.data) {
      const paths = res.data as string[]
      for (const p of paths) {
        const name = p.split(/[\\/]/).pop()?.replace(/^__web__\S+/, '') || p.split(/[\\/]/).pop() || p
        if (!isExtensionAllowed(name)) {
          showToast(`Type non autorisé : ${name}`, 'error')
          continue
        }
        // Éviter les doublons
        if (addFiles.value.some(f => f.path === p)) continue
        addFiles.value.push({ path: p, name })
      }
      // Pré-remplir le nom si c'est le premier fichier et que le champ est vide
      if (!addName.value && addFiles.value.length === 1) {
        addName.value = addFiles.value[0].name
      }
    }
  }

  function removeFile(index: number) {
    addFiles.value.splice(index, 1)
  }

  function clearFile() {
    addFiles.value = []
  }

  // ── Drag & drop dans la modale ──────────────────────────────────────────
  const modalDragOver = ref(false)
  let modalDragCounter = 0

  function onModalDragEnter(e: DragEvent) {
    if (!e.dataTransfer?.types.includes('Files')) return
    modalDragCounter++
    modalDragOver.value = true
  }

  function onModalDragLeave() {
    modalDragCounter--
    if (modalDragCounter <= 0) { modalDragCounter = 0; modalDragOver.value = false }
  }

  function onModalDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  async function onModalDrop(e: DragEvent) {
    e.preventDefault()
    modalDragCounter = 0
    modalDragOver.value = false
    const files = e.dataTransfer?.files
    if (!files?.length) return

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!isExtensionAllowed(file.name)) {
        showToast(`Type non autorisé : ${file.name}`, 'error')
        continue
      }

      // Electron : file.path disponible
      const electronPath = (file as unknown as { path?: string }).path
      if (electronPath) {
        if (!addFiles.value.some(f => f.path === electronPath)) {
          addFiles.value.push({ path: electronPath, name: file.name })
        }
        continue
      }

      // Web : upload immédiat via FormData
      const formData = new FormData()
      formData.append('file', file, file.name)
      const SERVER_URL = window.location.origin
      const token = localStorage.getItem('cc_session') ?? ''
      try {
        const response = await fetch(`${SERVER_URL}/api/files/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        })
        const json = await response.json() as { ok: boolean; data?: string; error?: string }
        if (json.ok && json.data) {
          const url = `${SERVER_URL}${json.data}`
          if (!addFiles.value.some(f => f.path === url)) {
            addFiles.value.push({ path: url, name: file.name })
          }
        } else {
          showToast(json.error ?? `Erreur upload : ${file.name}`, 'error')
        }
      } catch {
        showToast(`Erreur upload : ${file.name}`, 'error')
      }
    }

    // Pré-remplir le nom si c'est le premier fichier
    if (!addName.value && addFiles.value.length === 1) {
      addName.value = addFiles.value[0].name
    }
    // Forcer le mode fichier si on drop des fichiers
    addType.value = 'file'
  }

  // ── Soumission ──────────────────────────────────────────────────────────
  async function submitAdd() {
    if (addType.value === 'link') {
      if (!addName.value.trim() || !addLink.value.trim()) return
      return submitLink()
    }
    // Mode fichier
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
        const docName = addFiles.value.length === 1
          ? addName.value.trim()
          : file.name
        const ok = await docStore.addDocument({
          promoId:     appStore.activePromoId ?? appStore.currentUser?.promo_id,
          project:     addProject.value.trim() || appStore.activeProject || null,
          name:        docName,
          type:        'file',
          pathOrUrl:   uploadRes.data.url,
          category:    (addCategory.value === '__new__' ? newCatName.value.trim() : addCategory.value.trim()) || null,
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
          ? 'Document ajouté.'
          : `${successCount} documents ajoutés.`
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
    adding.value = true
    try {
      const ok = await docStore.addDocument({
        promoId:     appStore.activePromoId ?? appStore.currentUser?.promo_id,
        project:     addProject.value.trim() || appStore.activeProject || null,
        name:        addName.value.trim(),
        type:        'link',
        pathOrUrl:   addLink.value.trim(),
        category:    (addCategory.value === '__new__' ? newCatName.value.trim() : addCategory.value.trim()) || null,
        description: addDescription.value.trim() || null,
        travailId:   addTravailId.value ?? null,
        authorName:  appStore.currentUser?.name ?? 'Système',
        authorType:  appStore.currentUser?.type ?? 'teacher',
      })
      if (ok) {
        showToast('Document ajouté.', 'success')
        showAddModal.value = false
      } else {
        showToast('Erreur lors de l\'ajout.')
      }
    } finally {
      adding.value = false
    }
  }

  return {
    showAddModal,
    addName,
    addCategory,
    addDescription,
    addType,
    addLink,
    addFile,
    addFileName,
    addFiles,
    addProject,
    addTravailId,
    newCatName,
    projectList,
    travailList,
    adding,
    uploadProgress,
    uploadCurrentIndex,
    uploadTotal,
    modalDragOver,
    openAddModal,
    pickFile,
    removeFile,
    clearFile,
    submitAdd,
    detectCategory,
    onModalDragEnter,
    onModalDragLeave,
    onModalDragOver,
    onModalDrop,
  }
}
