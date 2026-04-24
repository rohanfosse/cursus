<script setup lang="ts">
/**
 * Picker de statut personnalise utilisateur.
 * Presets rapides pour le contexte formation : examen, TP, pause, offline.
 * Duree optionnelle (auto-clear a expiration cote serveur).
 */
import { computed, nextTick, ref, watch } from 'vue'
import { X, Trash2 } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import { useStatusesStore } from '@/stores/statuses'
import { formatExpiryShort } from '@/utils/date'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

const statuses = useStatusesStore()

const PRESETS = [
  { emoji: '📝', text: 'En examen' },
  { emoji: '🧪', text: 'En TP' },
  { emoji: '📚', text: 'En cours' },
  { emoji: '☕', text: 'En pause' },
  { emoji: '🎧', text: 'Concentration (ne pas déranger)' },
  { emoji: '💻', text: 'Disponible en DM' },
  { emoji: '🚶', text: 'Revient bientôt' },
  { emoji: '✈️', text: 'Absent' },
] as const

const DURATIONS = [
  { label: '30 minutes', ms: 30 * 60_000 },
  { label: '1 heure',    ms: 60 * 60_000 },
  { label: '4 heures',   ms: 4 * 60 * 60_000 },
  { label: 'Aujourd\'hui', ms: null as number | null, until: 'endOfDay' as const },
  { label: 'Cette semaine', ms: null as number | null, until: 'endOfWeek' as const },
  { label: 'Sans expiration', ms: null as number | null, until: 'never' as const },
] as const

const emoji = ref('')
const text = ref('')
const durationIdx = ref(1) // default 1h
const submitting = ref(false)
const textInputRef = ref<HTMLInputElement | null>(null)

function applyPreset(p: typeof PRESETS[number]) {
  emoji.value = p.emoji
  text.value = p.text
}

function computeExpiresAt(): string | null {
  const d = DURATIONS[durationIdx.value]
  if ('until' in d) {
    if (d.until === 'never') return null
    const now = new Date()
    if (d.until === 'endOfDay') {
      now.setHours(23, 59, 0, 0)
      return now.toISOString()
    }
    if (d.until === 'endOfWeek') {
      const day = now.getDay() || 7 // lundi=1, dimanche=7
      now.setDate(now.getDate() + (7 - day))
      now.setHours(23, 59, 0, 0)
      return now.toISOString()
    }
  }
  if (d.ms) return new Date(Date.now() + d.ms).toISOString()
  return null
}

const canSubmit = computed(() => !submitting.value && (emoji.value.trim() || text.value.trim()))

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  const ok = await statuses.setMine({
    emoji: emoji.value.trim() || null,
    text:  text.value.trim() || null,
    expiresAt: computeExpiresAt(),
  })
  submitting.value = false
  if (ok) emit('update:modelValue', false)
}

async function clearStatus() {
  submitting.value = true
  const ok = await statuses.setMine(null)
  submitting.value = false
  if (ok) emit('update:modelValue', false)
}

watch(() => statuses.mine, (s) => {
  if (s) { emoji.value = s.emoji ?? ''; text.value = s.text ?? '' }
}, { immediate: true })

// Auto-focus de l'input texte a l'ouverture pour permettre la frappe immediate
watch(() => props.modelValue, async (open) => {
  if (!open) return
  await nextTick()
  textInputRef.value?.focus()
  textInputRef.value?.select()
})
</script>

<template>
  <Modal :model-value="modelValue" title="Définir un statut" max-width="480px" @update:model-value="emit('update:modelValue', $event)">
    <div class="usp-body">
      <div v-if="statuses.mine?.emoji || statuses.mine?.text" class="usp-current">
        <span class="usp-current-emoji">{{ statuses.mine.emoji || '•' }}</span>
        <div class="usp-current-body">
          <span class="usp-current-text">{{ statuses.mine.text }}</span>
          <span class="usp-current-expiry">{{ formatExpiryShort(statuses.mine.expiresAt) }}</span>
        </div>
      </div>

      <label class="usp-label">Emoji + texte</label>
      <div class="usp-input-row">
        <input v-model="emoji" maxlength="8" class="usp-input usp-emoji-input" placeholder="🎯" />
        <input
          ref="textInputRef"
          v-model="text"
          maxlength="100"
          class="usp-input usp-text-input"
          placeholder="Qu'est-ce que tu fais ?"
          @keydown.enter="submit"
        />
      </div>

      <label class="usp-label">Presets</label>
      <div class="usp-presets">
        <button
          v-for="p in PRESETS"
          :key="p.text"
          class="usp-preset"
          @click="applyPreset(p)"
        >
          <span class="usp-preset-emoji">{{ p.emoji }}</span>
          <span class="usp-preset-text">{{ p.text }}</span>
        </button>
      </div>

      <label class="usp-label">Effacer automatiquement</label>
      <select v-model.number="durationIdx" class="usp-select">
        <option v-for="(d, i) in DURATIONS" :key="d.label" :value="i">{{ d.label }}</option>
      </select>

      <div class="usp-actions">
        <button
          v-if="statuses.mine?.emoji || statuses.mine?.text"
          class="usp-btn usp-btn-clear"
          :disabled="submitting"
          @click="clearStatus"
        >
          <Trash2 :size="13" /> Effacer
        </button>
        <button class="usp-btn usp-btn-cancel" @click="emit('update:modelValue', false)">Annuler</button>
        <button class="usp-btn usp-btn-submit" :disabled="!canSubmit" @click="submit">
          {{ submitting ? 'Enregistrement…' : 'Enregistrer' }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.usp-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; }

.usp-current {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: rgba(var(--accent-rgb), .08);
  border: 1px solid rgba(var(--accent-rgb), .3);
  border-radius: 10px;
}
.usp-current-emoji { font-size: 22px; line-height: 1; }
.usp-current-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.usp-current-text { font-size: 13px; color: var(--text-primary); font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.usp-current-expiry { font-size: 11px; color: var(--text-muted); letter-spacing: .2px; }

.usp-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .5px;
  font-weight: 700;
  color: var(--text-muted);
  margin-top: 4px;
}

.usp-input-row { display: flex; gap: 6px; }
.usp-input {
  padding: 7px 10px;
  border: 1px solid var(--border-input);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}
.usp-emoji-input { width: 60px; text-align: center; font-size: 18px; }
.usp-text-input { flex: 1; }

.usp-presets {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}
.usp-preset {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 13px;
  text-align: left;
  transition: background .12s, border-color .12s;
}
.usp-preset:hover {
  background: var(--accent-subtle);
  border-color: var(--accent);
  color: var(--accent);
}
.usp-preset-emoji { font-size: 16px; }

.usp-select {
  padding: 7px 10px;
  border: 1px solid var(--border-input);
  border-radius: 8px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
}

.usp-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
.usp-btn {
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.usp-btn:disabled { opacity: .4; cursor: not-allowed; }
.usp-btn-cancel:hover { background: var(--bg-hover); }
.usp-btn-clear { margin-right: auto; color: var(--color-danger); border-color: var(--color-danger); }
.usp-btn-clear:hover { background: rgba(231, 76, 60, .1); }
.usp-btn-submit {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
</style>
