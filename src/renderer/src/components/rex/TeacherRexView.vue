/** TeacherRexView — Vue principale enseignant pour les sessions REX. */
<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
  import {
    Plus, Play, Square, Trash2, Users, Radio,
    MessageSquare, Cloud, Star, FileText, LogOut,
    ChevronDown, Download,
  } from 'lucide-vue-next'
  import { useAppStore }  from '@/stores/app'
  import { useRexStore }  from '@/stores/rex'
  import type { RexActivity } from '@/types'

  import RexJoinCodeDisplay         from './RexJoinCodeDisplay.vue'
  import RexActivityForm            from './RexActivityForm.vue'
  import RexSondageResults          from './RexSondageResults.vue'
  import RexWordCloud               from './RexWordCloud.vue'
  import RexEchelleResults          from './RexEchelleResults.vue'
  import RexQuestionOuverteResults  from './RexQuestionOuverteResults.vue'

  const appStore = useAppStore()
  const rex      = useRexStore()

  const newTitle = ref('')
  const showForm = ref(false)
  const exportOpen = ref(false)
  const selectedPromoId = ref<number | null>(appStore.activePromoId)

  const promoId = computed(() => selectedPromoId.value ?? appStore.activePromoId ?? appStore.currentUser?.promo_id ?? 0)
  const session = computed(() => rex.currentSession)
  const activity = computed(() => rex.currentActivity)
  const results  = computed(() => rex.results)

  onMounted(() => {
    rex.initSocketListeners()
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
    await rex.createSession(newTitle.value.trim(), promoId.value)
    newTitle.value = ''
  }

  async function onAddActivity(payload: {
    type: 'sondage_libre' | 'nuage' | 'echelle' | 'question_ouverte'
    title: string; max_words?: number; max_rating?: number
  }) {
    if (!session.value) return
    await rex.pushActivity(session.value.id, payload)
    showForm.value = false
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

  function activityIcon(type: string) {
    if (type === 'sondage_libre') return MessageSquare
    if (type === 'nuage') return Cloud
    if (type === 'echelle') return Star
    return FileText
  }

  function activityTypeLabel(type: string) {
    if (type === 'sondage_libre') return 'Sondage libre'
    if (type === 'nuage') return 'Nuage de mots'
    if (type === 'echelle') return 'Echelle'
    return 'Question ouverte'
  }
</script>

<template>
  <div class="rex-teacher">

    <!-- ═══ A) Pas de session ═══ -->
    <div v-if="!session" class="rex-create">
      <h2 class="rex-title">Retour d'Experience</h2>
      <p class="rex-subtitle">Creez une session pour recueillir les retours anonymes de vos etudiants</p>

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
        <button class="rex-btn-primary" :disabled="!newTitle.trim() || !promoId" @click="createSession">
          Creer la session
        </button>
      </div>
    </div>

    <!-- ═══ B) Session active ═══ -->
    <template v-else>
      <!-- Header -->
      <div class="rex-session-header">
        <div class="rex-session-info">
          <h2 class="rex-title">{{ session.title }}</h2>
          <span class="rex-status-badge" :class="session.status">
            {{ session.status === 'waiting' ? 'En attente' : session.status === 'active' ? 'Active' : 'Terminee' }}
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
            <Play :size="14" /> Demarrer
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

      <!-- Participant count -->
      <div v-if="session.status !== 'ended'" class="rex-participants">
        <Users :size="14" />
        <span>Participants connectes</span>
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
        <div v-for="act in rex.sessionActivities" :key="act.id" class="rex-act-row">
          <component :is="activityIcon(act.type)" :size="15" class="rex-act-icon" />
          <span class="rex-act-title">{{ act.title }}</span>
          <span class="rex-act-type">{{ activityTypeLabel(act.type) }}</span>
          <span class="rex-act-status" :class="act.status">{{ act.status }}</span>
          <div class="rex-act-actions">
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
              Resultats
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

        <!-- Add activity -->
        <button v-if="!showForm" class="rex-add-btn" @click="showForm = true">
          <Plus :size="14" /> Ajouter une activite
        </button>
        <RexActivityForm v-else @add="onAddActivity" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.rex-teacher {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Create state ── */
.rex-create {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rex-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}
.rex-subtitle {
  font-size: 14px;
  color: var(--text-muted, #888);
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
  border: 1px solid var(--border, rgba(255,255,255,.08));
  background: var(--bg-elevated, #1e1f21);
  color: var(--text-primary, #fff);
  font-size: 14px;
  font-family: var(--font, inherit);
  outline: none;
  transition: border-color 0.4s ease;
}
.rex-input:focus { border-color: #0d9488; }
.rex-select {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border, rgba(255,255,255,.08));
  background: var(--bg-elevated, #1e1f21);
  color: var(--text-primary, #fff);
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
  transition: all 0.4s ease; font-family: var(--font, inherit);
}
.rex-btn-primary:hover:not(:disabled) { background: #14b8a6; }
.rex-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.rex-btn-danger {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 18px; border-radius: 8px; border: none;
  background: rgba(239, 68, 68, 0.15); color: #ef4444;
  font-size: 13px; font-weight: 600; cursor: pointer;
  transition: all 0.4s ease; font-family: var(--font, inherit);
}
.rex-btn-danger:hover { background: rgba(239, 68, 68, 0.25); }
.rex-btn-ghost {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 8px;
  border: 1px solid var(--border, rgba(255,255,255,.08));
  background: transparent; color: var(--text-secondary, #aaa);
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all 0.4s ease; font-family: var(--font, inherit);
}
.rex-btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary, #fff); }
.rex-btn-sm {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 10px; border-radius: 6px; border: none;
  font-size: 11px; font-weight: 600; cursor: pointer;
  transition: all 0.4s ease; font-family: var(--font, inherit);
}
.rex-btn-teal {
  background: #0d9488; color: #fff;
}
.rex-btn-teal:hover { background: #14b8a6; }
.rex-btn-sm.rex-btn-ghost {
  background: transparent; color: var(--text-secondary, #aaa);
  border: 1px solid var(--border, rgba(255,255,255,.08));
}
.rex-btn-ghost-danger {
  background: transparent; color: var(--text-muted, #888);
  border: 1px solid var(--border, rgba(255,255,255,.08));
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
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.rex-status-badge.waiting { background: rgba(13, 148, 136, 0.12); color: #14b8a6; }
.rex-status-badge.active  { background: rgba(34, 197, 94, 0.12); color: #22c55e; }
.rex-status-badge.ended   { background: rgba(255, 255, 255, 0.06); color: var(--text-muted, #888); }

/* ── Export ── */
.rex-export-wrap { position: relative; }
.rex-export-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--bg-elevated, #1e1f21);
  border: 1px solid var(--border, rgba(255,255,255,.08));
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
  color: var(--text-primary, #fff);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  font-family: var(--font, inherit);
  transition: background 0.4s ease;
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
  color: var(--text-primary, #fff);
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
  color: var(--text-muted, #888);
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
  color: var(--text-primary, #fff);
  margin: 0;
}
.rex-act-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-elevated, #1e1f21);
  border: 1px solid var(--border, rgba(255,255,255,.08));
  border-radius: 10px;
  transition: all 0.4s ease;
}
.rex-act-icon { color: #14b8a6; flex-shrink: 0; }
.rex-act-title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #fff);
}
.rex-act-type {
  font-size: 11px;
  color: var(--text-muted, #888);
}
.rex-act-status {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 4px;
}
.rex-act-status.pending { color: var(--text-muted, #888); background: rgba(255,255,255,.04); }
.rex-act-status.live    { color: #0d9488; background: rgba(13, 148, 136, 0.1); }
.rex-act-status.closed  { color: var(--text-muted, #888); background: rgba(255,255,255,.04); }
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
  transition: all 0.4s ease;
  font-family: var(--font, inherit);
  align-self: flex-start;
}
.rex-add-btn:hover {
  background: rgba(13, 148, 136, 0.08);
  border-color: #0d9488;
}
</style>
