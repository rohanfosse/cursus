<!-- TeacherLiveView.vue - Vue enseignant pour le Live Quiz interactif -->
<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue'
  import {
    Plus, Play, Square, ChevronRight, Trash2, Users, Zap,
    ListChecks, ToggleLeft, Type, Link2, Hash,
    LogOut, Pencil, GripVertical, Copy,
    History, BarChart3,
  } from 'lucide-vue-next'
  import { useAppStore }  from '@/stores/app'
  import { useLiveStore } from '@/stores/live'
  import type { LiveActivity, LiveSession } from '@/types'
  import JoinCodeDisplay from './JoinCodeDisplay.vue'
  import ActivityForm    from './ActivityForm.vue'
  import CountdownTimer  from './CountdownTimer.vue'
  import Leaderboard     from './Leaderboard.vue'
  import Podium          from './Podium.vue'
  import QcmResults        from './QcmResults.vue'
  import PollResults       from './PollResults.vue'
  import QuizHistoryView   from './QuizHistoryView.vue'
  import QuizStatsView     from './QuizStatsView.vue'

  const appStore  = useAppStore()
  const liveStore = useLiveStore()

  const activeTab       = ref<'create' | 'history' | 'stats'>('create')
  const newTitle        = ref('')
  const showActivityForm = ref(false)
  const showLeaderboard  = ref(false)
  const showPodium       = ref(false)
  const editingActivity  = ref<LiveActivity | null>(null)
  const promoId          = computed(() => appStore.activePromoId ?? appStore.currentUser?.promo_id ?? 0)

  // Drag & drop state
  const dragSrcId = ref<number | null>(null)

  onMounted(async () => {
    liveStore.initSocketListeners()
    if (promoId.value) await liveStore.fetchDraftSessions(promoId.value)
  })
  onUnmounted(() => {
    liveStore.disposeSocketListeners()
  })

  // ── Create / select session ──────────────────────────────────────────────
  async function createSession() {
    if (!newTitle.value.trim() || !promoId.value) return
    await liveStore.createSession(newTitle.value.trim(), promoId.value)
    newTitle.value = ''
  }

  async function selectSession(session: LiveSession) {
    await liveStore.fetchSession(session.id)
    window.api.emitLiveJoin(session.promo_id)
  }

  async function onCloneSession(session: LiveSession) {
    if (!promoId.value) return
    await liveStore.cloneSession(session.id, promoId.value)
  }

  async function onDeleteDraftSession(session: LiveSession) {
    await liveStore.deleteSession(session.id)
  }

  // ── Activity management ──────────────────────────────────────────────────
  async function onAddActivity(payload: {
    type: 'qcm' | 'vrai_faux' | 'reponse_courte' | 'association' | 'estimation'; title: string; options?: string[]
    timer_seconds?: number; correct_answers?: number[] | string[]
  }) {
    if (!liveStore.currentSession) return
    if (editingActivity.value) {
      const updatePayload: Partial<LiveActivity> = {
        ...payload,
        correct_answers: payload.correct_answers !== undefined
          ? JSON.stringify(payload.correct_answers)
          : undefined,
      }
      await liveStore.updateActivity(editingActivity.value.id, updatePayload)
      editingActivity.value = null
    } else {
      await liveStore.pushActivity(liveStore.currentSession.id, payload)
    }
    showActivityForm.value = false
  }

  function startEditActivity(activity: LiveActivity) {
    editingActivity.value = activity
    showActivityForm.value = true
  }

  function cancelActivityForm() {
    editingActivity.value = null
    showActivityForm.value = false
  }

  async function launch(activity: LiveActivity) {
    await liveStore.launchActivity(activity.id)
  }

  async function closeCurrentActivity() {
    if (!liveStore.currentActivity) return
    await liveStore.closeActivity(liveStore.currentActivity.id)
    if (liveStore.currentSession) {
      await liveStore.fetchLeaderboard(liveStore.currentSession.id)
      showLeaderboard.value = true
    }
  }

  function dismissLeaderboard() {
    showLeaderboard.value = false
  }

  async function removeActivity(activity: LiveActivity) {
    await liveStore.deleteActivity(activity.id)
  }

  async function broadcastSession() {
    if (!liveStore.currentSession) return
    await liveStore.startSession(liveStore.currentSession.id)
  }

  async function endSession() {
    if (!liveStore.currentSession) return
    await liveStore.fetchLeaderboard(liveStore.currentSession.id)
    showPodium.value = true
    await liveStore.endSession(liveStore.currentSession.id)
  }

  // ── Drag & drop reorder ──────────────────────────────────────────────────
  function onDragStart(activityId: number) {
    dragSrcId.value = activityId
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
  }

  async function onDrop(targetId: number) {
    if (dragSrcId.value === null || dragSrcId.value === targetId) return
    const acts = liveStore.sessionActivities
    const fromIdx = acts.findIndex(a => a.id === dragSrcId.value)
    const toIdx   = acts.findIndex(a => a.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return
    const reordered = [...acts]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)
    await liveStore.reorderActivities(reordered.map(a => a.id))
    dragSrcId.value = null
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const podiumTop3 = computed(() =>
    liveStore.leaderboard.slice(0, 3).map(e => ({ name: e.name, points: e.points })),
  )

  function activityIcon(type: string) {
    if (type === 'qcm') return ListChecks
    if (type === 'vrai_faux') return ToggleLeft
    if (type === 'reponse_courte') return Type
    if (type === 'association') return Link2
    if (type === 'estimation') return Hash
    return Zap
  }

  function activityTypeLabel(type: string) {
    if (type === 'qcm') return 'QCM'
    if (type === 'vrai_faux') return 'Vrai / Faux'
    if (type === 'reponse_courte') return 'Reponse courte'
    if (type === 'association') return 'Association'
    if (type === 'estimation') return 'Estimation'
    return 'Spark'
  }

  const hasLiveActivity = computed(() => liveStore.sessionActivities.some(a => a.status === 'live'))
</script>

<template>
  <div class="teacher-live">
    <!-- ══════════ Pas de session — écran de sélection ══════════ -->
    <div v-if="!liveStore.currentSession" class="live-empty">
      <div class="live-hero">
        <Zap :size="48" class="hero-icon" />
        <h1 class="hero-title">Spark</h1>
      </div>

      <!-- Onglets -->
      <div class="quiz-tabs">
        <button class="quiz-tab" :class="{ active: activeTab === 'create' }" @click="activeTab = 'create'">
          <Plus :size="14" /> Creer
        </button>
        <button class="quiz-tab" :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">
          <History :size="14" /> Historique
        </button>
        <button class="quiz-tab" :class="{ active: activeTab === 'stats' }" @click="activeTab = 'stats'">
          <BarChart3 :size="14" /> Statistiques
        </button>
      </div>

      <!-- Tab: Creer -->
      <template v-if="activeTab === 'create'">
        <p class="hero-desc">Preparez votre session a l'avance, puis diffusez-la quand vous etes pret</p>

        <!-- Brouillons existants -->
        <div v-if="liveStore.draftSessions.length > 0" class="drafts-section">
          <h3 class="drafts-title">Brouillons</h3>
          <div class="draft-list">
            <div
              v-for="s in liveStore.draftSessions"
              :key="s.id"
              class="draft-card"
            >
              <div class="draft-card-body" @click="selectSession(s)">
                <span class="draft-card-title">{{ s.title }}</span>
                <span class="draft-card-meta">
                  {{ s.status === 'active' ? 'Active' : 'Brouillon' }}
                  · {{ s.activities?.length ?? '?' }} activite(s)
                </span>
              </div>
              <div class="draft-card-actions">
                <button class="btn-draft-clone" title="Dupliquer" @click.stop="onCloneSession(s)">
                  <Copy :size="14" />
                </button>
                <button class="btn-draft-delete" title="Supprimer" @click.stop="onDeleteDraftSession(s)">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="create-card">
          <h3 class="create-label">Nouvelle session</h3>
          <input
            v-model="newTitle"
            class="create-input"
            placeholder="Titre de la session (ex: Revision chapitre 3)"
            maxlength="100"
            @keydown.enter="createSession"
          />
          <button
            class="create-btn"
            :disabled="!newTitle.trim() || liveStore.loading"
            @click="createSession"
          >
            <Plus :size="16" />
            {{ liveStore.loading ? 'Creation...' : 'Creer la session' }}
          </button>
        </div>
      </template>

      <!-- Tab: Historique -->
      <QuizHistoryView v-else-if="activeTab === 'history'" :promo-id="promoId" />

      <!-- Tab: Statistiques -->
      <QuizStatsView v-else-if="activeTab === 'stats'" :promo-id="promoId" />
    </div>

    <!-- ══════════ Podium final ══════════ -->
    <div v-else-if="showPodium && podiumTop3.length > 0" class="live-podium-view">
      <Podium :top3="podiumTop3" />
      <button class="btn-dismiss-podium" @click="showPodium = false">
        Fermer
      </button>
    </div>

    <!-- ══════════ Session en attente ══════════ -->
    <div v-else-if="!liveStore.currentActivity && !showLeaderboard" class="live-session">
      <div class="session-header">
        <div class="session-info">
          <h1 class="session-title">{{ liveStore.currentSession.title }}</h1>
          <span class="session-status" :class="'status-' + liveStore.currentSession.status">
            {{ liveStore.currentSession.status === 'waiting' ? 'En attente' : liveStore.currentSession.status === 'active' ? 'Active' : 'Terminée' }}
          </span>
        </div>
        <div class="session-actions">
          <button
            v-if="liveStore.currentSession.status === 'waiting'"
            class="btn-start"
            @click="broadcastSession"
          >
            <Play :size="16" />
            Diffuser aux étudiants
          </button>
          <button class="btn-end" @click="endSession">
            <LogOut :size="16" />
            Terminer
          </button>
        </div>
      </div>

      <JoinCodeDisplay :code="liveStore.currentSession.join_code" />

      <div class="participant-bar">
        <Users :size="16" />
        <span>{{ liveStore.participantCount }} participant{{ liveStore.participantCount > 1 ? 's' : '' }}</span>
      </div>

      <!-- Activity list -->
      <div class="activities-section">
        <div class="activities-header">
          <h2 class="activities-title">Activités</h2>
          <button class="btn-add-activity" @click="showActivityForm = true">
            <Plus :size="16" />
            Ajouter
          </button>
        </div>

        <div v-if="showActivityForm" class="activity-form-wrapper">
          <ActivityForm
            :initial-data="editingActivity"
            @save="onAddActivity"
            @cancel="cancelActivityForm"
          />
        </div>

        <div v-if="liveStore.sessionActivities.length === 0 && !showActivityForm" class="no-activities">
          Aucune activité pour le moment. Ajoutez un QCM, sondage ou nuage de mots.
        </div>

        <div v-else class="activity-list">
          <div
            v-for="act in liveStore.sessionActivities"
            :key="act.id"
            class="activity-card"
            :class="{ closed: act.status === 'closed', dragging: dragSrcId === act.id }"
            :draggable="act.status === 'pending' && !hasLiveActivity"
            @dragstart="onDragStart(act.id)"
            @dragover="onDragOver"
            @drop="onDrop(act.id)"
          >
            <div
              v-if="act.status === 'pending' && !hasLiveActivity"
              class="drag-handle"
              title="Réordonner"
            >
              <GripVertical :size="16" />
            </div>
            <div class="activity-card-icon">
              <component :is="activityIcon(act.type)" :size="18" />
            </div>
            <div class="activity-card-body">
              <span class="activity-card-type">{{ activityTypeLabel(act.type) }}</span>
              <span class="activity-card-title">{{ act.title }}</span>
            </div>
            <span v-if="act.status === 'closed'" class="activity-card-done">Terminé</span>
            <div class="activity-card-actions">
              <button
                v-if="act.status === 'pending'"
                class="btn-edit-activity"
                title="Modifier"
                @click="startEditActivity(act)"
              >
                <Pencil :size="14" />
              </button>
              <button
                v-if="act.status === 'pending'"
                class="btn-launch"
                title="Lancer"
                @click="launch(act)"
              >
                <Play :size="14" />
                Lancer
              </button>
              <button
                v-if="act.status === 'pending'"
                class="btn-delete-activity"
                title="Supprimer"
                @click="removeActivity(act)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════ Leaderboard apres fermeture activite ══════════ -->
    <div v-else-if="showLeaderboard && !liveStore.currentActivity" class="live-leaderboard-view">
      <Leaderboard :entries="liveStore.leaderboard" />
      <button class="btn-dismiss-lb" @click="dismissLeaderboard">
        <ChevronRight :size="16" />
        Continuer
      </button>
    </div>

    <!-- ══════════ Activite en cours (presentation mode) ══════════ -->
    <div v-else-if="liveStore.currentActivity" class="live-activity-view">
      <div class="activity-topbar">
        <div class="activity-topbar-info">
          <component :is="activityIcon(liveStore.currentActivity.type)" :size="20" />
          <span class="activity-topbar-type">{{ activityTypeLabel(liveStore.currentActivity.type) }}</span>
        </div>
        <h2 class="activity-topbar-title">{{ liveStore.currentActivity.title }}</h2>
        <div class="activity-topbar-actions">
          <button class="btn-close-activity" @click="closeCurrentActivity">
            <Square :size="16" />
            Fermer l'activite
          </button>
          <button class="btn-next" @click="closeCurrentActivity">
            <ChevronRight :size="16" />
            Suivante
          </button>
        </div>
      </div>

      <!-- Timer + response count -->
      <div class="activity-live-bar">
        <CountdownTimer
          v-if="liveStore.timerStartedAt"
          :total-seconds="liveStore.currentActivity.timer_seconds ?? 30"
          :started-at="liveStore.timerStartedAt"
          @expired="() => {}"
        />
        <div class="response-count" v-if="liveStore.results">
          <Users :size="18" />
          <span>{{ liveStore.results.totalResponses }} ont repondu</span>
        </div>
      </div>

      <div class="results-area">
        <QcmResults v-if="(liveStore.currentActivity.type === 'qcm' || liveStore.currentActivity.type === 'vrai_faux') && liveStore.results" :results="liveStore.results" />
        <PollResults v-else-if="liveStore.currentActivity.type === 'reponse_courte' && liveStore.results" :results="liveStore.results" />
        <div v-else class="results-waiting">
          <Zap :size="32" class="results-waiting-icon" />
          <span>En attente des reponses...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.teacher-live {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: var(--bg-main, #111214);
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Tabs ── */
/* Tabs — segmented control unifie */
.quiz-tabs {
  display: flex; gap: 2px;
  padding: 2px; border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  width: fit-content;
}
.quiz-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 16px; border-radius: 6px; border: none;
  background: transparent; color: var(--text-muted);
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all .15s; font-family: inherit;
}
.quiz-tab:hover { color: var(--text-primary); }
.quiz-tab.active { background: var(--accent); color: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.15); }

/* ── Drafts section ── */
.drafts-section {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.drafts-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
}
.draft-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.draft-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-left: 3px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all .12s;
}
.draft-card:hover { background: var(--bg-hover); border-left-color: var(--accent); }
.draft-card-body { flex: 1; min-width: 0; }
.draft-card-title {
  display: block;
  font-size: 14px; font-weight: 600;
  color: var(--text-primary, #fff);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.draft-card-meta {
  display: block;
  font-size: 12px; color: var(--text-muted, #888); margin-top: 2px;
}
.draft-card-actions { display: flex; gap: 6px; flex-shrink: 0; }
.btn-draft-clone {
  width: 28px; height: 28px; border-radius: 6px;
  background: rgba(74,144,217,.08); color: var(--accent, #4a90d9);
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.btn-draft-clone:hover { background: rgba(74,144,217,.18); }
.btn-draft-delete {
  width: 28px; height: 28px; border-radius: 6px;
  background: rgba(239,68,68,.08); color: #f87171;
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.btn-draft-delete:hover { background: rgba(239,68,68,.18); }

/* ── Empty / Create ── */
.live-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  max-width: 560px;
  width: 100%;
  margin-top: 60px;
}
.live-hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.hero-icon {
  color: var(--accent);
  opacity: .5;
}
.hero-title {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.hero-desc {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  max-width: 400px;
}
.create-card {
  width: 100%;
  padding: 24px;
  background: var(--bg-elevated, #1e1f21);
  border: 1px solid var(--border, rgba(255,255,255,.08));
  border-radius: var(--radius, 12px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.create-label {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-secondary, #aaa);
}
.create-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  background: var(--bg-input, var(--border));
  border: 1px solid var(--border-input, var(--bg-hover));
  color: var(--text-primary, #fff);
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: border-color .15s;
}
.create-input:focus {
  border-color: var(--accent, #4a90d9);
}
.create-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  background: var(--accent, #4a90d9);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: all .15s;
}
.create-btn:hover { filter: brightness(1.1); }
.create-btn:disabled { opacity: .4; cursor: not-allowed; }

/* ── Session waiting ── */
.live-session {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 720px;
  width: 100%;
}
.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.session-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.session-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary, #fff);
}
.session-status {
  font-size: 11px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 6px;
  letter-spacing: .5px;
}
.status-waiting { background: rgba(251,191,36,.15); color: #fbbf24; }
.status-active  { background: rgba(34,197,94,.15); color: #22c55e; }
.status-ended   { background: rgba(107,114,128,.15); color: #9ca3af; }
.session-actions {
  display: flex;
  gap: 8px;
}
.btn-start {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: #22c55e; color: #fff; border: none; cursor: pointer;
  transition: all .15s;
}
.btn-start:hover { filter: brightness(1.1); }
.btn-end {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: rgba(239,68,68,.12); color: #f87171; border: 1px solid rgba(239,68,68,.2);
  cursor: pointer; transition: all .15s;
}
.btn-end:hover { background: rgba(239,68,68,.2); }
.participant-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px; border-radius: 10px;
  background: var(--bg-elevated); color: var(--text-muted, #888);
  font-size: 14px; font-weight: 600;
}

/* ── Activities ── */
.activities-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.activities-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.activities-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #fff);
}
.btn-add-activity {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: var(--accent-subtle, rgba(74,144,217,.12));
  color: var(--accent, #4a90d9); border: 1px solid rgba(74,144,217,.2);
  cursor: pointer; transition: all .15s;
}
.btn-add-activity:hover { background: rgba(74,144,217,.2); }
.activity-form-wrapper {
  padding: 20px;
  background: var(--bg-elevated, #1e1f21);
  border: 1px solid var(--border, rgba(255,255,255,.08));
  border-radius: var(--radius, 12px);
}
.no-activities {
  text-align: center;
  padding: 32px;
  color: var(--text-muted, #888);
  font-size: 14px;
}
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.activity-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-elevated, #1e1f21);
  border: 1px solid var(--border, rgba(255,255,255,.08));
  border-radius: 10px;
  transition: all .15s;
}
.activity-card.closed {
  opacity: .5;
}
.activity-card-icon {
  width: 36px; height: 36px; border-radius: 8px;
  background: rgba(74,144,217,.12); color: var(--accent, #4a90d9);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.activity-card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.activity-card-type {
  font-size: 11px; font-weight: 600;
  color: var(--text-muted);
}
.activity-card-title {
  font-size: 14px; font-weight: 600;
  color: var(--text-primary, #fff);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.activity-card-done {
  font-size: 11px; font-weight: 600;
  color: #22c55e; background: rgba(34,197,94,.12);
  padding: 2px 8px; border-radius: 4px;
}
.activity-card-actions {
  display: flex; gap: 6px; flex-shrink: 0;
}
.btn-launch {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
  background: #22c55e; color: #fff; border: none;
  cursor: pointer; transition: all .15s;
}
.btn-launch:hover { filter: brightness(1.1); }
.btn-edit-activity {
  width: 28px; height: 28px; border-radius: 6px;
  background: rgba(74,144,217,.08); color: var(--accent, #4a90d9);
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.btn-edit-activity:hover { background: rgba(74,144,217,.18); }
.btn-delete-activity {
  width: 28px; height: 28px; border-radius: 6px;
  background: rgba(239,68,68,.08); color: #f87171;
  border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.btn-delete-activity:hover { background: rgba(239,68,68,.18); }
.drag-handle {
  color: var(--text-muted, #888);
  cursor: grab;
  display: flex; align-items: center;
  flex-shrink: 0;
}
.drag-handle:active { cursor: grabbing; }
.activity-card.dragging { opacity: .4; border-style: dashed; }

/* ── Activity live (presentation) ── */
.live-activity-view {
  width: 100%;
  max-width: 960px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.activity-topbar {
  display: flex;
  align-items: center;
  gap: 16px;
}
.activity-topbar-info {
  display: flex; align-items: center; gap: 8px;
  color: var(--accent, #4a90d9);
}
.activity-topbar-type {
  font-size: 13px; font-weight: 700;
}
.activity-topbar-title {
  flex: 1;
  font-size: 28px;
  font-weight: 800;
  color: var(--text-primary, #fff);
}
.activity-topbar-actions {
  display: flex; gap: 8px; flex-shrink: 0;
}
.btn-close-activity {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: rgba(239,68,68,.12); color: #f87171;
  border: 1px solid rgba(239,68,68,.2); cursor: pointer;
  transition: all .15s;
}
.btn-close-activity:hover { background: rgba(239,68,68,.2); }
.btn-next {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: var(--accent, #4a90d9); color: #fff; border: none;
  cursor: pointer; transition: all .15s;
}
.btn-next:hover { filter: brightness(1.1); }
.results-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}
.results-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--text-muted, #888);
  font-size: 18px;
  font-weight: 600;
}
.results-waiting-icon {
  opacity: .4;
  animation: pulse-dot 2s infinite;
}

/* ── Activity live bar (timer + response count) ── */
.activity-live-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 12px 0;
}
.response-count {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary, #aaa);
}

/* ── Leaderboard view ── */
.live-leaderboard-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  max-width: 560px;
  width: 100%;
  margin-top: 40px;
}
.btn-dismiss-lb {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  background: var(--accent, #4a90d9);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: all .15s;
}
.btn-dismiss-lb:hover { filter: brightness(1.1); }

/* ── Podium view ── */
.live-podium-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  width: 100%;
  max-width: 560px;
  margin-top: 20px;
}
.btn-dismiss-podium {
  padding: 10px 32px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 700;
  background: var(--bg-elevated, #1e1f21);
  border: 1px solid var(--border, rgba(255,255,255,.08));
  color: var(--text-primary, #fff);
  cursor: pointer;
  transition: all .15s;
  z-index: 1;
}
.btn-dismiss-podium:hover { background: var(--bg-hover); }
</style>
