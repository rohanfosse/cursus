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

export type DocIconType = 'image' | 'pdf' | 'video' | 'link' | 'file' | 'spreadsheet'
  | 'moodle' | 'github' | 'linkedin' | 'web' | 'package' | 'grille'

export const iconColors: Record<DocIconType, string> = {
  pdf:         '#E74C3C',
  image:       '#3498DB',
  video:       '#9B59B6',
  link:        '#27AE60',
  file:        '#4A90D9',
  spreadsheet: '#059669',
  moodle:      '#f59e0b',
  github:      '#6e7681',
  linkedin:    '#0a66c2',
  web:         '#22c55e',
  package:     '#8b5cf6',
  grille:      '#ef4444',
}

export const iconLabels: Record<DocIconType, string> = {
  pdf:         'PDF',
  image:       'Image',
  video:       'Vidéo',
  link:        'Lien',
  file:        'Fichier',
  spreadsheet: 'Tableur',
  moodle:      'Moodle',
  github:      'GitHub',
  linkedin:    'LinkedIn',
  web:         'Site Web',
  package:     'Package',
  grille:      'Grille',
}

export const TYPE_FILTERS: { id: DocIconType | null; label: string }[] = [
  { id: null,     label: 'Tous' },
  { id: 'pdf',    label: 'PDF' },
  { id: 'image',  label: 'Images' },
  { id: 'video',  label: 'Vidéos' },
  { id: 'link',   label: 'Liens' },
  { id: 'file',   label: 'Autres' },
]

const CAT_TO_TYPE: Record<string, DocIconType> = {
  'Moodle':   'moodle',
  'GitHub':   'github',
  'LinkedIn': 'linkedin',
  'Site Web': 'web',
  'Package':  'package',
  'Grille':   'grille',
}

export function docIconType(doc: AppDocument): DocIconType {
  if (doc.type === 'link') {
    if (doc.category && CAT_TO_TYPE[doc.category]) return CAT_TO_TYPE[doc.category]
    return 'link'
  }
  const ext = doc.content?.split('.').pop()?.toLowerCase() ?? ''
  if (['jpg','jpeg','png','gif','svg','webp','bmp'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['mp4','mov','avi','mkv','webm'].includes(ext)) return 'video'
  if (['xlsx','xls','csv','ods'].includes(ext)) return 'spreadsheet'
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

  // ── Filtering & Sorting ──────────────────────────────────────────────
  const activeTypeFilter = ref<DocIconType | null>(null)
  const sortBy = ref<'date' | 'name' | 'type'>('date')

  const filtered = computed(() => {
    const q = docStore.searchQuery.trim().toLowerCase()
    const list = docStore.documents
      .filter((d) => {
        if (q && !d.name.toLowerCase().includes(q) && !(d.description ?? '').toLowerCase().includes(q)) return false
        if (docStore.activeCategory && d.category !== docStore.activeCategory) return false
        if (activeTypeFilter.value && docIconType(d) !== activeTypeFilter.value) return false
        return true
      })

    // Favoris en premier, puis tri choisi
    const favSet = docStore.favoriteIds
    const favSort = (a: typeof list[0], b: typeof list[0]) => {
      const af = favSet.has(a.id) ? 0 : 1
      const bf = favSet.has(b.id) ? 0 : 1
      if (af !== bf) return af - bf
      return 0
    }

    if (sortBy.value === 'name') return list.sort((a, b) => favSort(a, b) || a.name.localeCompare(b.name, 'fr'))
    if (sortBy.value === 'type') return list.sort((a, b) => favSort(a, b) || docIconType(a).localeCompare(docIconType(b)))
    return list.sort((a, b) => favSort(a, b) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
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
      // Pass filtered list for prev/next navigation in preview
      const fileList = filtered.value.filter(d => d.type !== 'link')
      docStore.openPreview(doc, fileList)
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
    sortBy,
    filtered,
    categories,
    byCategory,
    openDoc,
    deleteDoc,
    loadDocuments,
  }
}
