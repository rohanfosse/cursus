/** RexPresenterMode — Mode presentation plein ecran pour enchainer les activites. */
<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
  import {
    ChevronLeft, ChevronRight, X, Timer,
  } from 'lucide-vue-next'
  import { useRexStore }  from '@/stores/rex'
  import { rexActivityIcon, rexActivityTypeLabel } from '@/utils/rexActivity'
  import type { RexSession, RexActivity, RexResults } from '@/types'

  import RexSondageResults          from './RexSondageResults.vue'
  import RexWordCloud               from './RexWordCloud.vue'
  import RexEchelleResults          from './RexEchelleResults.vue'
  import RexQuestionOuverteResults  from './RexQuestionOuverteResults.vue'
  import RexHumeurResults           from './RexHumeurResults.vue'
  import RexPrioriteResults         from './RexPrioriteResults.vue'
  import RexMatriceResults          from './RexMatriceResults.vue'

  const props = defineProps<{ session: RexSession }>()
  const emit = defineEmits<{ close: [] }>()

  const rex = useRexStore()

  const currentIndex = ref(0)
  const transitioning = ref(false)
  const timerEnabled = ref(false)
  const timerDuration = ref(60) // seconds
  const timerRemaining = ref(0)
  let timerInterval: ReturnType<typeof setInterval> | null = null

  const activities = computed<RexActivity[]>(() =>
    [...(props.session.activities ?? [])].sort((a, b) => a.position - b.position),
  )
  const total = computed(() => activities.value.length)
  const currentAct = computed<RexActivity | null>(() => activities.value[currentIndex.value] ?? null)
  const isFirst = computed(() => currentIndex.value === 0)
  const isLast = computed(() => currentIndex.value >= total.value - 1)
  const progress = computed(() => total.value > 0 ? ((currentIndex.value + 1) / total.value) * 100 : 0)

  // Results are read from the store
  const results = computed(() => rex.results)

  // Poll results while current activity is live
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function startPoll() {
    stopPoll()
    if (currentAct.value && currentAct.value.status === 'live') {
      rex.fetchResults(currentAct.value.id)
      pollTimer = setInterval(() => {
        if (currentAct.value) rex.fetchResults(currentAct.value.id)
      }, 3000)
    }
  }
  function stopPoll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  // Timer logic
  function startTimer() {
    stopTimer()
    if (!timerEnabled.value) return
    timerRemaining.value = timerDuration.value
    timerInterval = setInterval(() => {
      timerRemaining.value--
      if (timerRemaining.value <= 0) {
        stopTimer()
        goNext()
      }
    }, 1000)
  }
  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null }
    timerRemaining.value = 0
  }

  // On mount: launch first pending activity
  onMounted(async () => {
    // Find first pending activity, or first activity if none pending
    const pendingIdx = activities.value.findIndex(a => a.status === 'pending')
    currentIndex.value = pendingIdx >= 0 ? pendingIdx : 0
    const act = currentAct.value
    if (act && act.status === 'pending') {
      await rex.launchActivity(act.id)
      await rex.fetchSession(props.session.id)
    }
    startPoll()
    startTimer()
  })

  onUnmounted(() => {
    stopPoll()
    stopTimer()
  })

  async function goNext() {
    if (transitioning.value) return
    transitioning.value = true
    stopTimer()
    try {
      const act = currentAct.value
      // Close current activity if live
      if (act && act.status === 'live') {
        await rex.closeActivity(act.id)
      }

      if (isLast.value) {
        // End session
        await rex.endSession(props.session.id)
        emit('close')
        return
      }

      currentIndex.value++
      await rex.fetchSession(props.session.id)

      // Launch next if pending
      const next = currentAct.value
      if (next && next.status === 'pending') {
        await rex.launchActivity(next.id)
        await rex.fetchSession(props.session.id)
      }
      startPoll()
      startTimer()
    } finally {
      transitioning.value = false
    }
  }

  function goPrev() {
    if (currentIndex.value <= 0) return
    stopTimer()
    currentIndex.value--
    // Just view the previous activity results (read-only, don't relaunch)
    const act = currentAct.value
    if (act) rex.fetchResults(act.id)
  }

  const activityIcon = rexActivityIcon
  const activityTypeLabel = rexActivityTypeLabel

  async function onTogglePin(responseId: number, pinned: boolean) {
    await rex.togglePin(responseId, pinned)
    if (currentAct.value) await rex.fetchResults(currentAct.value.id)
  }

  // Keyboard navigation
  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goNext() }
    if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
    if (e.key === 'Escape') emit('close')
  }
  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="rex-presenter">
    <!-- Top bar -->
    <div class="rex-presenter-topbar">
      <div class="rex-presenter-progress-info">
        <span class="rex-presenter-counter">{{ currentIndex + 1 }} / {{ total }}</span>
        <span class="rex-presenter-session-title">{{ session.title }}</span>
      </div>
      <div class="rex-presenter-topbar-actions">
        <!-- Timer toggle -->
        <label class="rex-presenter-timer-toggle" title="Timer par activite">
          <Timer :size="14" />
          <input v-model="timerEnabled" type="checkbox" />
          <input
            v-if="timerEnabled"
            v-model.number="timerDuration"
            type="number"
            min="10"
            max="600"
            class="rex-presenter-timer-input"
          />
          <span v-if="timerEnabled" class="rex-presenter-timer-unit">s</span>
        </label>
        <button class="rex-presenter-close" title="Quitter le mode presentation" @click="$emit('close')">
          <X :size="18" />
        </button>
      </div>
    </div>

    <!-- Progress bar -->
    <div class="rex-presenter-progress-bar">
      <div class="rex-presenter-progress-fill" :style="{ width: progress + '%' }" />
    </div>

    <!-- Timer countdown -->
    <div v-if="timerEnabled && timerRemaining > 0" class="rex-presenter-timer-display">
      {{ timerRemaining }}s
    </div>

    <!-- Current activity -->
    <div v-if="currentAct" class="rex-presenter-content">
      <div class="rex-presenter-act-header">
        <component :is="activityIcon(currentAct.type)" :size="22" class="rex-presenter-act-icon" />
        <h2 class="rex-presenter-act-title">{{ currentAct.title }}</h2>
        <span class="rex-presenter-act-type">{{ activityTypeLabel(currentAct.type) }}</span>
        <span v-if="currentAct.status === 'live'" class="rex-presenter-live-dot" />
      </div>

      <!-- Results -->
      <div class="rex-presenter-results">
        <template v-if="results">
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
            :max-rating="currentAct.max_rating"
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
            :max-rating="currentAct?.max_rating ?? 5"
            :total="results.total"
          />
          <p v-else class="rex-presenter-waiting">En attente de reponses...</p>
        </template>
        <p v-else class="rex-presenter-waiting">En attente de reponses...</p>
      </div>
    </div>

    <p v-else class="rex-presenter-waiting">Aucune activite</p>

    <!-- Navigation -->
    <div class="rex-presenter-nav">
      <button
        class="rex-presenter-nav-btn"
        :disabled="isFirst"
        @click="goPrev"
      >
        <ChevronLeft :size="18" /> Precedent
      </button>
      <button
        class="rex-presenter-nav-btn rex-presenter-nav-btn--primary"
        :disabled="transitioning"
        @click="goNext"
      >
        {{ isLast ? 'Terminer la session' : 'Suivant' }}
        <ChevronRight v-if="!isLast" :size="18" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.rex-presenter {
  display: flex; flex-direction: column; gap: 16px;
  min-height: 400px;
}

/* ── Top bar ── */
.rex-presenter-topbar {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
}
.rex-presenter-progress-info { display: flex; align-items: center; gap: 10px; }
.rex-presenter-counter {
  padding: 4px 10px; border-radius: 6px;
  background: rgba(13, 148, 136, 0.12); color: #14b8a6;
  font-size: 13px; font-weight: 700;
}
.rex-presenter-session-title {
  font-size: 14px; font-weight: 600; color: var(--text-secondary, #aaa);
}
.rex-presenter-topbar-actions { display: flex; align-items: center; gap: 10px; }
.rex-presenter-timer-toggle {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--text-muted); cursor: pointer;
}
.rex-presenter-timer-toggle input[type="checkbox"] { cursor: pointer; accent-color: #0d9488; }
.rex-presenter-timer-input {
  width: 50px; padding: 4px 6px; border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-primary); font-size: 12px;
  font-family: var(--font, inherit); outline: none; text-align: center;
}
.rex-presenter-timer-unit { font-size: 12px; color: var(--text-muted); }
.rex-presenter-close {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 8px; border: none;
  background: rgba(255,255,255,.06); color: var(--text-muted);
  cursor: pointer; transition: all .2s;
}
.rex-presenter-close:hover { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

/* ── Progress bar ── */
.rex-presenter-progress-bar {
  height: 4px; border-radius: 2px;
  background: rgba(255,255,255,.06); overflow: hidden;
}
.rex-presenter-progress-fill {
  height: 100%; border-radius: 2px;
  background: linear-gradient(90deg, #0d9488, #14b8a6);
  transition: width var(--motion-slow) var(--ease-out);
}

/* ── Timer ── */
.rex-presenter-timer-display {
  text-align: center; font-size: 20px; font-weight: 700;
  color: #fb923c; letter-spacing: 1px;
}

/* ── Content ── */
.rex-presenter-content {
  flex: 1; display: flex; flex-direction: column; gap: 20px;
  padding: 24px; border-radius: 14px;
  background: rgba(13, 148, 136, 0.03);
  border: 1px solid rgba(13, 148, 136, 0.12);
}
.rex-presenter-act-header {
  display: flex; align-items: center; gap: 10px;
}
.rex-presenter-act-icon { color: #14b8a6; flex-shrink: 0; }
.rex-presenter-act-title {
  font-size: 20px; font-weight: 700; color: var(--text-primary); margin: 0;
}
.rex-presenter-act-type {
  padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;
  background: rgba(13, 148, 136, 0.1); color: #14b8a6;
}
.rex-presenter-live-dot {
  width: 10px; height: 10px; border-radius: 50%; background: #0d9488;
  animation: rex-pulse 2s infinite; margin-left: auto;
}
@keyframes rex-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.rex-presenter-results { flex: 1; min-height: 120px; }
.rex-presenter-waiting {
  text-align: center; color: var(--text-muted); font-size: 15px;
  padding: 32px 0;
}

/* ── Navigation ── */
.rex-presenter-nav {
  display: flex; justify-content: space-between; gap: 12px;
}
.rex-presenter-nav-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 12px 24px; border-radius: 8px; border: none;
  font-size: 14px; font-weight: 600; cursor: pointer;
  transition: all .2s; font-family: var(--font, inherit);
  background: rgba(255,255,255,.06); color: var(--text-secondary, #aaa);
}
.rex-presenter-nav-btn:hover:not(:disabled) { background: rgba(255,255,255,.1); color: var(--text-primary); }
.rex-presenter-nav-btn:disabled { opacity: .3; cursor: not-allowed; }
.rex-presenter-nav-btn--primary {
  background: #0d9488; color: #fff; margin-left: auto;
}
.rex-presenter-nav-btn--primary:hover:not(:disabled) { background: #14b8a6; }
</style>
