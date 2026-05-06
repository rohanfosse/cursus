<script setup lang="ts">
/**
 * CreateBookingModal — creation directe d'un RDV (style Outlook).
 *
 * Le prof selectionne :
 *   - un type de RDV (preselectionne si pre-fill ou si un seul actif)
 *   - 1+ etudiants (search + multi-select)
 *   - une date + une heure de debut
 *   - eventuellement override de la duree (par defaut = duree de l'event-type)
 *
 * Soumission -> POST /api/bookings/direct via useBooking.createDirectBooking.
 *
 * Props facultatives `prefill` permettent l'invocation depuis un click sur
 * la grille calendrier (date + heure pre-remplis), depuis la sidebar
 * (vide), depuis un raccourci Ctrl+N, etc.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Calendar, Clock, Search, Users, X, Check } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import UiButton from '@/components/ui/UiButton.vue'
import type { BookingHandle, EventType } from '@/composables/useBooking'

interface Student {
  id: number
  name?: string
  email?: string
  promo_id?: number | null
  promo_name?: string | null
}

interface Prefill {
  eventTypeId?: number
  studentIds?: number[]
  date?: string         // YYYY-MM-DD
  startTime?: string    // HH:MM
  durationMinutes?: number
}

interface Props {
  modelValue: boolean
  booking: BookingHandle
  students: Student[]
  prefill?: Prefill | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'created', detail: { created: number; skipped: number }): void
}>()

// ── State ─────────────────────────────────────────────────────────────────

const eventTypeId  = ref<number | null>(null)
const selectedIds  = ref<number[]>([])
const date         = ref('')
const startTime    = ref('')
const customDuration = ref<number | null>(null)
const studentSearch = ref('')
const submitting   = ref(false)

// ── Initialisation ────────────────────────────────────────────────────────

function initForm() {
  // Event type : prefill > seul actif > premier actif
  const activeTypes = props.booking.eventTypes.value.filter(t => t.is_active)
  if (props.prefill?.eventTypeId && activeTypes.some(t => t.id === props.prefill?.eventTypeId)) {
    eventTypeId.value = props.prefill.eventTypeId
  } else if (activeTypes.length === 1) {
    eventTypeId.value = activeTypes[0].id
  } else {
    eventTypeId.value = activeTypes[0]?.id ?? null
  }

  // Date / heure : prefill ou prochain creneau rond (heure suivante)
  if (props.prefill?.date) {
    date.value = props.prefill.date
  } else {
    date.value = new Date().toISOString().slice(0, 10)
  }
  if (props.prefill?.startTime) {
    startTime.value = props.prefill.startTime
  } else {
    const now = new Date()
    now.setMinutes(0, 0, 0)
    now.setHours(now.getHours() + 1)
    startTime.value = now.toTimeString().slice(0, 5)
  }

  // Etudiants : prefill ou aucun
  selectedIds.value = props.prefill?.studentIds?.slice() ?? []

  // Duree : seulement si prefill (sinon laisser la valeur de l'event-type s'appliquer)
  customDuration.value = props.prefill?.durationMinutes ?? null

  studentSearch.value = ''
}

watch(() => props.modelValue, (open) => {
  if (open) {
    initForm()
    // Focus le champ de recherche etudiant a l'ouverture pour aller vite.
    nextTick(() => {
      const input = document.getElementById('cbm-student-search') as HTMLInputElement | null
      input?.focus()
    })
  }
})
onMounted(() => { if (props.modelValue) initForm() })

// ── Computed ──────────────────────────────────────────────────────────────

const selectedEventType = computed<EventType | null>(() =>
  props.booking.eventTypes.value.find(t => t.id === eventTypeId.value) ?? null,
)

const effectiveDuration = computed(() =>
  customDuration.value ?? selectedEventType.value?.duration_minutes ?? 30,
)

const filteredStudents = computed<Student[]>(() => {
  const q = studentSearch.value.trim().toLowerCase()
  if (!q) return props.students
  return props.students.filter(s =>
    s.name?.toLowerCase().includes(q)
    || s.email?.toLowerCase().includes(q)
    || s.promo_name?.toLowerCase().includes(q),
  )
})

const selectedStudents = computed<Student[]>(() => {
  const set = new Set(selectedIds.value)
  return props.students.filter(s => set.has(s.id))
})

/** Groupe les etudiants par promo pour le selecteur — facilite le pick d'une promo entiere. */
const studentsByPromo = computed(() => {
  const map = new Map<string, { promoId: number | null; promoName: string; students: Student[] }>()
  for (const s of filteredStudents.value) {
    const key = s.promo_id != null ? String(s.promo_id) : 'no-promo'
    const promoName = s.promo_name || 'Sans promo'
    if (!map.has(key)) map.set(key, { promoId: s.promo_id ?? null, promoName, students: [] })
    map.get(key)!.students.push(s)
  }
  return [...map.values()].sort((a, b) => a.promoName.localeCompare(b.promoName, 'fr'))
})

const canSubmit = computed(() =>
  eventTypeId.value != null
  && selectedIds.value.length > 0
  && /^\d{4}-\d{2}-\d{2}$/.test(date.value)
  && /^\d{2}:\d{2}$/.test(startTime.value)
  && !submitting.value,
)

// ── Actions ───────────────────────────────────────────────────────────────

function toggleStudent(id: number) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

function toggleGroup(group: { students: Student[] }) {
  const ids = group.students.map(s => s.id)
  const allSelected = ids.every(id => selectedIds.value.includes(id))
  if (allSelected) {
    selectedIds.value = selectedIds.value.filter(id => !ids.includes(id))
  } else {
    const set = new Set(selectedIds.value)
    for (const id of ids) set.add(id)
    selectedIds.value = [...set]
  }
}

function isGroupFullySelected(group: { students: Student[] }): boolean {
  return group.students.length > 0 && group.students.every(s => selectedIds.value.includes(s.id))
}

function isGroupPartiallySelected(group: { students: Student[] }): boolean {
  return !isGroupFullySelected(group) && group.students.some(s => selectedIds.value.includes(s.id))
}

function clearSelection() { selectedIds.value = [] }

async function onSubmit() {
  if (!canSubmit.value || eventTypeId.value == null) return
  submitting.value = true
  try {
    // ISO local + offset : on passe par Date qui injecte l'offset utilisateur,
    // puis toISOString pour normaliser en UTC. Backend stocke en UTC ISO.
    const local = new Date(`${date.value}T${startTime.value}:00`)
    const startDatetime = local.toISOString()
    const result = await props.booking.createDirectBooking({
      eventTypeId: eventTypeId.value,
      studentIds:  selectedIds.value,
      startDatetime,
      durationMinutes: customDuration.value ?? undefined,
    })
    if (result) {
      emit('created', { created: result.created, skipped: result.skipped })
      emit('update:modelValue', false)
    }
  } finally {
    submitting.value = false
  }
}

function close() { emit('update:modelValue', false) }
</script>

<template>
  <Modal :model-value="modelValue" title="Nouveau rendez-vous" max-width="600px" @update:model-value="(v) => emit('update:modelValue', v)">
    <form class="cbm-form" @submit.prevent="onSubmit">
      <!-- Event type -->
      <div class="cbm-field">
        <label class="cbm-label" for="cbm-type">Type de RDV</label>
        <select id="cbm-type" v-model.number="eventTypeId" class="cbm-input" required>
          <option :value="null" disabled>— Choisir un type —</option>
          <option
            v-for="et in props.booking.eventTypes.value.filter(t => t.is_active)"
            :key="et.id"
            :value="et.id"
          >
            {{ et.title }} · {{ et.duration_minutes }} min
          </option>
        </select>
      </div>

      <!-- Date + Heure + Duree (3 cols compact) -->
      <div class="cbm-grid">
        <div class="cbm-field">
          <label class="cbm-label" for="cbm-date">
            <Calendar :size="11" />
            Date
          </label>
          <input id="cbm-date" v-model="date" class="cbm-input" type="date" required />
        </div>
        <div class="cbm-field">
          <label class="cbm-label" for="cbm-time">
            <Clock :size="11" />
            Debut
          </label>
          <input id="cbm-time" v-model="startTime" class="cbm-input" type="time" step="900" required />
        </div>
        <div class="cbm-field">
          <label class="cbm-label" for="cbm-duration">Duree (min)</label>
          <input
            id="cbm-duration"
            :value="effectiveDuration"
            class="cbm-input"
            type="number"
            min="5" max="480" step="5"
            @input="(e) => customDuration = Number((e.target as HTMLInputElement).value) || null"
          />
        </div>
      </div>

      <!-- Etudiants -->
      <div class="cbm-field">
        <div class="cbm-label-row">
          <span class="cbm-label">
            <Users :size="11" />
            Etudiants
            <span v-if="selectedIds.length > 0" class="cbm-count-pill">{{ selectedIds.length }}</span>
          </span>
          <button v-if="selectedIds.length > 0" type="button" class="cbm-link-btn" @click="clearSelection">
            Tout decocher
          </button>
        </div>

        <!-- Selected chips (au-dessus de la recherche pour rester visibles) -->
        <div v-if="selectedStudents.length > 0" class="cbm-chips" role="list">
          <span v-for="s in selectedStudents" :key="s.id" class="cbm-chip" role="listitem">
            {{ s.name }}
            <button type="button" :aria-label="`Retirer ${s.name}`" @click="toggleStudent(s.id)">
              <X :size="11" />
            </button>
          </span>
        </div>

        <div class="cbm-search-wrap">
          <Search :size="13" class="cbm-search-icon" aria-hidden="true" />
          <input
            id="cbm-student-search"
            v-model="studentSearch"
            class="cbm-input cbm-search-input"
            type="text"
            placeholder="Rechercher un etudiant ou une promo..."
          />
        </div>

        <div class="cbm-students-list" role="listbox" aria-multiselectable="true">
          <div v-if="filteredStudents.length === 0" class="cbm-empty">
            <span v-if="studentSearch">Aucun resultat pour "{{ studentSearch }}".</span>
            <span v-else>Aucun etudiant disponible.</span>
          </div>

          <div v-for="group in studentsByPromo" :key="group.promoName" class="cbm-group">
            <button
              type="button"
              class="cbm-group-header"
              :class="{
                'cbm-group-header--all': isGroupFullySelected(group),
                'cbm-group-header--some': isGroupPartiallySelected(group),
              }"
              :aria-pressed="isGroupFullySelected(group)"
              :title="isGroupFullySelected(group) ? 'Tout decocher dans cette promo' : 'Tout cocher dans cette promo'"
              @click="toggleGroup(group)"
            >
              <span class="cbm-group-checkmark">
                <Check v-if="isGroupFullySelected(group)" :size="11" />
                <span v-else-if="isGroupPartiallySelected(group)" class="cbm-group-dot" />
              </span>
              <span class="cbm-group-name">{{ group.promoName }}</span>
              <span class="cbm-group-count">{{ group.students.length }}</span>
            </button>
            <div class="cbm-group-students">
              <button
                v-for="s in group.students"
                :key="s.id"
                type="button"
                class="cbm-student-row"
                :class="{ 'cbm-student-row--selected': selectedIds.includes(s.id) }"
                role="option"
                :aria-selected="selectedIds.includes(s.id)"
                @click="toggleStudent(s.id)"
              >
                <span class="cbm-student-checkmark">
                  <Check v-if="selectedIds.includes(s.id)" :size="11" />
                </span>
                <span class="cbm-student-name">{{ s.name }}</span>
                <span v-if="s.email" class="cbm-student-email">{{ s.email }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <footer class="cbm-footer">
        <UiButton variant="ghost" type="button" @click="close">Annuler</UiButton>
        <UiButton variant="primary" type="submit" :disabled="!canSubmit" :loading="submitting">
          {{ submitting ? 'Creation...' : `Creer ${selectedIds.length > 1 ? `${selectedIds.length} RDV` : 'le RDV'}` }}
        </UiButton>
      </footer>
    </form>
  </Modal>
</template>

<style scoped>
.cbm-form {
  display: flex; flex-direction: column; gap: 14px;
  font-family: var(--font);
  color: var(--text-primary);
}

.cbm-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }

.cbm-label {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .04em;
  color: var(--text-muted);
}
.cbm-label-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }

.cbm-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
  transition: border-color var(--motion-fast) var(--ease-out), box-shadow var(--motion-fast) var(--ease-out);
}
.cbm-input:hover { border-color: var(--border-input); }
.cbm-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent); }

.cbm-grid {
  display: grid;
  grid-template-columns: 1.3fr 1fr 1fr;
  gap: 10px;
}
@media (max-width: 540px) {
  .cbm-grid { grid-template-columns: 1fr 1fr; }
}

/* ── Selected chips ───────────────────────────────────────────────────── */
.cbm-chips {
  display: flex; flex-wrap: wrap; gap: 4px;
  padding: 6px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent) 4%, transparent);
}
.cbm-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 4px 3px 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-primary);
}
.cbm-chip button {
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 50%;
  transition: background var(--motion-fast) var(--ease-out), color var(--motion-fast) var(--ease-out);
}
.cbm-chip button:hover { background: var(--bg-hover); color: var(--color-danger); }

.cbm-count-pill {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 16px;
  padding: 0 5px;
  background: var(--accent);
  color: #fff;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.cbm-link-btn {
  background: transparent; border: none;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: var(--radius-xs);
  transition: color var(--motion-fast) var(--ease-out);
}
.cbm-link-btn:hover { color: var(--accent); }

/* ── Search + list ────────────────────────────────────────────────────── */
.cbm-search-wrap { position: relative; }
.cbm-search-icon {
  position: absolute; top: 50%; left: 9px;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}
.cbm-search-input { padding-left: 28px; }

.cbm-students-list {
  display: flex;
  flex-direction: column;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-canvas);
}

.cbm-empty {
  padding: 16px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  font-style: italic;
}

.cbm-group { display: flex; flex-direction: column; }
.cbm-group + .cbm-group { border-top: 1px solid var(--border); }

.cbm-group-header {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px;
  background: var(--bg-elevated);
  border: none;
  border-bottom: 1px solid var(--border);
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background var(--motion-fast) var(--ease-out);
}
.cbm-group-header:hover { background: var(--bg-hover); }
.cbm-group-header--all { background: color-mix(in srgb, var(--accent) 8%, var(--bg-elevated)); color: var(--accent); }
.cbm-group-header--some { background: color-mix(in srgb, var(--accent) 4%, var(--bg-elevated)); color: var(--text-primary); }

.cbm-group-checkmark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background: var(--bg-canvas);
  color: var(--accent);
  flex-shrink: 0;
}
.cbm-group-header--all .cbm-group-checkmark { background: var(--accent); border-color: var(--accent); color: #fff; }
.cbm-group-dot { width: 8px; height: 8px; background: var(--accent); border-radius: 2px; }

.cbm-group-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cbm-group-count {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-canvas);
  padding: 1px 6px;
  border-radius: 999px;
}

.cbm-group-students { display: flex; flex-direction: column; }

.cbm-student-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 10px 6px 28px;
  background: transparent;
  border: none;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  border-bottom: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
  transition: background var(--motion-fast) var(--ease-out);
}
.cbm-student-row:last-child { border-bottom: none; }
.cbm-student-row:hover { background: var(--bg-hover); }
.cbm-student-row--selected {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}
.cbm-student-row--selected:hover { background: color-mix(in srgb, var(--accent) 10%, transparent); }

.cbm-student-checkmark {
  display: inline-flex; align-items: center; justify-content: center;
  width: 16px; height: 16px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  background: var(--bg-elevated);
  color: var(--accent);
  flex-shrink: 0;
}
.cbm-student-row--selected .cbm-student-checkmark {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.cbm-student-name {
  font-size: 12.5px; font-weight: 600;
  color: var(--text-primary);
  flex-shrink: 0;
}
.cbm-student-email {
  font-size: 11px;
  color: var(--text-muted);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

/* ── Footer ──────────────────────────────────────────────────────────── */
.cbm-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding-top: 8px;
  margin-top: 4px;
  border-top: 1px solid var(--border);
}

@media (prefers-reduced-motion: reduce) {
  .cbm-input, .cbm-chip button, .cbm-link-btn,
  .cbm-group-header, .cbm-student-row { transition: none; }
}
</style>
