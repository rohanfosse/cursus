<script setup lang="ts">
/**
 * CreateDateModal - picker pour la commande slash /date.
 *
 * Avant : /date inserait aveuglement la date du jour au format long.
 * Maintenant : l'utilisateur choisit
 *  - une date (via input date HTML5 natif + chips rapides "Aujourd'hui",
 *    "Demain", "+7 jours", "+1 mois") ;
 *  - une heure optionnelle ;
 *  - un format de sortie parmi 4 preset (court / moyen / long / ISO).
 *
 * Aperçu live du texte insere + chips de chronologie relative ("dans 3 j",
 * "passe") pour que l'utilisateur voie ce qu'il partage.
 */
import { ref, computed, watch, nextTick } from 'vue'
import { X, Calendar, Clock, Send } from 'lucide-vue-next'

interface Props {
  modelValue: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  'submit': [payload: { markdown: string }]
  'submit-send': [payload: { markdown: string }]
}>()

// ── Helpers de date ───────────────────────────────────────────────────────
function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function toIsoTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}
function addMonths(d: Date, n: number): Date {
  const c = new Date(d)
  c.setMonth(c.getMonth() + n)
  return c
}

// ── Etat ──────────────────────────────────────────────────────────────────
const now = new Date()
const dateValue = ref<string>(toIsoDate(now))
const timeValue = ref<string>('')            // '' = pas d'heure

// Formats reduits en v2 : Court et Moyen couvrent 95% des cas. Long etait
// trop verbeux ("lundi 30 juin 2026 a 14h") et casse les phrases. ISO
// ("2026-06-30T14:00") etait un format dev rarement utile dans un chat.
type DateFormat = 'short' | 'medium'
const selectedFormat = ref<DateFormat>('medium')

const dateInputEl = ref<HTMLInputElement | null>(null)

watch(() => props.modelValue, (open) => {
  if (!open) return
  // Reset aux valeurs par defaut a chaque reouverture
  const n = new Date()
  dateValue.value = toIsoDate(n)
  timeValue.value = ''
  selectedFormat.value = 'medium'
  nextTick(() => dateInputEl.value?.focus())
})

// ── Chips raccourcis ──────────────────────────────────────────────────────
// Passe de 4 a 6 chips en retirant "Long" / "ISO" (gain de place). Ajout de
// "Vendredi" (prochain vendredi, typique pour un rendu de semaine) et
// "Lundi prochain" (semaine suivante).
interface QuickChip { id: string; label: string; apply: () => void }
function nextWeekday(from: Date, targetDow: number): Date {
  // targetDow : 0=dim, 1=lun, ..., 5=ven
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const diff = (targetDow - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + diff)
  return d
}
const QUICK_CHIPS = computed<QuickChip[]>(() => {
  const n = new Date()
  return [
    { id: 'today',    label: "Aujourd'hui", apply: () => { dateValue.value = toIsoDate(n) } },
    { id: 'tomorrow', label: 'Demain',      apply: () => { dateValue.value = toIsoDate(addDays(n, 1)) } },
    { id: 'friday',   label: 'Vendredi',    apply: () => { dateValue.value = toIsoDate(nextWeekday(n, 5)) } },
    { id: 'week',     label: 'Dans 7 jours', apply: () => { dateValue.value = toIsoDate(addDays(n, 7)) } },
    { id: 'month',    label: 'Dans 1 mois', apply: () => { dateValue.value = toIsoDate(addMonths(n, 1)) } },
  ]
})

function applyChip(chip: QuickChip) { chip.apply() }

/** Matche le chip actif en fonction de la date actuelle (ecart en jours). */
const activeChipId = computed<string | null>(() => {
  const selected = selectedDate.value
  if (!selected) return null
  const n = new Date()
  n.setHours(0, 0, 0, 0)
  const selNoTime = new Date(selected); selNoTime.setHours(0, 0, 0, 0)
  const diffDays = Math.round((selNoTime.getTime() - n.getTime()) / 86400000)
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays === 7) return 'week'
  // Vendredi prochain (dans 1-7 jours)
  const friday = nextWeekday(n, 5)
  friday.setHours(0, 0, 0, 0)
  if (selNoTime.getTime() === friday.getTime()) return 'friday'
  // "1 mois" : compare aux mois directement (evite decalage Feb 28/29)
  const plus1m = addMonths(n, 1)
  plus1m.setHours(0, 0, 0, 0)
  if (selNoTime.getTime() === plus1m.getTime()) return 'month'
  return null
})

// ── Computed : date selectionnee complete (Date object) ──────────────────
const selectedDate = computed<Date | null>(() => {
  if (!dateValue.value) return null
  // dateValue = "YYYY-MM-DD", timeValue = "HH:MM" ou ""
  const [y, m, d] = dateValue.value.split('-').map(Number)
  if (!y || !m || !d) return null
  const date = new Date(y, m - 1, d)
  if (timeValue.value) {
    const [h, mn] = timeValue.value.split(':').map(Number)
    if (Number.isFinite(h)) date.setHours(h, mn || 0, 0, 0)
  }
  return date
})

// ── Formats de sortie ─────────────────────────────────────────────────────
interface FormatDef { id: DateFormat; label: string; sample: string }
const FORMATS = computed<FormatDef[]>(() => {
  const d = selectedDate.value ?? new Date()
  return [
    { id: 'short',  label: 'Court',  sample: renderDate(d, 'short') },
    { id: 'medium', label: 'Moyen',  sample: renderDate(d, 'medium') },
  ]
})

function renderDate(d: Date, fmt: DateFormat): string {
  const hasTime = !!timeValue.value
  const dayOpts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: '2-digit' }
  const medOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
  switch (fmt) {
    case 'short':  {
      const s = d.toLocaleDateString('fr-FR', dayOpts)
      return hasTime ? `${s} ${timeValue.value}` : s
    }
    case 'medium': {
      const s = d.toLocaleDateString('fr-FR', medOpts)
      return hasTime ? `${s} à ${timeValue.value}` : s
    }
  }
}

const outputText = computed(() => selectedDate.value ? renderDate(selectedDate.value, selectedFormat.value) : '')

// ── Chronologie relative pour feedback ────────────────────────────────────
const relativeLabel = computed(() => {
  const sel = selectedDate.value
  if (!sel) return null
  const n = new Date()
  n.setHours(0, 0, 0, 0)
  const selNoTime = new Date(sel); selNoTime.setHours(0, 0, 0, 0)
  const diff = Math.round((selNoTime.getTime() - n.getTime()) / 86400000)
  if (diff === 0) return { text: "Aujourd'hui", kind: 'today' as const }
  if (diff === 1) return { text: 'Demain', kind: 'future' as const }
  if (diff === -1) return { text: 'Hier', kind: 'past' as const }
  if (diff > 1 && diff < 7) return { text: `Dans ${diff} jours`, kind: 'future' as const }
  if (diff >= 7 && diff < 30) return { text: `Dans ${Math.round(diff / 7)} semaine${Math.round(diff / 7) > 1 ? 's' : ''}`, kind: 'future' as const }
  if (diff >= 30 && diff < 365) return { text: `Dans ${Math.round(diff / 30)} mois`, kind: 'future' as const }
  if (diff >= 365) return { text: `Dans ${Math.round(diff / 365)} an${Math.round(diff / 365) > 1 ? 's' : ''}`, kind: 'future' as const }
  return { text: 'Passé', kind: 'past' as const }
})

// ── Validation / envoi ────────────────────────────────────────────────────
const canSubmit = computed(() => !!selectedDate.value)

function close() { emit('update:modelValue', false) }

function submit() {
  if (!canSubmit.value) return
  // Le markdown inseré est juste le texte formate (pas de bloc dedie).
  // Insertion au curseur -> s'integre dans une phrase naturellement.
  emit('submit', { markdown: outputText.value })
  close()
}
function submitAndSend() {
  if (!canSubmit.value) return
  emit('submit-send', { markdown: outputText.value })
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && canSubmit.value) {
    e.preventDefault()
    // Enter seul = inserer dans le textarea (la date est souvent au milieu
    // d'une phrase, on ne veut pas envoyer tout seul). Ctrl+Enter = envoyer.
    if (e.ctrlKey || e.metaKey) submitAndSend()
    else submit()
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="cdt-modal" role="dialog" aria-modal="true" aria-label="Insérer une date" @keydown="onKeydown">
          <!-- Header -->
          <div class="cdt-header">
            <Calendar :size="18" class="cdt-header-icon" />
            <div class="cdt-header-text">
              <h2 class="cdt-title">Insérer une date</h2>
              <p class="cdt-sub">
                <template v-if="relativeLabel">
                  <span class="cdt-sub-relative" :class="`cdt-sub-relative--${relativeLabel.kind}`">{{ relativeLabel.text }}</span>
                </template>
                <template v-else>Choisissez une date et son format</template>
              </p>
            </div>
            <button class="btn-icon cdt-close" aria-label="Fermer" @click="close">
              <X :size="16" />
            </button>
          </div>

          <!-- Body -->
          <div class="cdt-body">
            <!-- Chips rapides -->
            <div class="cdt-field">
              <label class="cdt-label">Raccourcis</label>
              <div class="cdt-chips">
                <button
                  v-for="chip in QUICK_CHIPS"
                  :key="chip.id"
                  type="button"
                  class="cdt-chip"
                  :class="{ 'is-active': activeChipId === chip.id }"
                  @click="applyChip(chip)"
                >{{ chip.label }}</button>
              </div>
            </div>

            <!-- Date + heure -->
            <div class="cdt-field cdt-field--row">
              <div class="cdt-input-group">
                <label class="cdt-label" for="cdt-date"><Calendar :size="12" /> Date</label>
                <input
                  id="cdt-date"
                  ref="dateInputEl"
                  v-model="dateValue"
                  type="date"
                  class="cdt-input"
                  :aria-label="'Choisir une date'"
                />
              </div>
              <div class="cdt-input-group">
                <label class="cdt-label" for="cdt-time"><Clock :size="12" /> Heure <span class="cdt-label-hint">(optionnel)</span></label>
                <input
                  id="cdt-time"
                  v-model="timeValue"
                  type="time"
                  class="cdt-input"
                  :aria-label="'Choisir une heure'"
                />
              </div>
            </div>

            <!-- Format de sortie -->
            <div class="cdt-field">
              <label class="cdt-label">Format</label>
              <div class="cdt-formats" role="radiogroup" aria-label="Format de sortie">
                <button
                  v-for="f in FORMATS"
                  :key="f.id"
                  type="button"
                  role="radio"
                  class="cdt-format"
                  :class="{ 'is-active': selectedFormat === f.id }"
                  :aria-checked="selectedFormat === f.id"
                  @click="selectedFormat = f.id"
                >
                  <span class="cdt-format-label">{{ f.label }}</span>
                  <span class="cdt-format-sample">{{ f.sample }}</span>
                </button>
              </div>
            </div>

            <!-- Preview de l'insertion -->
            <div class="cdt-field">
              <label class="cdt-label">Aperçu de l'insertion</label>
              <div class="cdt-preview">
                <span v-if="outputText" class="cdt-preview-text">{{ outputText }}</span>
                <span v-else class="cdt-preview-empty">Choisissez une date…</span>
              </div>
            </div>
          </div>

          <!-- Footer : cas typique = inserer dans une phrase,
               donc "Inserer" reste primaire mais on ajoute "Envoyer" secondaire. -->
          <div class="cdt-footer">
            <button class="btn-ghost" @click="close">Annuler</button>
            <button
              type="button"
              class="cdt-btn-secondary"
              :disabled="!canSubmit"
              title="Envoyer immédiatement ce texte comme message"
              @click="submitAndSend"
            >
              Envoyer
            </button>
            <button
              type="button"
              class="cdt-btn-primary"
              :disabled="!canSubmit"
              title="Insérer dans le message en cours"
              @click="submit"
            >
              <Send :size="14" /> Insérer dans le message
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Overlay ─────────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, .45);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 20px;
}
.modal-fade-enter-active,
.modal-fade-leave-active { transition: opacity var(--motion-fast) var(--ease-out); }
.modal-fade-enter-from,
.modal-fade-leave-to { opacity: 0; }

/* ── Modal ───────────────────────────────────────────────────────────── */
.cdt-modal {
  width: 100%;
  max-width: 480px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--elevation-4);
  overflow: hidden;
}

/* ── Header ──────────────────────────────────────────────────────────── */
.cdt-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}
.cdt-header-icon {
  color: var(--color-info);
  padding: 6px;
  width: 30px; height: 30px;
  border-radius: var(--radius-sm);
  background: rgba(var(--color-info-rgb), .12);
  flex-shrink: 0;
  box-sizing: content-box;
}
.cdt-header-text { flex: 1; min-width: 0; }
.cdt-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; }
.cdt-sub { font-size: 11.5px; color: var(--text-muted); margin: 2px 0 0; }
.cdt-sub-relative {
  display: inline-block;
  padding: 1px 8px;
  border-radius: var(--radius);
  font-weight: 700;
  font-size: 10.5px;
  letter-spacing: .2px;
}
.cdt-sub-relative--today   { background: rgba(var(--color-info-rgb), .15);    color: var(--color-info); }
.cdt-sub-relative--future  { background: rgba(var(--color-success-rgb), .15); color: var(--color-success); }
.cdt-sub-relative--past    { background: rgba(var(--color-warning-rgb), .15); color: var(--color-warning); }
.cdt-close {
  width: 28px; height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background var(--t-fast), color var(--t-fast);
}
.cdt-close:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ── Body ────────────────────────────────────────────────────────────── */
.cdt-body {
  padding: 14px 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}
.cdt-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cdt-field--row {
  flex-direction: row;
  gap: 10px;
}
.cdt-input-group {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cdt-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .5px;
}
.cdt-label-hint {
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  font-style: italic;
  color: var(--text-muted);
  margin-left: 2px;
}

/* ── Chips rapides ──────────────────────────────────────────────────── */
.cdt-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.cdt-chip {
  padding: 6px 12px;
  font-family: var(--font);
  font-size: 12px;
  font-weight: 600;
  border-radius: var(--radius-lg);
  background: var(--bg-main);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.cdt-chip:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-input);
}
.cdt-chip.is-active {
  background: var(--color-info);
  color: #fff;
  border-color: var(--color-info);
}

/* ── Inputs date/time ────────────────────────────────────────────────── */
.cdt-input {
  width: 100%;
  padding: 9px 12px;
  font-family: var(--font);
  font-size: 13px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  transition: border-color var(--t-fast), box-shadow var(--t-fast);
  /* Icone calendrier native en dark */
  color-scheme: dark;
}
.cdt-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .12);
}

/* ── Formats de sortie : 2 boutons cote a cote avec preview ──────────── */
.cdt-formats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.cdt-format {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 12px;
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font);
  text-align: left;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.cdt-format:hover {
  background: var(--bg-hover);
  border-color: var(--border-input);
}
.cdt-format.is-active {
  background: rgba(var(--accent-rgb), .1);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent) inset;
}
.cdt-format-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
}
.cdt-format.is-active .cdt-format-label { color: var(--accent); }
.cdt-format-sample {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Apercu de l'insertion ───────────────────────────────────────────── */
.cdt-preview {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px dashed var(--border-input);
  background: var(--bg-elevated);
  min-height: 40px;
  display: flex;
  align-items: center;
}
.cdt-preview-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.cdt-preview-empty {
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
}

/* ── Footer ──────────────────────────────────────────────────────────── */
.cdt-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
}
.cdt-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  font-size: 12.5px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-input);
  cursor: pointer;
  transition: background var(--t-fast), color var(--t-fast), border-color var(--t-fast);
}
.cdt-btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-muted);
}
.cdt-btn-secondary:disabled { opacity: .45; cursor: not-allowed; }

.cdt-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  background: var(--cta);
  color: #fff;
  border: 1px solid var(--cta);
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, .12);
  transition: background var(--t-fast), transform var(--t-fast);
}
.cdt-btn-primary:hover:not(:disabled) {
  background: var(--cta-hover);
  transform: translateY(-1px);
}
.cdt-btn-primary:disabled {
  opacity: .45;
  cursor: not-allowed;
  background: var(--bg-hover);
  color: var(--text-muted);
  border-color: var(--border);
  box-shadow: none;
}

/* ── Responsive ──────────────────────────────────────────────────────── */
@media (max-width: 520px) {
  .cdt-field--row { flex-direction: column; }
}
</style>
