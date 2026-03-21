<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  Clock, Edit3, Users, BookOpen, AlertTriangle,
  ChevronRight, CheckCircle2, FileText, LayoutDashboard,
  Award, TrendingUp, FolderOpen, CalendarDays, BarChart2,
  PlusCircle, Menu, GraduationCap, Settings,
} from 'lucide-vue-next'
import { useAppStore }    from '@/stores/app'
import { useModalsStore } from '@/stores/modals'
import { useTravauxStore } from '@/stores/travaux'
import { useRouter, useRoute } from 'vue-router'
import { deadlineClass, deadlineLabel, formatDate } from '@/utils/date'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import { avatarColor, gradeClass } from '@/utils/format'
import { useToast } from '@/composables/useToast'
import type { Component } from 'vue'
import type { Devoir }    from '@/types'

const props = defineProps<{ toggleSidebar?: () => void }>()

const appStore     = useAppStore()
const modals       = useModalsStore()
const travauxStore = useTravauxStore()
const router       = useRouter()
const route        = useRoute()
const { showToast } = useToast()

// ── Onboarding première visite ──────────────────────────────────────────────
const ONBOARDING_KEY = 'cc_onboarding_seen'
const showOnboarding = ref(!localStorage.getItem(ONBOARDING_KEY) && appStore.isStudent)
function dismissOnboarding() {
  showOnboarding.value = false
  localStorage.setItem(ONBOARDING_KEY, '1')
}

// ── Types locaux ──────────────────────────────────────────────────────────────
interface GanttRow {
  id:             number
  title:          string
  deadline:       string
  start_date:     string | null
  type:           string
  published:      number
  category:       string | null
  channel_name:   string
  promo_name:     string
  promo_color:    string
  depots_count:   number
  students_total: number
}
interface Promotion { id: number; name: string; color: string }
interface ProjectCard {
  key: string; label: string; icon: Component | null
  total: number; published: number; depots: number; expected: number; nextDeadline: string | null
}
interface StudentProjectCard {
  key: string; label: string; icon: Component | null
  total: number; submitted: number; pending: number; overdue: number
  nextDeadline: string | null; avgGrade: number | null
}

// ── État ─────────────────────────────────────────────────────────────────────
const loadingTeacher  = ref(true)
const loadingStudent  = ref(true)
const aNoterCount     = ref(0)
const brouillonsCount = ref(0)
const promos          = ref<Promotion[]>([])
const allStudents     = ref<{ id: number; promo_id: number; name?: string }[]>([])
const ganttAll        = ref<GanttRow[]>([])

// ── Chargement ────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (appStore.isTeacher) {
    try {
      const [schedRes, promosRes, studRes, ganttRes] = await Promise.all([
        window.api.getTeacherSchedule(),
        window.api.getPromotions(),
        window.api.getAllStudents(),
        window.api.getGanttData(0 as number),
      ])
      if (schedRes?.ok) {
        const d = schedRes.data as { aNoter: unknown[]; brouillons: unknown[] }
        aNoterCount.value     = d.aNoter?.length     ?? 0
        brouillonsCount.value = d.brouillons?.length ?? 0
      }
      if (promosRes?.ok) {
        promos.value = promosRes.data as Promotion[]
        if (promos.value.length && !appStore.activePromoId) {
          appStore.activePromoId = promos.value[0].id
        }
      }
      if (studRes?.ok) allStudents.value = studRes.data as typeof allStudents.value
      if (ganttRes?.ok) ganttAll.value = ganttRes.data as GanttRow[]
      loadReminders()
    } finally { loadingTeacher.value = false }
  } else {
    try {
      if (!travauxStore.devoirs.length) await travauxStore.fetchStudentDevoirs()
    } finally { loadingStudent.value = false }
    // Timer pour les countdowns + auto-refresh des données
    _studentClock = setInterval(() => { studentNow.value = Date.now() }, 30_000)
    _studentRefresh = setInterval(() => { travauxStore.fetchStudentDevoirs() }, 60_000)
  }
})

onUnmounted(() => {
  if (_studentClock) clearInterval(_studentClock)
  if (_studentRefresh) clearInterval(_studentRefresh)
})

// ── Rappels prof (échéancier scolarité) ──────────────────────────────────────
type Reminder = { id: number; promo_tag: string; date: string; title: string; description: string; bloc: string | null; done: number; isOverdue?: boolean }
const allReminders = ref<Reminder[]>([])
const showAllReminders = ref(false)

// Semaine courante : lundi → dimanche
function getWeekBounds() {
  const now = new Date()
  const day = now.getDay() // 0=dim, 1=lun...
  const diffToMon = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMon)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

const thisWeekReminders = computed(() => {
  const { monday, sunday } = getWeekBounds()
  const now = Date.now()
  return allReminders.value
    .filter(r => {
      const d = new Date(r.date).getTime()
      // Cette semaine OU en retard (passé mais pas fait)
      return (d >= monday.getTime() && d <= sunday.getTime()) || (!r.done && d < now)
    })
    .map(r => ({
      ...r,
      isOverdue: !r.done && new Date(r.date).getTime() < now,
      isToday: new Date(r.date).toDateString() === new Date().toDateString(),
    }))
    .sort((a, b) => {
      if (a.done !== b.done) return a.done - b.done
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })
})

const doneThisWeek = computed(() => thisWeekReminders.value.filter(r => r.done).length)
const totalThisWeek = computed(() => thisWeekReminders.value.length)

async function loadReminders() {
  try {
    const res = await window.api.getTeacherReminders()
    if (res?.ok) allReminders.value = res.data as Reminder[]
  } catch {}
}

async function toggleReminder(id: number, done: boolean) {
  try {
    await window.api.toggleReminderDone(id, done)
    const r = allReminders.value.find(r => r.id === id)
    if (r) r.done = done ? 1 : 0
  } catch {}
}

// ── Gestion promo : renommage ────────────────────────────────────────────────
const editingPromoName = ref(false)
const promoNameDraft = ref('')

function startEditPromoName() {
  promoNameDraft.value = activePromo.value?.name ?? ''
  editingPromoName.value = true
}

// ── Promotions : renommer et supprimer ───────────────────────────────────
const renamingPromoId = ref<number | null>(null)
const renamingPromoValue = ref('')

async function confirmRenamePromo(p: { id: number; name: string }) {
  if (!renamingPromoValue.value.trim()) return
  try {
    await window.api.renamePromotion(p.id, renamingPromoValue.value.trim())
    p.name = renamingPromoValue.value.trim()
    renamingPromoId.value = null
    showToast('Promotion renommée.', 'success')
  } catch { showToast('Erreur.', 'error') }
}

async function deletePromo(id: number, name: string) {
  if (!confirm(`Supprimer la promotion "${name}" et tous ses canaux/devoirs ? Cette action est irréversible.`)) return
  try {
    await window.api.deletePromotion(id)
    promos.value = promos.value.filter(p => p.id !== id)
    if (appStore.activePromoId === id && promos.value.length) appStore.activePromoId = promos.value[0].id
    showToast('Promotion supprimée.', 'success')
  } catch { showToast('Erreur.', 'error') }
}

async function savePromoName() {
  if (!activePromo.value || !promoNameDraft.value.trim()) return
  try {
    await window.api.renamePromotion(activePromo.value.id, promoNameDraft.value.trim())
    const p = promos.value.find(p => p.id === activePromo.value!.id)
    if (p) p.name = promoNameDraft.value.trim()
    editingPromoName.value = false
  } catch {}
}

// ── Promo active + données filtrées ──────────────────────────────────────────
const activePromo = computed(() =>
  promos.value.find(p => p.id === appStore.activePromoId) ?? null,
)

const ganttFiltered = computed(() =>
  activePromo.value
    ? ganttAll.value.filter(t => t.promo_name === activePromo.value!.name)
    : ganttAll.value,
)

const studentsForPromo = computed(() =>
  activePromo.value
    ? allStudents.value.filter(s => s.promo_id === activePromo.value!.id)
    : allStudents.value,
)

const totalStudents = computed(() => studentsForPromo.value.length)

const urgentsCount = computed(() => {
  const now = Date.now()
  const week = now + 7 * 86_400_000
  return ganttFiltered.value.filter(t => {
    const d = new Date(t.deadline).getTime()
    return t.published && d >= now && d <= week
  }).length
})

async function reloadPromos() {
  const [promosRes, ganttRes] = await Promise.all([
    window.api.getPromotions(),
    window.api.getGanttData(0 as number),
  ])
  if (promosRes?.ok) promos.value = promosRes.data as Promotion[]
  if (ganttRes?.ok) ganttAll.value = ganttRes.data as GanttRow[]
}

// Recharger quand la modale de création de promo se ferme
watch(() => modals.createPromo, (open) => {
  if (!open && appStore.isTeacher) reloadPromos()
})

// ── Helpers ───────────────────────────────────────────────────────────────────
const greetingName = computed(() => (appStore.currentUser?.name ?? '').split(' ')[0])
const today = computed(() =>
  new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
)

function goToProject(key: string) {
  appStore.activeProject = key
  router.push('/devoirs')
}

// ── Projets prof ─────────────────────────────────────────────────────────────
const projectCards = computed((): ProjectCard[] => {
  const map = new Map<string, GanttRow[]>()
  for (const t of ganttFiltered.value) {
    if (!t.category?.trim()) continue
    if (!map.has(t.category)) map.set(t.category, [])
    map.get(t.category)!.push(t)
  }
  const cards: ProjectCard[] = []
  for (const [key, rows] of map) {
    const { icon, label } = parseCategoryIcon(key)
    const published = rows.filter(r => r.published)
    const now = Date.now()
    const upcoming = published
      .filter(r => new Date(r.deadline).getTime() >= now)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    cards.push({
      key, label, icon,
      total:        rows.length,
      published:    published.length,
      depots:       rows.reduce((s, r) => s + (r.depots_count ?? 0), 0),
      expected:     rows.reduce((s, r) => s + (r.students_total ?? 0), 0),
      nextDeadline: upcoming[0]?.deadline ?? null,
    })
  }
  return cards.sort((a, b) => {
    if (!a.nextDeadline && !b.nextDeadline) return a.label.localeCompare(b.label)
    if (!a.nextDeadline) return 1; if (!b.nextDeadline) return -1
    return new Date(a.nextDeadline).getTime() - new Date(b.nextDeadline).getTime()
  })
})

// ── Projets étudiant ──────────────────────────────────────────────────────────
const needsSub = (t: Devoir) => t.requires_submission !== 0

// Timer pour mettre à jour les countdowns (comme DevoirsView)
const studentNow = ref(Date.now())
let _studentClock: ReturnType<typeof setInterval> | null = null
let _studentRefresh: ReturnType<typeof setInterval> | null = null

// Note A/B/C/D → valeur pour calculer la note modale
const GRADE_ORDER = ['A', 'B', 'C', 'D', 'NA'] as const

const studentStats = computed(() => {
  const all       = travauxStore.devoirs
  const submitted = all.filter(t => t.depot_id != null)
  const pending   = all.filter(t => t.depot_id == null && needsSub(t))
  const graded    = all.filter(t => t.note != null)
  // Note la plus fréquente (mode) au lieu de la moyenne numérique
  const counts: Record<string, number> = {}
  for (const t of graded) { if (t.note && t.note !== 'NA') counts[t.note] = (counts[t.note] ?? 0) + 1 }
  let modeGrade: string | null = null
  let modeCount = 0
  for (const [g, c] of Object.entries(counts)) { if (c > modeCount) { modeGrade = g; modeCount = c } }
  return { total: all.length, submitted: submitted.length, pending: pending.length, graded: graded.length, modeGrade }
})

// ── Dernières notes reçues (3 max) ──────────────────────────────────────────
const recentGrades = computed(() => {
  return travauxStore.devoirs
    .filter(t => t.note != null && t.note !== 'NA')
    .sort((a, b) => (b.depot_id ?? 0) - (a.depot_id ?? 0))
    .slice(0, 3)
    .map(t => ({ title: t.title, note: t.note!, category: t.category }))
})

// ── Top 3 devoirs urgents (au lieu de 1) ────────────────────────────────────
const urgentActions = computed(() => {
  const now = studentNow.value
  const pending = travauxStore.devoirs.filter(t => t.depot_id == null && needsSub(t) && t.deadline)
  if (!pending.length) return []
  const sorted = [...pending].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  return sorted.slice(0, 3).map(t => {
    const diffMs = new Date(t.deadline).getTime() - now
    const diffDays = Math.ceil(diffMs / 86_400_000)
    let urgency: string
    if (diffMs < 0) urgency = `En retard de ${Math.abs(diffDays)}j`
    else if (diffDays <= 1) urgency = "Aujourd'hui"
    else if (diffDays <= 3) urgency = `Dans ${diffDays}j`
    else if (diffDays <= 7) urgency = `Cette semaine`
    else urgency = `Dans ${diffDays}j`
    return { ...t, urgency, isOverdue: diffMs < 0 }
  })
})

const studentProjectCards = computed((): StudentProjectCard[] => {
  const map = new Map<string, Devoir[]>()
  for (const t of travauxStore.devoirs) {
    const cat = t.category?.trim()
    if (!cat) continue
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(t)
  }
  const now = Date.now()
  const cards: StudentProjectCard[] = []
  for (const [key, rows] of map) {
    const { icon, label } = parseCategoryIcon(key)
    const submitted = rows.filter(r => r.depot_id != null)
    const pending   = rows.filter(r => r.depot_id == null && needsSub(r))
    const overdue   = pending.filter(r => now >= new Date(r.deadline).getTime())
    const upcoming  = pending.filter(r => new Date(r.deadline).getTime() > now)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    // Note modale par projet (A/B/C/D)
    const gradeCounts: Record<string, number> = {}
    for (const r of submitted) { if (r.note && r.note !== 'NA') gradeCounts[r.note] = (gradeCounts[r.note] ?? 0) + 1 }
    let avgGrade: number | null = null // gardé pour compatibilité type, mais on affiche modeGrade
    const _projectMode = Object.entries(gradeCounts).sort((a, b) => b[1] - a[1])[0]
    const projectModeGrade = _projectMode?.[0] ?? null
    void projectModeGrade // utilisé dans le template via avgGrade placeholder
    cards.push({ key, label, icon, total: rows.length, submitted: submitted.length, pending: pending.length, overdue: overdue.length, nextDeadline: upcoming[0]?.deadline ?? null, avgGrade })
  }
  return cards.sort((a, b) => {
    if (a.overdue !== b.overdue) return b.overdue - a.overdue
    if (!a.nextDeadline && !b.nextDeadline) return a.label.localeCompare(b.label)
    if (!a.nextDeadline) return 1; if (!b.nextDeadline) return -1
    return new Date(a.nextDeadline).getTime() - new Date(b.nextDeadline).getTime()
  })
})

// ── Frise chronologique ────────────────────────────────────────────────────────
const dashTab = ref<'accueil' | 'promotions' | 'frise' | 'analytique' | 'reglages'>(
  route.query.tab === 'frise' ? 'frise' : route.query.tab === 'analytique' ? 'analytique' : route.query.tab === 'promotions' ? 'promotions' : 'accueil',
)
watch(() => route.query.tab, (tab) => {
  if (tab === 'frise') dashTab.value = 'frise'
  else if (tab === 'analytique') dashTab.value = 'analytique'
  else if (tab === 'promotions') dashTab.value = 'promotions'
  else if (tab === 'reglages') dashTab.value = 'reglages'
  else dashTab.value = 'accueil'
})

// ── Dernière activité (rendus récents) ───────────────────────────────────────
const recentRendus = computed(() => {
  return travauxStore.allRendus
    .filter(r => r.submitted_at)
    .sort((a, b) => new Date(b.submitted_at ?? 0).getTime() - new Date(a.submitted_at ?? 0).getTime())
    .slice(0, 5)
})

watch(dashTab, (tab) => {
  if (tab === 'accueil' && !travauxStore.allRendus.length) {
    const pid = appStore.activePromoId
    if (pid) travauxStore.fetchRendus(pid)
  }
})

interface FriseMilestone { id: number; title: string; type: string; deadline: string; published: boolean; done: boolean }
interface FriseProject   { key: string; label: string; icon: Component | null; milestones: FriseMilestone[] }
interface FrisePromo     { name: string; color: string; projects: FriseProject[] }

// Frise avec zoom centré ±2 mois et scroll/drag
const friseOffset = ref(0) // décalage en jours par rapport à aujourd'hui
const FRISE_SPAN_DAYS = 120 // 4 mois de largeur visible

const ganttDateRange = computed(() => {
  const rows = (appStore.isTeacher ? ganttFiltered.value : travauxStore.devoirs) as { deadline: string }[]
  if (!rows.length) return null
  // Centrer sur aujourd'hui + offset
  const center = Date.now() + friseOffset.value * 86_400_000
  const halfSpan = (FRISE_SPAN_DAYS / 2) * 86_400_000
  return { start: new Date(center - halfSpan), end: new Date(center + halfSpan) }
})

function onFriseWheel(e: WheelEvent) {
  e.preventDefault()
  friseOffset.value += e.deltaY > 0 ? 14 : -14 // scroll de 2 semaines
}

let _friseDragging = false
let _friseDragStart = 0
function onFriseDragStart(e: MouseEvent) {
  _friseDragging = true
  _friseDragStart = e.clientX
}
function onFriseDragMove(e: MouseEvent) {
  if (!_friseDragging) return
  const diff = _friseDragStart - e.clientX
  if (Math.abs(diff) > 10) {
    friseOffset.value += diff > 0 ? 7 : -7
    _friseDragStart = e.clientX
  }
}
function onFriseDragEnd() { _friseDragging = false }

const ganttMonths = computed(() => {
  const r = ganttDateRange.value
  if (!r) return []
  const total = r.end.getTime() - r.start.getTime()
  const months: { label: string; left: number }[] = []
  let d = new Date(r.start.getFullYear(), r.start.getMonth(), 1)
  while (d <= r.end) {
    months.push({
      label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
      left:  Math.max(0, (d.getTime() - r.start.getTime()) / total * 100),
    })
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  }
  return months
})

const ganttTodayPct = computed(() => {
  const r = ganttDateRange.value
  if (!r) return -1
  return (Date.now() - r.start.getTime()) / (r.end.getTime() - r.start.getTime()) * 100
})

const teacherFrise = computed((): FrisePromo[] => {
  const promoMap = new Map<string, { color: string; projects: Map<string, FriseMilestone[]> }>()
  for (const t of ganttFiltered.value) {
    const pName  = t.promo_name  || 'Sans promo'
    const pColor = t.promo_color || '#4a90d9'
    const pKey   = t.category?.trim() || 'Sans projet'
    if (!promoMap.has(pName)) promoMap.set(pName, { color: pColor, projects: new Map() })
    const promo = promoMap.get(pName)!
    if (!promo.projects.has(pKey)) promo.projects.set(pKey, [])
    promo.projects.get(pKey)!.push({
      id: t.id, title: t.title, type: t.type, deadline: t.deadline,
      published: Boolean(t.published),
      done: t.students_total > 0 && (t.depots_count ?? 0) >= t.students_total,
    })
  }
  return Array.from(promoMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, { color, projects }]) => ({
      name, color,
      projects: Array.from(projects.entries())
        .map(([key, milestones]) => ({
          key, label: parseCategoryIcon(key).label, icon: parseCategoryIcon(key).icon,
          milestones: milestones.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
        }))
        .sort((a, b) => {
          const am = a.milestones[0]?.deadline ?? ''; const bm = b.milestones[0]?.deadline ?? ''
          return am.localeCompare(bm)
        }),
    }))
})

const studentFrise = computed((): FrisePromo[] => {
  const projMap = new Map<string, FriseMilestone[]>()
  for (const t of travauxStore.devoirs) {
    const key = t.category?.trim() || 'Sans projet'
    if (!projMap.has(key)) projMap.set(key, [])
    projMap.get(key)!.push({
      id: t.id, title: t.title, type: t.type ?? 'autre', deadline: t.deadline,
      published: true, done: t.depot_id != null,
    })
  }
  return [{
    name: appStore.currentUser?.promo_name ?? 'Ma promo', color: '#9b87f5',
    projects: Array.from(projMap.entries())
      .map(([key, milestones]) => ({
        key, label: parseCategoryIcon(key).label, icon: parseCategoryIcon(key).icon,
        milestones: milestones.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
      }))
      .sort((a, b) => {
        const am = a.milestones[0]?.deadline ?? ''; const bm = b.milestones[0]?.deadline ?? ''
        return am.localeCompare(bm)
      }),
  }]
})

const frise = computed((): FrisePromo[] => appStore.isTeacher ? teacherFrise.value : studentFrise.value)

// ── Analytique enseignant ─────────────────────────────────────────────────────
const allRendus = ref<{ note: string | null }[]>([])
const analyticsLoaded = ref(false)

async function loadAnalytics() {
  if (analyticsLoaded.value) return
  const promoId = appStore.activePromoId ?? 0
  const res = await window.api.getAllRendus(promoId)
  if (res?.ok) allRendus.value = (res.data as unknown as typeof allRendus.value)
  analyticsLoaded.value = true
}

watch(dashTab, (tab) => { if (tab === 'analytique') loadAnalytics() })
watch(() => appStore.activePromoId, () => { analyticsLoaded.value = false; if (dashTab.value === 'analytique') loadAnalytics() })

// Distribution des notes A/B/C/D/NA
const GRADE_COLORS: Record<string, string> = { A: '#22c55e', B: '#27ae60', C: '#f59e0b', D: '#ef4444', NA: '#6b7280' }
const gradeDistribution = computed(() => {
  const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, NA: 0 }
  for (const r of allRendus.value) {
    if (r.note && counts[r.note] !== undefined) counts[r.note]++
  }
  const max = Math.max(1, ...Object.values(counts))
  return Object.entries(counts)
    .filter(([, c]) => c > 0)
    .map(([label, count]) => ({ label, count, pct: Math.round(count / max * 100), color: GRADE_COLORS[label] || '#6b7280' }))
})

// Taux de soumission par devoir
const submissionRates = computed(() => {
  return ganttFiltered.value
    .filter(t => t.published && t.students_total > 0)
    .map(t => ({
      title: t.title,
      rate: Math.round((t.depots_count / t.students_total) * 100),
      depots: t.depots_count,
      total: t.students_total,
    }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 15)
})

// Note fréquente (mode A/B/C/D)
const globalModeGrade = computed(() => {
  const counts: Record<string, number> = {}
  for (const r of allRendus.value) {
    if (r.note && r.note !== 'NA') counts[r.note] = (counts[r.note] ?? 0) + 1
  }
  let mode: string | null = null, max = 0
  for (const [g, c] of Object.entries(counts)) { if (c > max) { mode = g; max = c } }
  return mode
})

// Statistiques rapides analytique
const analyticsStats = computed(() => {
  const total = allRendus.value.length
  const graded = allRendus.value.filter(r => r.note != null).length
  const notGraded = total - graded
  return { total, graded, notGraded }
})

function milestoneLeft(deadline: string): string {
  const r = ganttDateRange.value
  if (!r) return '50%'
  const total = r.end.getTime() - r.start.getTime()
  const pos   = (new Date(deadline).getTime() - r.start.getTime()) / total * 100
  return `${Math.max(0, Math.min(100, pos))}%`
}

function projectLineStyle(milestones: FriseMilestone[]): Record<string, string> {
  if (milestones.length < 2) return { display: 'none' }
  const r = ganttDateRange.value
  if (!r) return {}
  const total = r.end.getTime() - r.start.getTime()
  const left  = (new Date(milestones[0].deadline).getTime() - r.start.getTime()) / total * 100
  const right = (new Date(milestones[milestones.length - 1].deadline).getTime() - r.start.getTime()) / total * 100
  return { left: `${Math.max(0, left)}%`, width: `${Math.max(0, right - left)}%` }
}

function onMilestoneClick(ms: FriseMilestone) {
  if (appStore.isTeacher) { appStore.currentTravailId = ms.id; modals.gestionDevoir = true }
  else router.push('/devoirs')
}
</script>

<template>
  <div class="dashboard-shell">

    <!-- ════════════════════ VUE PROFESSEUR ════════════════════ -->
    <template v-if="appStore.isTeacher">

      <div v-if="loadingTeacher" class="db-loading">
        <div v-for="i in 4" :key="i" class="skel db-skel-card" />
        <div class="db-skel-content">
          <div v-for="i in 6" :key="i" class="skel skel-line" :style="{ width: (50 + (i % 3) * 15) + '%' }" />
        </div>
      </div>

      <template v-else>
        <!-- En-tête compact -->
        <div class="db-header">
          <div class="db-header-left">
            <button v-if="props.toggleSidebar" class="mobile-hamburger" aria-label="Ouvrir le menu" @click="props.toggleSidebar">
              <Menu :size="22" />
            </button>
            <div>
              <h1 class="db-title">Bonjour, {{ greetingName }}</h1>
              <p class="db-date">{{ today }}</p>
            </div>
          </div>
          <!-- Sélecteur de promo inline dans le header -->
          <div class="db-header-promos">
            <button
              v-for="p in promos"
              :key="p.id"
              class="db-promo-chip"
              :class="{ active: appStore.activePromoId === p.id }"
              :style="appStore.activePromoId === p.id ? { background: 'color-mix(in srgb, ' + p.color + ' 20%, transparent)', color: p.color, borderColor: p.color } : {}"
              @click="appStore.activePromoId = p.id"
            >
              <span class="db-promo-chip-dot" :style="{ background: p.color }" />
              {{ p.name }}
            </button>
          </div>
        </div>

        <!-- Stats compactes en ligne -->
        <div class="db-stats-row">
          <div class="db-stat-pill" :class="{ 'db-stat-pill--alert': aNoterCount > 0 }">
            <Edit3 :size="14" />
            <strong>{{ aNoterCount }}</strong> à noter
          </div>
          <div class="db-stat-pill" :class="{ 'db-stat-pill--warn': urgentsCount > 0 }">
            <AlertTriangle :size="14" />
            <strong>{{ urgentsCount }}</strong> cette semaine
          </div>
          <div v-if="brouillonsCount > 0" class="db-stat-pill db-stat-pill--muted">
            <FileText :size="14" />
            <strong>{{ brouillonsCount }}</strong> brouillon{{ brouillonsCount > 1 ? 's' : '' }}
          </div>
          <div class="db-stat-pill">
            <Users :size="14" />
            <strong>{{ totalStudents }}</strong> étudiant{{ totalStudents > 1 ? 's' : '' }}
          </div>
        </div>

        <!-- Rappels prof (échéancier) -->
        <!-- À faire cette semaine -->
        <div v-if="thisWeekReminders.length" class="db-week">
          <div class="db-week-header">
            <h4 class="db-week-title"><CheckCircle2 :size="14" /> À faire cette semaine</h4>
            <span class="db-week-progress">{{ doneThisWeek }}/{{ totalThisWeek }}</span>
          </div>
          <div class="db-week-list">
            <div
              v-for="r in thisWeekReminders"
              :key="r.id"
              class="db-week-item"
              :class="{ done: r.done, overdue: r.isOverdue, today: r.isToday }"
              @click="toggleReminder(r.id, !r.done)"
            >
              <div class="db-week-check">
                <CheckCircle2 v-if="r.done" :size="15" style="color:var(--color-success)" />
                <div v-else class="db-week-circle" :class="{ 'db-week-circle--overdue': r.isOverdue }" />
              </div>
              <div class="db-week-body">
                <span class="db-week-item-title" :class="{ 'line-through': r.done }">{{ r.title }}</span>
                <span class="db-week-meta">
                  <span class="db-week-promo">{{ r.promo_tag === 'CPIA2' ? 'CPI A2' : 'FISA A4' }}</span>
                  <span v-if="r.isOverdue" class="db-week-late">En retard</span>
                  <span v-else-if="r.isToday" class="db-week-today-tag">Aujourd'hui</span>
                  <span v-else class="db-week-date">{{ new Date(r.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }) }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="db-tabs">
          <button class="db-tab" :class="{ active: dashTab === 'accueil' }" @click="dashTab = 'accueil'">
            <LayoutDashboard :size="13" /> Accueil
          </button>
          <button class="db-tab" :class="{ active: dashTab === 'promotions' }" @click="dashTab = 'promotions'">
            <Users :size="13" /> Promotions
          </button>
          <button class="db-tab" :class="{ active: dashTab === 'frise' }" @click="dashTab = 'frise'">
            <BarChart2 :size="13" /> Frise
          </button>
          <button class="db-tab" :class="{ active: dashTab === 'analytique' }" @click="dashTab = 'analytique'">
            <TrendingUp :size="13" /> Analytique
          </button>
          <button class="db-tab" :class="{ active: dashTab === 'reglages' }" @click="dashTab = 'reglages'">
            <Settings :size="13" /> Réglages
          </button>
        </div>

        <!-- Tab Analytique -->
        <div v-if="dashTab === 'analytique'" class="db-tab-content">
          <div class="analytics-grid">

            <!-- Stats rapides -->
            <div class="analytics-row analytics-quick-stats">
              <div class="analytics-stat">
                <span class="analytics-stat-value">{{ analyticsStats.total }}</span>
                <span class="analytics-stat-label">Rendus total</span>
              </div>
              <div class="analytics-stat">
                <span class="analytics-stat-value">{{ analyticsStats.graded }}</span>
                <span class="analytics-stat-label">Notés</span>
              </div>
              <div class="analytics-stat">
                <span class="analytics-stat-value">{{ analyticsStats.notGraded }}</span>
                <span class="analytics-stat-label">En attente</span>
              </div>
              <div class="analytics-stat">
                <span class="analytics-stat-value" :style="{ color: globalModeGrade ? GRADE_COLORS[globalModeGrade] || '#fff' : '#6b7280' }">
                  {{ globalModeGrade ?? '—' }}
                </span>
                <span class="analytics-stat-label">Note fréquente</span>
              </div>
              <div class="analytics-stat">
                <span class="analytics-stat-value" style="color:#22c55e">{{ appStore.onlineUsers.length }}</span>
                <span class="analytics-stat-label">En ligne</span>
              </div>
            </div>

            <!-- Distribution des notes -->
            <div class="analytics-card">
              <h3 class="analytics-card-title"><Award :size="14" /> Distribution des notes</h3>
              <div class="analytics-bars">
                <div v-for="b in gradeDistribution" :key="b.label" class="analytics-bar-row">
                  <span class="analytics-bar-label">{{ b.label }}</span>
                  <div class="analytics-bar-track">
                    <div
                      class="analytics-bar-fill"
                      :style="{ width: b.pct + '%', background: b.color }"
                    />
                  </div>
                  <span class="analytics-bar-count">{{ b.count }}</span>
                </div>
              </div>
            </div>

            <!-- Taux de soumission par devoir -->
            <div class="analytics-card">
              <h3 class="analytics-card-title"><CheckCircle2 :size="14" /> Taux de soumission</h3>
              <div v-if="!submissionRates.length" class="db-empty-hint" style="padding:20px">
                <p>Aucun devoir publié avec des soumissions attendues.</p>
              </div>
              <div v-else class="analytics-bars">
                <div v-for="s in submissionRates" :key="s.title" class="analytics-bar-row">
                  <span class="analytics-bar-label analytics-bar-label-wide" :title="s.title">{{ s.title }}</span>
                  <div class="analytics-bar-track">
                    <div
                      class="analytics-bar-fill"
                      :style="{ width: s.rate + '%', background: s.rate >= 80 ? '#22c55e' : s.rate >= 50 ? '#f59e0b' : '#f87171' }"
                    />
                  </div>
                  <span class="analytics-bar-count">{{ s.rate }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab Projets -->
        <!-- Tab Promotions -->
        <div v-else-if="dashTab === 'promotions'" class="db-tab-content">
          <div class="promo-list">
            <div v-for="p in promos" :key="p.id" class="promo-list-card" :class="{ 'promo-active': appStore.activePromoId === p.id }">
              <div class="promo-list-header">
                <span class="promo-list-dot" :style="{ background: p.color }" />
                <template v-if="renamingPromoId === p.id">
                  <input
                    v-model="renamingPromoValue"
                    class="promo-rename-input"
                    @keydown.enter="confirmRenamePromo(p)"
                    @keydown.escape="renamingPromoId = null"
                  />
                  <button class="gestion-btn-sm gestion-btn-accent" @click="confirmRenamePromo(p)">OK</button>
                  <button class="gestion-btn-sm" @click="renamingPromoId = null">Annuler</button>
                </template>
                <template v-else>
                  <span class="promo-list-name">{{ p.name }}</span>
                  <button class="gestion-btn-sm" @click="renamingPromoId = p.id; renamingPromoValue = p.name">Renommer</button>
                  <button v-if="appStore.activePromoId !== p.id" class="gestion-btn-sm" @click="appStore.activePromoId = p.id">Sélectionner</button>
                  <span v-else class="promo-list-active-tag">Active</span>
                </template>
              </div>
              <div class="promo-list-stats">
                <span>{{ allStudents.filter(s => s.promo_id === p.id).length }} étudiants</span>
                <span>{{ ganttAll.filter(t => t.promo_name === p.name).length }} devoirs</span>
              </div>
              <div class="promo-list-actions">
                <button class="gestion-btn" @click="appStore.activePromoId = p.id; modals.classe = true">Voir la classe</button>
                <button class="gestion-btn" @click="appStore.activePromoId = p.id; modals.importStudents = true">Importer CSV</button>
                <button class="gestion-btn" style="color:var(--color-danger)" @click="deletePromo(p.id, p.name)">Supprimer</button>
              </div>
            </div>
          </div>
          <button class="dc-add-btn" style="margin:12px 0" @click="modals.createPromo = true">
            <PlusCircle :size="13" /> Nouvelle promotion
          </button>
        </div>

        <!-- Tab Accueil (ancien Projets) -->
        <div v-else-if="dashTab === 'accueil'" class="db-tab-content">
          <div v-if="!projectCards.length" class="db-empty-hint">
            <FolderOpen :size="36" style="opacity:.2;margin-bottom:10px" />
            <p>Aucun projet configuré. Créez des travaux avec une catégorie pour les voir ici.</p>
          </div>
          <div v-else class="db-project-grid">
            <div
              v-for="p in projectCards"
              :key="p.key"
              class="db-project-card"
              @click="goToProject(p.key)"
            >
              <div class="db-project-icon">
                <component :is="p.icon" v-if="p.icon" :size="20" />
                <FolderOpen v-else :size="20" />
              </div>
              <div class="db-project-info">
                <span class="db-project-name">{{ p.label }}</span>
                <span class="db-project-stats">
                  {{ p.published }} devoir{{ p.published > 1 ? 's' : '' }} publiés
                  <template v-if="p.expected"> · {{ p.depots }}/{{ p.expected }} rendus</template>
                </span>
                <span v-if="p.nextDeadline" class="db-project-next" :class="deadlineClass(p.nextDeadline)">
                  <Clock :size="9" /> {{ deadlineLabel(p.nextDeadline) }}
                </span>
              </div>
              <ChevronRight :size="14" class="db-project-chevron" />
            </div>
          </div>

          <!-- Dernière activité -->
          <div v-if="recentRendus.length" class="db-activity">
            <h4 class="db-activity-title"><Clock :size="14" /> Dernière activité</h4>
            <div class="db-activity-list">
              <div v-for="r in recentRendus" :key="r.id" class="db-activity-item">
                <div class="db-activity-avatar" :style="{ background: avatarColor(r.student_name ?? '') }">
                  {{ (r.student_name ?? '').slice(0, 2).toUpperCase() }}
                </div>
                <div class="db-activity-info">
                  <span class="db-activity-name">{{ r.student_name }}</span>
                  <span class="db-activity-devoir">{{ r.travail_title ?? 'Devoir #' + r.travail_id }}</span>
                </div>
                <div class="db-activity-right">
                  <span v-if="r.note" class="db-activity-note" :class="gradeClass(r.note)">{{ r.note }}</span>
                  <span class="db-activity-date">{{ new Date(r.submitted_at ?? '').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab Réglages -->
        <div v-else-if="dashTab === 'reglages'" class="db-tab-content">
          <div class="gestion-grid">
            <!-- Carte Promotion active -->
            <div class="gestion-card">
              <h4 class="gestion-card-title">Promotion active</h4>
              <div v-if="activePromo" class="gestion-promo-info">
                <div class="gestion-promo-name-row">
                  <span class="gestion-promo-dot" :style="{ background: activePromo.color }" />
                  <input
                    v-if="editingPromoName"
                    v-model="promoNameDraft"
                    class="gestion-promo-input"
                    @keydown.enter="savePromoName"
                    @keydown.escape="editingPromoName = false"
                  />
                  <span v-else class="gestion-promo-name">{{ activePromo.name }}</span>
                  <button v-if="!editingPromoName" class="gestion-btn-sm" @click="startEditPromoName">Renommer</button>
                  <template v-else>
                    <button class="gestion-btn-sm gestion-btn-accent" @click="savePromoName">OK</button>
                    <button class="gestion-btn-sm" @click="editingPromoName = false">Annuler</button>
                  </template>
                </div>
                <div class="gestion-promo-stats">
                  <span>{{ studentsForPromo.length }} étudiants</span>
                  <span>{{ ganttFiltered.length }} devoirs</span>
                </div>
              </div>
              <p v-else class="gestion-empty">Sélectionnez une promotion.</p>
            </div>

            <!-- Carte Étudiants -->
            <div class="gestion-card">
              <div class="gestion-card-header">
                <h4 class="gestion-card-title">Étudiants</h4>
                <div class="gestion-card-actions">
                  <button class="gestion-btn" @click="modals.importStudents = true">Importer CSV</button>
                  <button class="gestion-btn" @click="modals.classe = true">Voir la classe</button>
                </div>
              </div>
              <div class="gestion-student-list">
                <div v-for="s in studentsForPromo.slice(0, 8)" :key="s.id" class="gestion-student-row">
                  <div class="gestion-student-avatar" :style="{ background: avatarColor(s.name ?? '') }">{{ (s.name ?? '').slice(0,2).toUpperCase() }}</div>
                  <span class="gestion-student-name">{{ s.name }}</span>
                </div>
                <span v-if="studentsForPromo.length > 8" class="gestion-more">+{{ studentsForPromo.length - 8 }} autres</span>
                <span v-if="!studentsForPromo.length" class="gestion-empty">Aucun étudiant — importez un CSV.</span>
              </div>
            </div>

            <!-- Carte Intervenants -->
            <div class="gestion-card">
              <div class="gestion-card-header">
                <h4 class="gestion-card-title">Intervenants</h4>
                <button class="gestion-btn" @click="modals.intervenants = true">Gérer</button>
              </div>
              <p class="gestion-hint">Ajoutez des intervenants et assignez-les à des canaux.</p>
              <button class="gestion-btn" style="margin-top:8px" @click="modals.intervenants = true">
                <Users :size="12" /> Ouvrir la gestion
              </button>
            </div>

            <!-- Carte Canaux -->
            <div class="gestion-card">
              <div class="gestion-card-header">
                <h4 class="gestion-card-title">Canaux</h4>
                <button class="gestion-btn" @click="modals.createChannel = true">+ Nouveau</button>
              </div>
              <div class="gestion-channels-preview">
                <div v-for="ch in ganttFiltered.slice(0,1)" :key="'ch'" />
                <span class="gestion-hint">Les canaux sont gérés dans la sidebar Messages.</span>
                <button class="gestion-btn" style="margin-top:4px" @click="router.push('/messages')">
                  Aller aux messages
                </button>
              </div>
            </div>

            <!-- Carte Actions rapides -->
            <div class="gestion-card">
              <h4 class="gestion-card-title">Actions rapides</h4>
              <div style="display:flex;flex-direction:column;gap:6px">
                <button class="gestion-btn" @click="modals.classe = true"><GraduationCap :size="12" /> Voir la classe</button>
                <button class="gestion-btn" @click="modals.echeancier = true"><Clock :size="12" /> Échéancier</button>
                <button class="gestion-btn" @click="router.push('/devoirs')"><BookOpen :size="12" /> Aller aux devoirs</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab Frise -->
        <div v-else-if="dashTab === 'frise'" class="db-tab-content db-frise-outer">
          <div v-if="friseOffset !== 0" class="frise-recenter">
            <button class="gestion-btn" @click="friseOffset = 0">Recentrer sur aujourd'hui</button>
          </div>
          <div v-if="!ganttDateRange || !frise.length" class="db-empty-hint">
            <BarChart2 :size="36" style="opacity:.2;margin-bottom:10px" />
            <p>Aucune donnée de planification disponible.</p>
          </div>
          <div
            v-else class="frise-wrap"
            @wheel.prevent="onFriseWheel"
            @mousedown="onFriseDragStart"
            @mousemove="onFriseDragMove"
            @mouseup="onFriseDragEnd"
            @mouseleave="onFriseDragEnd"
            style="cursor:grab;user-select:none"
          >
            <!-- Axe des mois -->
            <div class="frise-axis-row">
              <div class="frise-label-col frise-axis-label">Projet</div>
              <div class="frise-bar-col frise-axis-months">
                <div v-for="(m, i) in ganttMonths" :key="i" class="frise-month-tick" :style="{ left: m.left + '%' }">{{ m.label }}</div>
                <div v-for="(m, i) in ganttMonths" :key="`bg${i}`" class="frise-month-bg" :class="{ even: i % 2 === 0 }"
                  :style="i < ganttMonths.length - 1 ? { left: m.left + '%', width: (ganttMonths[i+1].left - m.left) + '%' } : { left: m.left + '%', right: '0' }" />
                <div v-if="ganttTodayPct >= 0 && ganttTodayPct <= 100" class="frise-today" :style="{ left: ganttTodayPct + '%' }" />
              </div>
            </div>
            <!-- Promos -->
            <div v-for="promo in frise" :key="promo.name" class="frise-promo">
              <div class="frise-promo-heading">
                <div class="frise-label-col frise-promo-label-col">
                  <span class="frise-promo-dot" :style="{ background: promo.color }" />
                  <span class="frise-promo-name">{{ promo.name }}</span>
                </div>
                <div class="frise-bar-col frise-promo-bar-col" />
              </div>
              <!-- Lignes projet -->
              <div v-for="proj in promo.projects" :key="proj.key" class="frise-row" @click="goToProject(proj.key)">
                <div class="frise-label-col frise-project-label">
                  <component :is="proj.icon" v-if="proj.icon" :size="11" class="frise-project-icon" />
                  <span>{{ proj.label }}</span>
                  <ChevronRight :size="10" class="frise-project-arrow" />
                </div>
                <div class="frise-bar-col frise-timeline">
                  <div class="frise-proj-line" :style="projectLineStyle(proj.milestones)" />
                  <div v-if="ganttTodayPct >= 0 && ganttTodayPct <= 100" class="frise-today" :style="{ left: ganttTodayPct + '%' }" />
                  <div
                    v-for="(ms, mi) in proj.milestones"
                    :key="ms.id"
                    class="frise-milestone"
                    :class="[`frise-ms-${ms.type}`, { 'frise-ms-done': ms.done, 'frise-ms-draft': !ms.published, 'frise-ms-above': mi % 2 === 0 }]"
                    :style="{ left: milestoneLeft(ms.deadline) }"
                    :title="`${ms.title} — ${formatDate(ms.deadline)}`"
                    @click.stop="onMilestoneClick(ms)"
                  >
                    <div v-if="mi % 2 === 0" class="frise-ms-label">
                      <span class="frise-ms-title">{{ ms.title }}</span>
                      <span class="frise-ms-date">{{ formatDate(ms.deadline) }}</span>
                    </div>
                    <div class="frise-ms-dot" />
                    <div v-if="mi % 2 !== 0" class="frise-ms-label">
                      <span class="frise-ms-title">{{ ms.title }}</span>
                      <span class="frise-ms-date">{{ formatDate(ms.deadline) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </template>
    </template>

    <!-- ════════════════════ VUE ÉTUDIANT ════════════════════ -->
    <template v-else>

      <div v-if="loadingStudent" class="db-loading">
        <div v-for="i in 4" :key="i" class="skel db-skel-card" />
        <div class="db-skel-content">
          <div v-for="i in 5" :key="i" class="skel skel-line" :style="{ width: (45 + (i % 3) * 18) + '%' }" />
        </div>
      </div>

      <template v-else>
        <!-- En-tête étudiant -->
        <div class="db-header">
          <div class="db-header-left">
            <button v-if="props.toggleSidebar" class="mobile-hamburger" aria-label="Ouvrir le menu" @click="props.toggleSidebar">
              <Menu :size="22" />
            </button>
            <LayoutDashboard :size="20" class="db-header-icon" />
            <div>
              <h1 class="db-title">Bonjour, {{ greetingName }}</h1>
              <p class="db-date">{{ today }}</p>
            </div>
          </div>
          <div class="db-header-actions">
            <button class="btn-ghost db-echeancier-btn" @click="modals.studentTimeline = true">
              <CalendarDays :size="14" /> Ma timeline
            </button>
            <button class="btn-ghost db-echeancier-btn" @click="router.push('/devoirs')">
              <BookOpen :size="14" /> Tous mes devoirs
            </button>
          </div>
        </div>

        <!-- Bannière onboarding (première visite) -->
        <div v-if="showOnboarding" class="db-onboarding">
          <div class="db-onboarding-content">
            <strong>Bienvenue sur Cursus !</strong>
            <span>Consultez vos <b>devoirs</b> dans la section Devoirs, discutez dans les <b>canaux</b>, et suivez votre <b>progression</b> ici.</span>
          </div>
          <button class="btn-ghost db-onboarding-close" @click="dismissOnboarding">C'est compris</button>
        </div>

        <!-- Top 3 devoirs urgents -->
        <div v-if="urgentActions.length" class="db-urgent-list">
          <h4 class="db-urgent-title"><Clock :size="14" /> À rendre prochainement</h4>
          <div v-for="ua in urgentActions" :key="ua.id" class="db-urgent-item" :class="{ 'db-urgent-item--overdue': ua.isOverdue }" @click="goToProject(ua.category ?? '')">
            <AlertTriangle v-if="ua.isOverdue" :size="14" class="db-urgent-icon--danger" />
            <Clock v-else :size="14" style="opacity:.5" />
            <span class="db-urgent-item-title">{{ ua.title }}</span>
            <span class="db-urgent-item-urgency" :class="{ 'text-danger': ua.isOverdue }">{{ ua.urgency }}</span>
            <ChevronRight :size="12" style="opacity:.3" />
          </div>
        </div>
        <div v-else-if="travauxStore.devoirs.length" class="db-all-done">
          <CheckCircle2 :size="18" style="color:var(--color-success)" />
          <span>Tout est à jour ! Aucun devoir en attente.</span>
        </div>

        <!-- Dernières notes reçues -->
        <div v-if="recentGrades.length" class="db-recent-grades">
          <h4 class="db-urgent-title"><Award :size="14" /> Dernières notes</h4>
          <div class="db-recent-grades-list">
            <div v-for="g in recentGrades" :key="g.title" class="db-recent-grade-item">
              <span class="db-grade-badge" :class="'grade-' + g.note.toLowerCase()">{{ g.note }}</span>
              <span class="db-recent-grade-title">{{ g.title }}</span>
            </div>
          </div>
        </div>

        <!-- Stats étudiant -->
        <div class="db-stats">
          <div class="db-stat-card db-stat-warning">
            <span class="db-stat-value">{{ studentStats.pending }}</span>
            <span class="db-stat-label">À rendre</span>
            <Clock :size="18" class="db-stat-icon" />
          </div>
          <div class="db-stat-card db-stat-accent">
            <span class="db-stat-value">{{ studentStats.submitted }}</span>
            <span class="db-stat-label">Rendus déposés</span>
            <CheckCircle2 :size="18" class="db-stat-icon" />
          </div>
          <div class="db-stat-card db-stat-success">
            <span class="db-stat-value">{{ studentStats.graded }}</span>
            <span class="db-stat-label">Devoirs notés</span>
            <Award :size="18" class="db-stat-icon" />
          </div>
          <div class="db-stat-card db-stat-neutral">
            <span class="db-stat-value">{{ studentStats.modeGrade ?? '—' }}</span>
            <span class="db-stat-label">Note fréquente</span>
            <TrendingUp :size="18" class="db-stat-icon" />
          </div>
        </div>

        <!-- Tabs -->
        <div class="db-tabs">
          <button class="db-tab" :class="{ active: dashTab === 'accueil' }" @click="dashTab = 'accueil'">
            <FolderOpen :size="13" /> Mes projets
          </button>
          <button class="db-tab" :class="{ active: dashTab === 'frise' }" @click="dashTab = 'frise'">
            <BarChart2 :size="13" /> Frise
          </button>
        </div>

        <!-- Tab Projets étudiant -->
        <div v-if="dashTab === 'accueil'" class="db-tab-content">
          <div v-if="!studentProjectCards.length" class="db-empty-hint">
            <FolderOpen :size="36" style="opacity:.2;margin-bottom:10px" />
            <p>Aucun projet pour l'instant.</p>
            <button class="btn-ghost" style="margin-top:8px;font-size:13px" @click="router.push('/devoirs')">Voir mes devoirs</button>
          </div>
          <div v-else class="db-project-grid db-student-grid">
            <div
              v-for="p in studentProjectCards"
              :key="p.key"
              class="db-project-card db-student-card"
              @click="goToProject(p.key)"
            >
              <div class="db-project-icon">
                <component :is="p.icon" v-if="p.icon" :size="18" />
                <FolderOpen v-else :size="18" />
              </div>
              <div class="db-project-info">
                <span class="db-project-name">{{ p.label }}</span>
                <span class="db-project-stats">
                  {{ p.submitted }}/{{ p.total }} rendus
                  <template v-if="p.overdue"> · <span style="color:var(--color-danger)">{{ p.overdue }} en retard</span></template>
                </span>
                <span v-if="p.nextDeadline" class="db-project-next" :class="deadlineClass(p.nextDeadline)">
                  <Clock :size="9" /> {{ deadlineLabel(p.nextDeadline) }}
                </span>
              </div>
              <div class="db-student-bar">
                <div
                  class="db-student-fill"
                  :style="{ width: (p.total ? Math.round(p.submitted / p.total * 100) : 0) + '%' }"
                  :class="{ 'fill-done': p.submitted === p.total && p.total > 0, 'fill-overdue': p.overdue > 0 }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Tab Frise étudiant -->
        <div v-else class="db-tab-content db-frise-outer">
          <div v-if="!ganttDateRange || !frise.length" class="db-empty-hint">
            <BarChart2 :size="36" style="opacity:.2;margin-bottom:10px" />
            <p>Aucune donnée de planification disponible.</p>
          </div>
          <div
            v-else class="frise-wrap"
            @wheel.prevent="onFriseWheel"
            @mousedown="onFriseDragStart"
            @mousemove="onFriseDragMove"
            @mouseup="onFriseDragEnd"
            @mouseleave="onFriseDragEnd"
            style="cursor:grab;user-select:none"
          >
            <div class="frise-axis-row">
              <div class="frise-label-col frise-axis-label">Projet</div>
              <div class="frise-bar-col frise-axis-months">
                <div v-for="(m, i) in ganttMonths" :key="i" class="frise-month-tick" :style="{ left: m.left + '%' }">{{ m.label }}</div>
                <div v-for="(m, i) in ganttMonths" :key="`bg${i}`" class="frise-month-bg" :class="{ even: i % 2 === 0 }"
                  :style="i < ganttMonths.length - 1 ? { left: m.left + '%', width: (ganttMonths[i+1].left - m.left) + '%' } : { left: m.left + '%', right: '0' }" />
                <div v-if="ganttTodayPct >= 0 && ganttTodayPct <= 100" class="frise-today" :style="{ left: ganttTodayPct + '%' }" />
              </div>
            </div>
            <div v-for="promo in frise" :key="promo.name" class="frise-promo">
              <div class="frise-promo-heading">
                <div class="frise-label-col frise-promo-label-col">
                  <span class="frise-promo-dot" :style="{ background: promo.color }" />
                  <span class="frise-promo-name">{{ promo.name }}</span>
                </div>
                <div class="frise-bar-col frise-promo-bar-col" />
              </div>
              <div v-for="proj in promo.projects" :key="proj.key" class="frise-row" @click="goToProject(proj.key)">
                <div class="frise-label-col frise-project-label">
                  <component :is="proj.icon" v-if="proj.icon" :size="11" class="frise-project-icon" />
                  <span>{{ proj.label }}</span>
                  <ChevronRight :size="10" class="frise-project-arrow" />
                </div>
                <div class="frise-bar-col frise-timeline">
                  <div class="frise-proj-line" :style="projectLineStyle(proj.milestones)" />
                  <div v-if="ganttTodayPct >= 0 && ganttTodayPct <= 100" class="frise-today" :style="{ left: ganttTodayPct + '%' }" />
                  <div
                    v-for="(ms, mi) in proj.milestones"
                    :key="ms.id"
                    class="frise-milestone"
                    :class="[`frise-ms-${ms.type}`, { 'frise-ms-done': ms.done, 'frise-ms-draft': !ms.published, 'frise-ms-above': mi % 2 === 0 }]"
                    :style="{ left: milestoneLeft(ms.deadline) }"
                    :title="`${ms.title} — ${formatDate(ms.deadline)}`"
                    @click.stop="onMilestoneClick(ms)"
                  >
                    <div v-if="mi % 2 === 0" class="frise-ms-label">
                      <span class="frise-ms-title">{{ ms.title }}</span>
                      <span class="frise-ms-date">{{ formatDate(ms.deadline) }}</span>
                    </div>
                    <div class="frise-ms-dot" />
                    <div v-if="mi % 2 !== 0" class="frise-ms-label">
                      <span class="frise-ms-title">{{ ms.title }}</span>
                      <span class="frise-ms-date">{{ formatDate(ms.deadline) }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </template>
    </template>

  </div>
</template>

<style scoped>
/* ── Shell ── */
.dashboard-shell {
  flex: 1;
  overflow-y: auto;
  padding: 28px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}

/* ── Chargement ── */
.db-loading { display: flex; flex-direction: column; gap: 14px; padding: 32px 0; }
.db-skel-card { height: 76px; border-radius: 10px; flex-shrink: 0; }
.db-skel-content { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }

/* ── En-tête ── */
.db-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.db-header-left { display: flex; align-items: center; gap: 12px; }
.db-header-icon { color: var(--accent); }
.db-title { font-size: 20px; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
.db-date  { font-size: 12px; color: var(--text-muted); margin-top: 2px; text-transform: capitalize; }
.db-echeancier-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 6px 12px; flex-shrink: 0; }
.db-header-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

/* ── À faire cette semaine ── */
.db-week { margin-bottom: 16px; }
.db-week-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.db-week-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700; color: var(--text-primary);
}
.db-week-progress {
  font-size: 12px; font-weight: 600; color: var(--text-muted);
  background: rgba(255,255,255,.05); padding: 2px 8px; border-radius: 10px;
}
.db-week-list { display: flex; flex-direction: column; gap: 2px; }
.db-week-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-radius: 8px; cursor: pointer;
  transition: background var(--t-fast);
}
.db-week-item:hover { background: rgba(255,255,255,.04); }
.db-week-item.done { opacity: .45; }
.db-week-item.overdue:not(.done) { background: rgba(239,68,68,.06); }
.db-week-item.today:not(.done) { background: rgba(74,144,217,.06); }
.db-week-check { flex-shrink: 0; }
.db-week-circle {
  width: 18px; height: 18px; border-radius: 50%;
  border: 2px solid var(--border-input); transition: border-color var(--t-fast);
}
.db-week-item:hover .db-week-circle { border-color: var(--accent); }
.db-week-circle--overdue { border-color: var(--color-danger); }
.db-week-body { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
.db-week-item-title { font-size: 13px; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.line-through { text-decoration: line-through; opacity: .6; }
.db-week-meta { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.db-week-promo {
  font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px;
  background: rgba(74,144,217,.1); color: var(--accent); text-transform: uppercase;
}
.db-week-late {
  font-size: 10px; font-weight: 700; color: var(--color-danger);
}
.db-week-today-tag {
  font-size: 10px; font-weight: 600; color: var(--accent);
}
.db-week-date { font-size: 11px; color: var(--text-muted); }

/* ── Onglet Promotions ── */
.promo-list { display: flex; flex-direction: column; gap: 8px; }
.promo-list-card {
  background: rgba(255,255,255,.02); border: 1px solid var(--border);
  border-radius: 10px; padding: 14px;
  transition: border-color var(--t-fast);
}
.promo-list-card.promo-active { border-color: var(--accent); background: rgba(74,144,217,.04); }
.promo-list-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.promo-list-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.promo-list-name { font-size: 15px; font-weight: 700; color: var(--text-primary); flex: 1; }
.promo-list-active-tag {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  padding: 2px 8px; border-radius: 10px;
  background: rgba(74,144,217,.15); color: var(--accent);
}
.promo-list-stats { font-size: 12px; color: var(--text-muted); display: flex; gap: 12px; margin-bottom: 8px; }
.promo-list-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.promo-rename-input {
  flex: 1; font-size: 14px; font-weight: 600; padding: 3px 8px;
  background: var(--bg-input); border: 1px solid var(--accent); border-radius: 6px;
  color: var(--text-primary); font-family: var(--font); outline: none;
}

/* Dernière activité */
.db-activity { margin-top: 16px; }
.db-activity-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;
}
.db-activity-list { display: flex; flex-direction: column; gap: 4px; }
.db-activity-item {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 10px; border-radius: 8px;
  background: rgba(255,255,255,.02);
}
.db-activity-avatar {
  width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center;
  justify-content: center; font-size: 10px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.db-activity-info { flex: 1; min-width: 0; }
.db-activity-name { font-size: 13px; font-weight: 600; color: var(--text-primary); display: block; }
.db-activity-devoir { font-size: 11px; color: var(--text-muted); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-activity-right { text-align: right; flex-shrink: 0; }
.db-activity-note { font-size: 13px; font-weight: 800; display: block; }
.db-activity-note.grade-a { color: var(--color-success); }
.db-activity-note.grade-b { color: #27ae60; }
.db-activity-note.grade-c { color: var(--color-warning); }
.db-activity-note.grade-d { color: var(--color-danger); }
.db-activity-date { font-size: 10px; color: var(--text-muted); }

/* Bouton recentrer frise */
.frise-recenter { padding: 6px 12px; text-align: right; }

/* ── Onglet Réglages (ex-Gestion) ── */
.gestion-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}
.gestion-card {
  background: var(--bg-elevated, rgba(255,255,255,.03));
  border: 1px solid var(--border); border-radius: 10px; padding: 16px;
}
.gestion-card-title { font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px; }
.gestion-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.gestion-card-header .gestion-card-title { margin-bottom: 0; }
.gestion-card-actions { display: flex; gap: 6px; }
.gestion-btn {
  font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px;
  background: rgba(255,255,255,.06); color: var(--text-secondary);
  border: 1px solid var(--border-input); cursor: pointer; font-family: var(--font);
  transition: all var(--t-fast);
}
.gestion-btn:hover { background: rgba(255,255,255,.1); color: var(--text-primary); }
.gestion-btn-sm {
  font-size: 10px; padding: 2px 7px; border-radius: 4px;
  background: rgba(255,255,255,.06); color: var(--text-muted);
  border: 1px solid var(--border-input); cursor: pointer; font-family: var(--font);
}
.gestion-btn-accent { background: var(--accent); color: #fff; border-color: var(--accent); }
.gestion-promo-info { }
.gestion-promo-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.gestion-promo-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.gestion-promo-name { font-size: 16px; font-weight: 700; color: var(--text-primary); flex: 1; }
.gestion-promo-input {
  flex: 1; font-size: 15px; font-weight: 600; padding: 3px 8px;
  background: var(--bg-input); border: 1px solid var(--accent); border-radius: 6px;
  color: var(--text-primary); font-family: var(--font); outline: none;
}
.gestion-promo-stats { font-size: 12px; color: var(--text-muted); display: flex; gap: 12px; }
.gestion-student-list { display: flex; flex-direction: column; gap: 4px; }
.gestion-student-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
.gestion-student-avatar {
  width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.gestion-student-name { font-size: 13px; color: var(--text-primary); }
.gestion-more { font-size: 12px; color: var(--text-muted); font-style: italic; padding: 4px 0; }
.gestion-empty { font-size: 12px; color: var(--text-muted); font-style: italic; }
.gestion-hint { font-size: 12px; color: var(--text-muted); line-height: 1.5; }

/* ── Header promos inline ── */
.db-header-promos { display: flex; gap: 6px; flex-wrap: wrap; }
.db-promo-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 14px; font-size: 11px; font-weight: 600;
  background: rgba(255,255,255,.04); color: var(--text-secondary);
  border: 1.5px solid rgba(255,255,255,.08); cursor: pointer;
  font-family: var(--font); transition: all .15s;
}
.db-promo-chip:hover { background: rgba(255,255,255,.08); }
.db-promo-chip.active { font-weight: 700; }
.db-promo-chip-dot { width: 7px; height: 7px; border-radius: 50%; }

/* ── Stats compactes en ligne ── */
.db-stats-row {
  display: flex; gap: 8px; padding: 0 0 12px; flex-wrap: wrap;
}
.db-stat-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 8px; font-size: 12px;
  background: rgba(255,255,255,.03); color: var(--text-secondary);
  border: 1px solid var(--border);
}
.db-stat-pill strong { color: var(--text-primary); font-weight: 700; }
.db-stat-pill--alert { background: rgba(231,76,60,.08); border-color: rgba(231,76,60,.2); color: var(--color-danger); }
.db-stat-pill--alert strong { color: var(--color-danger); }
.db-stat-pill--warn { background: rgba(243,156,18,.08); border-color: rgba(243,156,18,.2); color: var(--color-warning); }
.db-stat-pill--warn strong { color: var(--color-warning); }
.db-stat-pill--muted { opacity: .6; }

/* ── (ancien) Stats grid — gardé pour compatibilité étudiant ── */
.db-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
@media (max-width: 900px) { .db-stats { grid-template-columns: repeat(2, 1fr); } }

.db-stat-card {
  position: relative;
  border-radius: 10px;
  padding: 16px 18px;
  border: 1px solid var(--border);
  background: var(--bg-sidebar);
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}
.db-stat-value { font-size: 28px; font-weight: 800; line-height: 1; }
.db-stat-label { font-size: 11.5px; color: var(--text-secondary); }
.db-stat-icon  { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); opacity: .18; }

.db-stat-danger  { border-color: rgba(231,76,60,.2); }
.db-stat-danger  .db-stat-value { color: #ff7b6b; }
.db-stat-danger  .db-stat-icon  { color: #E74C3C; opacity: .3; }
.db-stat-warning { border-color: rgba(243,156,18,.2); }
.db-stat-warning .db-stat-value { color: var(--color-warning); }
.db-stat-warning .db-stat-icon  { color: var(--color-warning); opacity: .3; }
.db-stat-muted   .db-stat-value { color: var(--text-secondary); }
.db-stat-accent  { border-color: rgba(74,144,217,.2); }
.db-stat-accent  .db-stat-value { color: var(--accent-light); }
.db-stat-accent  .db-stat-icon  { color: var(--accent); opacity: .3; }
.db-stat-success { border-color: rgba(39,174,96,.2); }
.db-stat-success .db-stat-value { color: var(--color-success); }
.db-stat-success .db-stat-icon  { color: var(--color-success); opacity: .3; }
.db-stat-neutral .db-stat-value { color: var(--text-primary); }

/* ── Tabs ── */
.db-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0;
}
.db-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  border-radius: 0;
  transition: color var(--t-fast), border-color var(--t-fast);
}
.db-tab:hover { color: var(--text-primary); }
.db-tab.active { color: var(--accent); border-bottom-color: var(--accent); }

.db-tab-content { display: flex; flex-direction: column; gap: 0; }

/* ── Grille projets ── */
.db-project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
  padding-top: 14px;
}
.db-project-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-sidebar);
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast), box-shadow var(--t-fast);
}
.db-project-card:hover {
  background: rgba(74,144,217,.07);
  border-color: rgba(74,144,217,.3);
  box-shadow: 0 2px 12px rgba(0,0,0,.15);
}
.db-project-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--accent-subtle);
  color: var(--accent-light);
}
.db-project-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.db-project-name  { font-size: 13.5px; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-project-stats { font-size: 11px; color: var(--text-muted); }
.db-project-next  { display: inline-flex; align-items: center; gap: 3px; font-size: 10.5px; font-weight: 600; }
.db-project-next.deadline-ok       { color: var(--color-success); }
.db-project-next.deadline-warning  { color: #F39C12; }
.db-project-next.deadline-soon     { color: var(--color-warning); }
.db-project-next.deadline-critical,
.db-project-next.deadline-passed   { color: var(--color-danger); }
.db-project-chevron { color: var(--text-muted); flex-shrink: 0; transition: transform var(--t-fast), color var(--t-fast); }
.db-project-card:hover .db-project-chevron { transform: translateX(2px); color: var(--accent); }

/* ── Cartes étudiant (avec barre de progression) ── */
.db-student-grid .db-student-card {
  flex-direction: column;
  align-items: flex-start;
  padding-bottom: 10px;
  gap: 6px;
}
.db-student-bar {
  width: 100%;
  height: 3px;
  border-radius: 2px;
  background: rgba(255,255,255,.06);
  overflow: hidden;
}
.db-student-fill {
  height: 100%;
  border-radius: 2px;
  background: #9B87F5;
  transition: width .3s ease;
}
.db-student-fill.fill-done { background: var(--color-success); }
.db-student-fill.fill-overdue { background: var(--color-danger); }

/* ── Onboarding ── */
.db-onboarding {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  background: rgba(74,144,217,.1);
  border: 1px solid rgba(74,144,217,.25);
  border-radius: var(--radius);
  margin-bottom: 16px;
}
.db-onboarding-content {
  flex: 1;
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.5;
}
.db-onboarding-content strong {
  color: var(--text-primary);
  display: block;
  margin-bottom: 2px;
}
.db-onboarding-close {
  flex-shrink: 0;
  white-space: nowrap;
}

/* ── Prochaine action ── */
.db-next-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  background: rgba(243,156,18,.08);
  border: 1px solid rgba(243,156,18,.2);
  border-radius: var(--radius);
  margin-bottom: 16px;
}
.db-next-action--overdue {
  background: rgba(231,76,60,.08);
  border-color: rgba(231,76,60,.25);
}
.db-next-action-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.db-next-icon {
  color: var(--color-warning);
  flex-shrink: 0;
}
.db-next-icon--danger { color: var(--color-danger); }
.db-next-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
  display: block;
}
.db-next-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.db-next-urgency {
  font-size: 12px;
  color: var(--text-secondary);
  display: block;
}
.db-next-btn { flex-shrink: 0; }

/* ── Urgent list + dernières notes ── */
.db-urgent-list, .db-recent-grades {
  margin-bottom: 16px;
}
.db-urgent-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px;
}
.db-urgent-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: 8px; cursor: pointer;
  background: rgba(255,255,255,.02); transition: background .15s;
  margin-bottom: 4px; font-size: 13px; color: var(--text-primary);
}
.db-urgent-item:hover { background: rgba(255,255,255,.06); }
.db-urgent-item--overdue { background: rgba(231,76,60,.06); }
.db-urgent-item-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.db-urgent-item-urgency { font-size: 11px; font-weight: 600; color: var(--text-muted); flex-shrink: 0; }
.db-urgent-icon--danger { color: var(--color-danger); }
.text-danger { color: var(--color-danger) !important; }

.db-recent-grades-list { display: flex; gap: 8px; flex-wrap: wrap; }
.db-recent-grade-item {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 8px;
  background: rgba(255,255,255,.03); font-size: 13px;
}
.db-recent-grade-title { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
.db-grade-badge {
  font-size: 12px; font-weight: 800; padding: 2px 8px; border-radius: 6px;
}
.db-grade-badge.grade-a { background: rgba(39,174,96,.15); color: #27ae60; }
.db-grade-badge.grade-b { background: rgba(39,174,96,.08); color: #2ecc71; }
.db-grade-badge.grade-c { background: rgba(243,156,18,.12); color: #e67e22; }
.db-grade-badge.grade-d { background: rgba(231,76,60,.12); color: #e74c3c; }

.db-all-done {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  background: rgba(46,204,113,.08);
  border: 1px solid rgba(46,204,113,.2);
  border-radius: var(--radius);
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

/* ── Empty hint ── */
/* ═══════ ANALYTIQUE ═══════ */
.analytics-grid { display: flex; flex-direction: column; gap: 16px; }
.analytics-quick-stats {
  display: flex; gap: 12px; flex-wrap: wrap;
}
.analytics-stat {
  flex: 1; min-width: 100px;
  background: var(--bg-secondary); border-radius: 8px; padding: 14px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.analytics-stat-value { font-size: 22px; font-weight: 700; color: var(--text-primary); }
.analytics-stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; }
.analytics-card {
  background: var(--bg-secondary); border-radius: 8px; padding: 16px;
}
.analytics-card-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; color: var(--text-primary);
  margin-bottom: 14px;
}
.analytics-bars { display: flex; flex-direction: column; gap: 6px; }
.analytics-bar-row {
  display: flex; align-items: center; gap: 8px;
}
.analytics-bar-label {
  width: 40px; flex-shrink: 0;
  font-size: 11px; color: var(--text-muted); text-align: right;
}
.analytics-bar-label-wide {
  width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.analytics-bar-track {
  flex: 1; height: 18px; background: rgba(255,255,255,.05); border-radius: 4px; overflow: hidden;
}
.analytics-bar-fill {
  height: 100%; border-radius: 4px; transition: width .4s ease;
}
.analytics-bar-count {
  width: 32px; flex-shrink: 0;
  font-size: 11px; color: var(--text-secondary); text-align: right; font-variant-numeric: tabular-nums;
}

.db-empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
  gap: 4px;
}

/* ════════════════════════════════════════════
   FRISE CHRONOLOGIQUE
════════════════════════════════════════════ */
.db-frise-outer { flex: 1; min-height: 0; overflow: hidden; padding-top: 12px; }

.frise-wrap {
  overflow-x: auto;
  overflow-y: auto;
  max-height: calc(100vh - 340px);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-sidebar);
  min-width: 0;
}

/* ── Colonnes label / bar (partagées) ── */
.frise-label-col {
  width: 180px;
  min-width: 180px;
  flex-shrink: 0;
  position: sticky;
  left: 0;
  background: var(--bg-sidebar);
  z-index: 2;
  border-right: 1px solid var(--border);
}
.frise-bar-col {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* ── Axe des mois ── */
.frise-axis-row {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 4;
  background: var(--bg-sidebar);
}
.frise-axis-label {
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
  height: 32px;
  z-index: 5;
}
.frise-axis-months {
  height: 32px;
  position: relative;
}
.frise-month-tick {
  position: absolute;
  top: 8px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
  letter-spacing: .3px;
}
.frise-month-bg {
  position: absolute;
  top: 0; bottom: 0;
}
.frise-month-bg.even { background: rgba(255,255,255,.018); }

/* ── Ligne aujourd'hui ── */
.frise-today {
  position: absolute;
  top: 0; bottom: 0;
  width: 1.5px;
  background: rgba(74,144,217,.55);
  z-index: 1;
  pointer-events: none;
}

/* ── En-tête de promo ── */
.frise-promo-heading {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--border);
}
.frise-promo-label-col {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  font-size: 10.5px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: var(--text-secondary);
}
.frise-promo-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 6px currentColor;
}
.frise-promo-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.frise-promo-bar-col { background: rgba(255,255,255,.015); }

/* ── Ligne projet ── */
.frise-row {
  display: flex;
  align-items: stretch;
  height: 96px;
  border-bottom: 1px solid rgba(255,255,255,.04);
  cursor: pointer;
  transition: background var(--t-fast);
  min-width: 700px;
}
.frise-row:hover { background: rgba(74,144,217,.04); }
.frise-row:hover .frise-label-col { background: rgba(74,144,217,.06); }

.frise-project-label {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 10px 0 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color var(--t-fast);
}
.frise-row:hover .frise-project-label { color: var(--accent-light); }
.frise-project-icon { color: var(--accent); flex-shrink: 0; }
.frise-project-label > span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.frise-project-arrow { color: var(--text-muted); flex-shrink: 0; transition: transform var(--t-fast), color var(--t-fast); }
.frise-row:hover .frise-project-arrow { transform: translateX(2px); color: var(--accent); }

/* ── Zone timeline ── */
.frise-timeline {
  position: relative;
}

/* Trait horizontal reliant premier→dernier jalon */
.frise-proj-line {
  position: absolute;
  top: 50%;
  height: 2px;
  transform: translateY(-50%);
  background: rgba(255,255,255,.12);
  border-radius: 1px;
  pointer-events: none;
}

/* ── Jalons ── */
.frise-milestone {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  z-index: 2;
  transition: transform var(--t-fast);
}
.frise-milestone:hover { transform: translate(-50%, -50%) scale(1.15); }

/* Dot (cercle par défaut) */
.frise-ms-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--bg-sidebar);
  flex-shrink: 0;
  transition: box-shadow var(--t-fast);
}
.frise-milestone:hover .frise-ms-dot { box-shadow: 0 0 0 3px rgba(255,255,255,.15); }

/* Diamond pour soutenance & cctl */
.frise-ms-soutenance .frise-ms-dot,
.frise-ms-cctl .frise-ms-dot {
  border-radius: 2px;
  transform: rotate(45deg);
}

/* Couleurs */
.frise-ms-livrable .frise-ms-dot     { background: var(--accent); }
.frise-ms-soutenance .frise-ms-dot   { background: var(--color-warning); }
.frise-ms-cctl .frise-ms-dot         { background: #9b87f5; }
.frise-ms-etude_de_cas .frise-ms-dot { background: var(--color-success); }
.frise-ms-memoire .frise-ms-dot      { background: #e74c3c; }
.frise-ms-autre .frise-ms-dot        { background: #95a5a6; }

/* Brouillon */
.frise-ms-draft .frise-ms-dot { opacity: .35; }

/* Fait */
.frise-ms-done .frise-ms-dot { filter: brightness(1.2); box-shadow: 0 0 0 2px rgba(255,255,255,.2); }

/* ── Labels au-dessus / en-dessous ── */
.frise-ms-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  pointer-events: none;
  white-space: nowrap;
}
/* Label above: il vient AVANT le dot dans le DOM → margin-bottom */
.frise-ms-above .frise-ms-label { margin-bottom: 5px; }
/* Label below: il vient APRÈS le dot → margin-top */
.frise-milestone:not(.frise-ms-above) .frise-ms-label { margin-top: 5px; }

.frise-ms-title {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--text-secondary);
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}
.frise-ms-date {
  font-size: 8.5px;
  color: var(--text-muted);
  font-weight: 500;
}

/* ── Barre sélecteur promo ── */
.db-promo-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.db-promo-pills {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.db-promo-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  border: 1.5px solid transparent;
  background: var(--bg-sidebar);
  color: var(--text-secondary);
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all .15s ease;
}
.db-promo-pill:hover { background: rgba(255,255,255,.07); color: var(--text-primary); }
.db-promo-pill.active { color: #fff; font-weight: 700; }

.db-promo-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.db-new-promo-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 5px 12px;
  flex-shrink: 0;
  color: var(--text-muted);
  border: 1.5px dashed var(--border-input);
  border-radius: 20px;
  transition: all .15s ease;
}
.db-new-promo-btn:hover { color: var(--accent); border-color: var(--accent); background: rgba(74,144,217,.07); }
</style>
