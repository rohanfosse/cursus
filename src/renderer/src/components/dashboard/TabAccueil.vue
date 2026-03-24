/**
 * TabAccueil.vue
 * ---------------------------------------------------------------------------
 * Bento-Box + Task-Driven hybrid layout for the teacher dashboard Accueil tab.
 * Uses CSS Grid with tiles of varying sizes to create visual hierarchy:
 *   Focus (2x2) | 4 stat tiles (1x1) | Schedule strip (2x1) |
 *   Messages (1x1) | Quick actions (2x1) | Activity feed (2x1)
 */
<script setup lang="ts">
import { computed } from 'vue'
import TeacherTodoWidget from './TeacherTodoWidget.vue'
import {
  Edit3, Clock, FileText, CheckCircle2,
  PlusCircle, Bell, BarChart2, MessageSquare, ChevronRight,
  Percent, Wifi, Award,
  Mic,
} from 'lucide-vue-next'
import { avatarColor, gradeClass } from '@/utils/format'
import { relativeTime } from '@/utils/date'
import type { ProjectCard, GanttRow } from '@/composables/useDashboardTeacher'
import type { AgendaItem } from '@/composables/useDashboardWidgets'
import type { Depot } from '@/types'

const props = defineProps<{
  // Stats
  aNoterCount: number
  submissionRate: number
  onlineStudents: number
  brouillonsCount: number

  // Action center data for focus tile
  actionItems: { id: string; type: string; title: string; subtitle: string; urgency: string; action: () => void }[]

  // Global mode grade (letter grade average)
  globalModeGrade: string | null

  // Schedule (next 48h agenda items)
  next48h: AgendaItem[]

  // Messages
  unreadDmEntries: { name: string; count: number }[]
  totalUnreadDms: number

  // Forgotten drafts (for focus tile)
  forgottenDrafts: GanttRow[]

  // Projects & rendus
  projectCards: ProjectCard[]
  recentRendus: Depot[]
}>()

const emit = defineEmits<{
  goToProject: [key: string]
  openNewDevoir: []
  openDmFromDashboard: [name: string]
  publishDraft: [id: number]
  switchToFrise: []
  openActiveDevoir: []
}>()

// ── Focus tile logic ──────────────────────────────────────────────────────────

type FocusState = {
  type: 'grade' | 'deadline' | 'draft' | 'clear'
  urgency: 'critical' | 'warning' | 'normal' | 'clear'
  title: string
  subtitle: string
  actionLabel: string
  action: (() => void) | null
}

const focusState = computed((): FocusState => {
  // 1. Ungraded submissions
  if (props.aNoterCount > 0) {
    const gradeAction = props.actionItems.find(a => a.type === 'grade')
    return {
      type: 'grade',
      urgency: props.aNoterCount >= 10 ? 'critical' : 'warning',
      title: `${props.aNoterCount} rendu${props.aNoterCount > 1 ? 's' : ''} a noter`,
      subtitle: gradeAction?.subtitle ?? 'Des travaux attendent votre evaluation',
      actionLabel: 'Corriger',
      action: gradeAction?.action ?? null,
    }
  }

  // 2. Deadline within 24h
  const deadlineAction = props.actionItems.find(a => a.type === 'deadline')
  if (deadlineAction) {
    return {
      type: 'deadline',
      urgency: deadlineAction.urgency === 'critical' ? 'critical' : 'warning',
      title: deadlineAction.title,
      subtitle: deadlineAction.subtitle,
      actionLabel: 'Rappeler',
      action: deadlineAction.action,
    }
  }

  // 3. Forgotten drafts
  if (props.forgottenDrafts.length > 0) {
    return {
      type: 'draft',
      urgency: 'normal',
      title: `${props.forgottenDrafts.length} brouillon${props.forgottenDrafts.length > 1 ? 's' : ''} non publie${props.forgottenDrafts.length > 1 ? 's' : ''}`,
      subtitle: 'Des devoirs attendent d\'etre publies',
      actionLabel: 'Publier',
      action: props.forgottenDrafts.length === 1
        ? () => emit('publishDraft', props.forgottenDrafts[0].id)
        : null,
    }
  }

  // 4. All clear
  return {
    type: 'clear',
    urgency: 'clear',
    title: 'Tout est a jour',
    subtitle: 'Aucune action urgente requise',
    actionLabel: '',
    action: null,
  }
})

const focusBgClass = computed(() => {
  switch (focusState.value.urgency) {
    case 'critical': return 'focus--critical'
    case 'warning':  return 'focus--warning'
    case 'normal':   return 'focus--normal'
    case 'clear':    return 'focus--clear'
    default:         return 'focus--normal'
  }
})

// ── Schedule: filter to today only ────────────────────────────────────────────

const todayEvents = computed(() => {
  const todayStr = new Date().toDateString()
  return props.next48h.filter(item => new Date(item.time).toDateString() === todayStr)
})

const isPastEvent = (time: string) => new Date(time).getTime() < Date.now()

const isCurrentEvent = (time: string, index: number) => {
  const t = new Date(time).getTime()
  const now = Date.now()
  if (t > now) {
    // First future event is "current"
    return index === todayEvents.value.findIndex(e => new Date(e.time).getTime() > now)
  }
  return false
}

// ── Activity feed: group recent rendus by devoir ─────────────────────────────

interface ActivityGroup {
  id: string
  type: 'rendus' | 'message'
  label: string
  count: number
  timeAgo: string
}

const activityFeed = computed((): ActivityGroup[] => {
  const groups = new Map<number, { title: string; count: number; latest: number }>()
  for (const r of props.recentRendus) {
    const existing = groups.get(r.travail_id)
    const ts = new Date(r.submitted_at ?? 0).getTime()
    if (existing) {
      existing.count++
      existing.latest = Math.max(existing.latest, ts)
    } else {
      groups.set(r.travail_id, {
        title: r.travail_title ?? `Devoir #${r.travail_id}`,
        count: 1,
        latest: ts,
      })
    }
  }

  const items: ActivityGroup[] = []
  for (const [id, g] of groups) {
    items.push({
      id: `rendus-${id}`,
      type: 'rendus',
      label: `${g.count} rendu${g.count > 1 ? 's' : ''} pour ${g.title}`,
      count: g.count,
      timeAgo: relativeTime(g.latest),
    })
  }
  return items.sort((a, b) => items.indexOf(a) - items.indexOf(b)).slice(0, 5)
})

// relativeTime imported from @/utils/date

// ── Stat: average grade letter ────────────────────────────────────────────────

const averageGrade = computed(() => props.globalModeGrade ?? '--')
</script>

<template>
  <div class="bento-grid">

    <!-- ═══ FOCUS TILE (2x2) ═══ -->
    <div class="dashboard-card bento-tile bento-focus" :class="focusBgClass">
      <div class="focus-icon">
        <Edit3 v-if="focusState.type === 'grade'" :size="28" />
        <Clock v-else-if="focusState.type === 'deadline'" :size="28" />
        <FileText v-else-if="focusState.type === 'draft'" :size="28" />
        <CheckCircle2 v-else :size="28" />
      </div>
      <h2 class="focus-title">{{ focusState.title }}</h2>
      <p class="focus-subtitle">{{ focusState.subtitle }}</p>
      <button
        v-if="focusState.action"
        class="focus-action"
        @click="focusState.action?.()"
      >
        {{ focusState.actionLabel }} <ChevronRight :size="14" />
      </button>
    </div>

    <!-- ═══ STAT TILES (1x1 each) ═══ -->

    <!-- Soumission % -->
    <div class="dashboard-card bento-tile bento-stat">
      <div class="stat-ring">
        <svg viewBox="0 0 36 36" class="stat-ring-svg">
          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--bg-active)" stroke-width="3" />
          <circle
            cx="18" cy="18" r="15" fill="none"
            stroke="var(--accent)" stroke-width="3"
            stroke-linecap="round"
            :stroke-dasharray="`${submissionRate * 0.942} 94.2`"
            transform="rotate(-90 18 18)"
            style="transition: stroke-dasharray .6s ease"
          />
        </svg>
      </div>
      <span class="stat-number">{{ Math.round(submissionRate) }}%</span>
      <span class="stat-label">soumis</span>
      <Percent :size="14" class="stat-icon" />
    </div>

    <!-- A noter -->
    <div class="dashboard-card bento-tile bento-stat" :class="{ 'stat--alert': aNoterCount > 0 }">
      <span class="stat-number">{{ aNoterCount }}</span>
      <span class="stat-label">a noter</span>
      <Edit3 :size="14" class="stat-icon" />
    </div>

    <!-- Moyenne -->
    <div class="dashboard-card bento-tile bento-stat">
      <span class="stat-number stat-grade" :class="gradeClass(averageGrade)">{{ averageGrade }}</span>
      <span class="stat-label">moyenne</span>
      <Award :size="14" class="stat-icon" />
    </div>

    <!-- En ligne -->
    <div class="dashboard-card bento-tile bento-stat">
      <span class="stat-online-dot" />
      <span class="stat-number">{{ onlineStudents }}</span>
      <span class="stat-label">en ligne</span>
      <Wifi :size="14" class="stat-icon" />
    </div>

    <!-- ═══ SCHEDULE STRIP (2x1) ═══ -->
    <div class="dashboard-card bento-tile bento-schedule">
      <h3 class="tile-title"><Clock :size="14" /> Aujourd'hui</h3>
      <div v-if="!todayEvents.length" class="schedule-empty">
        Aucun evenement prevu aujourd'hui
      </div>
      <div v-else class="schedule-list">
        <div
          v-for="(ev, idx) in todayEvents"
          :key="ev.id"
          class="schedule-item"
          :class="{
            'schedule-past': isPastEvent(ev.time),
            'schedule-current': isCurrentEvent(ev.time, idx),
          }"
        >
          <span class="schedule-time">
            {{ new Date(ev.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }}
          </span>
          <span class="schedule-badge" :class="'schedule-type-' + ev.type">
            <Mic v-if="ev.type === 'soutenance'" :size="10" />
            <Clock v-else-if="ev.type === 'deadline'" :size="10" />
            <CheckCircle2 v-else :size="10" />
          </span>
          <span class="schedule-title">{{ ev.title }}</span>
        </div>
      </div>
    </div>

    <!-- ═══ MESSAGES TILE (1x1) ═══ -->
    <div class="dashboard-card bento-tile bento-messages">
      <h3 class="tile-title"><MessageSquare :size="14" /> Messages</h3>
      <div v-if="!unreadDmEntries.length" class="messages-empty">
        Aucun message non lu
      </div>
      <template v-else>
        <span class="messages-count">{{ totalUnreadDms }} non lu{{ totalUnreadDms > 1 ? 's' : '' }}</span>
        <div class="messages-list">
          <button
            v-for="entry in unreadDmEntries.slice(0, 3)"
            :key="entry.name"
            class="messages-item"
            @click="emit('openDmFromDashboard', entry.name)"
          >
            <div class="messages-avatar" :style="{ background: avatarColor(entry.name) }">
              {{ entry.name.slice(0, 2).toUpperCase() }}
            </div>
            <span class="messages-name">{{ entry.name }}</span>
            <span class="messages-badge">{{ entry.count }}</span>
          </button>
        </div>
      </template>
    </div>

    <!-- ═══ QUICK ACTIONS (2x1) ═══ -->
    <div class="dashboard-card bento-tile bento-actions">
      <button class="action-btn action-btn--primary" @click="emit('openNewDevoir')">
        <PlusCircle :size="22" />
        <span class="action-label">Creer un devoir</span>
      </button>
      <button class="action-btn action-btn--secondary" @click="emit('openActiveDevoir')">
        <Bell :size="22" />
        <span class="action-label">Envoyer un rappel</span>
      </button>
      <button class="action-btn action-btn--secondary" @click="emit('switchToFrise')">
        <BarChart2 :size="22" />
        <span class="action-label">Voir la frise</span>
      </button>
    </div>

    <!-- ═══ ACTIVITY FEED (2x1) ═══ -->
    <div class="dashboard-card bento-tile bento-activity">
      <h3 class="tile-title"><Clock :size="14" /> Derniers rendus</h3>
      <div v-if="!activityFeed.length" class="activity-empty">
        Aucune activite recente
      </div>
      <div v-else class="activity-list">
        <div v-for="item in activityFeed" :key="item.id" class="activity-item">
          <span class="activity-icon">
            <Edit3 :size="12" />
          </span>
          <span class="activity-label">{{ item.label }}</span>
          <span class="activity-time">{{ item.timeAgo }}</span>
        </div>
      </div>
    </div>

    <!-- ═══ TODO WIDGET (2x1) ═══ -->
    <div class="dashboard-card bento-tile bento-todo">
      <TeacherTodoWidget />
    </div>

  </div>
</template>

<style scoped>
/* ── Bento Grid ── */
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: minmax(100px, auto);
  gap: 12px;
  padding-top: 14px;
}

/* ── Base tile: extends .dashboard-card from dashboard-shared.css ── */

/* ── FOCUS TILE (2x2) ── */
.bento-focus {
  grid-column: span 2;
  grid-row: span 2;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
  padding: 28px 24px;
}
.focus-icon { opacity: .7; margin-bottom: 4px; }

.focus--critical {
  background: rgba(239, 68, 68, .08);
  border-color: rgba(239, 68, 68, .25);
}
.focus--critical .focus-icon { color: #ef4444; }

.focus--warning {
  background: rgba(245, 158, 11, .08);
  border-color: rgba(245, 158, 11, .25);
}
.focus--warning .focus-icon { color: #f59e0b; }

.focus--normal {
  background: rgba(74, 144, 217, .06);
  border-color: rgba(74, 144, 217, .2);
}
.focus--normal .focus-icon { color: var(--accent); }

.focus--clear {
  background: linear-gradient(135deg, rgba(34, 197, 94, .06) 0%, rgba(74, 144, 217, .04) 100%);
  border-color: rgba(34, 197, 94, .2);
}
.focus--clear .focus-icon { color: #22c55e; }

.focus-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2;
  margin: 0;
}
.focus-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}
.focus-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 8px 18px;
  font-size: 13px;
  font-weight: 700;
  font-family: var(--font);
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: filter .15s, transform .15s;
}
.focus-action:hover { filter: brightness(1.1); transform: translateY(-1px); }

/* ── STAT TILES ── */
.bento-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
  min-height: 100px;
}
.stat-number {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
}
.stat-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .5px;
}
.stat-icon {
  position: absolute;
  top: 10px;
  right: 10px;
  color: var(--text-muted);
  opacity: .3;
}
.stat-ring {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.stat-ring-svg {
  width: 72px;
  height: 72px;
  opacity: .6;
}
.stat--alert {
  background: rgba(239, 68, 68, .06);
  border-color: rgba(239, 68, 68, .2);
}
.stat--alert .stat-number { color: #ef4444; }
.stat--alert .stat-icon { color: #ef4444; opacity: .4; }

.stat-online-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34, 197, 94, .5);
  margin-bottom: 2px;
}

.stat-grade.grade-a { color: var(--color-success); }
.stat-grade.grade-b { color: #27ae60; }
.stat-grade.grade-c { color: var(--color-warning); }
.stat-grade.grade-d { color: var(--color-danger); }
.stat-grade.grade-empty { color: var(--text-muted); }

/* ── SCHEDULE STRIP (spans 2 cols) ── */
.bento-schedule {
  grid-column: span 2;
}
.tile-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  margin: 0 0 10px;
}
.schedule-empty, .messages-empty, .activity-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px 0;
}
.schedule-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.schedule-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  flex-shrink: 0;
  transition: opacity .2s, background .2s;
}
.schedule-past {
  opacity: .4;
}
.schedule-current {
  background: rgba(74, 144, 217, .1);
  border-color: rgba(74, 144, 217, .3);
}
.schedule-time {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.schedule-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  flex-shrink: 0;
}
.schedule-type-deadline   { background: rgba(74, 144, 217, .15); color: var(--accent); }
.schedule-type-soutenance { background: rgba(139, 92, 246, .15); color: #8b5cf6; }
.schedule-type-reminder   { background: rgba(34, 197, 94, .15); color: #22c55e; }
.schedule-title {
  font-size: 12px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

/* ── MESSAGES TILE ── */
.bento-messages {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.messages-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  background: rgba(74, 144, 217, .1);
  padding: 2px 8px;
  border-radius: 10px;
  align-self: flex-start;
}
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.messages-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  font-family: var(--font);
  color: var(--text-primary);
  transition: background .12s;
}
.messages-item:hover { background: var(--bg-hover); }
.messages-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.messages-name {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.messages-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  background: rgba(74, 144, 217, .12);
  padding: 1px 6px;
  border-radius: 8px;
  flex-shrink: 0;
}

/* ── QUICK ACTIONS (spans 2 cols) ── */
.bento-actions {
  grid-column: span 2;
  display: flex;
  gap: 10px;
  align-items: stretch;
  padding: 12px;
}
.action-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: all .15s ease;
  font-family: var(--font);
  border: 1px solid var(--border);
  min-height: 80px;
}
.action-btn--primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.action-btn--primary:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
.action-btn--secondary {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}
.action-btn--secondary:hover {
  background: var(--bg-active);
  color: var(--text-primary);
  border-color: var(--accent);
}
.action-label {
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

/* ── ACTIVITY FEED (spans 2 cols) ── */
.bento-activity {
  grid-column: span 2;
}
.bento-todo {
  grid-column: span 2;
}
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.activity-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background .12s;
}
.activity-item:hover { background: var(--bg-elevated); }
.activity-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(74, 144, 217, .12);
  color: var(--accent);
  flex-shrink: 0;
}
.activity-label {
  flex: 1;
  font-size: 12.5px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.activity-time {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

/* ── Responsive: tablet (2 cols) ── */
@media (max-width: 768px) {
  .bento-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .bento-focus {
    grid-column: span 2;
    grid-row: span 1;
    padding: 20px;
  }
  .focus-title { font-size: 18px; }
  .bento-schedule { grid-column: span 2; }
  .bento-actions { grid-column: span 2; }
  .bento-activity { grid-column: span 2; }
}

/* ── Responsive: mobile (1 col) ── */
@media (max-width: 480px) {
  .bento-grid {
    grid-template-columns: 1fr;
  }
  .bento-focus,
  .bento-schedule,
  .bento-actions,
  .bento-activity {
    grid-column: span 1;
  }
  .bento-focus { grid-row: span 1; }
  .bento-actions {
    flex-direction: column;
  }
  .schedule-list {
    flex-direction: column;
  }
  .schedule-item {
    flex-shrink: initial;
  }
}
</style>
