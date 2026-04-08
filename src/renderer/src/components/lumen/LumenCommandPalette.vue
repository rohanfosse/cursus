<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import {
  Search, FileText, Plus, Save, Trash2, Eye, Columns, Edit3,
  CheckCircle2, XCircle, Download, Clipboard, ListTree, Focus,
} from 'lucide-vue-next'
import type { LumenCourse } from '@/types'

interface Command {
  id: string
  label: string
  hint?: string
  icon: 'file' | 'plus' | 'save' | 'trash' | 'eye' | 'columns' | 'edit' | 'publish' | 'unpublish' | 'download' | 'clipboard' | 'outline' | 'focus'
  action: () => void
}

interface Props {
  open: boolean
  courses: LumenCourse[]
  currentCourseId: number | null
  commands: Command[]
  onCourseSelect: (id: number) => void
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const query = ref('')
const activeIdx = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

// ── Filtered combined list : commands + courses ────────────────────────────
interface Item {
  type: 'command' | 'course'
  label: string
  hint?: string
  icon: Command['icon']
  action: () => void
  key: string
}

const items = computed<Item[]>(() => {
  const q = query.value.trim().toLowerCase()
  const fuzzyMatch = (text: string) => {
    if (!q) return true
    const lower = text.toLowerCase()
    if (lower.includes(q)) return true
    // match par sous-chaine (lettres dans l'ordre)
    let pos = 0
    for (const ch of q) {
      pos = lower.indexOf(ch, pos)
      if (pos === -1) return false
      pos++
    }
    return true
  }

  const cmdItems: Item[] = props.commands
    .filter(c => fuzzyMatch(c.label))
    .map(c => ({
      type: 'command',
      label: c.label,
      hint: c.hint,
      icon: c.icon,
      action: c.action,
      key: `cmd-${c.id}`,
    }))

  const courseItems: Item[] = props.courses
    .filter(c => fuzzyMatch(c.title))
    .map(c => ({
      type: 'course' as const,
      label: c.title || 'Sans titre',
      hint: c.status === 'published' ? 'Publié' : 'Brouillon',
      icon: 'file' as const,
      action: () => props.onCourseSelect(c.id),
      key: `course-${c.id}`,
    }))

  return [...cmdItems, ...courseItems]
})

// ── Reset state on open/close ─────────────────────────────────────────────
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    query.value = ''
    activeIdx.value = 0
    nextTick(() => inputRef.value?.focus())
  }
})

watch(items, () => { activeIdx.value = 0 })

// ── Keyboard navigation + focus trap ──────────────────────────────────────
function handleKey(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape')   { e.preventDefault(); emit('close'); return }
  if (e.key === 'ArrowDown'){ e.preventDefault(); activeIdx.value = Math.min(activeIdx.value + 1, items.value.length - 1); scrollActive(); return }
  if (e.key === 'ArrowUp')  { e.preventDefault(); activeIdx.value = Math.max(activeIdx.value - 1, 0); scrollActive(); return }
  if (e.key === 'Enter')    {
    e.preventDefault()
    const item = items.value[activeIdx.value]
    if (item) {
      item.action()
      emit('close')
    }
    return
  }
  // Focus trap : Tab cycle sur la liste des items
  if (e.key === 'Tab') {
    e.preventDefault()
    if (items.value.length === 0) return
    if (e.shiftKey) {
      activeIdx.value = activeIdx.value <= 0 ? items.value.length - 1 : activeIdx.value - 1
    } else {
      activeIdx.value = activeIdx.value >= items.value.length - 1 ? 0 : activeIdx.value + 1
    }
    scrollActive()
  }
}

function scrollActive() {
  nextTick(() => {
    const el = document.querySelector('.lumen-cmd-item--active') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  })
}

onMounted(() => { window.addEventListener('keydown', handleKey) })
onBeforeUnmount(() => { window.removeEventListener('keydown', handleKey) })

function handleItemClick(idx: number) {
  activeIdx.value = idx
  const item = items.value[idx]
  if (item) {
    item.action()
    emit('close')
  }
}

function handleBackdropClick() { emit('close') }

// Map icon type to component
const iconMap = {
  file: FileText,
  plus: Plus,
  save: Save,
  trash: Trash2,
  eye: Eye,
  columns: Columns,
  edit: Edit3,
  publish: CheckCircle2,
  unpublish: XCircle,
  download: Download,
  clipboard: Clipboard,
  outline: ListTree,
  focus: Focus,
}
</script>

<template>
  <Transition name="lumen-cmd">
    <div v-if="open" class="lumen-cmd-overlay" @click.self="handleBackdropClick">
      <div class="lumen-cmd-panel" role="dialog" aria-label="Palette de commandes">
        <div class="lumen-cmd-input-wrap">
          <Search :size="16" class="lumen-cmd-search-icon" />
          <input
            ref="inputRef"
            v-model="query"
            type="text"
            class="lumen-cmd-input"
            placeholder="Rechercher un cours ou une commande…"
            role="combobox"
            aria-controls="lumen-cmd-listbox"
            aria-expanded="true"
            :aria-activedescendant="items[activeIdx] ? `lumen-cmd-item-${activeIdx}` : undefined"
            aria-label="Rechercher une commande ou un cours"
          />
          <kbd class="lumen-cmd-kbd">Esc</kbd>
        </div>
        <div
          id="lumen-cmd-listbox"
          class="lumen-cmd-list"
          role="listbox"
          aria-label="Commandes disponibles"
        >
          <button
            v-for="(item, i) in items"
            :id="`lumen-cmd-item-${i}`"
            :key="item.key"
            class="lumen-cmd-item"
            :class="{ 'lumen-cmd-item--active': i === activeIdx }"
            role="option"
            :aria-selected="i === activeIdx"
            @mouseenter="activeIdx = i"
            @click="handleItemClick(i)"
          >
            <component :is="iconMap[item.icon]" :size="15" class="lumen-cmd-item-icon" />
            <span class="lumen-cmd-item-label">{{ item.label }}</span>
            <span v-if="item.hint" class="lumen-cmd-item-hint">{{ item.hint }}</span>
          </button>
          <div v-if="items.length === 0" class="lumen-cmd-empty">
            Aucun résultat
          </div>
        </div>
        <div class="lumen-cmd-footer">
          <span class="lumen-cmd-hint"><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>
          <span class="lumen-cmd-hint"><kbd>↵</kbd> sélectionner</span>
          <span class="lumen-cmd-hint"><kbd>Esc</kbd> fermer</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.lumen-cmd-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
}

.lumen-cmd-panel {
  width: 560px;
  max-width: 92vw;
  background: var(--bg-card, #fff);
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.35);
  overflow: hidden;
  border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
  display: flex;
  flex-direction: column;
  max-height: 70vh;
}

.lumen-cmd-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.08));
}

.lumen-cmd-search-icon {
  color: var(--text-3, #94a3b8);
  flex-shrink: 0;
}

.lumen-cmd-input {
  flex: 1;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 15px;
  color: var(--text, #1e293b);
  outline: none;
}
.lumen-cmd-input::placeholder { color: var(--text-3, #94a3b8); }

.lumen-cmd-kbd {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg, #f8fafc);
  color: var(--text-3, #94a3b8);
  border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
}

.lumen-cmd-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px 6px;
}

.lumen-cmd-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  background: transparent;
  text-align: left;
  font-family: inherit;
  font-size: 14px;
  color: var(--text, #1e293b);
  cursor: pointer;
  border-radius: 8px;
  transition: background 120ms ease;
}

.lumen-cmd-item--active {
  background: rgba(245, 158, 11, 0.1);
}

.lumen-cmd-item-icon {
  flex-shrink: 0;
  color: var(--text-3, #94a3b8);
}

.lumen-cmd-item--active .lumen-cmd-item-icon { color: #d97706; }

.lumen-cmd-item-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lumen-cmd-item-hint {
  font-size: 11px;
  color: var(--text-3, #94a3b8);
  flex-shrink: 0;
}

.lumen-cmd-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-3, #94a3b8);
  font-size: 13px;
}

.lumen-cmd-footer {
  display: flex;
  gap: 16px;
  padding: 10px 18px;
  border-top: 1px solid var(--border, rgba(0, 0, 0, 0.08));
  background: var(--bg, #f8fafc);
  font-size: 11px;
  color: var(--text-3, #94a3b8);
}

.lumen-cmd-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.lumen-cmd-hint kbd {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--bg-card, #fff);
  border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
}

/* Transition */
.lumen-cmd-enter-active, .lumen-cmd-leave-active {
  transition: opacity 150ms ease;
}
.lumen-cmd-enter-active .lumen-cmd-panel,
.lumen-cmd-leave-active .lumen-cmd-panel {
  transition: transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.lumen-cmd-enter-from, .lumen-cmd-leave-to {
  opacity: 0;
}
.lumen-cmd-enter-from .lumen-cmd-panel,
.lumen-cmd-leave-to .lumen-cmd-panel {
  transform: scale(0.96) translateY(-10px);
}

@media (prefers-reduced-motion: reduce) {
  .lumen-cmd-enter-active,
  .lumen-cmd-leave-active,
  .lumen-cmd-enter-active .lumen-cmd-panel,
  .lumen-cmd-leave-active .lumen-cmd-panel {
    transition: none !important;
  }
  .lumen-cmd-enter-from .lumen-cmd-panel,
  .lumen-cmd-leave-to .lumen-cmd-panel {
    transform: none;
  }
}
</style>
