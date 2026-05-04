<script setup lang="ts">
/**
 * BookingFlow.vue — composant partage pour les 3 pages publiques de RDV.
 *
 * Layout type Calendly :
 * - Step 'calendar' : 2 colonnes desktop. Gauche = recap (host, titre, duree,
 *   visio, description). Droite = calendrier mensuel + slots du jour selectionne.
 * - Step 'details'  : 2 colonnes. Gauche = recap RDV (date/heure choisie + bouton
 *   modifier). Droite = formulaire (email pre-rempli si token, captcha si event,
 *   tuteur si tripartite).
 * - Step 'confirmation' : centre, grand check vert + boutons ICS / visio.
 *
 * Le composant est volontairement controle de l'exterieur (slots, info,
 * selectedSlot, step, etc. sont des props). Les vues parentes pilotent leurs
 * composables (usePublicBooking, useCampaignBooking) et passent l'etat ici.
 */
import { computed, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import {
  Calendar, Clock, Globe, Video, ChevronLeft, ChevronRight, Check, ArrowLeft,
  User, Download, AlertCircle, Loader2,
} from 'lucide-vue-next'
import type {
  BookingFlowSlot as Slot,
  BookingFlowInfo,
  BookingFlowResult,
  BookingFlowSubmitPayload,
} from '@/components/booking/bookingFlow.types'
import {
  toIso, fmtDateLong, fmtTime, detectUserTimezone, bookingErrorTitle,
  DAY_INITIALS_FR,
} from '@/utils/bookingHelpers'

const props = withDefaults(defineProps<{
  info: BookingFlowInfo | null
  slots: Slot[]
  selectedSlot: Slot | null
  step: 'calendar' | 'details' | 'confirmation'
  loading: boolean
  error?: string
  errorCode?: string
  result?: BookingFlowResult | null
  /** URL pour telecharger l'ICS (token et event). En mode campagne, l'ICS est
   *  attache au mail donc on n'affiche pas le bouton. */
  icsUrl?: string | null
  /** Site key Turnstile (uniquement mode 'event'). Si vide, pas de captcha. */
  captchaSiteKey?: string
  /** Permet de masquer le champ email cote attendee (deja pre-identifie). */
  attendeeIdentified?: boolean
  submitting?: boolean
}>(), {
  error: '',
  errorCode: '',
  result: null,
  icsUrl: null,
  captchaSiteKey: '',
  attendeeIdentified: false,
  submitting: false,
})

const emit = defineEmits<{
  (e: 'select-slot', slot: Slot): void
  (e: 'back-to-calendar'): void
  (e: 'submit-details', payload: BookingFlowSubmitPayload): void
}>()

// ── Calendrier mensuel ─────────────────────────────────────────────────

const currentMonth = ref(initialMonth())

function initialMonth() {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), 1)
}

const monthLabel = computed(() => {
  return currentMonth.value.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
})

const todayIso = new Date().toISOString().slice(0, 10)

/** Map "YYYY-MM-DD" -> nb de slots dispo. Utilise pour griser les jours sans slot. */
const slotsByDate = computed<Record<string, Slot[]>>(() => {
  const m: Record<string, Slot[]> = {}
  for (const s of props.slots) (m[s.date] ??= []).push(s)
  return m
})

interface MonthCell { iso: string; day: number; inMonth: boolean; hasSlots: boolean; isPast: boolean; isToday: boolean }

const monthGrid = computed<MonthCell[]>(() => {
  const m = currentMonth.value
  const year = m.getFullYear()
  const month = m.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  // Lundi = 1, Dimanche = 0. On veut que la semaine commence le lundi.
  const dayOfWeek = firstOfMonth.getDay()
  const offsetMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const start = new Date(year, month, 1 - offsetMonday)
  const cells: MonthCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const iso = toIso(d)
    cells.push({
      iso,
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      hasSlots: !!slotsByDate.value[iso],
      isPast: iso < todayIso,
      isToday: iso === todayIso,
    })
  }
  return cells
})

const selectedDate = ref<string>('')

// Selectionne automatiquement la 1ere date avec slots quand on charge ou change de mois
watch([() => props.slots, () => props.step], () => {
  if (props.step !== 'calendar') return
  if (selectedDate.value && slotsByDate.value[selectedDate.value]) return
  const firstAvailable = monthGrid.value.find(c => c.inMonth && c.hasSlots)
  if (firstAvailable) selectedDate.value = firstAvailable.iso
}, { immediate: true })

function pickDate(cell: MonthCell) {
  if (!cell.inMonth || !cell.hasSlots || cell.isPast) return
  selectedDate.value = cell.iso
}

function prevMonth() {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() - 1, 1)
}
function nextMonth() {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 1)
}

const canGoPrev = computed(() => {
  // Pas de retour avant le mois courant
  const today = new Date()
  return currentMonth.value > new Date(today.getFullYear(), today.getMonth(), 1)
})

const slotsForSelectedDate = computed(() => {
  if (!selectedDate.value) return []
  return slotsByDate.value[selectedDate.value] || []
})

// ── Formulaire (step details) ──────────────────────────────────────────

const formName = ref('')
const formEmail = ref('')
const formTutorName = ref('')
const formTutorEmail = ref('')

watch(() => props.info, (info) => {
  if (info?.attendeeName) formName.value = info.attendeeName
  if (info?.attendeeEmail) formEmail.value = info.attendeeEmail
}, { immediate: true })

const captchaEnabled = computed(() => !!props.captchaSiteKey)
const captchaRef = ref<HTMLDivElement | null>(null)
const captchaToken = ref('')
const captchaError = ref('')
let captchaWidgetId: string | undefined

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  reset: (id?: string) => void
  remove: (id?: string) => void
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

function loadTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile) return Promise.resolve()
  if (document.querySelector('script[data-cf-turnstile]')) {
    return new Promise((resolve) => {
      const tick = () => (window.turnstile ? resolve() : setTimeout(tick, 50))
      tick()
    })
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.dataset.cfTurnstile = '1'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('turnstile_load_failed'))
    document.head.appendChild(s)
  })
}

async function mountCaptcha() {
  if (!captchaEnabled.value || !captchaRef.value) return
  try { await loadTurnstileScript() } catch { captchaError.value = 'Verification anti-spam indisponible.'; return }
  if (!window.turnstile || !captchaRef.value) return
  if (captchaWidgetId) {
    try { window.turnstile.remove(captchaWidgetId) } catch { /* ignore */ }
    captchaWidgetId = undefined
  }
  captchaWidgetId = window.turnstile.render(captchaRef.value, {
    sitekey: props.captchaSiteKey,
    callback: (token: string) => { captchaToken.value = token; captchaError.value = '' },
    'error-callback': () => { captchaToken.value = ''; captchaError.value = 'Verification echouee, recommence.' },
    'expired-callback': () => { captchaToken.value = '' },
    theme: 'auto',
  })
}

watch(() => props.step, async (s) => {
  if (s === 'details' && captchaEnabled.value) {
    captchaToken.value = ''; captchaError.value = ''
    await nextTick()
    mountCaptcha()
  }
})

onBeforeUnmount(() => {
  if (captchaWidgetId && window.turnstile) {
    try { window.turnstile.remove(captchaWidgetId) } catch { /* ignore */ }
  }
})

const requireTutor = computed(() => !!props.info?.withTutor)

const canSubmit = computed(() => {
  if (!formName.value.trim() || !formEmail.value.trim()) return false
  if (requireTutor.value && (!formTutorName.value.trim() || !formTutorEmail.value.trim())) return false
  if (captchaEnabled.value && !captchaToken.value) return false
  return true
})

function onSubmit() {
  if (!canSubmit.value) {
    if (captchaEnabled.value && !captchaToken.value) {
      captchaError.value = 'Coche la verification anti-spam.'
    }
    return
  }
  emit('submit-details', {
    attendeeName: formName.value.trim(),
    attendeeEmail: formEmail.value.trim(),
    tutorName: requireTutor.value ? formTutorName.value.trim() : undefined,
    tutorEmail: requireTutor.value ? formTutorEmail.value.trim() : undefined,
    captchaToken: captchaToken.value || undefined,
  })
}

// Reset captcha si l'erreur backend revient (token consomme une fois)
watch(() => props.error, (err) => {
  if (err && captchaWidgetId && window.turnstile) {
    try { window.turnstile.reset(captchaWidgetId) } catch { /* ignore */ }
    captchaToken.value = ''
  }
})

// ── Helpers d'affichage (logiques pures extraites dans utils/bookingHelpers.ts) ──

const userTimezone = computed(() => detectUserTimezone())
const errorTitle = computed(() => bookingErrorTitle(props.errorCode))
const dayInitials = DAY_INITIALS_FR
</script>

<template>
  <div class="bf" :style="info ? { '--accent': info.color } : {}">

    <!-- Etat erreur -->
    <div v-if="error && !info" class="bf-error" role="alert" aria-live="assertive">
      <AlertCircle :size="32" aria-hidden="true" />
      <h1>{{ errorTitle }}</h1>
      <p>{{ error }}</p>
      <p v-if="errorCode === 'closed'" class="bf-error-hint">
        Si tu attendais une reponse de cet enseignant, contacte-le directement.
      </p>
    </div>

    <!-- Loading initial -->
    <div v-else-if="loading && !info" class="bf-loading" role="status" aria-live="polite">
      <Loader2 :size="20" class="spin" aria-hidden="true" />
      <span>Chargement...</span>
    </div>

    <!-- Confirmation pleine largeur -->
    <div v-else-if="step === 'confirmation' && result && info" class="bf-confirmation" role="status" aria-live="polite">
      <div class="bf-success-icon" aria-hidden="true"><Check :size="36" /></div>
      <h1 class="bf-conf-title">Confirme</h1>
      <p class="bf-conf-subtitle">{{ info.title }}</p>

      <div class="bf-conf-card">
        <div class="bf-conf-row">
          <Calendar :size="18" />
          <div>
            <div class="bf-conf-date">{{ fmtDateLong(result.startDatetime) }}</div>
            <div class="bf-conf-time">
              {{ fmtTime(result.startDatetime) }} – {{ fmtTime(result.endDatetime) }}
              <span class="bf-conf-tz">({{ userTimezone }})</span>
            </div>
          </div>
        </div>
        <div class="bf-conf-row">
          <User :size="18" />
          <span>{{ info.hostName }}</span>
        </div>
        <div v-if="result.joinUrl" class="bf-conf-row">
          <Video :size="18" />
          <a :href="result.joinUrl" target="_blank" rel="noopener" class="bf-conf-link">
            {{ result.joinUrl }}
          </a>
        </div>
      </div>

      <div class="bf-conf-actions">
        <a v-if="result.joinUrl" :href="result.joinUrl" target="_blank" rel="noopener" class="bf-btn bf-btn-primary">
          <Video :size="16" /> Rejoindre la visio
        </a>
        <a v-if="icsUrl" :href="icsUrl" class="bf-btn bf-btn-secondary">
          <Download :size="16" /> Ajouter au calendrier
        </a>
      </div>

      <p class="bf-conf-info">
        Une invitation calendrier a ete envoyee
        <span v-if="info.withTutor">a toi, ton tuteur entreprise et l'enseignant.</span>
        <span v-else>par email.</span>
      </p>
    </div>

    <!-- Layout 2 colonnes : selection (calendar) ou details -->
    <div v-else-if="info" class="bf-grid">

      <!-- Colonne gauche : recap permanent -->
      <aside class="bf-side">
        <div class="bf-host">{{ info.hostName }}</div>
        <h1 class="bf-title">{{ info.title }}</h1>
        <p v-if="info.description" class="bf-desc">{{ info.description }}</p>

        <div class="bf-meta">
          <div class="bf-meta-row">
            <Clock :size="15" />
            <span>{{ info.durationMinutes }} min</span>
          </div>
          <div class="bf-meta-row">
            <Video :size="15" />
            <span>Visioconference</span>
          </div>
          <div class="bf-meta-row">
            <Globe :size="15" />
            <span>{{ userTimezone }}</span>
          </div>
        </div>

        <!-- Recap RDV en mode details -->
        <div v-if="step === 'details' && selectedSlot" class="bf-side-summary">
          <button type="button" class="bf-back" @click="emit('back-to-calendar')">
            <ArrowLeft :size="14" aria-hidden="true" /> Modifier le RDV
          </button>
          <div class="bf-summary-card">
            <div class="bf-summary-date">
              <Calendar :size="14" />
              {{ fmtDateLong(selectedSlot.start) }}
            </div>
            <div class="bf-summary-time">
              <Clock :size="14" />
              {{ fmtTime(selectedSlot.start) }} – {{ fmtTime(selectedSlot.end) }}
            </div>
          </div>
        </div>
      </aside>

      <!-- Colonne droite : selection slot ou formulaire -->
      <main class="bf-main">

        <!-- Step calendar -->
        <div v-if="step === 'calendar'" class="bf-pick">
          <h2 class="bf-pick-title">Choisis un horaire</h2>

          <div class="bf-pick-body">
            <!-- Calendrier mensuel -->
            <div class="bf-month">
              <div class="bf-month-nav">
                <button type="button" class="bf-icon-btn" :disabled="!canGoPrev" aria-label="Mois precedent" @click="prevMonth">
                  <ChevronLeft :size="16" aria-hidden="true" />
                </button>
                <span class="bf-month-label" aria-live="polite">{{ monthLabel }}</span>
                <button type="button" class="bf-icon-btn" aria-label="Mois suivant" @click="nextMonth">
                  <ChevronRight :size="16" aria-hidden="true" />
                </button>
              </div>
              <div class="bf-month-weekdays" aria-hidden="true">
                <span v-for="(d, i) in dayInitials" :key="i">{{ d }}</span>
              </div>
              <div class="bf-month-grid" role="grid">
                <button
                  v-for="cell in monthGrid"
                  :key="cell.iso"
                  type="button"
                  class="bf-day"
                  :class="{
                    'bf-day-out': !cell.inMonth,
                    'bf-day-past': cell.isPast,
                    'bf-day-available': cell.inMonth && cell.hasSlots && !cell.isPast,
                    'bf-day-today': cell.isToday,
                    'bf-day-selected': cell.iso === selectedDate,
                  }"
                  :disabled="!cell.inMonth || cell.isPast || !cell.hasSlots"
                  :aria-label="cell.inMonth ? fmtDateLong(cell.iso + 'T00:00:00') + (cell.hasSlots ? ' (creneaux disponibles)' : '') : undefined"
                  :aria-pressed="cell.iso === selectedDate"
                  @click="pickDate(cell)"
                >
                  {{ cell.day }}
                </button>
              </div>
            </div>

            <!-- Slots du jour selectionne -->
            <div class="bf-times">
              <div class="bf-times-header" aria-live="polite">
                <span v-if="selectedDate">{{ fmtDateLong(selectedDate + 'T00:00:00') }}</span>
                <span v-else class="bf-times-empty">Selectionne une date</span>
              </div>
              <div class="bf-times-list" role="list">
                <button
                  v-for="s in slotsForSelectedDate"
                  :key="s.start"
                  type="button"
                  class="bf-time-btn"
                  role="listitem"
                  :aria-label="`Reserver ${s.time}`"
                  @click="emit('select-slot', s)"
                >
                  {{ s.time }}
                </button>
                <p v-if="selectedDate && !slotsForSelectedDate.length" class="bf-times-empty">
                  Aucun creneau ce jour-la.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Step details -->
        <div v-else-if="step === 'details' && selectedSlot" class="bf-form-wrap">
          <h2 class="bf-pick-title">Tes coordonnees</h2>

          <form class="bf-form" novalidate @submit.prevent="onSubmit">
            <div class="bf-field">
              <label for="bf-name">Nom complet *</label>
              <input
                id="bf-name"
                v-model="formName"
                autocomplete="name"
                :readonly="attendeeIdentified"
                :class="{ 'bf-input-readonly': attendeeIdentified }"
                placeholder="Prenom Nom"
                maxlength="200"
                required
                aria-required="true"
              />
            </div>
            <div class="bf-field">
              <label for="bf-email">Email *</label>
              <input
                id="bf-email"
                v-model="formEmail"
                type="email"
                autocomplete="email"
                :readonly="attendeeIdentified"
                :class="{ 'bf-input-readonly': attendeeIdentified }"
                placeholder="prenom.nom@exemple.fr"
                required
                aria-required="true"
              />
            </div>

            <template v-if="requireTutor">
              <div class="bf-section-divider"><span>Tuteur entreprise</span></div>
              <div class="bf-field">
                <label for="bf-tutor-name">Nom du tuteur *</label>
                <input
                  id="bf-tutor-name"
                  v-model="formTutorName"
                  placeholder="Prenom Nom"
                  maxlength="200"
                  required
                  aria-required="true"
                />
              </div>
              <div class="bf-field">
                <label for="bf-tutor-email">Email du tuteur *</label>
                <input
                  id="bf-tutor-email"
                  v-model="formTutorEmail"
                  type="email"
                  placeholder="prenom.nom@entreprise.fr"
                  required
                  aria-required="true"
                />
              </div>
            </template>

            <div v-if="captchaEnabled" class="bf-captcha">
              <div ref="captchaRef" />
              <p v-if="captchaError" class="bf-error-text" role="alert" aria-live="polite">{{ captchaError }}</p>
            </div>

            <p v-if="error" class="bf-error-text" role="alert" aria-live="polite">{{ error }}</p>

            <button
              class="bf-btn bf-btn-primary bf-submit"
              type="submit"
              :disabled="submitting || !canSubmit"
              :aria-busy="submitting || undefined"
            >
              <Check :size="16" aria-hidden="true" />
              {{ submitting ? 'Confirmation...' : 'Confirmer le rendez-vous' }}
            </button>
          </form>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.bf {
  --accent: #3b82f6;
  --bf-bg: #ffffff;
  --bf-bg-elevated: #ffffff;
  --bf-bg-subtle: #f8fafc;
  --bf-text: #0f172a;
  --bf-text-muted: #64748b;
  --bf-text-faint: #94a3b8;
  --bf-border: #e2e8f0;
  --bf-border-strong: #cbd5e1;
  --bf-radius-sm: 6px;
  --bf-radius: 12px;
  --bf-radius-lg: 16px;
  --bf-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06);
  --bf-font: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif;

  width: 100%;
  max-width: 920px;
  background: var(--bf-bg);
  border-radius: var(--bf-radius-lg);
  box-shadow: var(--bf-shadow);
  overflow: hidden;
  font-family: var(--bf-font);
  color: var(--bf-text);
}

@media (prefers-color-scheme: dark) {
  .bf {
    --bf-bg: #1e293b;
    --bf-bg-elevated: #243043;
    --bf-bg-subtle: #1a2332;
    --bf-text: #f1f5f9;
    --bf-text-muted: #94a3b8;
    --bf-text-faint: #64748b;
    --bf-border: #334155;
    --bf-border-strong: #475569;
    --bf-shadow: 0 1px 2px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.3);
  }
}

/* ── Etats vides ──────────────────────────────────────────────────────── */

.bf-error, .bf-loading {
  padding: 64px 32px;
  text-align: center;
  color: var(--bf-text-muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.bf-error h1 { margin: 4px 0 0; font-size: 18px; color: var(--bf-text); font-weight: 700; }
.bf-error p { margin: 0; font-size: 14px; max-width: 380px; line-height: 1.5; }
.bf-error-hint { font-size: 12px; color: var(--bf-text-faint); margin-top: 8px !important; }
.bf-loading { font-size: 13px; flex-direction: row; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Layout 2 colonnes ────────────────────────────────────────────────── */

.bf-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  min-height: 540px;
}
@media (max-width: 720px) {
  .bf-grid { grid-template-columns: 1fr; }
}

/* ── Side (gauche) ────────────────────────────────────────────────────── */

.bf-side {
  padding: 32px 28px;
  border-right: 1px solid var(--bf-border);
  background: var(--bf-bg-subtle);
  display: flex;
  flex-direction: column;
  gap: 18px;
}
@media (max-width: 720px) {
  .bf-side { border-right: 0; border-bottom: 1px solid var(--bf-border); padding: 24px; }
}

.bf-host {
  font-size: 13px;
  font-weight: 600;
  color: var(--bf-text-muted);
  letter-spacing: 0.02em;
}

.bf-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
  line-height: 1.25;
  letter-spacing: -0.015em;
  color: var(--bf-text);
}

.bf-desc {
  font-size: 14px;
  color: var(--bf-text-muted);
  margin: 0;
  line-height: 1.55;
  white-space: pre-line;
}

.bf-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 8px;
}
.bf-meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--bf-text-muted);
}
.bf-meta-row svg { color: var(--bf-text-faint); flex-shrink: 0; }

.bf-side-summary {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--bf-border);
}
.bf-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--accent);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  margin-bottom: 12px;
  font-family: inherit;
  font-weight: 600;
}
.bf-back:hover { text-decoration: underline; }

.bf-summary-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: var(--bf-bg-elevated);
  border: 1px solid var(--bf-border);
  border-radius: var(--bf-radius-sm);
}
.bf-summary-date, .bf-summary-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--bf-text);
}
.bf-summary-date { font-weight: 600; }
.bf-summary-time { color: var(--bf-text-muted); }

/* ── Main (droite) ────────────────────────────────────────────────────── */

.bf-main {
  padding: 32px 28px;
  display: flex;
  flex-direction: column;
}
@media (max-width: 720px) {
  .bf-main { padding: 24px; }
}

.bf-pick-title {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 20px;
  color: var(--bf-text);
}

.bf-pick-body {
  display: grid;
  grid-template-columns: 1fr 220px;
  gap: 28px;
  flex: 1;
  min-height: 0;
}
@media (max-width: 880px) {
  .bf-pick-body { grid-template-columns: 1fr; gap: 20px; }
}

/* ── Calendrier mensuel ───────────────────────────────────────────────── */

.bf-month { display: flex; flex-direction: column; gap: 12px; }

.bf-month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.bf-month-label {
  flex: 1;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  text-transform: capitalize;
  color: var(--bf-text);
}

.bf-icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--bf-radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--bf-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.bf-icon-btn:hover:not(:disabled) {
  background: var(--bf-bg-subtle);
  color: var(--bf-text);
}
.bf-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.bf-month-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  padding-bottom: 4px;
}
.bf-month-weekdays span {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--bf-text-faint);
  letter-spacing: 0.05em;
}

.bf-month-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.bf-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 50%;
  background: transparent;
  color: var(--bf-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
  font-family: inherit;
  min-height: 36px;
}
.bf-day:disabled { cursor: not-allowed; }
.bf-day-out { color: transparent; pointer-events: none; }
.bf-day-past, .bf-day:disabled:not(.bf-day-out) { color: var(--bf-text-faint); cursor: not-allowed; }
.bf-day-available {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--accent);
  font-weight: 700;
}
.bf-day-available:hover {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
.bf-day-today { outline: 1px solid var(--accent); outline-offset: -2px; }
.bf-day-selected.bf-day-available {
  background: var(--accent);
  color: #fff;
}

/* ── Slots verticaux ──────────────────────────────────────────────────── */

.bf-times {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.bf-times-header {
  font-size: 13px;
  font-weight: 600;
  color: var(--bf-text);
  text-transform: capitalize;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--bf-border);
}
.bf-times-empty { color: var(--bf-text-faint); font-style: italic; font-weight: 400; }
.bf-times-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  max-height: 360px;
  padding-right: 4px;
}
.bf-times-list::-webkit-scrollbar { width: 6px; }
.bf-times-list::-webkit-scrollbar-thumb { background: var(--bf-border); border-radius: 3px; }

.bf-time-btn {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--bf-border-strong);
  border-radius: var(--bf-radius-sm);
  background: var(--bf-bg);
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.12s;
  font-family: inherit;
  text-align: center;
}
.bf-time-btn:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, var(--bf-bg));
}

/* ── Form ─────────────────────────────────────────────────────────────── */

.bf-form-wrap { max-width: 480px; }

.bf-form { display: flex; flex-direction: column; gap: 14px; }

.bf-field { display: flex; flex-direction: column; gap: 6px; }
.bf-field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--bf-text);
}
.bf-field input {
  padding: 10px 14px;
  border: 1px solid var(--bf-border-strong);
  border-radius: var(--bf-radius-sm);
  font-size: 14px;
  color: var(--bf-text);
  background: var(--bf-bg);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  font-family: inherit;
}
.bf-field input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent);
}
.bf-input-readonly {
  background: var(--bf-bg-subtle) !important;
  color: var(--bf-text-muted) !important;
  cursor: not-allowed;
}

.bf-section-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0 0;
  color: var(--bf-text-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.bf-section-divider::before, .bf-section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--bf-border);
}

.bf-captcha {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-height: 70px;
  padding-top: 4px;
}

.bf-error-text {
  font-size: 12px;
  color: #ef4444;
  margin: 0;
}

.bf-submit { margin-top: 4px; }

/* ── Boutons ──────────────────────────────────────────────────────────── */

.bf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: var(--bf-radius-sm);
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s;
}
.bf-btn-primary {
  background: var(--cta);
  color: #fff;
}
.bf-btn-primary:hover:not(:disabled) { background: var(--cta-hover); }
.bf-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.bf-btn-secondary {
  background: var(--bf-bg);
  color: var(--bf-text);
  border-color: var(--bf-border-strong);
}
.bf-btn-secondary:hover { background: var(--bf-bg-subtle); }

/* ── Confirmation ─────────────────────────────────────────────────────── */

.bf-confirmation {
  padding: 56px 32px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 540px;
  margin: 0 auto;
}
.bf-success-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: color-mix(in srgb, #22c55e 16%, transparent);
  color: #16a34a;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
.bf-conf-title { margin: 0 0 4px; font-size: 24px; font-weight: 700; color: var(--bf-text); letter-spacing: -0.02em; }
.bf-conf-subtitle { margin: 0 0 24px; font-size: 14px; color: var(--bf-text-muted); }

.bf-conf-card {
  width: 100%;
  background: var(--bf-bg-subtle);
  border: 1px solid var(--bf-border);
  border-radius: var(--bf-radius);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
  text-align: left;
}
.bf-conf-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  font-size: 14px;
  color: var(--bf-text);
}
.bf-conf-row svg { color: var(--bf-text-muted); flex-shrink: 0; margin-top: 2px; }
.bf-conf-date { font-weight: 600; text-transform: capitalize; }
.bf-conf-time { font-size: 13px; color: var(--bf-text-muted); margin-top: 2px; }
.bf-conf-tz { color: var(--bf-text-faint); }
.bf-conf-link { color: var(--accent); text-decoration: none; word-break: break-all; }
.bf-conf-link:hover { text-decoration: underline; }

.bf-conf-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 16px;
}

.bf-conf-info {
  font-size: 12px;
  color: var(--bf-text-faint);
  margin: 0;
  max-width: 380px;
  line-height: 1.5;
}
</style>
