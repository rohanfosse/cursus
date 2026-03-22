/**
 * StudentStatsCards.vue
 * Displays recent grades row and 4 stat cards: pending, submitted,
 * graded, and most frequent grade.
 */
<script setup lang="ts">
import { computed } from 'vue'
import { Clock, CheckCircle2, Award, TrendingUp, TrendingDown, Minus, MessageSquare } from 'lucide-vue-next'

const props = defineProps<{
  studentStats: { pending: number; submitted: number; graded: number; modeGrade: string | null }
  recentGrades: { title: string; note: string }[]
  recentFeedback?: { title: string; feedback: string; note: string | null; category: string | null }[]
}>()

const emit = defineEmits<{ 'navigate-project': [category: string] }>()

const gradeTrend = computed(() => {
  const grades = props.recentGrades.map(g => g.note.toUpperCase())
  if (grades.length < 2) return 'neutral'
  const rank: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 }
  const last = rank[grades[0]] ?? 0
  const prev = rank[grades[1]] ?? 0
  if (last > prev) return 'up'
  if (last < prev) return 'down'
  return 'neutral'
})
</script>

<template>
  <!-- Dernières notes reçues -->
  <div v-if="recentGrades.length" class="db-recent-grades">
    <h4 class="db-urgent-title"><Award :size="14" /> Dernières notes</h4>
    <div class="db-recent-grades-list">
      <div v-for="g in recentGrades" :key="g.title" class="db-recent-grade-item">
        <span class="db-grade-badge" :class="'grade-' + g.note.toLowerCase()">{{ g.note }}</span>
        <span class="db-recent-grade-title">{{ g.title }}</span>
      </div>
    </div>
  </div>

  <!-- Dernier feedback -->
  <div v-if="recentFeedback?.length" class="db-recent-feedback">
    <h4 class="db-urgent-title"><MessageSquare :size="14" /> Dernier feedback</h4>
    <div class="db-feedback-list">
      <div
        v-for="f in recentFeedback"
        :key="f.title"
        class="db-feedback-card"
        :class="{ 'db-feedback-clickable': !!f.category }"
        @click="f.category && emit('navigate-project', f.category)"
      >
        <div class="db-feedback-top">
          <span class="db-feedback-title">{{ f.title }}</span>
          <span v-if="f.note" class="db-grade-badge" :class="'grade-' + f.note.toLowerCase()">{{ f.note }}</span>
        </div>
        <p class="db-feedback-text">{{ f.feedback }}</p>
      </div>
    </div>
  </div>

  <!-- Stats étudiant -->
  <div class="db-stats">
    <div class="db-stat-card db-stat-warning">
      <span class="db-stat-value">{{ studentStats.pending }}</span>
      <span class="db-stat-label">À rendre</span>
      <Clock :size="18" class="db-stat-icon" />
    </div>
    <div class="db-stat-card db-stat-accent">
      <span class="db-stat-value">{{ studentStats.submitted }}</span>
      <span class="db-stat-label">Rendus déposés</span>
      <CheckCircle2 :size="18" class="db-stat-icon" />
    </div>
    <div class="db-stat-card db-stat-success">
      <span class="db-stat-value">{{ studentStats.graded }}</span>
      <span class="db-stat-label">Devoirs notés</span>
      <Award :size="18" class="db-stat-icon" />
    </div>
    <div class="db-stat-card db-stat-neutral" title="La note que vous obtenez le plus souvent parmi vos devoirs notés">
      <span class="db-stat-value">
        {{ studentStats.modeGrade ?? '-' }}
        <TrendingUp v-if="gradeTrend === 'up'" :size="14" class="trend-arrow trend-up" />
        <TrendingDown v-else-if="gradeTrend === 'down'" :size="14" class="trend-arrow trend-down" />
        <Minus v-else :size="14" class="trend-arrow trend-neutral" />
      </span>
      <span class="db-stat-label">Note fréquente</span>
      <TrendingUp :size="18" class="db-stat-icon" />
    </div>
  </div>
</template>

<style scoped>
.db-urgent-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px;
}
.db-recent-grades { margin-bottom: 16px; }
.db-recent-grades-list { display: flex; gap: 8px; flex-wrap: wrap; }
.db-recent-grade-item {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 8px;
  background: rgba(255,255,255,.03); font-size: 13px;
}
.db-recent-grade-title { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
.db-grade-badge { font-size: 12px; font-weight: 800; padding: 2px 8px; border-radius: 6px; }
.db-grade-badge.grade-a { background: rgba(39,174,96,.15); color: var(--color-success); }
.db-grade-badge.grade-b { background: rgba(74,144,217,.15); color: var(--accent); }
.db-grade-badge.grade-c { background: rgba(243,156,18,.12); color: var(--color-warning); }
.db-grade-badge.grade-d { background: rgba(231,76,60,.12); color: var(--color-danger); }

/* ── Feedback cards ── */
.db-recent-feedback { margin-bottom: 16px; }
.db-feedback-list { display: flex; gap: 8px; flex-wrap: wrap; }
.db-feedback-card {
  display: flex; flex-direction: column; gap: 4px;
  padding: 8px 10px; border-radius: 8px;
  background: rgba(255,255,255,.03); border: 1px solid var(--border);
  min-width: 180px; max-width: 280px; flex: 1;
}
.db-feedback-clickable { cursor: pointer; transition: background var(--t-fast); }
.db-feedback-clickable:hover { background: var(--bg-hover); }
.db-feedback-top { display: flex; align-items: center; gap: 6px; }
.db-feedback-title {
  flex: 1; font-size: 12px; font-weight: 600; color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.db-feedback-text {
  font-size: 11.5px; color: var(--text-secondary); font-style: italic;
  margin: 0; line-height: 1.4;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

/* ── Stats grid ── */
.db-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
@media (max-width: 900px) { .db-stats { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 480px) { .db-stats { grid-template-columns: repeat(2, 1fr); gap: 8px; } .db-stat-card { padding: 14px 14px; } }
@media (max-width: 360px) { .db-stats { grid-template-columns: 1fr; } }
.trend-arrow { vertical-align: middle; margin-left: 4px; }
.trend-up { color: var(--color-success); }
.trend-down { color: var(--color-danger); }
.trend-neutral { color: var(--text-muted); opacity: .5; }
.db-stat-card {
  position: relative; border-radius: 10px; padding: 16px 18px;
  border: 1px solid var(--border); background: var(--bg-sidebar);
  display: flex; flex-direction: column; gap: 4px; overflow: hidden;
}
.db-stat-value { font-size: 28px; font-weight: 800; line-height: 1; }
.db-stat-label { font-size: 11.5px; color: var(--text-secondary); }
.db-stat-icon  { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); opacity: .18; }
.db-stat-warning { border-color: rgba(243,156,18,.2); }
.db-stat-warning .db-stat-value { color: var(--color-warning); }
.db-stat-warning .db-stat-icon  { color: var(--color-warning); opacity: .3; }
.db-stat-accent  { border-color: rgba(74,144,217,.2); }
.db-stat-accent  .db-stat-value { color: var(--accent-light); }
.db-stat-accent  .db-stat-icon  { color: var(--accent); opacity: .3; }
.db-stat-success { border-color: rgba(39,174,96,.2); }
.db-stat-success .db-stat-value { color: var(--color-success); }
.db-stat-success .db-stat-icon  { color: var(--color-success); opacity: .3; }
.db-stat-neutral .db-stat-value { color: var(--text-primary); }
</style>
