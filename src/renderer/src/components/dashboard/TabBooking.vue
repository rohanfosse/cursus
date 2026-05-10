<script setup lang="ts">
/**
 * TabBooking.vue — page d'accueil RDV cote prof.
 *
 * Refonte v2.314 : reduction de la surcharge.
 *   - La sidebar (SidebarBooking) gere deja CTA principal, status MS/SMTP,
 *     prochains RDV detailles, stats. La page principale ne duplique plus.
 *   - Stats strip plus compacte (chips horizontaux, hauteur reduite).
 *   - Plus de "Prochain RDV" callout (doublon avec sidebar + stat).
 *   - Plus de pill Microsoft dans le header (presente dans la sidebar).
 *   - CampaignManager n'est plus en bandeau permanent : passe en 4eme tab,
 *     aux cotes de Mes RDV / Types / Disponibilites.
 *
 * Layout :
 *   1. UiPageHeader : titre + sous-titre + CTA "Nouveau type" (Ctrl+N)
 *   2. Stats strip compacte : 4 chips (types · semaine · en attente · campagnes)
 *   3. Tabs : Mes RDV (default) / Types / Campagnes / Disponibilites
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  Calendar, Plus, CalendarCheck, LayoutGrid, CalendarRange, CalendarPlus, Clock,
} from 'lucide-vue-next'
import CampaignManager from '@/components/booking/CampaignManager.vue'
import TabBookingEventTypes from './TabBookingEventTypes.vue'
import TabBookingAvailability from './TabBookingAvailability.vue'
import TabBookingMyBookings from './TabBookingMyBookings.vue'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import UiButton from '@/components/ui/UiButton.vue'
import MobileMenuButton from '@/components/layout/MobileMenuButton.vue'
import SkeletonLoader from '@/components/ui/SkeletonLoader.vue'
import { useBooking } from '@/composables/useBooking'
import { useCampaigns } from '@/composables/useCampaigns'

defineProps<{
  allStudents: Array<{ id: number; name?: string; email?: string; promo_id?: number }>
  toggleSidebar?: () => void
}>()

const booking = useBooking()
const { campaigns, fetchAll: fetchCampaigns } = useCampaigns()

// Signal pour ouvrir le formulaire de creation depuis le parent (CTA + Ctrl+N)
const openCreateSignal = ref(0)
function triggerCreate() {
  openCreateSignal.value++
  activeView.value = 'types'
}

// ── Vue active : tabs Mes RDV / Types / Campagnes / Disponibilites ─────────
type BookingView = 'bookings' | 'types' | 'campaigns' | 'availability'
const activeView = ref<BookingView>('bookings')

// ── Stats compactes ────────────────────────────────────────────────────────

const activeTypesCount = computed(() =>
  booking.eventTypes.value.filter(et => et.is_active).length,
)

const bookingsThisWeekCount = computed(() => {
  const now = new Date()
  const day = now.getDay()
  const offset = day === 0 ? 6 : day - 1
  const start = new Date(now)
  start.setDate(now.getDate() - offset)
  start.setHours(0, 0, 0, 0)
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

const activeCampaignsCount = computed(() =>
  campaigns.value.filter(c => c.status === 'active').length,
)
const draftCampaignsCount = computed(() =>
  campaigns.value.filter(c => c.status === 'draft').length,
)

// ── Lifecycle + raccourci clavier ─────────────────────────────────────────

function onKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey && !e.altKey) {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
    e.preventDefault()
    triggerCreate()
  }
}

function onSidebarCreateType() { triggerCreate() }

onMounted(() => {
  booking.fetchAll()
  booking.initSocketListeners()
  fetchCampaigns()
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('cursus:booking-create-type', onSidebarCreateType)
})

onUnmounted(() => {
  booking.disposeSocketListeners()
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('cursus:booking-create-type', onSidebarCreateType)
})

function selectStat(view: BookingView) {
  activeView.value = view
}
</script>

<template>
  <div class="tab-booking">
    <UiPageHeader
      title="Rendez-vous"
      subtitle="Pilote tes types de RDV, tes disponibilites et tes campagnes."
      section="rex"
      :sticky="false"
    >
      <template #leading>
        <MobileMenuButton :toggle-sidebar="toggleSidebar" />
        <Calendar :size="18" aria-hidden="true" class="hdr-icon" />
      </template>
      <template #actions>
        <UiButton variant="cta" size="sm" @click="triggerCreate">
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
      <SkeletonLoader variant="list" :rows="8" />
    </div>

    <template v-else>
      <!-- Stats strip compacte : 4 chips cliquables qui filtrent l'onglet
           v2.314 — passees de cards 22px verticales a chips horizontales
           pour reduire la hauteur visuelle et aligner sur les pills tabs. -->
      <div class="stats-strip" role="group" aria-label="Vue d'ensemble">
        <button
          type="button"
          class="stat-chip"
          :class="{ 'stat-chip--active': activeView === 'types' }"
          @click="selectStat('types')"
        >
          <CalendarPlus :size="13" class="stat-icon" aria-hidden="true" />
          <span class="stat-value">{{ activeTypesCount }}</span>
          <span class="stat-label">type<template v-if="activeTypesCount > 1">s</template></span>
        </button>
        <button
          type="button"
          class="stat-chip"
          :class="{ 'stat-chip--active': activeView === 'bookings' }"
          @click="selectStat('bookings')"
        >
          <CalendarCheck :size="13" class="stat-icon" aria-hidden="true" />
          <span class="stat-value">{{ bookingsThisWeekCount }}</span>
          <span class="stat-label">cette semaine</span>
        </button>
        <button
          type="button"
          class="stat-chip"
          :class="{
            'stat-chip--alert': pendingCount > 0,
            'stat-chip--active': activeView === 'bookings',
          }"
          :title="pendingCount > 0 ? `${pendingCount} RDV en attente de confirmation` : 'Aucun RDV en attente'"
          @click="selectStat('bookings')"
        >
          <span class="stat-value">{{ pendingCount }}</span>
          <span class="stat-label">en attente</span>
        </button>
        <button
          type="button"
          class="stat-chip"
          :class="{ 'stat-chip--active': activeView === 'campaigns' }"
          :title="`${activeCampaignsCount} active(s)${draftCampaignsCount ? `, ${draftCampaignsCount} brouillon(s)` : ''}`"
          @click="selectStat('campaigns')"
        >
          <CalendarRange :size="13" class="stat-icon" aria-hidden="true" />
          <span class="stat-value">
            {{ activeCampaignsCount }}<span v-if="draftCampaignsCount" class="stat-suffix">+{{ draftCampaignsCount }}</span>
          </span>
          <span class="stat-label">campagne<template v-if="activeCampaignsCount > 1">s</template></span>
        </button>
      </div>

      <!-- Tabs : Mes RDV / Types / Campagnes / Disponibilites -->
      <div class="bk-view-tabs" role="tablist" aria-label="Vue des rendez-vous">
        <button
          type="button"
          class="bk-view-tab"
          :class="{ 'bk-view-tab--active': activeView === 'bookings' }"
          role="tab"
          :aria-selected="activeView === 'bookings'"
          @click="activeView = 'bookings'"
        >
          <CalendarCheck :size="13" aria-hidden="true" />
          Mes rendez-vous
        </button>
        <button
          type="button"
          class="bk-view-tab"
          :class="{ 'bk-view-tab--active': activeView === 'types' }"
          role="tab"
          :aria-selected="activeView === 'types'"
          @click="activeView = 'types'"
        >
          <LayoutGrid :size="13" aria-hidden="true" />
          Types
        </button>
        <button
          type="button"
          class="bk-view-tab"
          :class="{ 'bk-view-tab--active': activeView === 'campaigns' }"
          role="tab"
          :aria-selected="activeView === 'campaigns'"
          @click="activeView = 'campaigns'"
        >
          <CalendarRange :size="13" aria-hidden="true" />
          Campagnes
        </button>
        <button
          type="button"
          class="bk-view-tab"
          :class="{ 'bk-view-tab--active': activeView === 'availability' }"
          role="tab"
          :aria-selected="activeView === 'availability'"
          @click="activeView = 'availability'"
        >
          <Clock :size="13" aria-hidden="true" />
          Disponibilités
        </button>
      </div>

      <div class="bk-view-pane">
        <TabBookingMyBookings
          v-if="activeView === 'bookings'"
          :booking="booking"
          :all-students="allStudents"
        />
        <TabBookingEventTypes
          v-else-if="activeView === 'types'"
          :booking="booking"
          :all-students="allStudents"
          :open-create-signal="openCreateSignal"
        />
        <CampaignManager v-else-if="activeView === 'campaigns'" />
        <TabBookingAvailability v-else :booking="booking" />
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

/* Raccourci clavier visualise dans le bouton CTA */
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
  gap: var(--space-sm);
}
@media (max-width: 1100px) {
  .loading-stats { grid-template-columns: repeat(2, 1fr); }
}

/* ── Stats strip compacte (chips horizontaux) ──────────────────────────────
   v2.314 — refonte : passees de cards verticales 22px a chips inline.
   Hauteur divisee par ~2, lecture horizontale plus rapide, cliquable
   pour filtrer l'onglet correspondant (continuum visuel avec les tabs). */
.stats-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-sm);
}
@media (max-width: 1100px) { .stats-strip { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 540px)  { .stats-strip { grid-template-columns: 1fr 1fr; } }

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  min-width: 0;
  transition: background var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out);
}
.stat-chip:hover {
  background: var(--bg-hover);
  border-color: color-mix(in srgb, var(--color-rex) 35%, var(--border));
}
.stat-chip:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.stat-chip--active {
  border-color: color-mix(in srgb, var(--color-rex) 45%, var(--border));
  background: color-mix(in srgb, var(--color-rex) 6%, var(--bg-elevated));
}
.stat-chip--alert {
  border-color: color-mix(in srgb, var(--color-warning) 35%, transparent);
  background: color-mix(in srgb, var(--color-warning) 8%, var(--bg-elevated));
}
.stat-chip--alert .stat-value { color: var(--color-warning); }

.stat-icon { color: var(--color-rex); flex-shrink: 0; }
.stat-chip--alert .stat-icon { color: var(--color-warning); }

.stat-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  flex-shrink: 0;
}
.stat-suffix {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-left: 1px;
}
.stat-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Tabs vues (Mes RDV / Types / Campagnes / Disponibilites) ───────────── */
.bk-view-tabs {
  display: flex;
  gap: 6px;
  padding: 2px 0 6px;
  overflow-x: auto;
  scrollbar-width: none;
  flex-wrap: wrap;
}
.bk-view-tabs::-webkit-scrollbar { display: none; }
.bk-view-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 999px;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--border);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out);
}
.bk-view-tab:hover {
  color: var(--color-rex);
  background: color-mix(in srgb, var(--color-rex) 8%, transparent);
  border-color: color-mix(in srgb, var(--color-rex) 32%, transparent);
}
.bk-view-tab:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.bk-view-tab--active {
  background: var(--color-rex);
  color: #fff;
  border-color: var(--color-rex);
  font-weight: 700;
}
.bk-view-tab--active:hover { color: #fff; background: var(--color-rex); }

/* Pane : contient une seule vue a la fois. */
.bk-view-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
</style>
