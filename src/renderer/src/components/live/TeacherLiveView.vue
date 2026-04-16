<!-- TeacherLiveView.vue - Vue enseignant pour le Live Quiz interactif -->
<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import {
    Plus, Play, Square, ChevronRight, Trash2, Users, Zap, Clock,
    LogOut, Pencil, GripVertical, Copy, Download,
    ArrowRight, Eye, EyeOff,
  } from 'lucide-vue-next'
  import { ACTIVITY_CATEGORIES, activityIcon, activityTypeLabel, getActivityCategory, isSparkType } from '@/utils/liveActivity'
  import type { ActivityCategory } from '@/utils/liveActivity'
  import { useAppStore }  from '@/stores/app'
  import { useLiveStore } from '@/stores/live'
  import type { LiveActivity, LiveSession, LiveV2ActivityType } from '@/types'
  import JoinCodeDisplay from './JoinCodeDisplay.vue'
  import ActivityForm    from './ActivityForm.vue'
  import CountdownTimer  from './CountdownTimer.vue'
  import Leaderboard     from './Leaderboard.vue'
  import Podium          from './Podium.vue'
  import QcmResults           from './QcmResults.vue'
  import PollResults          from './PollResults.vue'
  import AssociationResults   from './AssociationResults.vue'
  import EstimationResults    from './EstimationResults.vue'
  import QuizHistoryView      from './QuizHistoryView.vue'
  import QuizStatsView        from './QuizStatsView.vue'
  import LiveCodeEditor       from './LiveCodeEditor.vue'
  import LiveBoard            from './LiveBoard.vue'
  import LiveTestPreview      from './LiveTestPreview.vue'
  // Pulse results (composants Rex reutilises)
  import RexQuestionOuverteResults from '@/components/rex/RexQuestionOuverteResults.vue'
  import RexSondageResults        from '@/components/rex/RexSondageResults.vue'
  import RexEchelleResults        from '@/components/rex/RexEchelleResults.vue'
  import RexWordCloud             from '@/components/rex/RexWordCloud.vue'
  import RexHumeurResults         from '@/components/rex/RexHumeurResults.vue'
  import RexPrioriteResults       from '@/components/rex/RexPrioriteResults.vue'
  import RexMatriceResults        from '@/components/rex/RexMatriceResults.vue'

  const appStore  = useAppStore()
  const liveStore = useLiveStore()
  const route     = useRoute()
  const router    = useRouter()

  /** Elapsed time ticker — starts only when a non-Spark activity is live */
  const elapsedTick = ref(0)
  let elapsedInterval: ReturnType<typeof setInterval> | null = null

  function startElapsedTimer() {
    if (elapsedInterval) return
    elapsedInterval = setInterval(() => { elapsedTick.value++ }, 1000)
  }
  function stopElapsedTimer() {
    if (elapsedInterval) { clearInterval(elapsedInterval); elapsedInterval = null }
    elapsedTick.value = 0
  }

  watch(() => liveStore.currentActivity, (act: LiveActivity | null) => {
    if (act && act.status === 'live' && !isSparkType(act.type)) startElapsedTimer()
    else stopElapsedTimer()
  }, { immediate: true })
  onUnmounted(stopElapsedTimer)

  const elapsedTime = computed(() => {
    elapsedTick.value // trigger reactivity
    const started = liveStore.currentActivity?.started_at
    if (!started) return '0:00'
    const ms = Math.max(0, Date.now() - new Date(started + 'Z').getTime())
    const sec = Math.floor(ms / 1000)
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  })

  /** Filtre categorie dans la vue session (null = toutes) */
  const activeCategoryFilter = ref<ActivityCategory | null>(null)

  /** Activites filtrees par la categorie active */
  const filteredActivities = computed<LiveActivity[]>(() => {
    const acts = liveStore.sessionActivities
    if (!activeCategoryFilter.value) return acts
    return acts.filter(a => (a.category ?? getActivityCategory(a.type)) === activeCategoryFilter.value)
  })

  /** Nombre d'activites par categorie (source unique pour sidebar + pills header) */
  const categoryCountsMap = computed<Record<ActivityCategory, number>>(() => {
    const map: Record<ActivityCategory, number> = { spark: 0, pulse: 0, code: 0, board: 0 }
    for (const a of liveStore.sessionActivities) {
      const cat = (a.category ?? getActivityCategory(a.type)) as ActivityCategory
      map[cat] = (map[cat] ?? 0) + 1
    }
    return map
  })

  const sessionCategoryCounts = computed(() =>
    (Object.entries(categoryCountsMap.value) as [ActivityCategory, number][])
      .filter(([, count]) => count > 0)
      .map(([name, count]) => ({ name, count })),
  )

  /** Ouvre le formulaire d'ajout scope sur la categorie active */
  function addActivityInCategory(cat: ActivityCategory | null) {
    preSelectedCategory.value = cat
    showActivityForm.value = true
  }

  /** Mode apercu : affiche une preview "etudiant" a cote du prof */
  const previewMode = ref(false)
  function togglePreview() { previewMode.value = !previewMode.value }

  /** Parse les options d'une activite (JSON string -> array). */
  function parseOptions(opts: string | string[] | null | undefined): string[] {
    if (!opts) return []
    if (Array.isArray(opts)) return opts
    try { const arr = JSON.parse(opts); return Array.isArray(arr) ? arr : [] } catch { return [] }
  }

  /** Normalise les counts Pulse en array { text, count } (pour RexSondageResults). */
  const pulseSondageCounts = computed<{ text: string; count: number }[]>(() => {
    const c = liveStore.results?.counts
    if (!c) return []
    if (Array.isArray(c)) return c as { text: string; count: number }[]
    return Object.entries(c).map(([text, count]) => ({ text, count: Number(count) }))
  })

  const activeTab       = ref<'home' | 'history' | 'stats'>('home')

  // Sync tab from route query (sidebar navigation)
  watch(() => route.query.tab, (t) => {
    if (t === 'history' || t === 'stats') activeTab.value = t
    else activeTab.value = 'home'
  }, { immediate: true })

  const newTitle        = ref('')
  const showActivityForm = ref(false)
  const showLeaderboard  = ref(false)
  const showPodium       = ref(false)
  const codeEditorRef    = ref<{ getContent: () => string } | null>(null)
  const editingActivity  = ref<LiveActivity | null>(null)
  const promoId          = computed(() => appStore.activePromoId ?? appStore.currentUser?.promo_id ?? 0)

  // Drag & drop state
  const dragSrcId = ref<number | null>(null)

  onMounted(async () => {
    liveStore.initSocketListeners()
    if (promoId.value) await liveStore.fetchDraftSessions(promoId.value)
    window.addEventListener('keydown', onKeydown)
  })
  onUnmounted(() => {
    liveStore.disposeSocketListeners()
    window.removeEventListener('keydown', onKeydown)
  })

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  function onKeydown(e: KeyboardEvent) {
    // Skip if typing in an input
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return

    // Space or Enter: close current activity / launch next / dismiss leaderboard
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault()
      if (liveStore.currentActivity && liveStore.currentActivity.status === 'live') {
        closeCurrentActivity()
      } else if (showLeaderboard.value) {
        if (nextPendingActivity.value) {
          launchNext()
        } else {
          dismissLeaderboard()
        }
      } else if (showPodium.value) {
        showPodium.value = false
      }
    }

    // Escape: cancel activity form, dismiss leaderboard
    if (e.code === 'Escape') {
      if (showActivityForm.value) cancelActivityForm()
      else if (showLeaderboard.value) dismissLeaderboard()
      else if (showPodium.value) showPodium.value = false
      else if (selectedCategory.value) selectedCategory.value = null
    }
  }

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

  /** Ouvre la sous-page categorie */
  const selectedCategory = ref<ActivityCategory | null>(null)
  const preSelectedCategory = ref<ActivityCategory | null>(null)

  function openCategory(category: ActivityCategory) {
    selectedCategory.value = category
  }

  function backToHome() {
    selectedCategory.value = null
  }

  /** Cree la session et ouvre le formulaire d'activite avec la bonne categorie */
  async function startFromCategory() {
    if (!selectedCategory.value || !promoId.value) return
    const cat = ACTIVITY_CATEGORIES[selectedCategory.value]
    const title = newTitle.value.trim() || `Session ${cat.label}`
    await liveStore.createSession(title, promoId.value)
    newTitle.value = ''
    showActivityForm.value = true
    preSelectedCategory.value = selectedCategory.value
    selectedCategory.value = null
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
    type: LiveV2ActivityType
    title: string; options?: string[] | string
    max_words?: number; max_rating?: number
    timer_seconds?: number; correct_answers?: number[] | string[]
    language?: string
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
    preSelectedCategory.value = null
  }

  function startEditActivity(activity: LiveActivity) {
    editingActivity.value = activity
    showActivityForm.value = true
  }

  function cancelActivityForm() {
    editingActivity.value = null
    showActivityForm.value = false
    preSelectedCategory.value = null
  }

  async function launch(activity: LiveActivity) {
    await liveStore.launchActivity(activity.id)
  }

  const autoCloseEnabled = ref(true)

  function onTeacherTimerExpired() {
    if (autoCloseEnabled.value && liveStore.currentActivity) {
      closeCurrentActivity()
    }
  }

  async function closeCurrentActivity() {
    if (!liveStore.currentActivity) return
    const activity = liveStore.currentActivity
    // Save code snapshot before closing (via exposed ref)
    if (activity.type === 'live_code' && codeEditorRef.value) {
      const content = codeEditorRef.value.getContent()
      if (content) await window.api.saveLiveV2CodeSnapshot(activity.id, content)
    }
    await liveStore.closeActivity(activity.id)
    if (liveStore.currentSession) {
      // Only show leaderboard if session has Spark activities
      const hasSpark = liveStore.sessionActivities.some(a => isSparkType(a.type))
      if (hasSpark) {
        await liveStore.fetchLeaderboard(liveStore.currentSession.id)
        showLeaderboard.value = true
      }
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

  const hasLiveActivity = computed(() => liveStore.sessionActivities.some(a => a.status === 'live'))
  const nextPendingActivity = computed(() => liveStore.sessionActivities.find(a => a.status === 'pending') ?? null)

  async function launchNext() {
    if (!nextPendingActivity.value) return
    showLeaderboard.value = false
    await launch(nextPendingActivity.value)
  }

  // ── Activity progress ────────────────────────────────────────────────────
  const closedCount = computed(() => liveStore.sessionActivities.filter(a => a.status === 'closed').length)
  const totalCount  = computed(() => liveStore.sessionActivities.length)

  // ── Export CSV ───────────────────────────────────────────────────────────
  const exporting = ref(false)
  async function exportCsv() {
    if (!liveStore.currentSession) return
    exporting.value = true
    try {
      const csv = await liveStore.exportCsv(liveStore.currentSession.id)
      if (csv) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `live-${liveStore.currentSession.title.replace(/\s+/g, '-')}.csv`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
      }
    } finally {
      exporting.value = false
    }
  }

  // ── Duplicate activity ───────────────────────────────────────────────────
  async function duplicateActivity(activity: LiveActivity) {
    if (!liveStore.currentSession) return
    const payload: {
      type: LiveV2ActivityType
      title: string; options?: string[] | string
      max_words?: number; max_rating?: number
      timer_seconds?: number; correct_answers?: number[] | string[]
      language?: string
    } = {
      type: activity.type,
      title: activity.title + ' (copie)',
      timer_seconds: activity.timer_seconds,
    }
    if (activity.language) payload.language = activity.language
    if (activity.options) {
      try { payload.options = JSON.parse(activity.options as unknown as string) } catch { /* ignore */ }
    }
    if (activity.correct_answers) {
      try { payload.correct_answers = JSON.parse(activity.correct_answers as unknown as string) } catch { /* ignore */ }
    }
    await liveStore.pushActivity(liveStore.currentSession.id, payload)
  }
</script>

<template>
  <div class="teacher-live" :class="{ 'preview-open': previewMode && liveStore.currentSession }">
    <!-- Preview pane flottante (a droite) -->
    <aside v-if="previewMode && liveStore.currentSession" class="preview-pane">
      <LiveTestPreview
        :activities="liveStore.sessionActivities"
        :current-activity="liveStore.currentActivity"
      />
    </aside>
    <!-- ══════════ Pas de session — page d'accueil Live ══════════ -->
    <div v-if="!liveStore.currentSession" class="live-home">

      <!-- Tab: Historique / Stats (accessible via sidebar) -->
      <template v-if="activeTab === 'history'">
        <div class="live-home-sub">
          <button class="live-home-back" @click="activeTab = 'home'; router.replace({ name: 'live' })">
            <ArrowRight :size="14" style="transform: rotate(180deg)" /> Accueil Live
          </button>
          <QuizHistoryView :promo-id="promoId" />
        </div>
      </template>
      <template v-else-if="activeTab === 'stats'">
        <div class="live-home-sub">
          <button class="live-home-back" @click="activeTab = 'home'; router.replace({ name: 'live' })">
            <ArrowRight :size="14" style="transform: rotate(180deg)" /> Accueil Live
          </button>
          <QuizStatsView :promo-id="promoId" />
        </div>
      </template>

      <!-- Sub-page: detail categorie -->
      <template v-else-if="selectedCategory">
        <div class="live-cat-detail" :style="{ '--cat-color': ACTIVITY_CATEGORIES[selectedCategory].color }">
          <button class="live-home-back" @click="backToHome">
            <ArrowRight :size="14" style="transform: rotate(180deg)" /> Accueil Live
          </button>

          <div class="lcd-header">
            <div class="lcd-icon">
              <component :is="ACTIVITY_CATEGORIES[selectedCategory].icon" :size="32" />
            </div>
            <div>
              <h2 class="lcd-title">{{ ACTIVITY_CATEGORIES[selectedCategory].label }}</h2>
              <p class="lcd-desc">{{ ACTIVITY_CATEGORIES[selectedCategory].description }}</p>
            </div>
          </div>

          <!-- Types d'activites disponibles -->
          <div class="lcd-section">
            <h3 class="lcd-section-title">Types d'activites disponibles</h3>
            <div class="lcd-types-grid">
              <div
                v-for="t in ACTIVITY_CATEGORIES[selectedCategory].types"
                :key="t"
                class="lcd-type-card"
              >
                <component :is="activityIcon(t)" :size="20" class="lcd-type-icon" />
                <div class="lcd-type-info">
                  <span class="lcd-type-label">{{ activityTypeLabel(t) }}</span>
                  <span class="lcd-type-id">{{ t }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Infos specifiques par categorie -->
          <div class="lcd-section">
            <h3 class="lcd-section-title">Fonctionnalites</h3>
            <div class="lcd-features">
              <template v-if="selectedCategory === 'spark'">
                <div class="lcd-feat">Scoring et classement en temps reel</div>
                <div class="lcd-feat">Timer par question (optionnel)</div>
                <div class="lcd-feat">Leaderboard et podium final</div>
                <div class="lcd-feat">Correction automatique</div>
                <div class="lcd-feat">Export CSV des resultats</div>
              </template>
              <template v-else-if="selectedCategory === 'pulse'">
                <div class="lcd-feat">Reponses anonymes</div>
                <div class="lcd-feat">Nuage de mots, echelle, sondage, matrice</div>
                <div class="lcd-feat">Resultats agreges en direct</div>
                <div class="lcd-feat">Pas de scoring (feedback libre)</div>
                <div class="lcd-feat">Vote et priorisation</div>
              </template>
              <template v-else-if="selectedCategory === 'code'">
                <div class="lcd-feat">Editeur de code en direct</div>
                <div class="lcd-feat">Coloration syntaxique (JS, Python, Java...)</div>
                <div class="lcd-feat">Broadcast temps reel aux etudiants</div>
                <div class="lcd-feat">Snapshot automatique a la fermeture</div>
              </template>
              <template v-else-if="selectedCategory === 'board'">
                <div class="lcd-feat">Post-its collaboratifs par colonnes</div>
                <div class="lcd-feat">Drag & drop entre colonnes</div>
                <div class="lcd-feat">Votes (max configurable)</div>
                <div class="lcd-feat">Choix de couleur et edition inline</div>
                <div class="lcd-feat">Mode anonyme et export Markdown</div>
              </template>
            </div>
          </div>

          <!-- Zone creation -->
          <div class="lcd-create">
            <input
              v-model="newTitle"
              class="live-home-input"
              :placeholder="`Nom de la session ${ACTIVITY_CATEGORIES[selectedCategory].label} (optionnel)`"
              maxlength="100"
              @keydown.enter="startFromCategory"
            />
            <button
              class="lcd-create-btn"
              :disabled="liveStore.loading"
              @click="startFromCategory"
            >
              <Plus :size="16" />
              {{ liveStore.loading ? 'Creation...' : 'Creer et preparer' }}
            </button>
          </div>
        </div>
      </template>

      <!-- Tab: Accueil (default) -->
      <template v-else>
        <div class="live-hero">
          <Zap :size="40" class="hero-icon" />
          <h1 class="hero-title">Live</h1>
          <p class="hero-desc">Lancez une activite interactive avec vos etudiants</p>
        </div>

        <!-- Grille des 4 categories -->
        <div class="live-cat-grid">
          <button
            v-for="(cat, key) in ACTIVITY_CATEGORIES"
            :key="key"
            class="live-cat-card"
            :style="{ '--cat-color': cat.color }"
            @click="openCategory(key as ActivityCategory)"
          >
            <div class="live-cat-icon">
              <component :is="ACTIVITY_CATEGORIES[key as ActivityCategory].icon" :size="28" />
            </div>
            <div class="live-cat-info">
              <span class="live-cat-label">{{ cat.label }}</span>
              <span class="live-cat-desc">{{ cat.description }}</span>
            </div>
            <div class="live-cat-types">
              <span v-for="t in cat.types.slice(0, 3)" :key="t" class="live-cat-type">{{ t.replace(/_/g, ' ') }}</span>
              <span v-if="cat.types.length > 3" class="live-cat-type live-cat-more">+{{ cat.types.length - 3 }}</span>
            </div>
            <ArrowRight :size="16" class="live-cat-arrow" />
          </button>
        </div>

        <!-- Lien brouillons existants -->
        <div v-if="liveStore.draftSessions.length > 0" class="live-home-drafts-hint">
          <span class="live-home-drafts-text">
            {{ liveStore.draftSessions.length }} brouillon(s) dans la sidebar
          </span>
        </div>
      </template>
    </div>

    <!-- ══════════ Podium final ══════════ -->
    <div v-else-if="showPodium && podiumTop3.length > 0" class="live-podium-view">
      <Podium
        :top3="podiumTop3"
        :total-participants="liveStore.leaderboard.length"
        :total-activities="liveStore.currentSession?.activities?.length ?? 0"
        :session-title="liveStore.currentSession?.title"
      />
      <button class="btn-dismiss-podium" @click="showPodium = false">
        Fermer
      </button>
    </div>

    <!-- ══════════ Session en attente ══════════ -->
    <div v-else-if="!liveStore.currentActivity && !showLeaderboard" class="live-session">
      <div class="session-header">
        <div class="session-info">
          <h1 class="session-title">{{ liveStore.currentSession.title }}</h1>
          <div class="session-meta-row">
            <span class="session-status" :class="'status-' + liveStore.currentSession.status">
              {{ liveStore.currentSession.status === 'waiting' ? 'En attente' : liveStore.currentSession.status === 'active' ? 'Active' : 'Terminee' }}
            </span>
            <span v-for="cat in sessionCategoryCounts" :key="cat.name" class="session-cat-pill" :class="`cat--${cat.name}`">
              {{ cat.count }} {{ cat.name }}
            </span>
          </div>
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
          <button
            class="btn-preview"
            :class="{ active: previewMode }"
            @click="togglePreview"
            title="Apercu cote etudiant (sans les etudiants)"
          >
            <component :is="previewMode ? EyeOff : Eye" :size="16" />
            {{ previewMode ? 'Fermer apercu' : 'Mode apercu' }}
          </button>
          <button class="btn-export" :disabled="exporting" @click="exportCsv" title="Exporter les resultats en CSV">
            <Download :size="16" />
            {{ exporting ? 'Export...' : 'CSV' }}
          </button>
          <button class="btn-end" @click="endSession">
            <LogOut :size="16" />
            Terminer
          </button>
        </div>
      </div>

      <JoinCodeDisplay :code="liveStore.currentSession.join_code" />

      <div class="session-meta-bar">
        <div class="participant-bar">
          <Users :size="16" />
          <span>{{ liveStore.participantCount }} participant{{ liveStore.participantCount > 1 ? 's' : '' }}</span>
        </div>
        <div v-if="totalCount > 0" class="progress-bar">
          <div class="progress-fill" :style="{ width: (closedCount / totalCount * 100) + '%' }" />
          <span class="progress-text">{{ closedCount }}/{{ totalCount }} terminee{{ closedCount > 1 ? 's' : '' }}</span>
        </div>
      </div>

      <!-- Activity list -->
      <div class="activities-section">
        <div class="activities-header">
          <h2 class="activities-title">Activités</h2>
          <button class="btn-add-activity" @click="addActivityInCategory(activeCategoryFilter)">
            <Plus :size="16" />
            Ajouter {{ activeCategoryFilter ? ACTIVITY_CATEGORIES[activeCategoryFilter].label : '' }}
          </button>
        </div>

        <!-- Category filter sidebar (horizontal pills) -->
        <div class="cat-filter-bar">
          <button
            class="cat-filter-pill"
            :class="{ active: !activeCategoryFilter }"
            @click="activeCategoryFilter = null"
          >
            <span class="cfp-label">Tout</span>
            <span class="cfp-count">{{ liveStore.sessionActivities.length }}</span>
          </button>
          <button
            v-for="(cat, key) in ACTIVITY_CATEGORIES"
            :key="key"
            class="cat-filter-pill"
            :class="{ active: activeCategoryFilter === key, [`cfp--${key}`]: true }"
            :style="{ '--cat-color': cat.color }"
            @click="activeCategoryFilter = (activeCategoryFilter === key ? null : key as ActivityCategory)"
          >
            <component :is="ACTIVITY_CATEGORIES[key as ActivityCategory].icon" :size="14" />
            <span class="cfp-label">{{ cat.label }}</span>
            <span class="cfp-count">{{ categoryCountsMap[key as ActivityCategory] }}</span>
          </button>
        </div>

        <div v-if="showActivityForm" class="activity-form-wrapper">
          <ActivityForm
            :initial-data="editingActivity"
            :locked-category="preSelectedCategory"
            @save="onAddActivity"
            @cancel="cancelActivityForm"
          />
        </div>

        <div v-if="liveStore.sessionActivities.length === 0 && !showActivityForm" class="no-activities">
          <Zap :size="24" class="no-activities-icon" />
          <span class="no-activities-title">Aucune activite</span>
          <span class="no-activities-desc">Spark (quiz), Pulse (feedback), Code (live coding) ou Board (brainstorming)</span>
          <span class="no-activities-tip">Astuce : Espace/Entree pour naviguer rapidement entre les activites</span>
        </div>

        <div v-else-if="filteredActivities.length === 0 && !showActivityForm && activeCategoryFilter" class="no-activities no-activities-filtered">
          <component :is="ACTIVITY_CATEGORIES[activeCategoryFilter].icon" :size="24" class="no-activities-icon" :style="{ color: ACTIVITY_CATEGORIES[activeCategoryFilter].color }" />
          <span class="no-activities-title">Aucune activite {{ ACTIVITY_CATEGORIES[activeCategoryFilter].label }}</span>
          <span class="no-activities-desc">{{ ACTIVITY_CATEGORIES[activeCategoryFilter].description }}</span>
          <button class="btn-add-activity" style="margin-top: 8px" @click="addActivityInCategory(activeCategoryFilter)">
            <Plus :size="14" />
            Ajouter une activite {{ ACTIVITY_CATEGORIES[activeCategoryFilter].label }}
          </button>
        </div>

        <div v-else class="activity-list">
          <div
            v-for="act in filteredActivities"
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
              <div class="activity-card-meta">
                <span class="activity-card-type">{{ activityTypeLabel(act.type) }}</span>
                <span class="activity-card-cat" :class="`cat--${act.category ?? getActivityCategory(act.type)}`">
                  {{ (act.category ?? getActivityCategory(act.type)).charAt(0).toUpperCase() + (act.category ?? getActivityCategory(act.type)).slice(1) }}
                </span>
              </div>
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
                class="btn-edit-activity"
                title="Dupliquer"
                @click="duplicateActivity(act)"
              >
                <Copy :size="14" />
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
      <div class="lb-actions">
        <button v-if="nextPendingActivity" class="btn-launch-next" @click="launchNext">
          <Play :size="16" />
          Lancer : {{ nextPendingActivity.title }}
        </button>
        <button class="btn-dismiss-lb" @click="dismissLeaderboard">
          <ChevronRight :size="16" />
          {{ nextPendingActivity ? 'Revenir a la liste' : 'Continuer' }}
        </button>
      </div>
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

      <!-- Timer + response count (Spark only has countdown, Pulse/Code/Board: elapsed time) -->
      <div class="activity-live-bar">
        <!-- Countdown timer (Spark seulement) -->
        <CountdownTimer
          v-if="liveStore.timerStartedAt && isSparkType(liveStore.currentActivity.type)"
          :total-seconds="liveStore.currentActivity.timer_seconds ?? 30"
          :started-at="liveStore.timerStartedAt"
          @expired="onTeacherTimerExpired"
        />
        <!-- Elapsed time (Code/Board/Pulse) -->
        <span v-if="!isSparkType(liveStore.currentActivity.type) && liveStore.currentActivity.started_at" class="activity-elapsed">
          <Clock :size="12" /> {{ elapsedTime }}
        </span>
        <!-- Badge categorie dans la topbar -->
        <span class="activity-topbar-cat" :class="`cat--${getActivityCategory(liveStore.currentActivity.type)}`">
          {{ getActivityCategory(liveStore.currentActivity.type) }}
        </span>
        <!-- Compteur reponses (Spark/Pulse) -->
        <div v-if="liveStore.results && (liveStore.results.totalResponses || liveStore.results.total)" class="response-count">
          <Users :size="18" />
          <span>{{ liveStore.results.totalResponses ?? liveStore.results.total ?? 0 }} reponse{{ (liveStore.results.totalResponses ?? liveStore.results.total ?? 0) > 1 ? 's' : '' }}</span>
        </div>
        <!-- Auto-close (Spark seulement) -->
        <label v-if="isSparkType(liveStore.currentActivity.type)" class="auto-close-toggle" title="Fermer automatiquement quand le timer expire">
          <input type="checkbox" v-model="autoCloseEnabled" />
          <span class="auto-close-label">Auto-fermer</span>
        </label>
      </div>

      <div class="results-area">
        <!-- Code : editeur en direct (prof) -->
        <LiveCodeEditor
          ref="codeEditorRef"
          v-if="liveStore.currentActivity.type === 'live_code' && promoId"
          :activity-id="liveStore.currentActivity.id"
          :promo-id="promoId"
          :initial-content="liveStore.currentActivity.content ?? ''"
          :initial-language="liveStore.currentActivity.language ?? 'javascript'"
        />
        <!-- Board : tableau collaboratif -->
        <LiveBoard
          v-else-if="liveStore.currentActivity.type === 'board'"
          :activity-id="liveStore.currentActivity.id"
          :is-teacher="true"
          :columns="parseOptions(liveStore.currentActivity.options)"
          :max-votes="liveStore.currentActivity.max_rating ?? 3"
        />
        <!-- Spark : resultats classiques -->
        <QcmResults v-else-if="(liveStore.currentActivity.type === 'qcm' || liveStore.currentActivity.type === 'vrai_faux') && liveStore.results" :results="liveStore.results" :activity="liveStore.currentActivity" />
        <PollResults v-else-if="liveStore.currentActivity.type === 'reponse_courte' && liveStore.results" :results="liveStore.results" />
        <AssociationResults v-else-if="liveStore.currentActivity.type === 'association' && liveStore.results" :results="liveStore.results" />
        <EstimationResults v-else-if="liveStore.currentActivity.type === 'estimation' && liveStore.results" :results="liveStore.results" />
        <!-- Pulse : resultats anonymes (composants Rex reutilises) -->
        <RexQuestionOuverteResults
          v-else-if="liveStore.currentActivity.type === 'question_ouverte' && liveStore.results?.answers"
          :answers="liveStore.results.answers"
          :is-teacher="true"
        />
        <RexSondageResults
          v-else-if="(liveStore.currentActivity.type === 'sondage' || liveStore.currentActivity.type === 'sondage_libre') && pulseSondageCounts.length"
          :results="pulseSondageCounts"
          :total="liveStore.results?.total ?? 0"
        />
        <RexEchelleResults
          v-else-if="liveStore.currentActivity.type === 'echelle' && liveStore.results?.average !== undefined"
          :average="liveStore.results.average"
          :max-rating="liveStore.currentActivity.max_rating ?? 5"
          :distribution="liveStore.results.distribution ?? []"
          :total="liveStore.results.total ?? 0"
        />
        <RexWordCloud
          v-else-if="liveStore.currentActivity.type === 'nuage' && liveStore.results?.freq"
          :words="liveStore.results.freq"
        />
        <RexHumeurResults
          v-else-if="liveStore.currentActivity.type === 'humeur' && liveStore.results?.emojis"
          :emojis="liveStore.results.emojis"
          :total="liveStore.results.total ?? 0"
        />
        <RexPrioriteResults
          v-else-if="liveStore.currentActivity.type === 'priorite' && liveStore.results?.rankings"
          :rankings="liveStore.results.rankings"
          :total="liveStore.results.total ?? 0"
        />
        <RexMatriceResults
          v-else-if="liveStore.currentActivity.type === 'matrice' && liveStore.results?.criteria"
          :criteria="liveStore.results.criteria"
          :max-rating="liveStore.currentActivity.max_rating ?? 5"
          :total="liveStore.results.total ?? 0"
        />
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
  background: var(--bg-main);
  padding: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Home / Landing ── */
.live-home {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  max-width: 680px;
  width: 100%;
  margin-top: 48px;
}
.live-home-sub {
  width: 100%; max-width: 680px;
  display: flex; flex-direction: column; gap: 16px;
}
.live-home-back {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--text-muted);
  background: none; border: none; cursor: pointer; font-family: inherit;
  padding: 4px 0; transition: color .12s;
}
.live-home-back:hover { color: var(--accent); }

.live-hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.hero-icon { color: var(--accent); opacity: .5; }
.hero-title { font-size: 26px; font-weight: 700; color: var(--text-primary); margin: 0; }
.hero-desc { font-size: 13px; color: var(--text-muted); max-width: 400px; }

.live-home-name {
  width: 100%; max-width: 420px;
}
.live-home-input {
  width: 100%; padding: 10px 16px; border-radius: 8px;
  background: var(--bg-input, var(--border));
  border: 1px solid var(--border-input, var(--bg-hover));
  color: var(--text-primary); font-size: 14px; font-family: inherit;
  outline: none; transition: border-color .15s; text-align: center;
}
.live-home-input:focus { border-color: var(--accent); }
.live-home-input::placeholder { color: var(--text-muted); }

/* ── Category grid ── */
.live-cat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  width: 100%;
}
.live-cat-card {
  position: relative;
  display: flex; flex-direction: column; gap: 14px;
  padding: 22px 22px 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 16px;
  cursor: pointer;
  text-align: left;
  transition: transform .18s var(--ease-out), border-color .18s, box-shadow .18s, background .18s;
  overflow: hidden;
  font-family: inherit;
  isolation: isolate;
}
/* Halo diagonal derriere la carte */
.live-cat-card::after {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(circle at top right,
              color-mix(in srgb, var(--cat-color) 12%, transparent) 0%,
              transparent 55%);
  opacity: 0; transition: opacity .22s;
  z-index: -1;
}
/* Barre colore en haut */
.live-cat-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--cat-color), color-mix(in srgb, var(--cat-color) 50%, transparent));
  opacity: 0; transition: opacity .2s;
}
.live-cat-card:hover {
  border-color: color-mix(in srgb, var(--cat-color) 55%, var(--border));
  box-shadow: 0 10px 30px color-mix(in srgb, var(--cat-color) 15%, rgba(0,0,0,.25));
  transform: translateY(-2px);
}
.live-cat-card:hover::before,
.live-cat-card:hover::after { opacity: 1; }
.live-cat-card:disabled { opacity: .5; cursor: wait; }

.live-cat-icon {
  width: 52px; height: 52px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 14px;
  background: color-mix(in srgb, var(--cat-color) 14%, transparent);
  color: var(--cat-color);
  transition: transform .2s var(--ease-spring), background .15s;
}
.live-cat-card:hover .live-cat-icon {
  transform: scale(1.08) rotate(-4deg);
  background: color-mix(in srgb, var(--cat-color) 22%, transparent);
}
.live-cat-info { display: flex; flex-direction: column; gap: 2px; }
.live-cat-label { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.live-cat-desc { font-size: 12px; color: var(--text-muted); }
.live-cat-types {
  display: flex; flex-wrap: wrap; gap: 4px;
}
.live-cat-type {
  font-size: 10px; font-weight: 600;
  padding: 2px 7px; border-radius: 4px;
  background: var(--bg-hover); color: var(--text-secondary);
  text-transform: capitalize;
}
.live-cat-more { color: var(--text-muted); }
.live-cat-arrow {
  position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
  color: var(--text-muted); opacity: 0; transition: all .15s;
}
.live-cat-card:hover .live-cat-arrow { opacity: 1; color: var(--cat-color); }

.live-home-drafts-hint {
  text-align: center;
}
.live-home-drafts-text {
  font-size: 12px; color: var(--text-muted);
}

/* ── Category detail sub-page ── */
.live-cat-detail {
  width: 100%; max-width: 640px;
  display: flex; flex-direction: column; gap: 24px;
}
.lcd-header {
  display: flex; align-items: center; gap: 16px;
}
.lcd-icon {
  width: 56px; height: 56px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 14px;
  background: color-mix(in srgb, var(--cat-color) 12%, transparent);
  color: var(--cat-color);
  flex-shrink: 0;
}
.lcd-title {
  font-size: 22px; font-weight: 700; color: var(--text-primary); margin: 0;
}
.lcd-desc {
  font-size: 13px; color: var(--text-muted); margin: 2px 0 0;
}
.lcd-section {
  display: flex; flex-direction: column; gap: 10px;
}
.lcd-section-title {
  font-size: 12px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .04em; margin: 0;
}
.lcd-types-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
}
.lcd-type-card {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 8px;
}
.lcd-type-icon { color: var(--cat-color); flex-shrink: 0; }
.lcd-type-info { display: flex; flex-direction: column; gap: 1px; }
.lcd-type-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.lcd-type-id { font-size: 10px; color: var(--text-muted); font-family: monospace; }

.lcd-features {
  display: flex; flex-direction: column; gap: 6px;
}
.lcd-feat {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--text-secondary);
  padding: 6px 10px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 6px;
}
.lcd-feat::before {
  content: '';
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--cat-color);
  flex-shrink: 0;
}

.lcd-create {
  display: flex; flex-direction: column; gap: 12px;
  padding: 20px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 12px;
}
.lcd-create-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 12px; border-radius: 8px;
  font-size: 15px; font-weight: 700;
  background: var(--cat-color); color: #fff;
  border: none; cursor: pointer;
  transition: all .15s; font-family: inherit;
}
.lcd-create-btn:hover { filter: brightness(1.1); }
.lcd-create-btn:disabled { opacity: .4; cursor: not-allowed; }

/* Legacy create-input (still used in session view) */
.create-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--bg-input, var(--border));
  border: 1px solid var(--border-input, var(--bg-hover));
  color: var(--text-primary);
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: border-color .15s;
}
.create-input:focus {
  border-color: var(--accent);
}
.create-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  background: var(--accent);
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
  flex-direction: column;
  gap: 6px;
}
.session-meta-row {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
}
.session-cat-pill {
  font-size: 10px; font-weight: 700; padding: 1px 7px; border-radius: 10px;
}
.session-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
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
.btn-export {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: rgba(74,144,217,.08); color: var(--accent);
  border: 1px solid rgba(74,144,217,.2); cursor: pointer;
  transition: all .15s;
}
.btn-export:hover { background: rgba(74,144,217,.15); }
.btn-export:disabled { opacity: .4; cursor: not-allowed; }
.btn-preview {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: rgba(168,85,247,.08); color: #a855f7;
  border: 1px solid rgba(168,85,247,.2); cursor: pointer;
  transition: all .15s;
}
.btn-preview:hover { background: rgba(168,85,247,.18); }
.btn-preview.active { background: #a855f7; color: #fff; border-color: #a855f7; }

/* ── Preview pane (mode apercu) ── */
.teacher-live.preview-open {
  padding-right: 420px;
  transition: padding .2s;
}
.preview-pane {
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: 400px;
  background: var(--bg-main);
  border-left: 1px solid var(--border);
  padding: 24px 16px;
  overflow-y: auto;
  z-index: 20;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0,0,0,.15);
  animation: slidePreview .22s ease-out;
}
@keyframes slidePreview {
  from { transform: translateX(20px); opacity: 0 }
  to   { transform: translateX(0);    opacity: 1 }
}
@media (max-width: 900px) {
  .teacher-live.preview-open { padding-right: 32px; }
  .preview-pane { display: none; }
}
.session-meta-bar {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
}
.participant-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px; border-radius: 8px;
  background: var(--bg-elevated); color: var(--text-muted);
  font-size: 14px; font-weight: 600;
}
.progress-bar {
  flex: 1; min-width: 140px; height: 28px; position: relative;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 8px; overflow: hidden;
}
.progress-fill {
  height: 100%; background: rgba(34,197,94,.25);
  border-radius: 8px; transition: width .4s cubic-bezier(.25,.8,.25,1);
}
.progress-text {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 600; color: var(--text-secondary, #aaa);
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
  color: var(--text-primary);
}
.btn-add-activity {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: var(--accent-subtle, rgba(74,144,217,.12));
  color: var(--accent); border: 1px solid rgba(74,144,217,.2);
  cursor: pointer; transition: all .15s;
}
.btn-add-activity:hover { background: rgba(74,144,217,.2); }
.activity-form-wrapper {
  padding: 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius, 12px);
}
.no-activities {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  padding: 40px 32px;
  color: var(--text-muted);
  background: var(--bg-elevated);
  border: 1px dashed var(--border);
  border-radius: 12px;
}
.no-activities-icon {
  opacity: .3;
  color: var(--accent);
}
.no-activities-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-secondary, #aaa);
}
.no-activities-desc {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 360px;
}
.no-activities-tip {
  font-size: 11px;
  color: var(--text-muted);
  opacity: .6;
  margin-top: 4px;
}
.no-activities-filtered {
  padding: 32px 24px;
}

/* ── Category filter bar ── */
.cat-filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 0 4px;
}
.cat-filter-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all .15s;
}
.cat-filter-pill:hover {
  background: var(--bg-hover);
  border-color: var(--border-input);
}
.cat-filter-pill .cfp-count {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--bg-hover);
  color: var(--text-muted);
  min-width: 18px;
  text-align: center;
}
.cat-filter-pill.active {
  color: var(--cat-color, var(--accent));
  border-color: var(--cat-color, var(--accent));
  background: color-mix(in srgb, var(--cat-color, var(--accent)) 10%, transparent);
}
.cat-filter-pill.active .cfp-count {
  background: var(--cat-color, var(--accent));
  color: #fff;
}
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.activity-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: all .15s;
  overflow: hidden;
}
.activity-card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--text-muted);
  opacity: 0;
  transition: opacity .15s;
}
.activity-card:hover {
  border-color: var(--border-input);
  transform: translateX(1px);
}
.activity-card:hover::before { opacity: 1; }
/* Barre laterale colore selon la categorie */
.activity-card:has(.cat--spark)::before { background: var(--live-spark); }
.activity-card:has(.cat--pulse)::before { background: var(--live-pulse); }
.activity-card:has(.cat--code)::before  { background: var(--live-code); }
.activity-card:has(.cat--board)::before { background: var(--live-board); }
.activity-card.closed {
  opacity: .55;
}
.activity-card-icon {
  width: 36px; height: 36px; border-radius: 8px;
  background: rgba(74,144,217,.12); color: var(--accent);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  transition: background .15s, color .15s;
}
/* Teinte de l'icone selon la categorie */
.activity-card:has(.cat--spark) .activity-card-icon { background: var(--live-spark-soft); color: var(--live-spark); }
.activity-card:has(.cat--pulse) .activity-card-icon { background: var(--live-pulse-soft); color: var(--live-pulse); }
.activity-card:has(.cat--code)  .activity-card-icon { background: var(--live-code-soft);  color: var(--live-code); }
.activity-card:has(.cat--board) .activity-card-icon { background: var(--live-board-soft); color: var(--live-board); }
.activity-card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.activity-card-meta {
  display: flex; align-items: center; gap: 6px;
}
.activity-card-type {
  font-size: 11px; font-weight: 600;
  color: var(--text-muted);
}
.activity-card-cat {
  font-size: 9px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .4px; padding: 1px 6px; border-radius: 8px;
}
.activity-elapsed {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 13px; font-weight: 700; color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.activity-topbar-cat {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .4px; padding: 2px 8px; border-radius: 10px;
}
.cat--spark  { background: var(--live-spark-soft); color: var(--live-spark); }
.cat--pulse  { background: var(--live-pulse-soft); color: var(--live-pulse); }
.cat--code   { background: var(--live-code-soft);  color: var(--live-code); }
.cat--board  { background: var(--live-board-soft); color: var(--live-board); }
.activity-card-title {
  font-size: 14px; font-weight: 600;
  color: var(--text-primary);
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
  background: rgba(74,144,217,.08); color: var(--accent);
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
  color: var(--text-muted);
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
  color: var(--accent);
}
.activity-topbar-type {
  font-size: 13px; font-weight: 700;
}
.activity-topbar-title {
  flex: 1;
  font-size: 28px;
  font-weight: 800;
  color: var(--text-primary);
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
  background: var(--accent); color: #fff; border: none;
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
  color: var(--text-muted);
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
.auto-close-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-muted);
  user-select: none;
}
.auto-close-toggle input[type="checkbox"] {
  width: 16px; height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
}
.auto-close-label {
  font-weight: 600;
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
.lb-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}
.btn-launch-next {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  background: #22c55e;
  color: #fff;
  border: none;
  cursor: pointer;
  transition: all .15s;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.btn-launch-next:hover { filter: brightness(1.1); }
.btn-dismiss-lb {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  background: var(--accent);
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
  border-radius: 8px;
  font-size: 15px;
  font-weight: 700;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-primary);
  cursor: pointer;
  transition: all .15s;
  z-index: 1;
}
.btn-dismiss-podium:hover { background: var(--bg-hover); }
</style>
