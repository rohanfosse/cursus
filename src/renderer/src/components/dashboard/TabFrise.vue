/**
 * Frise chronologique unifiée — tous les devoirs sur une seule ligne temporelle.
 * Couleur par projet, vue semaine/mois/trimestre/année, drag & zoom.
 */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { BarChart2, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { formatDate } from '@/utils/date'
import { typeLabel } from '@/utils/devoir'
import { parseCategoryIcon } from '@/utils/categoryIcon'
import type { FriseMilestone, FrisePromo } from '@/composables/useFrise'
import { COLORS } from '@/constants'

const props = defineProps<{
  friseOffset: number
  friseDragging: boolean
  ganttDateRange: { start: Date; end: Date } | null
  frise: FrisePromo[]
  ganttMonths: { left: number; label: string }[]
  ganttTodayPct: number
  milestoneLeft: (deadline: string) => string
  projectLineStyle: (milestones: FriseMilestone[]) => Record<string, string>
}>()

const emit = defineEmits<{
  'update:friseOffset': [val: number]
  goToProject: [key: string]
  onFriseWheel: [e: WheelEvent]
  onFriseDragStart: [e: MouseEvent]
  onFriseDragMove: [e: MouseEvent]
  onFriseDragEnd: [e: MouseEvent]
  onMilestoneClick: [ms: FriseMilestone]
  setFriseZoom: [days: number]
}>()

// ── Zoom presets ──────────────────────────────────────────────────────────
type ZoomLevel = 'semaine' | 'mois' | 'trimestre' | 'annee'
const activeZoom = ref<ZoomLevel>('mois')
const ZOOM_MAP: Record<ZoomLevel, { days: number; label: string }> = {
  semaine:   { days: 14,  label: 'Semaine' },
  mois:      { days: 30,  label: 'Mois' },
  trimestre: { days: 90,  label: 'Trimestre' },
  annee:     { days: 365, label: 'Année' },
}

function setZoom(z: ZoomLevel) {
  activeZoom.value = z
  emit('setFriseZoom', ZOOM_MAP[z].days)
}

// ── Palette de couleurs par projet ────────────────────────────────────────
const PROJECT_COLORS = [
  '#4A90D9', '#2ECC71', '#9B87F5', '#F39C12', '#E74C3C',
  '#1ABC9C', '#E67E22', '#3498DB', '#8E44AD', '#27AE60',
]

const projectColorMap = computed(() => {
  const map = new Map<string, string>()
  const allProjects = new Set<string>()
  for (const promo of props.frise) {
    for (const proj of promo.projects) allProjects.add(proj.key)
  }
  let i = 0
  for (const key of allProjects) {
    map.set(key, PROJECT_COLORS[i % PROJECT_COLORS.length])
    i++
  }
  return map
})

// ── Enriched milestones ───────────────────────────────────────────────────
type EnrichedMs = FriseMilestone & { projectKey: string; projectLabel: string; color: string }

const flatMilestones = computed((): EnrichedMs[] => {
  const all: EnrichedMs[] = []
  for (const promo of props.frise) {
    for (const proj of promo.projects) {
      const color = projectColorMap.value.get(proj.key) ?? '#4A90D9'
      for (const ms of proj.milestones) {
        all.push({ ...ms, projectKey: proj.key, projectLabel: proj.label, color })
      }
    }
  }
  return all.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
})

// ── Grouper par jour (même date = un seul point) ─────────────────────────
interface DayGroup {
  dateKey: string       // "2026-03-21"
  deadline: string      // ISO string du premier
  items: EnrichedMs[]
  mainColor: string     // couleur du premier item
  hasMultipleProjects: boolean
}

const groupedByDay = computed((): DayGroup[] => {
  const map = new Map<string, EnrichedMs[]>()
  for (const ms of flatMilestones.value) {
    const dateKey = ms.deadline.slice(0, 10) // "YYYY-MM-DD"
    if (!map.has(dateKey)) map.set(dateKey, [])
    map.get(dateKey)!.push(ms)
  }
  return Array.from(map.entries())
    .map(([dateKey, items]) => ({
      dateKey,
      deadline: items[0].deadline,
      items,
      mainColor: items[0].color,
      hasMultipleProjects: new Set(items.map(i => i.projectKey)).size > 1,
    }))
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
})

// ── Légende projets ──────────────────────────────────────────────────────
const projectLegend = computed(() => {
  const seen = new Map<string, { label: string; color: string; count: number }>()
  for (const ms of flatMilestones.value) {
    if (!seen.has(ms.projectKey)) {
      seen.set(ms.projectKey, { label: ms.projectLabel, color: ms.color, count: 0 })
    }
    seen.get(ms.projectKey)!.count++
  }
  return [...seen.values()]
})

// ── Expanded group ──────────────────────────────────────────────────────
const expandedGroup = ref<string | null>(null)

function toggleGroup(dateKey: string) {
  expandedGroup.value = expandedGroup.value === dateKey ? null : dateKey
}

// ── Dot shape ────────────────────────────────────────────────────────────
function dotClassForGroup(group: DayGroup) {
  // Losange si tous les items sont soutenance/cctl
  const allDiamond = group.items.every(ms => ms.type === 'soutenance' || ms.type === 'cctl')
  return {
    'tf-dot--diamond': allDiamond,
    'tf-dot--multi': group.items.length > 1,
  }
}
</script>

<template>
  <div class="tf">
    <!-- Toolbar -->
    <div class="tf-toolbar">
      <div class="tf-zoom-group">
        <button
          v-for="(v, k) in ZOOM_MAP" :key="k"
          class="tf-zoom-btn" :class="{ active: activeZoom === k }"
          @click="setZoom(k as ZoomLevel)"
        >{{ v.label }}</button>
      </div>
      <span class="tf-count">{{ flatMilestones.length }} devoir{{ flatMilestones.length > 1 ? 's' : '' }}</span>
      <div class="tf-nav">
        <button class="tf-nav-btn" title="Période précédente" @click="emit('update:friseOffset', friseOffset - ZOOM_MAP[activeZoom].days / 2)">
          <ChevronLeft :size="16" />
        </button>
        <button v-if="friseOffset !== 0" class="tf-nav-center" @click="emit('update:friseOffset', 0)">Aujourd'hui</button>
        <button class="tf-nav-btn" title="Période suivante" @click="emit('update:friseOffset', friseOffset + ZOOM_MAP[activeZoom].days / 2)">
          <ChevronRight :size="16" />
        </button>
      </div>
    </div>

    <!-- Empty -->
    <div v-if="!ganttDateRange || !flatMilestones.length" class="tf-empty">
      <BarChart2 :size="36" style="opacity:.2;margin-bottom:10px" />
      <p>Aucune donnée de planification disponible.</p>
    </div>

    <!-- Timeline -->
    <div
      v-else
      class="tf-timeline"
      :class="{ 'tf-grabbing': friseDragging }"
      @wheel.prevent="(e: WheelEvent) => emit('onFriseWheel', e)"
      @mousedown="(e: MouseEvent) => emit('onFriseDragStart', e)"
      @mousemove="(e: MouseEvent) => emit('onFriseDragMove', e)"
      @mouseup="(e: MouseEvent) => emit('onFriseDragEnd', e)"
      @mouseleave="(e: MouseEvent) => emit('onFriseDragEnd', e)"
    >
      <!-- Axis -->
      <div class="tf-axis">
        <div v-for="(m, i) in ganttMonths" :key="i" class="tf-month" :style="{ left: m.left + '%' }">
          {{ m.label }}
        </div>
        <div v-for="(m, i) in ganttMonths" :key="`bg${i}`" class="tf-month-bg" :class="{ even: i % 2 === 0 }"
          :style="i < ganttMonths.length - 1 ? { left: m.left + '%', width: (ganttMonths[i+1].left - m.left) + '%' } : { left: m.left + '%', right: '0' }" />
        <div v-if="ganttTodayPct >= 0 && ganttTodayPct <= 100" class="tf-today" :style="{ left: ganttTodayPct + '%' }">
          <span class="tf-today-label">Auj.</span>
        </div>
      </div>

      <!-- Single lane: grouped by day -->
      <div class="tf-lane">
        <div class="tf-lane-line" />
        <div
          v-for="(group, gi) in groupedByDay" :key="group.dateKey"
          class="tf-milestone" :class="{ 'tf-milestone--above': gi % 2 === 0, 'tf-milestone--expanded': expandedGroup === group.dateKey }"
          :style="{ left: milestoneLeft(group.deadline) }"
          @click.stop="group.items.length > 1 ? toggleGroup(group.dateKey) : emit('onMilestoneClick', group.items[0])"
        >
          <!-- Label au-dessus (index pair) -->
          <div v-if="gi % 2 === 0" class="tf-ms-labels">
            <template v-if="group.items.length === 1">
              <span class="tf-ms-label" :style="{ color: group.mainColor }">{{ typeLabel(group.items[0].type) }}</span>
            </template>
            <template v-else>
              <span class="tf-ms-label tf-ms-label--count" :style="{ color: group.mainColor }">{{ group.items.length }} devoirs</span>
            </template>
          </div>

          <!-- Point -->
          <div class="tf-dot" :class="dotClassForGroup(group)" :style="{ background: group.mainColor }">
            <span v-if="group.items.length > 1" class="tf-dot-count">{{ group.items.length }}</span>
          </div>

          <!-- Label en dessous (index impair) -->
          <div v-if="gi % 2 !== 0" class="tf-ms-labels">
            <template v-if="group.items.length === 1">
              <span class="tf-ms-label" :style="{ color: group.mainColor }">{{ typeLabel(group.items[0].type) }}</span>
            </template>
            <template v-else>
              <span class="tf-ms-label tf-ms-label--count" :style="{ color: group.mainColor }">{{ group.items.length }} devoirs</span>
            </template>
          </div>

          <!-- Expanded dropdown (quand on clique sur un groupe multi) -->
          <div v-if="expandedGroup === group.dateKey && group.items.length > 1" class="tf-group-dropdown" @click.stop>
            <div class="tf-group-date">{{ formatDate(group.deadline) }}</div>
            <button
              v-for="ms in group.items" :key="ms.id"
              class="tf-group-item"
              @click.stop="emit('onMilestoneClick', ms)"
            >
              <span class="tf-group-item-dot" :style="{ background: ms.color }" />
              <span class="tf-group-item-type">{{ typeLabel(ms.type) }}</span>
              <span class="tf-group-item-title">{{ ms.title }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Click outside to close expanded group -->
    <div v-if="expandedGroup" class="tf-backdrop" @click="expandedGroup = null" />

    <!-- Légende projets -->
    <div v-if="projectLegend.length" class="tf-legend">
      <button
        v-for="p in projectLegend" :key="p.label"
        class="tf-legend-item"
        @click="emit('goToProject', p.label)"
      >
        <span class="tf-legend-dot" :style="{ background: p.color }" />
        <span class="tf-legend-label">{{ p.label }}</span>
        <span class="tf-legend-count">{{ p.count }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tf { display: flex; flex-direction: column; gap: 12px; padding-top: 8px; }

/* ── Toolbar ─────────────────────────────────────────────────────────────── */
.tf-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 4px; gap: 8px; flex-wrap: wrap;
}
.tf-zoom-group { display: flex; gap: 0; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
.tf-zoom-btn {
  font-size: 12px; font-weight: 600; padding: 6px 14px;
  background: transparent; color: var(--text-muted);
  border: none; cursor: pointer; font-family: var(--font);
  transition: all .15s;
}
.tf-zoom-btn:hover { background: rgba(255,255,255,.05); color: var(--text-primary); }
.tf-zoom-btn.active { background: var(--accent); color: #fff; }
.tf-count { font-size: 12px; color: var(--text-muted); font-weight: 500; }
.tf-nav { display: flex; align-items: center; gap: 4px; }
.tf-nav-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 8px;
  background: rgba(255,255,255,.04); border: 1px solid var(--border);
  color: var(--text-secondary); cursor: pointer; transition: all .15s;
}
.tf-nav-btn:hover { background: rgba(255,255,255,.08); color: var(--text-primary); }
.tf-nav-center {
  font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 8px;
  background: rgba(74,144,217,.12); color: var(--accent);
  border: 1px solid rgba(74,144,217,.25); cursor: pointer; font-family: var(--font);
  transition: all .15s;
}
.tf-nav-center:hover { background: rgba(74,144,217,.2); }

/* ── Empty ────────────────────────────────────────────────────────────────── */
.tf-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 60px 20px; color: var(--text-muted); font-size: 13px; text-align: center;
}

/* ── Timeline ─────────────────────────────────────────────────────────────── */
.tf-timeline {
  border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--bg-sidebar); position: relative;
  cursor: grab; user-select: none; min-height: 120px;
}
.tf-grabbing { cursor: grabbing; }

/* Axis */
.tf-axis {
  position: relative; height: 32px;
  border-bottom: 1px solid var(--border);
}
.tf-month {
  position: absolute; top: 9px; font-size: 10px; font-weight: 600;
  color: var(--text-muted); white-space: nowrap; transform: translateX(-50%);
  pointer-events: none; letter-spacing: .3px;
}
.tf-month-bg { position: absolute; top: 0; bottom: 0; }
.tf-month-bg.even { background: rgba(255,255,255,.018); }
.tf-today {
  position: absolute; top: 0; bottom: -120px; width: 2px;
  background: rgba(74,144,217,.4); z-index: 3; pointer-events: none;
}
.tf-today-label {
  position: absolute; top: -1px; left: 50%; transform: translateX(-50%);
  font-size: 9px; font-weight: 700; color: var(--accent);
  background: var(--bg-sidebar); padding: 1px 5px; border-radius: 4px;
  white-space: nowrap;
}

/* Lane */
.tf-lane {
  position: relative; height: 100px;
  display: flex; align-items: center;
}
.tf-lane-line {
  position: absolute; left: 2%; right: 2%; top: 50%;
  height: 2px; background: rgba(255,255,255,.08); border-radius: 1px;
  transform: translateY(-50%);
}

/* Milestone container (dot + labels) */
.tf-milestone {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  cursor: pointer; z-index: 2;
}
.tf-milestone--expanded { z-index: 10; }
.tf-ms-labels { display: flex; flex-direction: column; align-items: center; gap: 1px; pointer-events: none; }
.tf-ms-label {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .3px; white-space: nowrap;
  opacity: .8; transition: opacity .15s;
}
.tf-ms-label--count { font-size: 10px; font-weight: 800; }
.tf-milestone:hover .tf-ms-label { opacity: 1; }

/* Dot */
.tf-dot {
  width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid var(--bg-sidebar); flex-shrink: 0;
  transition: transform .15s, box-shadow .15s;
  position: relative;
  display: flex; align-items: center; justify-content: center;
}
.tf-dot--multi {
  width: 20px; height: 20px; border-radius: 50%;
}
.tf-dot-count {
  font-size: 9px; font-weight: 800; color: #fff;
  line-height: 1; pointer-events: none;
}
.tf-milestone:hover .tf-dot {
  transform: scale(1.3);
  box-shadow: 0 0 0 4px rgba(255,255,255,.1);
}
.tf-dot--diamond { border-radius: 2px; transform: rotate(45deg); }
.tf-milestone:hover .tf-dot--diamond { transform: rotate(45deg) scale(1.3); }

/* Group dropdown */
.tf-group-dropdown {
  position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%);
  background: var(--bg-modal); border: 1px solid var(--border);
  border-radius: 10px; padding: 8px; min-width: 200px; max-width: 280px;
  box-shadow: var(--shadow-lg); z-index: 20;
  display: flex; flex-direction: column; gap: 4px;
  pointer-events: auto; cursor: default;
}
.tf-milestone--above .tf-group-dropdown {
  top: auto; bottom: calc(100% + 8px);
}
.tf-group-date {
  font-size: 10px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .4px;
  padding: 2px 6px 6px; border-bottom: 1px solid var(--border);
}
.tf-group-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 6px; cursor: pointer;
  background: transparent; border: none; font-family: var(--font);
  color: var(--text-primary); text-align: left;
  transition: background .12s;
}
.tf-group-item:hover { background: rgba(255,255,255,.06); }
.tf-group-item-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
}
.tf-group-item-type {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  color: var(--text-muted); min-width: 60px;
}
.tf-group-item-title {
  font-size: 12px; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Backdrop for closing dropdown */
.tf-backdrop {
  position: fixed; inset: 0; z-index: 5;
}

/* ── Légende ──────────────────────────────────────────────────────────────── */
.tf-legend {
  display: flex; gap: 6px; flex-wrap: wrap; padding: 0 4px;
}
.tf-legend-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 16px;
  background: rgba(255,255,255,.03); border: 1px solid var(--border);
  cursor: pointer; font-family: var(--font); transition: all .15s;
}
.tf-legend-item:hover { background: rgba(255,255,255,.06); border-color: var(--text-muted); }
.tf-legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.tf-legend-label { font-size: 12px; font-weight: 500; color: var(--text-secondary); }
.tf-legend-count { font-size: 11px; color: var(--text-muted); }

@media (max-width: 600px) {
  .tf-toolbar { flex-direction: column; align-items: stretch; }
  .tf-zoom-group { width: 100%; }
  .tf-zoom-btn { flex: 1; text-align: center; }
}
</style>
