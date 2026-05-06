<script setup lang="ts">
/**
 * SidebarBooking — sidebar de la page Rendez-vous.
 *
 * Refonte v2.314.1 : simplification suite a la refonte de la page
 * principale (qui absorbe maintenant les stats + tabs config). La sidebar
 * ne garde que ce qui est *complementaire* au contenu de la page :
 *
 *   - Header compact (icone + titre)
 *   - CTA primaire "+ Nouveau RDV" (raccourci visible depuis tout
 *     ecran de l'app, ouvre directement le modal CreateBookingModal)
 *   - Statuts services (MS + SMTP) — consolides en 1 chip si tout OK
 *   - Liste des prochains RDV (5) — utile car visible quel que soit
 *     l'onglet actif de la page principale
 *
 * Plus de doublon de stats (deja dans la stats-strip de TabBooking) ni
 * de "Configuration depliable" (les tabs de TabBooking suffisent).
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Calendar, Clock, Plus, Video, Settings } from 'lucide-vue-next'
import { bookingHasRealTutor } from '@/utils/bookingHelpers'
import { useBooking } from '@/composables/useBooking'
import { useMicrosoftConnection } from '@/composables/useMicrosoftConnection'
import { useSmtpStatus } from '@/composables/useSmtpStatus'
import { useModalsStore } from '@/stores/modals'
import { useAppStore } from '@/stores/app'
import CreateBookingModal from '@/components/booking/CreateBookingModal.vue'
import SmtpStatusModal from '@/components/booking/SmtpStatusModal.vue'

const modals = useModalsStore()
const appStore = useAppStore()
const booking = useBooking()
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

/**
 * Quand les deux services sont OK on consolide en 1 seule chip discrete.
 * Sinon on affiche les chips detaillees pour montrer ce qui ne va pas.
 * Reduit le bruit visuel en regime normal (90% du temps tout est vert).
 */
const allServicesOk = computed(() => msConnected.value && smtpChipState.value === 'ok')

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

function openSettings() { modals.settings = true }

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
      // Affichage prioritaire de l'etudiant ; le tuteur n'apparait que si
      // c'est un VRAI tuteur entreprise (pas la copie student_name->tutor_name
      // historique). Cf. bookingHasRealTutor.
      with: bk.student_name || (bookingHasRealTutor(bk) ? bk.tutor_name : '') || '',
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

// ── Lifecycle ─────────────────────────────────────────────────────────────

onMounted(() => {
  booking.fetchAll()
  booking.initSocketListeners()
  refreshMs()
  smtp.refresh()
  loadStudents()

  window.addEventListener('cursus:booking-open-create', openCreateModal)
})

onUnmounted(() => {
  booking.disposeSocketListeners()
  window.removeEventListener('cursus:booking-open-create', openCreateModal)
})
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
    </button>

    <!-- Statuts services. v2.314.1 : si tout est OK, on consolide en 1
         indicateur discret. Si un service est en panne, on detaille pour
         que le prof voie tout de suite ce qui ne va pas. -->
    <div class="sb-bk-services" :class="{ 'sb-bk-services--single': allServicesOk }">
      <button
        v-if="allServicesOk"
        type="button"
        class="sb-bk-service sb-bk-service--ok"
        title="Microsoft + Email operationnels — cliquer pour gerer"
        @click="openSettings"
      >
        <span class="sb-bk-service-dot" aria-hidden="true" />
        <span class="sb-bk-service-label">Services connectes</span>
        <Settings :size="11" class="sb-bk-service-gear" aria-hidden="true" />
      </button>
      <template v-else>
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
      </template>
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

/* ── Services chips (Microsoft + SMTP) ── */
.sb-bk-services {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}
.sb-bk-services--single { grid-template-columns: 1fr; }
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

@media (prefers-reduced-motion: reduce) {
  .sb-bk-cta-primary,
  .sb-bk-upcoming-item,
  .sb-bk-upcoming-visio { transition: none; }
}
</style>
