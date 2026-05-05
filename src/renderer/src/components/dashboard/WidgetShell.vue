<script setup lang="ts">
import { computed } from 'vue'
import { GripVertical, Maximize2 } from 'lucide-vue-next'
import { sizeToGridSpan, SIZE_LABELS } from '@/types/widgets'
import type { WidgetSize } from '@/types/widgets'

const props = defineProps<{
  widgetId: string
  size: WidgetSize
  editing?: boolean
  sizes?: WidgetSize[]
}>()

const emit = defineEmits<{
  resize: [size: WidgetSize]
}>()

const gridStyle = computed(() => {
  const { colSpan, rowSpan } = sizeToGridSpan(props.size)
  return {
    gridColumn: `span ${colSpan}`,
    gridRow: `span ${rowSpan}`,
  }
})

const isCompact = computed(() => props.size === '1x1')
const isLarge = computed(() => props.size === '2x2' || props.size === '4x1')

function cycleSize() {
  if (!props.sizes || props.sizes.length <= 1) return
  const idx = props.sizes.indexOf(props.size)
  const next = props.sizes[(idx + 1) % props.sizes.length]
  emit('resize', next)
}
</script>

<template>
  <div
    class="ws-shell"
    :class="[
      editing && 'ws-shell--editing',
      `ws-shell--${size}`,
      isLarge && 'ws-shell--elevated',
    ]"
    :style="gridStyle"
  >
    <!-- Drag handle (visible en mode edit) -->
    <div v-if="editing" class="ws-drag-handle" title="Glisser pour deplacer">
      <GripVertical :size="14" />
    </div>

    <!-- Resize button (visible au hover en mode edit) -->
    <button
      v-if="editing && sizes && sizes.length > 1"
      class="ws-resize-btn"
      :title="`Taille: ${SIZE_LABELS[size]} — Cliquer pour changer`"
      @click.stop="cycleSize"
    >
      <Maximize2 :size="11" />
      <span>{{ SIZE_LABELS[size] }}</span>
    </button>

    <!-- Contenu du widget via slot -->
    <slot :current-size="size" :is-compact="isCompact" :is-large="isLarge" />
  </div>
</template>

<style scoped>
/* ── Shell base ── */
.ws-shell {
  position: relative;
  min-height: 0;
  /* v2.278 : --radius-bento (24px) matche les .bento-card landing.
     Distinct du --radius-lg (20px) utilise pour modals/cards generiques. */
  border-radius: var(--radius-bento);
  /* Animation fluide lors du resize (Fix #2) */
  transition:
    grid-column 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    grid-row 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow var(--motion-base) var(--ease-out),
    transform var(--motion-base) var(--ease-out);
}
/* v2.278 : propage le radius bento aux UiCard internes des widgets pour
   matcher la signature .bento-card landing. UiCard reste a 20px hors
   bento (modals, cards generiques). */
.ws-shell :deep(.ui-card) {
  border-radius: var(--radius-bento);
  height: 100%;
}

/* ── Hierarchie visuelle par taille (Fix #4) ── */
.ws-shell--1x1 {
  /* Compact : pas d'elevation supplementaire */
}
.ws-shell--2x1 {
  /* Moyen : legere elevation */
}
.ws-shell--elevated {
  /* Grand (2x2, 4x1) : elevation plus marquee */
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

/* ── Mode edit ── */
.ws-shell--editing {
  border: 2px dashed transparent;
  cursor: grab;
  transition:
    border-color var(--motion-fast) var(--ease-out),
    grid-column 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    grid-row 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow var(--motion-base) var(--ease-out),
    transform var(--motion-base) var(--ease-out);
}
.ws-shell--editing:hover {
  border-color: rgba(var(--accent-rgb),0.3);
}
.ws-shell--editing:active {
  cursor: grabbing;
  transform: scale(0.98);
}

/* ── Drag handle (Fix #1) ── */
.ws-drag-handle {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  background: rgba(17, 18, 20, 0.75);
  backdrop-filter: blur(8px);
  color: var(--text-muted);
  cursor: grab;
  opacity: 0;
  transition: opacity var(--motion-fast) var(--ease-out), color 0.1s;
}
.ws-shell--editing:hover .ws-drag-handle {
  opacity: 0.7;
}
.ws-drag-handle:hover {
  opacity: 1 !important;
  color: var(--text-primary);
  background: rgba(var(--accent-rgb),0.15);
}
.ws-drag-handle:active {
  cursor: grabbing;
}

/* ── Resize button ── */
.ws-resize-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(var(--accent-rgb),0.3);
  background: rgba(17, 18, 20, 0.85);
  backdrop-filter: blur(8px);
  color: var(--accent, #4a90d9);
  font-size: 10px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--motion-fast) var(--ease-out), background 0.1s;
}
.ws-shell--editing:hover .ws-resize-btn,
.ws-resize-btn:focus-visible {
  opacity: 1;
}
.ws-resize-btn:hover {
  background: rgba(var(--accent-rgb),0.15);
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .ws-shell,
  .ws-shell--editing {
    transition: none;
  }
}
</style>
