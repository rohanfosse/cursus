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
  font-size: 14px;
  font-weight: 700;
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
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-out);
}
.view-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.view-btn.active { background: var(--accent); color: #fff; }
.view-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.booking-list { display: flex; flex-direction: column; gap: var(--space-xs); max-height: 440px; overflow-y: auto; }
.booking-card {
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm) var(--space-md);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.bk-date, .bk-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
.bk-type { font-size: 12px; font-weight: 600; }
.bk-people { display: flex; gap: var(--space-sm); font-size: 11px; color: var(--text-secondary); }
.bk-person::before { content: "— "; }
.bk-badge {
  display: inline-block;
  align-self: flex-start;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  margin-top: 2px;
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
