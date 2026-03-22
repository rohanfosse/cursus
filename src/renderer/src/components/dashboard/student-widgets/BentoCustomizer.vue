/**
 * BentoCustomizer.vue - Panneau de personnalisation du bento étudiant.
 * Permet d'activer/désactiver et réordonner les widgets.
 */
<script setup lang="ts">
import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-vue-next'
import type { WidgetDef } from './registry'

const props = defineProps<{
  allWidgets: WidgetDef[]
  isVisible: (id: string) => boolean
}>()

const emit = defineEmits<{
  toggle: [id: string]
  move: [id: string, direction: 'up' | 'down']
  reset: []
  close: []
}>()
</script>

<template>
  <div class="bc-panel" tabindex="-1">
    <div class="bc-header">
      <span class="bc-title">Personnaliser le tableau de bord</span>
      <button class="bc-reset" @click="emit('reset')">
        <RotateCcw :size="12" />
        <span>Réinitialiser</span>
      </button>
    </div>

    <div class="bc-list">
      <div
        v-for="(w, idx) in allWidgets"
        :key="w.id"
        class="bc-item"
        :class="{ 'bc-item--hidden': !isVisible(w.id) }"
      >
        <component :is="w.icon" :size="14" class="bc-item-icon" />
        <div class="bc-item-info">
          <span class="bc-item-label">{{ w.label }}</span>
          <span class="bc-item-desc">{{ w.description }}</span>
        </div>
        <div class="bc-item-controls">
          <button
            class="bc-arrow"
            :disabled="idx === 0"
            title="Monter"
            @click="emit('move', w.id, 'up')"
          >
            <ChevronUp :size="14" />
          </button>
          <button
            class="bc-arrow"
            :disabled="idx === allWidgets.length - 1"
            title="Descendre"
            @click="emit('move', w.id, 'down')"
          >
            <ChevronDown :size="14" />
          </button>
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
  </div>
</template>

<style scoped>
.bc-panel {
  background: rgba(255,255,255,.03);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.bc-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.bc-title {
  text-transform: uppercase; letter-spacing: .08em; font-size: 10px;
  font-weight: 700; color: var(--text-muted);
}
.bc-reset {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; color: var(--accent);
  background: none; border: none; cursor: pointer; font-family: var(--font);
  padding: 4px 8px; border-radius: 6px;
  transition: background .15s cubic-bezier(0.4, 0, 0.2, 1);
}
.bc-reset:hover { background: rgba(74,144,217,.08); }

.bc-list { display: flex; flex-direction: column; gap: 6px; }
.bc-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 8px;
  background: rgba(255,255,255,.02);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.bc-item:hover { background: rgba(255,255,255,.05); }
.bc-item--hidden { opacity: .45; }
.bc-item-icon { color: var(--text-muted); flex-shrink: 0; }
.bc-item-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.bc-item-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.bc-item-desc { font-size: 11px; color: var(--text-muted); }

.bc-item-controls { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.bc-arrow {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 6px;
  background: none; border: 1px solid var(--border);
  color: var(--text-muted); cursor: pointer;
  transition: all .15s cubic-bezier(0.4, 0, 0.2, 1);
}
.bc-arrow:hover:not(:disabled) { background: rgba(255,255,255,.06); color: var(--text-primary); }
.bc-arrow:disabled { opacity: .25; cursor: default; }

/* Toggle switch */
.bc-toggle { position: relative; display: inline-flex; cursor: pointer; }
.bc-toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
.bc-toggle-track {
  width: 32px; height: 18px; border-radius: 9px;
  background: rgba(255,255,255,.08);
  transition: background .2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}
.bc-toggle-track::after {
  content: '';
  position: absolute; top: 2px; left: 2px;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--text-muted);
  transition: all .2s cubic-bezier(0.4, 0, 0.2, 1);
}
.bc-toggle input:checked + .bc-toggle-track {
  background: var(--accent);
}
.bc-toggle input:checked + .bc-toggle-track::after {
  transform: translateX(14px);
  background: #fff;
}
</style>
