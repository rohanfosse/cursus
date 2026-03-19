<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  Clock, Edit3, Users, BookOpen, AlertTriangle,
  ChevronRight, CheckCircle2, FileText, LayoutDashboard,
  Award, TrendingUp, FolderOpen, CalendarDays, BarChart2,
  PlusCircle, Menu, GraduationCap,
} from 'lucide-vue-next'
import { useAppStore }    from '@/stores/app'
import { useModalsStore } from '@/stores/modals'
import { useTravauxStore } from '@/stores/travaux'
import { useRouter, useRoute } from 'vue-router'
import { deadlineClass, deadlineLabel, formatDate } from '@/utils/date'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import type { Component } from 'vue'
import type { Devoir }    from '@/types'

const props = defineProps<{ toggleSidebar?: () => void }>()

const appStore     = useAppStore()
const modals       = useModalsStore()
const travauxStore = useTravauxStore()
const router       = useRouter()
const route        = useRoute()

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
const allStudents     = ref<{ id: number; promo_id: number }[]>([])
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
      if (studRes?.ok) allStudents.value = studRes.data as { id: number; promo_id: number }[]
      if (ganttRes?.ok) ganttAll.value = ganttRes.data as GanttRow[]
    } finally { loadingTeacher.value = false }
  } else {
    try {
      if (!travauxStore.devoirs.length) await travauxStore.fetchStudentDevoirs()
    } finally { loadingStudent.value = false }
  }
})

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

const studentStats = computed(() => {
  const all       = travauxStore.devoirs
  const submitted = all.filter(t => t.depot_id != null)
  const pending   = all.filter(t => t.depot_id == null && needsSub(t))
  const graded    = all.filter(t => t.note != null)
  const grades    = graded.map(t => parseFloat(t.note ?? '')).filter(n => !isNaN(n))
  const avg       = grades.length ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length * 10) / 10 : null
  return { total: all.length, submitted: submitted.length, pending: pending.length, graded: graded.length, avg }
})

// ── Prochaine action (devoir le plus urgent non soumis) ─────────────────────
const nextAction = computed(() => {
  const now = Date.now()
  const pending = travauxStore.devoirs.filter(t => t.depot_id == null && needsSub(t) && t.deadline)
  if (!pending.length) return null
  // Trier par urgence : overdue d'abord (par deadline), puis les futurs par deadline
  const sorted = pending.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  const next = sorted[0]
  const diffMs = new Date(next.deadline).getTime() - now
  const diffDays = Math.ceil(diffMs / 86_400_000)
  let urgency: string
  if (diffMs < 0) urgency = `En retard de ${Math.abs(diffDays)} jour(s)`
  else if (diffDays <= 1) urgency = "Aujourd'hui ou demain"
  else if (diffDays <= 3) urgency = `Dans ${diffDays} jours`
  else urgency = `Dans ${diffDays} jours`
  return { ...next, urgency, isOverdue: diffMs < 0 }
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
    const grades    = submitted.map(r => parseFloat(r.note ?? '')).filter(n => !isNaN(n))
    const avgGrade  = grades.length ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length * 10) / 10 : null
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
const dashTab = ref<'projets' | 'frise'>(route.query.tab === 'frise' ? 'frise' : 'projets')
watch(() => route.query.tab, (tab) => { dashTab.value = tab === 'frise' ? 'frise' : 'projets' })

interface FriseMilestone { id: number; title: string; type: string; deadline: string; published: boolean; done: boolean }
interface FriseProject   { key: string; label: string; icon: Component | null; milestones: FriseMilestone[] }
interface FrisePromo     { name: string; color: string; projects: FriseProject[] }

const ganttDateRange = computed(() => {
  const rows = (appStore.isTeacher ? ganttFiltered.value : travauxStore.devoirs) as { deadline: string }[]
  if (!rows.length) return null
  let min = Infinity, max = -Infinity
  for (const t of rows) {
    const e = new Date(t.deadline).getTime()
    if (e < min) min = e
    if (e > max) max = e
  }
  return { start: new Date(min - 28 * 86_400_000), end: new Date(max + 28 * 86_400_000) }
})

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
      id: t.id, title: t.title, type: (t as any).type ?? 'autre', deadline: t.deadline,
      published: true, done: t.depot_id != null,
    })
  }
  return [{
    name: (appStore.currentUser as any)?.promo_name ?? 'Ma promo', color: '#9b87f5',
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
        <!-- En-tête -->
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
            <button class="btn-ghost db-echeancier-btn" @click="modals.classe = true">
              <GraduationCap :size="14" /> Classe
            </button>
            <button class="btn-ghost db-echeancier-btn" @click="modals.intervenants = true">
              <Users :size="14" /> Intervenants
            </button>
            <button class="btn-ghost db-echeancier-btn" @click="modals.echeancier = true">
              <Clock :size="14" /> Échéancier
            </button>
          </div>
        </div>

        <!-- Sélecteur de promo -->
        <div class="db-promo-bar">
          <div class="db-promo-pills">
            <button
              v-for="p in promos"
              :key="p.id"
              class="db-promo-pill"
              :class="{ active: appStore.activePromoId === p.id }"
              :style="appStore.activePromoId === p.id ? { background: p.color, borderColor: p.color } : { borderColor: p.color + '55' }"
              @click="appStore.activePromoId = p.id"
            >
              <span class="db-promo-dot" :style="{ background: appStore.activePromoId === p.id ? '#fff' : p.color }" />
              {{ p.name }}
            </button>
          </div>
          <button class="db-new-promo-btn btn-ghost" @click="modals.createPromo = true">
            <PlusCircle :size="13" /> Nouvelle promo
          </button>
        </div>

        <!-- Stats -->
        <div class="db-stats">
          <div class="db-stat-card db-stat-danger">
            <span class="db-stat-value">{{ aNoterCount }}</span>
            <span class="db-stat-label">Rendus à noter</span>
            <Edit3 :size="18" class="db-stat-icon" />
          </div>
          <div class="db-stat-card db-stat-warning">
            <span class="db-stat-value">{{ urgentsCount }}</span>
            <span class="db-stat-label">Devoirs cette semaine</span>
            <AlertTriangle :size="18" class="db-stat-icon" />
          </div>
          <div class="db-stat-card db-stat-muted">
            <span class="db-stat-value">{{ brouillonsCount }}</span>
            <span class="db-stat-label">Brouillons</span>
            <FileText :size="18" class="db-stat-icon" />
          </div>
          <div class="db-stat-card db-stat-accent">
            <span class="db-stat-value">{{ totalStudents }}</span>
            <span class="db-stat-label">Étudiants · {{ promos.length }} promos</span>
            <Users :size="18" class="db-stat-icon" />
          </div>
        </div>

        <!-- Tabs -->
        <div class="db-tabs">
          <button class="db-tab" :class="{ active: dashTab === 'projets' }" @click="dashTab = 'projets'">
            <FolderOpen :size="13" /> Projets
          </button>
          <button class="db-tab" :class="{ active: dashTab === 'frise' }" @click="dashTab = 'frise'">
            <BarChart2 :size="13" /> Frise
          </button>
        </div>

        <!-- Tab Projets -->
        <div v-if="dashTab === 'projets'" class="db-tab-content">
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
        </div>

        <!-- Tab Frise -->
        <div v-else class="db-tab-content db-frise-outer">
          <div v-if="!ganttDateRange || !frise.length" class="db-empty-hint">
            <BarChart2 :size="36" style="opacity:.2;margin-bottom:10px" />
            <p>Aucune donnée de planification disponible.</p>
          </div>
          <div v-else class="frise-wrap">
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

        <!-- Carte prochaine action -->
        <div v-if="nextAction" class="db-next-action" :class="{ 'db-next-action--overdue': nextAction.isOverdue }">
          <div class="db-next-action-left">
            <AlertTriangle v-if="nextAction.isOverdue" :size="18" class="db-next-icon db-next-icon--danger" />
            <Clock v-else :size="18" class="db-next-icon" />
            <div>
              <span class="db-next-label">Prochaine action</span>
              <span class="db-next-title">{{ nextAction.title }}</span>
              <span class="db-next-urgency">{{ nextAction.urgency }}</span>
            </div>
          </div>
          <button class="btn-primary db-next-btn" @click="goToProject(nextAction.category ?? '')">
            Voir le devoir
          </button>
        </div>
        <div v-else-if="travauxStore.devoirs.length" class="db-all-done">
          <CheckCircle2 :size="18" style="color:var(--color-success)" />
          <span>Tout est à jour ! Aucun devoir en attente.</span>
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
            <span class="db-stat-value">{{ studentStats.avg != null ? studentStats.avg + '/20' : 'Pas encore' }}</span>
            <span class="db-stat-label">Note moyenne</span>
            <TrendingUp :size="18" class="db-stat-icon" />
          </div>
        </div>

        <!-- Tabs -->
        <div class="db-tabs">
          <button class="db-tab" :class="{ active: dashTab === 'projets' }" @click="dashTab = 'projets'">
            <FolderOpen :size="13" /> Mes projets
          </button>
          <button class="db-tab" :class="{ active: dashTab === 'frise' }" @click="dashTab = 'frise'">
            <BarChart2 :size="13" /> Frise
          </button>
        </div>

        <!-- Tab Projets étudiant -->
        <div v-if="dashTab === 'projets'" class="db-tab-content">
          <div v-if="!studentProjectCards.length" class="db-empty-hint">
            <FolderOpen :size="36" style="opacity:.2;margin-bottom:10px" />
            <p>Aucun projet pour l'instant.</p>
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
                  <template v-else-if="p.avgGrade != null"> · moy. {{ p.avgGrade }}/20</template>
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
          <div v-else class="frise-wrap">
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

/* ── Stats ── */
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
