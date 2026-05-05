<!-- StudentLiveView.vue - Vue étudiant pour le Live Quiz interactif -->
<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
  import { Zap, CheckCircle2, Send, LogOut, XCircle, Trophy, RotateCw, ChevronRight, HelpCircle, Hourglass } from 'lucide-vue-next'
  import { useAppStore }  from '@/stores/app'
  import { useLiveStore } from '@/stores/live'
  import { shuffleArray, KAHOOT_COLORS, KAHOOT_SHAPES, isSparkType } from '@/utils/liveActivity'
  import { useLiveReplayMode } from '@/composables/useLiveReplayMode'
  import { useLiveTriSort } from '@/composables/useLiveTriSort'
  import { useLiveTexteATrous } from '@/composables/useLiveTexteATrous'
  import { useLiveConfusionToggle } from '@/composables/useLiveConfusionToggle'
  import { useLiveSelfPaced } from '@/composables/useLiveSelfPaced'
  import { useLiveQcmShuffle } from '@/composables/useLiveQcmShuffle'
  import type { LiveScoreResult } from '@/types'
  import CountdownTimer from './CountdownTimer.vue'
  import QcmResults           from './QcmResults.vue'
  import LiveCodeViewer       from './LiveCodeViewer.vue'
  import LiveBoard            from './LiveBoard.vue'
  import MessageWall          from './MessageWall.vue'
  import LivePulseInput       from './LivePulseInput.vue'
  import PollResults          from './PollResults.vue'
  import AssociationResults   from './AssociationResults.vue'
  import EstimationResults    from './EstimationResults.vue'
  // Pulse results (Rex components reused)
  import RexSondageResults        from '@/components/rex/RexSondageResults.vue'
  import RexWordCloud             from '@/components/rex/RexWordCloud.vue'
  import RexEchelleResults        from '@/components/rex/RexEchelleResults.vue'
  import RexQuestionOuverteResults from '@/components/rex/RexQuestionOuverteResults.vue'
  import RexHumeurResults         from '@/components/rex/RexHumeurResults.vue'
  import RexPrioriteResults       from '@/components/rex/RexPrioriteResults.vue'
  import RexMatriceResults        from '@/components/rex/RexMatriceResults.vue'

  const appStore  = useAppStore()
  const liveStore = useLiveStore()

  /** Current activity is Spark (scored) */
  const isSparkActivity = computed(() => {
    const act = liveStore.currentActivity ?? liveStore.liveActivity
    return act ? isSparkType(act.type) : false
  })

  /** Normalise counts Pulse en array */
  const pulseSondageCounts = computed<{ text: string; count: number }[]>(() => {
    const c = liveStore.results?.counts
    if (!c) return []
    if (Array.isArray(c)) return c as { text: string; count: number }[]
    return Object.entries(c).map(([text, count]) => ({ text, count: Number(count) }))
  })

  /** Parse les options JSON (string -> array) */
  function parseOptions(opts: string | string[] | null | undefined): string[] {
    if (!opts) return []
    if (Array.isArray(opts)) return opts
    try { const arr = JSON.parse(opts); return Array.isArray(arr) ? arr : [] } catch { return [] }
  }

  const joinCode  = ref('')
  const joining   = ref(false)
  const textInput = ref('')

  // Selected QCM answers (indices)
  const selectedAnswers = ref<number[]>([])
  // Association: student mapping (index of right item for each left item)
  const associationMapping = ref<number[]>([])
  // Shuffled right-column indices for association
  const shuffledRight = ref<number[]>([])

  /** Mode entrainement asynchrone : apres la fin de la session, l'etudiant peut
   *  refaire le quiz en solo. Les reponses vont dans live_responses_v2.mode='replay'
   *  et n'impactent pas le leaderboard live. */
  const {
    active: replayMode,
    index: replayIndex,
    feedback: replayFeedback,
    score: replayScore,
    sparkActivities: replaySparkActivities,
    currentActivity: replayCurrentActivity,
    finished: replayFinished,
    start: startReplay,
    next: nextReplayQuestion,
    exit: exitReplay,
    submit: submitReplay,
  } = useLiveReplayMode({ selectedAnswers, textInput, associationMapping })

  const parsedPairs = computed(() => {
    try { return JSON.parse(activity.value?.correct_answers as string ?? '[]') } catch { return [] }
  })

  const promoId = computed(() => appStore.currentUser?.promo_id ?? 0)
  const session = computed(() => liveStore.currentSession)
  const activity = computed(() => liveStore.currentActivity)
  const scoreResult = ref<LiveScoreResult | null>(null)
  const timerExpired = ref(false)
  const cumulativePoints = ref(0)

  // Reset cumulative score when session changes
  watch(session, () => { cumulativePoints.value = 0 })

  const studentIdRef = computed(() => appStore.currentUser?.id ?? 1)

  // ── Activite "tri" (sorting) ────────────────────────────────────────────
  const { order: triOrder, options: triOptions, moveUp: triMoveUp, moveDown: triMoveDown, submit: doSubmitTri } = useLiveTriSort(activity, studentIdRef)
  async function submitTri() { await doSubmitTri(accumulateScore) }

  // ── Activite "texte a trous" ────────────────────────────────────────────
  const { inputs: tatBlanksInputs, parts: tatParts, submit: doSubmitTat } = useLiveTexteATrous(activity)
  async function submitTexteATrous() { await doSubmitTat(accumulateScore) }

  // ── Confusion signal (Wooclap "I'm confused") ───────────────────────────
  const { confused: isConfused, loading: confusionLoading, toggle: toggleConfusion } = useLiveConfusionToggle()

  // ── Self-paced mode ─────────────────────────────────────────────────────
  const {
    isActive: isSelfPaced,
    index: selfPacedIndex,
    activities: selfPacedActivities,
    respondedIds: respondedActivityIds,
    completed: selfPacedCompleted,
    next: selfPacedNext,
    goTo: selfPacedGoTo,
  } = useLiveSelfPaced()

  // ── QCM shuffle (options melangees par etudiant) ────────────────────────
  const { shuffleMap: qcmShuffleMap, shuffledOptions } = useLiveQcmShuffle(activity, studentIdRef)

  // Reset student inputs + association shuffle + flags au changement d'activite
  watch(activity, (act) => {
    selectedAnswers.value = []
    textInput.value = ''

    if (act?.type === 'association' && act.correct_answers) {
      try {
        const parsed = JSON.parse(act.correct_answers as unknown as string)
        const len = Array.isArray(parsed) ? parsed.length : 0
        associationMapping.value = Array(len).fill(-1)
        shuffledRight.value = shuffleArray(Array.from({ length: len }, (_, i) => i))
      } catch { associationMapping.value = []; shuffledRight.value = [] }
    }
    liveStore.hasResponded = false
    scoreResult.value = null
    timerExpired.value = false
  })

  // Sessions terminees pour la revision : on charge l'historique pour
  // afficher des cartes cliquables "Reviser cette session" dans l'ecran
  // d'accueil (no-session). Click -> fetchSession + replay automatique.
  const pastSessions = computed(() => liveStore.historySessions ?? [])
  const loadingPast = ref(false)
  const reviewLoading = ref<number | string | null>(null)

  onMounted(async () => {
    liveStore.initSocketListeners()
    // Auto-detect active session for promo
    if (!session.value && promoId.value) {
      await liveStore.fetchActiveForPromo(promoId.value)
    }
    // Charge l'historique en arriere-plan : utile meme si pas de session
    // active (ecran "Sessions terminees"). Silencieux en cas d'echec.
    if (promoId.value) {
      loadingPast.value = true
      try { await liveStore.fetchHistory(promoId.value) } catch { /* tolere */ }
      finally { loadingPast.value = false }
    }
  })
  onUnmounted(() => {
    liveStore.disposeSocketListeners()
  })

  async function joinSession() {
    if (!joinCode.value.trim()) return
    joining.value = true
    await liveStore.joinByCode(joinCode.value.trim().toUpperCase())
    joining.value = false
  }

  async function reviewPastSession(sessionId: number | string) {
    reviewLoading.value = sessionId
    try {
      await liveStore.fetchSession(sessionId as number)
      // Si la session contient des questions Spark, on demarre le mode
      // entrainement direct pour eviter un clic supplementaire. Sinon le
      // visiteur voit le recap (cf. replay-offer condition).
      if (liveStore.currentSession?.status === 'ended' && replaySparkActivities.value.length > 0) {
        startReplay()
      }
    } finally {
      reviewLoading.value = null
    }
  }

  function formatRelative(iso: string | null | undefined): string {
    if (!iso) return ''
    const ms = Date.now() - new Date(iso).getTime()
    const day = Math.floor(ms / 86_400_000)
    if (day <= 0) return 'aujourd\'hui'
    if (day === 1) return 'hier'
    if (day < 7) return `il y a ${day} j`
    if (day < 30) return `il y a ${Math.floor(day / 7)} sem`
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  function toggleAnswer(index: number) {
    const idx = selectedAnswers.value.indexOf(index)
    if (activity.value?.multi) {
      if (idx >= 0) selectedAnswers.value.splice(idx, 1)
      else selectedAnswers.value.push(index)
    } else {
      selectedAnswers.value = idx >= 0 ? [] : [index]
    }
  }

  function accumulateScore(result: LiveScoreResult) {
    scoreResult.value = result
    if (result.points > 0) cumulativePoints.value += result.points
  }

  // Track responded activities in self-paced mode
  watch(() => liveStore.hasResponded, (responded) => {
    if (responded && isSelfPaced.value && activity.value) {
      respondedActivityIds.value = new Set([...respondedActivityIds.value, activity.value.id])
    }
  })

  async function submitQcm() {
    if (!activity.value || selectedAnswers.value.length === 0) return
    const result = await liveStore.submitResponse(activity.value.id, { answers: selectedAnswers.value })
    if (result) accumulateScore(result)
  }

  async function submitAssociation() {
    if (!activity.value || associationMapping.value.some(v => v === -1)) return
    const result = await liveStore.submitResponse(activity.value.id, { answer: associationMapping.value.join(',') })
    if (result) accumulateScore(result)
  }

  async function submitEstimation() {
    if (!activity.value || !textInput.value.trim()) return
    const result = await liveStore.submitResponse(activity.value.id, { text: textInput.value.trim() })
    if (result) accumulateScore(result)
  }

  function onTimerExpired() {
    timerExpired.value = true
    // Auto-submit if answers selected but not yet submitted
    if (!liveStore.hasResponded && selectedAnswers.value.length > 0) {
      submitQcm()
    }
  }

  async function submitText() {
    if (!activity.value || !textInput.value.trim()) return
    await liveStore.submitResponse(activity.value.id, { text: textInput.value.trim() })
  }

  function leave() {
    liveStore.leaveSession()
    exitReplay()
  }
</script>

<template>
  <div class="student-live">
    <!-- ══════════ Pas de session ══════════ -->
    <div v-if="!session" class="live-join">
      <div class="join-hero">
        <div class="join-hero-icon" aria-hidden="true">
          <Zap :size="26" />
        </div>
        <h1 class="hero-title">Live</h1>
        <p class="hero-desc">Rejoins une session interactive avec un code.</p>
      </div>

      <div class="join-card">
        <label for="live-join-code" class="join-label">Code de session</label>
        <input
          id="live-join-code"
          v-model="joinCode"
          class="join-input"
          placeholder="ABCDEF"
          maxlength="6"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          inputmode="text"
          @keydown.enter="joinSession"
        />
        <button
          class="join-btn"
          :disabled="joinCode.trim().length < 4 || joining"
          @click="joinSession"
        >
          {{ joining ? 'Connexion...' : 'Rejoindre' }}
        </button>
        <p class="join-hint">
          Le code à 6 caractères est communiqué par ton enseignant au début de la séance.
        </p>
      </div>

      <section v-if="pastSessions.length || loadingPast" class="past-sessions">
        <header class="past-sessions-head">
          <RotateCw :size="14" />
          <h2>Sessions terminées</h2>
          <span class="past-sessions-hint">Refais une session passée à ton rythme.</span>
        </header>
        <ul class="past-sessions-list">
          <li v-for="s in pastSessions" :key="String(s.id)" class="past-session-card">
            <button
              type="button"
              class="past-session-btn"
              :disabled="reviewLoading !== null"
              :aria-busy="reviewLoading === s.id"
              @click="reviewPastSession(s.id)"
            >
              <span class="past-session-title">{{ s.title }}</span>
              <span class="past-session-meta">
                <span v-if="s.activity_count">{{ s.activity_count }} activité{{ s.activity_count > 1 ? 's' : '' }}</span>
                <span v-if="s.participant_count">· {{ s.participant_count }} participants</span>
                <span v-if="s.ended_at">· {{ formatRelative(s.ended_at) }}</span>
              </span>
              <span class="past-session-cta">
                <RotateCw :size="14" />
                {{ reviewLoading === s.id ? 'Chargement...' : 'Réviser' }}
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>

    <!-- ══════════ En session ══════════
         v2.277 : tag du wrapper avec class replay-mode quand l'etudiant est
         en entrainement, pour permettre une teinte de fond + banniere
         distinctive (sans tout dupliquer). -->
    <div v-else class="live-in-session" :class="{ 'is-replay': replayMode }">
      <!-- Banniere mode entrainement : ruban fixe en haut, signale
           clairement "tu n'es plus en live, tu refais en solo" pour eviter
           la confusion avec une vraie session. -->
      <div v-if="replayMode" class="replay-banner" role="status">
        <RotateCw :size="14" />
        <span><strong>Mode entrainement</strong> — tu refais cette session en solo, les resultats restent locaux.</span>
      </div>
      <div class="session-bar">
        <span class="session-bar-title">
          {{ session.title }}
          <span v-if="replayMode" class="session-bar-mode">Entrainement</span>
        </span>
        <button class="btn-leave" @click="leave">
          <LogOut :size="14" />
          Quitter
        </button>
      </div>

      <!-- ═════ Session terminee : proposer Mode entrainement (replay asynchrone) ═════ -->
      <div v-if="session.status === 'ended' && !replayMode && replaySparkActivities.length > 0" class="replay-offer">
        <div class="replay-offer-icon"><Trophy :size="32" /></div>
        <h2 class="replay-offer-title">Cette session est terminee</h2>
        <p class="replay-offer-desc">
          Tu peux la refaire en mode entrainement a ton rythme. Les bonnes reponses sont
          notees pour t'entrainer, mais ton score n'apparait pas sur le classement live.
        </p>
        <button class="replay-offer-btn" @click="startReplay">
          <RotateCw :size="18" />
          Demarrer l'entrainement ({{ replaySparkActivities.length }} question{{ replaySparkActivities.length > 1 ? 's' : '' }})
        </button>
      </div>

      <!-- ═════ Mode replay : recap final quand toutes les questions sont faites ═════ -->
      <div v-else-if="replayMode && replayFinished" class="replay-end">
        <div class="replay-end-icon"><Trophy :size="40" /></div>
        <h2 class="replay-end-title">Entrainement termine</h2>
        <p class="replay-end-score">{{ replayScore.toLocaleString() }} <span class="rep-pts">points</span></p>
        <div class="replay-end-actions">
          <button class="replay-offer-btn" @click="startReplay">
            <RotateCw :size="16" /> Recommencer
          </button>
          <button class="btn-leave" @click="exitReplay">
            Sortir
          </button>
        </div>
      </div>

      <!-- ═════ Mode replay : question courante ═════ -->
      <div v-else-if="replayMode && replayCurrentActivity" class="response-area replay-area">
        <div class="replay-progress">
          <span>Question {{ replayIndex + 1 }} / {{ replaySparkActivities.length }}</span>
          <span class="replay-score-pill">{{ replayScore.toLocaleString() }} pts</span>
        </div>
        <h2 class="question-title">{{ replayCurrentActivity.title }}</h2>

        <!-- Feedback apres reponse -->
        <div v-if="replayFeedback" class="replay-feedback" :class="{ correct: replayFeedback.isCorrect, wrong: replayFeedback.isCorrect === false }">
          <component :is="replayFeedback.isCorrect ? CheckCircle2 : XCircle" :size="32" />
          <div class="rf-text">
            <span class="rf-head">{{ replayFeedback.isCorrect ? 'Bonne reponse !' : 'Mauvaise reponse' }}</span>
            <span v-if="replayFeedback.points > 0" class="rf-pts">+{{ replayFeedback.points }} pts</span>
          </div>
          <button class="submit-btn replay-next-btn" @click="nextReplayQuestion">
            <ChevronRight :size="18" />
            {{ replayIndex + 1 >= replaySparkActivities.length ? 'Voir le resultat' : 'Suivante' }}
          </button>
        </div>

        <!-- Sinon : UI de reponse -->
        <template v-else>
          <!-- QCM -->
          <div v-if="replayCurrentActivity.type === 'qcm' && replayCurrentActivity.options" class="kahoot-grid">
            <button
              v-for="(opt, i) in parseOptions(replayCurrentActivity.options as string | string[])"
              :key="i"
              class="kahoot-btn"
              :class="{ selected: selectedAnswers.includes(i) }"
              :style="{ '--kahoot-color': KAHOOT_COLORS[i % KAHOOT_COLORS.length] }"
              @click="selectedAnswers = selectedAnswers.includes(i) ? selectedAnswers.filter(x => x !== i) : [...selectedAnswers, i]"
            >
              <span class="kahoot-shape">{{ KAHOOT_SHAPES[i % KAHOOT_SHAPES.length] }}</span>
              <span class="kahoot-text">{{ opt }}</span>
            </button>
          </div>
          <!-- V/F -->
          <div v-else-if="replayCurrentActivity.type === 'vrai_faux'" class="vf-grid">
            <button class="vf-btn vf-vrai" :class="{ selected: selectedAnswers.includes(0) }" @click="selectedAnswers = [0]">Vrai</button>
            <button class="vf-btn vf-faux" :class="{ selected: selectedAnswers.includes(1) }" @click="selectedAnswers = [1]">Faux</button>
          </div>
          <!-- Reponse courte / Estimation -->
          <input
            v-else-if="replayCurrentActivity.type === 'reponse_courte' || replayCurrentActivity.type === 'estimation'"
            v-model="textInput"
            class="text-input"
            :type="replayCurrentActivity.type === 'estimation' ? 'number' : 'text'"
            placeholder="Ta reponse..."
            @keydown.enter="submitReplay"
          />
          <p v-else class="waiting-text">Type d'activite non jouable en entrainement.</p>

          <button class="submit-btn kahoot-submit" @click="submitReplay">
            <Send :size="16" /> Envoyer
          </button>
        </template>
      </div>

      <!-- Self-paced : barre de progression + navigation activites -->
      <div v-if="isSelfPaced && !liveStore.hasResponded" class="sp-bar">
        <div class="sp-bar-top">
          <span class="sp-badge">Auto-rythme</span>
          <span class="sp-progress-label">{{ selfPacedCompleted }} / {{ selfPacedActivities.length }} complete{{ selfPacedCompleted > 1 ? 'es' : 'e' }}</span>
        </div>
        <div class="sp-progress-track">
          <div class="sp-progress-fill" :style="{ width: (selfPacedActivities.length > 0 ? selfPacedCompleted / selfPacedActivities.length * 100 : 0) + '%' }" />
        </div>
        <div class="sp-pills">
          <button
            v-for="(act, i) in selfPacedActivities" :key="act.id"
            :class="['sp-pill', { active: i === selfPacedIndex, done: respondedActivityIds.has(act.id) }]"
            :title="act.title"
            @click="selfPacedGoTo(i)"
          >
            <span class="sp-pill-num">{{ i + 1 }}</span>
            <span v-if="respondedActivityIds.has(act.id)" class="sp-pill-check">ok</span>
          </button>
        </div>
      </div>

      <!-- Waiting for activity (mode live uniquement, PAS en self-paced).
           v2.277 : refonte de l'attente — au lieu de 3 dots vides, on
           rassure l'etudiant avec une icone, un titre clair et une astuce
           contextuelle. Cf. Wooclap / Mentimeter qui affichent un tip pendant
           l'attente. -->
      <div v-else-if="!isSelfPaced && (!activity || activity.status === 'pending')" class="waiting-state">
        <div class="waiting-icon" aria-hidden="true">
          <Hourglass :size="36" />
          <span class="waiting-pulse-ring" />
        </div>
        <h2 class="waiting-title">Le prof prepare la prochaine question</h2>
        <p class="waiting-hint">Reste sur cette page, elle s'affichera automatiquement.</p>
        <div class="waiting-dots" aria-hidden="true">
          <span class="dot" />
          <span class="dot" />
          <span class="dot" />
        </div>
      </div>

      <!-- Activity live (ou self-paced) + not responded yet -->
      <div v-else-if="activity && (activity.status === 'live' || isSelfPaced) && !liveStore.hasResponded" class="response-area">
        <!-- Countdown timer (Spark + Pulse avec timer configure) -->
        <div v-if="liveStore.timerStartedAt && activity.timer_seconds" class="timer-bar">
          <CountdownTimer
            :total-seconds="activity.timer_seconds"
            :started-at="liveStore.timerStartedAt"
            @expired="onTimerExpired"
          />
        </div>

        <h2 class="question-title">{{ activity.title }}</h2>

        <!-- QCM Kahoot-style buttons (shuffled) -->
        <div v-if="activity.type === 'qcm' && activity.options" class="kahoot-grid">
          <button
            v-for="(opt, displayIdx) in shuffledOptions"
            :key="qcmShuffleMap[displayIdx]"
            class="kahoot-btn"
            :class="{ selected: selectedAnswers.includes(qcmShuffleMap[displayIdx]) }"
            :style="{ '--kahoot-color': KAHOOT_COLORS[displayIdx % KAHOOT_COLORS.length] }"
            @click="toggleAnswer(qcmShuffleMap[displayIdx])"
          >
            <span class="kahoot-shape">{{ KAHOOT_SHAPES[displayIdx % KAHOOT_SHAPES.length] }}</span>
            <span class="kahoot-text">{{ opt }}</span>
          </button>
        </div>
        <button
          v-if="activity.type === 'qcm'"
          class="submit-btn kahoot-submit"
          :disabled="selectedAnswers.length === 0"
          @click="submitQcm"
        >
          <Send :size="16" />
          Envoyer
        </button>

        <!-- Vrai/Faux response -->
        <div v-else-if="activity.type === 'vrai_faux'" class="vf-response">
          <div class="vf-grid">
            <button class="vf-btn vf-vrai" :class="{ selected: selectedAnswers.includes(0) }" @click="selectedAnswers = [0]">Vrai</button>
            <button class="vf-btn vf-faux" :class="{ selected: selectedAnswers.includes(1) }" @click="selectedAnswers = [1]">Faux</button>
          </div>
          <button class="submit-btn" :disabled="selectedAnswers.length === 0" @click="submitQcm">
            <Send :size="16" /> Envoyer
          </button>
        </div>

        <!-- Reponse courte -->
        <div v-else-if="activity.type === 'reponse_courte'" class="text-response">
          <input v-model="textInput" class="text-input short-input" placeholder="Votre reponse..." maxlength="100" @keydown.enter="submitText" />
          <button class="submit-btn" :disabled="!textInput.trim()" @click="submitText">
            <Send :size="16" /> Envoyer
          </button>
        </div>

        <!-- Association -->
        <div v-else-if="activity.type === 'association' && activity.correct_answers" class="association-response">
          <div v-for="(leftIdx, i) in associationMapping.length" :key="i" class="assoc-row">
            <span class="assoc-left">{{ parsedPairs[i]?.left }}</span>
            <span class="assoc-arrow">&rarr;</span>
            <select v-model.number="associationMapping[i]" class="assoc-select">
              <option :value="-1" disabled>Choisir...</option>
              <option v-for="si in shuffledRight" :key="si" :value="si">
                {{ parsedPairs[si]?.right }}
              </option>
            </select>
          </div>
          <button class="submit-btn" :disabled="associationMapping.some(v => v === -1)" @click="submitAssociation">
            <Send :size="16" /> Envoyer
          </button>
        </div>

        <!-- Estimation -->
        <div v-else-if="activity.type === 'estimation'" class="text-response">
          <input v-model="textInput" class="text-input short-input" type="number" step="any" placeholder="Votre estimation..." @keydown.enter="submitEstimation" />
          <button class="submit-btn" :disabled="!textInput.trim()" @click="submitEstimation">
            <Send :size="16" /> Envoyer
          </button>
        </div>

        <!-- Tri (Sorting) : remettre dans le bon ordre -->
        <div v-else-if="activity.type === 'tri'" class="tri-response">
          <div class="tri-list">
            <div v-for="(origIdx, i) in triOrder" :key="origIdx" class="tri-item">
              <span class="tri-rank">{{ i + 1 }}</span>
              <span class="tri-label">{{ triOptions[origIdx] }}</span>
              <div class="tri-arrows">
                <button class="tri-arrow" :disabled="i === 0" @click="triMoveUp(i)">&#9650;</button>
                <button class="tri-arrow" :disabled="i === triOrder.length - 1" @click="triMoveDown(i)">&#9660;</button>
              </div>
            </div>
          </div>
          <button class="submit-btn" @click="submitTri">
            <Send :size="16" /> Envoyer
          </button>
        </div>

        <!-- Texte a trous (Fill in the Blanks) -->
        <div v-else-if="activity.type === 'texte_a_trous'" class="tat-response">
          <div class="tat-text">
            <template v-for="(seg, i) in tatParts.segments" :key="i">
              <span>{{ seg }}</span>
              <input
                v-if="i < tatParts.blanksCount"
                v-model="tatBlanksInputs[i]"
                class="tat-blank-input"
                :placeholder="'...'"
                maxlength="50"
                @keydown.enter="submitTexteATrous"
              />
            </template>
          </div>
          <button class="submit-btn" :disabled="tatBlanksInputs.some(b => !b.trim())" @click="submitTexteATrous">
            <Send :size="16" /> Envoyer
          </button>
        </div>

        <!-- Live Code (read-only viewer) -->
        <LiveCodeViewer
          v-else-if="activity.type === 'live_code'"
          :activity-id="activity.id"
          :initial-content="activity.content ?? ''"
          :initial-language="activity.language ?? 'javascript'"
        />

        <!-- Board (collaboratif) -->
        <LiveBoard
          v-else-if="activity.type === 'board'"
          :activity-id="activity.id"
          :is-teacher="false"
          :columns="parseOptions(activity.options)"
        />
        <!-- Message Wall -->
        <MessageWall
          v-else-if="activity.type === 'message_wall'"
          :activity-id="activity.id"
          :is-teacher="false"
        />

        <!-- Pulse : inputs anonymes (echelle, humeur, question ouverte, etc.) -->
        <LivePulseInput
          v-else-if="['sondage_libre','nuage','echelle','question_ouverte','sondage','humeur','priorite','matrice'].includes(activity.type)"
          :activity="activity"
          @submitted="liveStore.hasResponded = true"
        />

      </div>

      <!-- Responded - waiting for results -->
      <div v-else-if="activity && liveStore.hasResponded && (activity.status === 'live' || isSelfPaced)" class="responded-state">
        <!-- Spark : score feedback (correct/incorrect) -->
        <div v-if="isSparkActivity && scoreResult && scoreResult.isCorrect !== null" class="score-feedback">
          <div v-if="scoreResult.isCorrect" class="feedback-correct">
            <CheckCircle2 :size="56" />
            <span class="feedback-label">Correct !</span>
            <span class="feedback-points">+{{ scoreResult.points }} pts</span>
            <span v-if="(scoreResult.streak ?? 0) >= 2" class="feedback-streak">
              {{ scoreResult.streak }}x serie !
            </span>
            <span v-if="scoreResult.rank" class="feedback-rank">{{ scoreResult.rank }}{{ scoreResult.rank === 1 ? 'er' : 'e' }} place</span>
          </div>
          <div v-else class="feedback-wrong">
            <XCircle :size="56" />
            <span class="feedback-label">Raté</span>
            <span class="feedback-points">+0 pts</span>
          </div>
        </div>
        <!-- Pulse : simple confirmation anonyme -->
        <div v-else class="waiting-response">
          <CheckCircle2 :size="48" class="responded-icon" />
          <span class="responded-text">{{ isSparkActivity ? 'Reponse envoyee' : 'Merci pour votre retour' }}</span>
          <span class="responded-sub">{{ isSparkActivity ? 'Les resultats apparaitront bientot' : 'Votre reponse est anonyme' }}</span>
        </div>
        <!-- Self-paced : bouton suivante apres reponse -->
        <button
          v-if="isSelfPaced && selfPacedIndex < selfPacedActivities.length - 1"
          class="sp-next-btn"
          @click="selfPacedNext"
        >
          <ChevronRight :size="16" />
          Question suivante
        </button>
        <div v-else-if="isSelfPaced && selfPacedCompleted === selfPacedActivities.length" class="sp-done">
          <CheckCircle2 :size="32" class="responded-icon" />
          <span class="sp-done-text">Toutes les questions sont completees !</span>
        </div>
      </div>

      <!-- Activity closed - show results + score -->
      <div v-else-if="activity && activity.status === 'closed'" class="results-student">
        <!-- Score feedback for this activity (Spark only) -->
        <div v-if="isSparkActivity && scoreResult && scoreResult.isCorrect !== null" class="score-feedback-closed">
          <div class="feedback-inline" :class="scoreResult.isCorrect ? 'correct' : 'wrong'">
            <component :is="scoreResult.isCorrect ? CheckCircle2 : XCircle" :size="24" />
            <span>{{ scoreResult.isCorrect ? 'Correct' : 'Incorrect' }}</span>
            <span class="feedback-points-inline">+{{ scoreResult.points }} pts</span>
          </div>
        </div>
        <h3 class="results-label">Resultats</h3>
        <!-- Spark results -->
        <QcmResults v-if="(activity.type === 'qcm' || activity.type === 'vrai_faux') && liveStore.results" :results="liveStore.results" />
        <PollResults v-else-if="activity.type === 'reponse_courte' && liveStore.results" :results="liveStore.results" />
        <AssociationResults v-else-if="activity.type === 'association' && liveStore.results" :results="liveStore.results" />
        <EstimationResults v-else-if="activity.type === 'estimation' && liveStore.results" :results="liveStore.results" />
        <!-- Pulse results -->
        <RexQuestionOuverteResults v-else-if="activity.type === 'question_ouverte' && liveStore.results?.answers" :answers="liveStore.results.answers" :is-teacher="false" />
        <RexSondageResults v-else-if="(activity.type === 'sondage' || activity.type === 'sondage_libre') && pulseSondageCounts.length" :results="pulseSondageCounts" :total="liveStore.results?.total ?? 0" />
        <RexEchelleResults v-else-if="activity.type === 'echelle' && liveStore.results?.average !== undefined" :average="liveStore.results.average" :max-rating="activity.max_rating ?? 5" :distribution="liveStore.results.distribution ?? []" :total="liveStore.results.total ?? 0" />
        <RexWordCloud v-else-if="activity.type === 'nuage' && liveStore.results?.freq" :words="liveStore.results.freq" />
        <RexHumeurResults v-else-if="activity.type === 'humeur' && liveStore.results?.emojis" :emojis="liveStore.results.emojis" :total="liveStore.results.total ?? 0" />
        <RexPrioriteResults v-else-if="activity.type === 'priorite' && liveStore.results?.rankings" :rankings="liveStore.results.rankings" :total="liveStore.results.total ?? 0" />
        <RexMatriceResults v-else-if="activity.type === 'matrice' && liveStore.results?.criteria" :criteria="liveStore.results.criteria" :max-rating="activity.max_rating ?? 5" :total="liveStore.results.total ?? 0" />
        <!-- Code : snapshot final -->
        <LiveCodeViewer v-else-if="activity.type === 'live_code'" :activity-id="activity.id" :initial-content="activity.content ?? ''" :initial-language="activity.language ?? 'javascript'" />
        <!-- Board : vue finale -->
        <LiveBoard v-else-if="activity.type === 'board'" :activity-id="activity.id" :is-teacher="false" :columns="parseOptions(activity.options)" :max-votes="activity.max_rating ?? 3" />
        <!-- Message Wall : vue finale -->
        <MessageWall v-else-if="activity.type === 'message_wall'" :activity-id="activity.id" :is-teacher="false" />
      </div>
    </div>

    <!-- ══════════ Score cumule flottant ══════════ -->
    <div v-if="session && cumulativePoints > 0 && isSparkActivity" class="cumulative-score">
      <Trophy :size="14" />
      <span>{{ cumulativePoints.toLocaleString() }} pts</span>
    </div>

    <!-- ══════════ Bouton "Je suis perdu" (confusion signal) ══════════ -->
    <button
      v-if="session && session.status === 'active'"
      :class="['confusion-btn', { active: isConfused }]"
      :disabled="confusionLoading"
      @click="toggleConfusion"
    >
      <HelpCircle :size="16" />
      <span>{{ isConfused ? 'Signal envoye' : 'Je suis perdu' }}</span>
    </button>
  </div>
</template>

<style scoped>
.student-live {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  background: var(--bg-main);
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ── Join ── */
.live-join {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xl);
  max-width: 420px;
  width: 100%;
  margin-top: 72px;
}
.join-hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}
.join-hero-icon {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-live) 18%, transparent);
  color: var(--color-live);
  box-shadow: 0 2px 10px color-mix(in srgb, var(--color-live) 25%, transparent);
}
.hero-title {
  /* v2.278 : letter-spacing -0.03em + line-height 1.15 = signature display
     landing (.hero-headline cf. src/landing/style.css). */
  font-family: var(--font-display);
  font-size: 26px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.03em;
  line-height: 1.15;
}
.hero-desc {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0;
  max-width: 360px;
}
.join-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-xl);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
}
.join-label {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--color-live);
  margin-bottom: 4px;
}
.join-input {
  width: 100%;
  padding: 16px;
  border-radius: var(--radius);
  background: var(--bg-input, var(--bg-hover));
  border: 2px solid var(--border-input, var(--border));
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 700;
  font-family: var(--font-mono, 'JetBrains Mono', 'Fira Code', ui-monospace, monospace);
  text-align: center;
  letter-spacing: 6px;
  text-transform: uppercase;
  outline: none;
  transition: border-color var(--motion-fast) var(--ease-out),
              box-shadow   var(--motion-fast) var(--ease-out);
}
.join-input:focus {
  border-color: var(--color-live);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-live) 22%, transparent);
}
.join-input::placeholder {
  color: var(--text-muted);
  opacity: .5;
}
.join-btn {
  padding: 14px;
  border-radius: var(--radius);
  font-size: 15px;
  font-weight: 700;
  background: var(--color-live);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: filter    var(--motion-fast) var(--ease-out),
              transform var(--motion-fast) var(--ease-out),
              box-shadow var(--motion-fast) var(--ease-out);
  min-height: 48px;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--color-live) 25%, transparent);
}
.join-btn:hover { filter: brightness(1.1); transform: translateY(-1px); }
.join-btn:active { transform: translateY(0); }
.join-btn:disabled {
  opacity: .4;
  cursor: not-allowed;
  transform: none;
  filter: none;
}
.join-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  text-align: center;
  line-height: 1.5;
}

@media (prefers-reduced-motion: reduce) {
  .join-input, .join-btn { transition: none !important; }
  .join-btn:hover { transform: none; }
}

/* ── Sessions terminees (revision asynchrone) ── */
.past-sessions {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.past-sessions-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-muted);
}
.past-sessions-head h2 {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin: 0;
}
.past-sessions-hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
}
.past-sessions-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.past-session-card {
  width: 100%;
}
.past-session-btn {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  gap: 4px 12px;
  align-items: center;
  padding: 12px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border-color);
  background: var(--bg-elevated);
  cursor: pointer;
  text-align: left;
  transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
}
.past-session-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: color-mix(in srgb, var(--color-live) 35%, var(--border));
  transform: translateY(-1px);
  box-shadow: 0 6px 18px color-mix(in srgb, var(--color-live) 14%, transparent);
}
.past-session-btn:disabled {
  opacity: 0.6;
  cursor: progress;
}
.past-session-title {
  grid-column: 1;
  grid-row: 1;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.past-session-meta {
  grid-column: 1;
  grid-row: 2;
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.past-session-cta {
  grid-column: 2;
  grid-row: 1 / span 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-live) 12%, transparent);
  color: var(--color-live);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
}

@media (prefers-reduced-motion: reduce) {
  .past-session-btn { transition: none !important; }
  .past-session-btn:hover { transform: none; }
}

/* ── In session ── */
.live-in-session {
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
.session-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}
.session-bar-title {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -.1px;
}
.btn-leave {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600;
  background: rgba(239,68,68,.08); color: #f87171;
  border: 1px solid rgba(239,68,68,.15); cursor: pointer;
  transition: all .15s;
}
.btn-leave:hover { background: rgba(239,68,68,.15); }

/* ── Replay mode (v2.277) ───────────────────────────────────────────────
   Distinction visuelle claire entre live et entrainement : tint de fond
   subtile + banniere fixe en haut avec icone RotateCw. Evite la confusion
   "j'ai eu juste mais c'etait la mauvaise reponse au moment du live". */
.live-in-session.is-replay {
  background: linear-gradient(180deg,
    rgba(var(--accent-rgb), 0.04) 0%,
    transparent 240px);
}
.replay-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(var(--accent-rgb), 0.10);
  border-bottom: 1px solid rgba(var(--accent-rgb), 0.25);
  color: var(--accent);
  font-size: 13px;
  text-align: center;
}
.replay-banner svg { flex-shrink: 0; }

/* ── Waiting state (v2.277) ─────────────────────────────────────────────
   Refonte : icone hourglass + ring pulse + titre rassurant + tip + dots.
   Cf. Wooclap / Mentimeter — l'attente devient un moment narratif, pas un
   ecran vide. */
.waiting-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 60px 24px;
  text-align: center;
}
.waiting-icon {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(var(--accent-rgb), 0.10);
  color: var(--accent);
}
.waiting-pulse-ring {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 2px solid rgba(var(--accent-rgb), 0.45);
  animation: waiting-pulse 2.2s ease-out infinite;
}
@keyframes waiting-pulse {
  0%   { transform: scale(0.85); opacity: 0.75; }
  100% { transform: scale(1.25); opacity: 0; }
}
.waiting-title {
  margin: 4px 0 0;
  font-size: 19px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}
.waiting-hint {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted);
  max-width: 360px;
  line-height: 1.5;
}
.waiting-dots {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: dot-bounce 1.4s ease-in-out infinite;
}
.dot:nth-child(2) { animation-delay: .16s; }
.dot:nth-child(3) { animation-delay: .32s; }
@keyframes dot-bounce {
  0%, 80%, 100% { transform: scale(0.6); opacity: .3; }
  40% { transform: scale(1); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .waiting-pulse-ring,
  .dot { animation: none; }
}

/* ── Response area ── */
.response-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.question-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -.2px;
  text-align: center;
}

/* Timer bar */
.timer-bar {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}

/* Kahoot QCM grid */
.kahoot-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.kahoot-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  border-radius: var(--radius-lg);
  background: var(--kahoot-color);
  border: 3px solid transparent;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all .15s;
  text-align: left;
  min-height: 72px;
  position: relative;
  overflow: hidden;
}
.kahoot-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0);
  transition: background .15s;
}
.kahoot-btn:hover::after {
  background: rgba(255,255,255,.1);
}
.kahoot-btn.selected {
  border-color: #fff;
  transform: scale(1.03);
  box-shadow: 0 4px 20px rgba(0,0,0,.3);
}
.kahoot-shape {
  font-size: 24px;
  flex-shrink: 0;
  opacity: .8;
}
.kahoot-text {
  flex: 1;
  line-height: 1.3;
}
.kahoot-submit {
  margin-top: 8px;
}

/* Score feedback */
.score-feedback {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}
.feedback-correct, .feedback-wrong {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  animation: feedback-pop .4s cubic-bezier(.34,1.56,.64,1);
}
.feedback-correct { color: #22c55e; }
.feedback-wrong   { color: #ef4444; }
.feedback-label {
  font-size: 24px;
  font-weight: 800;
}
.feedback-points {
  font-size: 28px;
  font-weight: 900;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
.feedback-streak {
  font-size: 18px;
  font-weight: 800;
  color: #f59e0b;
  background: rgba(245,158,11,.12);
  padding: 4px 14px;
  border-radius: 20px;
  animation: feedback-pop .4s cubic-bezier(.34,1.56,.64,1);
}
.feedback-rank {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-muted);
}
@keyframes feedback-pop {
  from { transform: scale(.5); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}

.score-feedback-closed {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}
.feedback-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-weight: 700;
}
.feedback-inline.correct {
  background: rgba(34,197,94,.12);
  color: #22c55e;
}
.feedback-inline.wrong {
  background: rgba(239,68,68,.12);
  color: #ef4444;
}
.feedback-points-inline {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-weight: 800;
}
.waiting-response {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

/* Text input */
.text-response {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.text-input {
  width: 100%;
  padding: 14px 16px;
  border-radius: var(--radius);
  background: var(--bg-elevated);
  border: 2px solid var(--border);
  color: var(--text-primary);
  font-size: 15px;
  font-family: inherit;
  resize: vertical;
  outline: none;
  transition: border-color .15s;
}
.text-input:focus {
  border-color: var(--color-live);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-live) 18%, transparent);
}

/* Word inputs */
.word-response {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.word-inputs {
  display: flex;
  gap: 10px;
}
.word-input {
  flex: 1;
  padding: 14px 16px;
  border-radius: var(--radius);
  background: var(--bg-elevated);
  border: 2px solid var(--border);
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  font-family: inherit;
  outline: none;
  transition: border-color .15s;
  min-height: 52px;
}
.word-input:focus {
  border-color: var(--color-live);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-live) 18%, transparent);
}

/* Submit */
.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border-radius: var(--radius);
  font-size: 16px;
  font-weight: 700;
  background: var(--color-live);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: all .15s;
  min-height: 52px;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--color-live) 25%, transparent);
}
.submit-btn:hover { filter: brightness(1.1); }
.submit-btn:disabled { opacity: .4; cursor: not-allowed; }

/* ── Responded ── */
.responded-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 0;
}
.responded-icon {
  color: #22c55e;
}
.responded-text {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}
.responded-sub {
  font-size: 14px;
  color: var(--text-muted);
}

/* ── Results student ── */
.results-student {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}
.results-label {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 800;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: .06em;
}
/* Vrai/Faux */
.vf-response { display: flex; flex-direction: column; gap: 12px; }
.vf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.vf-btn { padding: 28px 16px; border-radius: var(--radius-lg); font-size: 20px; font-weight: 800; border: 3px solid var(--border); background: var(--bg-elevated); color: var(--text-primary); cursor: pointer; transition: all .15s; }
.vf-vrai { border-color: #22c55e44; }
.vf-faux { border-color: #ef444444; }
.vf-vrai.selected { background: #22c55e22; border-color: #22c55e; color: #22c55e; }
.vf-faux.selected { background: #ef444422; border-color: #ef4444; color: #ef4444; }
/* Reponse courte */
.short-input { width: 100%; padding: 14px 16px; border-radius: var(--radius-sm); font-size: 16px; border: 2px solid var(--border); background: var(--bg-elevated); color: var(--text-primary); }
/* Association */
.association-response { display: flex; flex-direction: column; gap: 10px; }
.assoc-row { display: flex; align-items: center; gap: 8px; }
.assoc-left { flex: 1; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--bg-elevated); font-weight: 600; color: var(--text-primary); font-size: 14px; }
.assoc-arrow { color: var(--text-secondary); font-size: 16px; flex-shrink: 0; }
.assoc-select { flex: 1; padding: 10px 12px; border-radius: var(--radius-sm); border: 2px solid var(--border); background: var(--bg-elevated); color: var(--text-primary); font-size: 14px; cursor: pointer; }
.assoc-select:focus {
  border-color: var(--color-live); outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-live) 18%, transparent);
}

/* ── Cumulative score floating badge ── */
.cumulative-score {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  background: var(--bg-elevated);
  border: 1px solid rgba(234,179,8,.3);
  color: #eab308;
  font-size: 14px;
  font-weight: 700;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  box-shadow: 0 4px 16px rgba(0,0,0,.2);
  z-index: 100;
  animation: score-pop .3s cubic-bezier(.34,1.56,.64,1);
}
@keyframes score-pop {
  from { transform: scale(.8); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}

/* ── Mode entrainement (replay asynchrone) ── */
.session-bar-mode {
  display: inline-block;
  margin-left: 8px;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--live-spark-soft);
  color: var(--live-spark);
  text-transform: uppercase;
  letter-spacing: .5px;
  vertical-align: middle;
}

.replay-offer, .replay-end {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 36px 24px;
  text-align: center;
  max-width: 480px;
  margin: 32px auto 0;
  background: var(--bg-elevated);
  border: 1px solid var(--live-spark-border);
  border-radius: var(--radius-lg);
  animation: replay-in .32s var(--ease-out);
}
@keyframes replay-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.replay-offer-icon, .replay-end-icon {
  width: 64px; height: 64px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
  background: var(--live-spark-soft);
  color: var(--live-spark);
}
.replay-offer-title, .replay-end-title {
  font-size: 22px; font-weight: 800;
  color: var(--text-primary); margin: 0;
}
.replay-offer-desc {
  font-size: 14px; color: var(--text-secondary);
  max-width: 360px; line-height: 1.5; margin: 0;
}
.replay-offer-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px;
  font-family: inherit; font-size: 14px; font-weight: 700;
  background: var(--live-spark);
  color: #1a1300;
  border: none; border-radius: var(--radius);
  cursor: pointer;
  transition: all .15s;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--live-spark) 30%, transparent);
}
.replay-offer-btn:hover { transform: translateY(-1px); filter: brightness(1.05); }
.replay-end-score {
  font-size: 42px; font-weight: 900;
  color: var(--live-spark);
  margin: 4px 0;
  font-family: 'JetBrains Mono', monospace;
}
.rep-pts {
  font-size: 14px; font-weight: 600;
  color: var(--text-muted);
  font-family: inherit;
}
.replay-end-actions {
  display: flex; gap: 10px; margin-top: 6px;
}

/* Replay question area */
.replay-area {
  max-width: 560px;
  margin: 24px auto 0;
}
.replay-progress {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .5px;
  padding: 0 4px 12px;
}
.replay-score-pill {
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--live-spark-soft);
  color: var(--live-spark);
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
}
.replay-feedback {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border-radius: var(--radius-lg);
  margin-top: 18px;
  animation: replay-in .3s var(--ease-out);
}
.replay-feedback.correct {
  background: color-mix(in srgb, var(--color-success) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-success) 35%, transparent);
  color: var(--color-success);
}
.replay-feedback.wrong {
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-danger) 35%, transparent);
  color: var(--color-danger);
}
.rf-text { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.rf-head { font-size: 15px; font-weight: 800; }
.rf-pts {
  font-size: 13px; font-weight: 700;
  color: var(--live-spark);
  font-family: 'JetBrains Mono', monospace;
}
.replay-next-btn {
  margin: 0;
  padding: 10px 18px;
  background: var(--color-live);
  color: #fff;
}

/* ── Self-paced navigation ── */
.sp-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 8px;
}
.sp-bar-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.sp-badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  padding: 3px 10px;
  border-radius: 999px;
  background: #dbeafe;
  color: #1d4ed8;
}
.sp-progress-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}
.sp-progress-track {
  height: 6px;
  border-radius: 3px;
  background: var(--bg-tertiary);
  overflow: hidden;
}
.sp-progress-fill {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #3b82f6, #10b981);
  transition: width .4s ease;
}
.sp-pills {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.sp-pill {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all .15s;
}
.sp-pill:hover { border-color: var(--color-live); }
.sp-pill.active {
  border-color: var(--color-live);
  background: color-mix(in srgb, var(--color-live) 12%, transparent);
  color: var(--color-live);
}
.sp-pill.done { border-color: #10b981; color: #10b981; }
.sp-pill.done.active { background: color-mix(in srgb, #10b981 12%, transparent); }
.sp-pill-num { min-width: 14px; text-align: center; }
.sp-pill-check { font-size: 10px; font-weight: 700; }
.sp-next-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  padding: 10px 22px;
  border-radius: var(--radius);
  border: none;
  background: var(--color-live);
  color: white;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all .15s;
  box-shadow: 0 4px 14px color-mix(in srgb, var(--color-live) 22%, transparent);
}
.sp-next-btn:hover { filter: brightness(1.08); }
.sp-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}
.sp-done-text {
  font-size: 14px;
  font-weight: 600;
  color: #10b981;
}

/* ── Tri (sorting) ── */
.tri-response { display: flex; flex-direction: column; gap: 14px; }
.tri-list { display: flex; flex-direction: column; gap: 6px; }
.tri-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: all .2s;
}
.tri-rank {
  flex: 0 0 28px;
  text-align: center;
  font-size: 14px;
  font-weight: 800;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  padding: 2px 0;
}
.tri-label {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}
.tri-arrows {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tri-arrow {
  width: 28px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--text-secondary);
  font-size: 10px;
  cursor: pointer;
  transition: all .15s;
}
.tri-arrow:disabled { opacity: .25; cursor: not-allowed; }
.tri-arrow:not(:disabled):hover { background: var(--color-live); color: white; border-color: var(--color-live); }

/* ── Texte a trous ── */
.tat-response { display: flex; flex-direction: column; gap: 14px; }
.tat-text {
  font-size: 16px;
  line-height: 2.2;
  color: var(--text-primary);
}
.tat-blank-input {
  display: inline-block;
  width: 120px;
  padding: 4px 10px;
  margin: 0 4px;
  border: 2px dashed #f59e0b;
  border-radius: var(--radius-sm);
  background: #fef3c7;
  font-size: 15px;
  font-weight: 600;
  color: #92400e;
  text-align: center;
  transition: border-color .15s, background .15s;
}
.tat-blank-input:focus {
  outline: none;
  border-style: solid;
  border-color: #f59e0b;
  background: #fffbeb;
}

/* ── Confusion button ── */
.confusion-btn {
  position: fixed;
  bottom: 20px;
  left: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,.12);
  z-index: 100;
  transition: all .2s;
}
.confusion-btn:hover {
  border-color: #f59e0b;
  color: #f59e0b;
}
.confusion-btn.active {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #d97706;
}

/* ── Mobile responsive ── */
@media (max-width: 640px) {
  .student-live { padding: 16px; }
  .question-title { font-size: 18px; }
  .kahoot-grid { grid-template-columns: 1fr; gap: 8px; }
  .kahoot-btn { min-height: 56px; font-size: 15px; padding: 14px; }
  .submit-btn { min-height: 46px; font-size: 14px; }
  .qcm-row { grid-template-columns: 120px 1fr 36px 36px; gap: 6px; }
  .qcm-label { font-size: 14px; }
  .sp-pills { gap: 4px; }
  .sp-pill { padding: 3px 8px; font-size: 11px; }
  .tri-item { padding: 8px 10px; }
  .tat-blank-input { width: 90px; font-size: 13px; }
  .session-card { padding: 16px 14px; }
  .cumulative-score { bottom: 12px; right: 12px; font-size: 12px; padding: 6px 12px; }
  .confusion-btn { bottom: 12px; left: 12px; font-size: 11px; padding: 6px 12px; }
}
</style>
