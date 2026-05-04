<script setup lang="ts">
/**
 * TabBookingMyBookings.vue — section "Mes RDV" de TabBooking.
 *
 * Toggle entre vue calendrier (BookingCalendarView) et vue liste.
 * Vue liste : carte par RDV avec date, heure, type, parties prenantes
 * et badge de statut.
 */
import { ref } from 'vue'
import { Users, LayoutList, CalendarDays, Calendar, Clock } from 'lucide-vue-next'
import BookingCalendarView from './BookingCalendarView.vue'
import { type BookingHandle } from '@/composables/useBooking'

const props = defineProps<{ booking: BookingHandle }>()
void props // utilise via destructuration template

const bookingsView = ref<'list' | 'calendar'>('calendar')
</script>

<template>
  <div class="col col-bookings">
    <div class="col-header">
      <Users :size="14" aria-hidden="true" />
      <span>Mes RDV</span>
      <span
        v-if="booking.sortedBookings.value.length > 0"
        class="col-count"
        :title="`${booking.sortedBookings.value.length} RDV`"
      >
        {{ booking.sortedBookings.value.length }}
      </span>
      <div class="view-toggle" role="tablist" aria-label="Vue des RDV">
        <button
          type="button"
          class="view-btn"
          :class="{ active: bookingsView === 'calendar' }"
          aria-label="Vue calendrier"
          :aria-pressed="bookingsView === 'calendar'"
          role="tab"
          @click="bookingsView = 'calendar'"
        >
          <CalendarDays :size="12" />
        </button>
        <button
          type="button"
          class="view-btn"
          :class="{ active: bookingsView === 'list' }"
          aria-label="Vue liste"
          :aria-pressed="bookingsView === 'list'"
          role="tab"
          @click="bookingsView = 'list'"
        >
          <LayoutList :size="12" />
        </button>
      </div>
    </div>

    <BookingCalendarView
      v-if="bookingsView === 'calendar'"
      :bookings="booking.sortedBookings.value"
      :event-types="booking.eventTypes.value"
    />

    <div v-else class="booking-list">
      <div v-for="bk in booking.sortedBookings.value" :key="bk.id" class="booking-card">
        <div class="bk-date">
          <Calendar :size="11" aria-hidden="true" /> {{ booking.formatDate(bk.date) }}
        </div>
        <div class="bk-time">
          <Clock :size="11" aria-hidden="true" />
          {{ booking.formatTime(bk.start_time) }} – {{ booking.formatTime(bk.end_time) }}
        </div>
        <div v-if="bk.event_type_title" class="bk-type">{{ bk.event_type_title }}</div>
        <div class="bk-people">
          <span v-if="bk.tutor_name" class="bk-person">{{ bk.tutor_name }}</span>
          <span v-if="bk.student_name" class="bk-person">{{ bk.student_name }}</span>
        </div>
        <span class="bk-badge" :class="booking.statusClass(bk.status)">
          {{ booking.statusLabel(bk.status) }}
        </span>
      </div>
      <div v-if="booking.sortedBookings.value.length === 0" class="empty-state">
        Aucun rendez-vous a venir
      </div>
    </div>
  </div>
</template>

<style scoped>
.col {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  min-width: 0;
}
.col-header {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid var(--border);
}
.col-count {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 1px 7px;
  border-radius: 999px;
  font-variant-numeric: tabular-nums;
}

.view-toggle { display: flex; gap: 2px; margin-left: auto; }
.view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-xs);
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-out);
}
.view-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.view-btn.active { background: var(--accent); color: #fff; }
.view-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }

/* v2.273.7 — alignement style landing booking : cards en grid avec
   colonne date a gauche (rex teint), info au milieu, badge a droite. */
.booking-list { display: flex; flex-direction: column; gap: 8px; max-height: 440px; overflow-y: auto; padding-right: 2px; }
.booking-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-left: 3px solid var(--color-rex);
  border-radius: var(--radius);
  padding: 10px var(--space-md);
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  align-items: center;
  gap: var(--space-sm);
  transition: transform var(--motion-fast) var(--ease-out),
              box-shadow var(--motion-fast) var(--ease-out);
}
.booking-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--color-rex) 14%, transparent);
}
.bk-date, .bk-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--color-rex);
}
.bk-time { color: var(--text-secondary); }
.bk-type {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.05px;
  grid-column: 1 / -1;
  margin-top: 2px;
}
.bk-people {
  display: flex;
  gap: var(--space-sm);
  font-size: 11px;
  color: var(--text-secondary);
  grid-column: 1 / -1;
}
.bk-person::before { content: "— "; opacity: .6; }
.bk-badge {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: .04em;
  justify-self: end;
}
.bk-badge.badge-success {
  background: color-mix(in srgb, var(--color-success) 15%, transparent);
  color: var(--color-success);
}
.bk-badge.badge-warning {
  background: color-mix(in srgb, var(--color-warning) 15%, transparent);
  color: var(--color-warning);
}
.bk-badge.badge-danger {
  background: color-mix(in srgb, var(--color-danger) 15%, transparent);
  color: var(--color-danger);
}
.empty-state { text-align: center; font-size: 12px; color: var(--text-muted); padding: 20px 0; }
</style>
