<script setup lang="ts">
  import { computed } from 'vue'
  import { Clock, ExternalLink, Calendar } from 'lucide-vue-next'
  import { deadlineClass, deadlineLabel, formatDate } from '@/utils/date'
  import ProgressBar from '@/components/ui/ProgressBar.vue'
  import { typeLabel, isEventType } from '@/utils/devoir'
  import type { Devoir } from '@/types'

  interface Props {
    travail: Devoir
    depotsCounts: { submitted: number; noted: number; pending: number; total: number }
    editingTitle: boolean
    titleDraft: string
    editingDeadline: boolean
    deadlineDraft: string
  }

  const props = defineProps<Props>()
  const emit = defineEmits<{
    'start-edit-title': []
    'save-title': []
    'update:titleDraft': [v: string]
    'update:editingTitle': [v: boolean]
    'start-edit-deadline': []
    'save-deadline': []
    'update:deadlineDraft': [v: string]
    'update:editingDeadline': [v: boolean]
    'toggle-requires-submission': []
    'go-to-channel': []
  }>()

  const submitPct = computed(() =>
    props.depotsCounts.total
      ? Math.round((props.depotsCounts.submitted / props.depotsCounts.total) * 100)
      : 0,
  )

  const devoirStatus = computed(() => {
    const t = props.travail
    if (t.scheduled_publish_at) return { label: 'Programme', cls: 'status-scheduled' }
    if (!t.is_published) return { label: 'Brouillon', cls: 'status-draft' }
    // "Complet" (tous les depots recus) ne s'applique pas aux evaluations en salle
    if (!isEventType(t.type) && props.depotsCounts.total > 0 && props.depotsCounts.submitted >= props.depotsCounts.total)
      return { label: 'Complet', cls: 'status-complete' }
    if (new Date(t.deadline).getTime() < Date.now()) return { label: 'Expire', cls: 'status-expired' }
    return { label: 'Publie', cls: 'status-published' }
  })

  const requiresSubmission = computed(() => props.travail.requires_submission !== 0)
  const isEvent = computed(() => isEventType(props.travail.type))
  const submissionToggleLabel = computed(() => {
    if (!isEvent.value) return 'Requiert un depot'
    if (props.travail.type === 'soutenance') return 'Autoriser le depot des slides'
    return 'Autoriser le depot de fichiers'
  })
</script>

<template>
  <!-- Status banner -->
  <div class="gd-status" :class="devoirStatus.cls">
    {{ devoirStatus.label }}
  </div>

  <div class="gd-meta">
    <!-- Row 1: badges + deadline + progress -->
    <div class="gd-meta-row">
      <span class="travail-type-badge" :class="`type-${travail.type}`">{{ typeLabel(travail.type) }}</span>
      <span v-if="travail.category" class="tag-badge">{{ travail.category }}</span>
      <span class="deadline-badge" :class="deadlineClass(travail.deadline)">
        <Clock :size="10" /> {{ deadlineLabel(travail.deadline) }}
      </span>
      <span v-if="depotsCounts.total" class="gd-meta-pct">{{ submitPct }}%</span>
    </div>

    <!-- Progress bar (compact) : masquee pour les evenements (pas de depot attendu) -->
    <div v-if="depotsCounts.total && !isEvent" class="gd-meta-progress">
      <ProgressBar :value="submitPct" />
      <span class="gd-meta-progress-label">
        {{ depotsCounts.submitted }}/{{ depotsCounts.total }} rendus
        <template v-if="depotsCounts.noted"> &middot; {{ depotsCounts.noted }} note{{ depotsCounts.noted > 1 ? 's' : '' }}</template>
      </span>
    </div>

    <!-- Title (editable) -->
    <div class="gd-title-row">
      <template v-if="!editingTitle">
        <h3 class="gd-title" title="Cliquer pour modifier" @click="emit('start-edit-title')">
          {{ travail.title }}
        </h3>
      </template>
      <template v-else>
        <input
          autofocus
          :value="titleDraft"
          class="gd-title-input"
          @input="emit('update:titleDraft', ($event.target as HTMLInputElement).value)"
          @keydown.enter="emit('save-title')"
          @keydown.escape="emit('update:editingTitle', false)"
        />
        <button class="gestion-btn-sm gestion-btn-accent" @click="emit('save-title')">OK</button>
      </template>
    </div>

    <!-- Ligne principale : deadline editable + canal (les 2 infos les plus accedees) -->
    <div class="gd-info-main">
      <div class="gd-info-field">
        <Calendar :size="12" class="gd-info-icon" />
        <template v-if="!editingDeadline">
          <span class="gd-field-editable" title="Cliquer pour modifier" @click="emit('start-edit-deadline')">
            {{ formatDate(travail.deadline) }}
          </span>
        </template>
        <template v-else>
          <input
            autofocus
            :value="deadlineDraft"
            type="datetime-local"
            class="gd-inline-input"
            @input="emit('update:deadlineDraft', ($event.target as HTMLInputElement).value)"
            @keydown.enter="emit('save-deadline')"
            @keydown.escape="emit('update:editingDeadline', false)"
          />
          <button class="gestion-btn-sm gestion-btn-accent" @click="emit('save-deadline')">OK</button>
        </template>
      </div>

      <div v-if="travail.channel_name" class="gd-info-field">
        <button class="gd-link-btn" @click="emit('go-to-channel')">
          # {{ travail.channel_name }} <ExternalLink :size="10" />
        </button>
      </div>

      <!-- Badge programme (visible uniquement si applicable) : haute importance,
           reste au premier niveau pour ne pas surprendre le prof -->
      <div v-if="travail.scheduled_publish_at" class="gd-info-field gd-field-scheduled" :title="`Sera publie le ${formatDate(travail.scheduled_publish_at)}`">
        <Clock :size="12" class="gd-info-icon" />
        <span>Publication le {{ formatDate(travail.scheduled_publish_at) }}</span>
      </div>
    </div>

    <!-- Accordion : infos secondaires + toggle de depot. Referme par defaut pour
         garder la modale compacte ; le prof l'ouvre si besoin. -->
    <details class="gd-meta-details">
      <summary class="gd-meta-details-summary">
        Détails
        <span class="gd-meta-details-summary-hint">
          {{ travail.assigned_to === 'group' ? `Groupe ${travail.group_name ?? ''}` : 'Toute la promo' }}
          · {{ requiresSubmission ? 'dépôt ouvert' : 'pas de dépôt' }}
        </span>
      </summary>
      <div class="gd-meta-details-body">
        <div class="gd-info-row">
          <span class="gd-info-label">Destinataires</span>
          <span class="gd-info-value">{{ travail.assigned_to === 'group' ? `Groupe ${travail.group_name ?? ''}` : 'Toute la promo' }}</span>
        </div>

        <!-- Toggle requires_submission : pour les evenements (CCTL / soutenance /
             etude de cas), ouvre/ferme un creneau de depot optionnel (ex : slides). -->
        <label class="gd-toggle-row" @click.prevent="emit('toggle-requires-submission')">
          <span class="gd-toggle-track" :class="{ active: requiresSubmission }">
            <span class="gd-toggle-thumb" />
          </span>
          <span class="gd-toggle-label">{{ submissionToggleLabel }}</span>
        </label>
      </div>
    </details>
  </div>
</template>

<style scoped>
/* Status */
.gd-status {
  text-align: center; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .5px; padding: 4px 0;
}
.status-draft     { background: var(--bg-hover); color: var(--text-muted); border-bottom: 1px dashed var(--border); }
.status-published { background: rgba(34,197,94,.08); color: #22c55e; }
.status-expired   { background: rgba(239,68,68,.08); color: #f87171; }
.status-complete  { background: rgba(59,130,246,.08); color: #60a5fa; }
.status-scheduled { background: rgba(245,158,11,.08); color: #f59e0b; }

/* Meta container */
.gd-meta { padding: 14px 20px 10px; }

.gd-meta-row {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;
}
.gd-meta-pct {
  font-size: 12px; font-weight: 800; color: var(--accent);
  margin-left: auto;
}

/* Progress compact */
.gd-meta-progress { margin-bottom: 10px; }
.gd-meta-progress-label {
  font-size: 11px; color: var(--text-muted); margin-top: 3px; display: block;
}

/* Title */
.gd-title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.gd-title {
  font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0;
  cursor: pointer; border-bottom: 1px dashed transparent;
  transition: border-color var(--t-fast);
}
.gd-title:hover { border-color: var(--border-input); }
.gd-title-input {
  flex: 1; font-size: 16px; font-weight: 700; padding: 4px 8px;
  background: var(--bg-input); border: 1px solid var(--accent); border-radius: 6px;
  color: var(--text-primary); font-family: var(--font);
}

/* Ligne principale : ce que le prof regarde 90% du temps. */
.gd-info-main {
  display: flex; gap: 14px; flex-wrap: wrap; align-items: center;
  font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;
}
.gd-info-field { display: inline-flex; align-items: center; gap: 4px; }
.gd-field-scheduled { color: #f59e0b; font-weight: 600; font-size: 11px; }
.gd-info-icon { color: var(--text-muted); flex-shrink: 0; }
.gd-info-label { color: var(--text-muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; min-width: 92px; }
.gd-info-value { font-size: 12px; color: var(--text-secondary); }

/* Accordion infos secondaires : details natif pour l'a11y (chevron visuel) */
.gd-meta-details {
  margin-top: 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-elevated);
}
.gd-meta-details-summary {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px;
  font-size: 11px; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: .4px;
  cursor: pointer; user-select: none; list-style: none;
  transition: background var(--t-fast);
}
.gd-meta-details-summary:hover { background: var(--bg-hover); }
.gd-meta-details-summary::-webkit-details-marker { display: none; }
.gd-meta-details-summary::before {
  content: '\25B6'; font-size: 8px; color: var(--text-muted);
  transition: transform var(--motion-fast) var(--ease-out);
}
.gd-meta-details[open] > .gd-meta-details-summary::before { transform: rotate(90deg); }
.gd-meta-details-summary-hint {
  font-size: 10.5px; font-weight: 500; color: var(--text-muted);
  text-transform: none; letter-spacing: 0;
  margin-left: auto;
}
.gd-meta-details-body {
  padding: 8px 12px 10px;
  border-top: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 8px;
}
.gd-info-row {
  display: flex; align-items: center; gap: 10px;
  font-size: 12px;
}

/* Toggle */
.gd-toggle-row {
  display: inline-flex; align-items: center; gap: 8px; cursor: pointer;
  padding: 4px 0; user-select: none;
}
.gd-toggle-track {
  width: 32px; height: 18px; border-radius: 9px;
  background: var(--bg-hover); border: 1px solid var(--border-input);
  position: relative; transition: background var(--t-fast);
}
.gd-toggle-track.active {
  background: var(--accent); border-color: var(--accent);
}
.gd-toggle-thumb {
  position: absolute; top: 2px; left: 2px;
  width: 12px; height: 12px; border-radius: 50%;
  background: white; transition: transform var(--t-fast);
  box-shadow: 0 1px 2px rgba(0,0,0,.15);
}
.gd-toggle-track.active .gd-toggle-thumb { transform: translateX(14px); }
.gd-toggle-label { font-size: 12px; color: var(--text-secondary); }

/* Shared badges (from parent) */
.travail-type-badge {
  font-size: 10px; font-weight: 800; text-transform: uppercase;
  letter-spacing: .4px; padding: 3px 9px; border-radius: 20px;
}
.type-livrable      { background: rgba(74,144,217,.2);  color: var(--accent); }
.type-soutenance    { background: rgba(232,137,26,.2);  color: var(--color-warning); }
.type-cctl          { background: rgba(142,68,173,.2);  color: #a569bd; }
.type-etude_de_cas  { background: rgba(39,174,96,.2);   color: var(--color-success); }
.type-memoire       { background: rgba(231,76,60,.2);   color: var(--color-danger); }
.type-autre         { background: rgba(127,140,141,.2); color: var(--color-autre); }
.tag-badge {
  font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 12px;
  background: var(--bg-hover); color: var(--text-secondary);
}
.gd-field-editable { cursor: pointer; border-bottom: 1px dashed var(--border-input); }
.gd-field-editable:hover { border-color: var(--accent); }
.gd-inline-input {
  font-size: 12px; padding: 3px 6px; background: var(--bg-input);
  border: 1px solid var(--accent); border-radius: 4px; color: var(--text-primary);
  font-family: var(--font);
}
.gd-link-btn {
  font-size: 12px; color: var(--accent); background: none; border: none;
  cursor: pointer; display: inline-flex; align-items: center; gap: 3px;
  font-family: var(--font);
}
.gd-link-btn:hover { text-decoration: underline; }
</style>
