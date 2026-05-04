<script setup lang="ts">
/**
 * TabBooking.vue — page d'accueil RDV cote prof.
 *
 * Layout en 4 strates :
 *   1. UiPageHeader sticky : titre + sous-titre + statut Microsoft + CTA "Nouveau type"
 *   2. Stats strip : 4 KPI (types actifs, RDV cette semaine, en attente, prochain)
 *   3. "Prochain RDV" callout : carte saillante quand un RDV est prevu < 24h
 *   4. CampaignManager (visites tripartites) puis 3 sections : types / disponibilites / mes RDV
 *
 * Performance :
 *   - Skeleton loaders pendant le fetch initial (au lieu d'un texte plat)
 *   - useBooking instancie une seule fois et passe via prop aux 3 sections
 *
 * Ergonomie :
 *   - Raccourci Ctrl/Cmd+N pour ouvrir le formulaire de creation
 *   - Stats cliquables qui scrollent vers la section concernee
 *   - "Prochain RDV" avec bouton "Rejoindre" direct si visio dispo
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  Calendar, Plus, Settings, CalendarPlus, Users, Clock, Video,
  AlertCircle,
} from 'lucide-vue-next'
import CampaignManager from '@/components/booking/CampaignManager.vue'
import TabBookingEventTypes from './TabBookingEventTypes.vue'
import TabBookingAvailability from './TabBookingAvailability.vue'
import TabBookingMyBookings from './TabBookingMyBookings.vue'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import UiButton from '@/components/ui/UiButton.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import { useBooking } from '@/composables/useBooking'
import { useMicrosoftConnection } from '@/composables/useMicrosoftConnection'
import { useModalsStore } from '@/stores/modals'

defineProps<{
  allStudents: Array<{ id: number; name?: string; email?: string; promo_id?: number }>
}>()

const booking = useBooking()
const { connected: msConnected, refresh: refreshMsStatus } = useMicrosoftConnection()
const modalsStore = useModalsStore()

// Signal pour ouvrir le formulaire de creation depuis le parent (CTA + Ctrl+N)
const openCreateSignal = ref(0)
function triggerCreate() { openCreateSignal.value++ }

function openSettingsIntegrations() {
  modalsStore.settings = true
}

// ── Stats calculees a partir du state booking ─────────────────────────────

const activeTypesCount = computed(() =>
  booking.eventTypes.value.filter(et => et.is_active).length,
)
const totalTypesCount = computed(() => booking.eventTypes.value.length)

const startOfThisWeek = computed(() => {
  const now = new Date()
  const day = now.getDay()
  const offset = day === 0 ? 6 : day - 1
  const start = new Date(now)
  start.setDate(now.getDate() - offset)
  start.setHours(0, 0, 0, 0)
  return start
})

const bookingsThisWeekCount = computed(() => {
  const start = startOfThisWeek.value
  const end = new Date(start)
  end.setDate(start.getDate() + 7)
  let count = 0
  for (const bk of booking.bookings.value) {
    const d = new Date(`${bk.date}T${bk.start_time}`)
    if (d >= start && d < end && bk.status !== 'cancelled') count++
  }
  return count
})

const pendingCount = computed(() =>
  booking.bookings.value.filter(b => b.status === 'pending').length,
)

/**
 * Prochain RDV non annule, dans le futur, le plus proche dans le temps.
 * Utilise par le callout et la stat "Prochain".
 */
const nextBooking = computed(() => {
  const now = Date.now()
  for (const bk of booking.sortedBookings.value) {
    if (bk.status === 'cancelled') continue
    const t = new Date(`${bk.date}T${bk.start_time}`).getTime()
    if (t >= now) return bk
  }
  return null
})

/** Affiche le callout uniquement si le RDV est dans les 24 prochaines heures. */
const showNextCallout = computed(() => {
  if (!nextBooking.value) return false
  const t = new Date(`${nextBooking.value.date}T${nextBooking.value.start_time}`).getTime()
  return t - Date.now() <= 24 * 3600 * 1000
})

const nextBookingRelative = computed(() => {
  if (!nextBooking.value) return ''
  const t = new Date(`${nextBooking.value.date}T${nextBooking.value.start_time}`)
  const now = new Date()
  const diffMs = t.getTime() - now.getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 0) return 'En cours'
  if (diffMin < 60) return `Dans ${diffMin} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 12) return `Dans ${diffH} h`
  const sameDay = t.toDateString() === now.toDateString()
  if (sameDay) return `A ${booking.formatTime(nextBooking.value.start_time)}`
  return `Demain a ${booking.formatTime(nextBooking.value.start_time)}`
})

const nextBookingShort = computed(() => {
  if (!nextBooking.value) return '—'
  const t = new Date(`${nextBooking.value.date}T${nextBooking.value.start_time}`)
  const now = new Date()
  const sameDay = t.toDateString() === now.toDateString()
  if (sameDay) return `Aujourd'hui ${booking.formatTime(nextBooking.value.start_time)}`
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  if (t.toDateString() === tomorrow.toDateString()) {
    return `Demain ${booking.formatTime(nextBooking.value.start_time)}`
  }
  return `${booking.formatDate(nextBooking.value.date)} ${booking.formatTime(nextBooking.value.start_time)}`
})

// ── Lifecycle + raccourci clavier ─────────────────────────────────────────

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey && !e.altKey) {
    // Pas pendant un input/textarea/contenteditable pour ne pas bloquer la saisie
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
    e.preventDefault()
    triggerCreate()
  }
}

// La SidebarBooking emet un CustomEvent quand l'utilisateur clique son bouton
// "Nouveau type de RDV" (sidebar > Actions rapides). On le re-route vers la
// meme logique que le CTA du header pour eviter de dupliquer le formulaire.
function onSidebarCreateType() { triggerCreate() }

onMounted(() => {
  booking.fetchAll()
  booking.initSocketListeners()
  refreshMsStatus()
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('cursus:booking-create-type', onSidebarCreateType)
})

onUnmounted(() => {
  booking.disposeSocketListeners()
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('cursus:booking-create-type', onSidebarCreateType)
})
</script>

<template>
  <div class="tab-booking">
    <UiPageHeader
      title="Rendez-vous"
      subtitle="Pilote tes types de RDV, tes disponibilites et tes campagnes en un seul endroit."
      section="rex"
      :sticky="false"
    >
      <template #leading>
        <Calendar :size="18" aria-hidden="true" class="hdr-icon" />
      </template>
      <template #actions>
        <button
          type="button"
          class="ms-pill"
          :class="msConnected ? 'ms-pill--ok' : 'ms-pill--ko'"
          :title="msConnected ? 'Microsoft connecte — gerer dans Parametres > Integrations' : 'Microsoft non connecte — cliquer pour connecter'"
          @click="openSettingsIntegrations"
        >
          <span class="ms-dot" aria-hidden="true" />
          <span>{{ msConnected ? 'Microsoft' : 'Non connecte' }}</span>
          <Settings :size="11" aria-hidden="true" class="ms-gear" />
        </button>
        <UiButton variant="primary" size="sm" @click="triggerCreate">
          <template #leading><Plus :size="14" /></template>
          Nouveau type
          <kbd class="kbd" aria-hidden="true">Ctrl N</kbd>
        </UiButton>
      </template>
    </UiPageHeader>

    <!-- Skeleton pendant le chargement initial -->
    <div v-if="booking.loading.value" class="loading" aria-busy="true" role="status" aria-live="polite">
      <span class="visually-hidden">Chargement des rendez-vous...</span>
      <div class="loading-stats">
        <SkeletonLoader v-for="i in 4" :key="i" variant="card" :rows="1" />
      </div>
      <div class="loading-cols">
        <SkeletonLoader variant="list" :rows="6" />
        <SkeletonLoader variant="list" :rows="6" />
        <SkeletonLoader variant="list" :rows="6" />
      </div>
    </div>

    <template v-else>
      <!-- Stats strip -->
      <div class="stats-strip">
        <div class="stat-card">
          <CalendarPlus :size="13" class="stat-icon" aria-hidden="true" />
          <span class="stat-label">Types actifs</span>
          <span class="stat-value">
            {{ activeTypesCount }}<span class="stat-suffix">/{{ totalTypesCount || '—' }}</span>
          </span>
        </div>
        <div class="stat-card">
          <Users :size="13" class="stat-icon" aria-hidden="true" />
          <span class="stat-label">RDV cette semaine</span>
          <span class="stat-value">{{ bookingsThisWeekCount }}</span>
        </div>
        <div
          class="stat-card"
          :class="{ 'stat-card--alert': pendingCount > 0 }"
        >
          <AlertCircle :size="13" class="stat-icon" aria-hidden="true" />
          <span class="stat-label">En attente</span>
          <span class="stat-value">{{ pendingCount }}</span>
        </div>
        <div class="stat-card stat-card--accent">
          <Clock :size="13" class="stat-icon" aria-hidden="true" />
          <span class="stat-label">Prochain RDV</span>
          <span class="stat-value stat-value--text">{{ nextBookingShort }}</span>
        </div>
      </div>

      <!-- "Prochain RDV" callout (< 24h) -->
      <div v-if="showNextCallout && nextBooking" class="next-callout" role="region" aria-label="Prochain rendez-vous">
        <div class="next-icon" aria-hidden="true">
          <Clock :size="18" />
        </div>
        <div class="next-body">
          <span class="next-eyebrow">Prochain RDV</span>
          <strong class="next-title">
            {{ nextBooking.event_type_title || 'Rendez-vous' }}
            <span v-if="nextBooking.tutor_name" class="next-with">avec {{ nextBooking.tutor_name }}</span>
            <span v-else-if="nextBooking.student_name" class="next-with">avec {{ nextBooking.student_name }}</span>
          </strong>
          <span class="next-when">
            {{ nextBookingRelative }}
            <span class="next-sep" aria-hidden="true">·</span>
            {{ booking.formatTime(nextBooking.start_time) }} – {{ booking.formatTime(nextBooking.end_time) }}
          </span>
        </div>
        <a
          v-if="nextBooking.visio_url"
          :href="nextBooking.visio_url"
          target="_blank"
          rel="noopener"
          class="next-cta"
        >
          <Video :size="13" aria-hidden="true" />
          Rejoindre
        </a>
      </div>

      <CampaignManager />

      <div class="columns">
        <TabBookingEventTypes
          :booking="booking"
          :all-students="allStudents"
          :open-create-signal="openCreateSignal"
        />
        <TabBookingAvailability :booking="booking" />
        <TabBookingMyBookings :booking="booking" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.tab-booking {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  font-family: var(--font);
  color: var(--text-primary);
}

.hdr-icon { color: var(--color-rex); }

/* ── Microsoft pill ──────────────────────────────────────────────────────── */
.ms-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  cursor: pointer;
  color: var(--text-secondary);
  transition: background var(--motion-fast) var(--ease-out), border-color var(--motion-fast) var(--ease-out);
}
.ms-pill:hover { background: var(--bg-hover); border-color: var(--border-input); }
.ms-pill:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.ms-pill--ok { color: var(--color-success); border-color: color-mix(in srgb, var(--color-success) 35%, transparent); background: color-mix(in srgb, var(--color-success) 8%, transparent); }
.ms-pill--ko { color: var(--text-muted); }
.ms-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-muted);
}
.ms-pill--ok .ms-dot { background: var(--color-success); }
.ms-gear { color: var(--text-muted); }

/* Raccourci clavier visualise dans le bouton */
.kbd {
  font-family: ui-monospace, 'Consolas', monospace;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  background: rgba(255, 255, 255, .14);
  color: rgba(255, 255, 255, .9);
  margin-left: var(--space-xs);
  font-weight: 600;
}

/* ── Loading skeleton ────────────────────────────────────────────────────── */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.loading-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
}
.loading-cols {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1.5fr;
  gap: var(--space-md);
}
@media (max-width: 1100px) {
  .loading-stats { grid-template-columns: repeat(2, 1fr); }
  .loading-cols { grid-template-columns: 1fr; }
}

/* ── Stats strip ─────────────────────────────────────────────────────────── */
.stats-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
}
@media (max-width: 1100px) { .stats-strip { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 540px)  { .stats-strip { grid-template-columns: 1fr; } }

.stat-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  min-width: 0;
}
.stat-card--accent {
  border-color: color-mix(in srgb, var(--color-rex) 35%, transparent);
  background: color-mix(in srgb, var(--color-rex) 6%, var(--bg-elevated));
}
.stat-card--alert {
  border-color: color-mix(in srgb, var(--color-warning) 35%, transparent);
  background: color-mix(in srgb, var(--color-warning) 8%, var(--bg-elevated));
}
.stat-icon {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  color: var(--text-muted);
}
.stat-card--accent .stat-icon { color: var(--color-rex); }
.stat-card--alert  .stat-icon { color: var(--color-warning); }

.stat-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--text-muted);
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stat-value--text { font-size: 14px; font-weight: 600; }
.stat-suffix { font-size: 13px; font-weight: 600; color: var(--text-muted); margin-left: 2px; }

/* ── "Prochain RDV" callout ───────────────────────────────────────────────
   v2.273.7 — teinte color-rex (cyan) en lieu et place de l'accent generique
   pour matcher la signature visuelle de la section Rendez-vous. */
.next-callout {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--color-rex) 14%, var(--bg-elevated)) 0%,
    var(--bg-elevated) 70%
  );
  border: 1px solid color-mix(in srgb, var(--color-rex) 30%, var(--border));
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
}
.next-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-rex) 18%, transparent);
  color: var(--color-rex);
  flex-shrink: 0;
}
.next-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}
.next-eyebrow {
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--color-rex);
}
.next-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}
.next-with { font-weight: 500; color: var(--text-secondary); margin-left: 6px; }
.next-when {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.next-sep { margin: 0 var(--space-xs); }
.next-cta {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  background: var(--color-rex);
  color: #fff;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  transition: filter var(--motion-fast) var(--ease-out), transform var(--motion-fast) var(--ease-out);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--color-rex) 30%, transparent);
}
.next-cta:hover { filter: brightness(1.06); transform: translateY(-1px); }
.next-cta:focus-visible { outline: none; box-shadow: var(--focus-ring); }

@media (max-width: 720px) {
  .next-callout { flex-wrap: wrap; }
  .next-cta { margin-left: auto; }
}

/* ── Columns ─────────────────────────────────────────────────────────────── */
.columns {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1.5fr;
  gap: var(--space-md);
}
@media (max-width: 1100px) { .columns { grid-template-columns: 1fr; } }
</style>
