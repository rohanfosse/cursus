/** TabEngagement — Tableau d'engagement etudiants avec scores et detection a risque. */
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Activity, AlertTriangle, TrendingUp, MessageSquare, BookOpen, Clock, Search, Filter } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useApi }      from '@/composables/useApi'
import { relativeTime } from '@/utils/date'
import { safeGetJSON, safeSetJSON } from '@/utils/safeStorage'
import { useSlashFocusSearch } from '@/composables/useSlashFocusSearch'
import { useDebounce } from '@/composables/useDebounce'

const appStore = useAppStore()
const { api }  = useApi()

interface EngagementScore {
  studentId: number; name: string; score: number
  messages: number; onTime: number; late: number; missing: number
  totalDevoirs: number; submitted: number
  lastActivity: string | null; atRisk: boolean
}

const SEARCH_KEY   = 'cc_teacher_engagement_search'
const AT_RISK_KEY  = 'cc_teacher_engagement_at_risk'

const scores    = ref<EngagementScore[]>([])
const loading   = ref(false)
const search    = ref<string>(safeGetJSON<string>(SEARCH_KEY, ''))
const showAtRiskOnly = ref<boolean>(safeGetJSON<boolean>(AT_RISK_KEY, false))

// Persistance : search debouncee, filtre immediat
const debouncedSearch = useDebounce(search, 400)
watch(debouncedSearch, v => safeSetJSON(SEARCH_KEY, v))
watch(showAtRiskOnly,  v => safeSetJSON(AT_RISK_KEY, v))

useSlashFocusSearch('.te-search-input')

const promoId = computed(() => appStore.activePromoId ?? 0)

async function loadData() {
  if (!promoId.value) return
  loading.value = true
  try {
    const data = await api<EngagementScore[]>(() => window.api.getEngagementScores(promoId.value))
    scores.value = data ?? []
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(promoId, loadData)

const filtered = computed(() => {
  let list = scores.value
  if (showAtRiskOnly.value) list = list.filter(s => s.atRisk)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(s => s.name.toLowerCase().includes(q))
  }
  return list
})

const stats = computed(() => {
  const all = scores.value
  if (!all.length) return { avg: 0, atRisk: 0, active: 0, total: 0 }
  return {
    avg: Math.round(all.reduce((s, e) => s + e.score, 0) / all.length),
    atRisk: all.filter(e => e.atRisk).length,
    active: all.filter(e => e.lastActivity && (Date.now() - new Date(e.lastActivity).getTime()) < 7 * 86400000).length,
    total: all.length,
  }
})

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}

function scoreLabel(score: number): string {
  if (score >= 70) return 'Bon'
  if (score >= 40) return 'Moyen'
  return 'Faible'
}
</script>

<template>
  <div class="te-tab">
    <div class="te-header">
      <Activity :size="18" />
      <h2 class="te-title">Engagement</h2>
    </div>

    <!-- Summary cards -->
    <div class="te-summary">
      <div class="te-card">
        <span class="te-card-value">{{ stats.avg }}%</span>
        <span class="te-card-label">Score moyen</span>
      </div>
      <div v-if="stats.atRisk > 0" class="te-card te-card--danger">
        <AlertTriangle :size="16" />
        <span class="te-card-value">{{ stats.atRisk }}</span>
        <span class="te-card-label">A risque</span>
      </div>
      <div class="te-card">
        <TrendingUp :size="16" />
        <span class="te-card-value">{{ stats.active }}/{{ stats.total }}</span>
        <span class="te-card-label">Actifs (7j)</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="te-filters">
      <div class="te-search">
        <Search :size="13" />
        <input v-model="search" type="text" class="te-search-input" placeholder="Rechercher un etudiant..." />
      </div>
      <button class="te-filter-btn" :class="{ active: showAtRiskOnly }" @click="showAtRiskOnly = !showAtRiskOnly">
        <Filter :size="13" /> A risque uniquement
      </button>
    </div>

    <!-- Table -->
    <div v-if="loading" class="te-loading">Chargement...</div>
    <div v-else-if="!filtered.length" class="te-empty">Aucun etudiant</div>
    <div v-else class="te-table">
      <div class="te-table-header">
        <span class="te-col-name">Etudiant</span>
        <span class="te-col-score">Score</span>
        <span class="te-col-stat">Messages</span>
        <span class="te-col-stat">Rendus</span>
        <span class="te-col-stat">Retards</span>
        <span class="te-col-stat">Manques</span>
        <span class="te-col-activity">Derniere activite</span>
      </div>
      <div v-for="s in filtered" :key="s.studentId" class="te-row" :class="{ 'te-row--risk': s.atRisk }">
        <div class="te-col-name">
          <span class="te-student-name">{{ s.name }}</span>
          <span v-if="s.atRisk" class="te-risk-badge"><AlertTriangle :size="10" /> A risque</span>
        </div>
        <div class="te-col-score">
          <div class="te-score-bar">
            <div class="te-score-fill" :style="{ width: s.score + '%', background: scoreColor(s.score) }" />
          </div>
          <span class="te-score-value" :style="{ color: scoreColor(s.score) }">{{ s.score }}%</span>
          <span class="te-score-label">{{ scoreLabel(s.score) }}</span>
        </div>
        <span class="te-col-stat"><MessageSquare :size="11" /> {{ s.messages }}</span>
        <span class="te-col-stat"><BookOpen :size="11" /> {{ s.submitted }}/{{ s.totalDevoirs }}</span>
        <span class="te-col-stat te-stat--warn">{{ s.late }}</span>
        <span class="te-col-stat te-stat--danger">{{ s.missing }}</span>
        <span class="te-col-activity">
          <template v-if="s.lastActivity">
            <Clock :size="10" /> {{ relativeTime(s.lastActivity) }}
          </template>
          <template v-else>Aucune</template>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.te-tab { display: flex; flex-direction: column; gap: 14px; }
.te-header { display: flex; align-items: center; gap: 10px; color: var(--text-primary); }
.te-title { font-size: 18px; font-weight: 700; margin: 0; }

/* Summary */
.te-summary { display: flex; gap: 12px; flex-wrap: wrap; }
.te-card {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 18px; border-radius: 12px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  flex: 1; min-width: 140px;
}
.te-card--danger { border-color: rgba(239,68,68,.2); background: rgba(239,68,68,.04); color: #ef4444; }
.te-card-value { font-size: 22px; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: var(--text-primary); }
.te-card--danger .te-card-value { color: #ef4444; }
.te-card-label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }

/* Filters */
.te-filters { display: flex; gap: 10px; flex-wrap: wrap; }
.te-search {
  flex: 1; min-width: 180px; display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--bg-elevated); color: var(--text-muted);
}
.te-search input { flex: 1; border: none; background: transparent; outline: none; color: var(--text-primary); font-size: 13px; font-family: var(--font); }
.te-filter-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px; border-radius: 8px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-secondary); font-size: 12px; font-weight: 600;
  cursor: pointer; font-family: var(--font); transition: all .15s;
}
.te-filter-btn.active { border-color: #ef4444; color: #ef4444; background: rgba(239,68,68,.06); }

/* Table */
.te-loading, .te-empty { text-align: center; color: var(--text-muted); padding: 40px 0; font-size: 13px; }
.te-table { display: flex; flex-direction: column; gap: 2px; }
.te-table-header, .te-row { display: grid; grid-template-columns: 2fr 1.5fr repeat(4, 0.8fr) 1.2fr; gap: 8px; align-items: center; padding: 8px 12px; }
.te-table-header {
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em;
  color: var(--text-muted); border-bottom: 1px solid var(--border);
}
.te-row {
  border-radius: 8px; font-size: 12px; color: var(--text-secondary);
  transition: background .15s;
}
.te-row:hover { background: var(--bg-hover); }
.te-row--risk { background: rgba(239,68,68,.03); }
.te-col-name { display: flex; align-items: center; gap: 6px; }
.te-student-name { font-weight: 600; color: var(--text-primary); }
.te-risk-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 8px;
  background: rgba(239,68,68,.12); color: #ef4444;
}
.te-col-score { display: flex; align-items: center; gap: 6px; }
.te-score-bar { flex: 1; height: 6px; border-radius: 3px; background: rgba(255,255,255,.06); overflow: hidden; }
.te-score-fill { height: 100%; border-radius: 3px; transition: width var(--motion-slow) var(--ease-out); min-width: 2px; }
.te-score-value { font-size: 12px; font-weight: 700; font-family: 'JetBrains Mono', monospace; min-width: 32px; }
.te-score-label { font-size: 10px; color: var(--text-muted); }
.te-col-stat { display: flex; align-items: center; gap: 4px; font-size: 12px; }
.te-stat--warn { color: #f59e0b; }
.te-stat--danger { color: #ef4444; }
.te-col-activity { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-muted); }

@media (max-width: 768px) {
  .te-table-header, .te-row { grid-template-columns: 1.5fr 1fr 0.6fr 0.6fr; }
  .te-col-stat:nth-child(n+5), .te-col-activity { display: none; }
}
</style>
