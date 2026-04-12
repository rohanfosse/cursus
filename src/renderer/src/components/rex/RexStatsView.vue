/** RexStatsView — Statistiques REX par promotion. */
<script setup lang="ts">
  import { computed, watch } from 'vue'
  import { BarChart3, Users, Hash, TrendingUp } from 'lucide-vue-next'
  import { useRexStore } from '@/stores/rex'
  import { REX_TYPE_LABELS } from '@/utils/rexActivity'

  const props = defineProps<{ promoId: number }>()
  const rex = useRexStore()

  rex.fetchStats(props.promoId)
  watch(() => props.promoId, () => rex.fetchStats(props.promoId))

  const stats = computed(() => rex.stats)

  const typeLabels = REX_TYPE_LABELS

  const maxTypeCount = computed(() =>
    Math.max(1, ...(stats.value?.activityTypeDistribution.map(d => d.count) ?? [1])),
  )

  const maxParticipants = computed(() =>
    Math.max(1, ...(stats.value?.participationTrend.map(d => d.participants) ?? [1])),
  )

  function formatDate(dt: string | null) {
    if (!dt) return ''
    const d = new Date(dt)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  }
</script>

<template>
  <div class="rex-stats">
    <p v-if="rex.loading && !stats" class="rex-stats-empty">Chargement...</p>
    <p v-else-if="!stats || stats.totalSessions === 0" class="rex-stats-empty">
      Pas encore de sessions terminées pour cette promotion
    </p>
    <template v-else>
      <!-- Summary cards -->
      <div class="rex-stats-cards">
        <div class="rex-stat-card">
          <Hash :size="18" class="rex-stat-icon" />
          <div class="rex-stat-value">{{ stats.totalSessions }}</div>
          <div class="rex-stat-label">Sessions</div>
        </div>
        <div class="rex-stat-card">
          <TrendingUp :size="18" class="rex-stat-icon" />
          <div class="rex-stat-value">{{ stats.avgParticipationRate }}%</div>
          <div class="rex-stat-label">Taux moyen</div>
        </div>
        <div class="rex-stat-card">
          <Users :size="18" class="rex-stat-icon" />
          <div class="rex-stat-value">{{ stats.enrolledStudents }}</div>
          <div class="rex-stat-label">Inscrits</div>
        </div>
      </div>

      <!-- Activity type distribution -->
      <div class="rex-stats-section">
        <h3 class="rex-stats-section-title">
          <BarChart3 :size="14" /> Repartition par type
        </h3>
        <div class="rex-type-bars">
          <div v-for="d in stats.activityTypeDistribution" :key="d.type" class="rex-type-bar-row">
            <span class="rex-type-bar-label">{{ typeLabels[d.type] || d.type }}</span>
            <div class="rex-type-bar-track">
              <div
                class="rex-type-bar-fill"
                :style="{ width: (d.count / maxTypeCount * 100) + '%' }"
              />
            </div>
            <span class="rex-type-bar-count">{{ d.count }}</span>
          </div>
        </div>
      </div>

      <!-- Participation trend -->
      <div class="rex-stats-section">
        <h3 class="rex-stats-section-title">
          <TrendingUp :size="14" /> Participation par session
        </h3>
        <div class="rex-trend-chart">
          <div
            v-for="d in stats.participationTrend"
            :key="d.sessionId"
            class="rex-trend-col"
            :title="`${d.title} — ${d.participants}/${d.enrolled} (${d.enrolled > 0 ? Math.round(d.participants / d.enrolled * 100) : 0}%)`"
          >
            <div class="rex-trend-bar-wrap">
              <div
                class="rex-trend-bar"
                :style="{ height: (d.participants / maxParticipants * 100) + '%' }"
              />
            </div>
            <span class="rex-trend-label">{{ formatDate(d.endedAt) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rex-stats { display: flex; flex-direction: column; gap: 20px; }
.rex-stats-empty {
  text-align: center; color: var(--text-muted); font-size: 14px; padding: 32px 0;
}

/* ── Summary cards ── */
.rex-stats-cards { display: flex; gap: 12px; flex-wrap: wrap; }
.rex-stat-card {
  flex: 1; min-width: 120px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 20px 16px; border-radius: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}
.rex-stat-icon { color: #14b8a6; }
.rex-stat-value {
  font-size: 28px; font-weight: 700; color: var(--text-primary);
  line-height: 1;
}
.rex-stat-label {
  font-size: 12px; font-weight: 600; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .5px;
}

/* ── Section ── */
.rex-stats-section {
  display: flex; flex-direction: column; gap: 12px;
  padding: 16px; border-radius: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}
.rex-stats-section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 700; color: var(--text-primary); margin: 0;
}

/* ── Type distribution bars ── */
.rex-type-bars { display: flex; flex-direction: column; gap: 8px; }
.rex-type-bar-row { display: flex; align-items: center; gap: 10px; }
.rex-type-bar-label {
  width: 120px; flex-shrink: 0;
  font-size: 12px; color: var(--text-secondary, #aaa);
  text-align: right;
}
.rex-type-bar-track {
  flex: 1; height: 22px; border-radius: 6px;
  background: rgba(255,255,255,.04);
  overflow: hidden;
}
.rex-type-bar-fill {
  height: 100%; border-radius: 6px;
  background: linear-gradient(90deg, #0d9488, #14b8a6);
  transition: width .6s ease;
  min-width: 2px;
}
.rex-type-bar-count {
  width: 32px; flex-shrink: 0;
  font-size: 12px; font-weight: 600; color: var(--text-primary);
}

/* ── Participation trend ── */
.rex-trend-chart {
  display: flex; gap: 4px; align-items: flex-end;
  min-height: 140px; padding-top: 8px;
  overflow-x: auto;
}
.rex-trend-col {
  flex: 1; min-width: 32px; max-width: 60px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
}
.rex-trend-bar-wrap {
  width: 100%; height: 100px;
  display: flex; align-items: flex-end; justify-content: center;
}
.rex-trend-bar {
  width: 70%; border-radius: 4px 4px 0 0;
  background: linear-gradient(0deg, #0d9488, #14b8a6);
  transition: height .6s ease;
  min-height: 2px;
}
.rex-trend-label {
  font-size: 9px; color: var(--text-muted);
  white-space: nowrap;
}
</style>
