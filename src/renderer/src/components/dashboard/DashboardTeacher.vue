/**
 * DashboardTeacher.vue
 * ---------------------------------------------------------------------------
 * Complete teacher-side dashboard view.
 * Receives all reactive data through props from the parent DashboardView
 * which orchestrates composables.
 */
<script setup lang="ts">
import { type Component } from 'vue'
import {
  Clock, Edit3, Users, BookOpen, AlertTriangle,
  ChevronRight, CheckCircle2, FileText, LayoutDashboard,
  Award, TrendingUp, FolderOpen, CalendarDays, BarChart2,
  PlusCircle, Menu, GraduationCap, Settings,
  MessageSquare, Bookmark, Trash2,
  AtSign, CalendarClock, EyeOff, Mic, FileQuestion,
} from 'lucide-vue-next'
import { deadlineClass, deadlineLabel, formatDate } from '@/utils/date'
import { avatarColor, gradeClass } from '@/utils/format'
import { GRADE_COLORS } from '@/composables/useTeacherAnalytics'
import type { Promotion, Depot } from '@/types'
import type { GanttRow, ProjectCard, Reminder } from '@/composables/useDashboardTeacher'
import type { SavedMessage, AgendaItem } from '@/composables/useDashboardWidgets'
import type { FriseMilestone, FrisePromo } from '@/composables/useFrise'

// ── Props ────────────────────────────────────────────────────────────────────
const props = defineProps<{
  toggleSidebar?: () => void
  loadingTeacher: boolean
  greetingName: string
  today: string

  // Promos
  promos: Promotion[]
  activePromoId: number | null
  savingPromo: boolean
  deletingPromoId: number | null
  renamingPromoId: number | null
  renamingPromoValue: string

  // Stats
  aNoterCount: number
  urgentsCount: number
  brouillonsCount: number
  totalStudents: number
  allStudents: { id: number; promo_id: number; name?: string }[]
  ganttAll: GanttRow[]

  // Action center & class health
  actionItems: { id: string; type: string; title: string; subtitle: string; urgency: string; action: () => void }[]
  classHealth: { score: number; color: string; label: string; avgSubmission: number } | null
  submissionTrend: { days: { label: string; count: number }[]; maxCount: number }

  // Widgets – DMs
  unreadDmEntries: { name: string; count: number }[]
  totalUnreadDms: number

  // Widgets – Saved messages
  savedMessages: SavedMessage[]

  // Widgets – Mentions
  unreadMentions: { id: string; authorName: string; channelId: number | null; channelName: string }[]
  totalUnreadMentions: number

  // Widgets – Channel activity
  recentChannelActivity: { id: string; authorName: string; channelId: number | null; channelName: string; timestamp: number; read: boolean }[]

  // Widgets – Next 48h
  next48h: AgendaItem[]

  // Widgets – Forgotten drafts
  forgottenDrafts: GanttRow[]

  // Widgets – Devoirs without resources
  devoirsWithoutResources: GanttRow[]

  // Reminders
  thisWeekReminders: (Reminder & { isOverdue: boolean; isToday: boolean })[]
  doneThisWeek: number
  totalThisWeek: number

  // Tabs
  dashTab: 'accueil' | 'promotions' | 'frise' | 'analytique' | 'reglages'

  // Analytics
  analyticsStats: { total: number; graded: number; notGraded: number }
  gradeDistribution: { label: string; pct: number; color: string; count: number }[]
  submissionRates: { title: string; rate: number }[]
  globalModeGrade: string | null

  // Projects
  projectCards: ProjectCard[]
  recentRendus: Depot[]

  // Frise
  friseOffset: number
  friseDragging: boolean
  ganttDateRange: { start: Date; end: Date } | null
  frise: FrisePromo[]
  ganttMonths: { left: number; label: string }[]
  ganttTodayPct: number
  onlineUsersCount: number

  // Frise helpers (functions)
  milestoneLeft: (deadline: string) => string
  projectLineStyle: (milestones: FriseMilestone[]) => Record<string, string>
}>()

// ── Emits ────────────────────────────────────────────────────────────────────
const emit = defineEmits<{
  'update:activePromoId': [id: number]
  'update:dashTab': [tab: 'accueil' | 'promotions' | 'frise' | 'analytique' | 'reglages']
  'update:renamingPromoId': [id: number | null]
  'update:renamingPromoValue': [val: string]
  'update:friseOffset': [val: number]
  'update:currentTravailId': [id: number]
  toggleReminder: [id: number, done: boolean]
  openDmFromDashboard: [name: string]
  removeSavedMessage: [id: number]
  goToSavedMessage: [msg: SavedMessage]
  goToChannel: [channelId: number, channelName: string]
  publishDraft: [id: number]
  goToProject: [key: string]
  confirmRenamePromo: [promo: Promotion]
  deletePromo: [id: number, name: string]
  onFriseWheel: [e: WheelEvent]
  onFriseDragStart: [e: MouseEvent]
  onFriseDragMove: [e: MouseEvent]
  onFriseDragEnd: [e: MouseEvent]
  onMilestoneClick: [ms: FriseMilestone]
  openNewDevoir: []
  openEcheancier: []
  openClasse: []
  openSettings: []
  openCreatePromo: []
  openIntervenants: []
  openImportStudents: [promoId: number]
  openGestionDevoir: [travailId: number]
  navigateDevoirs: []
  navigateMessages: []
}>()

function setTab(tab: 'accueil' | 'promotions' | 'frise' | 'analytique' | 'reglages') {
  emit('update:dashTab', tab)
}
</script>

<template>
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
          :class="{ active: activePromoId === p.id }"
          :style="activePromoId === p.id ? { background: 'color-mix(in srgb, ' + p.color + ' 20%, transparent)', color: p.color, borderColor: p.color } : {}"
          @click="emit('update:activePromoId', p.id)"
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

    <!-- Centre d'action + Santé classe -->
    <div v-if="actionItems.length || classHealth" class="db-action-row">

      <!-- Centre d'action -->
      <div v-if="actionItems.length" class="db-action-center">
        <h4 class="db-section-title"><AlertTriangle :size="14" /> Actions requises</h4>
        <div class="db-action-list">
          <button
            v-for="item in actionItems"
            :key="item.id"
            class="db-action-item"
            :class="'db-action-' + item.urgency"
            @click="item.action()"
          >
            <span class="db-action-badge" :class="'db-badge-' + item.type">
              <Edit3 v-if="item.type === 'grade'" :size="11" />
              <Clock v-else-if="item.type === 'deadline'" :size="11" />
              <FileText v-else-if="item.type === 'draft'" :size="11" />
              <AlertTriangle v-else :size="11" />
            </span>
            <div class="db-action-text">
              <span class="db-action-title">{{ item.title }}</span>
              <span class="db-action-sub">{{ item.subtitle }}</span>
            </div>
            <ChevronRight :size="12" class="db-action-arrow" />
          </button>
        </div>
      </div>

      <!-- Santé de la classe -->
      <div v-if="classHealth" class="db-class-health">
        <h4 class="db-section-title"><TrendingUp :size="14" /> Santé de la classe</h4>
        <div class="db-health-ring-wrap">
          <svg class="db-health-ring" viewBox="0 0 80 80" role="img" :aria-label="`Santé de la classe : ${classHealth.score}%`">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="6" />
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              :stroke="classHealth.color"
              stroke-width="6"
              stroke-linecap="round"
              :stroke-dasharray="`${classHealth.score * 2.136} 213.6`"
              transform="rotate(-90 40 40)"
              style="transition: stroke-dasharray .6s ease"
            />
          </svg>
          <div class="db-health-score">
            <span class="db-health-value" :style="{ color: classHealth.color }">{{ classHealth.score }}</span>
            <span class="db-health-unit">%</span>
          </div>
        </div>
        <span class="db-health-label" :style="{ color: classHealth.color }">{{ classHealth.label }}</span>
        <span class="db-health-detail">Taux de soumission moyen : {{ classHealth.avgSubmission }}%</span>

        <!-- Mini sparkline des soumissions des 7 derniers jours -->
        <div v-if="submissionTrend.days.some(d => d.count > 0)" class="db-trend">
          <span class="db-trend-title">Rendus cette semaine</span>
          <div class="db-trend-bars">
            <div v-for="d in submissionTrend.days" :key="d.label" class="db-trend-col">
              <div class="db-trend-bar-bg">
                <div
                  class="db-trend-bar-fill"
                  :style="{ height: (d.count / submissionTrend.maxCount * 100) + '%' }"
                />
              </div>
              <span class="db-trend-label">{{ d.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- DMs non lus -->
    <div v-if="unreadDmEntries.length" class="db-unread-dms">
      <h4 class="db-section-title"><MessageSquare :size="14" /> Messages directs non lus <span class="db-badge-count">{{ totalUnreadDms }}</span></h4>
      <div class="db-unread-list">
        <button
          v-for="entry in unreadDmEntries"
          :key="entry.name"
          class="db-unread-item"
          @click="emit('openDmFromDashboard', entry.name)"
        >
          <div class="db-unread-avatar" :style="{ background: avatarColor(entry.name) }">
            {{ entry.name.slice(0, 2).toUpperCase() }}
          </div>
          <span class="db-unread-name">{{ entry.name }}</span>
          <span class="db-unread-badge">{{ entry.count }} non lu{{ entry.count > 1 ? 's' : '' }}</span>
          <ChevronRight :size="12" class="db-unread-arrow" />
        </button>
      </div>
    </div>

    <!-- Messages sauvegardés -->
    <div v-if="savedMessages.length" class="db-saved-messages">
      <h4 class="db-section-title"><Bookmark :size="14" /> Messages sauvegardés</h4>
      <div class="db-saved-list">
        <div
          v-for="msg in savedMessages.slice(0, 5)"
          :key="msg.id"
          class="db-saved-item"
          @click="emit('goToSavedMessage', msg)"
        >
          <div class="db-saved-avatar" :style="{ background: avatarColor(msg.authorName) }">
            {{ msg.authorInitials }}
          </div>
          <div class="db-saved-body">
            <span class="db-saved-author">{{ msg.authorName }}</span>
            <span class="db-saved-content">{{ msg.content }}</span>
            <span class="db-saved-meta">
              {{ msg.isDm ? 'DM' : '#' + (msg.channelName ?? 'canal') }}
              · {{ new Date(msg.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }}
            </span>
          </div>
          <button
            class="db-saved-remove"
            title="Retirer des favoris"
            @click.stop="emit('removeSavedMessage', msg.id)"
          >
            <Trash2 :size="12" />
          </button>
        </div>
      </div>
      <span v-if="savedMessages.length > 5" class="db-saved-more">
        +{{ savedMessages.length - 5 }} autre{{ savedMessages.length - 5 > 1 ? 's' : '' }}
      </span>
    </div>

    <!-- Widgets Communication + Organisation (grille) -->
    <div v-if="unreadMentions.length || recentChannelActivity.length || next48h.length || forgottenDrafts.length || devoirsWithoutResources.length" class="db-widgets-grid">

      <!-- Mentions @ non lues -->
      <div v-if="unreadMentions.length" class="db-widget">
        <h4 class="db-section-title">
          <AtSign :size="14" /> Mentions
          <span class="db-badge-count">{{ totalUnreadMentions }}</span>
        </h4>
        <div class="db-widget-list">
          <button
            v-for="m in unreadMentions"
            :key="m.id"
            class="db-widget-item db-widget-item--mention"
            @click="emit('goToChannel', m.channelId!, m.channelName)"
          >
            <div class="db-widget-avatar" :style="{ background: avatarColor(m.authorName) }">
              {{ m.authorName.slice(0, 2).toUpperCase() }}
            </div>
            <div class="db-widget-body">
              <span class="db-widget-title">{{ m.authorName }}</span>
              <span class="db-widget-sub">#{{ m.channelName }}</span>
            </div>
            <ChevronRight :size="12" class="db-widget-arrow" />
          </button>
        </div>
      </div>

      <!-- Derniers messages de canal -->
      <div v-if="recentChannelActivity.length" class="db-widget">
        <h4 class="db-section-title"><MessageSquare :size="14" /> Activité des canaux</h4>
        <div class="db-widget-list">
          <button
            v-for="n in recentChannelActivity"
            :key="n.id"
            class="db-widget-item"
            @click="emit('goToChannel', n.channelId!, n.channelName)"
          >
            <div class="db-widget-avatar" :style="{ background: avatarColor(n.authorName) }">
              {{ n.authorName.slice(0, 2).toUpperCase() }}
            </div>
            <div class="db-widget-body">
              <span class="db-widget-title">{{ n.authorName }} <span class="db-widget-channel">#{{ n.channelName }}</span></span>
              <span class="db-widget-time">{{ new Date(n.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }}</span>
            </div>
            <span v-if="!n.read" class="db-widget-dot" />
            <ChevronRight :size="12" class="db-widget-arrow" />
          </button>
        </div>
      </div>

      <!-- Prochaines 48h -->
      <div v-if="next48h.length" class="db-widget">
        <h4 class="db-section-title"><CalendarClock :size="14" /> Prochaines 48h</h4>
        <div class="db-widget-list">
          <button
            v-for="item in next48h"
            :key="item.id"
            class="db-widget-item"
            @click="typeof item.id === 'number' ? (emit('openGestionDevoir', item.id as number)) : null"
          >
            <span class="db-agenda-icon" :class="'db-agenda-' + item.type">
              <Mic v-if="item.type === 'soutenance'" :size="12" />
              <Clock v-else-if="item.type === 'deadline'" :size="12" />
              <CheckCircle2 v-else :size="12" />
            </span>
            <div class="db-widget-body">
              <span class="db-widget-title">{{ item.title }}</span>
              <span class="db-widget-sub">
                {{ new Date(item.time).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) }}
                à {{ new Date(item.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }}
                <template v-if="item.room"> · Salle {{ item.room }}</template>
              </span>
            </div>
          </button>
        </div>
      </div>

      <!-- Brouillons oubliés -->
      <div v-if="forgottenDrafts.length" class="db-widget">
        <h4 class="db-section-title"><EyeOff :size="14" /> Brouillons à publier</h4>
        <div class="db-widget-list">
          <div v-for="t in forgottenDrafts" :key="t.id" class="db-widget-item db-widget-item--draft">
            <span class="db-agenda-icon db-agenda-draft"><FileText :size="12" /></span>
            <div class="db-widget-body">
              <span class="db-widget-title">{{ t.title }}</span>
              <span class="db-widget-sub">
                Deadline {{ deadlineLabel(t.deadline) }}
                <span v-if="new Date(t.deadline).getTime() - Date.now() < 2 * 86_400_000" class="db-draft-urgent">urgent</span>
              </span>
            </div>
            <button class="db-draft-publish" @click.stop="emit('publishDraft', t.id)">Publier</button>
          </div>
        </div>
      </div>

      <!-- Devoirs sans ressources -->
      <div v-if="devoirsWithoutResources.length" class="db-widget">
        <h4 class="db-section-title"><FileQuestion :size="14" /> Devoirs sans ressources</h4>
        <div class="db-widget-list">
          <button
            v-for="t in devoirsWithoutResources"
            :key="t.id"
            class="db-widget-item"
            @click="emit('openGestionDevoir', t.id)"
          >
            <span class="db-agenda-icon db-agenda-resource"><FileQuestion :size="12" /></span>
            <div class="db-widget-body">
              <span class="db-widget-title">{{ t.title }}</span>
              <span class="db-widget-sub">#{{ t.channel_name }} · Aucune ressource jointe</span>
            </div>
            <ChevronRight :size="12" class="db-widget-arrow" />
          </button>
        </div>
      </div>
    </div>

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
          @click="emit('toggleReminder', r.id, !r.done)"
        >
          <div class="db-week-check">
            <CheckCircle2 v-if="r.done" :size="15" style="color:var(--color-success)" />
            <div v-else class="db-week-circle" :class="{ 'db-week-circle--overdue': r.isOverdue }" />
          </div>
          <div class="db-week-body">
            <span class="db-week-item-title" :class="{ 'line-through': r.done }">{{ r.title }}</span>
            <span class="db-week-meta">
              <span class="db-week-promo">{{ r.promo_tag }}</span>
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
      <button class="db-tab" :class="{ active: dashTab === 'accueil' }" @click="setTab('accueil')">
        <LayoutDashboard :size="13" /> Accueil
      </button>
      <button class="db-tab" :class="{ active: dashTab === 'promotions' }" @click="setTab('promotions')">
        <Users :size="13" /> Promotions
      </button>
      <button class="db-tab" :class="{ active: dashTab === 'frise' }" @click="setTab('frise')">
        <BarChart2 :size="13" /> Frise
      </button>
      <button class="db-tab" :class="{ active: dashTab === 'analytique' }" @click="setTab('analytique')">
        <TrendingUp :size="13" /> Analytique
      </button>
      <button class="db-tab" :class="{ active: dashTab === 'reglages' }" @click="setTab('reglages')">
        <Settings :size="13" /> Administration
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
            <span class="analytics-stat-value" style="color:#22c55e">{{ onlineUsersCount }}</span>
            <span class="analytics-stat-label">En ligne</span>
          </div>
        </div>

        <!-- Distribution des notes -->
        <div class="analytics-card">
          <h3 class="analytics-card-title"><Award :size="14" /> Distribution des notes</h3>
          <div class="analytics-bars" role="img" aria-label="Distribution des notes">
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
        <!-- Tendance des rendus (7 derniers jours) -->
        <div v-if="submissionTrend.days.some(d => d.count > 0)" class="analytics-card">
          <h3 class="analytics-card-title"><TrendingUp :size="14" /> Rendus des 7 derniers jours</h3>
          <div class="analytics-trend-chart">
            <div v-for="d in submissionTrend.days" :key="d.label" class="analytics-trend-col">
              <span class="analytics-trend-count">{{ d.count || '' }}</span>
              <div class="analytics-trend-bar-bg">
                <div
                  class="analytics-trend-bar-fill"
                  :style="{ height: (d.count / submissionTrend.maxCount * 100) + '%' }"
                />
              </div>
              <span class="analytics-trend-label">{{ d.label }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab Promotions -->
    <div v-else-if="dashTab === 'promotions'" class="db-tab-content">
      <div class="promo-list">
        <div
          v-for="p in promos"
          :key="p.id"
          class="promo-list-card"
          :class="{ 'promo-active': activePromoId === p.id }"
          :style="{ borderColor: activePromoId === p.id ? p.color : undefined }"
        >
          <div class="promo-list-header">
            <span class="promo-list-dot" :style="{ background: p.color }" />
            <template v-if="renamingPromoId === p.id">
              <input
                :value="renamingPromoValue"
                class="promo-rename-input"
                aria-label="Nom de la promotion"
                :disabled="savingPromo"
                @input="emit('update:renamingPromoValue', ($event.target as HTMLInputElement).value)"
                @keydown.enter="emit('confirmRenamePromo', p)"
                @keydown.escape="emit('update:renamingPromoId', null)"
              />
              <button class="gestion-btn-sm gestion-btn-accent" :disabled="savingPromo" @click="emit('confirmRenamePromo', p)">
                {{ savingPromo ? '…' : 'OK' }}
              </button>
              <button class="gestion-btn-sm" :disabled="savingPromo" @click="emit('update:renamingPromoId', null)">Annuler</button>
            </template>
            <template v-else>
              <span class="promo-list-name">{{ p.name }}</span>
              <span v-if="activePromoId === p.id" class="promo-list-active-tag">Active</span>
              <button v-else class="gestion-btn-sm" @click="emit('update:activePromoId', p.id)">Sélectionner</button>
            </template>
          </div>

          <!-- Stats enrichies -->
          <div class="promo-list-stats">
            <span><Users :size="11" /> {{ allStudents.filter(s => s.promo_id === p.id).length }} étudiants</span>
            <span>
              <BookOpen :size="11" />
              {{ ganttAll.filter(t => t.promo_name === p.name && t.published).length }} publiés
              <template v-if="ganttAll.filter(t => t.promo_name === p.name && !t.published).length">
                · {{ ganttAll.filter(t => t.promo_name === p.name && !t.published).length }} brouillons
              </template>
            </span>
            <span v-if="ganttAll.filter(t => t.promo_name === p.name && t.published && t.students_total > 0).length">
              <TrendingUp :size="11" />
              {{ Math.round(ganttAll.filter(t => t.promo_name === p.name && t.published && t.students_total > 0).reduce((s, t) => s + t.depots_count / t.students_total, 0) / Math.max(1, ganttAll.filter(t => t.promo_name === p.name && t.published && t.students_total > 0).length) * 100) }}% soumission moy.
            </span>
          </div>

          <!-- Actions -->
          <div class="promo-list-actions">
            <button class="gestion-btn" @click="emit('update:renamingPromoId', p.id); emit('update:renamingPromoValue', p.name)">
              <Edit3 :size="11" /> Renommer
            </button>
            <button class="gestion-btn" @click="emit('update:activePromoId', p.id); emit('openClasse')">
              <GraduationCap :size="11" /> Classe
            </button>
            <button class="gestion-btn" @click="emit('openImportStudents', p.id)">
              <FileText :size="11" /> Importer CSV
            </button>
            <button
              class="gestion-btn"
              style="color:var(--color-danger)"
              :disabled="deletingPromoId === p.id"
              @click="emit('deletePromo', p.id, p.name)"
            >
              {{ deletingPromoId === p.id ? 'Suppression…' : 'Supprimer' }}
            </button>
          </div>
        </div>
      </div>
      <button class="dc-add-btn" style="margin:12px 0" @click="emit('openCreatePromo')">
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
          role="button"
          :aria-label="`Ouvrir le projet ${p.label}`"
          @click="emit('goToProject', p.key)"
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

    <!-- Tab Administration -->
    <div v-else-if="dashTab === 'reglages'" class="db-tab-content">
      <div class="gestion-grid">
        <div class="gestion-card">
          <div class="gestion-card-header">
            <h4 class="gestion-card-title"><Users :size="13" /> Intervenants</h4>
            <button class="gestion-btn" @click="emit('openIntervenants')">Gérer</button>
          </div>
          <p class="gestion-hint">Gérez les comptes intervenants et leurs accès aux canaux par promotion.</p>
          <button class="gestion-btn" style="margin-top:8px" @click="emit('openIntervenants')">
            <Users :size="12" /> Ouvrir la gestion
          </button>
        </div>

        <div class="gestion-card">
          <h4 class="gestion-card-title"><LayoutDashboard :size="13" /> Navigation rapide</h4>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="gestion-btn" @click="emit('openEcheancier')"><Clock :size="12" /> Échéancier</button>
            <button class="gestion-btn" @click="emit('navigateDevoirs')"><BookOpen :size="12" /> Aller aux devoirs</button>
            <button class="gestion-btn" @click="emit('navigateMessages')"><Edit3 :size="12" /> Aller aux messages</button>
            <button class="gestion-btn" @click="emit('openSettings')"><Settings :size="12" /> Préférences</button>
          </div>
        </div>

        <div class="gestion-card">
          <h4 class="gestion-card-title"><Settings :size="13" /> Système</h4>
          <div class="gestion-promo-stats">
            <span>{{ promos.length }} promotion{{ promos.length > 1 ? 's' : '' }}</span>
            <span>{{ allStudents.length }} étudiants au total</span>
            <span>{{ ganttAll.length }} devoirs au total</span>
          </div>
          <p class="gestion-hint" style="margin-top:8px">Version Cursus v2.0.0</p>
        </div>
      </div>
    </div>

    <!-- Tab Frise -->
    <div v-else-if="dashTab === 'frise'" class="db-tab-content db-frise-outer">
      <div v-if="friseOffset !== 0" class="frise-recenter">
        <button class="gestion-btn" @click="emit('update:friseOffset', 0)">Recentrer sur aujourd'hui</button>
      </div>
      <div v-if="!ganttDateRange || !frise.length" class="db-empty-hint">
        <BarChart2 :size="36" style="opacity:.2;margin-bottom:10px" />
        <p>Aucune donnée de planification disponible.</p>
      </div>
      <div
        v-else
        class="frise-wrap frise-interactive"
        :class="{ 'frise-grabbing': friseDragging }"
        @wheel.prevent="(e: WheelEvent) => emit('onFriseWheel', e)"
        @mousedown="(e: MouseEvent) => emit('onFriseDragStart', e)"
        @mousemove="(e: MouseEvent) => emit('onFriseDragMove', e)"
        @mouseup="(e: MouseEvent) => emit('onFriseDragEnd', e)"
        @mouseleave="(e: MouseEvent) => emit('onFriseDragEnd', e)"
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
          <div v-for="proj in promo.projects" :key="proj.key" class="frise-row" @click="emit('goToProject', proj.key)">
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
                @click.stop="emit('onMilestoneClick', ms)"
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

    <!-- Barre d'actions rapides flottante -->
    <div class="db-fab-bar">
      <button class="db-fab" title="Nouveau devoir" @click="emit('openNewDevoir')">
        <PlusCircle :size="15" /> Nouveau devoir
      </button>
      <button class="db-fab db-fab-ghost" title="Échéancier" @click="emit('openEcheancier')">
        <CalendarDays :size="14" />
      </button>
      <button class="db-fab db-fab-ghost" title="Classe" @click="emit('openClasse')">
        <GraduationCap :size="14" />
      </button>
      <button class="db-fab db-fab-ghost" title="Réglages" @click="emit('openSettings')">
        <Settings :size="14" />
      </button>
    </div>

  </template>
</template>

<style scoped>
/* ── Chargement ── */
.db-loading { display: flex; flex-direction: column; gap: 14px; padding: 32px 0; }
.db-skel-card { height: 76px; border-radius: 10px; flex-shrink: 0; }
.db-skel-content { display: flex; flex-direction: column; gap: 10px; margin-top: 8px; }

/* ── En-tête ── */
.db-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.db-header-left { display: flex; align-items: center; gap: 12px; }
.db-title { font-size: 20px; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
.db-date  { font-size: 12px; color: var(--text-muted); margin-top: 2px; text-transform: capitalize; }

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

/* ── Section title ── */
.db-section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700; color: var(--text-secondary); margin: 0 0 10px;
}

/* ── Centre d'action + Santé classe (row layout) ── */
.db-action-row {
  display: grid; grid-template-columns: 1fr 280px; gap: 16px; align-items: start;
}
@media (max-width: 768px) { .db-action-row { grid-template-columns: 1fr; } }

.db-action-center { min-width: 0; }
.db-action-list { display: flex; flex-direction: column; gap: 4px; }
.db-action-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; background: var(--bg-elevated, rgba(255,255,255,.04));
  border: 1px solid var(--border); border-radius: 10px;
  cursor: pointer; transition: all .15s ease; text-align: left; width: 100%;
}
.db-action-item:hover { background: rgba(255,255,255,.07); border-color: var(--accent); }
.db-action-critical { border-left: 3px solid #ef4444; }
.db-action-warning  { border-left: 3px solid #f59e0b; }
.db-action-info     { border-left: 3px solid var(--accent); }

.db-action-badge {
  width: 28px; height: 28px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.db-badge-grade    { background: rgba(239,68,68,.15); color: #ef4444; }
.db-badge-deadline { background: rgba(245,158,11,.15); color: #f59e0b; }
.db-badge-draft    { background: rgba(74,144,217,.15); color: var(--accent); }
.db-badge-late     { background: rgba(239,68,68,.2); color: #ef4444; }

.db-action-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.db-action-title { font-size: 13px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-action-sub   { font-size: 11.5px; color: var(--text-muted); }
.db-action-arrow { color: var(--text-muted); flex-shrink: 0; opacity: 0; transition: opacity .15s; }
.db-action-item:hover .db-action-arrow { opacity: 1; }

/* ── Santé de la classe ── */
.db-class-health {
  background: var(--bg-elevated, rgba(255,255,255,.04));
  border: 1px solid var(--border); border-radius: 12px; padding: 16px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.db-health-ring-wrap { position: relative; width: 80px; height: 80px; margin: 4px 0; }
.db-health-ring { width: 100%; height: 100%; }
.db-health-score {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center; gap: 1px;
}
.db-health-value { font-size: 22px; font-weight: 800; }
.db-health-unit  { font-size: 11px; font-weight: 600; margin-top: 4px; }
.db-health-label  { font-size: 13px; font-weight: 700; margin-top: 2px; }
.db-health-detail { font-size: 11px; color: var(--text-muted); text-align: center; }

/* ── Tendance soumissions (sparkline) ── */
.db-trend { margin-top: 12px; width: 100%; }
.db-trend-title { font-size: 11px; color: var(--text-muted); display: block; margin-bottom: 6px; text-align: center; }
.db-trend-bars { display: flex; gap: 4px; justify-content: center; height: 40px; align-items: flex-end; }
.db-trend-col { display: flex; flex-direction: column; align-items: center; gap: 3px; flex: 1; min-width: 0; }
.db-trend-bar-bg {
  width: 100%; max-width: 22px; height: 32px;
  background: rgba(255,255,255,.05); border-radius: 3px;
  display: flex; align-items: flex-end; overflow: hidden;
}
.db-trend-bar-fill { width: 100%; background: var(--accent); border-radius: 3px; min-height: 2px; transition: height .3s ease; }
.db-trend-label { font-size: 9px; color: var(--text-muted); text-transform: capitalize; }

/* ── DMs non lus ── */
.db-unread-dms, .db-saved-messages { margin: 0; }
.db-badge-count {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px;
  background: var(--accent); color: #fff;
  border-radius: 9px; font-size: 10.5px; font-weight: 700; margin-left: 6px;
}
.db-unread-list, .db-saved-list { display: flex; flex-direction: column; gap: 3px; }
.db-unread-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; background: var(--bg-elevated, rgba(255,255,255,.04));
  border: 1px solid var(--border); border-left: 3px solid var(--accent);
  border-radius: 8px; cursor: pointer; transition: all .15s ease;
  width: 100%; text-align: left; font-family: var(--font);
}
.db-unread-item:hover { background: rgba(255,255,255,.07); }
.db-unread-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.db-unread-name { flex: 1; font-size: 13px; font-weight: 600; color: var(--text-primary); }
.db-unread-badge {
  font-size: 11px; font-weight: 600; color: var(--accent);
  background: rgba(74,144,217,.12); padding: 2px 8px; border-radius: 10px;
}
.db-unread-arrow { color: var(--text-muted); flex-shrink: 0; opacity: 0; transition: opacity .15s; }
.db-unread-item:hover .db-unread-arrow { opacity: 1; }

/* ── Messages sauvegardés ── */
.db-saved-item {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px 12px; background: var(--bg-elevated, rgba(255,255,255,.04));
  border: 1px solid var(--border); border-radius: 8px;
  cursor: pointer; transition: all .15s ease;
}
.db-saved-item:hover { background: rgba(255,255,255,.07); }
.db-saved-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: #fff; flex-shrink: 0; margin-top: 2px;
}
.db-saved-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.db-saved-author { font-size: 12.5px; font-weight: 600; color: var(--text-primary); }
.db-saved-content {
  font-size: 12px; color: var(--text-secondary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 400px;
}
.db-saved-meta { font-size: 10.5px; color: var(--text-muted); }
.db-saved-remove {
  background: none; border: none; color: var(--text-muted);
  cursor: pointer; padding: 4px; border-radius: 4px;
  opacity: 0; transition: all .15s; flex-shrink: 0; margin-top: 2px;
}
.db-saved-item:hover .db-saved-remove { opacity: 1; }
.db-saved-remove:hover { color: var(--color-danger); background: rgba(231,76,60,.1); }
.db-saved-more { font-size: 11.5px; color: var(--text-muted); padding: 4px 0; }

/* ── Grille des widgets communication + organisation ── */
.db-widgets-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px;
}
@media (max-width: 700px) { .db-widgets-grid { grid-template-columns: 1fr; } }
.db-widget {
  background: var(--bg-elevated, rgba(255,255,255,.04));
  border: 1px solid var(--border); border-radius: 10px; padding: 14px;
}
.db-widget-list { display: flex; flex-direction: column; gap: 3px; }
.db-widget-item {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 10px; border-radius: 7px;
  cursor: pointer; transition: background .12s;
  background: none; border: none; width: 100%;
  text-align: left; font-family: var(--font); color: var(--text-primary);
}
.db-widget-item:hover { background: rgba(255,255,255,.06); }
.db-widget-item--mention { border-left: 2px solid var(--accent); }
.db-widget-item--draft { border-left: 2px solid var(--color-warning); }
.db-widget-avatar {
  width: 26px; height: 26px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 9.5px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.db-widget-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.db-widget-title { font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.db-widget-sub   { font-size: 11px; color: var(--text-muted); }
.db-widget-time  { font-size: 10.5px; color: var(--text-muted); }
.db-widget-channel { font-weight: 400; color: var(--text-muted); font-size: 11px; }
.db-widget-arrow { color: var(--text-muted); flex-shrink: 0; opacity: 0; transition: opacity .12s; }
.db-widget-item:hover .db-widget-arrow { opacity: 1; }
.db-widget-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }

/* ── Agenda icons ── */
.db-agenda-icon {
  width: 26px; height: 26px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.db-agenda-deadline   { background: rgba(74,144,217,.15); color: var(--accent); }
.db-agenda-soutenance { background: rgba(139,92,246,.15); color: #8b5cf6; }
.db-agenda-reminder   { background: rgba(34,197,94,.15); color: #22c55e; }
.db-agenda-draft      { background: rgba(245,158,11,.15); color: #f59e0b; }
.db-agenda-resource   { background: rgba(107,114,128,.15); color: #6b7280; }

.db-draft-publish {
  font-size: 11px; font-weight: 600; font-family: var(--font);
  padding: 3px 10px; border-radius: 5px;
  background: var(--accent); color: #fff;
  border: none; cursor: pointer; flex-shrink: 0; transition: filter .12s;
}
.db-draft-publish:hover { filter: brightness(1.12); }
.db-draft-urgent {
  color: var(--color-danger); font-weight: 700; font-size: 10px;
  text-transform: uppercase; margin-left: 4px;
}

/* ── À faire cette semaine ── */
.db-week { margin-bottom: 16px; }
.db-week-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.db-week-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--text-primary); }
.db-week-progress {
  font-size: 12px; font-weight: 600; color: var(--text-muted);
  background: rgba(255,255,255,.05); padding: 2px 8px; border-radius: 10px;
}
.db-week-list { display: flex; flex-direction: column; gap: 2px; }
.db-week-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: background var(--t-fast);
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
.db-week-late { font-size: 10px; font-weight: 700; color: var(--color-danger); }
.db-week-today-tag { font-size: 10px; font-weight: 600; color: var(--accent); }
.db-week-date { font-size: 11px; color: var(--text-muted); }

/* ── Tabs ── */
.db-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); padding-bottom: 0; }
.db-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border: none; background: transparent;
  color: var(--text-secondary); font-family: var(--font);
  font-size: 13px; font-weight: 600; cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px; border-radius: 0;
  transition: color var(--t-fast), border-color var(--t-fast);
}
.db-tab:hover { color: var(--text-primary); }
.db-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
.db-tab-content { display: flex; flex-direction: column; gap: 0; }

/* ── Analytique ── */
.analytics-grid { display: flex; flex-direction: column; gap: 16px; }
.analytics-quick-stats { display: flex; gap: 12px; flex-wrap: wrap; }
.analytics-stat {
  flex: 1; min-width: 100px;
  background: var(--bg-secondary); border-radius: 8px; padding: 14px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.analytics-stat-value { font-size: 22px; font-weight: 700; color: var(--text-primary); }
.analytics-stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; }
.analytics-card { background: var(--bg-secondary); border-radius: 8px; padding: 16px; }
.analytics-card-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 14px;
}
.analytics-bars { display: flex; flex-direction: column; gap: 6px; }
.analytics-bar-row { display: flex; align-items: center; gap: 8px; }
.analytics-bar-label { width: 40px; flex-shrink: 0; font-size: 11px; color: var(--text-muted); text-align: right; }
.analytics-bar-label-wide { width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.analytics-bar-track { flex: 1; height: 18px; background: rgba(255,255,255,.05); border-radius: 4px; overflow: hidden; }
.analytics-bar-fill { height: 100%; border-radius: 4px; transition: width .4s ease; }
.analytics-bar-count { width: 32px; flex-shrink: 0; font-size: 11px; color: var(--text-secondary); text-align: right; font-variant-numeric: tabular-nums; }
.analytics-trend-chart { display: flex; gap: 8px; align-items: flex-end; padding: 12px 4px 0; height: 120px; }
.analytics-trend-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
.analytics-trend-count { font-size: 11px; font-weight: 600; color: var(--text-secondary); min-height: 16px; }
.analytics-trend-bar-bg {
  flex: 1; width: 100%; max-width: 32px;
  background: rgba(255,255,255,.05); border-radius: 4px;
  display: flex; align-items: flex-end; overflow: hidden;
}
.analytics-trend-bar-fill {
  width: 100%;
  background: linear-gradient(to top, var(--accent), color-mix(in srgb, var(--accent) 60%, #fff));
  border-radius: 4px; min-height: 3px; transition: height .3s ease;
}
.analytics-trend-label { font-size: 10px; color: var(--text-muted); text-transform: capitalize; }

/* ── Onglet Promotions ── */
.promo-list { display: flex; flex-direction: column; gap: 8px; }
.promo-list-card {
  background: rgba(255,255,255,.02); border: 1px solid var(--border);
  border-radius: 10px; padding: 14px; transition: border-color var(--t-fast);
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

/* ── Grille projets ── */
.db-project-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px; padding-top: 14px;
}
.db-project-card {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; border: 1px solid var(--border);
  border-radius: var(--radius); background: var(--bg-sidebar);
  cursor: pointer; transition: background var(--t-fast), border-color var(--t-fast), box-shadow var(--t-fast);
}
.db-project-card:hover {
  background: rgba(74,144,217,.07); border-color: rgba(74,144,217,.3);
  box-shadow: 0 2px 12px rgba(0,0,0,.15);
}
.db-project-icon {
  flex-shrink: 0; width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 8px; background: var(--accent-subtle); color: var(--accent-light);
}
.db-project-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
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

/* Dernière activité */
.db-activity { margin-top: 16px; }
.db-activity-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;
}
.db-activity-list { display: flex; flex-direction: column; gap: 4px; }
.db-activity-item {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 10px; border-radius: 8px; background: rgba(255,255,255,.02);
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

/* ── Onglet Réglages (Gestion) ── */
.gestion-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px;
}
.gestion-card {
  background: var(--bg-elevated, rgba(255,255,255,.03));
  border: 1px solid var(--border); border-radius: 10px; padding: 16px;
}
.gestion-card-title { font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px; }
.gestion-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.gestion-card-header .gestion-card-title { margin-bottom: 0; }
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
.gestion-promo-stats { font-size: 12px; color: var(--text-muted); display: flex; gap: 12px; }
.gestion-hint { font-size: 12px; color: var(--text-muted); line-height: 1.5; }

/* ── Empty hint ── */
.db-empty-hint {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 60px 20px; color: var(--text-muted); font-size: 13px; text-align: center; gap: 4px;
}

/* ── Frise ── */
.db-frise-outer { flex: 1; min-height: 0; overflow: hidden; padding-top: 12px; }
.frise-recenter { padding: 6px 12px; text-align: right; }
.frise-wrap {
  overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 340px);
  border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--bg-sidebar); min-width: 0;
}
.frise-label-col {
  width: 180px; min-width: 180px; flex-shrink: 0;
  position: sticky; left: 0; background: var(--bg-sidebar);
  z-index: 2; border-right: 1px solid var(--border);
}
.frise-bar-col { flex: 1; position: relative; overflow: hidden; }
.frise-axis-row {
  display: flex; align-items: stretch; border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 4; background: var(--bg-sidebar);
}
.frise-axis-label {
  display: flex; align-items: center; padding: 0 12px;
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .5px; color: var(--text-muted); height: 32px; z-index: 5;
}
.frise-axis-months { height: 32px; position: relative; }
.frise-month-tick {
  position: absolute; top: 8px; font-size: 10px; font-weight: 600;
  color: var(--text-muted); white-space: nowrap; transform: translateX(-50%);
  pointer-events: none; letter-spacing: .3px;
}
.frise-month-bg { position: absolute; top: 0; bottom: 0; }
.frise-month-bg.even { background: rgba(255,255,255,.018); }
.frise-today {
  position: absolute; top: 0; bottom: 0; width: 1.5px;
  background: rgba(74,144,217,.55); z-index: 1; pointer-events: none;
}
.frise-promo-heading { display: flex; align-items: stretch; border-bottom: 1px solid var(--border); }
.frise-promo-label-col {
  display: flex; align-items: center; gap: 8px; padding: 7px 12px;
  font-size: 10.5px; font-weight: 800; text-transform: uppercase;
  letter-spacing: .4px; color: var(--text-secondary);
}
.frise-promo-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 6px currentColor; }
.frise-promo-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.frise-promo-bar-col { background: rgba(255,255,255,.015); }
.frise-row {
  display: flex; align-items: stretch; height: 96px;
  border-bottom: 1px solid rgba(255,255,255,.04);
  cursor: pointer; transition: background var(--t-fast); min-width: 700px;
}
.frise-row:hover { background: rgba(74,144,217,.04); }
.frise-row:hover .frise-label-col { background: rgba(74,144,217,.06); }
.frise-project-label {
  display: flex; align-items: center; gap: 7px; padding: 0 10px 0 14px;
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  cursor: pointer; transition: color var(--t-fast);
}
.frise-row:hover .frise-project-label { color: var(--accent-light); }
.frise-project-icon { color: var(--accent); flex-shrink: 0; }
.frise-project-label > span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.frise-project-arrow { color: var(--text-muted); flex-shrink: 0; transition: transform var(--t-fast), color var(--t-fast); }
.frise-row:hover .frise-project-arrow { transform: translateX(2px); color: var(--accent); }
.frise-timeline { position: relative; }
.frise-proj-line {
  position: absolute; top: 50%; height: 2px; transform: translateY(-50%);
  background: rgba(255,255,255,.12); border-radius: 1px; pointer-events: none;
}
.frise-milestone {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center;
  cursor: pointer; z-index: 2; transition: transform var(--t-fast);
}
.frise-milestone:hover { transform: translate(-50%, -50%) scale(1.15); }
.frise-ms-dot {
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--bg-sidebar); flex-shrink: 0; transition: box-shadow var(--t-fast);
}
.frise-milestone:hover .frise-ms-dot { box-shadow: 0 0 0 3px rgba(255,255,255,.15); }
.frise-ms-soutenance .frise-ms-dot,
.frise-ms-cctl .frise-ms-dot { border-radius: 2px; transform: rotate(45deg); }
.frise-ms-livrable .frise-ms-dot     { background: var(--accent); }
.frise-ms-soutenance .frise-ms-dot   { background: var(--color-warning); }
.frise-ms-cctl .frise-ms-dot         { background: #9b87f5; }
.frise-ms-etude_de_cas .frise-ms-dot { background: var(--color-success); }
.frise-ms-memoire .frise-ms-dot      { background: #e74c3c; }
.frise-ms-autre .frise-ms-dot        { background: #95a5a6; }
.frise-ms-draft .frise-ms-dot { opacity: .35; }
.frise-ms-done .frise-ms-dot { filter: brightness(1.2); box-shadow: 0 0 0 2px rgba(255,255,255,.2); }
.frise-ms-label {
  display: flex; flex-direction: column; align-items: center;
  gap: 1px; pointer-events: none; white-space: nowrap;
}
.frise-ms-above .frise-ms-label { margin-bottom: 5px; }
.frise-milestone:not(.frise-ms-above) .frise-ms-label { margin-top: 5px; }
.frise-ms-title {
  font-size: 9.5px; font-weight: 700; color: var(--text-secondary);
  max-width: 90px; overflow: hidden; text-overflow: ellipsis; text-align: center;
}
.frise-ms-date { font-size: 8.5px; color: var(--text-muted); font-weight: 500; }
.frise-interactive { cursor: grab; user-select: none; }
.frise-grabbing    { cursor: grabbing; }

/* ── Barre d'actions rapides flottante ── */
.db-fab-bar {
  position: sticky; bottom: 16px;
  display: flex; align-items: center; gap: 6px; justify-content: center;
  padding: 8px 14px;
  background: color-mix(in srgb, var(--bg-primary) 85%, transparent);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border); border-radius: 14px;
  width: fit-content; margin: 0 auto;
  box-shadow: 0 4px 20px rgba(0,0,0,.25); z-index: 5;
}
.db-fab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; font-size: 12.5px; font-weight: 600;
  background: var(--accent); color: #fff;
  border: none; border-radius: 8px; cursor: pointer;
  transition: all .15s ease; font-family: var(--font);
}
.db-fab:hover { filter: brightness(1.1); transform: translateY(-1px); }
.db-fab-ghost { background: transparent; color: var(--text-secondary); padding: 7px 10px; }
.db-fab-ghost:hover { background: rgba(255,255,255,.08); color: var(--text-primary); filter: none; }

/* ── dc-add-btn (create promo) ── */
.dc-add-btn {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; padding: 5px 12px; flex-shrink: 0;
  color: var(--text-muted);
  border: 1.5px dashed var(--border-input); border-radius: 20px;
  background: none; cursor: pointer; font-family: var(--font);
  transition: all .15s ease;
}
.dc-add-btn:hover { color: var(--accent); border-color: var(--accent); background: rgba(74,144,217,.07); }
</style>
