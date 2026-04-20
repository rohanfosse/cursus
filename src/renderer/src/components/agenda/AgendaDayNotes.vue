<script setup lang="ts">
/**
 * Notes personnelles par jour pour le calendrier.
 * Stockage localStorage, pattern identique a LumenAnnotations.
 */
import { ref, computed, watch } from 'vue'
import { Plus, Trash2, StickyNote, Copy } from 'lucide-vue-next'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'
import { useContextMenu } from '@/composables/useContextMenu'
import { useToast } from '@/composables/useToast'

interface DayNote {
  id: string
  text: string
  createdAt: string
}

const props = defineProps<{ date: string }>()

const notes = ref<DayNote[]>([])
const newNote = ref('')

const storageKey = computed(() => `agenda-notes-${props.date}`)

function load() {
  try {
    const raw = localStorage.getItem(storageKey.value)
    notes.value = raw ? JSON.parse(raw) : []
  } catch { notes.value = [] }
}

function save() {
  try { localStorage.setItem(storageKey.value, JSON.stringify(notes.value)) }
  catch { /* quota */ }
}

function addNote() {
  const text = newNote.value.trim()
  if (!text) return
  notes.value = [...notes.value, { id: `${Date.now()}`, text, createdAt: new Date().toISOString() }]
  save()
  newNote.value = ''
}

function removeNote(id: string) {
  notes.value = notes.value.filter((n) => n.id !== id)
  save()
  if (notes.value.length === 0) localStorage.removeItem(storageKey.value)
}

watch(() => props.date, () => { load() }, { immediate: true })

const { showToast } = useToast()
const { ctx, open: openCtx, close: closeCtx } = useContextMenu<DayNote>()
const ctxItems = computed<ContextMenuItem[]>(() => {
  const n = ctx.value?.target
  if (!n) return []
  return [
    { label: 'Copier le texte', icon: Copy, action: async () => {
      await navigator.clipboard.writeText(n.text)
      showToast('Note copiée.', 'success')
    } },
    { label: 'Supprimer', icon: Trash2, danger: true, separator: true, action: () => removeNote(n.id) },
  ]
})
</script>

<template>
  <div class="day-notes">
    <h3 class="day-notes-title">
      <StickyNote :size="12" /> Notes personnelles
    </h3>
    <div class="day-notes-add">
      <input
        v-model="newNote"
        type="text"
        class="day-notes-input"
        placeholder="Ajouter une note..."
        @keydown.enter="addNote"
      />
      <button type="button" class="day-notes-add-btn" :disabled="!newNote.trim()" @click="addNote">
        <Plus :size="12" />
      </button>
    </div>
    <ul v-if="notes.length" class="day-notes-list">
      <li v-for="n in notes" :key="n.id" class="day-notes-item" @contextmenu="openCtx($event, n)">
        <span class="day-notes-text">{{ n.text }}</span>
        <button type="button" class="day-notes-del" @click="removeNote(n.id)">
          <Trash2 :size="10" />
        </button>
      </li>
    </ul>
    <ContextMenu
      v-if="ctx"
      :x="ctx.x"
      :y="ctx.y"
      :items="ctxItems"
      @close="closeCtx"
    />
  </div>
</template>

<style scoped>
.day-notes { margin-top: 8px; }
.day-notes-title {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 700; color: var(--text-muted); margin: 0 0 6px;
}
.day-notes-add {
  display: flex; gap: 4px;
}
.day-notes-input {
  flex: 1; padding: 5px 8px; border-radius: 4px;
  border: 1px solid var(--border); background: var(--bg-elevated);
  color: var(--text-primary); font-size: 12px; font-family: inherit; outline: none;
}
.day-notes-input:focus { border-color: var(--accent); }
.day-notes-add-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 4px;
  border: 1px solid var(--border); background: var(--bg-primary);
  color: var(--text-muted); cursor: pointer;
}
.day-notes-add-btn:hover:not(:disabled) { background: var(--bg-hover); color: var(--accent); }
.day-notes-add-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.day-notes-list { list-style: none; margin: 6px 0 0; padding: 0; }
.day-notes-item {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 0; border-bottom: 1px solid var(--border);
}
.day-notes-item:last-child { border-bottom: none; }
.day-notes-text { flex: 1; font-size: 12px; color: var(--text-primary); }
.day-notes-del {
  background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px;
}
.day-notes-del:hover { color: #ef4444; }
</style>
