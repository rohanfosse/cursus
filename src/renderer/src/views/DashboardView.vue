<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Clock, Edit3, Users, BookOpen, AlertTriangle,
  ChevronRight, CheckCircle2, FileText, Eye, LayoutDashboard,
  Award, Calendar, TrendingUp, FolderOpen,
} from 'lucide-vue-next'
import { useAppStore }    from '@/stores/app'
import { useModalsStore } from '@/stores/modals'
import { useTravauxStore } from '@/stores/travaux'
import { useRouter }      from 'vue-router'
import { deadlineClass, deadlineLabel, formatDate } from '@/utils/date'
import { avatarColor }    from '@/utils/format'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import type { Component } from 'vue'
import type { Devoir }    from '@/types'

const appStore     = useAppStore()
const modals       = useModalsStore()
const travauxStore = useTravauxStore()
const router       = useRouter()

// ── Types locaux (prof) ───────────────────────────────────────────────────────
interface ANoterRow {
  depot_id:        number
  travail_id:      number
  travail_title:   string
  student_name:    string
  avatar_initials: string
  channel_name:    string
  submitted_at:    string
  deadline:        string
  promo_name:      string
  promo_color:     string
}
interface BrouillonRow {
  id:           number
  title:        string
  deadline:     string
  type:         string
  channel_name: string
  promo_name:   string
  promo_color:  string
}
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
interface Promotion {
  id:    number
  name:  string
  color: string
}

// ── État prof ─────────────────────────────────────────────────────────────────
const loadingTeacher = ref(true)
const aNoter         = ref<ANoterRow[]>([])
const brouillons     = ref<BrouillonRow[]>([])
const promos         = ref<Promotion[]>([])
const totalStudents  = ref(0)
const urgents        = ref<GanttRow[]>([])
const ganttAll       = ref<GanttRow[]>([])

// ── État étudiant ─────────────────────────────────────────────────────────────
const loadingStudent = ref(true)

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
        const d = schedRes.data as { aNoter: ANoterRow[]; brouillons: BrouillonRow[]; jalons: unknown[]; urgents: unknown[] }
        aNoter.value     = d.aNoter     ?? []
        brouillons.value = d.brouillons ?? []
      }
      if (promosRes?.ok) promos.value       = promosRes.data as Promotion[]
      if (studRes?.ok)   totalStudents.value = (studRes.data as unknown[]).length
      if (ganttRes?.ok) {
        const rows    = ganttRes.data as GanttRow[]
        ganttAll.value = rows
        const now     = Date.now()
        const in7days = now + 7 * 86_400_000
        urgents.value = rows
          .filter(t => t.published && new Date(t.deadline).getTime() >= now && new Date(t.deadline).getTime() <= in7days)
          .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
          .slice(0, 10)
      }
    } finally { loadingTeacher.value = false }
  } else {
    try {
      if (!travauxStore.devoirs.length) await travauxStore.fetchStudentDevoirs()
    } finally { loadingStudent.value = false }
  }
})

// ── Actions ───────────────────────────────────────────────────────────────────
function openDevoir(id: number) {
  appStore.currentTravailId = id
  modals.gestionDevoir = true
}

function goToProject(projectKey: string) {
  appStore.activeProject = projectKey
  router.push('/devoirs')
}

// ── Computed prof ─────────────────────────────────────────────────────────────
const greetingName = computed(() => (appStore.currentUser?.name ?? '').split(' ')[0])

interface ProjectCard {
  key:            string
  label:          string
  icon:           Component | null
  total:          number
  published:      number
  depots:         number
  expected:       number
  nextDeadline:   string | null
}

const projectCards = computed((): ProjectCard[] => {
  const map = new Map<string, GanttRow[]>()
  for (const t of ganttAll.value) {
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
      key,
      label,
      icon,
      total:        rows.length,
      published:    published.length,
      depots:       rows.reduce((s, r) => s + (r.depots_count ?? 0), 0),
      expected:     rows.reduce((s, r) => s + (r.students_total ?? 0), 0),
      nextDeadline: upcoming[0]?.deadline ?? null,
    })
  }
  return cards.sort((a, b) => {
    if (!a.nextDeadline && !b.nextDeadline) return a.label.localeCompare(b.label)
    if (!a.nextDeadline) return 1
    if (!b.nextDeadline) return -1
    return new Date(a.nextDeadline).getTime() - new Date(b.nextDeadline).getTime()
  })
})
const today = computed(() =>
  new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
)
const aNoterDisplay = computed(() => aNoter.value.slice(0, 12))
function submitPct(row: GanttRow) {
  return row.students_total ? Math.round((row.depots_count / row.students_total) * 100) : 0
}

// ── Computed étudiant ─────────────────────────────────────────────────────────
const isEventType = (t: Devoir) => t.type === 'soutenance' || t.type === 'cctl'

const studentStats = computed(() => {
  const all       = travauxStore.devoirs
  const submitted = all.filter(t => t.depot_id != null)
  const pending   = all.filter(t => t.depot_id == null && !isEventType(t))
  const graded    = all.filter(t => t.note != null)
  const grades    = graded.map(t => parseFloat(t.note ?? '')).filter(n => !isNaN(n))
  const avg       = grades.length ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length * 10) / 10 : null
  return { total: all.length, submitted: submitted.length, pending: pending.length, graded: graded.length, avg }
})

const studentPending = computed(() => {
  const now = Date.now()
  return travauxStore.devoirs
    .filter(t => t.depot_id == null && !isEventType(t))
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
})

const studentEvents = computed(() =>
  travauxStore.devoirs
    .filter(t => isEventType(t) && new Date(t.deadline).getTime() >= Date.now())
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
)

const studentSubmitted = computed(() =>
  travauxStore.devoirs
    .filter(t => t.depot_id != null)
    .sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime())
    .slice(0, 6),
)

const typeLabels: Record<string, string> = {
  livrable: 'Livrable', soutenance: 'Soutenance', cctl: 'CCTL',
  etude_de_cas: 'Étude de cas', memoire: 'Mémoire', autre: 'Autre',
  devoir: 'Devoir', projet: 'Projet', jalon: 'Jalon',
}

function gradeColorClass(note: string | null | undefined): string {
  const n = parseFloat(note ?? '')
  if (isNaN(n)) return 'grade-na'
  if (n >= 16)  return 'grade-a'
  if (n >= 12)  return 'grade-b'
  if (n >= 8)   return 'grade-c'
  return 'grade-d'
}

const firstFeedback = computed(() =>
  travauxStore.devoirs.find(t => t.depot_id != null && t.feedback),
)
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
            <LayoutDashboard :size="20" class="db-header-icon" />
            <div>
              <h1 class="db-title">Bonjour, {{ greetingName }}</h1>
              <p class="db-date">{{ today }}</p>
            </div>
          </div>
          <button class="btn-ghost db-echeancier-btn" @click="modals.echeancier = true">
            <Clock :size="14" /> Voir l'échéancier complet
          </button>
        </div>

        <!-- Stats prof -->
        <div class="db-stats">
          <div class="db-stat-card db-stat-danger">
            <span class="db-stat-value">{{ aNoter.length }}</span>
            <span class="db-stat-label">Rendus à noter</span>
            <Edit3 :size="18" class="db-stat-icon" />
          </div>
          <div class="db-stat-card db-stat-warning">
            <span class="db-stat-value">{{ urgents.length }}</span>
            <span class="db-stat-label">Devoirs cette semaine</span>
            <AlertTriangle :size="18" class="db-stat-icon" />
          </div>
          <div class="db-stat-card db-stat-muted">
            <span class="db-stat-value">{{ brouillons.length }}</span>
            <span class="db-stat-label">Brouillons</span>
            <FileText :size="18" class="db-stat-icon" />
          </div>
          <div class="db-stat-card db-stat-accent">
            <span class="db-stat-value">{{ totalStudents }}</span>
            <span class="db-stat-label">Étudiants · {{ promos.length }} promos</span>
            <Users :size="18" class="db-stat-icon" />
          </div>
        </div>

        <!-- Projets -->
        <section v-if="projectCards.length > 0" class="db-projects-section">
          <div class="db-section-header">
            <h2 class="db-section-title"><FolderOpen :size="15" /> Projets</h2>
            <button class="btn-ghost db-see-all-btn" @click="router.push('/devoirs')">Voir tous les devoirs →</button>
          </div>
          <div class="db-project-grid">
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
        </section>

        <!-- Corps prof -->
        <div class="db-body">
          <!-- Rendus à noter -->
          <section class="db-section db-section-left">
            <div class="db-section-header">
              <h2 class="db-section-title">
                <Edit3 :size="15" /> Rendus à noter
                <span v-if="aNoter.length" class="db-section-badge db-badge-danger">{{ aNoter.length }}</span>
              </h2>
            </div>
            <div v-if="aNoter.length === 0" class="db-empty">
              <CheckCircle2 :size="32" class="db-empty-success" />
              <p>Tous les rendus sont notés.</p>
            </div>
            <div v-else class="db-rendu-list">
              <div v-for="row in aNoterDisplay" :key="row.depot_id" class="db-rendu-row" @click="openDevoir(row.travail_id)">
                <div class="db-avatar" :style="{ background: avatarColor(row.student_name) }">{{ row.avatar_initials }}</div>
                <div class="db-rendu-info">
                  <span class="db-rendu-student">{{ row.student_name }}</span>
                  <span class="db-rendu-meta">
                    <span class="db-rendu-devoir">{{ row.travail_title }}</span>
                    <span class="db-rendu-sep">·</span>
                    <span class="db-rendu-channel">#{{ row.channel_name }}</span>
                  </span>
                </div>
                <div class="db-rendu-right">
                  <span class="db-rendu-date">{{ new Date(row.submitted_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) }}</span>
                  <span class="db-promo-pill" :style="{ background: (row.promo_color ?? '#4A90D9') + '22', color: row.promo_color ?? '#4A90D9' }">{{ row.promo_name }}</span>
                </div>
                <ChevronRight :size="14" class="db-row-chevron" />
              </div>
              <div v-if="aNoter.length > 12" class="db-more-link" @click="modals.echeancier = true">
                + {{ aNoter.length - 12 }} autres — ouvrir l'échéancier
              </div>
            </div>
          </section>

          <!-- Colonne droite prof -->
          <div class="db-col-right">
            <!-- Urgents -->
            <section class="db-section">
              <div class="db-section-header">
                <h2 class="db-section-title">
                  <AlertTriangle :size="15" /> Devoirs cette semaine
                  <span v-if="urgents.length" class="db-section-badge db-badge-warning">{{ urgents.length }}</span>
                </h2>
              </div>
              <div v-if="urgents.length === 0" class="db-empty db-empty-sm">
                <p>Aucun devoir à rendre dans les 7 jours.</p>
              </div>
              <div v-else class="db-urgent-list">
                <div v-for="t in urgents" :key="t.id" class="db-urgent-row" @click="openDevoir(t.id)">
                  <div class="db-urgent-top">
                    <span class="db-type-badge" :class="`type-${t.type}`">{{ typeLabels[t.type] ?? t.type }}</span>
                    <span class="db-urgent-title">{{ t.title }}</span>
                    <span class="db-deadline-badge" :class="deadlineClass(t.deadline)"><Clock :size="9" />{{ deadlineLabel(t.deadline) }}</span>
                  </div>
                  <div class="db-urgent-sub">
                    <span class="db-urgent-channel">#{{ t.channel_name }}</span>
                    <span class="db-promo-pill" :style="{ background: (t.promo_color ?? '#4A90D9') + '22', color: t.promo_color ?? '#4A90D9' }">{{ t.promo_name }}</span>
                    <span class="db-urgent-count">{{ t.depots_count }}/{{ t.students_total }}</span>
                  </div>
                  <div class="db-progress-track">
                    <div class="db-progress-fill" :class="{ 'db-progress-full': submitPct(t) === 100 }" :style="{ width: submitPct(t) + '%' }" />
                  </div>
                </div>
              </div>
            </section>

            <!-- Brouillons -->
            <section v-if="brouillons.length > 0" class="db-section">
              <div class="db-section-header">
                <h2 class="db-section-title">
                  <FileText :size="15" /> Brouillons à publier
                  <span class="db-section-badge db-badge-muted">{{ brouillons.length }}</span>
                </h2>
              </div>
              <div class="db-brouillon-list">
                <div v-for="b in brouillons.slice(0, 6)" :key="b.id" class="db-brouillon-row" @click="openDevoir(b.id)">
                  <span class="db-type-badge" :class="`type-${b.type}`">{{ typeLabels[b.type] ?? b.type }}</span>
                  <span class="db-brouillon-title">{{ b.title }}</span>
                  <span class="db-brouillon-date">{{ formatDate(b.deadline) }}</span>
                  <Eye :size="12" class="db-row-icon" />
                </div>
              </div>
            </section>

            <!-- Promotions -->
            <section class="db-section">
              <div class="db-section-header">
                <h2 class="db-section-title"><BookOpen :size="15" /> Promotions</h2>
              </div>
              <div class="db-promo-list">
                <div v-for="p in promos" :key="p.id" class="db-promo-row">
                  <span class="db-promo-dot" :style="{ background: p.color ?? '#4A90D9' }" />
                  <span class="db-promo-name">{{ p.name }}</span>
                </div>
              </div>
            </section>
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
            <LayoutDashboard :size="20" class="db-header-icon" />
            <div>
              <h1 class="db-title">Bonjour, {{ greetingName }}</h1>
              <p class="db-date">{{ today }}</p>
            </div>
          </div>
          <button class="btn-ghost db-echeancier-btn" @click="router.push('/devoirs')">
            <BookOpen :size="14" /> Voir tous mes devoirs
          </button>
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
            <span class="db-stat-value">{{ studentStats.avg ?? '—' }}</span>
            <span class="db-stat-label">Note moyenne</span>
            <TrendingUp :size="18" class="db-stat-icon" />
          </div>
        </div>

        <!-- Corps étudiant -->
        <div class="db-body">

          <!-- Colonne gauche : À rendre -->
          <section class="db-section db-section-left">
            <div class="db-section-header">
              <h2 class="db-section-title">
                <Clock :size="15" /> À rendre
                <span v-if="studentPending.length" class="db-section-badge db-badge-warning">{{ studentPending.length }}</span>
              </h2>
            </div>

            <div v-if="studentPending.length === 0 && studentEvents.length === 0" class="db-empty">
              <CheckCircle2 :size="32" class="db-empty-success" />
              <p>Aucun devoir en attente.</p>
            </div>

            <div v-else class="db-rendu-list">
              <!-- Devoirs à déposer -->
              <div
                v-for="t in studentPending"
                :key="t.id"
                class="db-rendu-row"
                @click="router.push('/devoirs')"
              >
                <div class="db-pending-urgency" :class="deadlineClass(t.deadline)" />
                <div class="db-rendu-info">
                  <div class="db-rendu-top-row">
                    <span class="db-type-badge" :class="`type-${t.type}`">{{ typeLabels[t.type] ?? t.type }}</span>
                    <span class="db-rendu-student">{{ t.title }}</span>
                  </div>
                  <span class="db-rendu-meta">
                    <span v-if="t.channel_name" class="db-rendu-channel">#{{ t.channel_name }}</span>
                  </span>
                </div>
                <div class="db-rendu-right">
                  <span class="db-deadline-badge" :class="deadlineClass(t.deadline)">
                    <Clock :size="9" />{{ deadlineLabel(t.deadline) }}
                  </span>
                  <span class="db-rendu-date">{{ formatDate(t.deadline) }}</span>
                </div>
                <ChevronRight :size="14" class="db-row-chevron" />
              </div>

              <!-- Événements (soutenance / CCTL) -->
              <div v-if="studentEvents.length > 0" class="db-events-separator">
                <span>Événements</span>
              </div>
              <div
                v-for="t in studentEvents"
                :key="`ev-${t.id}`"
                class="db-rendu-row db-event-row"
                @click="router.push('/devoirs')"
              >
                <Calendar :size="16" class="db-event-icon" />
                <div class="db-rendu-info">
                  <div class="db-rendu-top-row">
                    <span class="db-type-badge" :class="`type-${t.type}`">{{ typeLabels[t.type] ?? t.type }}</span>
                    <span class="db-rendu-student">{{ t.title }}</span>
                  </div>
                  <span v-if="t.channel_name" class="db-rendu-meta">
                    <span class="db-rendu-channel">#{{ t.channel_name }}</span>
                  </span>
                </div>
                <div class="db-rendu-right">
                  <span class="db-rendu-date">{{ formatDate(t.deadline) }}</span>
                </div>
                <ChevronRight :size="14" class="db-row-chevron" />
              </div>
            </div>
          </section>

          <!-- Colonne droite : Derniers rendus notés -->
          <div class="db-col-right">
            <section class="db-section">
              <div class="db-section-header">
                <h2 class="db-section-title">
                  <Award :size="15" /> Derniers rendus
                  <span v-if="studentStats.submitted" class="db-section-badge db-badge-accent">{{ studentStats.submitted }}</span>
                </h2>
              </div>

              <div v-if="studentSubmitted.length === 0" class="db-empty db-empty-sm">
                <p>Aucun dépôt effectué pour l'instant.</p>
              </div>

              <div v-else class="db-submitted-list">
                <div v-for="t in studentSubmitted" :key="`sub-${t.id}`" class="db-submitted-row" @click="router.push('/devoirs')">
                  <div class="db-submitted-left">
                    <span class="db-type-badge" :class="`type-${t.type}`">{{ typeLabels[t.type] ?? t.type }}</span>
                    <div class="db-submitted-info">
                      <span class="db-submitted-title">{{ t.title }}</span>
                      <span v-if="t.channel_name" class="db-submitted-channel">#{{ t.channel_name }}</span>
                    </div>
                  </div>
                  <div class="db-submitted-right">
                    <span v-if="t.note" class="db-grade-badge" :class="gradeColorClass(t.note)">{{ t.note }}</span>
                    <span v-else class="db-grade-pending">En attente</span>
                  </div>
                </div>

                <!-- Feedback du dernier rendu noté -->
                <div v-if="firstFeedback" class="db-feedback-row">
                  <span class="db-feedback-label">Retour · {{ firstFeedback.title }}</span>
                  <p class="db-feedback-text">« {{ firstFeedback.feedback }} »</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </template>
    </template>

  </div>
</template>

<style scoped>
/* ── Projets ── */
.db-projects-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.db-see-all-btn {
  font-size: 11px;
  padding: 4px 10px;
  color: var(--text-muted);
}
.db-project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}
.db-project-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-sidebar);
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.db-project-card:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
}
.db-project-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
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
  gap: 2px;
}
.db-project-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.db-project-stats {
  font-size: 11px;
  color: var(--text-muted);
}
.db-project-next {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 600;
}
.db-project-next.deadline-ok     { color: var(--color-success); }
.db-project-next.deadline-warning { color: #F39C12; }
.db-project-next.deadline-soon    { color: var(--color-warning); }
.db-project-next.deadline-critical,
.db-project-next.deadline-passed  { color: var(--color-danger); }
.db-project-chevron { color: var(--text-muted); flex-shrink: 0; }

/* ── Shell ── */
.dashboard-shell {
  flex: 1;
  overflow-y: auto;
  padding: 28px 32px 40px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-height: 0;
}

/* ── Chargement ── */
.db-loading { display: flex; flex-direction: column; gap: 14px; padding: 32px 0; }
.db-skel-card { height: 76px; border-radius: 10px; flex-shrink: 0; }
.db-skel-content { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }

/* ── En-tête ── */
.db-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.db-header-left { display: flex; align-items: center; gap: 12px; }
.db-header-icon { color: var(--accent); }
.db-title { font-size: 20px; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
.db-date  { font-size: 12px; color: var(--text-muted); margin-top: 2px; text-transform: capitalize; }
.db-echeancier-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 6px 12px; flex-shrink: 0; }

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

.db-stat-danger  { border-color: rgba(231,76,60,.2);  }
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

/* ── Corps ── */
.db-body {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 20px;
  align-items: start;
  min-width: 0;
}
@media (max-width: 1000px) { .db-body { grid-template-columns: 1fr; } }
.db-col-right { display: flex; flex-direction: column; gap: 16px; min-width: 0; }

/* ── Sections ── */
.db-section {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}
.db-section-header { padding: 12px 16px 10px; border-bottom: 1px solid var(--border); }
.db-section-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-secondary);
}
.db-section-badge { font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 8px; }
.db-badge-danger  { background: rgba(231,76,60,.15);  color: #ff7b6b; }
.db-badge-warning { background: rgba(243,156,18,.15); color: var(--color-warning); }
.db-badge-muted   { background: rgba(255,255,255,.07); color: var(--text-muted); }
.db-badge-accent  { background: rgba(74,144,217,.15); color: var(--accent-light); }

/* ── Empty ── */
.db-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 13px;
}
.db-empty-sm { padding: 20px 16px; }
.db-empty-success { opacity: .5; color: var(--color-success); }

/* ── Liste commune ── */
.db-rendu-list { display: flex; flex-direction: column; }
.db-rendu-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background var(--t-fast);
}
.db-rendu-row:last-child { border-bottom: none; }
.db-rendu-row:hover { background: var(--bg-hover); }

/* Avatar (prof) */
.db-avatar {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
}

/* Indicateur d'urgence (étudiant) */
.db-pending-urgency {
  width: 4px;
  height: 32px;
  border-radius: 2px;
  flex-shrink: 0;
}
.db-pending-urgency.deadline-passed,
.db-pending-urgency.deadline-critical { background: var(--color-danger); }
.db-pending-urgency.deadline-soon     { background: var(--color-warning); }
.db-pending-urgency.deadline-warning  { background: #F39C12; }
.db-pending-urgency.deadline-ok       { background: var(--color-success); }

.db-rendu-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.db-rendu-top-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.db-rendu-student {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.db-rendu-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--text-muted);
}
.db-rendu-devoir { overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
.db-rendu-sep    { flex-shrink: 0; }
.db-rendu-channel { flex-shrink: 0; }

.db-rendu-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
  flex-shrink: 0;
}
.db-rendu-date { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
.db-row-chevron { color: var(--text-muted); flex-shrink: 0; transition: transform var(--t-fast); }
.db-rendu-row:hover .db-row-chevron { transform: translateX(2px); color: var(--accent); }

.db-more-link {
  padding: 10px 16px;
  font-size: 12px;
  color: var(--accent);
  cursor: pointer;
  text-align: center;
  transition: background var(--t-fast);
}
.db-more-link:hover { background: var(--bg-hover); }

/* ── Séparateur Événements ── */
.db-events-separator {
  padding: 6px 16px;
  background: rgba(155,135,245,.07);
  border-bottom: 1px solid var(--border);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: #9b87f5;
}
.db-event-row { background: rgba(155,135,245,.04); }
.db-event-icon { color: #9b87f5; flex-shrink: 0; }

/* ── Devoirs urgents (prof) ── */
.db-urgent-list { display: flex; flex-direction: column; }
.db-urgent-row {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background var(--t-fast);
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.db-urgent-row:last-child { border-bottom: none; }
.db-urgent-row:hover { background: var(--bg-hover); }
.db-urgent-top { display: flex; align-items: center; gap: 6px; }
.db-urgent-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.db-urgent-sub { display: flex; align-items: center; gap: 6px; font-size: 11px; }
.db-urgent-channel { color: var(--text-muted); }
.db-urgent-count { margin-left: auto; font-size: 11px; font-weight: 700; color: var(--text-secondary); flex-shrink: 0; }

.db-progress-track { height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
.db-progress-fill  { height: 100%; background: var(--accent); border-radius: 2px; transition: width .3s ease; }
.db-progress-fill.db-progress-full { background: var(--color-success); }

/* ── Brouillons ── */
.db-brouillon-list { display: flex; flex-direction: column; }
.db-brouillon-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background var(--t-fast);
}
.db-brouillon-row:last-child { border-bottom: none; }
.db-brouillon-row:hover { background: var(--bg-hover); }
.db-brouillon-title { flex: 1; font-size: 12.5px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.db-brouillon-date  { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.db-row-icon { color: var(--text-muted); flex-shrink: 0; }

/* ── Promos ── */
.db-promo-list { display: flex; flex-direction: column; padding: 8px 0; }
.db-promo-row { display: flex; align-items: center; gap: 10px; padding: 7px 16px; }
.db-promo-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.db-promo-name { font-size: 13px; color: var(--text-primary); font-weight: 500; }

/* ── Rendus étudiant ── */
.db-submitted-list { display: flex; flex-direction: column; }
.db-submitted-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background var(--t-fast);
}
.db-submitted-row:last-child { border-bottom: none; }
.db-submitted-row:hover { background: var(--bg-hover); }
.db-submitted-left { display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
.db-submitted-info { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.db-submitted-title { font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-submitted-channel { font-size: 11px; color: var(--text-muted); }
.db-submitted-right { flex-shrink: 0; }

.db-grade-badge {
  font-size: 13px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 6px;
}
.grade-a { color: var(--color-success);  background: rgba(39,174,96,.12); }
.grade-b { color: #27AE60;               background: rgba(39,174,96,.08); }
.grade-c { color: var(--color-warning);  background: rgba(243,156,18,.12); }
.grade-d { color: var(--color-danger);   background: rgba(231,76,60,.12); }
.grade-na { color: var(--text-muted);    background: rgba(255,255,255,.06); }

.db-grade-pending {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}

/* Feedback bloc */
.db-feedback-row {
  padding: 10px 14px 12px;
  background: rgba(155,135,245,.06);
  border-top: 1px solid rgba(155,135,245,.1);
}
.db-feedback-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: #9b87f5; margin-bottom: 4px; }
.db-feedback-text  { font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; font-style: italic; }

/* ── Badges communs ── */
.db-type-badge {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .4px;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  white-space: nowrap;
}
.type-livrable     { background: rgba(74,144,217,.2);   color: var(--accent); }
.type-soutenance   { background: rgba(243,156,18,.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: #9b87f5; }
.type-etude_de_cas { background: rgba(39,174,96,.2);    color: var(--color-success); }
.type-memoire      { background: rgba(231,76,60,.2);    color: #e74c3c; }
.type-autre        { background: rgba(127,140,141,.2);  color: #95a5a6; }

.db-deadline-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 8px;
  flex-shrink: 0;
  white-space: nowrap;
}
.db-deadline-badge.deadline-passed,
.db-deadline-badge.deadline-critical { background: rgba(231,76,60,.12); color: #ff7b6b; }
.db-deadline-badge.deadline-soon     { background: rgba(243,156,18,.12); color: var(--color-warning); }
.db-deadline-badge.deadline-warning  { background: rgba(243,156,18,.08); color: #F39C12; }
.db-deadline-badge.deadline-ok       { background: rgba(39,174,96,.10); color: var(--color-success); }

.db-promo-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  flex-shrink: 0;
  white-space: nowrap;
}
</style>
