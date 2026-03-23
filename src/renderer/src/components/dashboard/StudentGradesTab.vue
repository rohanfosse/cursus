/**
 * StudentGradesTab.vue
 * Full grade overview for the student dashboard "Mes notes" tab.
 * Grade pills, distribution bar, and scrollable list of all graded devoirs.
 */
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Award } from 'lucide-vue-next'
import { formatDate } from '@/utils/date'
import { parseCategoryIcon } from '@/utils/categoryIcon'

export interface GradedDevoir {
  id: number
  title: string
  note: string
  category: string | null
  feedback: string | null
  deadline: string
}

const props = defineProps<{
  gradedDevoirs: GradedDevoir[]
  modeGrade: string | null
}>()

// ── Grade distribution ──────────────────────────────────────────────────────
const GRADE_META: Record<string, { color: string; bg: string; cls: string }> = {
  A: { color: 'var(--color-success)', bg: 'rgba(39,174,96,.15)', cls: 'grade-a' },
  B: { color: 'var(--accent)',        bg: 'rgba(74,144,217,.15)', cls: 'grade-b' },
  C: { color: 'var(--color-warning)', bg: 'rgba(243,156,18,.12)', cls: 'grade-c' },
  D: { color: 'var(--color-danger)',  bg: 'rgba(231,76,60,.12)',  cls: 'grade-d' },
}

const distribution = computed(() => {
  const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 }
  for (const d of props.gradedDevoirs) {
    const key = d.note.toUpperCase()
    if (key in counts) counts[key]++
  }
  const total = Math.max(1, Object.values(counts).reduce((s, c) => s + c, 0))
  const max = Math.max(1, ...Object.values(counts))
  return Object.entries(counts).map(([label, count]) => ({
    label,
    count,
    pct: (count / max) * 100,
    barPct: (count / total) * 100,
    ...GRADE_META[label],
  }))
})

// ── Expanded feedback ────────────────────────────────────────────────────────
const expandedId = ref<number | null>(null)
function toggleExpand(id: number) {
  expandedId.value = expandedId.value === id ? null : id
}
</script>

<template>
  <div class="sgt">
    <!-- Summary row -->
    <div class="sgt-summary">
      <div class="sgt-summary-stat">
        <span class="sgt-summary-value">{{ gradedDevoirs.length }}</span>
        <span class="sgt-summary-label">NOTES</span>
      </div>
      <div class="sgt-summary-stat">
        <span class="sgt-summary-value">{{ modeGrade ?? '-' }}</span>
        <span class="sgt-summary-label">MODE</span>
      </div>
    </div>

    <!-- Grade pills -->
    <div class="sgt-pills">
      <div
        v-for="g in distribution" :key="g.label"
        class="sgt-pill" :style="{ background: g.bg, color: g.color }"
      >
        <span class="sgt-pill-letter">{{ g.label }}</span>
        <span class="sgt-pill-count">{{ g.count }}</span>
      </div>
    </div>

    <!-- Distribution bars -->
    <div class="sgt-bars">
      <div v-for="g in distribution" :key="g.label" class="sgt-bar-row">
        <span class="sgt-bar-label" :style="{ color: g.color }">{{ g.label }}</span>
        <div class="sgt-bar-track">
          <div class="sgt-bar-fill" :style="{ width: g.pct + '%', background: g.color }" />
        </div>
        <span class="sgt-bar-count">{{ g.count }}</span>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!gradedDevoirs.length" class="sgt-empty">
      <Award :size="36" style="opacity:.2;margin-bottom:10px" />
      <p>Aucune note pour le moment.</p>
    </div>

    <!-- Graded devoirs list -->
    <div v-else class="sgt-list">
      <div
        v-for="d in gradedDevoirs" :key="d.id"
        class="sgt-card"
        :class="{ 'sgt-card--expanded': expandedId === d.id }"
        @click="d.feedback ? toggleExpand(d.id) : undefined"
      >
        <div class="sgt-card-top">
          <div class="sgt-card-left">
            <span v-if="d.category" class="sgt-card-cat">{{ parseCategoryIcon(d.category).label }}</span>
            <span class="sgt-card-title">{{ d.title }}</span>
          </div>
          <span class="sgt-card-badge" :class="'sgt-badge--' + d.note.toLowerCase()">{{ d.note }}</span>
        </div>
        <div class="sgt-card-meta">
          <span class="sgt-card-date">{{ formatDate(d.deadline) }}</span>
          <span v-if="d.feedback" class="sgt-card-has-fb">feedback</span>
        </div>
        <p
          v-if="d.feedback"
          class="sgt-card-feedback"
          :class="{ 'sgt-card-feedback--clamped': expandedId !== d.id }"
        >{{ d.feedback }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sgt { display: flex; flex-direction: column; gap: 16px; padding-top: 10px; }

/* ── Summary ── */
.sgt-summary {
  display: flex; gap: 16px; align-items: center;
}
.sgt-summary-stat {
  display: flex; align-items: baseline; gap: 6px;
}
.sgt-summary-value {
  font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace;
  font-size: 22px; font-weight: 800; color: var(--text-primary);
}
.sgt-summary-label {
  font-size: 10px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .5px;
}

/* ── Pills ── */
.sgt-pills { display: flex; gap: 8px; }
.sgt-pill {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 20px;
  font-weight: 700;
}
.sgt-pill-letter {
  font-size: 13px; font-weight: 800;
}
.sgt-pill-count {
  font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace;
  font-size: 12px; font-weight: 700;
}

/* ── Distribution bars ── */
.sgt-bars { display: flex; flex-direction: column; gap: 6px; }
.sgt-bar-row { display: flex; align-items: center; gap: 8px; }
.sgt-bar-label {
  font-size: 12px; font-weight: 800; width: 20px; text-align: center;
}
.sgt-bar-track {
  flex: 1; height: 8px; border-radius: 4px;
  background: var(--bg-hover);
}
.sgt-bar-fill {
  height: 100%; border-radius: 4px;
  transition: width .3s cubic-bezier(.4, 0, .2, 1);
}
.sgt-bar-count {
  font-family: 'JetBrains Mono', 'SF Mono', 'Cascadia Code', monospace;
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  width: 20px; text-align: right;
}

/* ── Empty ── */
.sgt-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 60px 20px; color: var(--text-muted); font-size: 13px; text-align: center;
}

/* ── Card list ── */
.sgt-list { display: flex; flex-direction: column; gap: 8px; }
.sgt-card {
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 10px; padding: 12px 14px;
  transition: background .15s cubic-bezier(.4, 0, .2, 1), border-color .15s cubic-bezier(.4, 0, .2, 1);
}
.sgt-card:hover { background: var(--bg-elevated); }
.sgt-card--expanded { border-color: rgba(74,144,217,.25); }

.sgt-card-top {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
}
.sgt-card-left {
  display: flex; align-items: center; gap: 8px; min-width: 0; flex: 1;
}
.sgt-card-cat {
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px;
  padding: 2px 7px; border-radius: 4px;
  background: var(--bg-hover); color: var(--text-muted);
  white-space: nowrap; flex-shrink: 0;
}
.sgt-card-title {
  font-size: 13px; font-weight: 600; color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sgt-card-badge {
  font-size: 12px; font-weight: 800; padding: 3px 10px; border-radius: 6px;
  flex-shrink: 0;
}
.sgt-badge--a { background: rgba(39,174,96,.15); color: var(--color-success); }
.sgt-badge--b { background: rgba(74,144,217,.15); color: var(--accent); }
.sgt-badge--c { background: rgba(243,156,18,.12); color: var(--color-warning); }
.sgt-badge--d { background: rgba(231,76,60,.12); color: var(--color-danger); }

.sgt-card-meta {
  display: flex; align-items: center; gap: 8px; margin-top: 4px;
}
.sgt-card-date {
  font-size: 11px; color: var(--text-muted);
}
.sgt-card-has-fb {
  font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px;
  color: var(--accent); cursor: pointer;
}

.sgt-card-feedback {
  font-size: 12px; color: var(--text-secondary); line-height: 1.5;
  margin: 6px 0 0; font-style: italic;
  transition: max-height .25s cubic-bezier(.4, 0, .2, 1);
}
.sgt-card-feedback--clamped {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}

@media (max-width: 600px) {
  .sgt-pills { flex-wrap: wrap; }
  .sgt-card-left { flex-direction: column; align-items: flex-start; gap: 2px; }
}
</style>
