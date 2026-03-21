<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  BookOpen, BarChart2, List, Grid, Plus, Upload, Link2, X,
  FileText, CheckCircle2, Clock, Lock, AlertTriangle, ChevronRight,
  Users, Award, Calendar, LayoutList, Menu, Eye, EyeOff,
  FolderOpen, Trash2, Copy, ExternalLink,
} from 'lucide-vue-next'
import { useAppStore }     from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { useModalsStore }  from '@/stores/modals'
import { useToast }        from '@/composables/useToast'
import { deadlineClass, deadlineLabel, formatDate } from '@/utils/date'
import { avatarColor, initials } from '@/utils/format'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import type { Devoir, Rubric } from '@/types'
import ProjetFiche        from '@/components/projet/ProjetFiche.vue'
import StudentProjetFiche from '@/components/projet/StudentProjetFiche.vue'

const props = defineProps<{ toggleSidebar?: () => void }>()
const { showToast } = useToast()

const appStore     = useAppStore()
const travauxStore = useTravauxStore()
const modals       = useModalsStore()

// ── Vue locale enseignant ──────────────────────────────────────────────────────
const teacherView = ref<'gantt' | 'liste' | 'rendus'>('gantt')

// ── Filtres prof ─────────────────────────────────────────────────────────────
const filterCategory = ref<string>('')
const filterRendusStatus = ref<'all' | 'ungraded' | 'graded' | 'missing'>('all')
const sortRendus = ref<'name' | 'date'>('name')
const teacherSearch = ref('')
const filterStatus = ref<'all' | 'draft' | 'expired' | 'pending'>('all')
const collapsedProjects = ref<Set<string>>(new Set())

function toggleProjectCollapse(project: string) {
  if (collapsedProjects.value.has(project)) collapsedProjects.value.delete(project)
  else collapsedProjects.value.add(project)
}

// ── Tableau unifié prof ─────────────────────────────────────────────────────
type UnifiedRow = Devoir & { depots_count: number; students_total: number; noted_count: number; statusLabel: string; statusCls: string }

const unifiedGrouped = computed(() => {
  const raw = travauxStore.ganttData as (Devoir & { depots_count?: number; students_total?: number })[]
  const q = teacherSearch.value.toLowerCase().trim()
  const now = Date.now()

  const filtered = raw.filter(t => {
    if (filterCategory.value && t.category?.trim() !== filterCategory.value) return false
    if (q && !t.title.toLowerCase().includes(q)) return false
    if (filterStatus.value === 'draft' && t.is_published) return false
    if (filterStatus.value === 'expired' && (new Date(t.deadline).getTime() > now || !t.is_published)) return false
    if (filterStatus.value === 'pending') {
      const dc = t.depots_count ?? 0
      const st = t.students_total ?? 0
      if (dc >= st && st > 0) return false // complet
    }
    return true
  })

  // Grouper par catégorie
  const groups = new Map<string, UnifiedRow[]>()
  for (const t of filtered) {
    const cat = t.category?.trim() || 'Sans projet'
    if (!groups.has(cat)) groups.set(cat, [])
    const dc = t.depots_count ?? 0
    const st = t.students_total ?? 0
    // Compter les notés depuis allRendus
    const noted = travauxStore.allRendus.filter(r => r.travail_id === t.id && r.note != null).length

    let statusLabel = 'Publié'
    let statusCls = 'status-pub'
    if (!t.is_published) { statusLabel = 'Brouillon'; statusCls = 'status-draft' }
    else if (st > 0 && dc >= st) { statusLabel = 'Complet'; statusCls = 'status-complete' }
    else if (new Date(t.deadline).getTime() < now) { statusLabel = 'Expiré'; statusCls = 'status-expired' }

    groups.get(cat)!.push({ ...t, depots_count: dc, students_total: st, noted_count: noted, statusLabel, statusCls })
  }
  // Trier par deadline dans chaque groupe
  for (const rows of groups.values()) {
    rows.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))
})

// ── Publish inline + ajout par type ──────────────────────────────────────────
async function publishDevoir(id: number, event: Event) {
  event.stopPropagation()
  try {
    await window.api.updateTravailPublished({ travailId: id, published: true })
    showToast('Devoir publié.', 'success')
    loadView()
  } catch { showToast('Erreur.', 'error') }
}

async function publishAllDrafts() {
  const drafts = unifiedFlat.value.filter(t => !t.is_published)
  if (!drafts.length) return
  let count = 0
  for (const d of drafts) {
    try {
      await window.api.updateTravailPublished({ travailId: d.id, published: true })
      count++
    } catch {}
  }
  showToast(`${count} devoir${count > 1 ? 's' : ''} publié${count > 1 ? 's' : ''}.`, 'success')
  loadView()
}

function addDevoirOfType(type: string) {
  // Pré-sélectionner le type dans la modale
  appStore.pendingDevoirType = type
  modals.newDevoir = true
}

// ── Menu contextuel cartes devoirs ───────────────────────────────────────────
const ctxMenu = ref<{ x: number; y: number; devoir: (Devoir & { is_published?: boolean | number }) | null }>({ x: 0, y: 0, devoir: null })

function openCtxMenu(e: MouseEvent, devoir: Devoir) {
  e.preventDefault()
  e.stopPropagation()
  ctxMenu.value = { x: e.clientX, y: e.clientY, devoir: devoir as any }
}

function closeCtxMenu() {
  ctxMenu.value = { x: 0, y: 0, devoir: null }
}

async function ctxPublishToggle() {
  const d = ctxMenu.value.devoir
  if (!d) return
  const newVal = !d.is_published
  try {
    await window.api.updateTravailPublished({ travailId: d.id, published: newVal })
    showToast(newVal ? 'Devoir publié.' : 'Devoir dépublié.', 'success')
    loadView()
  } catch { showToast('Erreur.', 'error') }
  closeCtxMenu()
}

async function ctxDuplicate() {
  const d = ctxMenu.value.devoir
  if (!d) return
  try {
    await window.api.createTravail({
      title: d.title + ' (copie)',
      description: d.description || '',
      deadline: d.deadline,
      channel_id: d.channel_id,
      promo_id: d.promo_id,
      type: d.type || 'devoir',
      category: d.category || '',
      room: d.room || '',
      published: false,
    })
    showToast('Devoir dupliqué (brouillon).', 'success')
    loadView()
  } catch { showToast('Erreur lors de la duplication.', 'error') }
  closeCtxMenu()
}

async function ctxDelete() {
  const d = ctxMenu.value.devoir
  if (!d) return
  if (!confirm(`Supprimer « ${d.title} » ? Les soumissions et notes seront perdues.`)) {
    closeCtxMenu()
    return
  }
  try {
    await window.api.deleteTravail(d.id)
    showToast('Devoir supprimé.', 'success')
    loadView()
  } catch { showToast('Erreur.', 'error') }
  closeCtxMenu()
}

function ctxOpen() {
  const d = ctxMenu.value.devoir
  if (!d) return
  closeCtxMenu()
  openDevoir(d.id)
}

// ── Stats globales promo ────────────────────────────────────────────────────
const globalDrafts = computed(() =>
  (travauxStore.ganttData as Devoir[]).filter(t => !t.is_published).length,
)
const globalToGrade = computed(() => {
  const all = travauxStore.allRendus
  return all.filter(r => !r.note && r.submitted_at).length
})

// ── Prochains événements (tous types, triés par deadline) ───────────────────
const upcomingDevoirs = computed(() => {
  const now = Date.now()
  return (travauxStore.ganttData as Devoir[])
    .filter(t => t.is_published && new Date(t.deadline).getTime() > now)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5)
})

// ── Helpers pour la page d'accueil projets ──────────────────────────────────
function projectDevoirCount(cat: string): number {
  return (travauxStore.ganttData as Devoir[]).filter(t => t.category?.trim() === cat).length
}
function projectNextDeadline(cat: string): string | null {
  const now = Date.now()
  const upcoming = (travauxStore.ganttData as Devoir[])
    .filter(t => t.category?.trim() === cat && t.is_published && new Date(t.deadline).getTime() > now)
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  return upcoming[0]?.deadline ?? null
}
function projectTypeCounts(cat: string): { type: string; count: number }[] {
  const counts: Record<string, number> = {}
  for (const t of (travauxStore.ganttData as Devoir[]).filter(d => d.category?.trim() === cat)) {
    counts[t.type] = (counts[t.type] ?? 0) + 1
  }
  return Object.entries(counts).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)
}

// Stats enrichies par projet (pour cartes et résumé)
function projectStats(cat: string) {
  const devoirs = (travauxStore.ganttData as (Devoir & { depots_count?: number; students_total?: number })[])
    .filter(d => d.category?.trim() === cat)
  const totalDepots = devoirs.reduce((s, d) => s + (d.depots_count ?? 0), 0)
  const totalExpected = devoirs.reduce((s, d) => s + (d.students_total ?? 0), 0)
  const pct = totalExpected > 0 ? Math.round((totalDepots / totalExpected) * 100) : 0
  const drafts = devoirs.filter(d => !d.is_published).length
  const noted = travauxStore.allRendus.filter(r => devoirs.some(d => d.id === r.travail_id) && r.note != null).length
  const toGrade = totalDepots - noted
  return { totalDepots, totalExpected, pct, drafts, noted, toGrade }
}

// Extraire la durée depuis la description (ex: "Durée : 20 min")
function extractDuration(desc: string | null): string | null {
  if (!desc) return null
  const m = desc.match(/Durée\s*:\s*(\d+)\s*min/i)
  return m ? m[1] + ' min' : null
}

// Déterminer si c'est un rattrapage
function isRattrapage(t: Devoir): boolean {
  return !!(t.title?.includes('Rattrapage') || t.description?.includes('Rattrapage'))
}

// ── Devoirs par type (pour la vue projet sélectionné) ───────────────────────
const TYPE_ORDER = ['cctl', 'soutenance', 'etude_de_cas', 'livrable', 'memoire', 'autre']
const devoirsByType = computed(() => {
  const groups: Record<string, typeof unifiedFlat.value> = {}
  for (const t of unifiedFlat.value) {
    if (!groups[t.type]) groups[t.type] = []
    groups[t.type].push(t)
  }
  return TYPE_ORDER
    .filter(type => groups[type]?.length)
    .map(type => {
      const items = groups[type]
      const initiales = items.filter(t => !isRattrapage(t)).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      const rattrapages = items.filter(t => isRattrapage(t)).sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      return { type, initiales, rattrapages, total: items.length }
    })
})

// Liste plate pour le tableau (quand on filtre par catégorie via onglets)
type UnifiedFlatRow = UnifiedRow & { hasSubmission: boolean }
const unifiedFlat = computed((): UnifiedFlatRow[] => {
  const raw = travauxStore.ganttData as (Devoir & { depots_count?: number; students_total?: number })[]
  const now = Date.now()

  return raw
    .filter(t => {
      // Filtre par projet actif (prioritaire) ou par onglet catégorie
      const catFilter = appStore.activeProject || filterCategory.value
      if (catFilter && t.category?.trim() !== catFilter) return false
      if (teacherSearch.value) {
        const q = teacherSearch.value.toLowerCase().trim()
        if (!t.title.toLowerCase().includes(q)) return false
      }
      return true
    })
    .map(t => {
      const dc = t.depots_count ?? 0
      const st = t.students_total ?? 0
      const noted = travauxStore.allRendus.filter(r => r.travail_id === t.id && r.note != null).length
      const isEvent = t.type === 'soutenance' || t.type === 'cctl'

      let statusLabel = 'Publié'
      let statusCls = 'status-pub'
      if (!t.is_published) { statusLabel = 'Brouillon'; statusCls = 'status-draft' }
      else if (!isEvent && st > 0 && dc >= st) { statusLabel = 'Complet'; statusCls = 'status-complete' }
      else if (new Date(t.deadline).getTime() < now) { statusLabel = 'Passé'; statusCls = 'status-expired' }

      return {
        ...t,
        depots_count: dc,
        students_total: st,
        noted_count: noted,
        statusLabel,
        statusCls,
        hasSubmission: !isEvent,
      } as UnifiedFlatRow
    })
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
})

// ── Horloge temps réel pour verrouillage des deadlines ────────────────────────
const now = ref(Date.now())
let clockInterval: ReturnType<typeof setInterval> | null = null

/** Renvoie true si la deadline est passée (verrouille le bouton Déposer) */
function isExpired(deadline: string | null | undefined): boolean {
  if (!deadline) return false
  return now.value >= new Date(deadline).getTime()
}

/** Types qui n'ont pas de dépôt fichier (présence requise) */
function isEventType(type: string): boolean {
  return type === 'soutenance' || type === 'cctl'
}

/** Vérifie si un devoir nécessite un rendu (basé sur requires_submission du backend) */
function needsSubmission(devoir: Devoir): boolean {
  return devoir.requires_submission !== 0
}

// ── Dépôt inline (étudiant) ───────────────────────────────────────────────────
const depositingDevoirId = ref<number | null>(null)
const depositMode        = ref<'file' | 'link'>('file')
const depositLink        = ref('')
const depositFile        = ref<string | null>(null)
const depositFileName    = ref<string | null>(null)
const depositing         = ref(false)
const rubricPreview      = ref<Rubric | null>(null)

// ── Notation inline (prof, vue rendus) ────────────────────────────────────────
const editingDepotId      = ref<number | null>(null)
const pendingNoteValue    = ref('')
const pendingFeedbackValue = ref('')
const savingGrade         = ref(false)

// ── Lifecycle ─────────────────────────────────────────────────────────────────
function handleGlobalClick() { closeCtxMenu() }

onMounted(async () => {
  clockInterval = setInterval(() => { now.value = Date.now() }, 30_000)
  document.addEventListener('click', handleGlobalClick)
  await loadView()
})

onBeforeUnmount(() => {
  if (clockInterval !== null) clearInterval(clockInterval)
  document.removeEventListener('click', handleGlobalClick)
})

// ── Chargement des données ─────────────────────────────────────────────────────
async function loadView() {
  if (appStore.isStudent) {
    await travauxStore.fetchStudentDevoirs()
  } else {
    const promoId = appStore.activePromoId
    if (!promoId) return
    await travauxStore.fetchGantt(promoId)
    if (teacherView.value === 'rendus') {
      await travauxStore.fetchRendus(promoId)
    }
    travauxStore.setView(teacherView.value === 'rendus' ? 'rendus' : 'gantt')
  }
}

function setTeacherView(v: 'gantt' | 'liste' | 'rendus') {
  teacherView.value = v
  loadView()
}

watch(() => appStore.activePromoId, loadView)

watch(() => appStore.activeChannelId, () => {
  if (appStore.isStudent) travauxStore.fetchStudentDevoirs()
})

// ── Groupes urgence étudiant ───────────────────────────────────────────────────
const studentGroups = computed(() => {
  const all = appStore.activeProject
    ? travauxStore.devoirs.filter(t => t.category === appStore.activeProject)
    : travauxStore.devoirs
  return {
    overdue:   all.filter(t => t.depot_id == null && needsSubmission(t) && isExpired(t.deadline)),
    urgent:    all.filter(t => {
      if (t.depot_id != null || isExpired(t.deadline) || !needsSubmission(t)) return false
      return new Date(t.deadline).getTime() - now.value < 3 * 86_400_000
    }),
    pending:   all.filter(t => {
      if (t.depot_id != null || isExpired(t.deadline) || !needsSubmission(t)) return false
      return new Date(t.deadline).getTime() - now.value >= 3 * 86_400_000
    }),
    event:     all.filter(t => !needsSubmission(t) && t.depot_id == null),
    submitted: all.filter(t => t.depot_id != null || (!needsSubmission(t) && isExpired(t.deadline))),
  }
})

// Simplification : submitted = ceux qui ont depot_id
const filteredDevoirs  = computed(() =>
  appStore.activeProject
    ? travauxStore.devoirs.filter(t => t.category === appStore.activeProject)
    : travauxStore.devoirs
)
const submittedDevoirs = computed(() => filteredDevoirs.value.filter(t => t.depot_id != null))
const pendingDeposit   = computed(() =>
  filteredDevoirs.value.filter(t => t.depot_id == null && needsSubmission(t)),
)
const eventDevoirs     = computed(() => filteredDevoirs.value.filter(t => !needsSubmission(t)))

const studentStats = computed(() => ({
  total:     filteredDevoirs.value.length,
  pending:   studentGroups.value.overdue.length + studentGroups.value.urgent.length + studentGroups.value.pending.length,
  urgent:    studentGroups.value.overdue.length + studentGroups.value.urgent.length,
  submitted: submittedDevoirs.value.length,
}))

// ── Dépôt étudiant ─────────────────────────────────────────────────────────────
async function startDeposit(t: Devoir) {
  depositingDevoirId.value = t.id
  depositMode.value        = 'file'
  depositLink.value        = ''
  depositFile.value        = null
  depositFileName.value    = null
  rubricPreview.value      = null
  const res = await window.api.getRubric(t.id)
  rubricPreview.value = res?.ok && res.data ? res.data : null
}

function cancelDeposit() {
  depositingDevoirId.value = null
  rubricPreview.value      = null
}

async function pickFile() {
  const res = await window.api.openFileDialog()
  if (res?.ok && res.data) {
    depositFile.value     = res.data
    depositFileName.value = res.data.split(/[\\/]/).pop() ?? res.data
  }
}

function clearDepositFile() {
  depositFile.value     = null
  depositFileName.value = null
}

async function submitDeposit(devoir: Devoir) {
  if (depositing.value) return
  if (!appStore.currentUser) return
  if (depositMode.value === 'file' && !depositFile.value) return
  if (depositMode.value === 'link' && !depositLink.value.trim()) return
  if (isExpired(devoir.deadline)) return

  depositing.value = true
  try {
    const ok = await travauxStore.addDepot({
      travail_id: devoir.id,
      student_id: appStore.currentUser.id,
      type:       depositMode.value,
      content:    depositMode.value === 'file' ? depositFile.value! : depositLink.value.trim(),
      file_name:  depositMode.value === 'file' ? depositFileName.value : null,
    })
    if (ok) {
      const fileName = depositMode.value === 'file' ? depositFileName.value : depositLink.value.trim()
      const time = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      showToast(`Rendu soumis — ${fileName} — ${time}`, 'success')
      cancelDeposit()
      await travauxStore.fetchStudentDevoirs()
    } else {
      showToast('Erreur lors du dépôt. Veuillez réessayer.', 'error')
    }
  } finally {
    depositing.value = false
  }
}

// ── Vue prof : ouvrir un devoir ────────────────────────────────────────────────
async function openDevoir(devoirId: number) {
  appStore.currentTravailId = devoirId
  await travauxStore.openTravail(devoirId)
  modals.gestionDevoir = true
}

// ── Notation inline (prof) ─────────────────────────────────────────────────────
function startEditGrade(depotId: number, currentNote: string | null, currentFeedback: string | null) {
  editingDepotId.value       = depotId
  pendingNoteValue.value     = currentNote ?? ''
  pendingFeedbackValue.value = currentFeedback ?? ''
}

function cancelEditGrade() {
  editingDepotId.value = null
}

async function saveGrade(depotId: number) {
  savingGrade.value = true
  try {
    await travauxStore.setNote({ depotId, note: pendingNoteValue.value.trim() || null })
    await travauxStore.setFeedback({ depotId, feedback: pendingFeedbackValue.value.trim() || null })
    editingDepotId.value = null
    // Refresh rendus
    const promoId = appStore.activePromoId
    if (promoId) await travauxStore.fetchRendus(promoId)
  } finally {
    savingGrade.value = false
  }
}

// ── Gantt : calcul des positions ───────────────────────────────────────────────
type GanttItem = Devoir & { left: number; width: number; dlClass: string }

// Catégories disponibles pour le filtre
const teacherCategories = computed(() => {
  const cats = new Set((travauxStore.ganttData as Devoir[]).map(t => t.category?.trim()).filter(Boolean))
  return Array.from(cats).sort() as string[]
})

const ganttItems = computed((): { items: GanttItem[]; todayPct: number } => {
  let raw = travauxStore.ganttData as Devoir[]
  if (filterCategory.value) raw = raw.filter(t => t.category?.trim() === filterCategory.value)
  if (!raw.length) return { items: [], todayPct: 0 }

  const dates = raw.flatMap(t => [
    t.start_date ? new Date(t.start_date).getTime() : new Date(t.deadline).getTime() - 7 * 86400000,
    new Date(t.deadline).getTime(),
  ])
  const minT = Math.min(...dates)
  const maxT = Math.max(...dates)
  const span = maxT - minT || 1

  const todayPct = Math.max(0, Math.min(100, ((now.value - minT) / span) * 100))

  const items = raw.map(t => {
    const startMs = t.start_date
      ? new Date(t.start_date).getTime()
      : new Date(t.deadline).getTime() - 7 * 86400000
    const endMs   = new Date(t.deadline).getTime()
    const left    = ((startMs - minT) / span) * 100
    const width   = Math.max(((endMs - startMs) / span) * 100, 2)
    return { ...t, left, width, dlClass: deadlineClass(t.deadline) }
  })

  return { items, todayPct }
})

// ── Rendus : grouper par devoir avec titres + filtres ──────────────────────────
const rendusByDevoir = computed(() => {
  const ganttMap = new Map((travauxStore.ganttData as (Devoir & { students_total?: number })[]).map(t => [t.id, t]))
  const map = new Map<number, { devoir: Partial<Devoir & { students_total?: number }>; rendus: typeof travauxStore.allRendus }>()
  for (const r of travauxStore.allRendus) {
    // Filtre par catégorie
    const gt = ganttMap.get(r.travail_id)
    if (filterCategory.value && gt?.category?.trim() !== filterCategory.value) continue
    if (!map.has(r.travail_id)) {
      map.set(r.travail_id, { devoir: gt ?? { id: r.travail_id }, rendus: [] })
    }
    map.get(r.travail_id)!.rendus.push(r)
  }
  // Filtre par statut + tri
  const groups = [...map.values()]
  for (const g of groups) {
    // Filtre statut
    if (filterRendusStatus.value === 'ungraded') g.rendus = g.rendus.filter(r => !r.note)
    else if (filterRendusStatus.value === 'graded') g.rendus = g.rendus.filter(r => !!r.note)
    // Tri
    g.rendus.sort((a, b) => {
      if (sortRendus.value === 'name') return (a.student_name ?? '').localeCompare(b.student_name ?? '')
      return new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime()
    })
  }
  // Retirer les groupes vides après filtre
  return groups.filter(g => g.rendus.length > 0)
})

// ── Vue étudiant : résumé par projet (sans filtre actif) ──────────────────
const studentProjectOverview = computed(() => {
  if (appStore.activeProject) return []
  const map = new Map<string, { key: string; label: string; total: number; submitted: number; pending: number }>()
  for (const t of travauxStore.devoirs) {
    const cat   = t.category?.trim() || null
    const mKey  = cat ?? '__none__'
    if (!map.has(mKey)) {
      map.set(mKey, {
        key:       mKey,
        label:     cat ? parseCategoryIcon(cat).label || cat : 'Sans projet',
        total:     0,
        submitted: 0,
        pending:   0,
      })
    }
    const g = map.get(mKey)!
    g.total++
    if (t.depot_id != null) g.submitted++
    else if (!isEventType(t.type)) g.pending++
  }
  return [...map.values()]
    .filter(g => g.total > 0 && g.key !== '__none__')
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
})

// ── Label lisible pour les types ──────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  livrable:    'Livrable',
  soutenance:  'Soutenance',
  cctl:        'CCTL',
  etude_de_cas:'Étude de cas',
  memoire:     'Mémoire',
  autre:       'Autre',
  // backward compat
  devoir:      'Devoir',
  projet:      'Projet',
  jalon:       'Jalon',
}

function typeLabel(t: string): string {
  return TYPE_LABELS[t] ?? t
}
</script>

<template>
  <div class="devoirs-area">

    <!-- ── En-tête ─────────────────────────────────────────────────────────── -->
    <header class="devoirs-header">
      <div class="devoirs-header-title">
        <button v-if="props.toggleSidebar" class="mobile-hamburger" aria-label="Ouvrir le menu" @click="props.toggleSidebar">
          <Menu :size="22" />
        </button>
        <BookOpen :size="18" />
        <span>Devoirs</span>
        <template v-if="appStore.activeProject">
          <span class="header-breadcrumb-sep">›</span>
          <span class="header-project-ctx">{{ appStore.activeProject.replace(/^\S+\s/, '') }}</span>
          <button class="header-project-clear" title="Voir tous les devoirs" @click="appStore.activeProject = null">✕</button>
        </template>
        <span v-else-if="appStore.activeChannelName" class="header-channel-ctx">
          # {{ appStore.activeChannelName }}
        </span>
      </div>

      <div class="devoirs-header-actions">
        <!-- Actions prof — masqué quand on est sur la fiche projet -->
        <template v-if="appStore.isTeacher && !appStore.activeProject">
          <button class="btn-primary btn-nouveau" @click="modals.newDevoir = true">
            <Plus :size="14" /> Nouveau
          </button>
        </template>
      </div>

      <!-- Bouton Nouveau (quand dans un projet) -->
      <template v-if="appStore.isTeacher && appStore.activeProject">
        <button class="btn-primary btn-nouveau" @click="modals.newDevoir = true">
          <Plus :size="14" /> Nouveau
        </button>
      </template>
    </header>

    <!-- ── Barre de stats étudiant ──────────────────────────────────────────── -->
    <div
      v-if="appStore.isStudent && filteredDevoirs.length > 0"
      class="student-stats-bar"
    >
      <div class="stat-chip stat-chip-neutral">
        <span class="stat-dot dot-neutral" />
        <strong>{{ studentStats.total }}</strong>&nbsp;total
      </div>
      <div class="stat-chip stat-chip-blue">
        <span class="stat-dot dot-blue" />
        <strong>{{ studentStats.pending }}</strong>&nbsp;à rendre
      </div>
      <div class="stat-chip stat-chip-red">
        <span class="stat-dot dot-red" />
        <strong>{{ studentStats.urgent }}</strong>&nbsp;urgent
      </div>
      <div class="stat-chip stat-chip-green">
        <span class="stat-dot dot-green" />
        <strong>{{ studentStats.submitted }}</strong>&nbsp;rendu{{ studentStats.submitted > 1 ? 's' : '' }}
      </div>
    </div>

    <!-- ── Contenu principal ────────────────────────────────────────────────── -->
    <div class="devoirs-content">

      <!-- ════════════════════════ Vue ÉTUDIANT ════════════════════════ -->
      <template v-if="appStore.isStudent">

        <!-- Fiche projet étudiant (filtre projet actif) -->
        <template v-if="appStore.activeProject && appStore.activePromoId">
          <StudentProjetFiche
            :project-key="appStore.activeProject"
            :promo-id="appStore.activePromoId"
          />
        </template>

        <!-- Squelettes -->
        <div v-else-if="travauxStore.loading" class="devoirs-list">
          <div v-for="i in 4" :key="i" class="skel-card">
            <div class="skel skel-line skel-w30" style="height:12px" />
            <div class="skel skel-line skel-w70" style="height:16px;margin-top:10px" />
            <div class="skel skel-line skel-w90" style="height:12px;margin-top:8px" />
            <div class="skel skel-line skel-w50" style="height:12px;margin-top:6px" />
          </div>
        </div>

        <!-- État vide -->
        <div v-else-if="filteredDevoirs.length === 0" class="empty-state-custom">
          <CheckCircle2 :size="48" class="empty-icon" />
          <h3>Aucun devoir assigné</h3>
          <p>Vos devoirs apparaîtront ici dès qu'un enseignant en créera.</p>
        </div>

        <!-- Aperçu par projet (sans filtre actif, plusieurs projets) -->
        <div v-else-if="!appStore.activeProject && studentProjectOverview.length > 1" class="student-project-overview">
          <button
            v-for="p in studentProjectOverview"
            :key="p.key"
            class="student-proj-card"
            @click="appStore.activeProject = p.key"
          >
            <span class="student-proj-label">{{ p.label }}</span>
            <span class="student-proj-stat">
              <span class="student-proj-submitted">{{ p.submitted }} rendu{{ p.submitted > 1 ? 's' : '' }}</span>
              <span v-if="p.pending" class="student-proj-pending"> · {{ p.pending }} à faire</span>
            </span>
            <div class="student-proj-bar">
              <div
                class="student-proj-bar-fill"
                :style="{ width: (p.total ? Math.round(p.submitted / p.total * 100) : 0) + '%' }"
              />
            </div>
          </button>
        </div>

        <!-- Groupes de devoirs (filtre actif ou un seul projet) -->
        <div v-else class="devoirs-grouped">

          <!-- ▸ EN RETARD -->
          <template v-if="studentGroups.overdue.length">
            <div class="group-header group-header--danger" title="Deadline dépassée — dépôt verrouillé">
              <Lock :size="12" /> En retard
              <span class="group-count">{{ studentGroups.overdue.length }}</span>
              <span class="group-subtitle">La deadline est dépassée — le dépôt n'est plus possible</span>
            </div>
            <div class="devoirs-list">
              <div v-for="t in studentGroups.overdue" :key="t.id" class="devoir-card devoir-card--overdue">
                <div class="devoir-card-header">
                  <div class="devoir-card-meta">
                    <span class="devoir-type-badge" :class="`type-${t.type}`">{{ typeLabel(t.type) }}</span>
                    <span v-if="t.category" class="tag-badge">{{ parseCategoryIcon(t.category).label || t.category }}</span>
                    <span v-if="t.channel_name" class="devoir-channel"># {{ t.channel_name }}</span>
                  </div>
                  <span class="deadline-badge" :class="deadlineClass(t.deadline)">
                    <Clock :size="10" />{{ deadlineLabel(t.deadline) }}
                  </span>
                </div>
                <h3 class="devoir-card-title">{{ t.title }}</h3>
                <p v-if="t.description" class="devoir-card-desc">{{ t.description }}</p>
                <p v-if="t.room" class="devoir-card-room">Salle {{ t.room }}</p>
                <div v-if="t.aavs" class="devoir-card-aavs"><span v-for="a in t.aavs.split('\n').filter(Boolean)" :key="a" class="aav-tag">{{ a.trim() }}</span></div>
                <div class="devoir-card-footer">
                  <span class="devoir-deadline-date">Échéance : {{ formatDate(t.deadline) }}</span>
                  <button class="btn-deposit-expired" disabled>
                    <Lock :size="12" /> Délai expiré
                  </button>
                </div>
              </div>
            </div>
          </template>

          <!-- ▸ URGENT -->
          <template v-if="studentGroups.urgent.length">
            <div class="group-header group-header--warning" title="Moins de 3 jours avant la deadline">
              <AlertTriangle :size="12" /> Urgent
              <span class="group-count">{{ studentGroups.urgent.length }}</span>
              <span class="group-subtitle">Moins de 3 jours avant la deadline</span>
            </div>
            <div class="devoirs-list">
              <div v-for="t in studentGroups.urgent" :key="t.id" class="devoir-card devoir-card--urgent">
                <div class="devoir-card-header">
                  <div class="devoir-card-meta">
                    <span class="devoir-type-badge" :class="`type-${t.type}`">{{ typeLabel(t.type) }}</span>
                    <span v-if="t.category" class="tag-badge">{{ parseCategoryIcon(t.category).label || t.category }}</span>
                    <span v-if="t.channel_name" class="devoir-channel"># {{ t.channel_name }}</span>
                  </div>
                  <span class="deadline-badge" :class="deadlineClass(t.deadline)">
                    <Clock :size="10" />{{ deadlineLabel(t.deadline) }}
                  </span>
                </div>
                <h3 class="devoir-card-title">{{ t.title }}</h3>
                <p v-if="t.description" class="devoir-card-desc">{{ t.description }}</p>
                <p v-if="t.room" class="devoir-card-room">Salle {{ t.room }}</p>
                <div v-if="t.aavs" class="devoir-card-aavs"><span v-for="a in t.aavs.split('\n').filter(Boolean)" :key="a" class="aav-tag">{{ a.trim() }}</span></div>
                <template v-if="depositingDevoirId === t.id">
                  <div class="deposit-form">
                    <div class="deposit-type-toggle">
                      <button class="deposit-toggle-btn" :class="{ active: depositMode === 'file' }" @click="depositMode = 'file'">
                        <FileText :size="12" /> Fichier
                      </button>
                      <button class="deposit-toggle-btn" :class="{ active: depositMode === 'link' }" @click="depositMode = 'link'">
                        <Link2 :size="12" /> Lien URL
                      </button>
                    </div>
                    <div v-if="depositMode === 'file'">
                      <div v-if="depositFile" class="deposit-file-selected">
                        <CheckCircle2 :size="15" class="deposit-file-selected-icon" />
                        <span class="deposit-file-selected-name">{{ depositFileName }}</span>
                        <button class="deposit-file-selected-clear" type="button" @click.stop="clearDepositFile">
                          <X :size="12" />
                        </button>
                      </div>
                      <div v-else class="deposit-file-zone" @click="pickFile">
                        <Upload :size="20" class="deposit-file-zone-icon" />
                        <span class="deposit-file-zone-label">Cliquer pour choisir un fichier</span>
                        <span class="deposit-file-zone-hint">PDF, images, archives…</span>
                      </div>
                    </div>
                    <input v-else v-model="depositLink" class="form-input" placeholder="https://…" type="url" />
                    <!-- Grille d'évaluation (lecture seule) -->
                    <div v-if="rubricPreview" class="rubric-preview">
                      <div class="rubric-preview-header">
                        <LayoutList :size="12" />
                        <span>{{ rubricPreview.title }}</span>
                      </div>
                      <div class="rubric-preview-criteria">
                        <div
                          v-for="c in rubricPreview.criteria"
                          :key="c.id"
                          class="rubric-preview-criterion"
                        >
                          <span class="rubric-preview-label">{{ c.label }}</span>
                          <span class="rubric-preview-pts">/ {{ c.max_pts }} pt{{ c.max_pts > 1 ? 's' : '' }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="deposit-actions">
                      <button class="btn-ghost btn-deposit-cancel" @click="cancelDeposit"><X :size="12" /> Annuler</button>
                      <button
                        class="btn-primary btn-deposit-submit"
                        :disabled="depositing || isExpired(t.deadline) || (depositMode === 'file' ? !depositFile : !depositLink.trim())"
                        @click="submitDeposit(t)"
                      >
                        <Upload :size="12" />
                        {{ depositing ? 'Dépôt…' : isExpired(t.deadline) ? 'Délai expiré' : 'Déposer' }}
                      </button>
                    </div>
                  </div>
                </template>
                <div v-else class="devoir-card-footer">
                  <span class="devoir-deadline-date">Échéance : {{ formatDate(t.deadline) }}</span>
                  <button class="btn-primary btn-deposit" @click="startDeposit(t)">
                    <Upload :size="12" /> Déposer
                  </button>
                </div>
              </div>
            </div>
          </template>

          <!-- ▸ À RENDRE -->
          <template v-if="studentGroups.pending.length">
            <div class="group-header group-header--accent" title="Plus de 3 jours avant la deadline">
              <Clock :size="12" /> À rendre
              <span class="group-count">{{ studentGroups.pending.length }}</span>
              <span class="group-subtitle">Vous avez encore du temps, mais pensez-y</span>
            </div>
            <div class="devoirs-list">
              <div v-for="t in studentGroups.pending" :key="t.id" class="devoir-card devoir-card--pending">
                <div class="devoir-card-header">
                  <div class="devoir-card-meta">
                    <span class="devoir-type-badge" :class="`type-${t.type}`">{{ typeLabel(t.type) }}</span>
                    <span v-if="t.category" class="tag-badge">{{ parseCategoryIcon(t.category).label || t.category }}</span>
                    <span v-if="t.channel_name" class="devoir-channel"># {{ t.channel_name }}</span>
                  </div>
                  <span class="deadline-badge" :class="deadlineClass(t.deadline)">
                    <Clock :size="10" />{{ deadlineLabel(t.deadline) }}
                  </span>
                </div>
                <h3 class="devoir-card-title">{{ t.title }}</h3>
                <p v-if="t.description" class="devoir-card-desc">{{ t.description }}</p>
                <p v-if="t.room" class="devoir-card-room">Salle {{ t.room }}</p>
                <div v-if="t.aavs" class="devoir-card-aavs"><span v-for="a in t.aavs.split('\n').filter(Boolean)" :key="a" class="aav-tag">{{ a.trim() }}</span></div>
                <template v-if="depositingDevoirId === t.id">
                  <div class="deposit-form">
                    <div class="deposit-type-toggle">
                      <button class="deposit-toggle-btn" :class="{ active: depositMode === 'file' }" @click="depositMode = 'file'">
                        <FileText :size="12" /> Fichier
                      </button>
                      <button class="deposit-toggle-btn" :class="{ active: depositMode === 'link' }" @click="depositMode = 'link'">
                        <Link2 :size="12" /> Lien URL
                      </button>
                    </div>
                    <div v-if="depositMode === 'file'">
                      <div v-if="depositFile" class="deposit-file-selected">
                        <CheckCircle2 :size="15" class="deposit-file-selected-icon" />
                        <span class="deposit-file-selected-name">{{ depositFileName }}</span>
                        <button class="deposit-file-selected-clear" type="button" @click.stop="clearDepositFile">
                          <X :size="12" />
                        </button>
                      </div>
                      <div v-else class="deposit-file-zone" @click="pickFile">
                        <Upload :size="20" class="deposit-file-zone-icon" />
                        <span class="deposit-file-zone-label">Cliquer pour choisir un fichier</span>
                        <span class="deposit-file-zone-hint">PDF, images, archives…</span>
                      </div>
                    </div>
                    <input v-else v-model="depositLink" class="form-input" placeholder="https://…" type="url" />
                    <!-- Grille d'évaluation (lecture seule) -->
                    <div v-if="rubricPreview" class="rubric-preview">
                      <div class="rubric-preview-header">
                        <LayoutList :size="12" />
                        <span>{{ rubricPreview.title }}</span>
                      </div>
                      <div class="rubric-preview-criteria">
                        <div
                          v-for="c in rubricPreview.criteria"
                          :key="c.id"
                          class="rubric-preview-criterion"
                        >
                          <span class="rubric-preview-label">{{ c.label }}</span>
                          <span class="rubric-preview-pts">/ {{ c.max_pts }} pt{{ c.max_pts > 1 ? 's' : '' }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="deposit-actions">
                      <button class="btn-ghost btn-deposit-cancel" @click="cancelDeposit"><X :size="12" /> Annuler</button>
                      <button
                        class="btn-primary btn-deposit-submit"
                        :disabled="depositing || isExpired(t.deadline) || (depositMode === 'file' ? !depositFile : !depositLink.trim())"
                        @click="submitDeposit(t)"
                      >
                        <Upload :size="12" />
                        {{ depositing ? 'Dépôt…' : isExpired(t.deadline) ? 'Délai expiré' : 'Déposer' }}
                      </button>
                    </div>
                  </div>
                </template>
                <div v-else class="devoir-card-footer">
                  <span class="devoir-deadline-date">Échéance : {{ formatDate(t.deadline) }}</span>
                  <button class="btn-primary btn-deposit" @click="startDeposit(t)">
                    <Upload :size="12" /> Déposer
                  </button>
                </div>
              </div>
            </div>
          </template>

          <!-- ▸ PRÉSENCE (soutenance / cctl) -->
          <template v-if="studentGroups.event.length">
            <div class="group-header group-header--purple">
              <Calendar :size="12" /> Présence requise
              <span class="group-count">{{ studentGroups.event.length }}</span>
            </div>
            <div class="devoirs-list">
              <div v-for="t in studentGroups.event" :key="t.id" class="devoir-card devoir-card--event">
                <div class="devoir-card-header">
                  <div class="devoir-card-meta">
                    <span class="devoir-type-badge" :class="`type-${t.type}`">{{ typeLabel(t.type) }}</span>
                    <span v-if="t.category" class="tag-badge">{{ parseCategoryIcon(t.category).label || t.category }}</span>
                    <span v-if="t.channel_name" class="devoir-channel"># {{ t.channel_name }}</span>
                  </div>
                  <span class="deadline-badge" :class="deadlineClass(t.deadline)">
                    <Clock :size="10" />{{ deadlineLabel(t.deadline) }}
                  </span>
                </div>
                <h3 class="devoir-card-title">{{ t.title }}</h3>
                <p v-if="t.description" class="devoir-card-desc">{{ t.description }}</p>
                <p v-if="t.room" class="devoir-card-room">Salle {{ t.room }}</p>
                <div v-if="t.aavs" class="devoir-card-aavs"><span v-for="a in t.aavs.split('\n').filter(Boolean)" :key="a" class="aav-tag">{{ a.trim() }}</span></div>
                <div class="devoir-presence-notice">
                  <Calendar :size="14" class="devoir-presence-icon" />
                  <span>Présence requise — pas de dépôt fichier</span>
                </div>
                <div class="devoir-card-footer">
                  <span class="devoir-deadline-date">Date : {{ formatDate(t.deadline) }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- ▸ RENDUS -->
          <template v-if="submittedDevoirs.length">
            <div class="group-header group-header--success" title="Devoirs soumis">
              <CheckCircle2 :size="12" /> Rendus
              <span class="group-count">{{ submittedDevoirs.length }} / {{ filteredDevoirs.length }}</span>
            </div>
            <div class="devoirs-list">
              <div v-for="t in submittedDevoirs" :key="t.id" class="devoir-card devoir-card--submitted">
                <div class="devoir-card-header">
                  <div class="devoir-card-meta">
                    <span class="devoir-type-badge" :class="`type-${t.type}`">{{ typeLabel(t.type) }}</span>
                    <span v-if="t.category" class="tag-badge">{{ parseCategoryIcon(t.category).label || t.category }}</span>
                    <span v-if="t.channel_name" class="devoir-channel"># {{ t.channel_name }}</span>
                  </div>
                  <span class="deadline-badge" :class="deadlineClass(t.deadline)">
                    <Clock :size="10" />{{ deadlineLabel(t.deadline) }}
                  </span>
                </div>
                <h3 class="devoir-card-title">{{ t.title }}</h3>
                <p v-if="t.description" class="devoir-card-desc">{{ t.description }}</p>
                <p v-if="t.room" class="devoir-card-room">Salle {{ t.room }}</p>
                <div v-if="t.aavs" class="devoir-card-aavs"><span v-for="a in t.aavs.split('\n').filter(Boolean)" :key="a" class="aav-tag">{{ a.trim() }}</span></div>
                <div class="devoir-submitted-info">
                  <CheckCircle2 :size="14" />
                  <span>Rendu déposé</span>
                  <span v-if="t.note" class="devoir-graded-badge">Noté</span>
                  <span v-else class="devoir-pending-badge">En attente de note</span>
                </div>
                <!-- Note & feedback si disponibles -->
                <div v-if="t.note" class="devoir-grade-row">
                  <Award :size="13" class="devoir-grade-icon" />
                  <span class="devoir-grade-value">{{ t.note }}</span>
                  <span v-if="t.feedback" class="devoir-grade-feedback">{{ t.feedback }}</span>
                </div>
              </div>
            </div>
          </template>

        </div><!-- /devoirs-grouped -->
      </template>

      <!-- ════════════════════════ ACCUEIL PROJETS (prof, pas de projet sélectionné) ════════════════════════ -->
      <template v-else-if="appStore.isTeacher && !appStore.activeProject">
        <div v-if="travauxStore.loading" class="ut-loading">
          <div v-for="i in 4" :key="i" class="skel skel-line" style="height:100px;margin-bottom:10px;border-radius:10px" />
        </div>

        <div v-else-if="!teacherCategories.length" class="empty-state-custom">
          <BookOpen :size="48" class="empty-icon" />
          <h3>Aucun projet</h3>
          <p>Créez un devoir avec une catégorie pour voir vos projets ici.</p>
        </div>

        <template v-else>
          <div class="dh-home">

            <!-- Résumé promo -->
            <div class="dh-summary">
              <div class="dh-summary-stats">
                <div class="dh-stat">
                  <span class="dh-stat-value">{{ (travauxStore.ganttData as any[]).length }}</span>
                  <span class="dh-stat-label">Devoirs</span>
                </div>
                <div class="dh-stat">
                  <span class="dh-stat-value" style="color:var(--color-success)">{{ (travauxStore.ganttData as any[]).filter((t: any) => t.is_published).length }}</span>
                  <span class="dh-stat-label">Publiés</span>
                </div>
                <div v-if="globalToGrade > 0" class="dh-stat">
                  <span class="dh-stat-value" style="color:var(--color-warning)">{{ globalToGrade }}</span>
                  <span class="dh-stat-label">À noter</span>
                </div>
                <div v-if="globalDrafts > 0" class="dh-stat">
                  <span class="dh-stat-value" style="color:var(--text-muted)">{{ globalDrafts }}</span>
                  <span class="dh-stat-label">Brouillons</span>
                </div>
              </div>
            </div>

            <!-- Prochains événements -->
            <div v-if="upcomingDevoirs.length" class="dh-section">
              <h4 class="dh-section-title"><Clock :size="14" /> Prochains événements</h4>
              <div class="dh-upcoming-cards">
                <div
                  v-for="d in upcomingDevoirs"
                  :key="d.id"
                  class="dh-upcoming-card"
                  @click="openDevoir(d.id)"
                  @contextmenu="openCtxMenu($event, d)"
                >
                  <div class="dh-upcoming-top">
                    <span class="devoir-type-badge" :class="`type-${d.type}`">{{ typeLabel(d.type) }}</span>
                    <span class="dh-upcoming-deadline deadline-badge" :class="deadlineClass(d.deadline)">{{ deadlineLabel(d.deadline) }}</span>
                  </div>
                  <span class="dh-upcoming-title">{{ d.title }}</span>
                  <div class="dh-upcoming-meta">
                    <span v-if="d.category" class="dh-upcoming-cat">{{ d.category }}</span>
                    <span v-if="extractDuration(d.description)" class="dh-upcoming-dur">{{ extractDuration(d.description) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Projets -->
            <div class="dh-section">
              <h4 class="dh-section-title"><FolderOpen :size="14" /> Projets</h4>
              <div class="proj-grid">
                <div
                  v-for="cat in teacherCategories"
                  :key="cat"
                  class="proj-card"
                  @click="appStore.activeProject = cat"
                >
                  <div class="proj-card-header">
                    <span class="proj-card-name">{{ cat }}</span>
                    <ChevronRight :size="14" class="proj-card-chevron" />
                  </div>
                  <div class="proj-card-types">
                    <span v-for="tl in projectTypeCounts(cat)" :key="tl.type" class="proj-type-pill" :class="`type-${tl.type}`">
                      {{ tl.count }} {{ typeLabel(tl.type) }}
                    </span>
                  </div>
                  <div class="proj-card-stats-row">
                    <span>{{ projectStats(cat).totalDepots }}/{{ projectStats(cat).totalExpected }} soumis</span>
                    <span v-if="projectStats(cat).toGrade > 0" class="proj-stat-warn">{{ projectStats(cat).toGrade }} à noter</span>
                  </div>
                  <div class="proj-card-progress">
                    <div class="proj-card-progress-fill" :style="{ width: projectStats(cat).pct + '%' }" />
                  </div>
                  <div class="proj-card-footer">
              <span class="proj-card-total">{{ projectDevoirCount(cat) }} devoir{{ projectDevoirCount(cat) > 1 ? 's' : '' }}</span>
              <span v-if="projectNextDeadline(cat)" class="proj-card-next deadline-badge" :class="deadlineClass(projectNextDeadline(cat)!)">
                <Clock :size="10" /> {{ deadlineLabel(projectNextDeadline(cat)!) }}
              </span>
                  </div>
                </div>
              </div>
            </div>

          </div><!-- /dh-home -->
        </template>
      </template>

      <!-- ════════════════════════ VUE PROJET (prof, projet sélectionné) ════════════════════════ -->
      <template v-else-if="appStore.isTeacher && appStore.activeProject">
        <div v-if="travauxStore.loading" class="ut-loading">
          <div v-for="i in 5" :key="i" class="skel skel-line" style="height:36px;margin-bottom:4px;border-radius:6px" />
        </div>

        <div v-else-if="!unifiedFlat.length" class="empty-state-custom">
          <BookOpen :size="48" class="empty-icon" />
          <h3>Aucun devoir dans ce projet</h3>
          <p>Créez un devoir avec le bouton "Nouveau".</p>
        </div>

        <template v-else>
          <!-- Bloc résumé projet -->
          <div class="proj-summary">
            <h2 class="proj-summary-name">{{ appStore.activeProject }}</h2>
            <div class="proj-summary-pills">
              <span v-for="tl in projectTypeCounts(appStore.activeProject)" :key="tl.type" class="proj-type-pill" :class="`type-${tl.type}`">
                {{ tl.count }} {{ typeLabel(tl.type) }}
              </span>
            </div>
            <div class="proj-summary-stats">
              <div class="proj-summary-progress">
                <div class="proj-summary-progress-bar">
                  <div class="proj-summary-progress-fill" :style="{ width: projectStats(appStore.activeProject).pct + '%' }" />
                </div>
                <span class="proj-summary-pct">{{ projectStats(appStore.activeProject).pct }}% soumis</span>
              </div>
              <span class="proj-summary-stat">{{ projectStats(appStore.activeProject).noted }} notés</span>
              <span v-if="projectStats(appStore.activeProject).toGrade > 0" class="proj-summary-stat proj-stat-warn">{{ projectStats(appStore.activeProject).toGrade }} à noter</span>
              <span v-if="projectNextDeadline(appStore.activeProject)" class="proj-summary-stat">
                <Clock :size="11" /> {{ deadlineLabel(projectNextDeadline(appStore.activeProject)!) }}
              </span>
              <button v-if="projectStats(appStore.activeProject).drafts > 0" class="proj-summary-publish-btn" @click="publishAllDrafts">
                <Eye :size="12" /> Publier les {{ projectStats(appStore.activeProject).drafts }} brouillon{{ projectStats(appStore.activeProject).drafts > 1 ? 's' : '' }}
              </button>
            </div>
          </div>

          <!-- Devoirs par type : cartes visuelles -->
          <div class="dc-sections">
            <template v-for="group in devoirsByType" :key="group.type">
              <div class="dc-section" :class="`dc-section--${group.type}`">
                <div class="dc-section-header">
                  <span class="devoir-type-badge" :class="`type-${group.type}`">{{ typeLabel(group.type) }}</span>
                  <span class="dc-section-count">{{ group.total }}</span>
                </div>

                <!-- Cartes initiales -->
                <div class="dc-cards">
                  <div
                    v-for="t in group.initiales"
                    :key="t.id"
                    class="dc-card"
                    :class="{ 'dc-card--draft': !t.is_published, [`dc-card--${group.type}`]: true }"
                    @click="openDevoir(t.id)"
                    @contextmenu="openCtxMenu($event, t)"
                  >
                    <div class="dc-card-top">
                      <span class="dc-card-title">{{ t.title }}</span>
                      <button v-if="!t.is_published" class="dc-publish-btn" title="Publier" @click="publishDevoir(t.id, $event)">
                        <Eye :size="12" />
                      </button>
                    </div>
                    <div class="dc-card-meta">
                      <span class="dc-card-date deadline-badge" :class="deadlineClass(t.deadline)">{{ deadlineLabel(t.deadline) }}</span>
                      <span v-if="extractDuration(t.description)" class="dc-card-duration">{{ extractDuration(t.description) }}</span>
                      <span v-if="t.room" class="dc-card-duration">{{ t.room }}</span>
                    </div>
                    <div v-if="t.hasSubmission && t.students_total > 0" class="dc-card-progress">
                      <div class="dc-card-progress-fill" :style="{ width: Math.round((t.depots_count / t.students_total) * 100) + '%' }" />
                    </div>
                    <span v-if="!t.is_published" class="dc-card-draft-tag">Brouillon</span>
                  </div>
                </div>

                <!-- Rattrapages -->
                <template v-if="group.rattrapages.length">
                  <div class="dc-ratt-label">Rattrapages</div>
                  <div class="dc-cards dc-cards--ratt">
                    <div
                      v-for="t in group.rattrapages"
                      :key="t.id"
                      class="dc-card dc-card--ratt"
                      :class="{ 'dc-card--draft': !t.is_published, [`dc-card--${group.type}`]: true }"
                      @click="openDevoir(t.id)"
                      @contextmenu="openCtxMenu($event, t)"
                    >
                      <span class="dc-card-title">{{ t.title }}</span>
                      <div class="dc-card-meta">
                        <span class="dc-card-date deadline-badge" :class="deadlineClass(t.deadline)">{{ deadlineLabel(t.deadline) }}</span>
                        <span v-if="extractDuration(t.description)" class="dc-card-duration">{{ extractDuration(t.description) }}</span>
                      </div>
                      <button v-if="!t.is_published" class="dc-publish-btn" title="Publier" @click="publishDevoir(t.id, $event)">
                        <Eye :size="12" />
                      </button>
                    </div>
                  </div>
                </template>

                <!-- Bouton ajouter -->
                <button class="dc-add-btn" @click="addDevoirOfType(group.type)">
                  <Plus :size="13" /> Ajouter {{ typeLabel(group.type).toLowerCase().startsWith('é') ? 'une' : 'un' }} {{ typeLabel(group.type) }}
                </button>
              </div>
            </template>

            <!-- Bouton ajouter si aucun type encore -->
            <button v-if="!devoirsByType.length" class="dc-add-btn dc-add-btn--first" @click="modals.newDevoir = true">
              <Plus :size="14" /> Créer un devoir
            </button>
          </div>
        </template>
      </template>

      <!-- Code mort supprimé -->
      <template v-if="false"><!-- supprimé -->

        <div v-if="travauxStore.loading" class="liste-grid">
          <div v-for="i in 6" :key="i" class="skel-card">
            <div class="skel skel-line skel-w30" style="height:11px" />
            <div class="skel skel-line skel-w70" style="height:16px;margin-top:8px" />
            <div class="skel skel-line skel-w50" style="height:11px;margin-top:6px" />
            <div class="skel skel-line skel-w30" style="height:20px;margin-top:10px" />
          </div>
        </div>

        <div v-else-if="(travauxStore.ganttData as Devoir[]).length === 0" class="empty-state-custom">
          <Grid :size="48" class="empty-icon" />
          <h3>Aucun devoir créé</h3>
          <p>Créez un premier devoir pour le voir ici.</p>
        </div>

        <div v-else class="liste-grid">
          <div
            v-for="t in (travauxStore.ganttData as Devoir[]).filter(d => !filterCategory || d.category?.trim() === filterCategory)"
            :key="t.id"
            class="liste-card"
            :class="{ 'liste-card--draft': !t.is_published }"
            @click="openDevoir(t.id)"
          >
            <div class="liste-card-top">
              <span class="devoir-type-badge" :class="`type-${t.type}`">{{ typeLabel(t.type) }}</span>
              <span v-if="!t.is_published" class="draft-badge">Brouillon</span>
              <ChevronRight :size="14" class="liste-card-chevron" />
            </div>
            <h3 class="liste-card-title">{{ t.title }}</h3>
            <div class="liste-card-meta">
              <span v-if="t.channel_name" class="liste-card-channel"># {{ t.channel_name }}</span>
              <span v-if="t.category" class="tag-badge">{{ parseCategoryIcon(t.category).label || t.category }}</span>
            </div>
            <div class="liste-card-footer">
              <span class="deadline-badge" :class="deadlineClass(t.deadline)">
                <Clock :size="10" />{{ deadlineLabel(t.deadline) }}
              </span>
            </div>
          </div>
        </div>
      </template>

      <!-- ════════════════════════ Vue RENDUS (prof) ════════════════════════ -->
      <template v-else>

        <div v-if="travauxStore.loading" class="devoirs-list">
          <div v-for="i in 3" :key="i" class="skel-card">
            <div class="skel skel-line skel-w50" style="height:16px" />
            <div class="skel skel-line skel-w30" style="height:12px;margin-top:8px" />
          </div>
        </div>

        <div v-else-if="rendusByDevoir.length === 0" class="empty-state-custom">
          <Users :size="48" class="empty-icon" />
          <h3>Aucun rendu pour cette promotion</h3>
          <p>Les rendus des étudiants apparaîtront ici.</p>
        </div>

        <div v-else class="devoirs-list">
          <div
            v-for="group in rendusByDevoir"
            :key="group.devoir.id"
            class="rendus-group"
          >
            <div class="rendus-group-header">
              <div class="rendus-group-header-left">
                <span
                  v-if="(group.devoir as Devoir).type"
                  class="devoir-type-badge"
                  :class="`type-${(group.devoir as Devoir).type}`"
                >
                  {{ typeLabel((group.devoir as Devoir).type) }}
                </span>
                <span class="rendus-group-title">
                  {{ (group.devoir as Devoir).title ?? `Devoir #${group.devoir.id}` }}
                </span>
                <span class="rendus-count-badge">
                  {{ group.rendus.length }} rendu{{ group.rendus.length > 1 ? 's' : '' }}
                  <template v-if="(group.devoir as any).students_total">
                    / {{ (group.devoir as any).students_total }} attendu{{ (group.devoir as any).students_total > 1 ? 's' : '' }}
                  </template>
                </span>
              </div>
              <button class="btn-ghost btn-ouvrir" @click="openDevoir(group.devoir.id!)">
                Ouvrir <ChevronRight :size="13" />
              </button>
            </div>

            <div class="rendus-list">
              <div v-for="r in group.rendus" :key="r.id" class="rendu-row">
                <div class="rendu-avatar" :style="{ background: avatarColor(r.student_name) }">
                  {{ initials(r.student_name) }}
                </div>
                <div class="rendu-info">
                  <span class="rendu-student">{{ r.student_name }}</span>
                  <span class="rendu-file">
                    <Link2 v-if="r.type === 'link'" :size="10" />
                    <FileText v-else :size="10" />
                    {{ r.type === 'file' ? (r.file_name ?? r.content) : r.content }}
                  </span>
                </div>
                <div class="rendu-right">
                  <!-- Notation inline -->
                  <template v-if="editingDepotId === r.id">
                    <div class="grade-inline-form">
                      <input
                        v-model="pendingNoteValue"
                        class="form-input grade-input"
                        placeholder="A–F ou /20"
                        style="width:90px;font-size:12px;padding:4px 8px"
                      />
                      <textarea
                        v-model="pendingFeedbackValue"
                        class="form-input grade-textarea"
                        placeholder="Commentaire…"
                        rows="2"
                        style="font-size:11px;padding:4px 8px;resize:none"
                      />
                      <div class="grade-inline-actions">
                        <button class="btn-ghost" style="font-size:11px;padding:3px 8px" @click="cancelEditGrade">
                          <X :size="11" />
                        </button>
                        <button
                          class="btn-primary"
                          style="font-size:11px;padding:3px 10px"
                          :disabled="savingGrade"
                          @click="saveGrade(r.id)"
                        >
                          {{ savingGrade ? '…' : 'OK' }}
                        </button>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <span
                      v-if="r.note"
                      class="note-badge note-badge-clickable"
                      :title="'Modifier la note'"
                      @click="startEditGrade(r.id, r.note, r.feedback)"
                    >
                      <Award :size="11" /> {{ r.note }}
                    </span>
                    <span
                      v-else
                      class="rendu-no-note rendu-no-note-clickable"
                      :title="'Ajouter une note'"
                      @click="startEditGrade(r.id, null, null)"
                    >
                      Non noté
                    </span>
                    <p v-if="r.feedback" class="rendu-feedback">{{ r.feedback }}</p>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>

    </div><!-- /devoirs-content -->
  </div><!-- /devoirs-area -->

  <!-- Menu contextuel cartes devoirs (prof) -->
  <Teleport to="body">
    <div
      v-if="ctxMenu.devoir"
      class="ctx-menu"
      :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      @click.stop
    >
      <button class="ctx-item" @click="ctxOpen">
        <ExternalLink :size="14" /> Ouvrir
      </button>
      <button class="ctx-item" @click="ctxPublishToggle">
        <component :is="ctxMenu.devoir.is_published ? EyeOff : Eye" :size="14" />
        {{ ctxMenu.devoir.is_published ? 'Dépublier' : 'Publier' }}
      </button>
      <button class="ctx-item" @click="ctxDuplicate">
        <Copy :size="14" /> Dupliquer
      </button>
      <div class="ctx-divider" />
      <button class="ctx-item ctx-item--danger" @click="ctxDelete">
        <Trash2 :size="14" /> Supprimer
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Layout principal ─────────────────────────────────────────────────────── */
.devoirs-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: 100%;
  background: var(--bg-main);
}

/* ── En-tête ─────────────────────────────────────────────────────────────── */
.devoirs-header {
  height: var(--header-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  gap: 12px;
  border-bottom: 1px solid var(--border);
}

.devoirs-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.header-channel-ctx {
  font-size: 13px;
  font-weight: 400;
  color: var(--text-muted);
}

.header-breadcrumb-sep {
  font-size: 13px;
  color: var(--text-muted);
  opacity: .5;
}

.header-project-ctx {
  font-size: 13px;
  font-weight: 600;
  color: #9B87F5;
}

.header-project-clear {
  font-size: 10px;
  line-height: 1;
  padding: 2px 5px;
  border: 1px solid rgba(155,135,245,.3);
  border-radius: 4px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-family: var(--font);
  transition: background var(--t-fast), color var(--t-fast);
}
.header-project-clear:hover {
  background: rgba(155,135,245,.15);
  color: #9B87F5;
  border-color: rgba(155,135,245,.6);
}

.devoirs-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-nouveau {
  font-size: 13px;
  padding: 6px 12px;
}

/* ── Toggle vue enseignant ───────────────────────────────────────────────── */
/* ══════════════════════════════════════════════════════════════════════════════
   TABLEAU UNIFIÉ PROF
═══════════════════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════════════
   PAGE D'ACCUEIL PROJETS
═══════════════════════════════════════════════════════════════════════════════ */
.proj-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px; padding: 16px 20px;
}
.proj-card {
  background: var(--bg-elevated, rgba(255,255,255,.03));
  border: 1px solid var(--border);
  border-radius: 10px; padding: 16px; cursor: pointer;
  transition: border-color var(--t-fast), background var(--t-fast), transform .1s;
}
.proj-card:hover {
  border-color: var(--accent); background: rgba(74,144,217,.04);
  transform: translateY(-1px);
}
.proj-card-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.proj-card-name { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.proj-card-chevron { color: var(--text-muted); opacity: .4; transition: opacity var(--t-fast); }
.proj-card:hover .proj-card-chevron { opacity: 1; color: var(--accent); }
.proj-card-types { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 10px; }
.proj-type-pill {
  font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px;
}
.proj-card-stats-row {
  display: flex; gap: 8px; font-size: 11px; color: var(--text-muted); margin-bottom: 8px; flex-wrap: wrap;
}
.proj-stat-warn { color: var(--color-warning); font-weight: 600; }
.proj-stat-draft { color: var(--text-muted); font-style: italic; }

.proj-card-progress {
  height: 3px; border-radius: 2px; background: rgba(255,255,255,.06); overflow: hidden; margin-bottom: 10px;
}
.proj-card-progress-fill {
  height: 100%; background: var(--color-success); border-radius: 2px; transition: width .4s;
}

.proj-card-footer {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; color: var(--text-muted);
}
.proj-card-total { font-weight: 500; }
.proj-card-next { font-size: 10px; }

/* ══════════════════════════════════════════════════════════════════════════════
   VUE PROJET PAR TYPE
═══════════════════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════════════
   PROCHAINS ÉVÉNEMENTS (accueil devoirs)
═══════════════════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════════════
   ACCUEIL DEVOIRS PROF (dh-home)
═══════════════════════════════════════════════════════════════════════════════ */
.dh-home { padding: 16px 20px; }

/* Résumé stats */
.dh-summary {
  margin-bottom: 20px;
}
.dh-summary-stats {
  display: flex; gap: 16px; flex-wrap: wrap;
}
.dh-stat {
  background: var(--bg-elevated, rgba(255,255,255,.03));
  border: 1px solid var(--border); border-radius: 10px;
  padding: 12px 20px; min-width: 80px; text-align: center;
}
.dh-stat-value { font-size: 22px; font-weight: 800; color: var(--text-primary); display: block; }
.dh-stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .4px; }

/* Sections */
.dh-section { margin-bottom: 20px; }
.dh-section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 14px; font-weight: 700; color: var(--text-primary);
  margin-bottom: 10px;
}

/* Prochains événements — cartes horizontales */
.dh-upcoming-cards {
  display: flex; gap: 10px; overflow-x: auto; padding-bottom: 4px;
}
.dh-upcoming-card {
  flex-shrink: 0; width: 200px;
  background: var(--bg-elevated, rgba(255,255,255,.03));
  border: 1px solid var(--border); border-radius: 10px;
  padding: 12px; cursor: pointer;
  transition: all var(--t-fast);
}
.dh-upcoming-card:hover { border-color: var(--accent); background: rgba(74,144,217,.04); }
.dh-upcoming-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.dh-upcoming-deadline { font-size: 10px; }
.dh-upcoming-title {
  font-size: 13px; font-weight: 600; color: var(--text-primary);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; line-height: 1.3; margin-bottom: 6px;
}
.dh-upcoming-meta { display: flex; gap: 6px; flex-wrap: wrap; }
.dh-upcoming-cat {
  font-size: 10px; color: var(--text-muted);
  background: rgba(255,255,255,.05); padding: 1px 6px; border-radius: 4px;
}
.dh-upcoming-dur {
  font-size: 10px; color: var(--text-muted);
  background: rgba(255,255,255,.05); padding: 1px 5px; border-radius: 6px;
}

@media (max-width: 600px) {
  .dh-upcoming-cards { flex-direction: column; }
  .dh-upcoming-card { width: 100%; }
}

/* ══════════════════════════════════════════════════════════════════════════════
   CARTES DEVOIRS PAR TYPE (vue projet)
═══════════════════════════════════════════════════════════════════════════════ */
.dc-sections { padding: 0 20px 20px; }
.dc-section {
  margin-bottom: 20px;
  border: 1px solid var(--border); border-radius: 10px;
  padding: 14px; background: rgba(255,255,255,.015);
}
.dc-section-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
}
.dc-section-count {
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  background: rgba(255,255,255,.06); padding: 1px 6px; border-radius: 8px;
}

.dc-cards {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px; margin-bottom: 8px;
}
.dc-cards--ratt { opacity: .65; }

.dc-card {
  padding: 10px 12px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--border); background: rgba(255,255,255,.02);
  transition: all var(--t-fast); position: relative;
}
.dc-card:hover { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.15); }
.dc-card--draft { border-style: dashed; opacity: .7; }
.dc-card--cctl { border-left: 3px solid #a569bd; }
.dc-card--soutenance { border-left: 3px solid var(--color-warning); }
.dc-card--etude_de_cas { border-left: 3px solid var(--color-success); }
.dc-card--livrable { border-left: 3px solid var(--accent); }
.dc-card--memoire { border-left: 3px solid #e74c3c; }
.dc-card--autre { border-left: 3px solid #95a5a6; }

.dc-card-top { display: flex; align-items: flex-start; gap: 6px; }
.dc-card-title { font-size: 12px; font-weight: 600; color: var(--text-primary); flex: 1; line-height: 1.3; }
.dc-card-meta { display: flex; align-items: center; gap: 5px; margin-top: 6px; }
.dc-card-date { font-size: 10px; }
.dc-card-duration { font-size: 10px; color: var(--text-muted); background: rgba(255,255,255,.05); padding: 1px 5px; border-radius: 6px; }
.dc-card-progress {
  height: 2px; border-radius: 1px; background: rgba(255,255,255,.06);
  margin-top: 6px; overflow: hidden;
}
.dc-card-progress-fill { height: 100%; background: var(--color-success); border-radius: 1px; }

.dc-card-draft-tag {
  position: absolute; top: 4px; right: 4px;
  font-size: 8px; font-weight: 700; text-transform: uppercase;
  padding: 1px 4px; border-radius: 3px;
  background: rgba(255,255,255,.06); color: var(--text-muted); border: 1px dashed var(--border-input);
}

.dc-publish-btn {
  background: none; border: none; cursor: pointer; padding: 2px;
  color: var(--text-muted); transition: color var(--t-fast);
}
.dc-publish-btn:hover { color: var(--color-success); }

.dc-ratt-label {
  font-size: 10px; font-weight: 700; color: var(--color-warning);
  text-transform: uppercase; letter-spacing: .3px;
  padding: 4px 0 2px; border-top: 1px dashed var(--border); margin-top: 4px;
}

.dc-add-btn {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; color: var(--accent);
  background: none; border: 1px dashed var(--border-input); border-radius: 6px;
  padding: 6px 12px; cursor: pointer; font-family: var(--font);
  transition: all var(--t-fast); margin-top: 6px;
}
.dc-add-btn:hover { background: rgba(74,144,217,.06); border-color: var(--accent); }
.dc-add-btn--first { padding: 14px; justify-content: center; font-size: 13px; }

@media (max-width: 600px) {
  .dc-cards { grid-template-columns: 1fr; }
}

/* ── Résumé projet ── */
.proj-summary {
  padding: 16px 20px; border-bottom: 1px solid var(--border); margin-bottom: 8px;
}
.proj-summary-name { font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
.proj-summary-pills { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 10px; }
.proj-summary-stats {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  font-size: 12px; color: var(--text-secondary);
}
.proj-summary-progress { display: flex; align-items: center; gap: 6px; }
.proj-summary-progress-bar { width: 80px; height: 5px; border-radius: 3px; background: rgba(255,255,255,.08); overflow: hidden; }
.proj-summary-progress-fill { height: 100%; background: var(--color-success); border-radius: 3px; }
.proj-summary-pct { font-weight: 600; }
.proj-summary-publish-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px;
  background: rgba(46,204,113,.1); color: var(--color-success);
  border: 1px solid rgba(46,204,113,.25); cursor: pointer; font-family: var(--font);
  transition: all var(--t-fast);
}
.proj-summary-publish-btn:hover { background: rgba(46,204,113,.2); }
.proj-summary-stat { display: flex; align-items: center; gap: 3px; }

/* ── Sessions ── */
.ut-session-label {
  font-size: 10px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .4px;
  padding: 6px 0 2px;
}
.ut-session-ratt { color: var(--color-warning); }
.ut-row--ratt { opacity: .7; }
.ut-duration {
  font-size: 10px; font-weight: 600; color: var(--text-muted);
  background: rgba(255,255,255,.05); padding: 1px 6px; border-radius: 8px;
  flex-shrink: 0;
}
.ut-rattrapages { border-top: 1px dashed var(--border); margin-top: 4px; padding-top: 2px; }

.ut-by-type { padding: 12px 20px; }
.ut-type-section { margin-bottom: 16px; }
.ut-type-header {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0; margin-bottom: 4px;
  border-bottom: 1px solid var(--border);
}
.ut-type-count {
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  background: rgba(255,255,255,.06); padding: 1px 6px; border-radius: 8px;
}
.ut-type-rows { display: flex; flex-direction: column; gap: 2px; }

/* ── Onglets catégories prof (legacy) ── */
.teacher-cat-tabs {
  display: flex; gap: 2px; padding: 0 20px; overflow-x: auto;
  border-bottom: 1px solid var(--border);
}
.teacher-cat-tab {
  padding: 8px 14px; font-size: 12px; font-weight: 600; color: var(--text-muted);
  background: none; border: none; cursor: pointer;
  border-bottom: 2px solid transparent; white-space: nowrap;
  font-family: var(--font); transition: all var(--t-fast);
}
.teacher-cat-tab:hover { color: var(--text-secondary); }
.teacher-cat-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

/* ── En-tête tableau ── */
.ut-thead {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 12px; margin-bottom: 2px;
  font-size: 10px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .4px;
}
.ut-th-type { width: 70px; flex-shrink: 0; }
.ut-th-title { flex: 1; min-width: 0; }
.ut-th-deadline { width: 90px; flex-shrink: 0; }
.ut-th-progress { width: 120px; flex-shrink: 0; }
.ut-th-status { width: 70px; flex-shrink: 0; }
.ut-th-action { width: 20px; flex-shrink: 0; }

.ut-no-submit { font-style: italic; opacity: .5; }

@media (max-width: 768px) {
  .ut-thead { display: none; }
}

.teacher-toolbar {
  display: flex; gap: 8px; padding: 0 20px 10px; flex-wrap: wrap; align-items: center;
}
.teacher-search-wrap {
  position: relative; flex: 1; min-width: 160px; max-width: 280px;
}
.teacher-search-icon {
  position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  color: var(--text-muted); pointer-events: none;
}
.teacher-search {
  width: 100%; padding: 6px 10px 6px 30px; background: var(--bg-input);
  border: 1px solid var(--border-input); border-radius: 6px;
  color: var(--text-primary); font-size: 13px; font-family: var(--font);
}
.teacher-search:focus { border-color: var(--accent); outline: none; }
.teacher-search::placeholder { color: var(--text-muted); }

.ut-loading { padding: 20px; }
.ut-table { padding: 0 20px 20px; }

.ut-group { margin-bottom: 8px; }
.ut-group-header {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 8px 10px; background: none; border: none;
  cursor: pointer; color: var(--text-secondary); font-family: var(--font);
  font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px;
  transition: color var(--t-fast);
}
.ut-group-header:hover { color: var(--text-primary); }
.ut-group-chevron { transition: transform var(--t-fast); flex-shrink: 0; }
.ut-group-chevron.rotated { transform: rotate(90deg); }
.ut-group-name { flex: 1; text-align: left; }
.ut-group-count { font-weight: 400; color: var(--text-muted); text-transform: none; letter-spacing: 0; }

.ut-rows { display: flex; flex-direction: column; gap: 2px; }

.ut-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-radius: 8px; cursor: pointer;
  background: rgba(255,255,255,.02); transition: background var(--t-fast);
}
.ut-row:hover { background: rgba(255,255,255,.06); }
.ut-row--draft { opacity: .6; border: 1px dashed var(--border-input); }

.ut-type { flex-shrink: 0; }
.ut-title { flex: 1; font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.ut-deadline { flex-shrink: 0; font-size: 11px; }

.ut-progress { display: flex; align-items: center; gap: 4px; flex-shrink: 0; width: 120px; }
.ut-progress-bar { width: 40px; height: 4px; border-radius: 2px; background: rgba(255,255,255,.08); overflow: hidden; flex-shrink: 0; }
.ut-progress-fill { height: 100%; background: var(--color-success); border-radius: 2px; transition: width .3s; }
.ut-progress-text { font-size: 11px; color: var(--text-muted); white-space: nowrap; }

.ut-noted { font-size: 11px; color: var(--text-muted); flex-shrink: 0; width: 60px; text-align: right; }

.ut-status {
  font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
  flex-shrink: 0; text-transform: uppercase; letter-spacing: .3px;
}
.status-pub      { background: rgba(46,204,113,.1); color: #2ecc71; }
.status-draft    { background: rgba(255,255,255,.05); color: var(--text-muted); border: 1px dashed var(--border-input); }
.status-expired  { background: rgba(231,76,60,.1); color: #e74c3c; }
.status-complete { background: rgba(59,130,246,.1); color: #60a5fa; }

.ut-chevron { flex-shrink: 0; color: var(--text-muted); opacity: .4; transition: opacity var(--t-fast); }
.ut-row:hover .ut-chevron { opacity: 1; }

@media (max-width: 768px) {
  .ut-progress, .ut-noted { display: none; }
  .ut-row { gap: 6px; padding: 6px 8px; }
}

.draft-badge {
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px;
  padding: 1px 5px; border-radius: 3px;
  background: rgba(255,255,255,.08); color: var(--text-muted);
  border: 1px dashed var(--border-input);
}
.draft-text { opacity: .6; }
.liste-card--draft { opacity: .65; border-style: dashed; }

.teacher-filters {
  display: flex; gap: 6px; padding: 0 20px 8px; flex-wrap: wrap;
}
.teacher-filter-select {
  background: var(--bg-input); border: 1px solid var(--border-input);
  border-radius: 6px; color: var(--text-primary); font-size: 12px;
  padding: 4px 8px; font-family: var(--font); cursor: pointer;
}

.view-toggle {
  display: flex;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}

.view-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
  font-family: var(--font);
}
.view-toggle-btn.active             { background: var(--accent); color: #fff; }
.view-toggle-btn:hover:not(.active) { color: var(--text-primary); }

/* ── Barre de stats étudiant ─────────────────────────────────────────────── */
.student-stats-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.02);
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid transparent;
}
.stat-chip strong { font-weight: 700; }

.stat-chip-neutral { background: rgba(255, 255, 255, 0.06); border-color: rgba(255, 255, 255, 0.08); color: var(--text-secondary); }
.stat-chip-blue    { background: rgba(74, 144, 217, 0.12);  border-color: rgba(74, 144, 217, 0.2);   color: var(--accent-light); }
.stat-chip-red     { background: rgba(231, 76, 60, 0.12);   border-color: rgba(231, 76, 60, 0.2);    color: #ff7b6b; }
.stat-chip-green   { background: rgba(39, 174, 96, 0.12);   border-color: rgba(39, 174, 96, 0.2);    color: #5dd08a; }

.stat-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-neutral { background: var(--text-muted); }
.dot-blue    { background: var(--accent); }
.dot-red     { background: var(--color-danger); }
.dot-green   { background: var(--color-success); }

/* ── Contenu scrollable ──────────────────────────────────────────────────── */
.devoirs-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* ── Aperçu projets étudiant ─────────────────────────────────────────────── */
.student-project-overview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-bottom: 4px;
}

.student-proj-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-sidebar);
  cursor: pointer;
  text-align: left;
  font-family: var(--font);
  transition: background var(--t-fast), border-color var(--t-fast);
}
.student-proj-card:hover {
  background: var(--bg-hover);
  border-color: #9B87F5;
}

.student-proj-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.student-proj-stat {
  font-size: 11px;
  color: var(--text-muted);
}

.student-proj-submitted { color: var(--color-success); }
.student-proj-pending   { color: var(--color-warning); }

.student-proj-bar {
  height: 4px;
  border-radius: 4px;
  background: rgba(255,255,255,.08);
  overflow: hidden;
}

.student-proj-bar-fill {
  height: 100%;
  border-radius: 4px;
  background: var(--color-success);
  transition: width .3s ease;
}

/* ── Liste commune ─────────────────────────────────────────────────────────── */
.devoirs-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 780px;
  margin: 0 auto;
}

/* ── Groupes urgence étudiant ────────────────────────────────────────────── */
.devoirs-grouped {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 780px;
  margin: 0 auto;
}

.group-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 4px;
}
.group-subtitle {
  width: 100%;
  font-size: 11.5px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  color: var(--text-muted);
  margin-top: -2px;
}

.group-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.1);
  color: inherit;
}

.group-header--danger  { color: var(--color-danger); }
.group-header--warning { color: var(--color-warning); }
.group-header--accent  { color: var(--accent-light); }
.group-header--success { color: var(--color-success); }
.group-header--purple  { color: #9b87f5; }

/* ── Carte étudiant ──────────────────────────────────────────────────────── */
.devoir-card {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-left-width: 4px;
  border-radius: 10px;
  padding: 16px;
  transition: border-color var(--t-base);
}
.devoir-card:hover { border-color: rgba(74, 144, 217, 0.3); }

.devoir-card--overdue   { border-left-color: var(--color-danger);  }
.devoir-card--overdue:hover   { border-left-color: var(--color-danger);  }
.devoir-card--urgent    { border-left-color: var(--color-warning); }
.devoir-card--urgent:hover    { border-left-color: var(--color-warning); }
.devoir-card--pending   { border-left-color: var(--accent);        }
.devoir-card--pending:hover   { border-left-color: var(--accent);        }
.devoir-card--submitted { border-left-color: var(--color-success); }
.devoir-card--submitted:hover { border-left-color: var(--color-success); border-color: rgba(39, 174, 96, 0.3); }
.devoir-card--event     { border-left-color: #9b87f5; }
.devoir-card--event:hover     { border-left-color: #9b87f5; border-color: rgba(155, 135, 245, 0.3); }

.devoir-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.devoir-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.devoir-channel {
  font-size: 11px;
  color: var(--text-muted);
}

.devoir-card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.devoir-card-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.devoir-card-room {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}
.devoir-card-aavs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.aav-tag {
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 12px;
  background: rgba(74,144,217,.12);
  color: var(--accent);
  white-space: nowrap;
}

/* Présence requise */
.devoir-presence-notice {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12.5px;
  font-weight: 600;
  color: #9b87f5;
  background: rgba(155, 135, 245, 0.1);
  border: 1px solid rgba(155, 135, 245, 0.25);
  padding: 6px 12px;
  border-radius: 6px;
  margin-top: 8px;
  margin-bottom: 8px;
}
.devoir-presence-icon { flex-shrink: 0; }

/* Statut rendu */
.devoir-submitted-info {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-success);
  margin-top: 8px;
}
.devoir-graded-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(46,204,113,.15);
  color: var(--color-success);
  margin-left: 4px;
}
.devoir-pending-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(255,255,255,.08);
  color: var(--text-muted);
  margin-left: 4px;
}

/* Grade dans la carte rendu (étudiant) */
.devoir-grade-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12.5px;
}
.devoir-grade-icon { color: var(--accent-light); flex-shrink: 0; }
.devoir-grade-value { font-weight: 700; color: var(--accent-light); }
.devoir-grade-feedback { color: var(--text-secondary); font-style: italic; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.devoir-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.devoir-deadline-date {
  font-size: 12px;
  color: var(--text-muted);
}

.btn-deposit-expired {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border: 1px solid rgba(231, 76, 60, 0.3);
  border-radius: var(--radius-sm);
  background: rgba(231, 76, 60, 0.08);
  color: var(--color-danger);
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font);
  cursor: not-allowed;
  opacity: 0.75;
}

.btn-deposit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  font-size: 12px;
}

/* ── Formulaire de dépôt inline ──────────────────────────────────────────── */
.deposit-form {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-input);
  border-radius: 8px;
  padding: 14px;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.deposit-type-toggle {
  display: flex;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
  align-self: flex-start;
}

.deposit-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast);
  font-family: var(--font);
}
.deposit-toggle-btn.active             { background: var(--accent); color: #fff; }
.deposit-toggle-btn:hover:not(.active) { color: var(--text-primary); }

.deposit-file-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 14px;
  border: 1.5px dashed var(--border-input);
  border-radius: 8px;
  cursor: pointer;
  text-align: center;
  transition: border-color var(--t-fast), background var(--t-fast);
}
.deposit-file-zone:hover {
  border-color: var(--accent);
  background: var(--accent-subtle);
}

.deposit-file-zone-icon       { color: var(--text-muted); margin-bottom: 2px; }
.deposit-file-zone:hover .deposit-file-zone-icon { color: var(--accent); }
.deposit-file-zone-label      { font-size: 13px; font-weight: 500; color: var(--text-secondary); }
.deposit-file-zone-hint       { font-size: 11px; color: var(--text-muted); opacity: .7; }

.deposit-file-selected {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1.5px solid #27AE60;
  border-radius: 8px;
  background: rgba(39, 174, 96, 0.08);
}

.deposit-file-selected-icon { color: #27AE60; flex-shrink: 0; }

.deposit-file-selected-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deposit-file-selected-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  border-radius: 4px;
  flex-shrink: 0;
  transition: color var(--t-fast), background var(--t-fast);
}
.deposit-file-selected-clear:hover { color: #ff6b6b; background: rgba(231, 76, 60, 0.12); }

.deposit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-deposit-submit { font-size: 12px; padding: 6px 14px; }
.btn-deposit-cancel { font-size: 12px; padding: 6px 12px; }

/* ── Aperçu grille d'évaluation (étudiant) ───────────────────────────────── */
.rubric-preview {
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.rubric-preview-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--text-muted);
}

.rubric-preview-criteria {
  display: flex;
  flex-direction: column;
}

.rubric-preview-criterion {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 10px;
  font-size: 12px;
  border-bottom: 1px solid var(--border);
}
.rubric-preview-criterion:last-child { border-bottom: none; }

.rubric-preview-label {
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rubric-preview-pts {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
  margin-left: 8px;
}

/* ── Squelettes ──────────────────────────────────────────────────────────── */
.skel-card {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── État vide ────────────────────────────────────────────────────────────── */
.empty-state-custom {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  color: var(--text-muted);
  opacity: 0.35;
  margin-bottom: 16px;
}

.empty-state-custom h3 {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.empty-state-custom p {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 320px;
  line-height: 1.5;
}

/* ── Badges de type ──────────────────────────────────────────────────────── */
.devoir-type-badge {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border-radius: 4px;
}

.type-livrable     { background: rgba(74,144,217,.2);   color: var(--accent); }
.type-soutenance   { background: rgba(243,156,18,.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: #9b87f5; }
.type-etude_de_cas { background: rgba(39,174,96,.2);    color: var(--color-success); }
.type-memoire      { background: rgba(231,76,60,.2);    color: #e74c3c; }
.type-autre        { background: rgba(127,140,141,.2);  color: #95a5a6; }

/* ── Gantt ───────────────────────────────────────────────────────────────── */
.gantt-wrapper { max-width: 1000px; margin: 0 auto; }

.gantt-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.legend-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 20px;
}
.legend-pill::before {
  content: '';
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.legend-pill.type-livrable     { color: var(--accent); }
.legend-pill.type-soutenance   { color: var(--color-warning); }
.legend-pill.type-cctl         { color: #9b87f5; }
.legend-pill.type-etude_de_cas { color: var(--color-success); }
.legend-pill.type-memoire      { color: #e74c3c; }
.legend-pill.type-autre        { color: #95a5a6; }
.legend-pill.type-livrable::before     { background: var(--accent); }
.legend-pill.type-soutenance::before   { background: var(--color-warning); }
.legend-pill.type-cctl::before         { background: #9b87f5; }
.legend-pill.type-etude_de_cas::before { background: var(--color-success); }
.legend-pill.type-memoire::before      { background: #e74c3c; }
.legend-pill.type-autre::before        { background: #95a5a6; }

.legend-separator { width: 1px; height: 16px; background: var(--border); }

.legend-today {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.legend-today-line {
  display: inline-block;
  width: 2px;
  height: 14px;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 1px;
}

.gantt-chart { display: flex; flex-direction: column; gap: 6px; }

.gantt-row {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background var(--t-fast);
}
.gantt-row:hover { background: rgba(255, 255, 255, 0.04); }

.gantt-row-label {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.gantt-label-type { flex-shrink: 0; }

.gantt-label-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  color: var(--text-primary);
}

.gantt-track {
  flex: 1;
  height: 30px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  position: relative;
  overflow: hidden;
}

.gantt-today-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 1px;
  z-index: 2;
  transform: translateX(-50%);
}

.gantt-bar {
  position: absolute;
  top: 4px;
  height: 22px;
  border-radius: 5px;
  opacity: 0.85;
  transition: opacity var(--t-fast);
  z-index: 1;
}
.gantt-bar:hover              { opacity: 1; }
.gantt-bar.type-livrable      { background: var(--accent); }
.gantt-bar.type-livrable     { background: var(--accent); }
.gantt-bar.type-soutenance   { background: var(--color-warning); }
.gantt-bar.type-cctl         { background: #9b87f5; }
.gantt-bar.type-etude_de_cas { background: var(--color-success); }
.gantt-bar.type-memoire      { background: #e74c3c; }
.gantt-bar.type-autre        { background: #95a5a6; }

.gantt-skel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 1000px;
  margin: 0 auto;
}

.gantt-skel-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px;
}

/* ── Vue Liste enseignant ────────────────────────────────────────────────── */
.liste-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  max-width: 1000px;
  margin: 0 auto;
}

@media (max-width: 900px) { .liste-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .liste-grid { grid-template-columns: 1fr; } }

.liste-card {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color var(--t-base), background var(--t-base);
}
.liste-card:hover {
  border-color: rgba(74, 144, 217, 0.35);
  background: rgba(74, 144, 217, 0.04);
}

.liste-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.liste-card-chevron {
  color: var(--text-muted);
  transition: color var(--t-fast), transform var(--t-fast);
}
.liste-card:hover .liste-card-chevron { color: var(--accent); transform: translateX(2px); }

.liste-card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.4;
}

.liste-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.liste-card-channel { font-size: 11px; color: var(--text-muted); }

.liste-card-footer {
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

/* ── Rendus groupés ──────────────────────────────────────────────────────── */
.rendus-group {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  max-width: 780px;
  margin: 0 auto;
  width: 100%;
}

.rendus-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid var(--border);
}

.rendus-group-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.rendus-group-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rendus-count-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(74, 144, 217, 0.2);
  color: var(--accent);
}

.btn-ouvrir {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 5px 10px;
  margin-left: 12px;
}

.rendus-list {
  padding: 8px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rendu-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  transition: background var(--t-fast);
}
.rendu-row:hover { background: rgba(255, 255, 255, 0.06); }

.rendu-avatar {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
}

.rendu-info { flex: 1; min-width: 0; }

.rendu-student {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.rendu-file {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.rendu-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
  min-width: 90px;
}

.note-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 20px;
  background: rgba(74, 144, 217, 0.15);
  color: var(--accent-light);
}

.note-badge-clickable,
.rendu-no-note-clickable {
  cursor: pointer;
  transition: opacity .15s;
}
.note-badge-clickable:hover   { opacity: .75; }
.rendu-no-note-clickable:hover { opacity: .75; text-decoration: underline; }

.rendu-no-note {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.rendu-feedback {
  font-size: 11px;
  color: var(--text-secondary);
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-style: italic;
}

/* ── Notation inline ─────────────────────────────────────────────────────── */
.grade-inline-form {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 160px;
}

.grade-inline-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

/* ── Menu contextuel ─────────────────────────────────────────────────────── */
</style>

<style>
.ctx-menu {
  position: fixed;
  z-index: 10000;
  min-width: 170px;
  background: var(--bg-primary, #1e1e2e);
  border: 1px solid var(--border-color, #333);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,.35);
  padding: 4px 0;
  animation: ctxFade .12s ease;
}
@keyframes ctxFade {
  from { opacity: 0; transform: scale(.96); }
  to   { opacity: 1; transform: scale(1); }
}
.ctx-item {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 7px 14px;
  background: none; border: none; color: var(--text-primary, #cdd6f4);
  font-size: 13px; cursor: pointer; text-align: left;
}
.ctx-item:hover { background: var(--bg-hover, rgba(255,255,255,.07)); }
.ctx-item--danger { color: var(--color-error, #f38ba8); }
.ctx-item--danger:hover { background: rgba(243,139,168,.12); }
.ctx-divider { height: 1px; margin: 4px 8px; background: var(--border-color, #333); }
</style>
