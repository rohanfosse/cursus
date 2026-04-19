<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { ClipboardList, Plus, Trash2, Pencil, Check } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import UiWidgetCard from '@/components/ui/UiWidgetCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'

interface FeedbackTemplate {
  id: string
  label: string
  content: string
}

const STORAGE_KEY = 'teacher_feedback_templates'

// Templates pre-seedes : retours frequents en correction CESI.
const DEFAULTS: FeedbackTemplate[] = [
  { id: 't1', label: 'Bien structuré', content: 'Bien structuré et clair. Continue dans cette direction.' },
  { id: 't2', label: 'À reprendre',    content: 'Le fond est bon mais à reprendre sur la forme. Voir mes annotations.' },
  { id: 't3', label: 'Manque de profondeur', content: 'Le sujet mériterait davantage de profondeur d\'analyse. Étoffe avec des exemples concrets.' },
  { id: 't4', label: 'Excellent',      content: 'Travail remarquable, très au-dessus des attentes. Bravo.' },
  { id: 't5', label: 'Insuffisant',    content: 'Les attendus du référentiel ne sont pas atteints. Revoyons cela ensemble.' },
]

const { showToast } = useToast()
const templates = ref<FeedbackTemplate[]>([])
const editing = ref(false)
const initialized = ref(false)
const newLabel = ref('')
const newContent = ref('')

onMounted(() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    templates.value = saved ? (JSON.parse(saved) as FeedbackTemplate[]) : [...DEFAULTS]
  } catch {
    templates.value = [...DEFAULTS]
  }
  initialized.value = true
})

let persistTimer: ReturnType<typeof setTimeout> | null = null
watch(templates, (val) => {
  if (!initialized.value) return
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(val)) } catch { /* quota */ }
  }, 300)
}, { deep: true })

onUnmounted(() => {
  if (persistTimer) clearTimeout(persistTimer)
})

async function copyTemplate(t: FeedbackTemplate) {
  try {
    await navigator.clipboard.writeText(t.content)
    showToast(`Copié : "${t.label}"`, 'success')
  } catch {
    showToast('Impossible de copier dans le presse-papiers', 'error')
  }
}

function addTemplate() {
  const label = newLabel.value.trim()
  const content = newContent.value.trim()
  if (!label || !content || templates.value.length >= 12) return
  templates.value.push({ id: `t${Date.now()}`, label, content })
  newLabel.value = ''
  newContent.value = ''
}

function removeTemplate(id: string) {
  templates.value = templates.value.filter(t => t.id !== id)
}
</script>

<template>
  <UiWidgetCard
    :icon="ClipboardList"
    label="Templates de feedback"
    aria-label="Templates de feedback"
  >
    <template #header-extra>
      <button
        type="button"
        class="wft-edit"
        :aria-label="editing ? 'Terminer l’édition' : 'Modifier les templates'"
        @click="editing = !editing"
      >
        <component :is="editing ? Check : Pencil" :size="12" />
      </button>
    </template>

    <EmptyState
      v-if="!templates.length"
      size="sm"
      tone="muted"
      title="Aucun template"
      subtitle="Ajoute des retours fréquents pour les coller en 1 clic."
    />

    <div v-else class="wft-list">
      <div v-for="t in templates" :key="t.id" class="wft-row">
        <button
          type="button"
          class="wft-pill"
          :title="t.content"
          @click="copyTemplate(t)"
        >
          {{ t.label }}
        </button>
        <button
          v-if="editing"
          type="button"
          class="wft-remove"
          :aria-label="`Supprimer le template ${t.label}`"
          @click="removeTemplate(t.id)"
        >
          <Trash2 :size="11" />
        </button>
      </div>
    </div>

    <div v-if="editing && templates.length < 12" class="wft-add">
      <input
        v-model="newLabel"
        class="wft-input"
        placeholder="Libellé"
        maxlength="30"
        @keydown.enter="addTemplate"
      />
      <input
        v-model="newContent"
        class="wft-input wft-input--content"
        placeholder="Contenu collé au clic"
        maxlength="500"
        @keydown.enter="addTemplate"
      />
      <button
        type="button"
        class="wft-add-btn"
        aria-label="Ajouter le template"
        :disabled="!newLabel.trim() || !newContent.trim()"
        @click="addTemplate"
      >
        <Plus :size="12" />
      </button>
    </div>
  </UiWidgetCard>
</template>

<style scoped>
.wft-edit {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: var(--radius-xs);
  display: flex;
  align-items: center;
  transition: color var(--motion-fast) var(--ease-out);
}
.wft-edit:hover { color: var(--accent); }
.wft-edit:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.wft-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.wft-row {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.wft-pill {
  display: inline-flex;
  align-items: center;
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 4px var(--space-sm);
  border-radius: 14px;
  background: rgba(var(--accent-rgb), .1);
  color: var(--accent);
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: background var(--motion-fast) var(--ease-out);
}
.wft-pill:hover { background: rgba(var(--accent-rgb), .2); }
.wft-pill:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.wft-remove {
  background: none;
  border: none;
  color: var(--color-danger);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  border-radius: var(--radius-xs);
}
.wft-remove:hover { background: rgba(var(--color-danger-rgb), .12); }

.wft-add {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
  padding-top: var(--space-sm);
  border-top: 1px solid var(--border);
}

.wft-input {
  font-size: var(--text-xs);
  padding: 4px var(--space-sm);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-primary);
  font-family: inherit;
}
.wft-input:focus {
  outline: none;
  border-color: var(--accent);
}
.wft-input--content { font-size: var(--text-xs); }

.wft-add-btn {
  align-self: flex-end;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  padding: 4px var(--space-sm);
  cursor: pointer;
  font-family: inherit;
}
.wft-add-btn:disabled {
  opacity: .4;
  cursor: not-allowed;
}
.wft-add-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
</style>
