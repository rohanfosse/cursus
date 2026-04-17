<!-- StudentLiveView.vue - Vue étudiant pour le Live Quiz interactif -->
<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, type ComputedRef } from 'vue'
  import { Zap, CheckCircle2, Send, LogOut, XCircle, Trophy, RotateCw, ChevronRight } from 'lucide-vue-next'
  import { useAppStore }  from '@/stores/app'
  import { useLiveStore } from '@/stores/live'
  import { shuffleArray, KAHOOT_COLORS, KAHOOT_SHAPES, isSparkType, buildResponsePayload } from '@/utils/liveActivity'
  import type { LiveScoreResult } from '@/types'
  import CountdownTimer from './CountdownTimer.vue'
  import QcmResults           from './QcmResults.vue'
  import LiveCodeViewer       from './LiveCodeViewer.vue'
  import LiveBoard            from './LiveBoard.vue'
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

  /** Mode entrainement asynchrone : apres la fin de la session, l'etudiant peut
   *  refaire le quiz en solo. Les reponses vont dans live_responses_v2.mode='replay'
   *  et n'impactent pas le leaderboard live. */
  const replayMode = ref(false)
  const replayIndex = ref(0)
  const replayFeedback = ref<LiveScoreResult | null>(null)
  const replayScore = ref(0)
  const replaySparkActivities = computed(() =>
    (liveStore.currentSession?.activities ?? []).filter(a => isSparkType(a.type)),
  )
  const replayCurrentActivity = computed(() =>
    replaySparkActivities.value[replayIndex.value] ?? null,
  )
  const replayFinished = computed(() =>
    replayMode.value && replayIndex.value >= replaySparkActivities.value.length,
  )

  function startReplay() {
    replayMode.value = true
    replayIndex.value = 0
    replayFeedback.value = null
    replayScore.value = 0
    selectedAnswers.value = []
    textInput.value = ''
  }

  function nextReplayQuestion() {
    replayFeedback.value = null
    replayIndex.value += 1
    selectedAnswers.value = []
    textInput.value = ''
    associationMapping.value = []
  }

  function exitReplay() {
    replayMode.value = false
    replayIndex.value = 0
    replayFeedback.value = null
  }

  // Selected QCM answers (indices)
  const selectedAnswers = ref<number[]>([])
  // Association: student mapping (index of right item for each left item)
  const associationMapping = ref<number[]>([])
  // Shuffled right-column indices for association
  const shuffledRight = ref<number[]>([])

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

  // Shuffled QCM options (index mapping: display index → original index)
  const qcmShuffleMap = ref<number[]>([])
  const shuffledOptions = computed(() => {
    if (!activity.value?.options || activity.value.type !== 'qcm') return []
    return qcmShuffleMap.value.map(origIdx => (activity.value!.options as string[])[origIdx])
  })

  watch(activity, (act) => {
    selectedAnswers.value = []
    textInput.value = ''

    // Shuffle QCM options for this student
    if (act?.type === 'qcm' && act.options) {
      const opts = Array.isArray(act.options) ? act.options : JSON.parse(act.options as unknown as string)
      const studentId = appStore.currentUser?.id ?? 1
      const seed = act.id * 1000 + studentId
      qcmShuffleMap.value = shuffleArray(opts.map((_: unknown, i: number) => i), seed)
    } else {
      qcmShuffleMap.value = []
    }

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

  onMounted(async () => {
    liveStore.initSocketListeners()
    // Auto-detect active session for promo
    if (!session.value && promoId.value) {
      await liveStore.fetchActiveForPromo(promoId.value)
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
    replayMode.value = false
    replayIndex.value = 0
  }

  /** Submit en mode replay : pas d'impact sur le leaderboard live, mais scoring conserve. */
  async function submitReplay() {
    const act = replayCurrentActivity.value
    if (!act) return
    const basePayload = buildResponsePayload(act.type, {
      selectedAnswers: selectedAnswers.value,
      textInput: textInput.value,
      associationMapping: associationMapping.value,
    })
    if (!basePayload) return
    const result = await liveStore.submitResponse(act.id, { ...basePayload, mode: 'replay' })
    if (result) {
      replayFeedback.value = result
      if (result.points > 0) replayScore.value += result.points
    }
  }
</script>

<template>
  <div class="student-live">
    <!-- ══════════ Pas de session ══════════ -->
    <div v-if="!session" class="live-join">
      <div class="join-hero">
        <Zap :size="44" class="hero-icon" />
        <h1 class="hero-title">Live</h1>
        <p class="hero-desc">Rejoignez une session interactive avec un code</p>
      </div>

      <div class="join-card">
        <input
          v-model="joinCode"
          class="join-input"
          placeholder="Code à 6 caractères"
          maxlength="6"
          @keydown.enter="joinSession"
        />
        <button
          class="join-btn"
          :disabled="joinCode.trim().length < 4 || joining"
          @click="joinSession"
        >
          {{ joining ? 'Connexion...' : 'Rejoindre' }}
        </button>
      </div>
    </div>

    <!-- ══════════ En session ══════════ -->
    <div v-else class="live-in-session">
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

      <!-- Waiting for activity (mode live uniquement) -->
      <div v-else-if="!activity || activity.status === 'pending'" class="waiting-state">
        <div class="waiting-dots">
          <span class="dot" />
          <span class="dot" />
          <span class="dot" />
        </div>
        <span class="waiting-text">En attente de la prochaine question...</span>
      </div>

      <!-- Activity live + not responded yet -->
      <div v-else-if="activity.status === 'live' && !liveStore.hasResponded" class="response-area">
        <!-- Countdown timer (Spark uniquement) -->
        <div v-if="isSparkActivity && liveStore.timerStartedAt" class="timer-bar">
          <CountdownTimer
            :total-seconds="activity.timer_seconds ?? 30"
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

        <!-- Pulse : inputs anonymes (echelle, humeur, question ouverte, etc.) -->
        <LivePulseInput
          v-else-if="['sondage_libre','nuage','echelle','question_ouverte','sondage','humeur','priorite','matrice'].includes(activity.type)"
          :activity="activity"
          @submitted="liveStore.hasResponded = true"
        />

      </div>

      <!-- Responded - waiting for results -->
      <div v-else-if="liveStore.hasResponded && activity.status === 'live'" class="responded-state">
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
      </div>

      <!-- Activity closed - show results + score -->
      <div v-else-if="activity.status === 'closed'" class="results-student">
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
      </div>
    </div>

    <!-- ══════════ Score cumule flottant ══════════ -->
    <div v-if="session && cumulativePoints > 0 && isSparkActivity" class="cumulative-score">
      <Trophy :size="14" />
      <span>{{ cumulativePoints.toLocaleString() }} pts</span>
    </div>
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
  gap: 28px;
  max-width: 400px;
  width: 100%;
  margin-top: 80px;
}
.join-hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.hero-icon { color: var(--accent); opacity: .7; }
.hero-title { font-size: 28px; font-weight: 800; color: var(--text-primary); }
.hero-desc { font-size: 14px; color: var(--text-muted); }
.join-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.join-input {
  width: 100%;
  padding: 16px;
  border-radius: 12px;
  background: var(--bg-elevated);
  border: 2px solid var(--border);
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 700;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  text-align: center;
  letter-spacing: 6px;
  text-transform: uppercase;
  outline: none;
  transition: border-color .15s;
}
.join-input:focus { border-color: var(--accent); }
.join-input::placeholder {
  font-size: 14px;
  letter-spacing: normal;
  text-transform: none;
  font-family: inherit;
  font-weight: 500;
}
.join-btn {
  padding: 14px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  background: var(--accent);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: all .15s;
  min-height: 48px;
}
.join-btn:hover { filter: brightness(1.1); }
.join-btn:disabled { opacity: .4; cursor: not-allowed; }

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
  border-radius: 8px;
  border: 1px solid var(--border);
}
.session-bar-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}
.btn-leave {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
  background: rgba(239,68,68,.08); color: #f87171;
  border: 1px solid rgba(239,68,68,.15); cursor: pointer;
  transition: all .15s;
}
.btn-leave:hover { background: rgba(239,68,68,.15); }

/* ── Waiting ── */
.waiting-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 0;
}
.waiting-dots {
  display: flex;
  gap: 8px;
}
.dot {
  width: 12px;
  height: 12px;
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
.waiting-text {
  font-size: 16px;
  color: var(--text-muted);
  font-weight: 600;
}

/* ── Response area ── */
.response-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.question-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
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
  border-radius: 14px;
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
  border-radius: 8px;
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
  border-radius: 12px;
  background: var(--bg-elevated);
  border: 2px solid var(--border);
  color: var(--text-primary);
  font-size: 15px;
  font-family: inherit;
  resize: vertical;
  outline: none;
  transition: border-color .15s;
}
.text-input:focus { border-color: var(--accent); }

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
  border-radius: 12px;
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
.word-input:focus { border-color: var(--accent); }

/* Submit */
.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 700;
  background: var(--accent);
  color: #fff;
  border: none;
  cursor: pointer;
  transition: all .15s;
  min-height: 52px;
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
  font-size: 16px;
  font-weight: 700;
  color: var(--text-secondary);
  letter-spacing: .5px;
}
/* Vrai/Faux */
.vf-response { display: flex; flex-direction: column; gap: 12px; }
.vf-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.vf-btn { padding: 28px 16px; border-radius: 14px; font-size: 20px; font-weight: 800; border: 3px solid var(--border); background: var(--bg-elevated); color: var(--text-primary); cursor: pointer; transition: all .15s; }
.vf-vrai { border-color: #22c55e44; }
.vf-faux { border-color: #ef444444; }
.vf-vrai.selected { background: #22c55e22; border-color: #22c55e; color: #22c55e; }
.vf-faux.selected { background: #ef444422; border-color: #ef4444; color: #ef4444; }
/* Reponse courte */
.short-input { width: 100%; padding: 14px 16px; border-radius: 8px; font-size: 16px; border: 2px solid var(--border); background: var(--bg-elevated); color: var(--text-primary); }
/* Association */
.association-response { display: flex; flex-direction: column; gap: 10px; }
.assoc-row { display: flex; align-items: center; gap: 8px; }
.assoc-left { flex: 1; padding: 10px 12px; border-radius: 8px; background: var(--bg-elevated); font-weight: 600; color: var(--text-primary); font-size: 14px; }
.assoc-arrow { color: var(--text-secondary); font-size: 16px; flex-shrink: 0; }
.assoc-select { flex: 1; padding: 10px 12px; border-radius: 8px; border: 2px solid var(--border); background: var(--bg-elevated); color: var(--text-primary); font-size: 14px; cursor: pointer; }
.assoc-select:focus { border-color: var(--accent); outline: none; }

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
  border-radius: 16px;
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
  border: none; border-radius: 10px;
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
  border-radius: 14px;
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
  background: var(--accent);
  color: #fff;
}
</style>
