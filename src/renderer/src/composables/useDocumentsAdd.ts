/**
 * Add-document modal: form state, file picker, and submit logic.
 * Used by DocumentsView.vue
 */
import { ref, computed } from 'vue'
import { useAppStore }       from '@/stores/app'
import { useDocumentsStore } from '@/stores/documents'
import { useTravauxStore }   from '@/stores/travaux'
import { useToast }          from '@/composables/useToast'

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
  const addFile        = ref<string | null>(null)
  const addFileName    = ref<string | null>(null)
  const addProject     = ref('')
  const newCatName     = ref('')
  const adding         = ref(false)

  // Liste des projets disponibles (depuis les devoirs)
  const projectList = computed(() => {
    const cats = new Set<string>()
    for (const t of travauxStore.ganttData) {
      if (t.category?.trim()) cats.add(t.category.trim())
    }
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'fr'))
  })

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

  function openAddModal() {
    addName.value        = ''
    addCategory.value    = 'Autre'
    addDescription.value = ''
    addType.value        = 'file'
    addLink.value        = ''
    addFile.value        = null
    addFileName.value    = null
    addProject.value     = appStore.activeProject ?? ''
    newCatName.value     = ''
    showAddModal.value   = true
  }

  async function pickFile() {
    const res = await api.openFileDialog()
    if (res?.ok && res.data) {
      addFile.value     = res.data
      addFileName.value = res.data.split(/[\\/]/).pop()?.replace(/^__web__\S+/, '') || res.data.split(/[\\/]/).pop() || res.data
      if (!addName.value) addName.value = addFileName.value ?? ''
    }
  }

  function clearFile() {
    addFile.value     = null
    addFileName.value = null
  }

  async function submitAdd() {
    if (!addName.value.trim()) return
    if (addType.value === 'file' && !addFile.value) return
    if (addType.value === 'link' && !addLink.value.trim()) return
    adding.value = true
    try {
      let pathOrUrl: string | null = addType.value === 'link' ? addLink.value.trim() : addFile.value
      if (addType.value === 'file' && addFile.value) {
        const uploadRes = await api.uploadFile(addFile.value)
        if (!uploadRes?.ok) { showToast('Erreur lors de l\'upload.', 'error'); adding.value = false; return }
        pathOrUrl = uploadRes.data as string
      }
      const ok = await docStore.addDocument({
        promoId:     appStore.activePromoId ?? appStore.currentUser?.promo_id,
        project:     addProject.value.trim() || appStore.activeProject || null,
        name:        addName.value.trim(),
        type:        addType.value,
        pathOrUrl,
        category:    (addCategory.value === '__new__' ? newCatName.value.trim() : addCategory.value.trim()) || null,
        description: addDescription.value.trim() || null,
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
    addProject,
    newCatName,
    projectList,
    adding,
    openAddModal,
    pickFile,
    clearFile,
    submitAdd,
    detectCategory,
  }
}
