/**
 * Widget multi-promo : affiche les metriques cles de chaque promo cote a cote.
 * Visible uniquement si le prof a 2+ promos.
 */
<script setup lang="ts">
  import { onMounted } from 'vue'
  import { Clock, AlertTriangle, BarChart3, ChevronRight } from 'lucide-vue-next'
  import { useMultiPromo, type PromoMetrics, type GanttRow, type RenduRow } from '@/composables/useMultiPromo'
  import { formatDate } from '@/utils/date'
  import type { Promotion } from '@/types'
  import type { Ref } from 'vue'

  const props = defineProps<{
    promos: Promotion[]
  }>()

  const emit = defineEmits<{
    openDevoir: [travailId: number, promoId: number, channelId: number, channelName: string]
  }>()

  const { loading, hasMultiplePromos, metrics, load } = useMultiPromo({
    promos: { value: props.promos } as Ref<Promotion[]>,
    fetchGantt: async (promoId) => {
      const res = await window.api.getGanttData(promoId)
      return res?.ok ? (res.data as unknown as GanttRow[]) : null
    },
    fetchRendus: async (promoId) => {
      const res = await window.api.getAllRendus(promoId)
      return res?.ok ? (res.data as unknown as RenduRow[]) : null
    },
  })

  onMounted(() => { if (props.promos.length >= 2) load() })

  function handleDevoirClick(devoir: PromoMetrics['upcoming'][0], promoId: number) {
    emit('openDevoir', devoir.id, promoId, devoir.channel_id, devoir.channel_name)
  }
</script>

<template>
  <div v-if="hasMultiplePromos" class="multi-promo-card">
    <div class="mpc-header">
      <BarChart3 :size="14" />
      <span class="mpc-title">Vue multi-promo</span>
      <span v-if="loading" class="mpc-loading">Chargement...</span>
    </div>

    <div class="mpc-grid">
      <div
        v-for="m in metrics"
        :key="m.promo.id"
        class="mpc-promo"
        :style="{ '--promo-color': m.promo.color }"
      >
        <div class="mpc-promo-header">
          <span class="mpc-promo-dot" :style="{ background: m.promo.color }" />
          <span class="mpc-promo-name">{{ m.promo.name }}</span>
        </div>

        <div class="mpc-stats">
          <div class="mpc-stat">
            <span class="mpc-stat-value">{{ m.totalDevoirs }}</span>
            <span class="mpc-stat-label">devoirs</span>
          </div>
          <div class="mpc-stat" :class="{ 'mpc-stat--danger': m.toGrade > 0 }">
            <span class="mpc-stat-value">{{ m.toGrade }}</span>
            <span class="mpc-stat-label">a noter</span>
          </div>
          <div class="mpc-stat">
            <span class="mpc-stat-value">{{ m.progressPct }}%</span>
            <span class="mpc-stat-label">notes</span>
          </div>
        </div>

        <div class="mpc-progress">
          <div class="linear-progress"><div class="linear-progress-fill" :style="{ width: m.progressPct + '%' }" /></div>
        </div>

        <div v-if="m.upcoming.length" class="mpc-deadlines">
          <button
            v-for="d in m.upcoming"
            :key="d.id"
            class="mpc-deadline-item"
            @click="handleDevoirClick(d, m.promo.id)"
          >
            <Clock :size="11" />
            <span class="mpc-deadline-title">{{ d.title }}</span>
            <span class="mpc-deadline-date">{{ formatDate(d.deadline) }}</span>
            <span class="mpc-deadline-progress">{{ d.depots_count }}/{{ d.students_total }}</span>
            <ChevronRight :size="11" />
          </button>
        </div>
        <div v-else class="mpc-empty">Aucun devoir a venir</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.multi-promo-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius, 12px);
  padding: 16px;
  margin-bottom: 20px;
}

.mpc-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
  color: var(--text-secondary);
}

.mpc-title { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.mpc-loading { font-size: 11px; color: var(--text-muted); margin-left: auto; }

.mpc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
}

.mpc-promo {
  border: 1px solid var(--border);
  border-left: 3px solid var(--promo-color, var(--accent));
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mpc-promo-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mpc-promo-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.mpc-promo-name { font-size: 14px; font-weight: 700; }

.mpc-stats {
  display: flex;
  gap: 12px;
}

.mpc-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  padding: 6px 0;
  border-radius: 8px;
  background: var(--bg-hover, rgba(0,0,0,0.03));
}

.mpc-stat-value { font-size: 18px; font-weight: 800; }
.mpc-stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; }

.mpc-stat--danger .mpc-stat-value { color: var(--color-danger, #E74C3C); }
.mpc-stat--danger { background: rgba(231, 76, 60, 0.06); }

.mpc-progress { padding: 0 2px; }

.mpc-deadlines {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mpc-deadline-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: left;
  width: 100%;
  transition: background var(--t-fast, 150ms);
}

.mpc-deadline-item:hover { background: var(--bg-hover, rgba(0,0,0,0.03)); }

.mpc-deadline-title {
  flex: 1;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mpc-deadline-date { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
.mpc-deadline-progress { font-size: 11px; font-weight: 600; color: var(--accent); white-space: nowrap; }

.mpc-empty {
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  padding: 8px 0;
}

@media (max-width: 768px) {
  .mpc-grid { grid-template-columns: 1fr; }
}
</style>
