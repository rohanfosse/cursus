/** TeacherRexView — Vue principale enseignant pour les sessions REX. */
<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
  import {
    Plus, Play, Square, Trash2, Users,
    LogOut, ChevronDown, Download, Pencil, GripVertical, Copy, Clock,
    History, BarChart3, Presentation,
  } from 'lucide-vue-next'
  import { useAppStore }  from '@/stores/app'
  import { useRexStore }  from '@/stores/rex'
  import { rexActivityIcon, rexActivityTypeLabel } from '@/utils/rexActivity'
  import type { RexActivity, RexSession } from '@/types'

  import RexJoinCodeDisplay         from './RexJoinCodeDisplay.vue'
  import RexActivityForm            from './RexActivityForm.vue'
  import RexSondageResults          from './RexSondageResults.vue'
  import RexWordCloud               from './RexWordCloud.vue'
  import RexEchelleResults          from './RexEchelleResults.vue'
  import RexQuestionOuverteResults  from './RexQuestionOuverteResults.vue'
  import RexHumeurResults           from './RexHumeurResults.vue'
  import RexPrioriteResults         from './RexPrioriteResults.vue'
  import RexMatriceResults          from './RexMatriceResults.vue'
  import RexHistoryView             from './RexHistoryView.vue'
  import RexStatsView               from './RexStatsView.vue'
  import RexPresenterMode           from './RexPresenterMode.vue'

  const appStore = useAppStore()
  const rex      = useRexStore()

  const activeTab       = ref<'create' | 'history' | 'stats'>('create')
  const presenterMode   = ref(false)
  const newTitle        = ref('')
  const isAsync         = ref(false)
  const openUntil       = ref('')
  const showForm        = ref(false)
  const exportOpen      = ref(false)
  const editingActivity = ref<RexActivity | null>(null)
  const dragSrcId       = ref<number | null>(null)
  const selectedPromoId = ref<number | null>(appStore.activePromoId)

  const promoId  = computed(() => selectedPromoId.value ?? appStore.activePromoId ?? appStore.currentUser?.promo_id ?? 0)
  const session  = computed(() => rex.currentSession)
  const activity = computed(() => rex.currentActivity)
  const results  = computed(() => rex.results)
  const hasLiveActivity = computed(() => rex.sessionActivities.some(a => a.status === 'live'))

  onMounted(async () => {
    rex.initSocketListeners()
    if (promoId.value) await rex.fetchDraftSessions(promoId.value)
  })
  onUnmounted(() => {
    rex.disposeSocketListeners()
  })

  // Refresh results when live activity changes
  watch(activity, (act) => {
    if (act) rex.fetchResults(act.id)
  })

  // Poll results while activity is live
  let pollTimer: ReturnType<typeof setInterval> | null = null
  watch(activity, (act) => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
    if (act && act.status === 'live') {
      pollTimer = setInterval(() => rex.fetchResults(act.id), 3000)
    }
  }, { immediate: true })
  onUnmounted(() => { if (pollTimer) clearInterval(pollTimer) })

  // ── Actions ──────────────────────────────────────────────────────────────
  async function createSession() {
    if (!newTitle.value.trim() || !promoId.value) return
    const opts = isAsync.value
      ? { isAsync: true, openUntil: openUntil.value || undefined }
      : undefined
    await rex.createSession(newTitle.value.trim(), promoId.value, opts)
    newTitle.value = ''
    isAsync.value = false
    openUntil.value = ''
  }

  function formatOpenUntil(dt: string | null) {
    if (!dt) return ''
    const d = new Date(dt)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  async function selectSession(s: RexSession) {
    await rex.fetchSession(s.id)
    window.api.emitRexJoin(s.promo_id)
  }

  async function onCloneSession(s: RexSession) {
    if (!promoId.value) return
    await rex.cloneSession(s.id, promoId.value)
  }

  async function onDeleteDraftSession(s: RexSession) {
    await rex.deleteSession(s.id)
  }

  async function onAddActivity(payload: {
    type: RexActivity['type']
    title: string; max_words?: number; max_rating?: number; options?: string[]
  }) {
    if (!session.value) return
    // Serialize options array to JSON string for DB storage
    const dbPayload = { ...payload, options: payload.options ? JSON.stringify(payload.options) : undefined }
    if (editingActivity.value) {
      await rex.updateActivity(editingActivity.value.id, dbPayload)
      editingActivity.value = null
    } else {
      await rex.pushActivity(session.value.id, payload)
    }
    showForm.value = false
  }

  function startEditActivity(act: RexActivity) {
    editingActivity.value = act
    showForm.value = true
  }

  function cancelForm() {
    editingActivity.value = null
    showForm.value = false
  }

  // Drag & drop reorder
  function onDragStart(actId: number) { dragSrcId.value = actId }
  function onDragOver(e: DragEvent) { e.preventDefault() }
  async function onDrop(targetId: number) {
    if (dragSrcId.value === null || dragSrcId.value === targetId) return
    const acts = rex.sessionActivities
    const fromIdx = acts.findIndex(a => a.id === dragSrcId.value)
    const toIdx   = acts.findIndex(a => a.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const reordered = [...acts]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    await rex.reorderActivities(reordered.map(a => a.id))
    dragSrcId.value = null
  }

  async function launch(act: RexActivity) {
    await rex.launchActivity(act.id)
  }

  async function closeCurrent() {
    if (!activity.value) return
    await rex.closeActivity(activity.value.id)
  }

  async function removeActivity(act: RexActivity) {
    await rex.deleteActivity(act.id)
  }

  async function startSession() {
    if (!session.value) return
    await rex.startSession(session.value.id)
  }

  async function endSession() {
    if (!session.value) return
    await rex.endSession(session.value.id)
  }

  async function doExport(format: string) {
    if (!session.value) return
    await rex.exportSession(session.value.id, format)
    exportOpen.value = false
  }

  async function viewResults(act: RexActivity) {
    rex.currentActivity = act
    await rex.fetchResults(act.id)
  }

  async function onTogglePin(responseId: number, pinned: boolean) {
    await rex.togglePin(responseId, pinned)
    if (activity.value) await rex.fetchResults(activity.value.id)
  }

  const activityIcon = rexActivityIcon
  const activityTypeLabel = rexActivityTypeLabel

  // ── Activity progress ──────────────────────────────────────────────────
  const closedCount = computed(() => rex.sessionActivities.filter(a => a.status === 'closed').length)
  const totalActivities = computed(() => rex.sessionActivities.length)

  // ── Response count from results ───────────────────────────────────────
  const responseCount = computed(() => results.value?.total ?? 0)

  // ── Duplicate activity ────────────────────────────────────────────────
  async function duplicateActivity(act: RexActivity) {
    if (!session.value) return
    const payload: {
      type: RexActivity['type']; title: string
      max_words?: number; max_rating?: number; options?: string[]
    } = {
      type: act.type,
      title: act.title + ' (copie)',
      max_words: act.max_words,
      max_rating: act.max_rating,
    }
    if (act.options) {
      try { payload.options = JSON.parse(act.options as string) } catch { /* ignore */ }
    }
    await rex.pushActivity(session.value.id, payload)
  }
</script>

<template>
  <div class="rex-teacher">

    <!-- ═══ A) Pas de session ═══ -->
    <div v-if="!session" class="rex-create">
      <h2 class="rex-title">Pulse</h2>

      <!-- Onglets -->
      <div class="rex-tabs">
        <button class="rex-tab" :class="{ active: activeTab === 'create' }" @click="activeTab = 'create'">
          <Plus :size="14" /> Creer
        </button>
        <button class="rex-tab" :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">
          <History :size="14" /> Historique
        </button>
        <button class="rex-tab" :class="{ active: activeTab === 'stats' }" @click="activeTab = 'stats'">
          <BarChart3 :size="14" /> Statistiques
        </button>
      </div>

      <!-- Tab: Creer -->
      <template v-if="activeTab === 'create'">
        <p class="rex-subtitle">Preparez votre session a l'avance, puis diffusez-la quand vous etes pret</p>

        <!-- Brouillons existants -->
        <div v-if="rex.draftSessions.length > 0" class="rex-drafts">
          <h3 class="rex-drafts-title">Brouillons</h3>
          <div
            v-for="s in rex.draftSessions"
            :key="s.id"
            class="rex-draft-card"
          >
            <div class="rex-draft-body" @click="selectSession(s)">
              <div class="rex-draft-title-row">
                <span class="rex-draft-title">{{ s.title }}</span>
                <span v-if="s.is_async" class="rex-async-badge">
                  <Clock :size="10" /> ASYNC
                  <template v-if="s.open_until"> · {{ formatOpenUntil(s.open_until) }}</template>
                </span>
              </div>
              <span class="rex-draft-meta">{{ s.status === 'active' ? 'Active' : 'Brouillon' }}</span>
            </div>
            <div class="rex-draft-actions">
              <button class="rex-btn-sm rex-btn-ghost" title="Dupliquer" @click.stop="onCloneSession(s)">
                <Copy :size="13" />
              </button>
              <button class="rex-btn-sm rex-btn-ghost-danger" title="Supprimer" @click.stop="onDeleteDraftSession(s)">
                <Trash2 :size="13" />
              </button>
            </div>
          </div>
        </div>

        <div class="rex-create-form">
          <input
            v-model="newTitle"
            type="text"
            class="rex-input"
            placeholder="Titre de la session..."
            @keydown.enter="createSession"
          />
          <select v-if="appStore.activePromoId === null" v-model="selectedPromoId" class="rex-select">
            <option :value="null" disabled>Choisir une promotion</option>
          </select>
          <!-- Async toggle -->
          <label class="rex-async-toggle">
            <input v-model="isAsync" type="checkbox" />
            <Clock :size="13" /> Asynchrone
          </label>
          <input
            v-if="isAsync"
            v-model="openUntil"
            type="datetime-local"
            class="rex-input rex-input-dt"
            title="Ouvert jusqu'au..."
          />
          <button class="rex-btn-primary" :disabled="!newTitle.trim() || !promoId" @click="createSession">
            Creer la session
          </button>
        </div>
      </template>

      <!-- Tab: Historique -->
      <RexHistoryView v-else-if="activeTab === 'history'" :promo-id="promoId" />

      <!-- Tab: Statistiques -->
      <RexStatsView v-else-if="activeTab === 'stats'" :promo-id="promoId" />
    </div>

    <!-- ═══ B) Session active ═══ -->
    <template v-else>
      <!-- Mode presentation overlay -->
      <RexPresenterMode
        v-if="presenterMode && session.status === 'active'"
        :session="session"
        @close="presenterMode = false"
      />

      <!-- Header -->
      <template v-if="!presenterMode">
      <div class="rex-session-header">
        <div class="rex-session-info">
          <h2 class="rex-title">{{ session.title }}</h2>
          <span class="rex-status-badge" :class="session.status">
            {{ session.status === 'waiting' ? 'En attente' : session.status === 'active' ? 'Active' : 'Terminee' }}
          </span>
          <span v-if="session.is_async" class="rex-async-badge">
            <Clock :size="10" /> ASYNC<template v-if="session.open_until"> · Ouvert jusqu'au {{ formatOpenUntil(session.open_until) }}</template>
          </span>
        </div>
        <div class="rex-session-actions">
          <!-- Export dropdown -->
          <div class="rex-export-wrap">
            <button class="rex-btn-ghost" @click="exportOpen = !exportOpen">
              <Download :size="14" /> Exporter <ChevronDown :size="12" />
            </button>
            <div v-if="exportOpen" class="rex-export-menu">
              <button @click="doExport('json')">JSON</button>
              <button @click="doExport('csv')">CSV</button>
            </div>
          </div>
          <button v-if="session.status === 'waiting'" class="rex-btn-primary" @click="startSession">
            <Play :size="14" /> Diffuser aux étudiants
          </button>
          <button v-if="session.status === 'active'" class="rex-btn-teal" @click="presenterMode = true">
            <Presentation :size="14" /> Presenter
          </button>
          <button v-if="session.status === 'active'" class="rex-btn-danger" @click="endSession">
            <Square :size="14" /> Terminer
          </button>
          <button v-if="session.status === 'ended'" class="rex-btn-ghost" @click="rex.leaveSession()">
            <LogOut :size="14" /> Fermer
          </button>
        </div>
      </div>

      <!-- Join code -->
      <RexJoinCodeDisplay v-if="session.status !== 'ended'" :code="session.join_code" />

      <!-- Participant count + progress -->
      <div v-if="session.status !== 'ended'" class="rex-meta-bar">
        <div class="rex-participants">
          <Users :size="14" />
          <span>Participants connectes</span>
        </div>
        <div v-if="totalActivities > 0" class="rex-progress-bar">
          <div class="rex-progress-fill" :style="{ width: (closedCount / totalActivities * 100) + '%' }" />
          <span class="rex-progress-text">{{ closedCount }}/{{ totalActivities }} terminee{{ closedCount > 1 ? 's' : '' }}</span>
        </div>
        <div v-if="activity && responseCount > 0" class="rex-response-count">
          {{ responseCount }} reponse{{ responseCount > 1 ? 's' : '' }}
        </div>
      </div>

      <!-- Live activity results -->
      <div v-if="activity" class="rex-live-panel">
        <div class="rex-live-header">
          <component :is="activityIcon(activity.type)" :size="16" />
          <h3 class="rex-live-title">{{ activity.title }}</h3>
          <span class="rex-type-tag">{{ activityTypeLabel(activity.type) }}</span>
          <span v-if="activity.status === 'live'" class="rex-live-dot" />
        </div>

        <!-- Results dispatcher -->
        <div v-if="results" class="rex-results-area">
          <RexSondageResults
            v-if="results.type === 'sondage_libre' && results.counts"
            :results="results.counts"
            :total="results.total"
          />
          <RexWordCloud
            v-else-if="results.type === 'nuage' && results.freq"
            :words="results.freq"
          />
          <RexEchelleResults
            v-else-if="results.type === 'echelle' && results.average !== undefined"
            :average="results.average"
            :max-rating="activity.max_rating"
            :distribution="results.distribution ?? []"
            :total="results.total"
          />
          <RexQuestionOuverteResults
            v-else-if="results.type === 'question_ouverte' && results.answers"
            :answers="results.answers"
            :is-teacher="true"
            @toggle-pin="onTogglePin"
          />
          <RexSondageResults
            v-else-if="results.type === 'sondage' && results.counts"
            :results="results.counts"
            :total="results.total"
          />
          <RexHumeurResults
            v-else-if="results.type === 'humeur' && results.emojis"
            :emojis="results.emojis"
            :total="results.total"
          />
          <RexPrioriteResults
            v-else-if="results.type === 'priorite' && results.rankings"
            :rankings="results.rankings"
            :total="results.total"
          />
          <RexMatriceResults
            v-else-if="results.type === 'matrice' && results.criteria"
            :criteria="results.criteria"
            :max-rating="activity.max_rating"
            :total="results.total"
          />
          <p v-else class="rex-no-results">En attente de reponses...</p>
        </div>

        <button
          v-if="activity.status === 'live'"
          class="rex-btn-danger rex-close-act"
          @click="closeCurrent"
        >
          <Square :size="14" /> Fermer l'activite
        </button>
      </div>

      <!-- Activity list -->
      <div v-if="session.status !== 'ended'" class="rex-activities">
        <h3 class="rex-section-title">Activites</h3>
        <div
          v-for="act in rex.sessionActivities"
          :key="act.id"
          class="rex-act-row"
          :class="{ 'rex-act-dragging': dragSrcId === act.id }"
          :draggable="act.status === 'pending' && !hasLiveActivity"
          @dragstart="onDragStart(act.id)"
          @dragover="onDragOver"
          @drop="onDrop(act.id)"
        >
          <div
            v-if="act.status === 'pending' && !hasLiveActivity"
            class="rex-drag-handle"
            title="Réordonner"
          >
            <GripVertical :size="14" />
          </div>
          <component :is="activityIcon(act.type)" :size="15" class="rex-act-icon" />
          <span class="rex-act-title">{{ act.title }}</span>
          <span class="rex-act-type">{{ activityTypeLabel(act.type) }}</span>
          <span class="rex-act-status" :class="act.status">{{ act.status }}</span>
          <div class="rex-act-actions">
            <button
              v-if="act.status === 'pending'"
              class="rex-btn-sm rex-btn-ghost"
              title="Modifier"
              @click="startEditActivity(act)"
            >
              <Pencil :size="12" />
            </button>
            <button
              v-if="act.status === 'pending' && session.status === 'active'"
              class="rex-btn-sm rex-btn-teal"
              @click="launch(act)"
            >
              <Play :size="12" /> Lancer
            </button>
            <button
              v-if="act.status === 'closed'"
              class="rex-btn-sm rex-btn-ghost"
              @click="viewResults(act)"
            >
              Résultats
            </button>
            <button
              v-if="act.status === 'pending'"
              class="rex-btn-sm rex-btn-ghost"
              title="Dupliquer"
              @click="duplicateActivity(act)"
            >
              <Copy :size="12" />
            </button>
            <button
              v-if="act.status === 'pending'"
              class="rex-btn-sm rex-btn-ghost-danger"
              @click="removeActivity(act)"
            >
              <Trash2 :size="12" />
            </button>
          </div>
        </div>

        <!-- Add / edit activity form -->
        <button v-if="!showForm" class="rex-add-btn" @click="showForm = true">
          <Plus :size="14" /> Ajouter une activité
        </button>
        <RexActivityForm v-else :initial-data="editingActivity" @add="onAddActivity" @cancel="cancelForm" />
      </div>
      </template><!-- /!presenterMode -->
    </template>
  </div>
</template>

<style scoped>
.rex-teacher {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Tabs — segmented control unifie ── */
.rex-tabs {
  display: flex; gap: 2px;
  padding: 2px; border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  width: fit-content;
}
.rex-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 16px; border-radius: 6px; border: none;
  background: transparent; color: var(--text-muted);
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all .15s; font-family: inherit;
}
.rex-tab:hover { color: var(--text-primary); }
.rex-tab.active { background: var(--accent); color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.15); }

/* ── Drafts ── */
.rex-drafts { display: flex; flex-direction: column; gap: 8px; }
.rex-drafts-title {
  font-size: 11px; font-weight: 700;
  color: var(--text-muted); margin: 0;
}
.rex-draft-card {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-left: 3px solid transparent;
  border-radius: 8px; cursor: pointer; transition: all .12s;
}
.rex-draft-card:hover { background: var(--bg-hover); border-left-color: var(--accent); }
.rex-draft-body { flex: 1; min-width: 0; }
.rex-draft-title-row { display: flex; align-items: center; gap: 8px; }
.rex-draft-title {
  font-size: 13px; font-weight: 600;
  color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rex-draft-meta { display: block; font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.rex-async-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 8px; border-radius: 20px;
  font-size: 10px; font-weight: 700; white-space: nowrap;
  background: rgba(251, 146, 60, 0.12); color: #fb923c;
  flex-shrink: 0;
}
.rex-async-toggle {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--text-secondary, #aaa); cursor: pointer;
  user-select: none; white-space: nowrap;
}
.rex-async-toggle input[type="checkbox"] { cursor: pointer; accent-color: #fb923c; }
.rex-input-dt { flex: unset; min-width: 0; width: auto; font-size: 13px; }
.rex-draft-actions { display: flex; gap: 6px; flex-shrink: 0; }
.rex-drag-handle {
  color: var(--text-muted); cursor: grab; display: flex; align-items: center; flex-shrink: 0;
}
.rex-drag-handle:active { cursor: grabbing; }
.rex-act-row.rex-act-dragging { opacity: .4; border-style: dashed; }

/* ── Create state ── */
.rex-create {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rex-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.rex-subtitle {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0;
}
.rex-create-form {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.rex-input {
  flex: 1;
  min-width: 200px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 14px;
  font-family: var(--font, inherit);
  outline: none;
  transition: border-color var(--motion-slow) var(--ease-out);
}
.rex-input:focus { border-color: #0d9488; }
.rex-select {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font, inherit);
  outline: none;
}

/* ── Buttons ── */
.rex-btn-primary {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 18px; border-radius: 8px; border: none;
  background: #0d9488; color: #fff;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all var(--motion-slow) var(--ease-out); font-family: var(--font, inherit);
}
.rex-btn-primary:hover:not(:disabled) { background: #14b8a6; }
.rex-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.rex-btn-danger {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 18px; border-radius: 8px; border: none;
  background: rgba(239, 68, 68, 0.15); color: #ef4444;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all var(--motion-slow) var(--ease-out); font-family: var(--font, inherit);
}
.rex-btn-danger:hover { background: rgba(239, 68, 68, 0.25); }
.rex-btn-ghost {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent; color: var(--text-secondary, #aaa);
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all var(--motion-slow) var(--ease-out); font-family: var(--font, inherit);
}
.rex-btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary); }
.rex-btn-sm {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 10px; border-radius: 6px; border: none;
  font-size: 11px; font-weight: 600; cursor: pointer;
  transition: all var(--motion-slow) var(--ease-out); font-family: var(--font, inherit);
}
.rex-btn-teal {
  background: #0d9488; color: #fff;
}
.rex-btn-teal:hover { background: #14b8a6; }
.rex-btn-sm.rex-btn-ghost {
  background: transparent; color: var(--text-secondary, #aaa);
  border: 1px solid var(--border);
}
.rex-btn-ghost-danger {
  background: transparent; color: var(--text-muted);
  border: 1px solid var(--border);
}
.rex-btn-ghost-danger:hover { color: #ef4444; border-color: rgba(239, 68, 68, 0.3); }

/* ── Session header ── */
.rex-session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.rex-session-info {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rex-session-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}
.rex-status-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.rex-status-badge.waiting { background: rgba(13, 148, 136, 0.12); color: #14b8a6; }
.rex-status-badge.active  { background: rgba(34, 197, 94, 0.12); color: #22c55e; }
.rex-status-badge.ended   { background: rgba(255, 255, 255, 0.06); color: var(--text-muted); }

/* ── Export ── */
.rex-export-wrap { position: relative; }
.rex-export-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  z-index: 10;
}
.rex-export-menu button {
  display: block;
  width: 100%;
  padding: 8px 20px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  font-family: var(--font, inherit);
  transition: background var(--motion-slow) var(--ease-out);
}
.rex-export-menu button:hover { background: var(--bg-hover); }

/* ── Participants ── */
.rex-participants {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #14b8a6;
}

/* ── Live panel ── */
.rex-live-panel {
  padding: 20px;
  background: rgba(13, 148, 136, 0.04);
  border: 1px solid rgba(13, 148, 136, 0.15);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rex-live-header {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #14b8a6;
}
.rex-live-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}
.rex-type-tag {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  background: rgba(13, 148, 136, 0.1);
  color: #14b8a6;
}
.rex-live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #0d9488;
  animation: rex-pulse 2s infinite;
  margin-left: auto;
}
@keyframes rex-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
.rex-results-area {
  min-height: 60px;
}
.rex-no-results {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 16px 0;
}
.rex-close-act { align-self: flex-start; }

/* ── Activities list ── */
.rex-activities {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rex-section-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.rex-act-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: all var(--motion-slow) var(--ease-out);
}
.rex-act-icon { color: #14b8a6; flex-shrink: 0; }
.rex-act-title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}
.rex-act-type {
  font-size: 11px;
  color: var(--text-muted);
}
.rex-act-status {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 2px 8px;
  border-radius: 4px;
}
.rex-act-status.pending { color: var(--text-muted); background: rgba(255,255,255,.04); }
.rex-act-status.live    { color: #0d9488; background: rgba(13, 148, 136, 0.1); }
.rex-act-status.closed  { color: var(--text-muted); background: rgba(255,255,255,.04); }
.rex-act-actions {
  display: flex;
  gap: 6px;
}

/* ── Add button ── */
.rex-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px dashed rgba(13, 148, 136, 0.35);
  background: transparent;
  color: #14b8a6;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--motion-slow) var(--ease-out);
  font-family: var(--font, inherit);
  align-self: flex-start;
}
.rex-add-btn:hover {
  background: rgba(13, 148, 136, 0.08);
  border-color: #0d9488;
}
/* ── Meta bar (participants + progress + response count) ── */
.rex-meta-bar {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
.rex-progress-bar {
  flex: 1; min-width: 140px; height: 28px; position: relative;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 8px; overflow: hidden;
}
.rex-progress-fill {
  height: 100%; background: rgba(13,148,136,.25);
  border-radius: 8px; transition: width .4s cubic-bezier(.25,.8,.25,1);
}
.rex-progress-text {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; color: var(--text-secondary, #aaa);
}
.rex-response-count {
  font-size: 13px; font-weight: 600; color: #14b8a6;
  padding: 6px 12px; border-radius: 8px;
  background: rgba(13,148,136,.08);
}
</style>
