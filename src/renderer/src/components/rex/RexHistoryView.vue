/** RexHistoryView — Historique des sessions REX terminées par promotion. */
<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { Search, Calendar, ChevronDown, ChevronUp, Users } from 'lucide-vue-next'
  import { useRexStore }  from '@/stores/rex'
  import { useDebounce } from '@/composables/useDebounce'
  import { rexActivityIcon, rexActivityTypeLabel } from '@/utils/rexActivity'
  import type { RexSessionWithStats, RexSession, RexActivity, RexResults } from '@/types'

  import RexSondageResults          from './RexSondageResults.vue'
  import RexWordCloud               from './RexWordCloud.vue'
  import RexEchelleResults          from './RexEchelleResults.vue'
  import RexQuestionOuverteResults  from './RexQuestionOuverteResults.vue'
  import RexHumeurResults           from './RexHumeurResults.vue'
  import RexPrioriteResults         from './RexPrioriteResults.vue'
  import RexMatriceResults          from './RexMatriceResults.vue'

  const props = defineProps<{ promoId: number }>()
  const rex = useRexStore()

  const search   = ref('')
  const dateFrom = ref('')
  const dateTo   = ref('')

  const expandedId       = ref<number | null>(null)
  const expandedSession  = ref<RexSession | null>(null)
  const expandedResults  = ref<Record<number, RexResults>>({})
  const loadingExpand    = ref(false)

  // Fetch history on mount & filter change
  async function reload() {
    await rex.fetchHistory(props.promoId, {
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

  async function toggleExpand(s: RexSessionWithStats) {
    if (expandedId.value === s.id) {
      expandedId.value = null
      expandedSession.value = null
      expandedResults.value = {}
      return
    }
    expandedId.value = s.id
    loadingExpand.value = true
    try {
      await rex.fetchSession(s.id)
      expandedSession.value = rex.currentSession
      // Fetch results for each activity
      const results: Record<number, RexResults> = {}
      for (const act of expandedSession.value?.activities ?? []) {
        await rex.fetchResults(act.id)
        if (rex.results) results[act.id] = rex.results
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

  const activityIcon = rexActivityIcon
  const activityTypeLabel = rexActivityTypeLabel
</script>

<template>
  <div class="rex-history">
    <!-- Filters -->
    <div class="rex-history-filters">
      <div class="rex-filter-search">
        <Search :size="14" class="rex-filter-icon" />
        <input v-model="search" type="text" class="rex-input" placeholder="Rechercher par titre..." />
      </div>
      <div class="rex-filter-dates">
        <Calendar :size="14" class="rex-filter-icon" />
        <input v-model="dateFrom" type="date" class="rex-input rex-input-date" title="Depuis" />
        <span class="rex-filter-sep">-</span>
        <input v-model="dateTo" type="date" class="rex-input rex-input-date" title="Jusqu'a" />
      </div>
    </div>

    <!-- Loading -->
    <p v-if="rex.loading && rex.historySessions.length === 0" class="rex-history-empty">Chargement...</p>

    <!-- Empty -->
    <p v-else-if="rex.historySessions.length === 0" class="rex-history-empty">Aucune session terminee trouvee</p>

    <!-- Session list -->
    <div v-else class="rex-history-list">
      <div
        v-for="s in rex.historySessions"
        :key="s.id"
        class="rex-history-card"
        :class="{ 'rex-history-card--expanded': expandedId === s.id }"
      >
        <div class="rex-history-card-header" @click="toggleExpand(s)">
          <div class="rex-history-card-info">
            <span class="rex-history-card-title">{{ s.title }}</span>
            <span class="rex-history-card-date">{{ formatDate(s.ended_at) }}</span>
          </div>
          <div class="rex-history-card-stats">
            <span class="rex-history-stat">
              <MessageSquare :size="12" /> {{ s.activity_count }} activite{{ s.activity_count > 1 ? 's' : '' }}
            </span>
            <span class="rex-history-stat">
              <Users :size="12" /> {{ s.participant_count }} participant{{ s.participant_count > 1 ? 's' : '' }}
            </span>
          </div>
          <component :is="expandedId === s.id ? ChevronUp : ChevronDown" :size="16" class="rex-history-chevron" />
        </div>

        <!-- Expanded: activity results -->
        <div v-if="expandedId === s.id" class="rex-history-card-body">
          <p v-if="loadingExpand" class="rex-history-loading">Chargement des resultats...</p>
          <template v-else-if="expandedSession?.activities?.length">
            <div
              v-for="act in expandedSession.activities"
              :key="act.id"
              class="rex-history-activity"
            >
              <div class="rex-history-act-header">
                <component :is="activityIcon(act.type)" :size="14" class="rex-act-icon" />
                <span class="rex-history-act-title">{{ act.title }}</span>
                <span class="rex-type-tag">{{ activityTypeLabel(act.type) }}</span>
              </div>
              <div v-if="expandedResults[act.id]" class="rex-history-act-results">
                <RexSondageResults
                  v-if="expandedResults[act.id].type === 'sondage_libre' && expandedResults[act.id].counts"
                  :results="expandedResults[act.id].counts!"
                  :total="expandedResults[act.id].total"
                />
                <RexWordCloud
                  v-else-if="expandedResults[act.id].type === 'nuage' && expandedResults[act.id].freq"
                  :words="expandedResults[act.id].freq!"
                />
                <RexEchelleResults
                  v-else-if="expandedResults[act.id].type === 'echelle' && expandedResults[act.id].average !== undefined"
                  :average="expandedResults[act.id].average!"
                  :max-rating="act.max_rating"
                  :distribution="expandedResults[act.id].distribution ?? []"
                  :total="expandedResults[act.id].total"
                />
                <RexQuestionOuverteResults
                  v-else-if="expandedResults[act.id].type === 'question_ouverte' && expandedResults[act.id].answers"
                  :answers="expandedResults[act.id].answers!"
                  :is-teacher="false"
                />
                <RexSondageResults
                  v-else-if="expandedResults[act.id].type === 'sondage' && expandedResults[act.id].counts"
                  :results="expandedResults[act.id].counts!"
                  :total="expandedResults[act.id].total"
                />
                <RexHumeurResults
                  v-else-if="expandedResults[act.id].type === 'humeur' && expandedResults[act.id].emojis"
                  :emojis="expandedResults[act.id].emojis!"
                  :total="expandedResults[act.id].total"
                />
                <RexPrioriteResults
                  v-else-if="expandedResults[act.id].type === 'priorite' && expandedResults[act.id].rankings"
                  :rankings="expandedResults[act.id].rankings!"
                  :total="expandedResults[act.id].total"
                />
                <RexMatriceResults
                  v-else-if="expandedResults[act.id].type === 'matrice' && expandedResults[act.id].criteria"
                  :criteria="expandedResults[act.id].criteria!"
                  :max-rating="act.max_rating"
                  :total="expandedResults[act.id].total"
                />
                <p v-else class="rex-no-results">Aucune reponse</p>
              </div>
              <p v-else class="rex-no-results">Pas de resultats</p>
            </div>
          </template>
          <p v-else class="rex-history-loading">Aucune activite</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rex-history { display: flex; flex-direction: column; gap: 16px; }

/* ── Filters ── */
.rex-history-filters {
  display: flex; gap: 12px; flex-wrap: wrap; align-items: center;
}
.rex-filter-search, .rex-filter-dates {
  display: flex; align-items: center; gap: 8px;
}
.rex-filter-icon { color: var(--text-muted); flex-shrink: 0; }
.rex-input {
  padding: 8px 12px; border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary); font-size: 13px;
  font-family: var(--font, inherit); outline: none;
  transition: border-color .4s;
}
.rex-input:focus { border-color: #0d9488; }
.rex-input-date { width: 140px; }
.rex-filter-sep { color: var(--text-muted); font-size: 12px; }

/* ── Empty / Loading ── */
.rex-history-empty {
  text-align: center; color: var(--text-muted); font-size: 14px; padding: 32px 0;
}

/* ── Cards ── */
.rex-history-list { display: flex; flex-direction: column; gap: 8px; }
.rex-history-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px; overflow: hidden; transition: border-color .3s;
}
.rex-history-card:hover { border-color: rgba(13, 148, 136, 0.3); }
.rex-history-card--expanded { border-color: rgba(13, 148, 136, 0.4); }

.rex-history-card-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; cursor: pointer; transition: background .2s;
}
.rex-history-card-header:hover { background: rgba(255,255,255,.02); }

.rex-history-card-info { flex: 1; min-width: 0; }
.rex-history-card-title {
  display: block; font-size: 14px; font-weight: 600;
  color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rex-history-card-date {
  display: block; font-size: 11px; color: var(--text-muted); margin-top: 2px;
}

.rex-history-card-stats { display: flex; gap: 14px; flex-shrink: 0; }
.rex-history-stat {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; color: var(--text-secondary, #aaa);
}

.rex-history-chevron { color: var(--text-muted); flex-shrink: 0; }

/* ── Expanded body ── */
.rex-history-card-body {
  padding: 0 16px 16px;
  display: flex; flex-direction: column; gap: 16px;
  border-top: 1px solid var(--border, rgba(255,255,255,.06));
}
.rex-history-loading {
  text-align: center; color: var(--text-muted); font-size: 13px; padding: 12px 0;
}

.rex-history-activity {
  padding: 14px; border-radius: 8px;
  background: rgba(13, 148, 136, 0.03);
  border: 1px solid rgba(13, 148, 136, 0.08);
  display: flex; flex-direction: column; gap: 10px;
}
.rex-history-act-header {
  display: flex; align-items: center; gap: 8px;
}
.rex-act-icon { color: #14b8a6; flex-shrink: 0; }
.rex-history-act-title {
  font-size: 13px; font-weight: 600; color: var(--text-primary); flex: 1;
}
.rex-type-tag {
  padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;
  background: rgba(13, 148, 136, 0.1); color: #14b8a6;
}
.rex-history-act-results { min-height: 40px; }
.rex-no-results {
  text-align: center; color: var(--text-muted); font-size: 12px; padding: 8px 0;
}
</style>
