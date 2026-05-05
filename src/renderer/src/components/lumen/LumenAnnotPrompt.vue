<script setup lang="ts">
/**
 * LumenAnnotPrompt : popover stylise pour saisir un commentaire ou une
 * correction au point ou l'utilisateur a fait clic droit.
 *
 * Modes :
 *  - 'note'       : un champ "commentaire" (defaut). Submit emet { comment }.
 *  - 'correction' : deux champs "suggestion" + "raison" (au prof). Submit
 *                    emet { suggestion, comment }.
 *
 * Auto-dismiss sur Escape ou clic exterieur. Repositionne pour rester dans
 * le viewport. Teleporte sur body pour eviter les conflits de stacking.
 */
import { onMounted, onBeforeUnmount, nextTick, ref, computed } from 'vue'
import { Check, X, MessageSquarePlus, Wrench } from 'lucide-vue-next'

interface Props {
  x: number
  y: number
  text: string
  mode?: 'note' | 'correction'
}

interface Emits {
  (e: 'submit', payload: { comment: string; suggestion?: string }): void
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), { mode: 'note' })
const emit = defineEmits<Emits>()

const popoverEl = ref<HTMLElement | null>(null)
const firstInputEl = ref<HTMLTextAreaElement | null>(null)
const comment = ref('')
const suggestion = ref('')
const adjustedX = ref(props.x)
const adjustedY = ref(props.y)

const POPOVER_W = 340
const POPOVER_MARGIN = 12

const canSubmit = computed(() => {
  if (props.mode === 'correction') return suggestion.value.trim().length > 0
  return true
})

function submit() {
  if (!canSubmit.value) return
  if (props.mode === 'correction') {
    emit('submit', { comment: comment.value, suggestion: suggestion.value })
  } else {
    emit('submit', { comment: comment.value })
  }
}

function onClickOutside(e: MouseEvent) {
  if (popoverEl.value && !popoverEl.value.contains(e.target as Node)) {
    emit('close')
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    submit()
  }
}

onMounted(async () => {
  await nextTick()
  if (popoverEl.value) {
    const rect = popoverEl.value.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    adjustedX.value = props.x + rect.width + POPOVER_MARGIN > vw
      ? Math.max(POPOVER_MARGIN, props.x - rect.width)
      : props.x
    adjustedY.value = props.y + rect.height + POPOVER_MARGIN > vh
      ? Math.max(POPOVER_MARGIN, props.y - rect.height)
      : props.y
  }
  firstInputEl.value?.focus()
  document.addEventListener('mousedown', onClickOutside, { capture: true })
  document.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside, { capture: true })
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <div
      ref="popoverEl"
      class="lumen-annot-prompt"
      :class="{ 'lumen-annot-prompt--correction': mode === 'correction' }"
      :style="{ left: adjustedX + 'px', top: adjustedY + 'px', width: POPOVER_W + 'px' }"
      role="dialog"
      :aria-label="mode === 'correction' ? 'Suggerer une correction' : 'Ajouter un commentaire d\'annotation'"
    >
      <div class="lumen-annot-prompt-head">
        <component :is="mode === 'correction' ? Wrench : MessageSquarePlus" :size="14" />
        <span>{{ mode === 'correction' ? 'Suggerer une correction' : 'Annoter ce passage' }}</span>
      </div>

      <div class="lumen-annot-prompt-quote">
        <span v-if="mode === 'correction'" class="lumen-annot-prompt-quote-label">Texte original</span>
        "{{ text.slice(0, 140) }}{{ text.length > 140 ? '…' : '' }}"
      </div>

      <textarea
        v-if="mode === 'correction'"
        ref="firstInputEl"
        v-model="suggestion"
        class="lumen-annot-prompt-input lumen-annot-prompt-input--suggestion"
        placeholder="Ta proposition de correction…"
        rows="2"
      />

      <textarea
        v-if="mode !== 'correction'"
        ref="firstInputEl"
        v-model="comment"
        class="lumen-annot-prompt-input"
        placeholder="Ton commentaire (optionnel)…"
        rows="3"
      />
      <textarea
        v-else
        v-model="comment"
        class="lumen-annot-prompt-input"
        placeholder="Pourquoi cette correction ? (optionnel)"
        rows="2"
      />

      <div class="lumen-annot-prompt-actions">
        <span class="lumen-annot-prompt-hint">⌘+Enter pour valider</span>
        <button type="button" class="lumen-annot-prompt-btn ghost" @click="emit('close')">
          <X :size="12" /> Annuler
        </button>
        <button
          type="button"
          class="lumen-annot-prompt-btn primary"
          :disabled="!canSubmit"
          @click="submit"
        >
          <Check :size="12" />
          {{ mode === 'correction' ? 'Envoyer' : 'Annoter' }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.lumen-annot-prompt {
  position: fixed;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--bg-elevated, var(--bg-modal, #FFFFFF));
  border: 1px solid var(--border, rgba(15,23,42,.08));
  border-radius: var(--radius);
  box-shadow: var(--elevation-3, 0 8px 24px rgba(0, 0, 0, .25));
  animation: lumen-prompt-in .12s ease;
}
.lumen-annot-prompt--correction {
  border-color: rgba(var(--color-warning-rgb), .35);
}
@keyframes lumen-prompt-in {
  from { opacity: 0; transform: scale(.96) translateY(-4px); }
  to   { opacity: 1; transform: none; }
}

.lumen-annot-prompt-head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--accent);
}
.lumen-annot-prompt--correction .lumen-annot-prompt-head {
  color: var(--color-warning);
}

.lumen-annot-prompt-quote {
  font-size: 12px;
  color: var(--accent);
  font-style: italic;
  line-height: 1.4;
  padding: 6px 10px;
  background: rgba(var(--accent-rgb), .08);
  border-left: 3px solid var(--accent);
  border-radius: 3px;
  max-height: 80px;
  overflow-y: auto;
}
.lumen-annot-prompt--correction .lumen-annot-prompt-quote {
  color: var(--color-warning);
  background: rgba(var(--color-warning-rgb), .08);
  border-left-color: var(--color-warning);
}
.lumen-annot-prompt-quote-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-muted);
  font-style: normal;
  margin-bottom: 2px;
}

.lumen-annot-prompt-input {
  width: 100%;
  padding: 8px 10px;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-primary);
  background: var(--bg-input);
  border: 1px solid var(--border-input, var(--border));
  border-radius: var(--radius-sm);
  outline: none;
  resize: vertical;
  min-height: 56px;
  transition: border-color var(--motion-fast) var(--ease-out);
}
.lumen-annot-prompt-input:focus { border-color: var(--accent); }
.lumen-annot-prompt-input::placeholder { color: var(--text-muted); }
.lumen-annot-prompt-input--suggestion {
  font-weight: 500;
  color: var(--color-success);
}
.lumen-annot-prompt-input--suggestion:focus { border-color: var(--color-success); }

.lumen-annot-prompt-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.lumen-annot-prompt-hint {
  flex: 1;
  font-size: 10.5px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
}
.lumen-annot-prompt-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out),
              opacity var(--motion-fast) var(--ease-out);
}
.lumen-annot-prompt-btn:disabled { opacity: .4; cursor: not-allowed; }
.lumen-annot-prompt-btn.ghost {
  background: transparent;
  color: var(--text-secondary);
}
.lumen-annot-prompt-btn.ghost:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.lumen-annot-prompt-btn.primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.lumen-annot-prompt--correction .lumen-annot-prompt-btn.primary {
  background: var(--color-warning);
  border-color: var(--color-warning);
}
.lumen-annot-prompt-btn.primary:hover:not(:disabled) {
  filter: brightness(1.08);
}
.lumen-annot-prompt-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
