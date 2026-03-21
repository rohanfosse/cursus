/**
 * TabAnalytique.vue
 * ---------------------------------------------------------------------------
 * Analytics tab: quick stats, grade distribution, submission rates,
 * and 7-day submission trend chart.
 */
<script setup lang="ts">
import { ref } from 'vue'
import { Award, CheckCircle2, TrendingUp } from 'lucide-vue-next'
import { GRADE_COLORS } from '@/composables/useTeacherAnalytics'

defineProps<{
  analyticsStats: { total: number; graded: number; notGraded: number }
  gradeDistribution: { label: string; pct: number; color: string; count: number }[]
  submissionRates: { title: string; rate: number }[]
  globalModeGrade: string | null
  onlineUsersCount: number
  submissionTrend: { days: { label: string; count: number }[]; maxCount: number }
}>()

const emit = defineEmits<{
  'update:analyticsRange': [range: '7d' | '30d' | 'all']
}>()

const timeRange = ref<'7d' | '30d' | 'all'>('all')

function setRange(range: '7d' | '30d' | 'all') {
  timeRange.value = range
  emit('update:analyticsRange', range)
}
</script>

<template>
  <div class="db-tab-content">
    <div class="analytics-grid">

      <!-- Sélecteur de période -->
      <div class="analytics-range-row">
        <button class="analytics-range-btn" :class="{ active: timeRange === '7d' }" @click="setRange('7d')">7 jours</button>
        <button class="analytics-range-btn" :class="{ active: timeRange === '30d' }" @click="setRange('30d')">30 jours</button>
        <button class="analytics-range-btn" :class="{ active: timeRange === 'all' }" @click="setRange('all')">Tout</button>
      </div>

      <!-- Stats rapides -->
      <div class="analytics-row analytics-quick-stats">
        <div class="analytics-stat">
          <span class="analytics-stat-value">{{ analyticsStats.total }}</span>
          <span class="analytics-stat-label">Rendus total</span>
        </div>
        <div class="analytics-stat">
          <span class="analytics-stat-value">{{ analyticsStats.graded }}</span>
          <span class="analytics-stat-label">Notés</span>
        </div>
        <div class="analytics-stat">
          <span class="analytics-stat-value">{{ analyticsStats.notGraded }}</span>
          <span class="analytics-stat-label">En attente</span>
        </div>
        <div class="analytics-stat">
          <span class="analytics-stat-value" :style="{ color: globalModeGrade ? GRADE_COLORS[globalModeGrade] || '#fff' : '#6b7280' }">
            {{ globalModeGrade ?? '-' }}
          </span>
          <span class="analytics-stat-label">Note fréquente</span>
        </div>
        <div class="analytics-stat">
          <span class="analytics-stat-value" style="color:#22c55e">{{ onlineUsersCount }}</span>
          <span class="analytics-stat-label">En ligne</span>
        </div>
      </div>

      <!-- Distribution des notes -->
      <div class="analytics-card">
        <h3 class="analytics-card-title"><Award :size="14" /> Distribution des notes</h3>
        <div class="analytics-bars" role="img" aria-label="Distribution des notes">
          <div v-for="b in gradeDistribution" :key="b.label" class="analytics-bar-row">
            <span class="analytics-bar-label">{{ b.label }}</span>
            <div class="analytics-bar-track">
              <div
                class="analytics-bar-fill"
                :style="{ width: b.pct + '%', background: b.color }"
              />
            </div>
            <span class="analytics-bar-count">{{ b.count }}</span>
          </div>
        </div>
      </div>

      <!-- Taux de soumission par devoir -->
      <div class="analytics-card">
        <h3 class="analytics-card-title"><CheckCircle2 :size="14" /> Taux de soumission</h3>
        <div v-if="!submissionRates.length" class="db-empty-hint" style="padding:20px">
          <p>Aucun devoir publié avec des soumissions attendues.</p>
        </div>
        <div v-else class="analytics-bars">
          <div v-for="s in submissionRates" :key="s.title" class="analytics-bar-row">
            <span class="analytics-bar-label analytics-bar-label-wide" :title="s.title">{{ s.title }}</span>
            <div class="analytics-bar-track">
              <div
                class="analytics-bar-fill"
                :style="{ width: s.rate + '%', background: s.rate >= 80 ? '#22c55e' : s.rate >= 50 ? '#f59e0b' : '#f87171' }"
              />
            </div>
            <span class="analytics-bar-count">{{ s.rate }}%</span>
          </div>
        </div>
      </div>

      <!-- Tendance des rendus (7 derniers jours) -->
      <div v-if="submissionTrend.days.some(d => d.count > 0)" class="analytics-card">
        <h3 class="analytics-card-title"><TrendingUp :size="14" /> Rendus des 7 derniers jours</h3>
        <div class="analytics-trend-chart" aria-label="Graphique des rendus des 7 derniers jours">
          <div v-for="d in submissionTrend.days" :key="d.label" class="analytics-trend-col">
            <span class="analytics-trend-count">{{ d.count || '' }}</span>
            <div class="analytics-trend-bar-bg">
              <div
                class="analytics-trend-bar-fill"
                :style="{ height: (d.count / submissionTrend.maxCount * 100) + '%' }"
              />
            </div>
            <span class="analytics-trend-label">{{ d.label }}</span>
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
  padding: 60px 20px; color: var(--text-muted); font-size: 13px; text-align: center; gap: 4px;
}

/* ── Analytique ── */
.analytics-grid { display: flex; flex-direction: column; gap: 16px; }
.analytics-quick-stats { display: flex; gap: 12px; flex-wrap: wrap; }
.analytics-stat {
  flex: 1; min-width: 100px;
  background: var(--bg-secondary); border-radius: 8px; padding: 14px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.analytics-stat-value { font-size: 22px; font-weight: 700; color: var(--text-primary); }
.analytics-stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; }
.analytics-card { background: var(--bg-secondary); border-radius: 8px; padding: 16px; }
.analytics-card-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 14px;
}
.analytics-bars { display: flex; flex-direction: column; gap: 6px; }
.analytics-bar-row { display: flex; align-items: center; gap: 8px; }
.analytics-bar-label { width: 40px; flex-shrink: 0; font-size: 11px; color: var(--text-muted); text-align: right; }
.analytics-bar-label-wide { width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.analytics-bar-track { flex: 1; height: 18px; background: rgba(255,255,255,.05); border-radius: 4px; overflow: hidden; }
.analytics-bar-fill { height: 100%; border-radius: 4px; transition: width .4s ease; }
.analytics-bar-count { width: 32px; flex-shrink: 0; font-size: 11px; color: var(--text-secondary); text-align: right; font-variant-numeric: tabular-nums; }
.analytics-trend-chart { display: flex; gap: 8px; align-items: flex-end; padding: 12px 4px 0; height: 120px; }
.analytics-trend-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; height: 100%; }
.analytics-trend-count { font-size: 11px; font-weight: 600; color: var(--text-secondary); min-height: 16px; }
.analytics-trend-bar-bg {
  flex: 1; width: 100%; max-width: 32px;
  background: rgba(255,255,255,.05); border-radius: 4px;
  display: flex; align-items: flex-end; overflow: hidden;
}
.analytics-trend-bar-fill {
  width: 100%;
  background: linear-gradient(to top, var(--accent), color-mix(in srgb, var(--accent) 60%, #fff));
  border-radius: 4px; min-height: 3px; transition: height .3s ease;
}
.analytics-trend-label { font-size: 10px; color: var(--text-muted); text-transform: capitalize; }

/* ── Sélecteur de période ── */
.analytics-range-row { display: flex; gap: 4px; }
.analytics-range-btn {
  font-size: 12px; font-weight: 600; padding: 5px 14px; border-radius: 6px;
  background: rgba(255,255,255,.04); color: var(--text-secondary);
  border: 1px solid var(--border); cursor: pointer; font-family: var(--font);
  transition: all .15s;
}
.analytics-range-btn:hover { background: rgba(255,255,255,.08); color: var(--text-primary); }
.analytics-range-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
</style>
