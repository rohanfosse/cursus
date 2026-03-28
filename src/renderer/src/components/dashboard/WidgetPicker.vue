/**
 * WidgetPicker.vue - Picker visuel de widgets par categorie + presets de layout.
 * Icones SVG Lucide (pas d'emojis), categories filtrees, selecteur de taille,
 * et section presets integree en haut.
 */
<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  X, Plus, Minus, RotateCcw, Grid3X3, LayoutGrid,
  Zap, MessageCircle, BarChart3, Wrench, Sparkles,
} from 'lucide-vue-next'
import { SIZE_LABELS } from '@/types/widgets'
import type { WidgetDef, WidgetSize, WidgetCategory } from '@/types/widgets'
import type { LayoutPreset } from '@/composables/useWidgetPresets'

const props = defineProps<{
  widgets: WidgetDef[]
  isVisible: (id: string) => boolean
  getSize: (id: string) => WidgetSize
  presets?: LayoutPreset[]
  activePreset?: string | null
}>()

const emit = defineEmits<{
  toggle: [id: string]
  resize: [id: string, size: WidgetSize]
  applyPreset: [preset: LayoutPreset]
  reset: []
  close: []
}>()

const CATEGORY_META: Record<WidgetCategory, { label: string; icon: typeof Zap }> = {
  essential:     { label: 'Essentiel',     icon: Zap },
  communication: { label: 'Communication', icon: MessageCircle },
  tracking:      { label: 'Suivi',         icon: BarChart3 },
  productivity:  { label: 'Productivite',  icon: Wrench },
  fun:           { label: 'Fun',           icon: Sparkles },
}

const CATEGORY_ORDER: WidgetCategory[] = ['essential', 'communication', 'tracking', 'productivity', 'fun']

type Tab = 'presets' | 'all' | WidgetCategory
const activeTab = ref<Tab>(props.presets?.length ? 'presets' : 'all')

const filteredWidgets = computed(() => {
  if (activeTab.value === 'presets') return []
  if (activeTab.value === 'all') return props.widgets
  return props.widgets.filter(w => w.category === activeTab.value)
})

const categoryCounts = computed(() => {
  const counts: Record<string, number> = { all: props.widgets.length }
  for (const cat of CATEGORY_ORDER) {
    counts[cat] = props.widgets.filter(w => w.category === cat).length
  }
  return counts
})

const enabledCount = computed(() => props.widgets.filter(w => props.isVisible(w.id)).length)
</script>

<template>
  <div class="wp-panel">
    <!-- Header -->
    <div class="wp-header">
      <div class="wp-header-left">
        <Grid3X3 :size="16" />
        <h3 class="wp-title">Widgets</h3>
        <span class="wp-count">{{ enabledCount }}/{{ widgets.length }}</span>
      </div>
      <div class="wp-header-right">
        <button class="wp-icon-btn" title="Reinitialiser" @click="emit('reset')">
          <RotateCcw :size="13" />
        </button>
        <button class="wp-icon-btn" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="wp-tabs">
      <button
        v-if="presets?.length"
        class="wp-tab"
        :class="{ active: activeTab === 'presets' }"
        @click="activeTab = 'presets'"
      >
        <LayoutGrid :size="12" /> Presets
      </button>
      <button
        class="wp-tab"
        :class="{ active: activeTab === 'all' }"
        @click="activeTab = 'all'"
      >
        Tous <span class="wp-tab-count">{{ categoryCounts.all }}</span>
      </button>
      <button
        v-for="cat in CATEGORY_ORDER"
        :key="cat"
        class="wp-tab"
        :class="{ active: activeTab === cat }"
        @click="activeTab = cat"
      >
        <component :is="CATEGORY_META[cat].icon" :size="12" />
        {{ CATEGORY_META[cat].label }}
        <span class="wp-tab-count">{{ categoryCounts[cat] }}</span>
      </button>
    </div>

    <!-- Presets section -->
    <div v-if="activeTab === 'presets' && presets?.length" class="wp-presets">
      <div
        v-for="p in presets"
        :key="p.id"
        class="wp-preset-card"
        :class="{ 'wp-preset-card--active': activePreset === p.id }"
        @click="emit('applyPreset', p)"
      >
        <div class="wp-preset-icon">
          <LayoutGrid :size="18" />
        </div>
        <div class="wp-preset-info">
          <span class="wp-preset-label">{{ p.label }}</span>
          <span class="wp-preset-desc">{{ p.description }}</span>
        </div>
        <span v-if="activePreset === p.id" class="wp-preset-badge">Actif</span>
      </div>
    </div>

    <!-- Widget list -->
    <div v-if="activeTab !== 'presets'" class="wp-list">
      <div
        v-for="w in filteredWidgets"
        :key="w.id"
        class="wp-card"
        :class="{ 'wp-card--active': isVisible(w.id), 'wp-card--inactive': !isVisible(w.id) }"
      >
        <div class="wp-card-header">
          <div class="wp-card-icon" :class="'wp-cat-' + w.category">
            <component :is="w.icon" :size="16" />
          </div>
          <div class="wp-card-info">
            <span class="wp-card-label">{{ w.label }}</span>
            <span class="wp-card-desc">{{ w.description }}</span>
          </div>
          <button
            class="wp-card-toggle"
            :class="{ 'wp-card-toggle--remove': isVisible(w.id) }"
            :aria-label="isVisible(w.id) ? 'Retirer ' + w.label : 'Ajouter ' + w.label"
            @click="emit('toggle', w.id)"
          >
            <Minus v-if="isVisible(w.id)" :size="14" />
            <Plus v-else :size="14" />
          </button>
        </div>

        <!-- Size selector -->
        <div v-if="isVisible(w.id) && w.sizes.length > 1" class="wp-sizes">
          <button
            v-for="s in w.sizes"
            :key="s"
            class="wp-size-btn"
            :class="{ active: getSize(w.id) === s }"
            :aria-label="SIZE_LABELS[s]"
            @click="emit('resize', w.id, s)"
          >
            {{ SIZE_LABELS[s] }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wp-panel {
  background: var(--bg-modal, var(--bg-elevated));
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 600px;
}

/* ── Header ── */
.wp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
}
.wp-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-primary);
}
.wp-header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.wp-title {
  font-size: 14px;
  font-weight: 700;
  margin: 0;
}
.wp-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 2px 7px;
  border-radius: 8px;
}
.wp-icon-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  transition: all 0.12s;
}
.wp-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* ── Tabs ── */
.wp-tabs {
  display: flex;
  gap: 2px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
}
.wp-tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 8px;
  border: none;
  background: none;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.12s;
}
.wp-tab:hover { background: var(--bg-hover); color: var(--text-secondary); }
.wp-tab.active { background: rgba(74, 144, 217, 0.12); color: var(--accent); }
.wp-tab-count {
  font-size: 10px;
  font-weight: 700;
  opacity: 0.5;
}

/* ── Presets ── */
.wp-presets {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}
.wp-preset-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.wp-preset-card:hover {
  background: var(--bg-hover);
  border-color: rgba(74, 144, 217, 0.2);
}
.wp-preset-card--active {
  background: rgba(74, 144, 217, 0.08);
  border-color: var(--accent);
}
.wp-preset-icon {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: rgba(74, 144, 217, 0.12);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wp-preset-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.wp-preset-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.wp-preset-desc {
  font-size: 11px;
  color: var(--text-muted);
}
.wp-preset-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  background: rgba(74, 144, 217, 0.12);
  padding: 2px 8px;
  border-radius: 6px;
  flex-shrink: 0;
}

/* ── Widget list ── */
.wp-list {
  overflow-y: auto;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ── Widget card ── */
.wp-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  transition: all 0.15s ease;
}
.wp-card--active {
  background: var(--bg-elevated, rgba(255, 255, 255, 0.04));
}
.wp-card--inactive {
  opacity: 0.5;
}
.wp-card--inactive:hover {
  opacity: 0.75;
}

.wp-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.wp-card-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wp-cat-essential     { background: rgba(74, 144, 217, 0.15); color: var(--accent); }
.wp-cat-communication { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
.wp-cat-tracking      { background: rgba(34, 197, 94, 0.15);  color: #22c55e; }
.wp-cat-productivity  { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.wp-cat-fun           { background: rgba(236, 72, 153, 0.15); color: #ec4899; }

.wp-card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.wp-card-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.wp-card-desc {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wp-card-toggle {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.12s;
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}
.wp-card-toggle--remove {
  background: rgba(231, 76, 60, 0.1);
  color: #e74c3c;
}
.wp-card-toggle:hover {
  filter: brightness(1.15);
}

/* ── Size selector ── */
.wp-sizes {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}
.wp-size-btn {
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-muted);
  font-size: 10.5px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  transition: all 0.12s;
}
.wp-size-btn:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}
.wp-size-btn.active {
  background: rgba(74, 144, 217, 0.12);
  border-color: var(--accent);
  color: var(--accent);
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .wp-preset-card,
  .wp-card,
  .wp-card-toggle,
  .wp-size-btn {
    transition: none;
  }
}
</style>
