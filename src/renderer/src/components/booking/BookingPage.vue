/**
 * BookingPage.vue — 3-step public booking flow for tutors.
 * Step 1: Calendar slot picker
 * Step 2: Details form (tutor name + email)
 * Step 3: Confirmation (Teams link, .ics download, cancel link)
 */
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'
import { Calendar, Clock, User, Mail, ChevronLeft, ChevronRight, Check, Video, Download, ArrowLeft, Copy, CalendarPlus } from 'lucide-vue-next'
import { usePublicBooking, type BookingSlot } from '@/composables/usePublicBooking'
import { useContextMenu } from '@/composables/useContextMenu'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'

const props = defineProps<{ token: string }>()

const {
  eventInfo, slots, weekStart, selectedSlot, step,
  loading, error, bookingResult,
  slotsByDate,
  fetchEventInfo, fetchSlots, selectSlot, backToCalendar, bookSlot,
  icsUrl,
} = usePublicBooking(props.token)

const weekOffset = ref(0)
const tutorName = ref('')
const tutorEmail = ref('')
const submitting = ref(false)

// Week days from weekStart
const weekDays = computed(() => {
  if (!weekStart.value) return []
  const start = new Date(weekStart.value + 'T00:00:00')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return {
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('fr-FR', { weekday: 'short' }),
      day: d.getDate(),
      month: d.toLocaleDateString('fr-FR', { month: 'short' }),
      isToday: d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10),
    }
  })
})

const weekLabel = computed(() => {
  if (!weekDays.value.length) return ''
  const first = weekDays.value[0]
  const last = weekDays.value[6]
  return `${first.day} ${first.month} - ${last.day} ${last.month}`
})

async function prevWeek() {
  if (weekOffset.value <= 0) return
  weekOffset.value--
  await fetchSlots(weekOffset.value)
}

async function nextWeek() {
  if (weekOffset.value >= 12) return
  weekOffset.value++
  await fetchSlots(weekOffset.value)
}

async function onSubmit() {
  if (!tutorName.value.trim() || !tutorEmail.value.trim()) return
  submitting.value = true
  await bookSlot(tutorName.value.trim(), tutorEmail.value.trim())
  submitting.value = false
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

onMounted(async () => {
  await fetchEventInfo()
  if (eventInfo.value) await fetchSlots(0)
})

// Toast local car useToast n'est pas dispo dans la vue publique (hors du shell app).
const toastMsg = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
function toast(msg: string) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = null }, 2500)
}
onBeforeUnmount(() => {
  if (toastTimer) clearTimeout(toastTimer)
})

const { ctx, open: openCtx, close: closeCtx } = useContextMenu<BookingSlot>()
function buildGoogleCalUrl(s: BookingSlot): string {
  const start = s.start.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const end = s.end.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const title = encodeURIComponent(eventInfo.value?.eventTitle ?? 'Rendez-vous')
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}`
}
const ctxItems = computed<ContextMenuItem[]>(() => {
  const s = ctx.value?.target
  if (!s) return []
  return [
    { label: 'Réserver ce créneau', icon: Check, action: () => selectSlot(s) },
    { label: 'Copier la date/heure', icon: Copy, separator: true, action: async () => {
      await navigator.clipboard.writeText(`${formatFullDate(s.start)} ${formatTime(s.start)}-${formatTime(s.end)}`)
      toast('Créneau copié.')
    } },
    { label: 'Copier le lien de la page', icon: Copy, action: async () => {
      await navigator.clipboard.writeText(window.location.href)
      toast('Lien copié.')
    } },
    { label: 'Ajouter à Google Calendar', icon: CalendarPlus, separator: true, action: () => {
      window.open(buildGoogleCalUrl(s), '_blank', 'noopener')
    } },
  ]
})
</script>

<template>
  <div class="bp" :style="eventInfo ? { '--accent': eventInfo.color } : {}">
    <!-- Error state -->
    <div v-if="error && !eventInfo" class="bp-error">
      <h2>Lien invalide</h2>
      <p>{{ error }}</p>
    </div>

    <!-- Loading -->
    <div v-else-if="loading && !eventInfo" class="bp-loading">Chargement...</div>

    <!-- Main content -->
    <template v-else-if="eventInfo">
      <!-- Header -->
      <div class="bp-header">
        <div class="bp-color-bar" />
        <h1 class="bp-title">{{ eventInfo.eventTitle }}</h1>
        <div class="bp-meta">
          <span class="bp-meta-item"><User :size="13" /> {{ eventInfo.teacherName }}</span>
          <span class="bp-meta-item"><Clock :size="13" /> {{ eventInfo.durationMinutes }} min</span>
        </div>
        <p v-if="eventInfo.description" class="bp-desc">{{ eventInfo.description }}</p>
        <p v-if="eventInfo.timezone" class="bp-tz">Horaires affiches en {{ eventInfo.timezone }}</p>
      </div>

      <!-- Step 1: Calendar -->
      <div v-if="step === 'calendar'" class="bp-step">
        <h2 class="bp-step-title">Choisissez un creneau</h2>

        <!-- Week nav -->
        <div class="bp-week-nav">
          <button class="bp-week-btn" :disabled="weekOffset <= 0" aria-label="Semaine precedente" @click="prevWeek">
            <ChevronLeft :size="16" />
          </button>
          <span class="bp-week-label">{{ weekLabel }}</span>
          <button class="bp-week-btn" :disabled="weekOffset >= 12" aria-label="Semaine suivante" @click="nextWeek">
            <ChevronRight :size="16" />
          </button>
        </div>

        <!-- Slot grid -->
        <div class="bp-grid" :class="{ 'bp-grid--loading': loading }">
          <div v-for="d in weekDays" :key="d.iso" class="bp-day" :class="{ 'bp-day--today': d.isToday }">
            <div class="bp-day-header">
              <span class="bp-day-name">{{ d.label }}</span>
              <span class="bp-day-num">{{ d.day }}</span>
            </div>
            <div class="bp-day-slots">
              <button
                v-for="s in (slotsByDate[d.iso] || [])"
                :key="s.start"
                class="bp-slot"
                @click="selectSlot(s)"
                @contextmenu="openCtx($event, s)"
              >
                {{ s.time }}
              </button>
              <span v-if="!(slotsByDate[d.iso] || []).length" class="bp-no-slots">-</span>
            </div>
          </div>
        </div>

        <div v-if="!loading && slots.length === 0" class="bp-empty">
          Aucun creneau disponible cette semaine. Essayez la semaine suivante.
        </div>
      </div>

      <!-- Step 2: Details -->
      <div v-else-if="step === 'details'" class="bp-step">
        <button class="bp-back" @click="backToCalendar">
          <ArrowLeft :size="14" /> Changer de creneau
        </button>

        <div class="bp-selected-slot">
          <Calendar :size="16" />
          <span>{{ selectedSlot ? formatFullDate(selectedSlot.start) : '' }}</span>
          <Clock :size="16" />
          <span>{{ selectedSlot ? `${formatTime(selectedSlot.start)} - ${formatTime(selectedSlot.end)}` : '' }}</span>
        </div>

        <h2 class="bp-step-title">Vos coordonnees</h2>

        <form class="bp-form" @submit.prevent="onSubmit">
          <div class="bp-field">
            <label class="bp-label"><User :size="12" /> Nom</label>
            <input v-model="tutorName" class="bp-input" placeholder="Prenom Nom" required maxlength="200" />
          </div>
          <div class="bp-field">
            <label class="bp-label"><Mail :size="12" /> Email</label>
            <input v-model="tutorEmail" class="bp-input" type="email" placeholder="email@entreprise.com" required />
          </div>
          <p v-if="error" class="bp-form-error">{{ error }}</p>
          <button class="bp-submit" type="submit" :disabled="submitting || !tutorName.trim() || !tutorEmail.trim()">
            <Check :size="16" />
            {{ submitting ? 'Reservation...' : 'Confirmer le rendez-vous' }}
          </button>
        </form>
      </div>

      <!-- Step 3: Confirmation -->
      <div v-else-if="step === 'confirmation' && bookingResult" class="bp-step bp-confirmation">
        <div class="bp-success-icon">
          <Check :size="32" />
        </div>
        <h2 class="bp-step-title">Rendez-vous confirme</h2>
        <p class="bp-conf-detail">
          {{ formatFullDate(bookingResult.startDatetime) }} de
          {{ formatTime(bookingResult.startDatetime) }} a {{ formatTime(bookingResult.endDatetime) }}
        </p>
        <p class="bp-conf-sub">Un email de confirmation a ete envoye a {{ tutorEmail }}.</p>

        <div class="bp-conf-actions">
          <a v-if="bookingResult.teamsJoinUrl" :href="bookingResult.teamsJoinUrl" target="_blank" class="bp-action-btn bp-action-teams">
            <Video :size="16" /> Rejoindre Teams
          </a>
          <a v-if="icsUrl()" :href="icsUrl()!" class="bp-action-btn bp-action-ics">
            <Download :size="16" /> Ajouter au calendrier
          </a>
        </div>
      </div>
    </template>

    <ContextMenu
      v-if="ctx"
      :x="ctx.x"
      :y="ctx.y"
      :items="ctxItems"
      @close="closeCtx"
    />
    <div v-if="toastMsg" class="bp-toast">{{ toastMsg }}</div>
  </div>
</template>

<style scoped>
.bp-toast {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,.85); color: #fff;
  padding: 10px 16px; border-radius: 8px; font-size: 13px;
  z-index: 10000; animation: bp-toast-in .2s ease-out;
}
@keyframes bp-toast-in {
  from { opacity: 0; transform: translate(-50%, 8px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}
.bp {
  --accent: #6366f1;
  max-width: 520px; width: 100%;
  background: #fff; border-radius: 16px;
  box-shadow: 0 4px 32px rgba(0,0,0,.08);
  overflow: hidden;
}
@media (prefers-color-scheme: dark) {
  .bp { background: #1e293b; color: #e2e8f0; }
}

/* Header */
.bp-header { padding: 24px 24px 16px; position: relative; }
.bp-color-bar { height: 4px; background: var(--accent); position: absolute; top: 0; left: 0; right: 0; }
.bp-title { font-size: 20px; font-weight: 800; margin: 0 0 8px; color: #111827; }
@media (prefers-color-scheme: dark) { .bp-title { color: #f1f5f9; } }
.bp-meta { display: flex; gap: 16px; font-size: 13px; color: #64748b; }
.bp-meta-item { display: flex; align-items: center; gap: 4px; }
.bp-desc { font-size: 13px; color: #64748b; margin: 8px 0 0; line-height: 1.5; }
.bp-tz { font-size: 11px; color: #94a3b8; margin: 4px 0 0; }

/* Steps */
.bp-step { padding: 0 24px 24px; }
.bp-step-title { font-size: 15px; font-weight: 700; margin: 0 0 12px; color: #111827; }
@media (prefers-color-scheme: dark) { .bp-step-title { color: #f1f5f9; } }

/* Error/Loading */
.bp-error, .bp-loading { padding: 48px 24px; text-align: center; color: #64748b; }
.bp-error h2 { color: #ef4444; font-size: 18px; margin: 0 0 8px; }

/* Week nav */
.bp-week-nav { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.bp-week-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 8px; border: 1px solid #e2e8f0;
  background: #fff; color: #64748b; cursor: pointer; transition: all 0.12s;
}
.bp-week-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.bp-week-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.bp-week-label { flex: 1; text-align: center; font-size: 13px; font-weight: 600; color: #374151; text-transform: capitalize; }

/* Slot grid */
.bp-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; }
.bp-grid--loading { opacity: 0.5; pointer-events: none; }
.bp-day { display: flex; flex-direction: column; gap: 4px; }
.bp-day--today .bp-day-header { color: var(--accent); }
.bp-day-header { text-align: center; margin-bottom: 4px; }
.bp-day-name { font-size: 11px; font-weight: 600; color: #64748b; text-transform: capitalize; display: block; }
.bp-day-num { font-size: 16px; font-weight: 700; color: #111827; display: block; }
@media (prefers-color-scheme: dark) { .bp-day-num { color: #f1f5f9; } }
.bp-day-slots { display: flex; flex-direction: column; gap: 4px; }
.bp-slot {
  padding: 8px 4px; border-radius: 8px; border: 1px solid #e2e8f0;
  background: #fff; font-size: 12px; font-weight: 600; color: #374151;
  cursor: pointer; transition: all 0.12s; text-align: center;
  font-family: inherit;
}
.bp-slot:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, #fff); color: var(--accent); }
@media (prefers-color-scheme: dark) {
  .bp-slot { background: #334155; border-color: #475569; color: #e2e8f0; }
  .bp-slot:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 15%, #334155); }
}
.bp-no-slots { font-size: 11px; color: #94a3b8; text-align: center; padding: 8px 0; }
.bp-empty { text-align: center; font-size: 13px; color: #94a3b8; padding: 24px 0; }

/* Back button */
.bp-back {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; font-weight: 600; color: #64748b;
  background: none; border: none; cursor: pointer; padding: 0; margin-bottom: 12px;
  font-family: inherit;
}
.bp-back:hover { color: var(--accent); }

/* Selected slot summary */
.bp-selected-slot {
  display: flex; align-items: center; gap: 8px; padding: 12px 16px;
  background: color-mix(in srgb, var(--accent) 8%, #fff); border: 1px solid color-mix(in srgb, var(--accent) 20%, #e2e8f0);
  border-radius: 10px; margin-bottom: 16px;
  font-size: 13px; font-weight: 600; color: var(--accent);
}

/* Form */
.bp-form { display: flex; flex-direction: column; gap: 12px; }
.bp-field { display: flex; flex-direction: column; gap: 4px; }
.bp-label { font-size: 12px; font-weight: 600; color: #64748b; display: flex; align-items: center; gap: 4px; }
.bp-input {
  padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px;
  font-size: 14px; color: #111827; outline: none; transition: border-color 0.15s;
  font-family: inherit;
}
.bp-input:focus { border-color: var(--accent); }
@media (prefers-color-scheme: dark) {
  .bp-input { background: #334155; border-color: #475569; color: #e2e8f0; }
}
.bp-form-error { font-size: 12px; color: #ef4444; margin: 0; }
.bp-submit {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px; border-radius: 10px; border: none;
  background: var(--accent); color: #fff; font-size: 14px; font-weight: 700;
  cursor: pointer; transition: all 0.15s; font-family: inherit;
}
.bp-submit:hover:not(:disabled) { filter: brightness(1.1); }
.bp-submit:disabled { opacity: 0.5; cursor: not-allowed; }

/* Confirmation */
.bp-confirmation { text-align: center; padding-top: 24px; }
.bp-success-icon {
  width: 56px; height: 56px; border-radius: 50%; background: #22c55e;
  color: #fff; display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
}
.bp-conf-detail { font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 4px; text-transform: capitalize; }
.bp-conf-sub { font-size: 12px; color: #64748b; margin: 0 0 20px; }
.bp-conf-actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
.bp-action-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px;
  border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none;
  transition: all 0.12s; cursor: pointer; font-family: inherit;
}
.bp-action-teams { background: #6366f1; color: #fff; }
.bp-action-teams:hover { filter: brightness(1.1); }
.bp-action-ics { background: #f1f5f9; color: #374151; border: 1px solid #e2e8f0; }
.bp-action-ics:hover { background: #e2e8f0; }

@media (max-width: 480px) {
  .bp-grid { grid-template-columns: repeat(4, 1fr); }
  .bp-header { padding: 20px 16px 12px; }
  .bp-step { padding: 0 16px 20px; }
}
</style>
