/** CreatePollModal — composition d'un sondage structure avant envoi. */
<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { X, BarChart3, Plus, Trash2, Send, Lock, List } from 'lucide-vue-next'
import {
  serializePoll,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_MAX_QUESTION_LEN,
  POLL_MAX_OPTION_LEN,
} from '@/utils/poll'

interface Props {
  modelValue: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  /** Envoi direct (flow historique, reste le primaire pour un sondage). */
  (e: 'submit', payload: { content: string }): void
  /** Insertion dans le textarea pour ajouter du texte autour, avant envoi. */
  (e: 'submit-insert', payload: { content: string }): void
}>()

const question     = ref('')
const options      = ref<string[]>(['', ''])
const multi        = ref(false)
const anonymous    = ref(false)
const trailingText = ref('')
const questionEl   = ref<HTMLTextAreaElement | null>(null)
const optionRefs   = ref<(HTMLInputElement | null)[]>([])

watch(() => props.modelValue, (open) => {
  if (open) {
    question.value  = ''
    options.value   = ['', '']
    multi.value     = false
    anonymous.value = false
    trailingText.value = ''
    nextTick(() => questionEl.value?.focus())
  }
})

const filledOptions = computed(() => options.value.map((o) => o.trim()).filter(Boolean))
const canSubmit = computed(() =>
  question.value.trim().length > 0 && filledOptions.value.length >= POLL_MIN_OPTIONS,
)

function addOption() {
  if (options.value.length >= POLL_MAX_OPTIONS) return
  options.value.push('')
  nextTick(() => {
    const last = optionRefs.value[options.value.length - 1]
    last?.focus()
  })
}

function removeOption(index: number) {
  if (options.value.length <= POLL_MIN_OPTIONS) {
    options.value[index] = ''
    return
  }
  options.value.splice(index, 1)
}

function onOptionKeydown(e: KeyboardEvent, index: number) {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (index === options.value.length - 1) {
      if (filledOptions.value.length >= POLL_MIN_OPTIONS && canSubmit.value) {
        submit()
      } else {
        addOption()
      }
    } else {
      optionRefs.value[index + 1]?.focus()
    }
  }
}

function close() {
  emit('update:modelValue', false)
}

function buildContent(): string {
  return serializePoll(
    {
      v: 1,
      q: question.value.trim(),
      o: filledOptions.value,
      multi: multi.value,
      anon: anonymous.value,
    },
    trailingText.value,
  )
}

function submit() {
  if (!canSubmit.value) return
  emit('submit', { content: buildContent() })
  close()
}
function submitInsert() {
  if (!canSubmit.value) return
  emit('submit-insert', { content: buildContent() })
  close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="cpoll-modal" role="dialog" aria-modal="true" aria-label="Creer un sondage">

          <div class="cpoll-header">
            <BarChart3 :size="18" class="cpoll-header-icon" />
            <div>
              <h2 class="cpoll-title">Nouveau sondage</h2>
              <p class="cpoll-sub">Les reponses sont comptees en temps reel</p>
            </div>
            <button class="btn-icon cpoll-close" aria-label="Fermer" @click="close"><X :size="16" /></button>
          </div>

          <div class="cpoll-body">
            <div class="cpoll-field">
              <label class="cpoll-label">Question</label>
              <textarea
                ref="questionEl"
                v-model="question"
                class="cpoll-input cpoll-textarea"
                rows="2"
                :maxlength="POLL_MAX_QUESTION_LEN"
                placeholder="Quelle est votre question ?"
                @keydown.escape="close"
              />
              <span class="cpoll-hint">{{ question.length }} / {{ POLL_MAX_QUESTION_LEN }}</span>
            </div>

            <div class="cpoll-field">
              <label class="cpoll-label">Options ({{ filledOptions.length }} / {{ POLL_MAX_OPTIONS }})</label>
              <div class="cpoll-options">
                <div v-for="(opt, i) in options" :key="i" class="cpoll-option-row">
                  <span class="cpoll-option-num">{{ i + 1 }}.</span>
                  <input
                    :ref="(el) => optionRefs[i] = (el as HTMLInputElement | null)"
                    v-model="options[i]"
                    class="cpoll-input"
                    type="text"
                    :maxlength="POLL_MAX_OPTION_LEN"
                    :placeholder="`Option ${i + 1}`"
                    @keydown="onOptionKeydown($event, i)"
                  />
                  <button
                    v-if="options.length > POLL_MIN_OPTIONS"
                    type="button"
                    class="btn-icon cpoll-remove"
                    aria-label="Supprimer cette option"
                    @click="removeOption(i)"
                  >
                    <Trash2 :size="13" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                class="cpoll-add"
                :disabled="options.length >= POLL_MAX_OPTIONS"
                @click="addOption"
              >
                <Plus :size="13" /> Ajouter une option
              </button>
            </div>

            <div class="cpoll-toggles">
              <label class="cpoll-toggle">
                <input v-model="multi" type="checkbox" />
                <span class="cpoll-toggle-label">
                  <List :size="13" /> Autoriser plusieurs choix
                </span>
              </label>
              <label class="cpoll-toggle" :title="'Les noms des votants ne seront pas affiches (seuls les totaux le sont).'">
                <input v-model="anonymous" type="checkbox" />
                <span class="cpoll-toggle-label">
                  <Lock :size="13" /> Votes anonymes
                </span>
              </label>
            </div>

            <div class="cpoll-field">
              <label class="cpoll-label">Contexte (optionnel)</label>
              <textarea
                v-model="trailingText"
                class="cpoll-input cpoll-textarea"
                rows="2"
                maxlength="500"
                placeholder="Ajoutez une precision ou un lien utile..."
              />
            </div>
          </div>

          <div class="cpoll-footer">
            <button class="btn-ghost" @click="close">Annuler</button>
            <button
              type="button"
              class="btn-secondary"
              :disabled="!canSubmit"
              title="Insérer dans le message en cours (pour ajouter du texte autour)"
              @click="submitInsert"
            >
              Insérer dans le message
            </button>
            <button class="btn-cta" :disabled="!canSubmit" @click="submit">
              <Send :size="13" /> Publier le sondage
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity var(--motion-fast) var(--ease-out); }
.modal-fade-enter-from,  .modal-fade-leave-to      { opacity: 0; }

.cpoll-modal {
  width: 100%; max-width: 480px;
  background: var(--bg-modal);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 56px rgba(0,0,0,.65);
  display: flex; flex-direction: column; overflow: hidden;
}

.cpoll-header {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--border);
}
.cpoll-header-icon { color: #1ABC9C; flex-shrink: 0; }
.cpoll-title { font-size: 15px; font-weight: 800; color: var(--text-primary); }
.cpoll-sub   { font-size: 11.5px; color: var(--text-muted); margin-top: 1px; }
.cpoll-close { margin-left: auto; color: var(--text-muted); flex-shrink: 0; }
.cpoll-close:hover { color: var(--text-primary); }

.cpoll-body {
  padding: 18px; display: flex; flex-direction: column; gap: 16px;
  max-height: 70vh; overflow-y: auto;
}

.cpoll-field { display: flex; flex-direction: column; gap: 6px; position: relative; }
.cpoll-label {
  font-size: 11.5px; font-weight: 700;
  color: var(--text-secondary); text-transform: uppercase; letter-spacing: .04em;
}
.cpoll-hint {
  align-self: flex-end; font-size: 10.5px; color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.cpoll-input {
  width: 100%;
  background: var(--bg-hover);
  border: 1.5px solid var(--border-input);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font); font-size: 13.5px;
  padding: 9px 12px;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.cpoll-input:focus {
  border-color: #1ABC9C;
  box-shadow: 0 0 0 3px color-mix(in srgb, #1ABC9C 18%, transparent);
}
.cpoll-textarea { resize: vertical; min-height: 48px; line-height: 1.45; }

.cpoll-options { display: flex; flex-direction: column; gap: 6px; }
.cpoll-option-row { display: flex; align-items: center; gap: 8px; }
.cpoll-option-num {
  font-size: 12px; color: var(--text-muted); font-weight: 700;
  width: 18px; text-align: right;
}
.cpoll-remove { color: var(--text-muted); flex-shrink: 0; }
.cpoll-remove:hover { color: var(--color-danger, #E74C3C); }

.cpoll-add {
  margin-top: 2px;
  display: inline-flex; align-items: center; gap: 6px;
  background: transparent; border: 1.5px dashed var(--border-input);
  border-radius: var(--radius-sm); color: var(--text-secondary);
  font-size: 12.5px; font-weight: 600;
  padding: 8px 12px; cursor: pointer;
  transition: border-color .15s, color .15s;
  align-self: flex-start;
}
.cpoll-add:hover:not(:disabled) {
  border-color: #1ABC9C; color: #1ABC9C;
}
.cpoll-add:disabled { opacity: .4; cursor: not-allowed; }

.cpoll-toggles {
  display: flex; flex-direction: column; gap: 8px;
  padding: 10px 12px; background: var(--bg-hover);
  border-radius: var(--radius-sm); border: 1px solid var(--border);
}
.cpoll-toggle {
  display: flex; align-items: center; gap: 8px;
  cursor: pointer; user-select: none;
}
.cpoll-toggle input[type="checkbox"] { cursor: pointer; margin: 0; }
.cpoll-toggle-label {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px; color: var(--text-primary);
}

.cpoll-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid var(--border);
}
/* CTA emerald — alignement landing (cf. base.css §--cta) */

/* Bouton secondaire "Inserer dans le message" : outline, coherent avec les
   autres modals de builder (CreateTable/Code/Checklist/Announce). */
.btn-secondary {
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
.btn-secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-muted);
}
.btn-secondary:disabled { opacity: .45; cursor: not-allowed; }
</style>
