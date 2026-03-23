/**
 * BentoCustomizer.vue - Panneau de personnalisation du bento etudiant.
 * Drag & drop pour reordonner, toggle pour activer/desactiver les widgets.
 */
<script setup lang="ts">
import { ref, watch } from 'vue'
import { GripVertical, RotateCcw } from 'lucide-vue-next'
import { useDraggable } from 'vue-draggable-plus'
import type { WidgetDef } from './registry'

const props = defineProps<{
  allWidgets: WidgetDef[]
  isVisible: (id: string) => boolean
}>()

const emit = defineEmits<{
  toggle: [id: string]
  move: [id: string, direction: 'up' | 'down']
  reorder: [widgets: WidgetDef[]]
  reset: []
  close: []
}>()

// Local copy for drag reordering
const localWidgets = ref([...props.allWidgets])
watch(() => props.allWidgets, (v) => { localWidgets.value = [...v] }, { deep: true })

const listRef = ref<HTMLElement | null>(null)

useDraggable(listRef, localWidgets, {
  handle: '.bc-drag-handle',
  animation: 200,
  ghostClass: 'bc-ghost',
  dragClass: 'bc-dragging',
  onEnd: () => {
    emit('reorder', [...localWidgets.value])
  },
})
</script>

<template>
  <div class="bc-panel" tabindex="-1">
    <div class="bc-header">
      <span class="bc-title">Personnaliser</span>
      <button class="bc-reset" @click="emit('reset')">
        <RotateCcw :size="11" />
        Réinitialiser
      </button>
    </div>

    <div ref="listRef" class="bc-list">
      <div
        v-for="w in localWidgets"
        :key="w.id"
        class="bc-item"
        :class="{ 'bc-item--hidden': !isVisible(w.id) }"
      >
        <div class="bc-drag-handle" title="Glisser pour reordonner">
          <GripVertical :size="14" />
        </div>
        <component :is="w.icon" :size="13" class="bc-item-icon" />
        <div class="bc-item-info">
          <span class="bc-item-label">{{ w.label }}</span>
        </div>
        <label class="bc-toggle">
          <input
            type="checkbox"
            :checked="isVisible(w.id)"
            @change="emit('toggle', w.id)"
          />
          <span class="bc-toggle-track" role="switch" :aria-checked="isVisible(w.id)" :aria-label="'Afficher ' + w.label" />
        </label>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bc-panel {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 14px;
}
.bc-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.bc-title {
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .06em;
  color: var(--text-muted);
}
.bc-reset {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; color: var(--accent);
  background: none; border: none; cursor: pointer; font-family: var(--font);
  padding: 3px 6px; border-radius: 5px;
  transition: background .15s;
}
.bc-reset:hover { background: rgba(74,144,217,.08); }

.bc-list { display: flex; flex-direction: column; gap: 4px; }
.bc-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid transparent;
  transition: all 0.15s;
}
.bc-item:hover { background: var(--bg-hover); }
.bc-item--hidden { opacity: .4; }

.bc-drag-handle {
  color: var(--text-muted); cursor: grab;
  display: flex; align-items: center;
  opacity: .4; transition: opacity .15s;
}
.bc-drag-handle:active { cursor: grabbing; }
.bc-item:hover .bc-drag-handle { opacity: .8; }

.bc-item-icon { color: var(--text-muted); flex-shrink: 0; }
.bc-item-info { flex: 1; min-width: 0; }
.bc-item-label { font-size: 12px; font-weight: 600; color: var(--text-primary); }

/* Ghost & drag states */
.bc-ghost {
  opacity: .3;
  border: 1px dashed var(--accent);
  border-radius: 8px;
}
.bc-dragging { opacity: .8; }

/* Toggle switch */
.bc-toggle { position: relative; display: inline-flex; cursor: pointer; flex-shrink: 0; }
.bc-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
.bc-toggle-track {
  width: 28px; height: 16px; border-radius: 8px;
  background: var(--bg-active);
  transition: background .2s;
  position: relative;
}
.bc-toggle-track::after {
  content: '';
  position: absolute; top: 2px; left: 2px;
  width: 12px; height: 12px; border-radius: 50%;
  background: var(--text-muted);
  transition: all .2s;
}
.bc-toggle input:checked + .bc-toggle-track { background: var(--accent); }
.bc-toggle input:checked + .bc-toggle-track::after {
  transform: translateX(12px);
  background: #fff;
}
</style>
