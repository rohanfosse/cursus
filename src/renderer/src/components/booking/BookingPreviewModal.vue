<script setup lang="ts">
/**
 * BookingPreviewModal.vue — apercu "comme un etudiant" du flow de booking.
 *
 * Monte le composant `BookingFlow` reel avec :
 *   - les vraies donnees du type/campagne (titre, description, duree, host, couleur)
 *   - des creneaux fictifs (jours ouvres a venir, heures rondes) pour que le
 *     calendrier ne soit pas vide meme si aucune disponibilite n'est definie
 *   - un bandeau "Mode apercu" non-interactif qui rappelle au prof que
 *     reserver depuis ici n'enverra rien
 *
 * Permet aussi d'ouvrir l'URL publique reelle dans le navigateur (Electron
 * `openExternal` si dispo, sinon nouvel onglet) pour voir le rendu sur la
 * vraie page hors-app.
 */
import { computed, ref, watch } from 'vue'
import { Eye, ExternalLink } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import UiPill from '@/components/ui/UiPill.vue'
import BookingFlow from '@/components/booking/BookingFlow.vue'
import { makePreviewSlots } from '@/utils/bookingPreviewSlots'
import type {
  BookingFlowInfo, BookingFlowSlot, BookingFlowResult, BookingFlowSubmitPayload,
} from '@/components/booking/bookingFlow.types'

const props = defineProps<{
  modelValue: boolean
  /** Donnees du type / campagne a previsualiser. */
  info: BookingFlowInfo | null
  /** URL publique reelle a ouvrir dans le navigateur (optionnel). */
  publicUrl?: string | null
}>()

const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

// Etat local du flow simule. Les changements ici sont uniquement visuels —
// rien n'est envoye au backend en mode apercu.
const selectedSlot = ref<BookingFlowSlot | null>(null)
const step = ref<'calendar' | 'details' | 'confirmation'>('calendar')
const previewResult = ref<BookingFlowResult | null>(null)

const slots = computed<BookingFlowSlot[]>(() => {
  if (!props.info) return []
  return makePreviewSlots({ durationMinutes: props.info.durationMinutes })
})

// Reset le flow a chaque ouverture pour repartir sur calendar.
watch(() => props.modelValue, (open) => {
  if (open) {
    selectedSlot.value = null
    step.value = 'calendar'
    previewResult.value = null
  }
})

function onSelectSlot(slot: BookingFlowSlot) {
  selectedSlot.value = slot
  step.value = 'details'
}

function onBackToCalendar() {
  selectedSlot.value = null
  step.value = 'calendar'
}

/**
 * Simule la confirmation cote etudiant. Au lieu d'appeler le backend, on
 * fabrique un resultat fictif avec le slot choisi pour montrer la step
 * de confirmation telle qu'elle apparaitra reellement.
 */
function onSubmit(_payload: BookingFlowSubmitPayload) {
  if (!selectedSlot.value) return
  previewResult.value = {
    startDatetime: selectedSlot.value.start,
    endDatetime: selectedSlot.value.end,
    joinUrl: 'https://meet.jit.si/exemple-preview',
    cancelToken: 'preview-cancel-token',
  }
  step.value = 'confirmation'
}

function openInBrowser() {
  if (!props.publicUrl) return
  const electronApi = (window as { api?: { openExternal?: (url: string) => void } }).api
  if (electronApi?.openExternal) electronApi.openExternal(props.publicUrl)
  else window.open(props.publicUrl, '_blank', 'noopener')
}

function close() { emit('update:modelValue', false) }
</script>

<template>
  <Modal
    :model-value="modelValue"
    :max-width="'960px'"
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <div class="bpm">
      <header class="bpm-header">
        <div class="bpm-header-left">
          <Eye :size="14" aria-hidden="true" />
          <h3 class="bpm-title">
            Apercu visiteur
            <span v-if="info" class="bpm-title-sep" aria-hidden="true">·</span>
            <span v-if="info" class="bpm-title-sub">{{ info.title }}</span>
          </h3>
          <UiPill tone="warning" size="xs">Mode apercu</UiPill>
        </div>
        <div class="bpm-header-right">
          <button
            v-if="publicUrl"
            type="button"
            class="bpm-link-btn"
            :title="`Ouvrir le lien public dans le navigateur : ${publicUrl}`"
            @click="openInBrowser"
          >
            <ExternalLink :size="13" aria-hidden="true" />
            Ouvrir le vrai lien
          </button>
        </div>
      </header>

      <p class="bpm-warn">
        Cet apercu utilise des creneaux fictifs (jours ouvres a venir, 9h–15h).
        Les inscriptions reelles passent par le lien public — aucune action
        ici n'envoie de mail ni n'enregistre de RDV.
      </p>

      <div class="bpm-stage">
        <BookingFlow
          :info="info"
          :slots="slots"
          :selected-slot="selectedSlot"
          :step="step"
          :loading="false"
          :error="''"
          :error-code="''"
          :result="previewResult"
          :ics-url="null"
          :captcha-site-key="''"
          :attendee-identified="!!info?.attendeeName"
          :submitting="false"
          @select-slot="onSelectSlot"
          @back-to-calendar="onBackToCalendar"
          @submit-details="onSubmit"
        />
      </div>

      <footer class="bpm-footer">
        <button type="button" class="bpm-close-btn" @click="close">Fermer l'apercu</button>
      </footer>
    </div>
  </Modal>
</template>

<style scoped>
.bpm {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

.bpm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.bpm-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}
.bpm-header-right { display: flex; align-items: center; gap: var(--space-sm); flex-shrink: 0; }

.bpm-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}
.bpm-title-sep { color: var(--text-muted); font-weight: 400; }
.bpm-title-sub {
  font-weight: 500;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}

.bpm-link-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 4px var(--space-sm);
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--motion-fast) var(--ease-out);
}
.bpm-link-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--accent);
}
.bpm-link-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.bpm-warn {
  margin: 0;
  padding: var(--space-sm) var(--space-lg);
  font-size: 11px;
  color: var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 8%, transparent);
  border-bottom: 1px solid var(--border);
  line-height: 1.5;
}

.bpm-stage {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
  background: var(--bg-main);
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

/* Le shell du BookingFlow a son propre fond clair par defaut — on le neutralise
   pour matcher l'environnement modal (et eviter un effet "page dans page"
   trop disgracieux). */
.bpm-stage :deep(.bf) {
  box-shadow: var(--elevation-1);
  width: 100%;
  max-width: 880px;
}

.bpm-footer {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-md) var(--space-lg);
  border-top: 1px solid var(--border);
  background: var(--bg-modal);
}
.bpm-close-btn {
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out);
}
.bpm-close-btn:hover { background: var(--bg-hover); }
.bpm-close-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }

@media (max-width: 640px) {
  .bpm-warn { font-size: 10px; padding: var(--space-xs) var(--space-md); }
  .bpm-stage { padding: var(--space-sm); }
}
</style>
