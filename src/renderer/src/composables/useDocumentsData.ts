/**
 * Documents data: loading, filtering, categories, icon mapping, and actions.
 * Used by DocumentsView.vue
 */
import { ref, computed, onMounted, watch } from 'vue'
import { useAppStore }       from '@/stores/app'
import { useDocumentsStore } from '@/stores/documents'
import { useModalsStore }    from '@/stores/modals'
import { useToast }          from '@/composables/useToast'
import { useConfirm }        from '@/composables/useConfirm'
import { useOpenExternal }   from '@/composables/useOpenExternal'
import type { AppDocument }  from '@/types'

export type DocIconType = 'image' | 'pdf' | 'video' | 'link' | 'file'

export const iconColors: Record<DocIconType, string> = {
  pdf:   '#E74C3C',
  image: '#3498DB',
  video: '#9B59B6',
  link:  '#27AE60',
  file:  '#4A90D9',
}

export const iconLabels: Record<DocIconType, string> = {
  pdf:   'PDF',
  image: 'Image',
  video: 'Vidéo',
  link:  'Lien',
  file:  'Fichier',
}

export const TYPE_FILTERS: { id: DocIconType | null; label: string }[] = [
  { id: null,     label: 'Tous' },
  { id: 'pdf',    label: 'PDF' },
  { id: 'image',  label: 'Images' },
  { id: 'video',  label: 'Vidéos' },
  { id: 'link',   label: 'Liens' },
  { id: 'file',   label: 'Autres' },
]

export function docIconType(doc: AppDocument): DocIconType {
  if (doc.type === 'link') return 'link'
  const ext = doc.content?.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg','jpeg','png','gif','svg','webp','bmp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['mp4','mov','avi','mkv','webm'].includes(ext)) return 'video'
  return 'file'
}

export function useDocumentsData() {
  const appStore = useAppStore()
  const docStore = useDocumentsStore()
  const modals   = useModalsStore()
  const { showToast }               = useToast()
  const { confirm: confirmAction }  = useConfirm()
  const { openExternal }            = useOpenExternal()

  // ── Loading ──────────────────────────────────────────────────────────
  async function loadDocuments() {
    const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id ?? null
    if (!promoId) return
    await docStore.fetchDocuments(promoId, appStore.activeProject)
  }

  onMounted(loadDocuments)
  watch(() => appStore.activeProject, loadDocuments)
  watch(() => appStore.activePromoId, loadDocuments)

  // ── Filtering ────────────────────────────────────────────────────────
  const activeTypeFilter = ref<DocIconType | null>(null)

  const filtered = computed(() => {
    const q = docStore.searchQuery.trim().toLowerCase()
    return docStore.documents.filter((d) => {
      if (q && !d.name.toLowerCase().includes(q) && !(d.description ?? '').toLowerCase().includes(q)) return false
      if (docStore.activeCategory && d.category !== docStore.activeCategory) return false
      if (activeTypeFilter.value && docIconType(d) !== activeTypeFilter.value) return false
      return true
    })
  })

  const categories = computed(() => {
    const cats = new Set(docStore.documents.map((d) => d.category ?? 'Général'))
    return Array.from(cats).sort()
  })

  const byCategory = computed(() => {
    const map = new Map<string, AppDocument[]>()
    for (const doc of filtered.value) {
      const cat = doc.category ?? 'Général'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(doc)
    }
    return map
  })

  // ── Actions ──────────────────────────────────────────────────────────
  async function openDoc(doc: AppDocument) {
    if (doc.type === 'link') {
      await openExternal(doc.content)
    } else {
      docStore.openPreview(doc)
      modals.documentPreview = true
    }
  }

  async function deleteDoc(id: number) {
    if (!await confirmAction('Supprimer ce document ?', 'danger', 'Supprimer')) return
    const ok = await docStore.deleteDocument(id)
    if (ok) showToast('Document supprimé.', 'success')
    else showToast('Erreur lors de la suppression.', 'error')
  }

  return {
    activeTypeFilter,
    filtered,
    categories,
    byCategory,
    openDoc,
    deleteDoc,
  }
}
