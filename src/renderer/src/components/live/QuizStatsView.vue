/** QuizStatsView — Statistiques Quiz par promotion. */
<script setup lang="ts">
  import { computed, watch } from 'vue'
  import { BarChart3, Users, Hash, TrendingUp, Timer, Target } from 'lucide-vue-next'
  import { useLiveStore } from '@/stores/live'
  import { ACTIVITY_TYPE_LABELS } from '@/utils/liveActivity'

  const props = defineProps<{ promoId: number }>()
  const liveStore = useLiveStore()

  liveStore.fetchStats(props.promoId)
  watch(() => props.promoId, () => liveStore.fetchStats(props.promoId))

  const stats = computed(() => liveStore.stats)

  const typeLabels = ACTIVITY_TYPE_LABELS

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
  <div class="qs">
    <p v-if="liveStore.loading && !stats" class="qs-empty">Chargement...</p>
    <p v-else-if="!stats || stats.totalSessions === 0" class="qs-empty">
      Pas encore de sessions terminees pour cette promotion
    </p>
    <template v-else>
      <div class="qs-cards">
        <div class="qs-card">
          <Hash :size="18" class="qs-icon" />
          <div class="qs-value">{{ stats.totalSessions }}</div>
          <div class="qs-label">Sessions</div>
        </div>
        <div class="qs-card">
          <TrendingUp :size="18" class="qs-icon" />
          <div class="qs-value">{{ stats.avgParticipationRate }}%</div>
          <div class="qs-label">Taux moyen</div>
        </div>
        <div class="qs-card">
          <Users :size="18" class="qs-icon" />
          <div class="qs-value">{{ stats.enrolledStudents }}</div>
          <div class="qs-label">Inscrits</div>
        </div>
        <div v-if="stats.avgCorrectnessRate !== undefined" class="qs-card">
          <Target :size="18" class="qs-icon" />
          <div class="qs-value">{{ stats.avgCorrectnessRate }}%</div>
          <div class="qs-label">Reussite</div>
        </div>
        <div v-if="stats.avgResponseTimeMs" class="qs-card">
          <Timer :size="18" class="qs-icon" />
          <div class="qs-value">{{ (stats.avgResponseTimeMs / 1000).toFixed(1) }}s</div>
          <div class="qs-label">Temps moyen</div>
        </div>
      </div>

      <div class="qs-section">
        <h3 class="qs-section-title"><BarChart3 :size="14" /> Repartition par type</h3>
        <div class="qs-bars">
          <div v-for="d in stats.activityTypeDistribution" :key="d.type" class="qs-bar-row">
            <span class="qs-bar-label">{{ typeLabels[d.type] || d.type }}</span>
            <div class="qs-bar-track">
              <div class="qs-bar-fill" :style="{ width: (d.count / maxTypeCount * 100) + '%' }" />
            </div>
            <span class="qs-bar-count">{{ d.count }}</span>
          </div>
        </div>
      </div>

      <div class="qs-section">
        <h3 class="qs-section-title"><TrendingUp :size="14" /> Participation par session</h3>
        <div class="qs-trend">
          <div
            v-for="d in stats.participationTrend"
            :key="d.sessionId"
            class="qs-trend-col"
            :title="`${d.title} — ${d.participants}/${d.enrolled} (${d.enrolled > 0 ? Math.round(d.participants / d.enrolled * 100) : 0}%)`"
          >
            <div class="qs-trend-bar-wrap">
              <div class="qs-trend-bar" :style="{ height: (d.participants / maxParticipants * 100) + '%' }" />
            </div>
            <span class="qs-trend-label">{{ formatDate(d.endedAt) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.qs { display: flex; flex-direction: column; gap: 20px; }
.qs-empty { text-align: center; color: var(--text-muted); font-size: 14px; padding: 32px 0; }
.qs-cards { display: flex; gap: 12px; flex-wrap: wrap; }
.qs-card {
  flex: 1; min-width: 120px;
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 20px 16px; border-radius: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}
.qs-icon { color: var(--color-danger, #e74c3c); }
.qs-value { font-size: 28px; font-weight: 700; color: var(--text-primary); line-height: 1; }
.qs-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; }
.qs-section {
  display: flex; flex-direction: column; gap: 12px;
  padding: 16px; border-radius: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}
.qs-section-title { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--text-primary); margin: 0; }
.qs-bars { display: flex; flex-direction: column; gap: 8px; }
.qs-bar-row { display: flex; align-items: center; gap: 10px; }
.qs-bar-label { width: 120px; flex-shrink: 0; font-size: 12px; color: var(--text-secondary, #aaa); text-align: right; }
.qs-bar-track { flex: 1; height: 22px; border-radius: 6px; background: rgba(255,255,255,.04); overflow: hidden; }
.qs-bar-fill { height: 100%; border-radius: 6px; background: linear-gradient(90deg, #c0392b, #e74c3c); transition: width .6s ease; min-width: 2px; }
.qs-bar-count { width: 32px; flex-shrink: 0; font-size: 12px; font-weight: 600; color: var(--text-primary); }
.qs-trend { display: flex; gap: 4px; align-items: flex-end; min-height: 140px; padding-top: 8px; overflow-x: auto; }
.qs-trend-col { flex: 1; min-width: 32px; max-width: 60px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.qs-trend-bar-wrap { width: 100%; height: 100px; display: flex; align-items: flex-end; justify-content: center; }
.qs-trend-bar { width: 70%; border-radius: 4px 4px 0 0; background: linear-gradient(0deg, #c0392b, #e74c3c); transition: height .6s ease; min-height: 2px; }
.qs-trend-label { font-size: 9px; color: var(--text-muted); white-space: nowrap; }
</style>
