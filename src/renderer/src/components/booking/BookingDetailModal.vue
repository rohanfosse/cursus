<script setup lang="ts">
/**
 * BookingDetailModal — modal de detail d'un RDV (lecture seule).
 *
 * Ouvre quand le prof clique sur un bloc du calendrier ou une carte de
 * la liste "Mes RDV". Affiche : type + couleur, date longue, plage
 * horaire, participants (etudiant / tuteur), statut, lien visio.
 *
 * Pas d'edition pour l'instant — le backend n'expose pas d'endpoint
 * d'annulation cote prof (seulement via le lien email d'invitation
 * : cf. BookingCancelView.vue).
 */
import { computed } from 'vue'
import { Calendar, Clock, User, Briefcase, Video, Tag } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import { bookingHasRealTutor } from '@/utils/bookingHelpers'
import type { Booking, BookingHandle } from '@/composables/useBooking'

interface Props {
  modelValue: boolean
  booking: Booking | null
  bookingHandle: BookingHandle
}
const props = defineProps<Props>()
defineEmits<{ 'update:modelValue': [v: boolean] }>()

/** Couleur dynamique du type (pour la barre d'accent). */
const accent = computed<string>(() => {
  if (!props.booking) return 'var(--color-rex)'
  const et = props.bookingHandle.eventTypes.value.find(
    e => e.title === props.booking?.event_type_title,
  )
  return et?.color ?? 'var(--color-rex)'
})

const dateLong = computed<string>(() => {
  if (!props.booking) return ''
  const d = new Date(`${props.booking.date}T${props.booking.start_time}`)
  return d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

const timeRange = computed<string>(() => {
  if (!props.booking) return ''
  const start = props.bookingHandle.formatTime(props.booking.start_time)
  const end = props.bookingHandle.formatTime(props.booking.end_time)
  return `${start} – ${end}`
})

const durationMinutes = computed<number>(() => {
  if (!props.booking) return 0
  const [sh, sm] = props.booking.start_time.split(':').map(Number)
  const [eh, em] = props.booking.end_time.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
})
</script>

<template>
  <Modal :model-value="modelValue" max-width="480px" @update:model-value="$emit('update:modelValue', $event)">
    <div v-if="booking" class="bdm" :style="{ '--bdm-accent': accent }">
      <header class="bdm-head">
        <span class="bdm-dot" aria-hidden="true" />
        <div class="bdm-head-text">
          <h2 class="bdm-title">{{ booking.event_type_title || 'Rendez-vous' }}</h2>
          <span class="bdm-status" :class="bookingHandle.statusClass(booking.status)">
            {{ bookingHandle.statusLabel(booking.status) }}
          </span>
        </div>
      </header>

      <ul class="bdm-rows" role="list">
        <li class="bdm-row">
          <Calendar :size="15" aria-hidden="true" />
          <div>
            <span class="bdm-row-value">{{ dateLong }}</span>
          </div>
        </li>
        <li class="bdm-row">
          <Clock :size="15" aria-hidden="true" />
          <div>
            <span class="bdm-row-value">{{ timeRange }}</span>
            <span class="bdm-row-meta">{{ durationMinutes }} min</span>
          </div>
        </li>
        <li v-if="booking.event_type_title" class="bdm-row">
          <Tag :size="15" aria-hidden="true" />
          <div>
            <span class="bdm-row-value">{{ booking.event_type_title }}</span>
          </div>
        </li>
        <li v-if="booking.student_name" class="bdm-row">
          <User :size="15" aria-hidden="true" />
          <div>
            <span class="bdm-row-label">Etudiant</span>
            <span class="bdm-row-value">{{ booking.student_name }}</span>
          </div>
        </li>
        <li v-if="bookingHasRealTutor(booking)" class="bdm-row">
          <Briefcase :size="15" aria-hidden="true" />
          <div>
            <span class="bdm-row-label">Tuteur entreprise</span>
            <span class="bdm-row-value">{{ booking.tutor_name }}</span>
          </div>
        </li>
        <li v-if="booking.visio_url" class="bdm-row">
          <Video :size="15" aria-hidden="true" />
          <div class="bdm-visio">
            <span class="bdm-row-label">Visioconference</span>
            <a :href="booking.visio_url" target="_blank" rel="noopener" class="bdm-visio-link">
              {{ booking.visio_url }}
            </a>
          </div>
        </li>
      </ul>

      <footer class="bdm-footer">
        <UiButton variant="ghost" size="sm" @click="$emit('update:modelValue', false)">
          Fermer
        </UiButton>
        <a
          v-if="booking.visio_url"
          :href="booking.visio_url"
          target="_blank"
          rel="noopener"
          class="bdm-cta"
        >
          <Video :size="14" aria-hidden="true" />
          Rejoindre la visio
        </a>
      </footer>
    </div>
  </Modal>
</template>

<style scoped>
.bdm {
  --bdm-accent: var(--color-rex);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  font-family: var(--font);
  color: var(--text-primary);
}

.bdm-head {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--border);
}
.bdm-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--bdm-accent);
  margin-top: 6px;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--bdm-accent) 22%, transparent);
  flex-shrink: 0;
}
.bdm-head-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.bdm-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.25;
  letter-spacing: -0.01em;
}
.bdm-status {
  display: inline-flex;
  align-self: flex-start;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.bdm-status.badge-success {
  background: color-mix(in srgb, var(--color-success) 15%, transparent);
  color: var(--color-success);
}
.bdm-status.badge-warning {
  background: color-mix(in srgb, var(--color-warning) 15%, transparent);
  color: var(--color-warning);
}
.bdm-status.badge-danger {
  background: color-mix(in srgb, var(--color-danger) 15%, transparent);
  color: var(--color-danger);
}

.bdm-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bdm-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  font-size: 13px;
  color: var(--text-primary);
}
.bdm-row svg {
  color: var(--bdm-accent);
  flex-shrink: 0;
  margin-top: 2px;
}
.bdm-row > div {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  flex: 1;
}
.bdm-row-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--text-muted);
}
.bdm-row-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.bdm-row-meta {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: 6px;
  font-weight: 500;
}
.bdm-visio { min-width: 0; }
.bdm-visio-link {
  font-size: 12px;
  color: var(--bdm-accent);
  text-decoration: none;
  word-break: break-all;
  font-family: var(--font-mono);
}
.bdm-visio-link:hover { text-decoration: underline; }

.bdm-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--space-xs);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--border);
}
.bdm-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  background: var(--cta);
  color: #fff;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  transition: filter var(--motion-fast) var(--ease-out), transform var(--motion-fast) var(--ease-out);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--cta) 25%, transparent);
}
.bdm-cta:hover { filter: brightness(1.06); transform: translateY(-1px); }
.bdm-cta:focus-visible { outline: none; box-shadow: var(--focus-ring); }
</style>
