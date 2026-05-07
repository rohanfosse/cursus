<script setup lang="ts">
/**
 * BookingDetailModal — modal de detail d'un RDV (lecture seule).
 *
 * v2.321 — refonte facon "carte d'invitation" :
 *  - Hero avec bandeau couleur du type d'evenement et badge statut.
 *  - Bloc date + heure + duree mis en avant (hero-meta).
 *  - Sections distinctes pour les participants et la visio.
 *  - CTA visio plus prominent + copie du lien en un clic.
 *
 * Pas d'edition pour l'instant — le backend n'expose pas d'endpoint
 * d'annulation cote prof (seulement via le lien email d'invitation
 * : cf. BookingCancelView.vue).
 */
import { computed, ref } from 'vue'
import { Calendar, Clock, User, Briefcase, Video, Tag, Copy, Check, Hourglass, ExternalLink } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import { useToast } from '@/composables/useToast'
import { bookingHasRealTutor } from '@/utils/bookingHelpers'
import type { Booking, BookingHandle } from '@/composables/useBooking'

interface Props {
  modelValue: boolean
  booking: Booking | null
  bookingHandle: BookingHandle
}
const props = defineProps<Props>()
defineEmits<{ 'update:modelValue': [v: boolean] }>()

const { showToast } = useToast()

/** Couleur dynamique du type d'evenement (pour la barre d'accent). */
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

const durationLabel = computed<string>(() => {
  const m = durationMinutes.value
  if (m <= 0) return ''
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r === 0 ? `${h} h` : `${h} h ${r}`
})

const isPast = computed<boolean>(() => {
  if (!props.booking) return false
  const end = new Date(`${props.booking.date}T${props.booking.end_time}`)
  return !isNaN(end.getTime()) && end.getTime() < Date.now()
})

const copyState = ref<'idle' | 'copied'>('idle')

async function copyVisio() {
  if (!props.booking?.visio_url) return
  try {
    await navigator.clipboard.writeText(props.booking.visio_url)
    copyState.value = 'copied'
    showToast('Lien copie dans le presse-papier', 'success')
    setTimeout(() => { copyState.value = 'idle' }, 1500)
  } catch {
    showToast('Impossible de copier le lien', 'error')
  }
}
</script>

<template>
  <Modal :model-value="modelValue" max-width="540px" @update:model-value="$emit('update:modelValue', $event)">
    <div v-if="booking" class="bdm" :style="{ '--bdm-accent': accent }">
      <!-- Hero : bandeau couleur + statut -->
      <header class="bdm-hero">
        <div class="bdm-hero-strip" aria-hidden="true" />
        <div class="bdm-hero-body">
          <div class="bdm-hero-row">
            <span class="bdm-hero-type">
              <span class="bdm-hero-dot" aria-hidden="true" />
              {{ booking.event_type_title || 'Rendez-vous' }}
            </span>
            <span class="bdm-status" :class="bookingHandle.statusClass(booking.status)">
              {{ bookingHandle.statusLabel(booking.status) }}
            </span>
          </div>
          <h2 class="bdm-title">
            {{ booking.event_type_title || 'Rendez-vous' }}
            <span v-if="booking.student_name" class="bdm-title-with">avec {{ booking.student_name }}</span>
          </h2>
          <div class="bdm-hero-meta">
            <span class="bdm-hero-chip">
              <Calendar :size="13" aria-hidden="true" />
              {{ dateLong }}
            </span>
            <span class="bdm-hero-chip">
              <Clock :size="13" aria-hidden="true" />
              {{ timeRange }}
            </span>
            <span v-if="durationLabel" class="bdm-hero-chip bdm-hero-chip--soft">
              <Hourglass :size="12" aria-hidden="true" />
              {{ durationLabel }}
            </span>
            <span v-if="isPast" class="bdm-hero-chip bdm-hero-chip--past">passe</span>
          </div>
        </div>
      </header>

      <!-- Sections -->
      <section v-if="booking.event_type_title || booking.student_name || bookingHasRealTutor(booking)" class="bdm-section">
        <h3 class="bdm-section-title">Participants &amp; details</h3>
        <ul class="bdm-rows" role="list">
          <li v-if="booking.event_type_title" class="bdm-row">
            <Tag :size="15" aria-hidden="true" />
            <div>
              <span class="bdm-row-label">Type de RDV</span>
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
        </ul>
      </section>

      <section v-if="booking.visio_url" class="bdm-section bdm-section--visio">
        <h3 class="bdm-section-title">Visioconference</h3>
        <div class="bdm-visio-card">
          <Video :size="18" aria-hidden="true" class="bdm-visio-icon" />
          <a :href="booking.visio_url" target="_blank" rel="noopener" class="bdm-visio-link" :title="booking.visio_url">
            {{ booking.visio_url }}
          </a>
          <button
            type="button"
            class="bdm-copy-btn"
            :aria-label="copyState === 'copied' ? 'Lien copie' : 'Copier le lien visio'"
            :title="copyState === 'copied' ? 'Lien copie' : 'Copier'"
            @click="copyVisio"
          >
            <Check v-if="copyState === 'copied'" :size="14" aria-hidden="true" />
            <Copy v-else :size="14" aria-hidden="true" />
          </button>
        </div>
      </section>

      <!-- Footer CTA -->
      <footer class="bdm-footer">
        <button type="button" class="bdm-btn bdm-btn--ghost" @click="$emit('update:modelValue', false)">
          Fermer
        </button>
        <a
          v-if="booking.visio_url && !isPast"
          :href="booking.visio_url"
          target="_blank"
          rel="noopener"
          class="bdm-btn bdm-btn--cta"
        >
          <Video :size="14" aria-hidden="true" />
          Rejoindre la visio
          <ExternalLink :size="12" aria-hidden="true" class="bdm-btn-trailing" />
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
  gap: 0;
  font-family: var(--font);
  color: var(--text-primary);
}

/* ── Hero ─────────────────────────────────────────────── */
.bdm-hero {
  position: relative;
  padding: 22px 24px 18px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--bdm-accent) 14%, var(--bg-main)) 0%,
    var(--bg-main) 100%
  );
  border-bottom: 1px solid var(--border);
}
.bdm-hero-strip {
  position: absolute; left: 0; right: 0; top: 0; height: 4px;
  background: var(--bdm-accent);
  border-top-left-radius: var(--radius);
  border-top-right-radius: var(--radius);
}
.bdm-hero-body { display: flex; flex-direction: column; gap: 10px; }
.bdm-hero-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bdm-hero-type {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700;
  color: var(--bdm-accent);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.bdm-hero-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--bdm-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--bdm-accent) 22%, transparent);
}
.bdm-status {
  margin-left: auto;
  display: inline-flex;
  font-size: 10px; font-weight: 700;
  padding: 3px 9px; border-radius: 999px;
  text-transform: uppercase; letter-spacing: .04em;
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

.bdm-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  letter-spacing: -0.015em;
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px;
}
.bdm-title-with {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: -0.01em;
}

.bdm-hero-meta {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-top: 4px;
}
.bdm-hero-chip {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 600;
  padding: 5px 10px; border-radius: 999px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.bdm-hero-chip svg { color: var(--bdm-accent); }
.bdm-hero-chip--soft { color: var(--text-secondary); font-weight: 500; }
.bdm-hero-chip--past {
  background: var(--bg-hover);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 10px;
  font-weight: 700;
  padding: 5px 9px;
}

/* ── Sections ─────────────────────────────────────────── */
.bdm-section {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
}
.bdm-section:last-of-type { border-bottom: none; }
.bdm-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin: 0 0 10px;
}

.bdm-rows {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 10px;
}
.bdm-row {
  display: flex; gap: 12px;
  align-items: flex-start;
  font-size: 13px; color: var(--text-primary);
}
.bdm-row svg {
  color: var(--bdm-accent);
  flex-shrink: 0; margin-top: 2px;
}
.bdm-row > div {
  display: flex; flex-direction: column; gap: 1px;
  min-width: 0; flex: 1;
}
.bdm-row-label {
  font-size: 10.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .04em;
  color: var(--text-muted);
}
.bdm-row-value {
  font-size: 13.5px; font-weight: 600; color: var(--text-primary);
}

/* ── Visio card (CTA secondaire) ──────────────────────── */
.bdm-visio-card {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--bdm-accent) 6%, var(--bg-elevated));
  border: 1px solid color-mix(in srgb, var(--bdm-accent) 26%, var(--border));
  border-radius: var(--radius);
}
.bdm-visio-icon { color: var(--bdm-accent); flex-shrink: 0; }
.bdm-visio-link {
  flex: 1; min-width: 0;
  font-size: 12.5px;
  color: var(--bdm-accent);
  font-family: var(--font-mono);
  text-decoration: none;
  word-break: break-all;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}
.bdm-visio-link:hover { text-decoration: underline; }
.bdm-copy-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-main);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  flex-shrink: 0;
}
.bdm-copy-btn:hover {
  background: var(--bg-hover);
  color: var(--bdm-accent);
  border-color: var(--bdm-accent);
}
.bdm-copy-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* ── Footer ────────────────────────────────────────────── */
.bdm-footer {
  display: flex; align-items: center; justify-content: flex-end;
  gap: 8px;
  padding: 12px 24px 18px;
  background: var(--bg-main);
}
.bdm-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  border: 1px solid transparent;
  transition: filter var(--motion-fast) var(--ease-out),
              transform var(--motion-fast) var(--ease-out),
              background-color 0.12s, color 0.12s;
}
.bdm-btn--ghost {
  background: transparent;
  color: var(--text-secondary);
  border-color: var(--border);
}
.bdm-btn--ghost:hover { background: var(--bg-hover); color: var(--text-primary); }
.bdm-btn--cta {
  background: var(--cta);
  color: #fff;
  box-shadow: 0 2px 10px color-mix(in srgb, var(--cta) 26%, transparent);
}
.bdm-btn--cta:hover { filter: brightness(1.06); transform: translateY(-1px); }
.bdm-btn-trailing { opacity: 0.7; }
.bdm-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }
</style>
