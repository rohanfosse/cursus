<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import {
  Lightbulb, Plus, Eye, Edit3, Trash2, ArrowLeft, CheckCircle2, Clock,
  Save, Columns, BookOpen, ListTree, Maximize2, Minimize2, Download, Clipboard,
  Command as CommandIcon, Github, RefreshCw, ExternalLink, Package, Search,
  NotebookPen, X,
} from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useLumenStore } from '@/stores/lumen'
import { useProjects, type Project } from '@/composables/useProjects'
import { useToast } from '@/composables/useToast'
import { renderMarkdown } from '@/utils/markdown'
import { getAuthToken } from '@/utils/auth'
import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'
import LumenEditor from '@/components/lumen/LumenEditor.vue'
import LumenToolbar from '@/components/lumen/LumenToolbar.vue'
import LumenOutline from '@/components/lumen/LumenOutline.vue'
import LumenStatusBar from '@/components/lumen/LumenStatusBar.vue'
import LumenPreview from '@/components/lumen/LumenPreview.vue'
import LumenCommandPalette from '@/components/lumen/LumenCommandPalette.vue'
import LumenReader from '@/components/lumen/LumenReader.vue'
import type { CursorInfo } from '@/composables/useLumenEditor'
import type { LumenCourse, Promotion } from '@/types'
import { relativeTime } from '@/utils/date'
import { isValidGitHubUrl } from '@/utils/github'

const appStore = useAppStore()
const lumenStore = useLumenStore()
const { showToast } = useToast()
const route = useRoute()

type Mode = 'list' | 'editor' | 'reader'
const mode = ref<Mode>('list')

// ── Filtres de liste de cours (etudiants uniquement) ─────────────────────
type CourseFilter = 'all' | 'unread' | 'noted' | 'withProject'
const listFilter = ref<CourseFilter>('all')
const listSearch = ref('')

// Deep link vers un fichier precis du projet d'exemple (via query ?file=)
// passe au LumenReader qui le transmet au LumenProjectPanel.
const readerInitialFile = ref<string | null>(null)

// ── Editor state ────────────────────────────────────────────────────────────
const editorTitle     = ref('')
const editorSummary   = ref('')
const editorContent   = ref('')
const editorCourseId  = ref<number | null>(null)
const editorProjectId = ref<number | null>(null)
const saving          = ref(false)
const savedAt         = ref<string | null>(null)
const dirty           = ref(false)
const cursor          = ref<CursorInfo | null>(null)

// Liste des projets de la promo active (pour le selecteur projet associe)
const { projects: promoProjects, loadProjects } = useProjects()

// Liste de toutes les promos du prof (pour le selecteur de promo dans la meta row)
const allPromos = ref<Promotion[]>([])
// Promo dans laquelle le cours va etre cree (null = nouveau cours non encore sauvegarde)
// Pour un cours existant, on la derive de lumenStore.currentCourse.promo_id.
const editorPromoId = ref<number | null>(null)

// URL du repo git d'exemple attache au cours (optionnel)
const editorRepoUrl = ref<string>('')
const editorRepoUrlError = ref<string | null>(null)
// Loading du bouton "Resynchroniser" pendant un fetch snapshot en cours
const snapshotLoading = ref(false)

// ── UI preferences ─────────────────────────────────────────────────────────
const splitRatio     = ref(0.5)     // 0..1, ratio de l'editeur dans le split
const showOutline    = ref(true)
const showPreview    = ref(true)
const showSidebar    = ref(true)
const focusMode      = ref(false)    // masque chrome (toolbar, outline, sidebar)
const zenMode        = ref(false)    // plein ecran
const showLineNumbers = ref(false)
const showCmdPalette = ref(false)
const syncScroll     = ref(true)

// ── Refs ───────────────────────────────────────────────────────────────────
const editorRef  = ref<InstanceType<typeof LumenEditor> | null>(null)
const previewRef = ref<InstanceType<typeof LumenPreview> | null>(null)
const splitRootRef = ref<HTMLDivElement | null>(null)
const dropOverlay = ref(false)

const isTeacher = computed(() => appStore.isTeacher)
const promoId   = computed(() => appStore.activePromoId)

const saveState = computed<'saved' | 'saving' | 'dirty' | 'idle'>(() => {
  if (saving.value) return 'saving'
  if (dirty.value) return 'dirty'
  if (savedAt.value) return 'saved'
  return 'idle'
})

const editorIsPublished = computed(() => {
  if (!editorCourseId.value) return false
  return lumenStore.courses.find(c => c.id === editorCourseId.value)?.status === 'published'
})

const sortedCoursesForSidebar = computed(() => {
  return [...lumenStore.courses].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'draft' ? -1 : 1
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })
})

// Liste filtree pour l'ecran liste etudiant. Filtre + recherche combines,
// la recherche s'applique sur title + summary en insensible casse.
const filteredCourses = computed(() => {
  const q = listSearch.value.trim().toLowerCase()
  const unreadIds = new Set(lumenStore.unreadCourses.map(c => c.id))
  const notedIds = lumenStore.notedCourseIds
  return lumenStore.courses.filter((c) => {
    if (q) {
      const matches =
        c.title.toLowerCase().includes(q) ||
        (c.summary ?? '').toLowerCase().includes(q)
      if (!matches) return false
    }
    switch (listFilter.value) {
      case 'unread':      return unreadIds.has(c.id)
      case 'noted':       return notedIds.has(c.id)
      case 'withProject': return c.repo_snapshot_at != null
      default:            return true
    }
  })
})

// Compteurs pour les boutons de filtre
const filterCounts = computed(() => {
  const unreadIds = new Set(lumenStore.unreadCourses.map(c => c.id))
  const notedIds = lumenStore.notedCourseIds
  return {
    all: lumenStore.courses.length,
    unread: lumenStore.courses.filter(c => unreadIds.has(c.id)).length,
    noted: lumenStore.courses.filter(c => notedIds.has(c.id)).length,
    withProject: lumenStore.courses.filter(c => c.repo_snapshot_at != null).length,
  }
})

// ── Data loading ────────────────────────────────────────────────────────────
async function loadCourses() {
  if (!promoId.value) return
  // Charge cours + projets + compteurs unread/notes en parallele : le
  // selecteur projet (cote prof) a besoin de la liste des projets de la
  // promo, les etudiants ont besoin des IDs non-lus et des IDs annotes
  // pour afficher les badges et les filtres.
  await Promise.all([
    lumenStore.fetchCoursesForPromo(promoId.value),
    isTeacher.value ? loadProjects(promoId.value) : Promise.resolve(),
    !isTeacher.value ? lumenStore.fetchUnread(promoId.value) : Promise.resolve(),
    !isTeacher.value ? lumenStore.fetchNotedCourseIds() : Promise.resolve(),
  ])
}

// Charge les projets de la promo selectionnee pour l'edition (peut differer
// de la promo globale active si le prof gere plusieurs promos).
async function loadProjectsForEditorPromo() {
  if (!isTeacher.value || !editorPromoId.value) return
  await loadProjects(editorPromoId.value)
}

async function loadAllPromos() {
  if (!isTeacher.value) return
  try {
    const res = await window.api.getPromotions()
    allPromos.value = res?.ok ? (res.data as Promotion[]) : []
  } catch { allPromos.value = [] }
}

// ── Snapshot repo git (UI enseignant) ────────────────────────────────────

function validateRepoUrlOnBlur() {
  const v = editorRepoUrl.value.trim()
  if (!v) { editorRepoUrlError.value = null; return }
  editorRepoUrlError.value = isValidGitHubUrl(v)
    ? null
    : 'URL invalide (attendu : https://github.com/owner/repo)'
}

// Metadonnees du snapshot courant (pour affichage du badge)
const currentSnapshotMeta = computed(() => {
  const course = lumenStore.currentCourse
  if (!course || !course.repo_snapshot_at) return null
  return {
    sha: course.repo_commit_sha ? course.repo_commit_sha.slice(0, 7) : null,
    branch: course.repo_default_branch,
    snapshotAt: course.repo_snapshot_at,
    fullSha: course.repo_commit_sha,
  }
})

async function handleRefreshSnapshot() {
  if (!editorCourseId.value) {
    showToast("Sauvegarde le cours d'abord.", 'error')
    return
  }
  if (!editorRepoUrl.value.trim()) {
    showToast("Aucune URL de repo n'est definie.", 'error')
    return
  }
  // Si l'URL a change et n'est pas sauvegardee, on la persiste d'abord
  // pour que le backend utilise la bonne source au moment du fetch.
  if (dirty.value) {
    const ok = await saveCourse(true)
    if (!ok) return
  }
  snapshotLoading.value = true
  try {
    const result = await lumenStore.refreshSnapshot(editorCourseId.value)
    if (result) {
      showToast(
        result.changed ? 'Snapshot mis a jour — nouveaux fichiers disponibles' : 'Snapshot deja a jour',
        'success',
      )
    }
  } finally {
    snapshotLoading.value = false
  }
}

function openRepoInBrowser() {
  const url = editorRepoUrl.value.trim()
  if (url && isValidGitHubUrl(url)) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

watch(promoId, () => { loadCourses() })
watch(editorPromoId, loadProjectsForEditorPromo)

onMounted(async () => {
  await Promise.all([loadCourses(), loadAllPromos()])
  // Deep link : si l'URL contient ?course=ID, on ouvre directement le reader
  // (utilise par les refs lumen:ID dans le chat et le widget dashboard).
  // Si ?file=path est present, on le transmet au panneau projet.
  const courseQuery = route.query.course
  if (courseQuery) {
    const id = Number(courseQuery)
    const course = lumenStore.courses.find(c => c.id === id)
    if (course) {
      readerInitialFile.value = typeof route.query.file === 'string' ? route.query.file : null
      openReader(course)
    }
  }
})

// Reagit aux changements de query (navigation interne via clic sur ref)
watch(() => [route.query.course, route.query.file], ([newId, newFile]) => {
  if (!newId) return
  const id = Number(newId)
  const course = lumenStore.courses.find(c => c.id === id)
  if (course) {
    readerInitialFile.value = typeof newFile === 'string' ? newFile : null
    openReader(course)
  }
})

// ── Navigation ──────────────────────────────────────────────────────────────
function goToList() {
  if (dirty.value && !confirm('Modifications non sauvegardées. Quitter sans sauvegarder ?')) return
  mode.value = 'list'
  lumenStore.clearCurrentCourse()
  resetEditor()
  focusMode.value = false
  zenMode.value = false
}

async function openReader(course: LumenCourse) {
  mode.value = 'reader'
  await lumenStore.fetchCourse(course.id)
  // Marque le cours comme lu apres une courte temporisation : evite de
  // marquer lu un clic accidentel (l'etudiant change d'avis et revient).
  if (!isTeacher.value) {
    setTimeout(() => { lumenStore.markAsRead(course.id) }, 1000)
  }
}

function openEditorNew() {
  resetEditor()
  mode.value = 'editor'
  nextTick(() => editorRef.value?.focus())
}

async function openEditorEdit(course: LumenCourse) {
  if (dirty.value && editorCourseId.value !== course.id && !confirm('Modifications non sauvegardées. Changer de cours ?')) return
  const full = await lumenStore.fetchCourse(course.id)
  if (!full) return
  editorCourseId.value  = full.id
  editorTitle.value     = full.title
  editorSummary.value   = full.summary
  editorContent.value   = full.content
  editorProjectId.value = full.project_id
  editorPromoId.value   = full.promo_id
  editorRepoUrl.value   = full.repo_url ?? ''
  editorRepoUrlError.value = null
  dirty.value           = false
  savedAt.value         = full.updated_at
  mode.value = 'editor'
  nextTick(() => editorRef.value?.focus())
}

function resetEditor() {
  editorCourseId.value  = null
  editorTitle.value     = ''
  editorSummary.value   = ''
  editorContent.value   = ''
  editorProjectId.value = null
  // Nouveau cours : on prefille avec la promo globalement active (fallback
  // sur la premiere promo disponible si aucune n'est active).
  editorPromoId.value   = promoId.value ?? allPromos.value[0]?.id ?? null
  editorRepoUrl.value   = ''
  editorRepoUrlError.value = null
  dirty.value           = false
  savedAt.value         = null
  cursor.value          = null
}

// ── Dirty tracking ──────────────────────────────────────────────────────────
watch([editorTitle, editorSummary, editorContent, editorProjectId, editorPromoId, editorRepoUrl], () => {
  if (mode.value === 'editor') dirty.value = true
})

// ── Auto-save (3s apres derniere edition) ──────────────────────────────────
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
watch([editorTitle, editorSummary, editorContent, editorProjectId, editorPromoId, editorRepoUrl], () => {
  if (mode.value !== 'editor' || !editorCourseId.value) return
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => { saveCourse(true) }, 3000)
})

// ── Save / publish ──────────────────────────────────────────────────────────
let savePromise: Promise<boolean> | null = null

async function saveCourse(silent = false): Promise<boolean> {
  // Empeche les saves concurrents : si une sauvegarde est deja en cours,
  // on attend qu'elle finisse (et on ne lance pas de deuxieme appel API en parallele).
  if (savePromise) return savePromise
  savePromise = (async () => {
    // Snapshot des valeurs au moment de l'appel (pas de closure reactive)
    const title     = editorTitle.value.trim()
    const summary   = editorSummary.value
    const content   = editorContent.value
    const projectId = editorProjectId.value
    const courseId  = editorCourseId.value
    const repoUrl   = editorRepoUrl.value.trim() || null
    // Utilise la promo choisie dans l'editeur (pas forcement la promo
    // globalement active) — permet au prof de creer un cours pour une
    // autre de ses promos sans switcher de contexte.
    const targetPromoId = editorPromoId.value

    if (!title) {
      if (!silent) showToast('Le titre est requis', 'error')
      return false
    }
    if (!targetPromoId) {
      if (!silent) showToast('Sélectionne une promotion avant d\'enregistrer', 'error')
      return false
    }
    if (repoUrl && !isValidGitHubUrl(repoUrl)) {
      if (!silent) showToast('URL repo invalide (attendu : https://github.com/owner/repo)', 'error')
      return false
    }
    saving.value = true
    try {
      if (courseId) {
        const updated = await lumenStore.updateCourse(courseId, { title, summary, content, projectId, repoUrl })
        if (updated) {
          savedAt.value = formatTime(updated.updated_at)
          // Ne reset dirty que si l'utilisateur n'a rien tape entre-temps
          if (editorTitle.value.trim() === title && editorSummary.value === summary && editorContent.value === content && editorProjectId.value === projectId && (editorRepoUrl.value.trim() || null) === repoUrl) {
            dirty.value = false
          }
          if (!silent) showToast('Cours enregistré', 'success')
          return true
        }
      } else {
        const created = await lumenStore.createCourse({
          promoId: targetPromoId, projectId, title, summary, content, repoUrl,
        })
        if (created) {
          editorCourseId.value = created.id
          savedAt.value = formatTime(created.updated_at)
          if (editorTitle.value.trim() === title && editorSummary.value === summary && editorContent.value === content && editorProjectId.value === projectId && (editorRepoUrl.value.trim() || null) === repoUrl) {
            dirty.value = false
          }
          if (!silent) showToast('Cours créé', 'success')
          return true
        }
      }
      return false
    } finally {
      saving.value = false
      savePromise = null
    }
  })()
  return savePromise
}

async function saveAndPublish() {
  const ok = await saveCourse(false)
  if (!ok || !editorCourseId.value) return
  const published = await lumenStore.publishCourse(editorCourseId.value)
  if (published) showToast('Cours publié', 'success')
}

async function unpublishFromEditor() {
  if (!editorCourseId.value) return
  const ok = await lumenStore.unpublishCourse(editorCourseId.value)
  if (ok) showToast('Cours repassé en brouillon', 'info')
}

async function deleteFromEditor() {
  if (!editorCourseId.value) return
  if (!confirm('Supprimer définitivement ce cours ?')) return
  const ok = await lumenStore.deleteCourse(editorCourseId.value)
  if (ok) {
    showToast('Cours supprimé', 'success')
    resetEditor()
    mode.value = 'list'
  }
}

// ── Toolbar actions ─────────────────────────────────────────────────────────
function handleToolbarAction(type: string) {
  const ed = editorRef.value
  if (!ed) return
  switch (type) {
    case 'h1':        ed.prefixLine('# '); break
    case 'h2':        ed.prefixLine('## '); break
    case 'h3':        ed.prefixLine('### '); break
    case 'bold':      ed.wrap('**', '**', 'texte en gras'); break
    case 'italic':    ed.wrap('*', '*', 'texte en italique'); break
    case 'strike':    ed.wrap('~~', '~~', 'texte barré'); break
    case 'code':      ed.wrap('`', '`', 'code'); break
    case 'codeblock': ed.insertBlock('```\n// code\n```'); break
    case 'ul':        ed.prefixLine('- '); break
    case 'ol':        ed.prefixLine('1. '); break
    case 'task':      ed.prefixLine('- [ ] '); break
    case 'quote':     ed.prefixLine('> '); break
    case 'link':      ed.wrap('[', '](https://)', 'texte du lien'); break
    case 'image':     triggerImagePick(); break
    case 'table':     ed.insertBlock('| Colonne 1 | Colonne 2 | Colonne 3 |\n| --- | --- | --- |\n| A | B | C |\n| D | E | F |'); break
    case 'hr':        ed.insertBlock('---'); break
  }
}

// ── Image upload (file picker + drag drop) ────────────────────────────────
const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerImagePick() {
  fileInputRef.value?.click()
}

async function handleFilePicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await uploadAndInsertImage(file)
  input.value = ''
}

// Taille max par image : 10 Mo (plus strict que le 50 Mo global)
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

/** Echappe les caracteres markdown (]()) dans les noms de fichiers pour l'alt text. */
function sanitizeMarkdownAlt(filename: string): string {
  return filename
    .replace(/[\[\]()]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
}

async function uploadAndInsertImage(file: File) {
  if (!file.type.startsWith('image/')) {
    showToast('Seules les images sont acceptées', 'error')
    return
  }
  if (file.size > MAX_IMAGE_SIZE) {
    showToast(`Image trop volumineuse (max ${Math.round(MAX_IMAGE_SIZE / 1024 / 1024)} Mo)`, 'error')
    return
  }
  const ed = editorRef.value
  if (!ed) return

  const apiBase = (import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV ? 'http://localhost:3001' : 'https://app.cursus.school')) as string
  const token = getAuthToken()
  if (!token) {
    showToast('Session expirée, reconnecte-toi', 'error')
    return
  }

  showToast(`Upload de ${file.name}…`, 'info')
  try {
    const formData = new FormData()
    formData.append('file', file, file.name)
    const res = await fetch(`${apiBase}/api/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const json = await res.json() as { ok: boolean; data?: string; error?: string }
    if (!json.ok || !json.data) {
      showToast(`Upload échoué : ${json.error ?? 'inconnu'}`, 'error')
      return
    }
    const url = `${apiBase}${json.data}`
    const safeAlt = sanitizeMarkdownAlt(file.name)
    ed.insertAtCursor(`![${safeAlt}](${url})`)
    showToast('Image insérée', 'success')
  } catch (err: unknown) {
    showToast(`Upload échoué : ${(err as Error).message}`, 'error')
  }
}

// ── Drag & drop images + markdown ─────────────────────────────────────────
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  dropOverlay.value = true
}
function handleDragLeave(e: DragEvent) {
  // Evite le flicker : ne cache que si on quitte vraiment la zone editeur
  const currentTarget = e.currentTarget as HTMLElement | null
  const relatedTarget = e.relatedTarget as Node | null
  if (!currentTarget || !relatedTarget || !currentTarget.contains(relatedTarget)) {
    dropOverlay.value = false
  }
}

function isMarkdownFile(file: File): boolean {
  // text/markdown, text/x-markdown, ou extension .md / .markdown
  if (file.type === 'text/markdown' || file.type === 'text/x-markdown') return true
  return /\.(md|markdown)$/i.test(file.name)
}

async function importMarkdownFile(file: File) {
  let text: string
  try {
    text = await file.text()
  } catch {
    showToast('Impossible de lire le fichier markdown', 'error')
    return
  }

  const hasContent = editorTitle.value.trim() !== '' || editorContent.value.trim() !== ''
  if (hasContent && !confirm(`Remplacer le contenu actuel par « ${file.name} » ?`)) return

  // Extraction du titre : premiere ligne h1 si presente, sinon nom du fichier.
  const h1Match = text.match(/^\s*#\s+(.+?)\s*$/m)
  if (h1Match) {
    editorTitle.value = h1Match[1]
    // Retire le h1 du corps pour eviter un double titre dans le reader
    editorContent.value = text.replace(/^\s*#\s+.+$/m, '').replace(/^\s*\n/, '')
  } else {
    editorTitle.value = file.name.replace(/\.(md|markdown)$/i, '')
    editorContent.value = text
  }
  dirty.value = true
  showToast('Markdown importé — relis et enregistre', 'success')
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  dropOverlay.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  for (const file of Array.from(files)) {
    if (file.type.startsWith('image/')) {
      await uploadAndInsertImage(file)
    } else if (isMarkdownFile(file)) {
      await importMarkdownFile(file)
      break // Un seul markdown importe a la fois (ecrase le contenu)
    }
  }
}

// ── Paste : si HTML riche, basculer vers markdown simple ──────────────────
async function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        e.preventDefault()
        await uploadAndInsertImage(file)
        return
      }
    }
  }
}

// ── Export helpers ─────────────────────────────────────────────────────────
async function copyMarkdown() {
  try {
    await navigator.clipboard.writeText(editorContent.value)
    showToast('Markdown copié', 'success')
  } catch { showToast('Copie échouée', 'error') }
}

async function copyHtml() {
  try {
    const html = renderMarkdown(editorContent.value)
    await navigator.clipboard.writeText(html)
    showToast('HTML copié', 'success')
  } catch { showToast('Copie échouée', 'error') }
}

function downloadMarkdown() {
  const content = `# ${editorTitle.value || 'Cours'}\n\n${editorContent.value}`
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(editorTitle.value || 'cours').replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').toLowerCase()}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showToast('Fichier téléchargé', 'success')
}

// ── Outline navigation : scroll editor to line (precis via CodeMirror) ────
function navigateToLine(line: number) {
  editorRef.value?.scrollToLine(line)
}

// ── Sync scroll editeur → preview ─────────────────────────────────────────
let scrollSyncLock = false
function handleEditorCursor(info: CursorInfo) {
  cursor.value = info
  if (!syncScroll.value || !showPreview.value) return
  if (scrollSyncLock) return
  scrollSyncLock = true
  nextTick(() => {
    const ratio = editorRef.value?.getScrollRatio() ?? 0
    previewRef.value?.setScrollRatio(ratio)
    setTimeout(() => { scrollSyncLock = false }, 50)
  })
}

// ── Split pane drag handle ────────────────────────────────────────────────
let draggingSplit = false
function startSplitDrag(e: PointerEvent) {
  draggingSplit = true
  const root = splitRootRef.value
  if (!root) return
  const handleMove = (ev: PointerEvent) => {
    if (!draggingSplit) return
    const rect = root.getBoundingClientRect()
    const ratio = (ev.clientX - rect.left) / rect.width
    splitRatio.value = Math.max(0.25, Math.min(0.75, ratio))
  }
  const handleUp = () => {
    draggingSplit = false
    window.removeEventListener('pointermove', handleMove)
    window.removeEventListener('pointerup', handleUp)
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
  }
  window.addEventListener('pointermove', handleMove)
  window.addEventListener('pointerup', handleUp)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
  e.preventDefault()
}

// ── Keyboard shortcuts ────────────────────────────────────────────────────
function handleKeydown(e: KeyboardEvent) {
  const isMod = e.ctrlKey || e.metaKey

  // Palette de commandes : toujours disponible
  if (isMod && (e.key === 'p' || e.key === 'P') && e.shiftKey === false) {
    if (mode.value === 'editor') {
      e.preventDefault()
      showCmdPalette.value = !showCmdPalette.value
      return
    }
  }

  if (mode.value !== 'editor') return

  if (isMod && e.key === 's') { e.preventDefault(); saveCourse(false); return }
  if (isMod && e.shiftKey && e.key === 'P') { e.preventDefault(); saveAndPublish(); return }
  if (isMod && e.key === 'b') { e.preventDefault(); handleToolbarAction('bold'); return }
  if (isMod && e.key === 'i') { e.preventDefault(); handleToolbarAction('italic'); return }
  if (isMod && e.key === 'k') { e.preventDefault(); handleToolbarAction('link'); return }
  if (isMod && e.key === 'e') { e.preventDefault(); handleToolbarAction('code'); return }
  if (isMod && e.key === '1') { e.preventDefault(); handleToolbarAction('h1'); return }
  if (isMod && e.key === '2') { e.preventDefault(); handleToolbarAction('h2'); return }
  if (isMod && e.key === '3') { e.preventDefault(); handleToolbarAction('h3'); return }
  if (e.key === 'F11')        { e.preventDefault(); zenMode.value = !zenMode.value; return }
  if (e.key === 'Escape' && zenMode.value) { e.preventDefault(); zenMode.value = false; return }
}
onMounted(() => { window.addEventListener('keydown', handleKeydown) })
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
})

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z'))
    return d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso.replace(' ', 'T') + (iso.endsWith('Z') ? '' : 'Z'))
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

// ── Palette commands definition ──────────────────────────────────────────
const paletteCommands = computed(() => {
  const cmds: Array<{id: string; label: string; hint?: string; icon: 'file'|'plus'|'save'|'trash'|'eye'|'columns'|'edit'|'publish'|'unpublish'|'download'|'clipboard'|'outline'|'focus'; action: () => void}> = [
    { id: 'new',        label: 'Nouveau cours',              hint: 'Ctrl+N',       icon: 'plus',      action: () => openEditorNew() },
    { id: 'save',       label: 'Enregistrer',                hint: 'Ctrl+S',       icon: 'save',      action: () => saveCourse(false) },
    { id: 'publish',    label: editorIsPublished.value ? 'Mettre à jour la publication' : 'Publier le cours', hint: 'Ctrl+Shift+P', icon: 'publish',   action: () => saveAndPublish() },
    { id: 'focus',      label: focusMode.value ? 'Quitter le mode focus' : 'Activer le mode focus',      icon: 'focus',     action: () => focusMode.value = !focusMode.value },
    { id: 'zen',        label: zenMode.value ? 'Quitter le mode plein écran' : 'Plein écran (F11)',      icon: 'focus',     action: () => zenMode.value = !zenMode.value },
    { id: 'preview',    label: showPreview.value ? 'Masquer l\'aperçu' : 'Afficher l\'aperçu',           icon: 'columns',   action: () => showPreview.value = !showPreview.value },
    { id: 'outline',    label: showOutline.value ? 'Masquer le plan' : 'Afficher le plan',              icon: 'outline',   action: () => showOutline.value = !showOutline.value },
    { id: 'sidebar',    label: showSidebar.value ? 'Masquer la liste' : 'Afficher la liste',            icon: 'file',      action: () => showSidebar.value = !showSidebar.value },
    { id: 'copy-md',    label: 'Copier le markdown',         icon: 'clipboard', action: () => copyMarkdown() },
    { id: 'copy-html',  label: 'Copier le HTML',             icon: 'clipboard', action: () => copyHtml() },
    { id: 'download',   label: 'Télécharger en .md',         icon: 'download',  action: () => downloadMarkdown() },
  ]
  if (editorIsPublished.value) {
    cmds.push({ id: 'unpublish', label: 'Dépublier', icon: 'unpublish', action: () => unpublishFromEditor() })
  }
  if (editorCourseId.value) {
    cmds.push({ id: 'delete', label: 'Supprimer le cours', icon: 'trash', action: () => deleteFromEditor() })
  }
  return cmds
})

function onCmdCourseSelect(courseId: number) {
  const course = lumenStore.courses.find(c => c.id === courseId)
  if (course) openEditorEdit(course)
}

// ── Split pane grid template computed ────────────────────────────────────
const splitStyle = computed(() => {
  if (!showPreview.value) return { gridTemplateColumns: '1fr' }
  const leftPct = (splitRatio.value * 100).toFixed(2)
  const rightPct = (100 - splitRatio.value * 100).toFixed(2)
  return { gridTemplateColumns: `${leftPct}% 6px ${rightPct}%` }
})

const chromeHidden = computed(() => focusMode.value || zenMode.value)
</script>

<template>
  <ErrorBoundary label="Lumen">
    <div
      class="lumen-app"
      :class="{
        'lumen-app--editor': mode === 'editor',
        'lumen-app--zen': zenMode,
        'lumen-app--focus': focusMode,
      }"
    >
      <!-- ─────────────────────── TOPBAR ─────────────────────── -->
      <header v-if="!zenMode" class="lumen-topbar">
        <div class="lumen-brand">
          <div class="lumen-brand-icon">
            <Lightbulb :size="20" />
          </div>
          <div class="lumen-brand-text">
            <span class="lumen-brand-name">Lumen</span>
            <span class="lumen-brand-tag">{{ isTeacher ? 'Éditeur de cours' : 'Cours de ta promo' }}</span>
          </div>
        </div>

        <!-- Status pill (mode editor) -->
        <div v-if="mode === 'editor'" class="lumen-status-pill">
          <span v-if="saving" class="lumen-status lumen-status--saving">
            <span class="lumen-spinner" />
            Enregistrement…
          </span>
          <span v-else-if="dirty" class="lumen-status lumen-status--dirty">
            <span class="lumen-status-dot" />
            Modifié
          </span>
          <span v-else-if="savedAt" class="lumen-status lumen-status--saved">
            <CheckCircle2 :size="13" />
            Enregistré · {{ savedAt }}
          </span>
          <span v-if="editorIsPublished" class="lumen-status lumen-status--published">
            <CheckCircle2 :size="13" />
            Publié
          </span>
        </div>

        <div class="lumen-topbar-actions">
          <button v-if="mode === 'list' && isTeacher" class="lumen-btn lumen-btn--primary" @click="openEditorNew">
            <Plus :size="15" /> Nouveau cours
          </button>

          <template v-if="mode === 'editor'">
            <button class="lumen-icon-btn" aria-label="Ouvrir la palette de commandes" title="Palette de commandes (Ctrl+P)" @click="showCmdPalette = true">
              <CommandIcon :size="16" />
            </button>
            <button
              class="lumen-icon-btn"
              :class="{ 'lumen-icon-btn--active': showOutline }"
              :aria-label="showOutline ? 'Masquer le plan du cours' : 'Afficher le plan du cours'"
              :aria-pressed="showOutline"
              title="Plan du cours"
              @click="showOutline = !showOutline"
            >
              <ListTree :size="16" />
            </button>
            <button
              class="lumen-icon-btn"
              :class="{ 'lumen-icon-btn--active': showPreview }"
              :aria-label="showPreview ? 'Masquer l\'aperçu' : 'Afficher l\'aperçu côte à côte'"
              :aria-pressed="showPreview"
              title="Aperçu côte à côte"
              @click="showPreview = !showPreview"
            >
              <Columns :size="16" />
            </button>
            <button
              class="lumen-icon-btn"
              :class="{ 'lumen-icon-btn--active': zenMode }"
              :aria-label="zenMode ? 'Quitter le plein écran' : 'Passer en plein écran'"
              :aria-pressed="zenMode"
              title="Plein écran (F11)"
              @click="zenMode = !zenMode"
            >
              <Maximize2 :size="16" />
            </button>
            <span class="lumen-topbar-sep" />
            <button class="lumen-btn lumen-btn--ghost" :disabled="saving" @click="saveCourse(false)">
              <Save :size="14" /> Enregistrer
            </button>
            <button v-if="editorIsPublished" class="lumen-btn lumen-btn--ghost" @click="unpublishFromEditor">
              Dépublier
            </button>
            <button class="lumen-btn lumen-btn--primary" :disabled="saving" @click="saveAndPublish">
              {{ editorIsPublished ? 'Mettre à jour' : 'Publier' }}
            </button>
            <button class="lumen-btn lumen-btn--ghost" @click="goToList">
              <ArrowLeft :size="14" /> Liste
            </button>
          </template>

          <button v-if="mode === 'reader'" class="lumen-btn lumen-btn--ghost" @click="goToList">
            <ArrowLeft :size="14" /> Retour
          </button>
        </div>
      </header>

      <!-- Mini topbar en mode Zen -->
      <header v-else class="lumen-zen-topbar">
        <button class="lumen-zen-exit" aria-label="Quitter le plein écran" title="Quitter le plein écran (Esc)" @click="zenMode = false">
          <Minimize2 :size="15" />
        </button>
      </header>

      <!-- ─────────────────────── BODY ─────────────────────── -->

      <!-- LIST MODE -->
      <main v-if="mode === 'list'" class="lumen-list-main">
        <div v-if="lumenStore.loading && lumenStore.courses.length === 0" class="lumen-empty">
          Chargement…
        </div>

        <div v-else-if="lumenStore.courses.length === 0" class="lumen-empty">
          <Lightbulb :size="48" class="lumen-empty-icon" />
          <h2 v-if="isTeacher">Aucun cours pour cette promotion</h2>
          <h2 v-else>Aucun cours publié pour le moment</h2>
          <p v-if="isTeacher">Lance ton premier cours en markdown.</p>
          <p v-else>Tes enseignants n'ont pas encore publié de cours ici.</p>
          <button v-if="isTeacher" class="lumen-btn lumen-btn--primary" @click="openEditorNew">
            <Plus :size="15" /> Créer mon premier cours
          </button>
        </div>

        <template v-else>
          <!-- Barre de filtres + recherche (etudiants uniquement) -->
          <div v-if="!isTeacher" class="lumen-list-toolbar">
            <div class="lumen-list-search">
              <Search :size="13" class="lumen-list-search-icon" />
              <input
                v-model="listSearch"
                type="text"
                class="lumen-list-search-input"
                placeholder="Rechercher dans les cours…"
                aria-label="Rechercher dans les cours"
              />
              <button
                v-if="listSearch"
                type="button"
                class="lumen-list-search-clear"
                title="Effacer"
                aria-label="Effacer la recherche"
                @click="listSearch = ''"
              >
                <X :size="12" />
              </button>
            </div>
            <div class="lumen-list-filters" role="tablist" aria-label="Filtres de cours">
              <button
                v-for="f in [
                  { id: 'all', label: 'Tous', count: filterCounts.all },
                  { id: 'unread', label: 'Non lus', count: filterCounts.unread },
                  { id: 'noted', label: 'Avec notes', count: filterCounts.noted },
                  { id: 'withProject', label: 'Avec projet', count: filterCounts.withProject },
                ]"
                :key="f.id"
                type="button"
                role="tab"
                :aria-selected="listFilter === f.id"
                class="lumen-list-filter"
                :class="{ 'lumen-list-filter--active': listFilter === f.id }"
                @click="listFilter = f.id as CourseFilter"
              >
                {{ f.label }}
                <span v-if="f.count > 0" class="lumen-list-filter-count">{{ f.count }}</span>
              </button>
            </div>
          </div>

          <div v-if="filteredCourses.length === 0" class="lumen-empty lumen-empty--small">
            <Search :size="24" class="lumen-empty-icon" />
            <p>Aucun cours ne correspond a ta recherche ou ton filtre.</p>
            <button v-if="listSearch || listFilter !== 'all'" class="lumen-btn lumen-btn--ghost" @click="() => { listSearch = ''; listFilter = 'all' }">
              Reinitialiser
            </button>
          </div>

          <div v-else class="lumen-list-grid">
          <article
            v-for="course in filteredCourses"
            :key="course.id"
            class="lumen-card"
            :class="{ 'lumen-card--draft': course.status === 'draft' }"
            tabindex="0"
            @click="isTeacher ? openEditorEdit(course) : openReader(course)"
            @keydown.enter="isTeacher ? openEditorEdit(course) : openReader(course)"
          >
            <header class="lumen-card-head">
              <span class="lumen-pill" :class="course.status === 'published' ? 'lumen-pill--ok' : 'lumen-pill--draft'">
                <CheckCircle2 v-if="course.status === 'published'" :size="11" />
                <Clock v-else :size="11" />
                {{ course.status === 'published' ? 'Publié' : 'Brouillon' }}
              </span>
              <span class="lumen-card-date">{{ formatDate(course.published_at ?? course.updated_at) }}</span>
            </header>
            <h3 class="lumen-card-title">{{ course.title }}</h3>
            <p v-if="course.summary" class="lumen-card-summary">{{ course.summary }}</p>
            <div class="lumen-card-badges">
              <span v-if="course.repo_snapshot_at" class="lumen-card-repo" title="Ce cours contient un projet de code d'exemple">
                <Package :size="11" />
                <span>Projet</span>
              </span>
              <span v-if="!isTeacher && lumenStore.notedCourseIds.has(course.id)" class="lumen-card-note" title="Tu as pris des notes sur ce cours">
                <NotebookPen :size="11" />
                <span>Notes</span>
              </span>
            </div>
            <footer class="lumen-card-actions">
              <button class="lumen-card-link" @click.stop="openReader(course)">
                <Eye :size="13" /> Lire
              </button>
              <button v-if="isTeacher" class="lumen-card-link" @click.stop="openEditorEdit(course)">
                <Edit3 :size="13" /> Éditer
              </button>
            </footer>
          </article>
          </div>
        </template>
      </main>

      <!-- READER MODE -->
      <main v-else-if="mode === 'reader'" class="lumen-reader-main">
        <LumenReader
          v-if="lumenStore.currentCourse"
          :course="lumenStore.currentCourse"
          :siblings="lumenStore.courses"
          :initial-project-file="readerInitialFile"
          @navigate="openReader"
          @back="goToList"
        />
      </main>

      <!-- EDITOR MODE (Overleaf-style) -->
      <main v-else-if="mode === 'editor' && isTeacher" class="lumen-editor-main">
        <!-- Sidebar : liste des cours -->
        <aside v-if="showSidebar && !chromeHidden" class="lumen-sidebar">
          <header class="lumen-sidebar-head">
            <BookOpen :size="13" />
            <span>Mes cours</span>
            <button class="lumen-sidebar-add" aria-label="Créer un nouveau cours" title="Nouveau cours" @click="resetEditor">
              <Plus :size="14" />
            </button>
          </header>
          <div class="lumen-sidebar-list" role="list">
            <button
              v-for="course in sortedCoursesForSidebar"
              :key="course.id"
              type="button"
              class="lumen-sidebar-item"
              :class="{ 'lumen-sidebar-item--active': course.id === editorCourseId }"
              :aria-current="course.id === editorCourseId ? 'page' : undefined"
              role="listitem"
              @click="openEditorEdit(course)"
            >
              <span
                class="lumen-sidebar-dot"
                :class="course.status === 'published' ? 'lumen-sidebar-dot--ok' : 'lumen-sidebar-dot--draft'"
                :aria-label="course.status === 'published' ? 'Publié' : 'Brouillon'"
              />
              <span class="lumen-sidebar-title">{{ course.title || 'Sans titre' }}</span>
            </button>
            <p v-if="sortedCoursesForSidebar.length === 0" class="lumen-sidebar-empty">
              Aucun cours
            </p>
          </div>
        </aside>

        <!-- Editor zone -->
        <section
          class="lumen-editor-zone"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
          @drop="handleDrop"
          @paste="handlePaste"
        >
          <!-- Meta (title + summary + projet associe) -->
          <div v-if="!chromeHidden" class="lumen-meta-row">
            <input
              v-model="editorTitle"
              class="lumen-meta-title"
              placeholder="Titre du cours"
              maxlength="200"
            />
            <input
              v-model="editorSummary"
              class="lumen-meta-summary"
              placeholder="Résumé court (optionnel)"
              maxlength="500"
            />
            <div class="lumen-meta-project-row">
              <label class="lumen-meta-promo-label" for="lumen-promo-select">Promotion</label>
              <select
                id="lumen-promo-select"
                v-model.number="editorPromoId"
                class="lumen-meta-project lumen-meta-promo"
                :disabled="editorCourseId !== null"
                :title="editorCourseId ? 'Promotion verrouillée — créer un nouveau cours pour changer de promo' : 'Choisir la promotion cible pour ce cours'"
              >
                <option v-if="allPromos.length === 0" :value="null">Aucune promotion</option>
                <option
                  v-for="promo in allPromos"
                  :key="promo.id"
                  :value="promo.id"
                >
                  {{ promo.name }}
                </option>
              </select>

              <label class="lumen-meta-project-label" for="lumen-project-select">Projet associé</label>
              <select
                id="lumen-project-select"
                v-model="editorProjectId"
                class="lumen-meta-project"
                :title="editorProjectId ? 'Modifier le projet associé' : 'Aucun projet sélectionné — la publication ne notifiera pas le chat'"
              >
                <option :value="null">Aucun (publication silencieuse)</option>
                <option
                  v-for="p in promoProjects"
                  :key="p.id"
                  :value="p.id"
                  :disabled="!p.channel_id"
                >
                  {{ p.name }}{{ p.channel_id ? '' : ' (sans canal — pas de notif)' }}
                </option>
              </select>
            </div>

            <!-- Ligne repo git d'exemple -->
            <div class="lumen-meta-repo-row">
              <label class="lumen-meta-repo-label" for="lumen-repo-url">
                <Github :size="13" />
                <span>Projet d'exemple (repo git)</span>
              </label>
              <div class="lumen-meta-repo-input-wrap">
                <input
                  id="lumen-repo-url"
                  v-model="editorRepoUrl"
                  type="url"
                  class="lumen-meta-repo-input"
                  :class="{ 'lumen-meta-repo-input--error': editorRepoUrlError }"
                  placeholder="https://github.com/owner/repo"
                  maxlength="500"
                  :disabled="snapshotLoading"
                  @blur="validateRepoUrlOnBlur"
                />
                <button
                  v-if="editorRepoUrl && isValidGitHubUrl(editorRepoUrl)"
                  type="button"
                  class="lumen-meta-repo-link"
                  title="Ouvrir le repo sur GitHub"
                  aria-label="Ouvrir le repo sur GitHub"
                  @click="openRepoInBrowser"
                >
                  <ExternalLink :size="13" />
                </button>
              </div>
              <button
                v-if="editorCourseId && editorRepoUrl && isValidGitHubUrl(editorRepoUrl)"
                type="button"
                class="lumen-meta-repo-sync"
                :disabled="snapshotLoading"
                :title="currentSnapshotMeta ? 'Refetcher le repo depuis GitHub' : 'Creer le snapshot initial depuis GitHub'"
                @click="handleRefreshSnapshot"
              >
                <RefreshCw :size="13" :class="{ 'lumen-spin': snapshotLoading }" />
                {{ snapshotLoading ? 'Fetch…' : currentSnapshotMeta ? 'Resynchroniser' : 'Snapshoter' }}
              </button>
            </div>

            <!-- Badge snapshot (affiche uniquement si un snapshot existe) -->
            <div v-if="currentSnapshotMeta" class="lumen-meta-snapshot-badge">
              <CheckCircle2 :size="11" />
              <span>
                Snapshot {{ currentSnapshotMeta.branch }}
                <code v-if="currentSnapshotMeta.sha" class="lumen-meta-snapshot-sha">{{ currentSnapshotMeta.sha }}</code>
                · {{ relativeTime(currentSnapshotMeta.snapshotAt) }}
              </span>
            </div>
            <p v-if="editorRepoUrlError" class="lumen-meta-repo-error">{{ editorRepoUrlError }}</p>
          </div>

          <!-- Toolbar markdown -->
          <LumenToolbar v-if="!chromeHidden" @action="handleToolbarAction" />

          <!-- Split : editor + preview -->
          <div
            ref="splitRootRef"
            class="lumen-split"
            :style="splitStyle"
          >
            <LumenEditor
              ref="editorRef"
              v-model="editorContent"
              :show-line-numbers="showLineNumbers"
              placeholder="# Titre du cours&#10;&#10;Écris ton cours en Markdown…&#10;&#10;## Section&#10;Texte avec **gras** et *italique*.&#10;&#10;- Item 1&#10;- Item 2&#10;&#10;```js&#10;console.log('hello')&#10;```"
              @cursor="handleEditorCursor"
            />
            <div
              v-if="showPreview"
              class="lumen-split-handle"
              role="separator"
              aria-label="Glisser pour redimensionner l'éditeur et l'aperçu"
              :aria-valuenow="Math.round(splitRatio * 100)"
              aria-valuemin="25"
              aria-valuemax="75"
              tabindex="0"
              title="Glisser pour redimensionner"
              @pointerdown="startSplitDrag"
              @keydown.left.prevent="splitRatio = Math.max(0.25, splitRatio - 0.05)"
              @keydown.right.prevent="splitRatio = Math.min(0.75, splitRatio + 0.05)"
            />
            <LumenPreview
              v-if="showPreview"
              ref="previewRef"
              :content="editorContent"
              :title="editorTitle"
            />
          </div>

          <!-- Drop overlay -->
          <Transition name="lumen-drop">
            <div v-if="dropOverlay" class="lumen-drop-overlay">
              <div class="lumen-drop-msg">
                <Download :size="32" />
                <p>Lâcher pour insérer une image ou importer un .md</p>
              </div>
            </div>
          </Transition>
        </section>

        <!-- Outline -->
        <LumenOutline
          v-if="showOutline && !chromeHidden"
          :content="editorContent"
          @navigate="navigateToLine"
        />
      </main>

      <!-- Status bar (editor mode only) -->
      <LumenStatusBar
        v-if="mode === 'editor' && !zenMode"
        :cursor="cursor"
        :content="editorContent"
        :save-state="saveState"
        :saved-at="savedAt"
        :show-line-numbers="showLineNumbers"
        @toggle-line-numbers="showLineNumbers = !showLineNumbers"
      />

      <!-- Hidden file input pour image pick -->
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        class="lumen-hidden-input"
        @change="handleFilePicked"
      />

      <!-- Command palette -->
      <LumenCommandPalette
        :open="showCmdPalette"
        :courses="lumenStore.courses"
        :current-course-id="editorCourseId"
        :commands="paletteCommands"
        :on-course-select="onCmdCourseSelect"
        @close="showCmdPalette = false"
      />
    </div>
  </ErrorBoundary>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   LUMEN — Layout principal
   ═══════════════════════════════════════════════════════════════════════════ */
.lumen-app {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-main);
  color: var(--text-primary);
  font-family: var(--font);
}

.lumen-app--editor { background: var(--bg-main); }

.lumen-app--zen {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background: var(--bg-main);
}

.lumen-hidden-input { display: none; }

/* ── Topbar ─────────────────────────────────────────────────────────────── */
.lumen-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-sidebar);
  flex-shrink: 0;
  min-height: 52px;
}

.lumen-brand { display: flex; align-items: center; gap: 12px; }

.lumen-brand-icon {
  width: 34px; height: 34px;
  border-radius: var(--radius);
  background: var(--accent-subtle);
  display: flex; align-items: center; justify-content: center;
  color: var(--accent);
}

.lumen-brand-text { display: flex; flex-direction: column; line-height: 1.1; }
.lumen-brand-name { font-size: var(--text-md); font-weight: 700; letter-spacing: -0.01em; color: var(--text-primary); }
.lumen-brand-tag  { font-size: var(--text-xs); color: var(--text-secondary); font-weight: 500; margin-top: 2px; }

.lumen-status-pill { display: flex; align-items: center; gap: 8px; margin-left: 8px; }

.lumen-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  white-space: nowrap;
}
.lumen-status--saving    { background: var(--accent-subtle); color: var(--accent-light); }
.lumen-status--dirty     { background: rgba(232, 137, 26, .16); color: var(--color-warning); }
.lumen-status--saved     { background: var(--bg-hover); color: var(--text-secondary); }
.lumen-status--published { background: rgba(46, 204, 113, .16); color: var(--color-success); }

.lumen-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

.lumen-spinner {
  width: 11px; height: 11px;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: lumen-spin 0.7s linear infinite;
}
@keyframes lumen-spin { to { transform: rotate(360deg); } }

.lumen-topbar-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.lumen-topbar-sep { width: 1px; height: 20px; background: var(--border); margin: 0 4px; }

/* ── Zen topbar ──────────────────────────────────────────────────────── */
.lumen-zen-topbar {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
}
.lumen-zen-exit {
  width: 30px; height: 30px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--t-base) ease;
}
.lumen-zen-exit:hover { color: var(--text-primary); background: var(--bg-hover); }

/* ── Buttons ─────────────────────────────────────────────────────────── */
.lumen-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  font-family: inherit;
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--t-base) ease;
  background: transparent;
  color: var(--text-primary);
  white-space: nowrap;
}
.lumen-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.lumen-btn--primary {
  background: var(--accent);
  color: #fff;
}
.lumen-btn--primary:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: var(--shadow-sm);
}
.lumen-btn--primary:active:not(:disabled) {
  filter: brightness(0.92);
}
.lumen-btn:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.lumen-btn--ghost {
  background: transparent;
  border-color: var(--border);
  color: var(--text-secondary);
}
.lumen-btn--ghost:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.lumen-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px; height: 30px;
  border-radius: var(--radius);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--t-base) ease;
}
.lumen-icon-btn:hover { color: var(--text-primary); background: var(--bg-hover); }
.lumen-icon-btn--active { background: var(--bg-active); color: var(--accent-light); }
.lumen-icon-btn:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-offset);
}

/* ── List view ───────────────────────────────────────────────────────── */
.lumen-list-main {
  flex: 1;
  overflow-y: auto;
  padding: 32px 32px 64px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
}

.lumen-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 100px 20px;
  gap: 12px;
  color: var(--text-secondary);
}

.lumen-empty-icon { color: var(--accent); opacity: 0.5; margin-bottom: 8px; }
.lumen-empty h2 { margin: 0; font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); }
.lumen-empty p { margin: 0 0 16px; font-size: var(--text-base); }

.lumen-list-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 18px;
}

.lumen-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  cursor: pointer;
  transition: all var(--t-base) ease;
  text-align: left;
  box-shadow: var(--shadow-card);
}
.lumen-card:hover {
  transform: translateY(-3px);
  border-color: var(--accent);
  box-shadow: var(--shadow-card-hover);
}
.lumen-card:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }
.lumen-card--draft {
  background:
    repeating-linear-gradient(135deg, var(--bg-elevated), var(--bg-elevated) 14px, var(--bg-hover) 14px, var(--bg-hover) 16px);
}

.lumen-card-head { display: flex; align-items: center; justify-content: space-between; }
.lumen-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 700;
}
.lumen-pill--ok    { background: rgba(46, 204, 113, .16); color: var(--color-success); }
.lumen-pill--draft { background: var(--bg-hover); color: var(--text-secondary); }

.lumen-card-date { font-size: var(--text-xs); color: var(--text-muted); }
.lumen-card-title { margin: 0; font-size: var(--text-lg); font-weight: 700; letter-spacing: -0.01em; line-height: 1.3; color: var(--text-primary); }
.lumen-card-summary {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.lumen-card-actions {
  display: flex;
  gap: 14px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
.lumen-card-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  font-family: inherit;
}
.lumen-card-link:hover { color: var(--accent); }
.lumen-card-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.lumen-card-repo,
.lumen-card-note {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-radius: var(--radius-sm);
}
.lumen-card-repo {
  color: var(--accent);
  background: var(--accent-subtle);
}
.lumen-card-note {
  color: #e6a700;
  background: rgba(230, 167, 0, 0.15);
}

/* Barre de filtres + recherche liste */
.lumen-list-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 18px;
  padding: 0 4px;
}
.lumen-list-search {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  flex: 1;
  min-width: 200px;
  max-width: 360px;
  transition: border-color 120ms ease;
}
.lumen-list-search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-subtle);
}
.lumen-list-search-icon { color: var(--text-muted); flex-shrink: 0; }
.lumen-list-search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: 13px;
  color: var(--text-primary);
  min-width: 0;
}
.lumen-list-search-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.lumen-list-search-clear:hover { color: var(--text-primary); }

.lumen-list-filters {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.lumen-list-filter {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  padding: 6px 12px;
  transition: all 120ms ease;
}
.lumen-list-filter:hover { color: var(--text-primary); border-color: var(--text-muted); }
.lumen-list-filter--active {
  background: var(--accent-subtle);
  color: var(--accent);
  border-color: var(--accent);
}
.lumen-list-filter-count {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--bg-hover);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.lumen-list-filter--active .lumen-list-filter-count {
  background: var(--accent);
  color: var(--bg-primary, #111);
}

.lumen-empty--small {
  padding: 40px 20px;
  min-height: 140px;
}
.lumen-card-link:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-offset);
  border-radius: var(--radius-xs);
}

/* ── Reader view ─────────────────────────────────────────────────────── */
.lumen-reader-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ── Editor main layout ──────────────────────────────────────────────── */
.lumen-editor-main {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.lumen-sidebar {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--bg-sidebar);
  display: flex;
  flex-direction: column;
}

.lumen-sidebar-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-size: var(--text-xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.lumen-sidebar-add {
  margin-left: auto;
  width: 24px; height: 24px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.lumen-sidebar-add::before {
  content: '';
  position: absolute;
  inset: -8px;
}
.lumen-sidebar-add:hover { background: var(--bg-hover); color: var(--accent-light); }
.lumen-sidebar-add:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.lumen-sidebar-list {
  margin: 0;
  padding: 8px 0;
  overflow-y: auto;
  flex: 1;
}

.lumen-sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  font-size: var(--text-sm);
  cursor: pointer;
  color: var(--text-secondary);
  border-left: 3px solid transparent;
  transition: all var(--t-base) ease;
  background: transparent;
  border-top: none;
  border-right: none;
  border-bottom: none;
  font-family: inherit;
  text-align: left;
  width: 100%;
  min-height: 36px;
}
.lumen-sidebar-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.lumen-sidebar-item:focus-visible {
  outline: var(--focus-ring);
  outline-offset: -2px;
}
.lumen-sidebar-item--active {
  background: var(--bg-active);
  border-left-color: var(--accent);
  color: var(--text-primary);
  font-weight: 600;
}

.lumen-sidebar-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.lumen-sidebar-dot--ok    { background: var(--color-success); }
.lumen-sidebar-dot--draft { background: var(--text-muted); }

.lumen-sidebar-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lumen-sidebar-empty {
  padding: 24px 16px;
  text-align: center;
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* ── Editor zone ─────────────────────────────────────────────────────── */
.lumen-editor-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
  background: var(--bg-main);
}

.lumen-meta-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 24px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-main);
}

.lumen-meta-title, .lumen-meta-summary {
  width: 100%;
  border: none;
  background: transparent;
  font-family: inherit;
  color: var(--text-primary);
  outline: none;
  padding: 3px 0;
}

.lumen-meta-title {
  font-size: var(--text-xl);
  font-weight: 800;
  letter-spacing: -0.02em;
}
.lumen-meta-title::placeholder { color: var(--text-muted); }

.lumen-meta-summary { font-size: var(--text-base); color: var(--text-secondary); }
.lumen-meta-summary::placeholder { color: var(--text-muted); }

.lumen-meta-project-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.lumen-meta-project-label,
.lumen-meta-promo-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.lumen-meta-promo-label { color: var(--accent); }
.lumen-meta-promo:disabled {
  cursor: not-allowed;
  opacity: 0.7;
  background: var(--bg-hover);
}

/* Ligne repo git d'exemple */
.lumen-meta-repo-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.lumen-meta-repo-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
}
.lumen-meta-repo-input-wrap {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 200px;
  max-width: 420px;
  position: relative;
  background: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  padding: 0 6px 0 10px;
  transition: border-color 120ms ease;
}
.lumen-meta-repo-input-wrap:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-subtle);
}
.lumen-meta-repo-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--text-sm);
  padding: 5px 0;
}
.lumen-meta-repo-input::placeholder { color: var(--text-muted); }
.lumen-meta-repo-input--error { color: var(--color-danger); }
.lumen-meta-repo-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.lumen-meta-repo-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: color 120ms ease, background 120ms ease;
}
.lumen-meta-repo-link:hover {
  color: var(--accent);
  background: var(--bg-hover);
}
.lumen-meta-repo-sync {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  font-size: var(--text-xs);
  padding: 5px 10px;
  font-weight: 600;
  transition: all 120ms ease;
}
.lumen-meta-repo-sync:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--bg-hover);
}
.lumen-meta-repo-sync:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.lumen-spin { animation: lumen-spin-rot 0.8s linear infinite; }
@keyframes lumen-spin-rot {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.lumen-meta-snapshot-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--color-success, #3fb76f);
  padding: 3px 10px;
  background: rgba(63, 183, 111, 0.1);
  border: 1px solid rgba(63, 183, 111, 0.25);
  border-radius: var(--radius-sm);
  width: fit-content;
}
.lumen-meta-snapshot-sha {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  background: rgba(63, 183, 111, 0.18);
  padding: 1px 5px;
  border-radius: 3px;
  margin: 0 2px;
}
.lumen-meta-repo-error {
  margin: 4px 0 0;
  font-size: var(--text-xs);
  color: var(--color-danger);
}
.lumen-meta-project {
  font-family: inherit;
  font-size: var(--text-sm);
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  outline: none;
  cursor: pointer;
  max-width: 320px;
}
.lumen-meta-project:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-subtle);
}

/* ── Split pane ──────────────────────────────────────────────────────── */
.lumen-split {
  flex: 1;
  display: grid;
  min-height: 0;
  overflow: hidden;
}

.lumen-split-handle {
  width: 6px;
  cursor: col-resize;
  background: var(--border);
  position: relative;
  transition: background var(--t-base) ease;
  z-index: 2;
}
.lumen-split-handle::before {
  content: '';
  position: absolute;
  inset: 0 -10px;
}
.lumen-split-handle:hover {
  background: var(--accent);
}

/* ── Drop overlay ────────────────────────────────────────────────────── */
.lumen-drop-overlay {
  position: absolute;
  inset: 0;
  background: var(--bg-active);
  backdrop-filter: blur(3px);
  border: 2px dashed var(--accent);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  pointer-events: none;
  overflow: hidden;
}
.lumen-drop-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--accent-light);
  font-weight: 600;
}
.lumen-drop-msg p { margin: 0; }

.lumen-drop-enter-active, .lumen-drop-leave-active { transition: opacity 150ms ease; }
.lumen-drop-enter-from, .lumen-drop-leave-to { opacity: 0; }

/* ── Focus / Zen modes ───────────────────────────────────────────────── */
.lumen-app--focus .lumen-sidebar,
.lumen-app--focus .lumen-outline,
.lumen-app--focus .lumen-meta-row,
.lumen-app--focus .lumen-toolbar {
  display: none;
}

.lumen-app--zen .lumen-sidebar,
.lumen-app--zen .lumen-outline {
  display: none;
}

/* ── Responsive ──────────────────────────────────────────────────────── */
@media (max-width: 1000px) {
  .lumen-sidebar, .lumen-outline { display: none; }
}

@media (max-width: 700px) {
  .lumen-split { grid-template-columns: 1fr !important; }
  .lumen-split-handle { display: none; }
  .lumen-list-main { padding: 16px; }
}

/* ── Reduced motion : desactive transforms et animations pour a11y ────── */
@media (prefers-reduced-motion: reduce) {
  .lumen-btn,
  .lumen-icon-btn,
  .lumen-card,
  .lumen-sidebar-item,
  .lumen-split-handle {
    transition: none !important;
  }
  .lumen-btn--primary:hover:not(:disabled),
  .lumen-card:hover {
    transform: none !important;
  }
  .lumen-spinner,
  .lumen-drop-enter-active,
  .lumen-drop-leave-active {
    animation: none !important;
  }
}
</style>
