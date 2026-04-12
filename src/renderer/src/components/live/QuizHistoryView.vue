/** QuizHistoryView — Historique des sessions Quiz terminees par promotion. */
<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { Search, Calendar, ChevronDown, ChevronUp, Users, BarChart2 } from 'lucide-vue-next'
  import { useLiveStore } from '@/stores/live'
  import { useDebounce } from '@/composables/useDebounce'
  import { activityIcon, activityTypeLabel } from '@/utils/liveActivity'
  import type { LiveSessionWithStats, LiveSession, LiveResults } from '@/types'

  import QcmResults          from './QcmResults.vue'
  import PollResults         from './PollResults.vue'
  import WordCloud           from './WordCloud.vue'
  import AssociationResults  from './AssociationResults.vue'
  import EstimationResults   from './EstimationResults.vue'

  const props = defineProps<{ promoId: number }>()
  const liveStore = useLiveStore()

  const search   = ref('')
  const dateFrom = ref('')
  const dateTo   = ref('')

  const expandedId       = ref<number | null>(null)
  const expandedSession  = ref<LiveSession | null>(null)
  const expandedResults  = ref<Record<number, LiveResults>>({})
  const loadingExpand    = ref(false)

  async function reload() {
    await liveStore.fetchHistory(props.promoId, {
      search: search.value || undefined,
      dateFrom: dateFrom.value || undefined,
      dateTo: dateTo.value || undefined,
    })
  }
  reload()

  const debouncedSearch   = useDebounce(search, 400)
  const debouncedDateFrom = useDebounce(dateFrom, 400)
  const debouncedDateTo   = useDebounce(dateTo, 400)
  watch([debouncedSearch, debouncedDateFrom, debouncedDateTo], reload)
  watch(() => props.promoId, reload)

  async function toggleExpand(s: LiveSessionWithStats) {
    if (expandedId.value === s.id) {
      expandedId.value = null
      expandedSession.value = null
      expandedResults.value = {}
      return
    }
    expandedId.value = s.id
    loadingExpand.value = true
    try {
      await liveStore.fetchSession(s.id)
      expandedSession.value = liveStore.currentSession
      const results: Record<number, LiveResults> = {}
      for (const act of expandedSession.value?.activities ?? []) {
        await liveStore.fetchResults(act.id)
        if (liveStore.results) results[act.id] = liveStore.results
      }
      expandedResults.value = results
    } finally {
      loadingExpand.value = false
    }
  }

  function formatDate(dt: string | null) {
    if (!dt) return ''
    const d = new Date(dt)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

</script>

<template>
  <div class="quiz-history">
    <!-- Filters -->
    <div class="qh-filters">
      <div class="qh-filter-search">
        <Search :size="14" class="qh-filter-icon" />
        <input v-model="search" type="text" class="qh-input" placeholder="Rechercher par titre..." />
      </div>
      <div class="qh-filter-dates">
        <Calendar :size="14" class="qh-filter-icon" />
        <input v-model="dateFrom" type="date" class="qh-input qh-input-date" />
        <span class="qh-sep">-</span>
        <input v-model="dateTo" type="date" class="qh-input qh-input-date" />
      </div>
    </div>

    <p v-if="liveStore.loading && liveStore.historySessions.length === 0" class="qh-empty">Chargement...</p>
    <p v-else-if="liveStore.historySessions.length === 0" class="qh-empty">Aucune session terminee</p>

    <div v-else class="qh-list">
      <div
        v-for="s in liveStore.historySessions"
        :key="s.id"
        class="qh-card"
        :class="{ 'qh-card--open': expandedId === s.id }"
      >
        <div class="qh-card-header" @click="toggleExpand(s)">
          <div class="qh-card-info">
            <span class="qh-card-title">{{ s.title }}</span>
            <span class="qh-card-date">{{ formatDate(s.ended_at) }}</span>
          </div>
          <div class="qh-card-stats">
            <span class="qh-stat"><BarChart2 :size="12" /> {{ s.activity_count }} activite{{ s.activity_count > 1 ? 's' : '' }}</span>
            <span class="qh-stat"><Users :size="12" /> {{ s.participant_count }} participant{{ s.participant_count > 1 ? 's' : '' }}</span>
          </div>
          <component :is="expandedId === s.id ? ChevronUp : ChevronDown" :size="16" class="qh-chevron" />
        </div>

        <div v-if="expandedId === s.id" class="qh-card-body">
          <p v-if="loadingExpand" class="qh-loading">Chargement des resultats...</p>
          <template v-else-if="expandedSession?.activities?.length">
            <div v-for="act in expandedSession.activities" :key="act.id" class="qh-activity">
              <div class="qh-act-header">
                <component :is="activityIcon(act.type)" :size="14" class="qh-act-icon" />
                <span class="qh-act-title">{{ act.title }}</span>
                <span class="qh-act-type">{{ activityTypeLabel(act.type) }}</span>
              </div>
              <div v-if="expandedResults[act.id]" class="qh-act-results">
                <QcmResults
                  v-if="expandedResults[act.id].type === 'qcm' || expandedResults[act.id].type === 'vrai_faux'"
                  :results="expandedResults[act.id]"
                />
                <PollResults
                  v-else-if="expandedResults[act.id].type === 'sondage' || expandedResults[act.id].type === 'reponse_courte'"
                  :results="expandedResults[act.id]"
                />
                <WordCloud
                  v-else-if="expandedResults[act.id].type === 'nuage'"
                  :results="expandedResults[act.id]"
                />
                <AssociationResults
                  v-else-if="expandedResults[act.id].type === 'association'"
                  :results="expandedResults[act.id]"
                />
                <EstimationResults
                  v-else-if="expandedResults[act.id].type === 'estimation'"
                  :results="expandedResults[act.id]"
                />
                <p v-else class="qh-no-results">Aucune reponse</p>
              </div>
            </div>
          </template>
          <p v-else class="qh-loading">Aucune activite</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quiz-history { display: flex; flex-direction: column; gap: 16px; }
.qh-filters { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.qh-filter-search, .qh-filter-dates { display: flex; align-items: center; gap: 8px; }
.qh-filter-icon { color: var(--text-muted); flex-shrink: 0; }
.qh-input {
  padding: 8px 12px; border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary); font-size: 13px;
  font-family: var(--font, inherit); outline: none; transition: border-color .4s;
}
.qh-input:focus { border-color: var(--accent, #e74c3c); }
.qh-input-date { width: 140px; }
.qh-sep { color: var(--text-muted); font-size: 12px; }
.qh-empty { text-align: center; color: var(--text-muted); font-size: 14px; padding: 32px 0; }
.qh-list { display: flex; flex-direction: column; gap: 8px; }
.qh-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px; overflow: hidden; transition: border-color .3s;
}
.qh-card:hover { border-color: rgba(231, 76, 60, 0.3); }
.qh-card--open { border-color: rgba(231, 76, 60, 0.4); }
.qh-card-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; cursor: pointer; transition: background .2s;
}
.qh-card-header:hover { background: rgba(255,255,255,.02); }
.qh-card-info { flex: 1; min-width: 0; }
.qh-card-title { display: block; font-size: 14px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.qh-card-date { display: block; font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.qh-card-stats { display: flex; gap: 14px; flex-shrink: 0; }
.qh-stat { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary, #aaa); }
.qh-chevron { color: var(--text-muted); flex-shrink: 0; }
.qh-card-body { padding: 0 16px 16px; display: flex; flex-direction: column; gap: 16px; border-top: 1px solid var(--border, rgba(255,255,255,.06)); }
.qh-loading { text-align: center; color: var(--text-muted); font-size: 13px; padding: 12px 0; }
.qh-activity {
  padding: 14px; border-radius: 8px;
  background: rgba(231, 76, 60, 0.03);
  border: 1px solid rgba(231, 76, 60, 0.08);
  display: flex; flex-direction: column; gap: 10px;
}
.qh-act-header { display: flex; align-items: center; gap: 8px; }
.qh-act-icon { color: var(--color-danger, #e74c3c); flex-shrink: 0; }
.qh-act-title { font-size: 13px; font-weight: 600; color: var(--text-primary); flex: 1; }
.qh-act-type { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: rgba(231, 76, 60, 0.1); color: var(--color-danger, #e74c3c); }
.qh-act-results { min-height: 40px; }
.qh-no-results { text-align: center; color: var(--text-muted); font-size: 12px; padding: 8px 0; }
</style>
