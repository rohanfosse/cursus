<script setup lang="ts">
import { computed } from 'vue'
import type { CursorInfo } from '@/composables/useLumenEditor'

interface Props {
  cursor: CursorInfo | null
  content: string
  saveState: 'saved' | 'saving' | 'dirty' | 'idle'
  savedAt?: string | null
  showLineNumbers: boolean
}
interface Emits {
  (e: 'toggleLineNumbers'): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

const words = computed(() => {
  const text = props.content.trim()
  return text ? text.split(/\s+/).length : 0
})

const chars = computed(() => props.content.length)

const readingMinutes = computed(() => Math.max(1, Math.ceil(words.value / 200)))

const cursorLabel = computed(() => {
  if (!props.cursor) return 'Ln 1, Col 1'
  const { line, col, selectionLength } = props.cursor
  if (selectionLength > 0) return `Ln ${line}, Col ${col} · ${selectionLength} sel`
  return `Ln ${line}, Col ${col}`
})

const saveLabel = computed(() => {
  switch (props.saveState) {
    case 'saving': return 'Enregistrement…'
    case 'dirty':  return 'Modifications non enregistrées'
    case 'saved':  return props.savedAt ? `Enregistré · ${props.savedAt}` : 'Enregistré'
    default:       return ''
  }
})

const saveDot = computed(() => {
  switch (props.saveState) {
    case 'saving': return 'lumen-status-dot--saving'
    case 'dirty':  return 'lumen-status-dot--dirty'
    case 'saved':  return 'lumen-status-dot--saved'
    default:       return 'lumen-status-dot--idle'
  }
})
</script>

<template>
  <footer class="lumen-statusbar">
    <div class="lumen-sb-group">
      <button class="lumen-sb-item lumen-sb-item--btn" :title="showLineNumbers ? 'Masquer les numéros de ligne' : 'Afficher les numéros de ligne'" @click="$emit('toggleLineNumbers')">
        {{ showLineNumbers ? '# on' : '# off' }}
      </button>
      <span class="lumen-sb-item">{{ cursorLabel }}</span>
    </div>
    <div class="lumen-sb-group lumen-sb-center">
      <span class="lumen-sb-item">{{ words }} mots</span>
      <span class="lumen-sb-item">{{ chars }} car.</span>
      <span class="lumen-sb-item">~{{ readingMinutes }} min de lecture</span>
    </div>
    <div class="lumen-sb-group lumen-sb-right">
      <span v-if="saveLabel" class="lumen-sb-save">
        <span class="lumen-status-dot" :class="saveDot" />
        {{ saveLabel }}
      </span>
      <span class="lumen-sb-item lumen-sb-item--lang">Markdown</span>
    </div>
  </footer>
</template>

<style scoped>
.lumen-statusbar {
  display: flex;
  align-items: center;
  min-height: 30px;
  padding: 3px 16px;
  background: var(--bg, #f8fafc);
  border-top: 1px solid var(--border, rgba(0, 0, 0, .08));
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 12px;
  color: var(--text-2, #64748b);
  flex-shrink: 0;
  gap: 24px;
  user-select: none;
}

.lumen-sb-group {
  display: flex;
  align-items: center;
  gap: 14px;
}

.lumen-sb-center {
  flex: 1;
  justify-content: center;
}

.lumen-sb-right {
  margin-left: auto;
}

.lumen-sb-item--btn {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: inherit;
  font-size: inherit;
  min-height: 24px;
}
.lumen-sb-item--btn:hover {
  background: var(--bg-card, #fff);
  color: #b45309;
}
.lumen-sb-item--btn:focus-visible {
  outline: 2px solid #b45309;
  outline-offset: 1px;
}

.lumen-sb-save {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.lumen-status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
}
.lumen-status-dot--saving { background: #4338ca; animation: lumen-pulse 1.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .lumen-status-dot--saving { animation: none; }
}
.lumen-status-dot--dirty  { background: #b45309; }
.lumen-status-dot--saved  { background: #047857; }
.lumen-status-dot--idle   { background: #cbd5e1; }

@keyframes lumen-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.lumen-sb-item--lang {
  padding: 2px 6px;
  border-left: 1px solid var(--border, rgba(0, 0, 0, .08));
}
</style>
