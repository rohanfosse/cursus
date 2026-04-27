/**
 * TabBooking.vue
 * ---------------------------------------------------------------------------
 * Mini-Calendly booking management tab for the teacher dashboard.
 * Three-column layout: Event types | Availability | My bookings
 * Integrates with Microsoft Graph via OAuth for calendar sync.
 *
 * Logic extracted to useBooking composable for maintainability.
 */
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import {
  CalendarPlus, Clock, Link, Users, Settings, Trash2, Plus,
  Check, X, ExternalLink, Copy, Calendar, LayoutList, CalendarDays, Globe, Video,
} from 'lucide-vue-next'
import BookingCalendarView from './BookingCalendarView.vue'
import CampaignManager from '@/components/booking/CampaignManager.vue'
import QrCode from '@/components/ui/QrCode.vue'
import { useBooking, type EventType } from '@/composables/useBooking'
import { useMicrosoftConnection } from '@/composables/useMicrosoftConnection'
import { useModalsStore } from '@/stores/modals'

const props = defineProps<{
  allStudents: Array<{ id: number; name?: string; email?: string; promo_id?: number }>
}>()

const {
  loading,
  eventTypes, availability, bookings,
  savingAvailability,
  sortedBookings, rulesByDay,
  fetchAll,
  createEventType, toggleActive, togglePublic, toggleJitsi, getPublicUrl, deleteEventType, generateLink, generateBulkLinks,
  addSlot, removeSlot, saveAvailability,
  initSocketListeners, disposeSocketListeners,
  formatDate, formatTime, statusLabel, statusClass,
} = useBooking()

// Etat Microsoft partage (meme source que Settings > Integrations)
const { connected: msConnected, refresh: refreshMsStatus } = useMicrosoftConnection()
const modalsStore = useModalsStore()

function openSettingsIntegrations() {
  modalsStore.settings = true
}

// ── Local UI state ──────────────────────────────────────────────────────────

const expandedTypeId = ref<number | null>(null)
const showCreateForm = ref(false)

const bookingsView = ref<'list' | 'calendar'>('calendar')
const bulkResults = ref<{ studentName: string; bookingUrl: string }[] | null>(null)
const bulkPromoId = ref<number | null>(null)

const newType = ref({
  title: '', slug: '', description: '',
  duration_minutes: 30, buffer_minutes: 0, color: '#6366f1', fallback_visio_url: '',
})

const bufferOptions = [
  { label: 'Aucun', value: 0 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
]

const colorPresets = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b', '#78716c',
]

const durationOptions = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
]

const linkStudentId = ref<number | null>(null)
const linkEventTypeId = ref<number | null>(null)
const generatedUrl = ref('')
const copySuccess = ref(false)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

const publicCopiedId = ref<number | null>(null)
let publicCopyTimeout: ReturnType<typeof setTimeout> | null = null

async function copyPublicUrl(et: EventType) {
  try {
    await navigator.clipboard.writeText(getPublicUrl(et))
    publicCopiedId.value = et.id
    if (publicCopyTimeout) clearTimeout(publicCopyTimeout)
    publicCopyTimeout = setTimeout(() => { publicCopiedId.value = null }, 2000)
  } catch { /* ignore */ }
}

const dayNames: Record<number, string> = { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi', 0: 'Dimanche' }
const dayNumbers = [1, 2, 3, 4, 5, 6, 0]

const newSlots = ref<Record<number, { start: string; end: string }>>({
  0: { start: '09:00', end: '10:00' },
  1: { start: '09:00', end: '10:00' },
  2: { start: '09:00', end: '10:00' },
  3: { start: '09:00', end: '10:00' },
  4: { start: '09:00', end: '10:00' },
  5: { start: '09:00', end: '10:00' },
  6: { start: '09:00', end: '10:00' },
})

// ── Slug auto-gen ───────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

watch(() => newType.value.title, (t) => {
  newType.value.slug = slugify(t)
})

// ── Actions ─────────────────────────────────────────────────────────────────

async function onCreateEventType() {
  if (!newType.value.title.trim()) return
  const ok = await createEventType({
    title: newType.value.title,
    slug: newType.value.slug,
    description: newType.value.description || undefined,
    duration_minutes: newType.value.duration_minutes,
    buffer_minutes: newType.value.buffer_minutes,
    color: newType.value.color,
    fallback_visio_url: newType.value.fallback_visio_url || undefined,
  })
  if (ok) {
    newType.value = { title: '', slug: '', description: '', duration_minutes: 30, buffer_minutes: 0, color: '#6366f1', fallback_visio_url: '' }
    showCreateForm.value = false
  }
}

async function onGenerateLink(eventTypeId: number) {
  if (!linkStudentId.value) return
  const url = await generateLink(eventTypeId, linkStudentId.value)
  if (url) {
    generatedUrl.value = url
    linkEventTypeId.value = eventTypeId
  }
}

async function copyUrl() {
  if (!generatedUrl.value) return
  try {
    await navigator.clipboard.writeText(generatedUrl.value)
    copySuccess.value = true
    if (copyTimeout) clearTimeout(copyTimeout)
    copyTimeout = setTimeout(() => { copySuccess.value = false }, 2000)
  } catch { /* ignore */ }
}

async function onBulkGenerate(eventTypeId: number) {
  if (!bulkPromoId.value) return
  const results = await generateBulkLinks(eventTypeId, bulkPromoId.value)
  bulkResults.value = results
}

function copyAllBulkLinks() {
  if (!bulkResults.value) return
  const text = bulkResults.value.map(r => `${r.studentName}\t${r.bookingUrl}`).join('\n')
  navigator.clipboard.writeText(text)
}

function onAddSlot(day: number) {
  const s = newSlots.value[day]
  if (addSlot(day, s.start, s.end)) {
    newSlots.value = { ...newSlots.value, [day]: { start: '09:00', end: '10:00' } }
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(() => {
  fetchAll()
  initSocketListeners()
  refreshMsStatus()
})

onUnmounted(() => {
  disposeSocketListeners()
  if (copyTimeout) clearTimeout(copyTimeout)
  if (publicCopyTimeout) clearTimeout(publicCopyTimeout)
})
</script>

<template>
  <div class="tab-booking">
    <!-- Top bar -->
    <div class="top-bar">
      <div class="top-title">
        <Calendar :size="18" />
        <span>Rendez-vous</span>
      </div>
      <button
        class="ms-status ms-status-btn"
        :title="msConnected ? 'Microsoft connecte — gerer dans Parametres > Integrations' : 'Se connecter dans Parametres > Integrations'"
        @click="openSettingsIntegrations"
      >
        <span class="ms-dot" :class="msConnected ? 'connected' : 'disconnected'" />
        <span class="ms-label">
          {{ msConnected ? 'Microsoft connecte' : 'Microsoft non connecte' }}
        </span>
        <Settings :size="12" class="ms-gear" />
      </button>
    </div>

    <div v-if="loading" class="loading-state">Chargement...</div>

    <CampaignManager v-else />

    <div v-if="!loading" class="columns">
      <!-- ─── Section 1: Event Types ──────────────────────────────────── -->
      <div class="col col-types">
        <div class="col-header">
          <CalendarPlus :size="14" />
          <span>Types d'evenements</span>
        </div>

        <div class="type-list">
          <div
            v-for="et in eventTypes"
            :key="et.id"
            class="type-card"
          >
            <div class="type-row" @click="expandedTypeId = expandedTypeId === et.id ? null : et.id">
              <span class="color-dot" :style="{ background: et.color }" />
              <span class="type-title">{{ et.title }}</span>
              <span class="type-dur">
                <Clock :size="11" />
                {{ et.duration_minutes }} min
                <template v-if="et.buffer_minutes"> +{{ et.buffer_minutes }}</template>
              </span>
              <button
                class="toggle-active"
                :class="{ active: et.is_active }"
                :title="et.is_active ? 'Actif' : 'Inactif'"
                :aria-label="et.is_active ? 'Desactiver' : 'Activer'"
                @click.stop="toggleActive(et)"
              >
                <Check v-if="et.is_active" :size="10" />
                <X v-else :size="10" />
              </button>
              <button class="btn-icon btn-danger" title="Supprimer" aria-label="Supprimer le type" @click.stop="deleteEventType(et.id)">
                <Trash2 :size="12" />
              </button>
            </div>

            <!-- Expanded: generate link -->
            <div v-if="expandedTypeId === et.id" class="type-expand">
              <!-- Visio Jitsi Meet (libre, gratuit, lien unique par RDV) -->
              <div class="jitsi-link">
                <div class="public-link-head">
                  <Video :size="13" />
                  <span class="field-label">Visio Jitsi Meet</span>
                  <button
                    class="toggle-active toggle-public"
                    :class="{ active: et.use_jitsi }"
                    :title="et.use_jitsi ? 'Jitsi actif — cliquer pour desactiver' : 'Activer la generation auto d\'un lien Jitsi par RDV'"
                    :aria-label="et.use_jitsi ? 'Desactiver Jitsi' : 'Activer Jitsi'"
                    @click.stop="toggleJitsi(et)"
                  >
                    <Check v-if="et.use_jitsi" :size="10" />
                    <X v-else :size="10" />
                  </button>
                </div>
                <p class="public-help">
                  Si actif, Cursus genere un lien Jitsi Meet unique pour chaque reservation
                  (libre, gratuit, sans inscription). Prend le pas sur Microsoft Teams meme si connecte.
                </p>
              </div>

              <!-- Lien public ouvert (style Calendly classique) -->
              <div class="public-link">
                <div class="public-link-head">
                  <Globe :size="13" />
                  <span class="field-label">Lien public ouvert</span>
                  <button
                    class="toggle-active toggle-public"
                    :class="{ active: et.is_public }"
                    :title="et.is_public ? 'Lien public actif — cliquer pour desactiver' : 'Activer le lien public'"
                    :aria-label="et.is_public ? 'Desactiver le lien public' : 'Activer le lien public'"
                    @click.stop="togglePublic(et)"
                  >
                    <Check v-if="et.is_public" :size="10" />
                    <X v-else :size="10" />
                  </button>
                </div>
                <p class="public-help">
                  N'importe qui ouvrant ce lien peut reserver un creneau (saisit son nom + email lui-meme).
                  Aucun compte Cursus requis.
                </p>
                <div v-if="et.is_public" class="link-result">
                  <input class="input-field url-field" :value="getPublicUrl(et)" readonly @click="($event.target as HTMLInputElement).select()" />
                  <button class="btn-sm btn-primary" @click="copyPublicUrl(et)">
                    <Copy v-if="publicCopiedId !== et.id" :size="12" />
                    <Check v-else :size="12" />
                    {{ publicCopiedId === et.id ? 'Copie' : 'Copier' }}
                  </button>
                  <QrCode :value="getPublicUrl(et)" :size="80" />
                </div>
              </div>

              <div class="link-gen">
                <label class="field-label">Generer un lien pour un etudiant</label>
                <div class="link-row">
                  <select
                    v-model="linkStudentId"
                    class="input-field select-sm"
                  >
                    <option :value="null" disabled>-- Choisir un etudiant --</option>
                    <option v-for="s in allStudents" :key="s.id" :value="s.id">
                      {{ s.name }}
                    </option>
                  </select>
                  <button
                    class="btn-sm btn-primary"
                    :disabled="!linkStudentId"
                    @click="onGenerateLink(et.id)"
                  >
                    <Link :size="12" />
                    Generer
                  </button>
                </div>
                <div v-if="generatedUrl && linkEventTypeId === et.id" class="link-result">
                  <input class="input-field url-field" :value="generatedUrl" readonly />
                  <button class="btn-sm btn-primary" @click="copyUrl">
                    <Copy v-if="!copySuccess" :size="12" />
                    <Check v-else :size="12" />
                    {{ copySuccess ? 'Copie' : 'Copier' }}
                  </button>
                  <QrCode :value="generatedUrl" :size="80" />
                </div>

                <!-- Bulk generation -->
                <div class="bulk-gen">
                  <label class="field-label">Generer pour toute une promo</label>
                  <div class="link-row">
                    <select v-model="bulkPromoId" class="input-field select-sm">
                      <option :value="null" disabled>-- Promo --</option>
                    </select>
                    <button class="btn-sm btn-primary" :disabled="!bulkPromoId" @click="onBulkGenerate(et.id)">
                      Generer tout
                    </button>
                  </div>
                  <div v-if="bulkResults && linkEventTypeId === et.id" class="bulk-results">
                    <div class="bulk-header">
                      <span class="field-label">{{ bulkResults.length }} liens</span>
                      <button class="btn-sm" @click="copyAllBulkLinks">Copier tout</button>
                    </div>
                    <div v-for="r in bulkResults" :key="r.studentName" class="bulk-row">
                      <span class="bulk-name">{{ r.studentName }}</span>
                      <input class="input-field url-field" :value="r.bookingUrl" readonly />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Create form -->
        <button
          v-if="!showCreateForm"
          class="btn-sm btn-primary add-type-btn"
          @click="showCreateForm = true"
        >
          <Plus :size="12" />
          Nouveau type
        </button>

        <div v-else class="create-form">
          <div class="form-header">
            <span class="field-label">Nouveau type de rendez-vous</span>
            <button class="btn-icon" aria-label="Fermer le formulaire" @click="showCreateForm = false">
              <X :size="14" />
            </button>
          </div>
          <div class="form-grid">
            <div class="form-field">
              <label class="field-label">Titre</label>
              <input v-model="newType.title" class="input-field" placeholder="Ex: Suivi individuel" />
            </div>
            <div class="form-field">
              <label class="field-label">Slug</label>
              <input v-model="newType.slug" class="input-field" placeholder="suivi-individuel" />
            </div>
            <div class="form-field">
              <label class="field-label">Duree</label>
              <select v-model="newType.duration_minutes" class="input-field">
                <option v-for="d in durationOptions" :key="d.value" :value="d.value">{{ d.label }}</option>
              </select>
            </div>
            <div class="form-field">
              <label class="field-label">Pause entre RDV</label>
              <select v-model="newType.buffer_minutes" class="input-field">
                <option v-for="b in bufferOptions" :key="b.value" :value="b.value">{{ b.label }}</option>
              </select>
            </div>
            <div class="form-field">
              <label class="field-label">Couleur</label>
              <div class="color-presets">
                <button
                  v-for="c in colorPresets" :key="c"
                  class="color-btn" :class="{ selected: newType.color === c }"
                  :style="{ background: c }" :aria-label="`Couleur ${c}`"
                  @click="newType.color = c"
                />
              </div>
            </div>
            <div class="form-field full-width">
              <label class="field-label">Description (optionnel)</label>
              <textarea v-model="newType.description" class="input-field textarea-sm" rows="2" placeholder="Description du creneau..." />
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-sm" @click="showCreateForm = false">Annuler</button>
            <button class="btn-sm btn-primary" :disabled="!newType.title.trim()" @click="onCreateEventType">
              <Check :size="12" /> Creer
            </button>
          </div>
        </div>
      </div>

      <!-- ─── Section 2: Availability ─────────────────────────────────── -->
      <div class="col col-availability">
        <div class="col-header">
          <Settings :size="14" />
          <span>Disponibilites</span>
        </div>

        <div class="week-grid">
          <div v-for="day in dayNumbers" :key="day" class="day-block">
            <div class="day-name">{{ dayNames[day] }}</div>
            <div class="day-rules">
              <div v-for="rule in (rulesByDay[day] ?? [])" :key="rule.id" class="rule-row">
                <span class="rule-time">{{ formatTime(rule.start_time) }} - {{ formatTime(rule.end_time) }}</span>
                <button class="btn-icon btn-danger" aria-label="Supprimer le creneau" @click="removeSlot(rule)">
                  <Trash2 :size="11" />
                </button>
              </div>
              <div v-if="(rulesByDay[day] ?? []).length === 0" class="no-rules">Aucun creneau</div>
            </div>
            <div class="add-slot-row">
              <input v-model="newSlots[day].start" type="time" class="input-field time-input" />
              <span class="slot-sep">-</span>
              <input v-model="newSlots[day].end" type="time" class="input-field time-input" />
              <button class="btn-icon btn-add" aria-label="Ajouter un creneau" @click="onAddSlot(day)">
                <Plus :size="12" />
              </button>
            </div>
          </div>
        </div>

        <button class="btn-sm btn-primary save-avail-btn" :disabled="savingAvailability" @click="saveAvailability">
          <Check :size="12" />
          {{ savingAvailability ? 'Sauvegarde...' : 'Enregistrer' }}
        </button>
      </div>

      <!-- ─── Section 3: My Bookings ──────────────────────────────────── -->
      <div class="col col-bookings">
        <div class="col-header">
          <Users :size="14" />
          <span>Mes RDV</span>
          <div class="view-toggle">
            <button class="view-btn" :class="{ active: bookingsView === 'calendar' }" aria-label="Vue calendrier" @click="bookingsView = 'calendar'">
              <CalendarDays :size="12" />
            </button>
            <button class="view-btn" :class="{ active: bookingsView === 'list' }" aria-label="Vue liste" @click="bookingsView = 'list'">
              <LayoutList :size="12" />
            </button>
          </div>
        </div>

        <!-- Calendar view -->
        <BookingCalendarView
          v-if="bookingsView === 'calendar'"
          :bookings="sortedBookings"
          :event-types="eventTypes"
        />

        <!-- List view -->
        <div v-else class="booking-list">
          <div v-for="bk in sortedBookings" :key="bk.id" class="booking-card">
            <div class="bk-date"><Calendar :size="11" /> {{ formatDate(bk.date) }}</div>
            <div class="bk-time"><Clock :size="11" /> {{ formatTime(bk.start_time) }} - {{ formatTime(bk.end_time) }}</div>
            <div v-if="bk.event_type_title" class="bk-type">{{ bk.event_type_title }}</div>
            <div class="bk-people">
              <span v-if="bk.tutor_name" class="bk-person">{{ bk.tutor_name }}</span>
              <span v-if="bk.student_name" class="bk-person">{{ bk.student_name }}</span>
            </div>
            <span class="bk-badge" :class="statusClass(bk.status)">{{ statusLabel(bk.status) }}</span>
          </div>
          <div v-if="sortedBookings.length === 0" class="empty-state">
            Aucun rendez-vous a venir
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-booking {
  display: flex; flex-direction: column; gap: 12px;
  font-family: var(--font); color: var(--text-primary);
}

/* ─── Top bar ──────────────────────────────────────────────────────────────── */
.top-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; background: var(--bg-elevated);
  border: 1px solid var(--border); border-radius: 10px;
}
.top-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; }
.ms-status { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.ms-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ms-dot.connected { background: #22c55e; }
.ms-dot.disconnected { background: #94a3b8; }
.ms-label { color: var(--text-secondary); }

/* ─── Loading ──────────────────────────────────────────────────────────────── */
.loading-state { text-align: center; padding: 40px; color: var(--text-muted); font-size: 12px; }

/* ─── Columns ──────────────────────────────────────────────────────────────── */
.columns { display: grid; grid-template-columns: 2fr 1.5fr 1.5fr; gap: 12px; }
@media (max-width: 1100px) { .columns { grid-template-columns: 1fr; } }

.col {
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 10px; padding: 12px;
  display: flex; flex-direction: column; gap: 10px; min-width: 0;
}
.col-header {
  display: flex; align-items: center; gap: 6px;
  font-size: 14px; font-weight: 700;
  padding-bottom: 6px; border-bottom: 1px solid var(--border);
}

.view-toggle { display: flex; gap: 2px; margin-left: auto; }
.view-btn {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 4px; border: none;
  background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.12s;
}
.view-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.view-btn.active { background: var(--accent); color: #fff; }

/* ─── Event types ──────────────────────────────────────────────────────────── */
.type-list { display: flex; flex-direction: column; gap: 6px; max-height: 360px; overflow-y: auto; }
.type-card { background: var(--bg-main); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.type-row {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  cursor: pointer; transition: background 0.15s;
}
.type-row:hover { background: var(--bg-hover); }
.color-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.type-title { font-size: 12px; font-weight: 600; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.type-dur { display: flex; align-items: center; gap: 3px; font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.toggle-active {
  width: 20px; height: 20px; border-radius: 4px; border: 1px solid var(--border-input);
  background: var(--bg-input); display: flex; align-items: center; justify-content: center;
  cursor: pointer; color: var(--text-muted); flex-shrink: 0; transition: all 0.15s;
}
.toggle-active.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.type-expand { padding: 8px 10px; border-top: 1px solid var(--border); background: var(--bg-main); }
.link-gen { display: flex; flex-direction: column; gap: 6px; }
.link-row { display: flex; gap: 6px; align-items: center; }
.select-sm { flex: 1; min-width: 0; }
.link-result { display: flex; gap: 6px; align-items: center; margin-top: 4px; }
.url-field { flex: 1; min-width: 0; font-size: 11px; }
.public-link, .jitsi-link {
  display: flex; flex-direction: column; gap: 6px;
  padding: 8px 10px; margin: -8px -10px 8px;
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-elevated));
  border-bottom: 1px solid var(--border);
}
.jitsi-link { background: color-mix(in srgb, #22c55e 6%, var(--bg-elevated)); }
.public-link-head { display: flex; align-items: center; gap: 6px; }
.public-help { font-size: 11px; color: var(--text-muted); margin: 0; line-height: 1.4; }
.toggle-public { margin-left: auto; }
.bulk-gen { margin-top: 8px; display: flex; flex-direction: column; gap: 6px; border-top: 1px dashed var(--border); padding-top: 8px; }
.bulk-results { display: flex; flex-direction: column; gap: 3px; max-height: 150px; overflow-y: auto; }
.bulk-header { display: flex; align-items: center; justify-content: space-between; }
.bulk-row { display: flex; align-items: center; gap: 6px; }
.bulk-name { font-size: 11px; font-weight: 600; min-width: 80px; color: var(--text-secondary); }

/* ─── Create form ──────────────────────────────────────────────────────────── */
.add-type-btn { align-self: flex-start; }
.create-form { background: var(--bg-main); border: 1px solid var(--border); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.form-header { display: flex; align-items: center; justify-content: space-between; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.form-field { display: flex; flex-direction: column; gap: 3px; }
.form-field.full-width { grid-column: 1 / -1; }
.field-label { font-size: 11px; font-weight: 600; color: var(--text-secondary); }
.color-presets { display: flex; gap: 4px; flex-wrap: wrap; }
.color-btn { width: 18px; height: 18px; border-radius: 4px; border: 2px solid transparent; cursor: pointer; transition: border-color 0.15s; }
.color-btn.selected { border-color: var(--text-primary); }
.color-btn:hover { border-color: var(--text-secondary); }
.textarea-sm { resize: vertical; min-height: 36px; }
.form-actions { display: flex; justify-content: flex-end; gap: 6px; }

/* ─── Availability ─────────────────────────────────────────────────────────── */
.week-grid { display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow-y: auto; }
.day-block { background: var(--bg-main); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; }
.day-name { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
.day-rules { display: flex; flex-direction: column; gap: 3px; margin-bottom: 6px; }
.rule-row { display: flex; align-items: center; justify-content: space-between; padding: 3px 6px; background: var(--bg-elevated); border-radius: 4px; }
.rule-time { font-size: 11px; color: var(--text-secondary); }
.no-rules { font-size: 11px; color: var(--text-muted); font-style: italic; }
.add-slot-row { display: flex; align-items: center; gap: 4px; }
.time-input { width: 80px; font-size: 11px; padding: 3px 6px; }
.slot-sep { font-size: 11px; color: var(--text-muted); }
.btn-add { color: var(--accent); }
.save-avail-btn { align-self: flex-end; }

/* ─── Bookings ─────────────────────────────────────────────────────────────── */
.booking-list { display: flex; flex-direction: column; gap: 6px; max-height: 440px; overflow-y: auto; }
.booking-card { background: var(--bg-main); border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 3px; }
.bk-date, .bk-time { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-secondary); }
.bk-type { font-size: 12px; font-weight: 600; }
.bk-people { display: flex; gap: 8px; font-size: 11px; color: var(--text-secondary); }
.bk-person::before { content: "- "; }
.bk-badge { display: inline-block; align-self: flex-start; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-top: 2px; }
.badge-success { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.badge-warning { background: rgba(234, 179, 8, 0.15); color: #eab308; }
.badge-danger { background: rgba(248, 113, 113, 0.15); color: #f87171; }
.empty-state { text-align: center; font-size: 12px; color: var(--text-muted); padding: 20px 0; }

/* ─── Shared ───────────────────────────────────────────────────────────────── */
.input-field {
  background: var(--bg-input); border: 1px solid var(--border-input); border-radius: 6px;
  font-family: var(--font); font-size: 12px; color: var(--text-primary);
  padding: 5px 8px; outline: none; transition: border-color 0.15s;
}
.input-field:focus { border-color: var(--accent); }

.btn-sm {
  display: inline-flex; align-items: center; gap: 4px;
  font-family: var(--font); font-size: 11px; font-weight: 600;
  padding: 4px 10px; border-radius: 6px;
  border: 1px solid var(--border); background: var(--bg-elevated);
  color: var(--text-primary); cursor: pointer; transition: all 0.15s;
}
.btn-sm:hover { background: var(--bg-hover); }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn-primary:hover { opacity: 0.9; }
.btn-danger { color: #f87171; }

.btn-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border: none; background: none;
  cursor: pointer; border-radius: 4px; color: var(--text-muted);
  flex-shrink: 0; transition: all 0.15s;
}
.btn-icon:hover { background: var(--bg-hover); color: var(--text-primary); }
.btn-icon.btn-danger:hover { color: #f87171; }
</style>
