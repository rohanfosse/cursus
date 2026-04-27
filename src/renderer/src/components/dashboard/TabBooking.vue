<script setup lang="ts">
/**
 * TabBooking.vue — onglet "Rendez-vous" du dashboard prof.
 *
 * Orchestrateur leger : instancie une seule fois useBooking + initialise
 * les listeners socket, puis delegue aux 3 sections specialisees :
 *   - TabBookingEventTypes  : types de RDV + creation + lien public/jitsi/bulk
 *   - TabBookingAvailability : grille hebdo des disponibilites
 *   - TabBookingMyBookings   : vue liste/calendrier des RDV recus
 *
 * Le composable useBooking est passe via prop `booking` aux 3 sections
 * pour eviter de dupliquer fetch + state + listeners.
 */
import { onMounted, onUnmounted } from 'vue'
import { Calendar, Settings } from 'lucide-vue-next'
import CampaignManager from '@/components/booking/CampaignManager.vue'
import TabBookingEventTypes from './TabBookingEventTypes.vue'
import TabBookingAvailability from './TabBookingAvailability.vue'
import TabBookingMyBookings from './TabBookingMyBookings.vue'
import { useBooking } from '@/composables/useBooking'
import { useMicrosoftConnection } from '@/composables/useMicrosoftConnection'
import { useModalsStore } from '@/stores/modals'

defineProps<{
  allStudents: Array<{ id: number; name?: string; email?: string; promo_id?: number }>
}>()

const booking = useBooking()

const { connected: msConnected, refresh: refreshMsStatus } = useMicrosoftConnection()
const modalsStore = useModalsStore()

function openSettingsIntegrations() {
  modalsStore.settings = true
}

onMounted(() => {
  booking.fetchAll()
  booking.initSocketListeners()
  refreshMsStatus()
})

onUnmounted(() => {
  booking.disposeSocketListeners()
})
</script>

<template>
  <div class="tab-booking">
    <header class="top-bar">
      <div class="top-title">
        <Calendar :size="18" aria-hidden="true" />
        <span>Rendez-vous</span>
      </div>
      <button
        type="button"
        class="ms-status ms-status-btn"
        :title="msConnected ? 'Microsoft connecte — gerer dans Parametres > Integrations' : 'Se connecter dans Parametres > Integrations'"
        @click="openSettingsIntegrations"
      >
        <span class="ms-dot" :class="msConnected ? 'connected' : 'disconnected'" aria-hidden="true" />
        <span class="ms-label">
          {{ msConnected ? 'Microsoft connecte' : 'Microsoft non connecte' }}
        </span>
        <Settings :size="12" class="ms-gear" aria-hidden="true" />
      </button>
    </header>

    <div v-if="booking.loading.value" class="loading-state" role="status" aria-live="polite">
      Chargement...
    </div>

    <CampaignManager v-else />

    <div v-if="!booking.loading.value" class="columns">
      <TabBookingEventTypes :booking="booking" :all-students="allStudents" />
      <TabBookingAvailability :booking="booking" />
      <TabBookingMyBookings :booking="booking" />
    </div>
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

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.top-title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 14px;
  font-weight: 700;
}

.ms-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  padding: 4px var(--space-sm);
  cursor: pointer;
  color: var(--text-secondary);
  font-family: inherit;
  transition: background var(--motion-fast) var(--ease-out), border-color var(--motion-fast) var(--ease-out);
}
.ms-status:hover { background: var(--bg-hover); border-color: var(--border); }
.ms-status:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.ms-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.ms-dot.connected { background: var(--color-success); }
.ms-dot.disconnected { background: var(--text-muted); }
.ms-label { color: var(--text-secondary); }
.ms-gear { color: var(--text-muted); }

.loading-state {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-size: 12px;
}

.columns {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1.5fr;
  gap: var(--space-md);
}
@media (max-width: 1100px) {
  .columns { grid-template-columns: 1fr; }
}
</style>
