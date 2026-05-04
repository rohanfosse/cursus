<script setup lang="ts">
/**
 * TabBookingEventTypes.vue — section "Types d'evenements" de TabBooking.
 *
 * Liste des types de RDV configures par le prof + formulaire de creation.
 * Pour chaque type : toggle Jitsi, toggle lien public ouvert, generation
 * de lien nominatif (1 etudiant) ou en bulk (toute une promo). Inclut le
 * QR code du lien public (utile pour partager en classe).
 *
 * Le composable useBooking est instancie par TabBooking (parent) et passe
 * via prop pour eviter de dupliquer fetch + state + listeners socket.
 */
import { ref, computed, watch, onUnmounted } from 'vue'
import {
  CalendarPlus, Clock, Link, Trash2, Plus, Check, X, Copy, Globe, Video, Search, Eye,
} from 'lucide-vue-next'
import QrCode from '@/components/ui/QrCode.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import BookingPreviewModal from '@/components/booking/BookingPreviewModal.vue'
import type { BookingFlowInfo } from '@/components/booking/bookingFlow.types'
import { type BookingHandle, type EventType } from '@/composables/useBooking'

const props = defineProps<{
  booking: BookingHandle
  allStudents: Array<{ id: number; name?: string; email?: string; promo_id?: number }>
  /** Permet au parent (TabBooking) de declencher l'ouverture du formulaire
   *  via un raccourci clavier (Ctrl+N) sans coupler la logique. */
  openCreateSignal?: number
}>()

const expandedTypeId = ref<number | null>(null)
const showCreateForm = ref(false)
const filterQuery = ref('')

const filteredTypes = computed(() => {
  const q = filterQuery.value.trim().toLowerCase()
  if (!q) return props.booking.eventTypes.value
  return props.booking.eventTypes.value.filter(et =>
    et.title.toLowerCase().includes(q) || et.slug.toLowerCase().includes(q),
  )
})

watch(() => props.openCreateSignal, () => {
  showCreateForm.value = true
})
const bulkResults = ref<{ studentName: string; bookingUrl: string }[] | null>(null)
const bulkPromoId = ref<number | null>(null)
const linkStudentId = ref<number | null>(null)
const linkEventTypeId = ref<number | null>(null)
const generatedUrl = ref('')
const copySuccess = ref(false)
let copyTimeout: ReturnType<typeof setTimeout> | null = null

const publicCopiedId = ref<number | null>(null)
let publicCopyTimeout: ReturnType<typeof setTimeout> | null = null

// Palette d'identification fixe (pas des tokens theme — couleurs distinctives
// pour reconnaitre visuellement chaque type de RDV, alignee landing).
const COLOR_PRESETS = [
  '#6366F1', '#8B5CF6', '#059669', '#F59E0B', '#0EA5E9', '#EF4444',
  '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#64748B', '#78716C',
] as const

const DURATION_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
] as const

const BUFFER_OPTIONS = [
  { label: 'Aucun', value: 0 },
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
] as const

const newType = ref({
  title: '', slug: '', description: '',
  duration_minutes: 30, buffer_minutes: 0,
  color: COLOR_PRESETS[0] as string,
  fallback_visio_url: '',
})

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

watch(() => newType.value.title, (t) => {
  newType.value.slug = slugify(t)
})

async function onCreateEventType() {
  if (!newType.value.title.trim()) return
  const ok = await props.booking.createEventType({
    title: newType.value.title,
    slug: newType.value.slug,
    description: newType.value.description || undefined,
    duration_minutes: newType.value.duration_minutes,
    buffer_minutes: newType.value.buffer_minutes,
    color: newType.value.color,
    fallback_visio_url: newType.value.fallback_visio_url || undefined,
  })
  if (ok) {
    newType.value = {
      title: '', slug: '', description: '',
      duration_minutes: 30, buffer_minutes: 0,
      color: COLOR_PRESETS[0],
      fallback_visio_url: '',
    }
    showCreateForm.value = false
  }
}

async function onGenerateLink(eventTypeId: number) {
  if (!linkStudentId.value) return
  const url = await props.booking.generateLink(eventTypeId, linkStudentId.value)
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

async function copyPublicUrl(et: EventType) {
  try {
    await navigator.clipboard.writeText(props.booking.getPublicUrl(et))
    publicCopiedId.value = et.id
    if (publicCopyTimeout) clearTimeout(publicCopyTimeout)
    publicCopyTimeout = setTimeout(() => { publicCopiedId.value = null }, 2000)
  } catch { /* ignore */ }
}

async function onBulkGenerate(eventTypeId: number) {
  if (!bulkPromoId.value) return
  const results = await props.booking.generateBulkLinks(eventTypeId, bulkPromoId.value)
  bulkResults.value = results
}

function copyAllBulkLinks() {
  if (!bulkResults.value) return
  const text = bulkResults.value.map(r => `${r.studentName}\t${r.bookingUrl}`).join('\n')
  navigator.clipboard.writeText(text)
}

// ── Apercu visiteur ────────────────────────────────────────────────────────

const previewOpen = ref(false)
const previewInfo = ref<BookingFlowInfo | null>(null)
const previewUrl = ref<string | null>(null)

function openPreview(et: EventType) {
  previewInfo.value = {
    title: et.title,
    description: et.description ?? null,
    durationMinutes: et.duration_minutes,
    color: et.color,
    hostName: 'Toi (apercu)',
    timezone: et.timezone,
    attendeeName: null,
    attendeeEmail: null,
    withTutor: false,
  }
  // L'URL publique est utile meme si is_public=0 : le bouton "Ouvrir le vrai
  // lien" du modal envoie le prof voir sa page de production. Si non publie,
  // on n'expose pas le lien (le visiteur tomberait sur une erreur).
  previewUrl.value = et.is_public ? props.booking.getPublicUrl(et) : null
  previewOpen.value = true
}

onUnmounted(() => {
  if (copyTimeout) clearTimeout(copyTimeout)
  if (publicCopyTimeout) clearTimeout(publicCopyTimeout)
})
</script>

<template>
  <div class="col col-types">
    <div class="col-header">
      <CalendarPlus :size="14" aria-hidden="true" />
      <span>Types d'evenements</span>
      <span class="col-count" :title="`${booking.eventTypes.value.length} type(s) configure(s)`">
        {{ booking.eventTypes.value.length }}
      </span>
    </div>

    <div v-if="booking.eventTypes.value.length >= 4" class="filter-row">
      <Search :size="13" class="filter-icon" aria-hidden="true" />
      <input
        v-model="filterQuery"
        type="search"
        class="input-field filter-input"
        placeholder="Filtrer..."
        aria-label="Filtrer les types"
      />
      <button
        v-if="filterQuery"
        type="button"
        class="btn-icon filter-clear"
        aria-label="Effacer le filtre"
        @click="filterQuery = ''"
      >
        <X :size="11" />
      </button>
    </div>

    <EmptyState
      v-if="!booking.eventTypes.value.length"
      :icon="CalendarPlus"
      tone="accent"
      size="sm"
      title="Aucun type de RDV"
      subtitle="Cree ton premier type pour commencer a recevoir des reservations."
    />

    <div v-else class="type-list">
      <div
        v-for="et in filteredTypes"
        :key="et.id"
        class="type-card"
        :style="{ '--ic': et.color }"
      >
        <div class="type-row" @click="expandedTypeId = expandedTypeId === et.id ? null : et.id">
          <span class="color-dot" :style="{ background: et.color }" aria-hidden="true" />
          <span class="type-title">{{ et.title }}</span>
          <span class="type-dur">
            <Clock :size="11" aria-hidden="true" />
            {{ et.duration_minutes }} min
            <template v-if="et.buffer_minutes"> +{{ et.buffer_minutes }}</template>
          </span>
          <button
            type="button"
            class="toggle-active"
            :class="{ active: et.is_active }"
            :title="et.is_active ? 'Actif' : 'Inactif'"
            :aria-label="et.is_active ? 'Desactiver' : 'Activer'"
            :aria-pressed="!!et.is_active"
            @click.stop="booking.toggleActive(et)"
          >
            <Check v-if="et.is_active" :size="10" />
            <X v-else :size="10" />
          </button>
          <button
            type="button"
            class="btn-icon btn-preview"
            title="Apercu : voir ce que verra un etudiant"
            :aria-label="`Apercu visiteur de ${et.title}`"
            @click.stop="openPreview(et)"
          >
            <Eye :size="12" />
          </button>
          <button
            type="button"
            class="btn-icon btn-danger"
            title="Supprimer"
            aria-label="Supprimer le type"
            @click.stop="booking.deleteEventType(et.id)"
          >
            <Trash2 :size="12" />
          </button>
        </div>

        <div v-if="expandedTypeId === et.id" class="type-expand">
          <!-- Visio Jitsi Meet -->
          <div class="jitsi-link">
            <div class="public-link-head">
              <Video :size="13" aria-hidden="true" />
              <span class="field-label">Visio Jitsi Meet</span>
              <button
                type="button"
                class="toggle-active toggle-public"
                :class="{ active: et.use_jitsi }"
                :title="et.use_jitsi ? 'Jitsi actif — cliquer pour desactiver' : 'Activer la generation auto d\'un lien Jitsi par RDV'"
                :aria-label="et.use_jitsi ? 'Desactiver Jitsi' : 'Activer Jitsi'"
                :aria-pressed="!!et.use_jitsi"
                @click.stop="booking.toggleJitsi(et)"
              >
                <Check v-if="et.use_jitsi" :size="10" />
                <X v-else :size="10" />
              </button>
            </div>
            <p class="public-help">
              Si actif, Cursus genere un lien Jitsi Meet unique pour chaque reservation
              (libre, gratuit, sans inscription).
            </p>
          </div>

          <!-- Lien public ouvert -->
          <div class="public-link">
            <div class="public-link-head">
              <Globe :size="13" aria-hidden="true" />
              <span class="field-label">Lien public ouvert</span>
              <button
                type="button"
                class="toggle-active toggle-public"
                :class="{ active: et.is_public }"
                :title="et.is_public ? 'Lien public actif — cliquer pour desactiver' : 'Activer le lien public'"
                :aria-label="et.is_public ? 'Desactiver le lien public' : 'Activer le lien public'"
                :aria-pressed="!!et.is_public"
                @click.stop="booking.togglePublic(et)"
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
              <input
                class="input-field url-field"
                :value="booking.getPublicUrl(et)"
                readonly
                :aria-label="`Lien public de ${et.title}`"
                @click="($event.target as HTMLInputElement).select()"
              />
              <button type="button" class="btn-sm btn-primary" @click="copyPublicUrl(et)">
                <Copy v-if="publicCopiedId !== et.id" :size="12" />
                <Check v-else :size="12" />
                {{ publicCopiedId === et.id ? 'Copie' : 'Copier' }}
              </button>
              <QrCode :value="booking.getPublicUrl(et)" :size="80" />
            </div>
          </div>

          <!-- Lien nominatif -->
          <div class="link-gen">
            <label class="field-label" :for="`bk-link-student-${et.id}`">
              Generer un lien pour un etudiant
            </label>
            <div class="link-row">
              <select
                :id="`bk-link-student-${et.id}`"
                v-model="linkStudentId"
                class="input-field select-sm"
              >
                <option :value="null" disabled>— Choisir un etudiant —</option>
                <option v-for="s in allStudents" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
              <button
                type="button"
                class="btn-sm btn-primary"
                :disabled="!linkStudentId"
                @click="onGenerateLink(et.id)"
              >
                <Link :size="12" /> Generer
              </button>
            </div>
            <div v-if="generatedUrl && linkEventTypeId === et.id" class="link-result">
              <input class="input-field url-field" :value="generatedUrl" readonly />
              <button type="button" class="btn-sm btn-primary" @click="copyUrl">
                <Copy v-if="!copySuccess" :size="12" />
                <Check v-else :size="12" />
                {{ copySuccess ? 'Copie' : 'Copier' }}
              </button>
              <QrCode :value="generatedUrl" :size="80" />
            </div>

            <!-- Bulk -->
            <div class="bulk-gen">
              <label class="field-label" :for="`bk-bulk-promo-${et.id}`">
                Generer pour toute une promo
              </label>
              <div class="link-row">
                <select :id="`bk-bulk-promo-${et.id}`" v-model="bulkPromoId" class="input-field select-sm">
                  <option :value="null" disabled>— Promo —</option>
                </select>
                <button
                  type="button"
                  class="btn-sm btn-primary"
                  :disabled="!bulkPromoId"
                  @click="onBulkGenerate(et.id)"
                >
                  Generer tout
                </button>
              </div>
              <div v-if="bulkResults && linkEventTypeId === et.id" class="bulk-results">
                <div class="bulk-header">
                  <span class="field-label">{{ bulkResults.length }} liens</span>
                  <button type="button" class="btn-sm" @click="copyAllBulkLinks">Copier tout</button>
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
      <p v-if="filterQuery && !filteredTypes.length" class="filter-no-result">
        Aucun type ne correspond a "{{ filterQuery }}".
      </p>
    </div>

    <button
      v-if="!showCreateForm"
      type="button"
      class="btn-sm btn-cta add-type-btn"
      @click="showCreateForm = true"
    >
      <Plus :size="12" /> Nouveau type
    </button>

    <div v-else class="create-form">
      <div class="form-header">
        <span class="field-label">Nouveau type de rendez-vous</span>
        <button type="button" class="btn-icon" aria-label="Fermer le formulaire" @click="showCreateForm = false">
          <X :size="14" />
        </button>
      </div>
      <div class="form-grid">
        <div class="form-field">
          <label class="field-label" for="bk-new-title">Titre</label>
          <input id="bk-new-title" v-model="newType.title" class="input-field" placeholder="Ex. Suivi individuel" />
        </div>
        <div class="form-field">
          <label class="field-label" for="bk-new-slug">Slug</label>
          <input id="bk-new-slug" v-model="newType.slug" class="input-field" placeholder="suivi-individuel" />
        </div>
        <div class="form-field">
          <label class="field-label" for="bk-new-duration">Duree</label>
          <select id="bk-new-duration" v-model="newType.duration_minutes" class="input-field">
            <option v-for="d in DURATION_OPTIONS" :key="d.value" :value="d.value">{{ d.label }}</option>
          </select>
        </div>
        <div class="form-field">
          <label class="field-label" for="bk-new-buffer">Pause entre RDV</label>
          <select id="bk-new-buffer" v-model="newType.buffer_minutes" class="input-field">
            <option v-for="b in BUFFER_OPTIONS" :key="b.value" :value="b.value">{{ b.label }}</option>
          </select>
        </div>
        <div class="form-field">
          <label class="field-label">Couleur</label>
          <div class="color-presets" role="radiogroup" aria-label="Couleur du type">
            <button
              v-for="c in COLOR_PRESETS"
              :key="c"
              type="button"
              class="color-btn"
              :class="{ selected: newType.color === c }"
              :style="{ background: c }"
              :aria-label="`Couleur ${c}`"
              :aria-checked="newType.color === c"
              role="radio"
              @click="newType.color = c"
            />
          </div>
        </div>
        <div class="form-field full-width">
          <label class="field-label" for="bk-new-desc">Description (optionnel)</label>
          <textarea
            id="bk-new-desc"
            v-model="newType.description"
            class="input-field textarea-sm"
            rows="2"
            placeholder="Description du creneau..."
          />
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn-sm" @click="showCreateForm = false">Annuler</button>
        <button
          type="button"
          class="btn-sm btn-cta"
          :disabled="!newType.title.trim()"
          @click="onCreateEventType"
        >
          <Check :size="12" /> Creer
        </button>
      </div>
    </div>

    <BookingPreviewModal
      v-model="previewOpen"
      :info="previewInfo"
      :public-url="previewUrl"
    />
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
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--text-primary);
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
  margin-left: auto;
}

.filter-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}
.filter-icon {
  position: absolute;
  left: var(--space-xs);
  color: var(--text-muted);
  pointer-events: none;
}
.filter-input {
  flex: 1;
  padding-left: 26px;
  padding-right: 26px;
}
.filter-input::-webkit-search-cancel-button { display: none; }
.filter-clear {
  position: absolute;
  right: 2px;
  width: 22px;
  height: 22px;
}
.filter-no-result {
  margin: 0;
  padding: var(--space-md);
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}

/* v2.273.7 — alignement sur landing .rdv-type :
   border-left coloree par type, hover lift + shadow coloree, duration
   en pill monospace cyan. */
.type-list { display: flex; flex-direction: column; gap: 8px; max-height: 360px; overflow-y: auto; padding-right: 2px; }
.type-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-left: 3px solid var(--ic, var(--color-rex));
  border-radius: var(--radius);
  overflow: hidden;
  transition: transform var(--motion-fast) var(--ease-out),
              box-shadow var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out);
}
.type-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--ic, var(--color-rex)) 16%, transparent);
}
.type-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 10px var(--space-md);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out);
}
.type-row:hover { background: color-mix(in srgb, var(--ic, var(--color-rex)) 5%, transparent); }
.color-dot {
  width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ic, currentColor) 22%, transparent);
}
.type-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.1px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
}
.type-dur {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ic, var(--color-rex)) 14%, transparent);
  color: var(--ic, var(--color-rex));
  flex-shrink: 0;
}
.toggle-active {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--border-input);
  background: var(--bg-input);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: all var(--motion-fast) var(--ease-out);
}
.toggle-active.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.toggle-active:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.type-expand { padding: var(--space-sm) var(--space-md); border-top: 1px solid var(--border); background: var(--bg-main); }
.link-gen { display: flex; flex-direction: column; gap: var(--space-xs); }
.link-row { display: flex; gap: var(--space-xs); align-items: center; }
.select-sm { flex: 1; min-width: 0; }
.link-result { display: flex; gap: var(--space-xs); align-items: center; margin-top: 4px; }
.url-field { flex: 1; min-width: 0; font-size: 11px; }

.public-link, .jitsi-link {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  margin: calc(-1 * var(--space-sm)) calc(-1 * var(--space-md)) var(--space-sm);
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-elevated));
  border-bottom: 1px solid var(--border);
}
.jitsi-link { background: color-mix(in srgb, var(--color-success) 6%, var(--bg-elevated)); }
.public-link-head { display: flex; align-items: center; gap: var(--space-xs); }
.public-help { font-size: 11px; color: var(--text-muted); margin: 0; line-height: 1.4; }
.toggle-public { margin-left: auto; }

.bulk-gen {
  margin-top: var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  border-top: 1px dashed var(--border);
  padding-top: var(--space-sm);
}
.bulk-results { display: flex; flex-direction: column; gap: 3px; max-height: 150px; overflow-y: auto; }
.bulk-header { display: flex; align-items: center; justify-content: space-between; }
.bulk-row { display: flex; align-items: center; gap: var(--space-xs); }
.bulk-name { font-size: 11px; font-weight: 600; min-width: 80px; color: var(--text-secondary); }

.add-type-btn { align-self: flex-start; }

.create-form {
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-sm);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
.form-header { display: flex; align-items: center; justify-content: space-between; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm); }
.form-field { display: flex; flex-direction: column; gap: 3px; }
.form-field.full-width { grid-column: 1 / -1; }
.field-label { font-size: 11px; font-weight: 600; color: var(--text-secondary); }

.color-presets { display: flex; gap: 4px; flex-wrap: wrap; }
.color-btn {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-xs);
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color var(--motion-fast) var(--ease-out);
}
.color-btn.selected { border-color: var(--text-primary); }
.color-btn:hover { border-color: var(--text-secondary); }
.color-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.textarea-sm { resize: vertical; min-height: 36px; }
.form-actions { display: flex; justify-content: flex-end; gap: var(--space-xs); }

/* Inputs / boutons partages locaux (basiques, pas dans components.css). */
.input-field {
  background: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  font-family: var(--font);
  font-size: 12px;
  color: var(--text-primary);
  padding: 5px 8px;
  outline: none;
  transition: border-color var(--motion-fast) var(--ease-out);
}
.input-field:focus { border-color: var(--accent); }

.btn-sm {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-out);
}
.btn-sm:hover:not(:disabled) { background: var(--bg-hover); }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn-primary:hover:not(:disabled) { filter: brightness(1.06); }
.btn-cta { background: var(--cta); color: #fff; border-color: var(--cta); }
.btn-cta:hover:not(:disabled) { background: var(--cta-hover); }
.btn-danger { color: var(--color-danger); }

.btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: var(--radius-xs);
  color: var(--text-muted);
  flex-shrink: 0;
  transition: all var(--motion-fast) var(--ease-out);
}
.btn-icon:hover { background: var(--bg-hover); color: var(--text-primary); }
.btn-icon.btn-danger:hover { color: var(--color-danger); }
.btn-icon.btn-preview:hover { color: var(--accent); }
.btn-icon:focus-visible { outline: none; box-shadow: var(--focus-ring); }
</style>
