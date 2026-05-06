<script setup lang="ts">
/**
 * SidebarBooking — refonte v2.303 :
 *   - CTA primaire "+ Nouveau RDV" en haut de la sidebar (ouvre la
 *     modale CreateBookingModal directement, sans passer par TabBooking)
 *   - Header simplifie : icone + titre + sous-titre, pas de blockmark
 *     redondant avec NavRail
 *   - Statut Microsoft : pill compacte sans gear (gear redirige vers
 *     parametres mais l'icone n'apporte pas d'info, on simplifie)
 *   - Stats : 3 chiffres alignes en ligne (semaine / en attente /
 *     campagnes) plutot qu'une grille 2x2 plus dense
 *   - Prochains RDV : carte + barre d'accent gauche tintee par event-type,
 *     timestamps relatifs lisibles
 *   - Configuration (event-types / dispos / campagnes) regroupee dans
 *     un panneau "Configuration" en bas, depliable
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Calendar, CalendarPlus, CalendarRange, Clock, AlertCircle,
  Settings, Plus, Video, ChevronDown, ChevronRight,
} from 'lucide-vue-next'
import { useBooking } from '@/composables/useBooking'
import { useCampaigns } from '@/composables/useCampaigns'
import { useMicrosoftConnection } from '@/composables/useMicrosoftConnection'
import { useSmtpStatus } from '@/composables/useSmtpStatus'
import { useModalsStore } from '@/stores/modals'
import { useAppStore } from '@/stores/app'
import CreateBookingModal from '@/components/booking/CreateBookingModal.vue'
import SmtpStatusModal from '@/components/booking/SmtpStatusModal.vue'

const router = useRouter()
const modals = useModalsStore()
const appStore = useAppStore()
const booking = useBooking()
const { campaigns, fetchAll: fetchCampaigns } = useCampaigns()
const { connected: msConnected, refresh: refreshMs } = useMicrosoftConnection()
const smtp = useSmtpStatus()
const showSmtpModal = ref(false)

const smtpChipState = computed<'ok' | 'warn' | 'ko'>(() => {
  const s = smtp.status.value
  if (!s) return 'ko'
  if (!s.configured) return 'ko'
  if (!s.reachable) return 'warn'
  if (!s.fromMatchesUser) return 'warn'
  return 'ok'
})
const smtpChipLabel = computed(() => {
  const s = smtp.status.value
  if (!s) return 'SMTP : statut inconnu'
  if (!s.configured) return 'SMTP non configure'
  if (!s.reachable) return 'SMTP injoignable'
  if (!s.fromMatchesUser) return 'SMTP : From mismatch'
  return 'SMTP operationnel'
})

const allStudents = ref<Array<{ id: number; name?: string; email?: string; promo_id?: number; promo_name?: string }>>([])

async function loadStudents() {
  try {
    const res = await window.api.getAllStudents()
    if (res?.ok && Array.isArray(res.data)) {
      allStudents.value = res.data as typeof allStudents.value
    }
  } catch { /* sidebar best-effort : on garde silent */ }
}

// ── CTA primaire ──────────────────────────────────────────────────────────

const showCreateModal = ref(false)
function openCreateModal() {
  // Ouvrir directement le modal — pas de detour par TabBooking. La donnee
  // est partagee : le composable useBooking est instancie ici, le modal
  // l'utilise comme handle. Le modal appelle ensuite booking.fetchAll()
  // qui rafraichit aussi les vues de TabBooking via la reactivite Pinia.
  showCreateModal.value = true
}

function emitCreateType() {
  // Le bouton "Nouveau type" du header de TabBooking ecoute cet event.
  window.dispatchEvent(new CustomEvent('cursus:booking-create-type'))
}

function openSettings() { modals.settings = true }

// ── Stats compactes ───────────────────────────────────────────────────────

const activeTypes = computed(() => booking.eventTypes.value.filter(et => et.is_active).length)
const activeCampaigns = computed(() => campaigns.value.filter(c => c.status === 'active').length)
const draftCampaigns = computed(() => campaigns.value.filter(c => c.status === 'draft').length)
const pendingCount = computed(() => booking.bookings.value.filter(b => b.status === 'pending').length)

const bookingsThisWeek = computed(() => {
  const now = new Date()
  const day = now.getDay()
  const offset = day === 0 ? 6 : day - 1
  const start = new Date(now); start.setDate(now.getDate() - offset); start.setHours(0, 0, 0, 0)
  const end = new Date(start); end.setDate(start.getDate() + 7)
  let count = 0
  for (const bk of booking.bookings.value) {
    const d = new Date(`${bk.date}T${bk.start_time}`)
    if (d >= start && d < end && bk.status !== 'cancelled') count++
  }
  return count
})

// ── Prochains RDV ─────────────────────────────────────────────────────────

interface UpcomingItem {
  id: number
  date: string
  startTime: string
  title: string
  with: string
  visioUrl?: string
  relative: string
  accent: string
}

function eventTypeColor(title?: string): string {
  if (!title) return 'var(--accent)'
  const et = booking.eventTypes.value.find(t => t.title === title)
  return et?.color || 'var(--accent)'
}

const upcomingBookings = computed<UpcomingItem[]>(() => {
  const now = Date.now()
  const items: UpcomingItem[] = []
  for (const bk of booking.sortedBookings.value) {
    if (bk.status === 'cancelled') continue
    const t = new Date(`${bk.date}T${bk.start_time}`).getTime()
    if (t < now) continue
    items.push({
      id: bk.id,
      date: bk.date,
      startTime: bk.start_time,
      title: bk.event_type_title || 'Rendez-vous',
      with: bk.tutor_name || bk.student_name || '',
      visioUrl: bk.visio_url,
      relative: relativeWhen(t),
      accent: eventTypeColor(bk.event_type_title),
    })
    if (items.length >= 5) break
  }
  return items
})

function relativeWhen(t: number): string {
  const diffMin = Math.round((t - Date.now()) / 60000)
  if (diffMin < 60) return `dans ${Math.max(diffMin, 1)} min`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `dans ${diffH} h`
  const tD = new Date(t)
  const today = new Date()
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1)
  if (tD.toDateString() === tomorrow.toDateString()) {
    return `demain ${tD.toTimeString().slice(0, 5)}`
  }
  return tD.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    + ' ' + tD.toTimeString().slice(0, 5)
}

// ── Configuration depliable ──────────────────────────────────────────────

const configOpen = ref(false)

// ── Lifecycle ─────────────────────────────────────────────────────────────

onMounted(() => {
  booking.fetchAll()
  booking.initSocketListeners()
  fetchCampaigns()
  refreshMs()
  smtp.refresh()
  loadStudents()

  window.addEventListener('cursus:booking-open-create', openCreateModal)
})

onUnmounted(() => {
  booking.disposeSocketListeners()
  window.removeEventListener('cursus:booking-open-create', openCreateModal)
})

// Navigation interne — clic sur stats → page complete.
function goToBooking() {
  if (router.currentRoute.value.name !== 'booking') {
    router.push({ name: 'booking' })
  }
}
</script>

<template>
  <div class="sb-booking">
    <!-- Header compact -->
    <header class="sb-bk-header">
      <span class="sb-bk-header-icon">
        <Calendar :size="14" />
      </span>
      <div class="sb-bk-header-text">
        <span class="sb-bk-title">Rendez-vous</span>
        <span class="sb-bk-subtitle">Planning et campagnes</span>
      </div>
    </header>

    <!-- CTA primaire : creation directe -->
    <button type="button" class="sb-bk-cta-primary" @click="openCreateModal">
      <Plus :size="14" />
      <span>Nouveau RDV</span>
      <span class="sb-bk-cta-hint">creer pour 1+ etudiants</span>
    </button>

    <!-- Statuts services (Microsoft / SMTP) -->
    <div class="sb-bk-services">
      <button
        type="button"
        class="sb-bk-service"
        :class="msConnected ? 'sb-bk-service--ok' : 'sb-bk-service--ko'"
        :title="msConnected ? 'Microsoft connecte (Teams + Outlook) — gerer dans Parametres' : 'Microsoft non connecte — cliquer pour configurer'"
        @click="openSettings"
      >
        <span class="sb-bk-service-dot" aria-hidden="true" />
        <span class="sb-bk-service-label">{{ msConnected ? 'Microsoft' : 'MS non connecte' }}</span>
        <Settings :size="11" class="sb-bk-service-gear" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="sb-bk-service"
        :class="`sb-bk-service--${smtpChipState}`"
        :title="smtpChipLabel + ' — cliquer pour le diagnostic'"
        @click="showSmtpModal = true"
      >
        <span class="sb-bk-service-dot" aria-hidden="true" />
        <span class="sb-bk-service-label">{{ smtp.status.value?.configured ? 'Email' : 'SMTP KO' }}</span>
        <Settings :size="11" class="sb-bk-service-gear" aria-hidden="true" />
      </button>
    </div>

    <!-- Stats : 3 chiffres en ligne -->
    <div class="sb-bk-stats" role="group" aria-label="Vue d'ensemble">
      <button type="button" class="sb-bk-stat" @click="goToBooking">
        <span class="sb-bk-stat-value">{{ bookingsThisWeek }}</span>
        <span class="sb-bk-stat-label">cette semaine</span>
      </button>
      <button
        type="button"
        class="sb-bk-stat"
        :class="{ 'sb-bk-stat--alert': pendingCount > 0 }"
        @click="goToBooking"
      >
        <AlertCircle v-if="pendingCount > 0" :size="11" class="sb-bk-stat-icon" aria-hidden="true" />
        <span class="sb-bk-stat-value">{{ pendingCount }}</span>
        <span class="sb-bk-stat-label">en attente</span>
      </button>
      <button type="button" class="sb-bk-stat" @click="goToBooking">
        <span class="sb-bk-stat-value">
          {{ activeCampaigns }}<span v-if="draftCampaigns" class="sb-bk-stat-suffix">+{{ draftCampaigns }}</span>
        </span>
        <span class="sb-bk-stat-label">campagnes</span>
      </button>
    </div>

    <!-- Prochains RDV -->
    <section class="sb-bk-section">
      <header class="sb-bk-section-header">
        <Clock :size="11" />
        <span>Prochains RDV</span>
      </header>
      <div v-if="!upcomingBookings.length" class="sb-bk-empty">
        Aucun RDV programme.
        <button type="button" class="sb-bk-empty-cta" @click="openCreateModal">+ creer un RDV</button>
      </div>
      <ul v-else class="sb-bk-upcoming">
        <li v-for="bk in upcomingBookings" :key="bk.id" class="sb-bk-upcoming-item">
          <span
            class="sb-bk-upcoming-accent"
            :style="{ background: bk.accent }"
            aria-hidden="true"
          />
          <div class="sb-bk-upcoming-body">
            <div class="sb-bk-upcoming-head">
              <span class="sb-bk-upcoming-when">{{ bk.relative }}</span>
              <a
                v-if="bk.visioUrl"
                class="sb-bk-upcoming-visio"
                :href="bk.visioUrl"
                target="_blank"
                rel="noopener"
                :title="`Rejoindre la visio — ${bk.title}`"
                @click.stop
              >
                <Video :size="11" />
              </a>
            </div>
            <span class="sb-bk-upcoming-title">{{ bk.title }}</span>
            <span v-if="bk.with" class="sb-bk-upcoming-with">avec {{ bk.with }}</span>
          </div>
        </li>
      </ul>
    </section>

    <!-- Configuration depliable -->
    <section class="sb-bk-config">
      <button
        type="button"
        class="sb-bk-config-toggle"
        :aria-expanded="configOpen"
        @click="configOpen = !configOpen"
      >
        <component :is="configOpen ? ChevronDown : ChevronRight" :size="11" />
        <span>Configuration</span>
        <span class="sb-bk-config-meta">{{ activeTypes }} types · {{ activeCampaigns + draftCampaigns }} campagnes</span>
      </button>
      <div v-if="configOpen" class="sb-bk-config-actions">
        <button type="button" class="sb-bk-config-action" @click="emitCreateType">
          <CalendarPlus :size="12" />
          <span>Nouveau type de RDV</span>
        </button>
        <button type="button" class="sb-bk-config-action" @click="goToBooking">
          <CalendarRange :size="12" />
          <span>Gerer les campagnes</span>
        </button>
      </div>
    </section>

    <!-- Modale de creation -->
    <CreateBookingModal
      v-model="showCreateModal"
      :booking="booking"
      :students="allStudents"
    />

    <!-- Modale diagnostic SMTP -->
    <SmtpStatusModal
      v-model="showSmtpModal"
      :default-test-email="appStore.currentUser?.email ?? ''"
    />
  </div>
</template>

<style scoped>
.sb-booking {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 16px;
  font-family: var(--font);
  color: var(--text-primary);
}

/* ── Header ── */
.sb-bk-header {
  display: flex; align-items: center; gap: 10px;
  padding: 4px 4px 6px;
}
.sb-bk-header-icon {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  flex-shrink: 0;
}
.sb-bk-header-text { display: flex; flex-direction: column; min-width: 0; }
.sb-bk-title {
  font-size: 13px; font-weight: 700; color: var(--text-primary); line-height: 1.2;
}
.sb-bk-subtitle {
  font-size: 10px; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .04em; font-weight: 600;
}

/* ── CTA primaire ── */
.sb-bk-cta-primary {
  display: flex; align-items: center; gap: 6px;
  padding: 9px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: #fff;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  text-align: left;
  transition: filter var(--motion-fast) var(--ease-out), transform .06s var(--ease-out), box-shadow var(--motion-fast) var(--ease-out);
  box-shadow: 0 2px 8px color-mix(in srgb, var(--accent) 35%, transparent);
}
.sb-bk-cta-primary:hover { filter: brightness(1.08); }
.sb-bk-cta-primary:active { transform: translateY(1px); box-shadow: 0 1px 3px color-mix(in srgb, var(--accent) 30%, transparent); }
.sb-bk-cta-primary:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.sb-bk-cta-hint {
  margin-left: auto;
  font-size: 10.5px;
  font-weight: 500;
  opacity: .85;
  white-space: nowrap;
}

/* ── Services chips (Microsoft + SMTP) ── */
.sb-bk-services {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}
.sb-bk-service {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 10.5px; font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: background var(--motion-fast) var(--ease-out), border-color var(--motion-fast) var(--ease-out);
  min-width: 0;
}
.sb-bk-service:hover { background: var(--bg-hover); border-color: var(--border-input); }
.sb-bk-service:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.sb-bk-service--ok {
  color: var(--color-success);
  border-color: color-mix(in srgb, var(--color-success) 35%, transparent);
  background: color-mix(in srgb, var(--color-success) 8%, var(--bg-elevated));
}
.sb-bk-service--ok .sb-bk-service-dot { background: var(--color-success); }
.sb-bk-service--warn {
  color: var(--color-warning);
  border-color: color-mix(in srgb, var(--color-warning) 35%, transparent);
  background: color-mix(in srgb, var(--color-warning) 8%, var(--bg-elevated));
}
.sb-bk-service--warn .sb-bk-service-dot { background: var(--color-warning); }
.sb-bk-service--ko { color: var(--text-muted); }
.sb-bk-service-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--text-muted);
  flex-shrink: 0;
}
.sb-bk-service-label {
  flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sb-bk-service-gear { color: var(--text-muted); flex-shrink: 0; }

/* ── Stats : 3 chiffres en ligne ── */
.sb-bk-stats {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 5px;
}
.sb-bk-stat {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 9px 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color var(--motion-fast) var(--ease-out), background var(--motion-fast) var(--ease-out);
}
.sb-bk-stat:hover {
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  background: var(--bg-hover);
}
.sb-bk-stat:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.sb-bk-stat--alert {
  border-color: color-mix(in srgb, var(--color-warning) 35%, transparent);
  background: color-mix(in srgb, var(--color-warning) 8%, var(--bg-elevated));
}
.sb-bk-stat--alert .sb-bk-stat-icon { color: var(--color-warning); }
.sb-bk-stat-icon { position: absolute; top: 6px; right: 7px; }
.sb-bk-stat-value {
  font-size: 18px; font-weight: 700;
  color: var(--text-primary);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.sb-bk-stat-label {
  font-size: 10px; font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .04em;
  line-height: 1.2;
}
.sb-bk-stat-suffix {
  font-size: 11px; font-weight: 600;
  color: var(--text-muted);
  margin-left: 2px;
}

/* ── Sections ── */
.sb-bk-section { display: flex; flex-direction: column; gap: 4px; }
.sb-bk-section-header {
  display: flex; align-items: center; gap: 6px;
  margin: 4px 4px 0;
  font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .06em;
  color: var(--text-muted);
}

/* ── Prochains RDV (cards) ── */
.sb-bk-empty {
  display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
  padding: 10px 12px;
  font-size: 11.5px;
  color: var(--text-muted);
  background: var(--bg-elevated);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  font-style: italic;
}
.sb-bk-empty-cta {
  background: transparent;
  border: none;
  color: var(--accent);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  font-style: normal;
}
.sb-bk-empty-cta:hover { text-decoration: underline; }

.sb-bk-upcoming {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sb-bk-upcoming-item {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  transition: background var(--motion-fast) var(--ease-out), border-color var(--motion-fast) var(--ease-out);
}
.sb-bk-upcoming-item:hover {
  background: var(--bg-hover);
  border-color: var(--border-input);
}
.sb-bk-upcoming-accent {
  width: 3px;
  flex-shrink: 0;
  border-radius: 2px;
}
.sb-bk-upcoming-body { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.sb-bk-upcoming-head {
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  line-height: 1.1;
}
.sb-bk-upcoming-when {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: .04em;
}
.sb-bk-upcoming-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sb-bk-upcoming-with {
  font-size: 10.5px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sb-bk-upcoming-visio {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px; height: 22px;
  border-radius: var(--radius-xs);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  text-decoration: none;
  flex-shrink: 0;
  transition: background var(--motion-fast) var(--ease-out);
}
.sb-bk-upcoming-visio:hover { background: color-mix(in srgb, var(--accent) 20%, transparent); }
.sb-bk-upcoming-visio:focus-visible { outline: none; box-shadow: var(--focus-ring); }

/* ── Configuration ── */
.sb-bk-config {
  margin-top: 4px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}
.sb-bk-config-toggle {
  display: flex; align-items: center; gap: 6px;
  width: 100%;
  padding: 4px 4px;
  background: transparent; border: none;
  font-family: inherit;
  font-size: 10px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .06em;
  color: var(--text-muted);
  cursor: pointer;
  text-align: left;
}
.sb-bk-config-toggle:hover { color: var(--text-secondary); }
.sb-bk-config-meta {
  margin-left: auto;
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: .02em;
  text-transform: none;
  color: var(--text-muted);
}
.sb-bk-config-actions {
  display: flex; flex-direction: column; gap: 3px;
  margin-top: 4px;
}
.sb-bk-config-action {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: all var(--motion-fast) var(--ease-out);
}
.sb-bk-config-action:hover {
  border-style: solid;
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  color: var(--accent);
}
.sb-bk-config-action:focus-visible { outline: none; box-shadow: var(--focus-ring); }

@media (prefers-reduced-motion: reduce) {
  .sb-bk-cta-primary,
  .sb-bk-stat,
  .sb-bk-ms-row,
  .sb-bk-config-action,
  .sb-bk-upcoming-item,
  .sb-bk-upcoming-visio { transition: none; }
}
</style>
