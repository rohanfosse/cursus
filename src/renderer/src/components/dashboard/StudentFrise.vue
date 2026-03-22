/**
 * StudentFrise.vue
 * Timeline / Frise chronologique for the student dashboard,
 * with drag, zoom, and milestone display — same pattern as TabFrise.
 */
<script setup lang="ts">
import { BarChart2, ChevronRight } from 'lucide-vue-next'
import { formatDate } from '@/utils/date'
import type { FriseMilestone, FrisePromo } from '@/composables/useFrise'

defineProps<{
  friseDragging: boolean
  ganttDateRange: { start: Date; end: Date } | null
  frise: FrisePromo[]
  ganttMonths: { left: number; label: string }[]
  ganttTodayPct: number
  milestoneLeft: (deadline: string) => string
  projectLineStyle: (milestones: FriseMilestone[]) => Record<string, string>
}>()

const emit = defineEmits<{
  goToProject: [key: string]
  onFriseWheel: [e: WheelEvent]
  onFriseDragStart: [e: MouseEvent]
  onFriseDragMove: [e: MouseEvent]
  onFriseDragEnd: [e: MouseEvent]
  onMilestoneClick: [ms: FriseMilestone]
}>()
</script>

<template>
  <div class="db-tab-content db-frise-outer">
    <div v-if="!ganttDateRange || !frise.length" class="db-empty-hint">
      <BarChart2 :size="36" style="opacity:.2;margin-bottom:10px" />
      <p>Aucune donnée de planification disponible.</p>
    </div>
    <div
      v-else
      class="frise-wrap frise-interactive"
      :class="{ 'frise-grabbing': friseDragging }"
      @wheel.prevent="(e: WheelEvent) => emit('onFriseWheel', e)"
      @mousedown="(e: MouseEvent) => emit('onFriseDragStart', e)"
      @mousemove="(e: MouseEvent) => emit('onFriseDragMove', e)"
      @mouseup="(e: MouseEvent) => emit('onFriseDragEnd', e)"
      @mouseleave="(e: MouseEvent) => emit('onFriseDragEnd', e)"
    >
      <div class="frise-axis-row">
        <div class="frise-label-col frise-axis-label">Projet</div>
        <div class="frise-bar-col frise-axis-months">
          <div v-for="(m, i) in ganttMonths" :key="i" class="frise-month-tick" :style="{ left: m.left + '%' }">{{ m.label }}</div>
          <div v-for="(m, i) in ganttMonths" :key="`bg${i}`" class="frise-month-bg" :class="{ even: i % 2 === 0 }"
            :style="i < ganttMonths.length - 1 ? { left: m.left + '%', width: (ganttMonths[i+1].left - m.left) + '%' } : { left: m.left + '%', right: '0' }" />
          <div v-if="ganttTodayPct >= 0 && ganttTodayPct <= 100" class="frise-today" :style="{ left: ganttTodayPct + '%' }" />
        </div>
      </div>
      <div v-for="promo in frise" :key="promo.name" class="frise-promo">
        <div class="frise-promo-heading">
          <div class="frise-label-col frise-promo-label-col">
            <span class="frise-promo-dot" :style="{ background: promo.color }" />
            <span class="frise-promo-name">{{ promo.name }}</span>
          </div>
          <div class="frise-bar-col frise-promo-bar-col" />
        </div>
        <div v-for="proj in promo.projects" :key="proj.key" class="frise-row" @click="emit('goToProject', proj.key)">
          <div class="frise-label-col frise-project-label">
            <component :is="proj.icon" v-if="proj.icon" :size="11" class="frise-project-icon" />
            <span>{{ proj.label }}</span>
            <ChevronRight :size="10" class="frise-project-arrow" />
          </div>
          <div class="frise-bar-col frise-timeline">
            <div class="frise-proj-line" :style="projectLineStyle(proj.milestones)" />
            <div v-if="ganttTodayPct >= 0 && ganttTodayPct <= 100" class="frise-today" :style="{ left: ganttTodayPct + '%' }" />
            <div
              v-for="(ms, mi) in proj.milestones"
              :key="ms.id"
              class="frise-milestone"
              :class="[`frise-ms-${ms.type}`, { 'frise-ms-done': ms.done, 'frise-ms-draft': !ms.published, 'frise-ms-above': mi % 2 === 0 }]"
              :style="{ left: milestoneLeft(ms.deadline) }"
              :title="`${ms.title} — ${formatDate(ms.deadline)}`"
              @click.stop="emit('onMilestoneClick', ms)"
            >
              <div v-if="mi % 2 === 0" class="frise-ms-label">
                <span class="frise-ms-title">{{ ms.title }}</span>
                <span class="frise-ms-date">{{ formatDate(ms.deadline) }}</span>
              </div>
              <div class="frise-ms-dot" />
              <div v-if="mi % 2 !== 0" class="frise-ms-label">
                <span class="frise-ms-title">{{ ms.title }}</span>
                <span class="frise-ms-date">{{ formatDate(ms.deadline) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.db-tab-content { display: flex; flex-direction: column; gap: 0; }
.db-empty-hint {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 60px 20px; color: var(--text-muted); font-size: 13px; text-align: center; gap: 6px;
}
.db-empty-hint :deep(svg) { opacity: .3; }

.db-frise-outer { flex: 1; min-height: 0; overflow: hidden; padding-top: 12px; }
.frise-wrap {
  overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 340px);
  border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--bg-sidebar); min-width: 0;
}
.frise-label-col {
  width: 180px; min-width: 180px; flex-shrink: 0;
  position: sticky; left: 0; background: var(--bg-sidebar);
  z-index: 2; border-right: 1px solid var(--border);
}
.frise-bar-col { flex: 1; position: relative; overflow: hidden; }
.frise-axis-row {
  display: flex; align-items: stretch; border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 4; background: var(--bg-sidebar);
}
.frise-axis-label {
  display: flex; align-items: center; padding: 0 12px;
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .5px; color: var(--text-muted); height: 32px; z-index: 5;
}
.frise-axis-months { height: 32px; position: relative; }
.frise-month-tick {
  position: absolute; top: 8px; font-size: 10px; font-weight: 600;
  color: var(--text-muted); white-space: nowrap; transform: translateX(-50%);
  pointer-events: none; letter-spacing: .3px;
}
.frise-month-bg { position: absolute; top: 0; bottom: 0; }
.frise-month-bg.even { background: rgba(255,255,255,.018); }
.frise-today {
  position: absolute; top: 0; bottom: 0; width: 1.5px;
  background: rgba(74,144,217,.55); z-index: 1; pointer-events: none;
}
.frise-promo-heading { display: flex; align-items: stretch; border-bottom: 1px solid var(--border); }
.frise-promo-label-col {
  display: flex; align-items: center; gap: 8px; padding: 7px 12px;
  font-size: 10.5px; font-weight: 800; text-transform: uppercase;
  letter-spacing: .4px; color: var(--text-secondary);
}
.frise-promo-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; box-shadow: 0 0 6px currentColor; }
.frise-promo-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.frise-promo-bar-col { background: rgba(255,255,255,.015); }
.frise-row {
  display: flex; align-items: stretch; height: 96px;
  border-bottom: 1px solid rgba(255,255,255,.04);
  cursor: pointer; transition: background var(--t-fast); min-width: 700px;
}
.frise-row:hover { background: rgba(74,144,217,.04); }
.frise-row:hover .frise-label-col { background: rgba(74,144,217,.06); }
.frise-project-label {
  display: flex; align-items: center; gap: 7px; padding: 0 10px 0 14px;
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  cursor: pointer; transition: color var(--t-fast);
}
.frise-row:hover .frise-project-label { color: var(--accent-light); }
.frise-project-icon { color: var(--accent); flex-shrink: 0; }
.frise-project-label > span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.frise-project-arrow { color: var(--text-muted); flex-shrink: 0; transition: transform var(--t-fast), color var(--t-fast); }
.frise-row:hover .frise-project-arrow { transform: translateX(2px); color: var(--accent); }
.frise-timeline { position: relative; }
.frise-proj-line {
  position: absolute; top: 50%; height: 2px; transform: translateY(-50%);
  background: rgba(255,255,255,.12); border-radius: 1px; pointer-events: none;
}
.frise-milestone {
  position: absolute; top: 50%; transform: translate(-50%, -50%);
  display: flex; flex-direction: column; align-items: center;
  cursor: pointer; z-index: 2; transition: transform var(--t-fast);
}
.frise-milestone:hover { transform: translate(-50%, -50%) scale(1.15); }
.frise-ms-dot {
  width: 10px; height: 10px; border-radius: 50%;
  border: 2px solid var(--bg-sidebar); flex-shrink: 0; transition: box-shadow var(--t-fast);
}
.frise-milestone:hover .frise-ms-dot { box-shadow: 0 0 0 3px rgba(255,255,255,.15); }
.frise-ms-soutenance .frise-ms-dot,
.frise-ms-cctl .frise-ms-dot { border-radius: 2px; transform: rotate(45deg); }
.frise-ms-livrable .frise-ms-dot     { background: var(--accent); }
.frise-ms-soutenance .frise-ms-dot   { background: var(--color-warning); }
.frise-ms-cctl .frise-ms-dot         { background: var(--color-cctl); }
.frise-ms-etude_de_cas .frise-ms-dot { background: var(--color-success); }
.frise-ms-memoire .frise-ms-dot      { background: var(--color-danger); }
.frise-ms-autre .frise-ms-dot        { background: var(--color-autre); }
.frise-ms-draft .frise-ms-dot { opacity: .35; }
.frise-ms-done .frise-ms-dot { filter: brightness(1.2); box-shadow: 0 0 0 2px rgba(255,255,255,.2); }
.frise-ms-label {
  display: flex; flex-direction: column; align-items: center;
  gap: 1px; pointer-events: none; white-space: nowrap;
}
.frise-ms-above .frise-ms-label { margin-bottom: 5px; }
.frise-milestone:not(.frise-ms-above) .frise-ms-label { margin-top: 5px; }
.frise-ms-title {
  font-size: 9.5px; font-weight: 700; color: var(--text-secondary);
  max-width: 90px; overflow: hidden; text-overflow: ellipsis; text-align: center;
}
.frise-ms-date { font-size: 8.5px; color: var(--text-muted); font-weight: 500; }
.frise-interactive { cursor: grab; user-select: none; }
.frise-grabbing    { cursor: grabbing; }
</style>
