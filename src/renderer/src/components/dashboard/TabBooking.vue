/**
 * TabBooking.vue
 * ---------------------------------------------------------------------------
 * Mini-Calendly booking management tab for the teacher dashboard.
 * Three-column layout: Event types | Availability | My bookings
 * Integrates with Microsoft Graph via OAuth for calendar sync.
 */
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  CalendarPlus, Clock, Link, Users, Settings, Trash2, Plus,
  Check, X, ExternalLink, Copy, Calendar, Globe,
} from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const { showToast } = useToast()

// ── Props ────────────────────────────────────────────────────────────────────

const props = defineProps<{
  allStudents: Array<{ id: number; name?: string; email?: string; promo_id?: number }>
}>()

// ── Types ────────────────────────────────────────────────────────────────────

interface EventType {
  id: number
  title: string
  slug: string
  description?: string
  duration_minutes: number
  color: string
  fallback_visio_url?: string
  is_active: number
  created_at: string
}

interface AvailabilityRule {
  id: number
  day_of_week: number
  start_time: string
  end_time: string
}

interface Booking {
  id: number
  date: string
  start_time: string
  end_time: string
  student_name?: string
  tutor_name?: string
  status: string
  event_type_title?: string
  visio_url?: string
}

// ── State ────────────────────────────────────────────────────────────────────

const loading = ref(true)

// Microsoft OAuth
const msConnected = ref(false)
const msExpires = ref<string | null>(null)

// Event types
const eventTypes = ref<EventType[]>([])
const expandedTypeId = ref<number | null>(null)
const showCreateForm = ref(false)

// New event type form
const newType = ref({
  title: '',
  slug: '',
  description: '',
  duration_minutes: 30,
  color: '#6366f1',
  fallback_visio_url: '',
})

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

// Link generation
const linkStudentId = ref<number | null>(null)
const linkEventTypeId = ref<number | null>(null)
const generatedUrl = ref('')
const copySuccess = ref(false)

// Availability
const availability = ref<AvailabilityRule[]>([])
const savingAvailability = ref(false)

const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
const dayNumbers = [1, 2, 3, 4, 5] // Monday=1 ... Friday=5

const newSlots = ref<Record<number, { start: string; end: string }>>({
  1: { start: '09:00', end: '10:00' },
  2: { start: '09:00', end: '10:00' },
  3: { start: '09:00', end: '10:00' },
  4: { start: '09:00', end: '10:00' },
  5: { start: '09:00', end: '10:00' },
})

// Bookings
const bookings = ref<Booking[]>([])

// ── Computed ─────────────────────────────────────────────────────────────────

const sortedBookings = computed(() => {
  return [...bookings.value].sort((a, b) => {
    const da = `${a.date}T${a.start_time}`
    const db = `${b.date}T${b.start_time}`
    return da.localeCompare(db)
  })
})

function rulesForDay(day: number) {
  return availability.value.filter(r => r.day_of_week === day)
}

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

// ── Status badge ─────────────────────────────────────────────────────────────

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    confirmed: 'Confirme',
    pending: 'En attente',
    cancelled: 'Annule',
    completed: 'Termine',
  }
  return map[status] || status
}

function statusClass(status: string): string {
  if (status === 'confirmed' || status === 'completed') return 'badge-success'
  if (status === 'pending') return 'badge-warning'
  if (status === 'cancelled') return 'badge-danger'
  return ''
}

// ── API calls ────────────────────────────────────────────────────────────────

async function fetchAll() {
  loading.value = true
  try {
    const [etRes, avRes, bkRes, oaRes] = await Promise.all([
      window.api.getBookingEventTypes(),
      window.api.getBookingAvailability(),
      window.api.getMyBookings(),
      window.api.getBookingOAuthStatus(),
    ])
    if (etRes.ok && etRes.data) eventTypes.value = etRes.data
    if (avRes.ok && avRes.data) availability.value = avRes.data
    if (bkRes.ok && bkRes.data) bookings.value = bkRes.data as Booking[]
    if (oaRes.ok && oaRes.data) {
      msConnected.value = oaRes.data.connected
      msExpires.value = oaRes.data.expiresAt ?? null
    }
  } catch (e) {
    showToast('Erreur lors du chargement des donnees de reservation', 'error')
  } finally {
    loading.value = false
  }
}

async function createEventType() {
  if (!newType.value.title.trim()) return
  try {
    const res = await window.api.createBookingEventType({
      title: newType.value.title,
      slug: newType.value.slug,
      description: newType.value.description || undefined,
      duration_minutes: newType.value.duration_minutes,
      color: newType.value.color,
      fallback_visio_url: newType.value.fallback_visio_url || undefined,
    })
    if (res.ok) {
      showToast('Type de rendez-vous cree', 'success')
      newType.value = { title: '', slug: '', description: '', duration_minutes: 30, color: '#6366f1', fallback_visio_url: '' }
      showCreateForm.value = false
      const etRes = await window.api.getBookingEventTypes()
      if (etRes.ok && etRes.data) eventTypes.value = etRes.data
    } else {
      showToast(res.error || 'Erreur lors de la creation', 'error')
    }
  } catch {
    showToast('Erreur lors de la creation du type', 'error')
  }
}

async function toggleActive(et: EventType) {
  try {
    const res = await window.api.updateBookingEventType(et.id, { is_active: et.is_active ? 0 : 1 })
    if (res.ok) {
      et.is_active = et.is_active ? 0 : 1
    } else {
      showToast(res.error || 'Erreur', 'error')
    }
  } catch {
    showToast('Erreur lors de la mise a jour', 'error')
  }
}

async function deleteEventType(id: number) {
  try {
    const res = await window.api.deleteBookingEventType(id)
    if (res.ok) {
      eventTypes.value = eventTypes.value.filter(e => e.id !== id)
      showToast('Type supprime', 'success')
    } else {
      showToast(res.error || 'Erreur lors de la suppression', 'error')
    }
  } catch {
    showToast('Erreur lors de la suppression', 'error')
  }
}

async function generateLink(eventTypeId: number) {
  if (!linkStudentId.value) return
  try {
    const res = await window.api.createBookingToken(eventTypeId, linkStudentId.value)
    if (res.ok && res.data) {
      generatedUrl.value = res.data.bookingUrl
      linkEventTypeId.value = eventTypeId
    } else {
      showToast(res.error || 'Erreur lors de la generation du lien', 'error')
    }
  } catch {
    showToast('Erreur lors de la generation du lien', 'error')
  }
}

async function copyUrl() {
  if (!generatedUrl.value) return
  try {
    await navigator.clipboard.writeText(generatedUrl.value)
    copySuccess.value = true
    setTimeout(() => { copySuccess.value = false }, 2000)
    showToast('Lien copie dans le presse-papier', 'success')
  } catch {
    showToast('Impossible de copier le lien', 'error')
  }
}

// Availability
async function addSlot(day: number) {
  const s = newSlots.value[day]
  if (!s.start || !s.end || s.start >= s.end) {
    showToast('Horaires invalides', 'error')
    return
  }
  availability.value.push({
    id: -(Date.now() + day), // temp negative id for new rules
    day_of_week: day,
    start_time: s.start,
    end_time: s.end,
  })
  newSlots.value[day] = { start: '09:00', end: '10:00' }
}

function removeSlot(rule: AvailabilityRule) {
  availability.value = availability.value.filter(r => r !== rule)
}

async function saveAvailability() {
  savingAvailability.value = true
  try {
    const rules = availability.value.map(r => ({
      day_of_week: r.day_of_week,
      start_time: r.start_time,
      end_time: r.end_time,
    }))
    const res = await window.api.setBookingAvailability(rules)
    if (res.ok) {
      showToast('Disponibilites enregistrees', 'success')
      const avRes = await window.api.getBookingAvailability()
      if (avRes.ok && avRes.data) availability.value = avRes.data
    } else {
      showToast(res.error || 'Erreur lors de la sauvegarde', 'error')
    }
  } catch {
    showToast('Erreur lors de la sauvegarde', 'error')
  } finally {
    savingAvailability.value = false
  }
}

// Microsoft OAuth
async function connectMs() {
  try {
    const res = await window.api.startBookingOAuth()
    if (res.ok && res.data?.url) {
      window.open(res.data.url, '_blank')
      // Poll status
      const poll = setInterval(async () => {
        const st = await window.api.getBookingOAuthStatus()
        if (st.ok && st.data?.connected) {
          msConnected.value = true
          msExpires.value = st.data.expiresAt ?? null
          clearInterval(poll)
          showToast('Compte Microsoft connecte', 'success')
        }
      }, 3000)
      setTimeout(() => clearInterval(poll), 120_000) // stop polling after 2min
    } else {
      showToast(res.error || 'Erreur OAuth', 'error')
    }
  } catch {
    showToast('Erreur lors de la connexion Microsoft', 'error')
  }
}

async function disconnectMs() {
  try {
    const res = await window.api.disconnectBookingOAuth()
    if (res.ok) {
      msConnected.value = false
      msExpires.value = null
      showToast('Compte Microsoft deconnecte', 'success')
    } else {
      showToast(res.error || 'Erreur', 'error')
    }
  } catch {
    showToast('Erreur lors de la deconnexion', 'error')
  }
}

// ── Format helpers ───────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatTime(timeStr: string): string {
  return timeStr.slice(0, 5)
}

// ── Init ─────────────────────────────────────────────────────────────────────

onMounted(fetchAll)
</script>

<template>
  <div class="tab-booking">
    <!-- Top bar -->
    <div class="top-bar">
      <div class="top-title">
        <Calendar :size="18" />
        <span>Rendez-vous</span>
      </div>
      <div class="ms-status">
        <span class="ms-dot" :class="msConnected ? 'connected' : 'disconnected'" />
        <span class="ms-label">
          {{ msConnected ? 'Microsoft connecte' : 'Microsoft non connecte' }}
        </span>
        <button
          v-if="msConnected"
          class="btn-sm btn-danger"
          @click="disconnectMs"
        >
          <X :size="12" />
          Deconnecter
        </button>
        <button
          v-else
          class="btn-sm btn-primary"
          @click="connectMs"
        >
          <Globe :size="12" />
          Connecter
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-state">Chargement...</div>

    <div v-else class="columns">
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
              </span>
              <button
                class="toggle-active"
                :class="{ active: et.is_active }"
                @click.stop="toggleActive(et)"
                :title="et.is_active ? 'Actif' : 'Inactif'"
              >
                <Check v-if="et.is_active" :size="10" />
                <X v-else :size="10" />
              </button>
              <button class="btn-icon btn-danger" @click.stop="deleteEventType(et.id)" title="Supprimer">
                <Trash2 :size="12" />
              </button>
            </div>

            <!-- Expanded: generate link -->
            <div v-if="expandedTypeId === et.id" class="type-expand">
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
                    @click="generateLink(et.id)"
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
            <button class="btn-icon" @click="showCreateForm = false">
              <X :size="14" />
            </button>
          </div>
          <div class="form-grid">
            <div class="form-field">
              <label class="field-label">Titre</label>
              <input
                v-model="newType.title"
                class="input-field"
                placeholder="Ex: Suivi individuel"
              />
            </div>
            <div class="form-field">
              <label class="field-label">Slug</label>
              <input
                v-model="newType.slug"
                class="input-field"
                placeholder="suivi-individuel"
              />
            </div>
            <div class="form-field">
              <label class="field-label">Duree</label>
              <select v-model="newType.duration_minutes" class="input-field">
                <option v-for="d in durationOptions" :key="d.value" :value="d.value">
                  {{ d.label }}
                </option>
              </select>
            </div>
            <div class="form-field">
              <label class="field-label">Couleur</label>
              <div class="color-presets">
                <button
                  v-for="c in colorPresets"
                  :key="c"
                  class="color-btn"
                  :class="{ selected: newType.color === c }"
                  :style="{ background: c }"
                  @click="newType.color = c"
                />
              </div>
            </div>
            <div class="form-field full-width">
              <label class="field-label">Description (optionnel)</label>
              <textarea
                v-model="newType.description"
                class="input-field textarea-sm"
                rows="2"
                placeholder="Description du creneau..."
              />
            </div>
          </div>
          <div class="form-actions">
            <button class="btn-sm" @click="showCreateForm = false">Annuler</button>
            <button
              class="btn-sm btn-primary"
              :disabled="!newType.title.trim()"
              @click="createEventType"
            >
              <Check :size="12" />
              Creer
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
            <div class="day-name">{{ dayNames[day - 1] }}</div>
            <div class="day-rules">
              <div
                v-for="rule in rulesForDay(day)"
                :key="rule.id"
                class="rule-row"
              >
                <span class="rule-time">{{ formatTime(rule.start_time) }} - {{ formatTime(rule.end_time) }}</span>
                <button class="btn-icon btn-danger" @click="removeSlot(rule)">
                  <Trash2 :size="11" />
                </button>
              </div>
              <div v-if="rulesForDay(day).length === 0" class="no-rules">Aucun creneau</div>
            </div>
            <div class="add-slot-row">
              <input
                v-model="newSlots[day].start"
                type="time"
                class="input-field time-input"
              />
              <span class="slot-sep">-</span>
              <input
                v-model="newSlots[day].end"
                type="time"
                class="input-field time-input"
              />
              <button class="btn-icon btn-add" @click="addSlot(day)">
                <Plus :size="12" />
              </button>
            </div>
          </div>
        </div>

        <button
          class="btn-sm btn-primary save-avail-btn"
          :disabled="savingAvailability"
          @click="saveAvailability"
        >
          <Check :size="12" />
          {{ savingAvailability ? 'Sauvegarde...' : 'Enregistrer' }}
        </button>
      </div>

      <!-- ─── Section 3: My Bookings ──────────────────────────────────── -->
      <div class="col col-bookings">
        <div class="col-header">
          <Users :size="14" />
          <span>Mes RDV</span>
        </div>

        <div class="booking-list">
          <div
            v-for="bk in sortedBookings"
            :key="bk.id"
            class="booking-card"
          >
            <div class="bk-date">
              <Calendar :size="11" />
              {{ formatDate(bk.date) }}
            </div>
            <div class="bk-time">
              <Clock :size="11" />
              {{ formatTime(bk.start_time) }} - {{ formatTime(bk.end_time) }}
            </div>
            <div v-if="bk.event_type_title" class="bk-type">{{ bk.event_type_title }}</div>
            <div class="bk-people">
              <span v-if="bk.tutor_name" class="bk-person">{{ bk.tutor_name }}</span>
              <span v-if="bk.student_name" class="bk-person">{{ bk.student_name }}</span>
            </div>
            <span class="bk-badge" :class="statusClass(bk.status)">
              {{ statusLabel(bk.status) }}
            </span>
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
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family: var(--font);
  color: var(--text-primary);
}

/* ─── Top bar ──────────────────────────────────────────────────────────────── */

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.top-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
}

.ms-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.ms-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ms-dot.connected { background: #22c55e; }
.ms-dot.disconnected { background: #94a3b8; }

.ms-label {
  color: var(--text-secondary);
}

/* ─── Loading ──────────────────────────────────────────────────────────────── */

.loading-state {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-size: 12px;
}

/* ─── Columns ──────────────────────────────────────────────────────────────── */

.columns {
  display: grid;
  grid-template-columns: 2fr 1.5fr 1.5fr;
  gap: 12px;
}

@media (max-width: 1100px) {
  .columns {
    grid-template-columns: 1fr;
  }
}

.col {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.col-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
}

/* ─── Event types ──────────────────────────────────────────────────────────── */

.type-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 360px;
  overflow-y: auto;
}

.type-card {
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.type-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.15s;
}

.type-row:hover {
  background: var(--bg-hover);
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.type-title {
  font-size: 12px;
  font-weight: 600;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.type-dur {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.toggle-active {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid var(--border-input);
  background: var(--bg-input);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: all 0.15s;
}

.toggle-active.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

/* Type expanded */

.type-expand {
  padding: 8px 10px;
  border-top: 1px solid var(--border);
  background: var(--bg-main);
}

.link-gen {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.link-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.select-sm {
  flex: 1;
  min-width: 0;
}

.link-result {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 4px;
}

.url-field {
  flex: 1;
  min-width: 0;
  font-size: 11px;
}

/* ─── Create form ──────────────────────────────────────────────────────────── */

.add-type-btn {
  align-self: flex-start;
}

.create-form {
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.form-field.full-width {
  grid-column: 1 / -1;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
}

.color-presets {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.color-btn {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s;
}

.color-btn.selected {
  border-color: var(--text-primary);
}

.color-btn:hover {
  border-color: var(--text-secondary);
}

.textarea-sm {
  resize: vertical;
  min-height: 36px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}

/* ─── Availability ─────────────────────────────────────────────────────────── */

.week-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.day-block {
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
}

.day-name {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 4px;
}

.day-rules {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 6px;
}

.rule-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 6px;
  background: var(--bg-elevated);
  border-radius: 4px;
}

.rule-time {
  font-size: 11px;
  color: var(--text-secondary);
}

.no-rules {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}

.add-slot-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.time-input {
  width: 80px;
  font-size: 11px;
  padding: 3px 6px;
}

.slot-sep {
  font-size: 11px;
  color: var(--text-muted);
}

.btn-add {
  color: var(--accent);
}

.save-avail-btn {
  align-self: flex-end;
}

/* ─── Bookings ─────────────────────────────────────────────────────────────── */

.booking-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 440px;
  overflow-y: auto;
}

.booking-card {
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
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
}

.bk-type {
  font-size: 12px;
  font-weight: 600;
}

.bk-people {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-secondary);
}

.bk-person::before {
  content: "- ";
}

.bk-badge {
  display: inline-block;
  align-self: flex-start;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  margin-top: 2px;
}

.badge-success {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.badge-warning {
  background: rgba(234, 179, 8, 0.15);
  color: #eab308;
}

.badge-danger {
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
}

.empty-state {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  padding: 20px 0;
}

/* ─── Shared ───────────────────────────────────────────────────────────────── */

.input-field {
  background: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: 6px;
  font-family: var(--font);
  font-size: 12px;
  color: var(--text-primary);
  padding: 5px 8px;
  outline: none;
  transition: border-color 0.15s;
}

.input-field:focus {
  border-color: var(--accent);
}

.btn-sm {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-sm:hover {
  background: var(--bg-hover);
}

.btn-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-danger {
  color: #f87171;
}

.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 4px;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: all 0.15s;
}

.btn-icon:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-icon.btn-danger:hover {
  color: #f87171;
}
</style>
