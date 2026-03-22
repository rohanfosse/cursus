/**
 * StudentBento.vue
 * ---------------------------------------------------------------------------
 * Bento-box dashboard for the student accueil tab.
 * CSS Grid layout (4 columns) with adaptive Focus widget, stat tiles,
 * this-week strip, feedback cards, quick actions, and grade distribution.
 */
<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Clock, CheckCircle, Award, BarChart2, AlertTriangle,
  Smile, CalendarDays, BookOpen, ChevronRight, ArrowRight, Radio, Hash,
} from 'lucide-vue-next'
import { useLiveStore } from '@/stores/live'
import { useAppStore } from '@/stores/app'
import { deadlineLabel } from '@/utils/date'
import type { StudentProjectCard } from '@/composables/useDashboardStudent'

const router = useRouter()
const liveStore = useLiveStore()
const appStore = useAppStore()

const props = defineProps<{
  studentStats: { pending: number; submitted: number; graded: number; modeGrade: string | null }
  urgentActions: { id: number; title: string; isOverdue: boolean; urgency: string; category?: string | null; deadline?: string }[]
  recentGrades: { title: string; note: string; category?: string | null }[]
  recentFeedback?: { title: string; feedback: string; note: string | null; category: string | null }[]
  studentProjectCards: StudentProjectCard[]
  hasDevoirsLoaded: boolean
}>()

const emit = defineEmits<{
  navigateDevoirs: []
  openStudentTimeline: []
  goToProject: [key: string]
}>()

// ── Focus widget logic ────────────────────────────────────────────────────────
type FocusState = { mode: 'overdue' | 'today' | 'soon' | 'grade' | 'ok'; color: string; title: string; subtitle: string; action: string; actionCb: () => void }

const focus = computed<FocusState>(() => {
  const overdue = props.urgentActions.filter(a => a.isOverdue)
  if (overdue.length) {
    return {
      mode: 'overdue', color: 'var(--color-danger)',
      title: `${overdue.length} devoir${overdue.length > 1 ? 's' : ''} en retard`,
      subtitle: overdue.map(a => a.title).join(', '),
      action: 'Voir les devoirs',
      actionCb: () => emit('navigateDevoirs'),
    }
  }

  const now = Date.now()
  const within24h = props.urgentActions.filter(a => {
    if (!a.deadline) return false
    const diff = new Date(a.deadline).getTime() - now
    return diff > 0 && diff < 86_400_000
  })
  if (within24h.length) {
    return {
      mode: 'today', color: 'var(--color-warning)',
      title: `${within24h[0].title} a rendre aujourd'hui`,
      subtitle: within24h.length > 1 ? `+ ${within24h.length - 1} autre(s)` : '',
      action: 'Voir le devoir',
      actionCb: () => emit('goToProject', within24h[0].category ?? ''),
    }
  }

  const within3d = props.urgentActions.filter(a => {
    if (!a.deadline) return false
    const diff = new Date(a.deadline).getTime() - now
    return diff > 0 && diff < 3 * 86_400_000
  })
  if (within3d.length) {
    const days = Math.ceil((new Date(within3d[0].deadline!).getTime() - now) / 86_400_000)
    return {
      mode: 'soon', color: 'var(--color-warning-soft, #f0c040)',
      title: `${within3d[0].title} dans ${days}j`,
      subtitle: within3d.length > 1 ? `+ ${within3d.length - 1} autre(s)` : '',
      action: 'Preparer',
      actionCb: () => emit('goToProject', within3d[0].category ?? ''),
    }
  }

  if (props.recentGrades.length) {
    const latest = props.recentGrades[0]
    return {
      mode: 'grade', color: 'var(--color-success)',
      title: `Tu as eu ${latest.note} au ${latest.title}`,
      subtitle: '',
      action: 'Voir le detail',
      actionCb: () => emit('goToProject', (latest as { category?: string | null }).category ?? ''),
    }
  }

  return {
    mode: 'ok', color: 'var(--color-success)',
    title: 'Tout est a jour, bravo !',
    subtitle: '',
    action: '',
    actionCb: () => {},
  }
})

// ── This week strip ───────────────────────────────────────────────────────────
const thisWeekItems = computed(() => {
  const now = Date.now()
  const weekEnd = now + 7 * 86_400_000
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
  const items: { day: string; title: string; type: string; past: boolean }[] = []

  for (const ua of props.urgentActions) {
    if (!ua.deadline) continue
    const dl = new Date(ua.deadline).getTime()
    if (dl > weekEnd) continue
    const date = new Date(ua.deadline)
    items.push({
      day: dayNames[date.getDay()],
      title: ua.title,
      type: ua.isOverdue ? 'overdue' : 'devoir',
      past: dl < now,
    })
  }

  return items.sort((a, b) => {
    if (a.past !== b.past) return a.past ? 1 : -1
    return 0
  }).slice(0, 5)
})

// ── Grade distribution ────────────────────────────────────────────────────────
const gradeDistribution = computed(() => {
  const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
  for (const g of props.recentGrades) {
    const key = g.note.toUpperCase()
    if (key in counts) counts[key]++
  }
  const max = Math.max(1, ...Object.values(counts))
  return [
    { label: 'A', count: counts.A, pct: (counts.A / max) * 100, cls: 'grade-a' },
    { label: 'B', count: counts.B, pct: (counts.B / max) * 100, cls: 'grade-b' },
    { label: 'C', count: counts.C, pct: (counts.C / max) * 100, cls: 'grade-c' },
    { label: 'D', count: counts.D, pct: (counts.D / max) * 100, cls: 'grade-d' },
  ]
})

// ── Live session check ──────────────────────────────────────────────────────
const hasLiveSession = computed(() => !!liveStore.currentSession && liveStore.currentSession.status === 'active')
const liveSessionTitle = computed(() => liveStore.currentSession?.title ?? '')

onMounted(() => {
  const promoId = appStore.activePromoId
  if (promoId) liveStore.fetchActiveForPromo(promoId)
})

// ── Recent channels (raccourcis) ────────────────────────────────────────────
const recentChannels = ref<{ id: number; name: string }[]>([])
onMounted(() => {
  try {
    const raw = localStorage.getItem('cc_recent_channels')
    if (raw) recentChannels.value = (JSON.parse(raw) as { id: number; name: string }[]).slice(0, 3)
  } catch { /* ignore */ }
})

// ── Top project cards ───────────────────────────────────────────────────────
const topProjects = computed(() => props.studentProjectCards.slice(0, 4))
</script>

<template>
  <div class="bento-grid">
    <!-- FOCUS 2x2 -->
    <div class="bento-tile bento-focus" :style="{ '--focus-color': focus.color }">
      <div class="bento-focus-inner">
        <AlertTriangle v-if="focus.mode === 'overdue'" :size="28" class="bento-focus-icon" />
        <Clock v-else-if="focus.mode === 'today' || focus.mode === 'soon'" :size="28" class="bento-focus-icon" />
        <Award v-else-if="focus.mode === 'grade'" :size="28" class="bento-focus-icon" />
        <Smile v-else :size="28" class="bento-focus-icon" />
        <h2 class="bento-focus-title">{{ focus.title }}</h2>
        <p v-if="focus.subtitle" class="bento-focus-sub">{{ focus.subtitle }}</p>
        <button v-if="focus.action" class="bento-focus-btn" @click="focus.actionCb">
          {{ focus.action }} <ArrowRight :size="13" />
        </button>
      </div>
    </div>

    <!-- STAT: A rendre -->
    <div class="bento-tile bento-stat" :class="{ 'bento-stat--warn': studentStats.pending > 0 }">
      <Clock :size="18" class="bento-stat-icon" />
      <span class="bento-stat-value">{{ studentStats.pending }}</span>
      <span class="bento-stat-label">A rendre</span>
    </div>

    <!-- STAT: Rendus -->
    <div class="bento-tile bento-stat bento-stat--accent">
      <CheckCircle :size="18" class="bento-stat-icon" />
      <span class="bento-stat-value">{{ studentStats.submitted }}</span>
      <span class="bento-stat-label">Rendus</span>
    </div>

    <!-- STAT: Moyenne -->
    <div class="bento-tile bento-stat">
      <Award :size="18" class="bento-stat-icon" />
      <span class="bento-stat-value">{{ studentStats.modeGrade ?? '-' }}</span>
      <span class="bento-stat-label">Moyenne</span>
    </div>

    <!-- STAT: Notes -->
    <div class="bento-tile bento-stat bento-stat--success">
      <BarChart2 :size="18" class="bento-stat-icon" />
      <span class="bento-stat-value">{{ studentStats.graded }}</span>
      <span class="bento-stat-label">Notes</span>
    </div>

    <!-- LIVE QUIZ 1x1 -->
    <div class="bento-tile bento-live" :class="{ 'bento-live--active': hasLiveSession }" @click="hasLiveSession && router.push('/live')">
      <Radio :size="18" class="bento-live-icon" />
      <template v-if="hasLiveSession">
        <span class="bento-live-dot" />
        <span class="bento-live-title">{{ liveSessionTitle }}</span>
        <button class="bento-live-join" @click.stop="router.push('/live')">Rejoindre</button>
      </template>
      <span v-else class="bento-live-empty">Aucune session en cours</span>
    </div>

    <!-- CETTE SEMAINE 2x1 -->
    <div class="bento-tile bento-week">
      <h3 class="bento-section-title"><CalendarDays :size="13" /> Cette semaine</h3>
      <div v-if="thisWeekItems.length" class="bento-week-list">
        <div v-for="(item, i) in thisWeekItems" :key="i" class="bento-week-item" :class="{ 'bento-week-item--past': item.past }">
          <span class="bento-week-day">{{ item.day }}</span>
          <span class="bento-week-badge" :class="'bento-badge--' + item.type">{{ item.type === 'overdue' ? 'retard' : 'devoir' }}</span>
          <span class="bento-week-title">{{ item.title }}</span>
        </div>
      </div>
      <p v-else class="bento-empty">Rien cette semaine</p>
    </div>

    <!-- FEEDBACKS 2x1 -->
    <div class="bento-tile bento-feedback">
      <h3 class="bento-section-title"><Award :size="13" /> Feedbacks</h3>
      <div v-if="recentFeedback?.length" class="bento-feedback-list">
        <div
          v-for="f in recentFeedback.slice(0, 3)"
          :key="f.title"
          class="bento-feedback-card"
          :class="{ 'bento-feedback-clickable': !!f.category }"
          @click="f.category && emit('goToProject', f.category)"
        >
          <div class="bento-feedback-top">
            <span class="bento-feedback-title">{{ f.title }}</span>
            <span v-if="f.note" class="db-grade-badge" :class="'grade-' + f.note.toLowerCase()">{{ f.note }}</span>
          </div>
          <p class="bento-feedback-text">{{ f.feedback }}</p>
        </div>
      </div>
      <p v-else class="bento-empty">Aucun feedback pour le moment</p>
    </div>

    <!-- QUICK: Mes devoirs -->
    <div class="bento-tile bento-action" @click="emit('navigateDevoirs')">
      <BookOpen :size="20" class="bento-action-icon" />
      <span class="bento-action-label">Mes devoirs</span>
      <ChevronRight :size="14" class="bento-action-chevron" />
    </div>

    <!-- QUICK: Ma timeline -->
    <div class="bento-tile bento-action" @click="emit('openStudentTimeline')">
      <CalendarDays :size="20" class="bento-action-icon" />
      <span class="bento-action-label">Ma timeline</span>
      <ChevronRight :size="14" class="bento-action-chevron" />
    </div>

    <!-- MES NOTES 2x1 -->
    <div class="bento-tile bento-grades">
      <h3 class="bento-section-title"><BarChart2 :size="13" /> Mes notes</h3>
      <div class="bento-grade-bars">
        <div v-for="g in gradeDistribution" :key="g.label" class="bento-grade-row">
          <span class="bento-grade-label" :class="g.cls">{{ g.label }}</span>
          <div class="bento-grade-track">
            <div class="bento-grade-fill" :class="g.cls" :style="{ width: g.pct + '%' }" />
          </div>
          <span class="bento-grade-count">{{ g.count }}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- PROJETS section -->
  <div v-if="topProjects.length" class="bento-extra-section">
    <h3 class="bento-section-title"><BookOpen :size="13" /> Mes projets</h3>
    <div class="bento-projects-row">
      <div
        v-for="p in topProjects"
        :key="p.key"
        class="bento-project-card"
        @click="emit('goToProject', p.key)"
      >
        <span class="bento-project-name">{{ p.label }}</span>
        <div class="bento-project-bar-wrap">
          <div class="bento-project-bar">
            <div class="bento-project-bar-fill" :style="{ width: (p.total > 0 ? Math.round(p.submitted / p.total * 100) : 0) + '%' }" />
          </div>
          <span class="bento-project-pct">{{ p.total > 0 ? Math.round(p.submitted / p.total * 100) : 0 }}%</span>
        </div>
        <span v-if="p.nextDeadline" class="bento-project-deadline">{{ deadlineLabel(p.nextDeadline) }}</span>
        <span v-else class="bento-project-deadline">Aucune échéance</span>
      </div>
    </div>
  </div>

  <!-- RACCOURCIS section -->
  <div v-if="recentChannels.length" class="bento-extra-section">
    <h3 class="bento-section-title"><Hash :size="13" /> Raccourcis</h3>
    <div class="bento-shortcuts-row">
      <div
        v-for="ch in recentChannels"
        :key="ch.id"
        class="bento-shortcut-card"
        @click="router.push('/messages')"
      >
        <span class="bento-shortcut-name"># {{ ch.name }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Bento Grid ── */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

/* ── Base tile ── */
.bento-tile {
  background: var(--bg-elevated, rgba(255,255,255,.03));
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  min-height: 0;
}

/* ── FOCUS (2x2) ── */
.bento-focus {
  grid-column: span 2;
  grid-row: span 2;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--focus-color, var(--accent)) 8%, var(--bg-elevated, rgba(255,255,255,.03)));
  border-color: color-mix(in srgb, var(--focus-color, var(--accent)) 25%, transparent);
}
.bento-focus-inner { text-align: center; }
.bento-focus-icon { color: var(--focus-color); margin-bottom: 10px; }
.bento-focus-title { font-size: 17px; font-weight: 800; color: var(--text-primary); line-height: 1.3; margin: 0 0 4px; }
.bento-focus-sub { font-size: 12px; color: var(--text-muted); margin: 0 0 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; margin-inline: auto; }
.bento-focus-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; border: none; border-radius: 8px;
  font-size: 13px; font-weight: 600; cursor: pointer;
  background: var(--focus-color); color: #fff;
  font-family: var(--font); transition: filter .15s;
}
.bento-focus-btn:hover { filter: brightness(1.1); }

/* ── Stat tiles (1x1) ── */
.bento-stat {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; position: relative; text-align: center;
}
.bento-stat-icon { color: var(--text-muted); opacity: .4; margin-bottom: 4px; }
.bento-stat-value { font-size: 26px; font-weight: 800; color: var(--text-primary); line-height: 1; }
.bento-stat-label { font-size: 11px; color: var(--text-secondary); }
.bento-stat--warn { border-color: rgba(243,156,18,.25); }
.bento-stat--warn .bento-stat-value { color: var(--color-warning); }
.bento-stat--warn .bento-stat-icon { color: var(--color-warning); opacity: .5; }
.bento-stat--accent .bento-stat-value { color: var(--accent-light, var(--accent)); }
.bento-stat--accent .bento-stat-icon { color: var(--accent); opacity: .5; }
.bento-stat--success { border-color: rgba(39,174,96,.2); }
.bento-stat--success .bento-stat-value { color: var(--color-success); }
.bento-stat--success .bento-stat-icon { color: var(--color-success); opacity: .5; }

/* ── This week (2x1) ── */
.bento-week { grid-column: span 2; }
.bento-section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .5px; margin: 0 0 10px;
}
.bento-week-list { display: flex; flex-direction: column; gap: 4px; }
.bento-week-item {
  display: flex; align-items: center; gap: 8px;
  font-size: 12.5px; color: var(--text-primary);
  padding: 4px 0; transition: opacity .15s;
}
.bento-week-item--past { opacity: .4; }
.bento-week-day { font-size: 10px; font-weight: 700; color: var(--text-muted); width: 28px; flex-shrink: 0; }
.bento-week-badge {
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px;
  padding: 2px 6px; border-radius: 4px; flex-shrink: 0;
}
.bento-badge--devoir { background: rgba(74,144,217,.12); color: var(--accent); }
.bento-badge--overdue { background: rgba(231,76,60,.12); color: var(--color-danger); }
.bento-week-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ── Feedback (2x1) ── */
.bento-feedback { grid-column: span 2; }
.bento-feedback-list { display: flex; gap: 8px; flex-wrap: wrap; }
.bento-feedback-card {
  display: flex; flex-direction: column; gap: 4px;
  padding: 8px 10px; border-radius: 8px;
  background: rgba(255,255,255,.02); border: 1px solid var(--border);
  min-width: 140px; max-width: 200px; flex: 1;
}
.bento-feedback-clickable { cursor: pointer; transition: background var(--t-fast); }
.bento-feedback-clickable:hover { background: var(--bg-hover); }
.bento-feedback-top { display: flex; align-items: center; gap: 6px; }
.bento-feedback-title {
  flex: 1; font-size: 12px; font-weight: 600; color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.bento-feedback-text {
  font-size: 11px; color: var(--text-secondary); font-style: italic;
  margin: 0; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

/* ── Quick actions (1x1) ── */
.bento-action {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; cursor: pointer; transition: background .15s;
}
.bento-action:hover { background: var(--bg-hover); }
.bento-action-icon { color: var(--accent); }
.bento-action-label { font-size: 12.5px; font-weight: 600; color: var(--text-primary); }
.bento-action-chevron { color: var(--text-muted); opacity: .4; }

/* ── Grade distribution (2x1) ── */
.bento-grades { grid-column: span 2; }
.bento-grade-bars { display: flex; flex-direction: column; gap: 6px; }
.bento-grade-row { display: flex; align-items: center; gap: 8px; }
.bento-grade-label {
  font-size: 12px; font-weight: 800; width: 20px; text-align: center;
  padding: 2px 0; border-radius: 4px;
}
.bento-grade-label.grade-a { color: var(--color-success); }
.bento-grade-label.grade-b { color: var(--accent); }
.bento-grade-label.grade-c { color: var(--color-warning); }
.bento-grade-label.grade-d { color: var(--color-danger); }
.bento-grade-track {
  flex: 1; height: 8px; border-radius: 4px;
  background: rgba(255,255,255,.05);
}
.bento-grade-fill {
  height: 100%; border-radius: 4px;
  transition: width .3s ease;
}
.bento-grade-fill.grade-a { background: var(--color-success); }
.bento-grade-fill.grade-b { background: var(--accent); }
.bento-grade-fill.grade-c { background: var(--color-warning); }
.bento-grade-fill.grade-d { background: var(--color-danger); }
.bento-grade-count { font-size: 11px; font-weight: 600; color: var(--text-muted); width: 16px; text-align: right; }

/* ── Grade badge (reused) ── */
.db-grade-badge { font-size: 11px; font-weight: 800; padding: 2px 7px; border-radius: 5px; }
.db-grade-badge.grade-a { background: rgba(39,174,96,.15); color: var(--color-success); }
.db-grade-badge.grade-b { background: rgba(74,144,217,.15); color: var(--accent); }
.db-grade-badge.grade-c { background: rgba(243,156,18,.12); color: var(--color-warning); }
.db-grade-badge.grade-d { background: rgba(231,76,60,.12); color: var(--color-danger); }

/* ── Live tile (1x1) ── */
.bento-live {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; text-align: center; position: relative;
}
.bento-live--active { cursor: pointer; border-color: rgba(231,76,60,.3); }
.bento-live--active:hover { background: var(--bg-hover); }
.bento-live-icon { color: var(--text-muted); opacity: .5; }
.bento-live--active .bento-live-icon { color: var(--color-danger); opacity: 1; }
.bento-live-dot {
  width: 8px; height: 8px; border-radius: 50%; background: var(--color-danger);
  animation: live-pulse 1.5s ease-in-out infinite;
}
@keyframes live-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .5; transform: scale(1.3); } }
.bento-live-title { font-size: 11px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px; }
.bento-live-join {
  font-size: 11px; font-weight: 700; padding: 4px 12px; border: none; border-radius: 6px;
  background: var(--color-danger); color: #fff; cursor: pointer; font-family: var(--font);
  transition: filter .15s;
}
.bento-live-join:hover { filter: brightness(1.15); }
.bento-live-empty { font-size: 11px; color: var(--text-muted); font-style: italic; }

/* ── Extra sections (below bento grid) ── */
.bento-extra-section { margin-top: 20px; }
.bento-projects-row { display: flex; gap: 12px; overflow-x: auto; }
.bento-project-card {
  flex: 1; min-width: 160px; max-width: 240px;
  background: var(--bg-elevated, rgba(255,255,255,.03));
  border: 1px solid var(--border); border-radius: 12px;
  padding: 14px; cursor: pointer; transition: background .15s;
  display: flex; flex-direction: column; gap: 6px;
}
.bento-project-card:hover { background: var(--bg-hover); }
.bento-project-name { font-size: 13px; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bento-project-bar-wrap { display: flex; align-items: center; gap: 8px; }
.bento-project-bar { flex: 1; height: 6px; border-radius: 3px; background: rgba(255,255,255,.06); }
.bento-project-bar-fill { height: 100%; border-radius: 3px; background: var(--accent); transition: width .3s ease; }
.bento-project-pct { font-size: 10px; font-weight: 700; color: var(--text-muted); }
.bento-project-deadline { font-size: 11px; color: var(--text-secondary); }

.bento-shortcuts-row { display: flex; gap: 10px; }
.bento-shortcut-card {
  flex: 1; min-width: 120px;
  background: var(--bg-elevated, rgba(255,255,255,.03));
  border: 1px solid var(--border); border-radius: 10px;
  padding: 12px; cursor: pointer; transition: background .15s;
}
.bento-shortcut-card:hover { background: var(--bg-hover); }
.bento-shortcut-name { font-size: 12.5px; font-weight: 600; color: var(--text-primary); }

/* ── Empty state ── */
.bento-empty { font-size: 12px; color: var(--text-muted); margin: 0; font-style: italic; }

/* ── Responsive ── */
@media (max-width: 768px) {
  .bento-grid { grid-template-columns: repeat(2, 1fr); }
  .bento-focus { grid-column: span 2; grid-row: span 1; }
  .bento-grades { grid-column: span 2; }
}
@media (max-width: 480px) {
  .bento-grid { grid-template-columns: 1fr; }
  .bento-focus, .bento-week, .bento-feedback, .bento-grades { grid-column: span 1; }
  .bento-focus { grid-row: span 1; }
}
</style>
