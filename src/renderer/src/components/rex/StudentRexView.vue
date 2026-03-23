/** StudentRexView — Vue etudiant pour les sessions REX anonymes. */
<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
  import { Radio, CheckCircle2, Send, LogOut, Clock } from 'lucide-vue-next'
  import { Star } from 'lucide-vue-next'
  import { useAppStore }  from '@/stores/app'
  import { useRexStore }  from '@/stores/rex'
  import type { RexActivity } from '@/types'

  import RexSondageResults          from './RexSondageResults.vue'
  import RexWordCloud               from './RexWordCloud.vue'
  import RexEchelleResults          from './RexEchelleResults.vue'
  import RexQuestionOuverteResults  from './RexQuestionOuverteResults.vue'

  const appStore = useAppStore()
  const rex      = useRexStore()

  const joinCode    = ref('')
  const joining     = ref(false)
  const textInput   = ref('')
  const wordInputs  = ref<string[]>([])
  const ratingInput = ref(0)

  // Async mode: track responded activity IDs + expanded activity
  const respondedIds       = ref<Set<number>>(new Set())
  const asyncExpandedId    = ref<number | null>(null)
  const asyncTextInputs    = ref<Record<number, string>>({})
  const asyncWordInputs    = ref<Record<number, string[]>>({})
  const asyncRatingInputs  = ref<Record<number, number>>({})

  const promoId  = computed(() => appStore.currentUser?.promo_id ?? 0)
  const session  = computed(() => rex.currentSession)
  const activity = computed(() => rex.currentActivity)
  const results  = computed(() => rex.results)
  const isAsync  = computed(() => !!session.value?.is_async)
  const liveActivities = computed(() =>
    (session.value?.activities ?? []).filter(a => a.status === 'live')
  )

  // Reset inputs when activity changes (sync mode)
  watch(activity, (act) => {
    if (act?.type === 'nuage') {
      wordInputs.value = Array.from({ length: act.max_words || 2 }, () => '')
    }
    textInput.value = ''
    ratingInput.value = 0
    rex.hasResponded = false
  })

  onMounted(async () => {
    rex.initSocketListeners()
    if (!session.value && promoId.value) {
      await rex.fetchActiveForPromo(promoId.value)
    }
  })
  onUnmounted(() => {
    rex.disposeSocketListeners()
  })

  async function joinSession() {
    if (!joinCode.value.trim()) return
    joining.value = true
    await rex.joinByCode(joinCode.value.trim().toUpperCase())
    joining.value = false
  }

  // ── Sync submit helpers ─────────────────────────────────────────────────
  async function submitText() {
    if (!activity.value || !textInput.value.trim()) return
    await rex.submitResponse(activity.value.id, { text: textInput.value.trim() })
  }

  async function submitWords() {
    if (!activity.value) return
    const filtered = wordInputs.value.map(w => w.trim()).filter(Boolean)
    if (filtered.length === 0) return
    await rex.submitResponse(activity.value.id, { words: filtered })
  }

  async function submitRating() {
    if (!activity.value || ratingInput.value <= 0) return
    await rex.submitResponse(activity.value.id, { rating: ratingInput.value })
  }

  // ── Async submit helpers ────────────────────────────────────────────────
  function initAsyncInputs(act: RexActivity) {
    if (!(act.id in asyncTextInputs.value))   asyncTextInputs.value[act.id] = ''
    if (!(act.id in asyncRatingInputs.value)) asyncRatingInputs.value[act.id] = 0
    if (!(act.id in asyncWordInputs.value))   asyncWordInputs.value[act.id] = Array.from({ length: act.max_words || 2 }, () => '')
  }

  function expandAsyncActivity(act: RexActivity) {
    initAsyncInputs(act)
    asyncExpandedId.value = asyncExpandedId.value === act.id ? null : act.id
  }

  async function asyncSubmitText(actId: number) {
    const text = asyncTextInputs.value[actId]?.trim()
    if (!text) return
    const ok = await rex.submitResponse(actId, { text })
    if (ok) respondedIds.value = new Set([...respondedIds.value, actId])
  }

  async function asyncSubmitWords(actId: number) {
    const filtered = (asyncWordInputs.value[actId] ?? []).map(w => w.trim()).filter(Boolean)
    if (!filtered.length) return
    const ok = await rex.submitResponse(actId, { words: filtered })
    if (ok) respondedIds.value = new Set([...respondedIds.value, actId])
  }

  async function asyncSubmitRating(actId: number) {
    const rating = asyncRatingInputs.value[actId]
    if (!rating || rating <= 0) return
    const ok = await rex.submitResponse(actId, { rating })
    if (ok) respondedIds.value = new Set([...respondedIds.value, actId])
  }

  function leave() {
    rex.leaveSession()
  }

  function activityTypeLabel(type: string): string {
    if (type === 'sondage_libre') return 'Sondage libre'
    if (type === 'nuage') return 'Nuage de mots'
    if (type === 'echelle') return 'Echelle'
    return 'Question ouverte'
  }

  function formatOpenUntil(dt: string | null) {
    if (!dt) return ''
    const d = new Date(dt)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }
</script>

<template>
  <div class="rex-student">

    <!-- ═══ A) Pas dans une session ═══ -->
    <div v-if="!session" class="rex-join">
      <div class="rex-join-icon">
        <Radio :size="32" />
      </div>
      <h2 class="rex-join-title">Rejoindre un REX</h2>
      <p class="rex-join-subtitle">Entrez le code a 6 caracteres fourni par votre enseignant</p>

      <div class="rex-join-form">
        <input
          v-model="joinCode"
          type="text"
          class="rex-join-input"
          placeholder="CODE"
          maxlength="6"
          @keydown.enter="joinSession"
        />
        <button
          class="rex-btn-primary"
          :disabled="joinCode.trim().length < 6 || joining"
          @click="joinSession"
        >
          {{ joining ? 'Connexion...' : 'Rejoindre' }}
        </button>
      </div>
    </div>

    <!-- ═══ B) Dans une session ═══ -->
    <template v-else>
      <div class="rex-student-header">
        <h2 class="rex-student-title">{{ session.title }}</h2>
        <button class="rex-btn-ghost" @click="leave">
          <LogOut :size="14" /> Quitter
        </button>
      </div>

      <!-- Async mode: open_until banner -->
      <div v-if="isAsync && session.open_until" class="rex-async-info">
        <Clock :size="14" />
        Ce sondage est ouvert jusqu'au {{ formatOpenUntil(session.open_until) }}
      </div>

      <!-- ═══ B1) Async mode — list of all live activities ═══ -->
      <template v-if="isAsync">
        <div v-if="liveActivities.length === 0" class="rex-waiting">
          <div class="rex-waiting-pulse" />
          <p class="rex-waiting-text">Ce sondage n'a pas encore été ouvert.</p>
        </div>
        <div v-else class="rex-async-list">
          <div
            v-for="act in liveActivities"
            :key="act.id"
            class="rex-async-card"
            :class="{ responded: respondedIds.has(act.id), expanded: asyncExpandedId === act.id }"
          >
            <!-- Card header -->
            <div class="rex-async-card-header" @click="!respondedIds.has(act.id) && expandAsyncActivity(act)">
              <span class="rex-respond-type">{{ activityTypeLabel(act.type) }}</span>
              <span class="rex-async-card-title">{{ act.title }}</span>
              <CheckCircle2 v-if="respondedIds.has(act.id)" :size="16" class="rex-async-done-icon" />
              <span v-else class="rex-async-arrow">{{ asyncExpandedId === act.id ? '▲' : '▼' }}</span>
            </div>

            <!-- Responded confirmation -->
            <div v-if="respondedIds.has(act.id)" class="rex-async-done">
              <CheckCircle2 :size="16" /> Réponse envoyée
            </div>

            <!-- Expanded form -->
            <div v-else-if="asyncExpandedId === act.id" class="rex-respond-body rex-async-form">

              <!-- Sondage libre -->
              <template v-if="act.type === 'sondage_libre'">
                <input v-model="asyncTextInputs[act.id]" type="text" class="rex-respond-input" placeholder="Votre réponse..." @keydown.enter="asyncSubmitText(act.id)" />
                <button class="rex-btn-primary" :disabled="!asyncTextInputs[act.id]?.trim()" @click="asyncSubmitText(act.id)">
                  <Send :size="14" /> Envoyer
                </button>
              </template>

              <!-- Nuage de mots -->
              <template v-else-if="act.type === 'nuage'">
                <input v-for="(_, i) in asyncWordInputs[act.id]" :key="i" v-model="asyncWordInputs[act.id][i]" type="text" class="rex-respond-input" :placeholder="`Mot ${i + 1}`" />
                <button class="rex-btn-primary" :disabled="!asyncWordInputs[act.id]?.some(w => w.trim())" @click="asyncSubmitWords(act.id)">
                  <Send :size="14" /> Envoyer
                </button>
              </template>

              <!-- Echelle -->
              <template v-else-if="act.type === 'echelle'">
                <div v-if="act.max_rating <= 5" class="rex-star-row">
                  <button v-for="s in act.max_rating" :key="s" class="rex-star-btn" :class="{ filled: s <= (asyncRatingInputs[act.id] || 0) }" @click="asyncRatingInputs[act.id] = s">
                    <Star :size="28" />
                  </button>
                </div>
                <div v-else class="rex-slider-row">
                  <input v-model.number="asyncRatingInputs[act.id]" type="range" min="1" :max="act.max_rating" class="rex-slider" />
                  <span class="rex-slider-val">{{ asyncRatingInputs[act.id] || '-' }} / {{ act.max_rating }}</span>
                </div>
                <button class="rex-btn-primary" :disabled="!(asyncRatingInputs[act.id] > 0)" @click="asyncSubmitRating(act.id)">
                  <Send :size="14" /> Envoyer
                </button>
              </template>

              <!-- Question ouverte -->
              <template v-else-if="act.type === 'question_ouverte'">
                <textarea v-model="asyncTextInputs[act.id]" class="rex-respond-textarea" placeholder="Votre retour..." rows="4" />
                <button class="rex-btn-primary" :disabled="!asyncTextInputs[act.id]?.trim()" @click="asyncSubmitText(act.id)">
                  <Send :size="14" /> Envoyer
                </button>
              </template>
            </div>
          </div>
        </div>
      </template>

      <!-- ═══ B2) Sync mode (original behavior) ═══ -->
      <template v-else>

      <!-- Waiting -->
      <div v-if="!activity || activity.status === 'pending'" class="rex-waiting">
        <div class="rex-waiting-pulse" />
        <p class="rex-waiting-text">En attente de la prochaine question...</p>
      </div>

      <!-- Activity live: respond -->
      <div v-else-if="activity.status === 'live' && !rex.hasResponded" class="rex-respond">
        <div class="rex-respond-header">
          <span class="rex-respond-type">{{ activityTypeLabel(activity.type) }}</span>
          <h3 class="rex-respond-title">{{ activity.title }}</h3>
        </div>

        <!-- Sondage libre -->
        <div v-if="activity.type === 'sondage_libre'" class="rex-respond-body">
          <input
            v-model="textInput"
            type="text"
            class="rex-respond-input"
            placeholder="Votre reponse..."
            @keydown.enter="submitText"
          />
          <button class="rex-btn-primary" :disabled="!textInput.trim()" @click="submitText">
            <Send :size="14" /> Envoyer
          </button>
        </div>

        <!-- Nuage de mots -->
        <div v-else-if="activity.type === 'nuage'" class="rex-respond-body">
          <input
            v-for="(_, i) in wordInputs"
            :key="i"
            v-model="wordInputs[i]"
            type="text"
            class="rex-respond-input"
            :placeholder="`Mot ${i + 1}`"
          />
          <button class="rex-btn-primary" :disabled="!wordInputs.some(w => w.trim())" @click="submitWords">
            <Send :size="14" /> Envoyer
          </button>
        </div>

        <!-- Echelle -->
        <div v-else-if="activity.type === 'echelle'" class="rex-respond-body">
          <div v-if="activity.max_rating <= 5" class="rex-star-row">
            <button
              v-for="s in activity.max_rating"
              :key="s"
              class="rex-star-btn"
              :class="{ filled: s <= ratingInput }"
              @click="ratingInput = s"
            >
              <Star :size="28" />
            </button>
          </div>
          <div v-else class="rex-slider-row">
            <input
              v-model.number="ratingInput"
              type="range"
              min="1"
              :max="activity.max_rating"
              class="rex-slider"
            />
            <span class="rex-slider-val">{{ ratingInput || '-' }} / {{ activity.max_rating }}</span>
          </div>
          <button class="rex-btn-primary" :disabled="ratingInput <= 0" @click="submitRating">
            <Send :size="14" /> Envoyer
          </button>
        </div>

        <!-- Question ouverte -->
        <div v-else-if="activity.type === 'question_ouverte'" class="rex-respond-body">
          <textarea
            v-model="textInput"
            class="rex-respond-textarea"
            placeholder="Votre retour..."
            rows="4"
          />
          <button class="rex-btn-primary" :disabled="!textInput.trim()" @click="submitText">
            <Send :size="14" /> Envoyer
          </button>
        </div>
      </div>

      <!-- After responding -->
      <div v-else-if="activity && activity.status === 'live' && rex.hasResponded" class="rex-thanks">
        <CheckCircle2 :size="40" class="rex-thanks-icon" />
        <p class="rex-thanks-text">Merci pour votre retour</p>
      </div>

      <!-- Activity closed: show results if available -->
      <div v-else-if="activity && activity.status === 'closed' && results" class="rex-closed-results">
        <h3 class="rex-closed-title">Resultats : {{ activity.title }}</h3>
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
          :is-teacher="false"
        />
      </div>

      <!-- Session ended -->
      <div v-if="session.status === 'ended'" class="rex-ended">
        <p class="rex-ended-text">La session est terminee. Merci pour votre participation !</p>
      </div>

      </template> <!-- end sync mode -->

      <!-- Session ended (async) -->
      <div v-if="isAsync && session.status === 'ended'" class="rex-ended">
        <p class="rex-ended-text">Ce sondage est maintenant fermé. Merci pour votre participation !</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rex-student {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Join ── */
.rex-join {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
}
.rex-join-icon {
  color: #0d9488;
  margin-bottom: 4px;
}
.rex-join-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}
.rex-join-subtitle {
  font-size: 14px;
  color: var(--text-muted, #888);
  margin: 0;
  text-align: center;
}
.rex-join-form {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-top: 8px;
}
.rex-join-input {
  width: 160px;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid rgba(13, 148, 136, 0.3);
  background: rgba(13, 148, 136, 0.06);
  color: #0d9488;
  font-size: 22px;
  font-weight: 700;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  text-align: center;
  letter-spacing: 4px;
  text-transform: uppercase;
  outline: none;
  transition: border-color 0.4s ease;
}
.rex-join-input:focus { border-color: #0d9488; }

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
.rex-btn-ghost {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 8px;
  border: 1px solid var(--border, rgba(255,255,255,.08));
  background: transparent; color: var(--text-secondary, #aaa);
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all 0.4s ease; font-family: var(--font, inherit);
}
.rex-btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary, #fff); }

/* ── Student header ── */
.rex-student-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.rex-student-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary, #fff);
  margin: 0;
}

/* ── Waiting ── */
.rex-waiting {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px 20px;
}
.rex-waiting-pulse {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(13, 148, 136, 0.15);
  animation: rex-gentle-pulse 2.5s ease-in-out infinite;
}
@keyframes rex-gentle-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.15); opacity: 1; }
}
.rex-waiting-text {
  font-size: 15px;
  color: var(--text-muted, #888);
}

/* ── Respond ── */
.rex-respond {
  padding: 24px;
  background: rgba(13, 148, 136, 0.04);
  border: 1px solid rgba(13, 148, 136, 0.15);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rex-respond-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.rex-respond-type {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #14b8a6;
}
.rex-respond-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}
.rex-respond-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rex-respond-input {
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
.rex-respond-input:focus { border-color: #0d9488; }
.rex-respond-textarea {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border, rgba(255,255,255,.08));
  background: var(--bg-elevated, #1e1f21);
  color: var(--text-primary, #fff);
  font-size: 14px;
  font-family: var(--font, inherit);
  outline: none;
  resize: vertical;
  transition: border-color 0.4s ease;
}
.rex-respond-textarea:focus { border-color: #0d9488; }

/* ── Stars ── */
.rex-star-row {
  display: flex;
  gap: 6px;
  justify-content: center;
}
.rex-star-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: rgba(13, 148, 136, 0.25);
  transition: all 0.4s ease;
  padding: 4px;
}
.rex-star-btn.filled {
  color: #0d9488;
}
.rex-star-btn.filled :deep(svg) {
  fill: #0d9488;
}
.rex-star-btn:hover { transform: scale(1.15); }

/* ── Slider ── */
.rex-slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rex-slider {
  flex: 1;
  accent-color: #0d9488;
}
.rex-slider-val {
  font-size: 16px;
  font-weight: 700;
  color: #0d9488;
  min-width: 60px;
  text-align: center;
}

/* ── Thanks ── */
.rex-thanks {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 20px;
}
.rex-thanks-icon {
  color: #0d9488;
  animation: rex-check-in 0.4s ease;
}
@keyframes rex-check-in {
  from { transform: scale(0); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
.rex-thanks-text {
  font-size: 16px;
  font-weight: 600;
  color: #14b8a6;
}

/* ── Closed results ── */
.rex-closed-results {
  padding: 20px;
  background: rgba(13, 148, 136, 0.04);
  border: 1px solid rgba(13, 148, 136, 0.15);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rex-closed-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #fff);
  margin: 0;
}

/* ── Ended ── */
.rex-ended {
  text-align: center;
  padding: 24px;
}
.rex-ended-text {
  font-size: 15px;
  color: var(--text-muted, #888);
}

/* ── Async ── */
.rex-async-info {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  background: rgba(251, 146, 60, 0.08);
  border: 1px solid rgba(251, 146, 60, 0.2);
  color: #fb923c;
  font-size: 13px; font-weight: 500;
}
.rex-async-list {
  display: flex; flex-direction: column; gap: 12px;
}
.rex-async-card {
  border-radius: 12px;
  border: 1px solid var(--border, rgba(255,255,255,.08));
  background: var(--bg-elevated, #1e1f21);
  overflow: hidden;
  transition: border-color .15s;
}
.rex-async-card:not(.responded):hover { border-color: rgba(13, 148, 136, 0.4); }
.rex-async-card.responded { border-color: rgba(13, 148, 136, 0.2); opacity: 0.7; }
.rex-async-card-header {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 16px; cursor: pointer;
}
.rex-async-card.responded .rex-async-card-header { cursor: default; }
.rex-async-card-title {
  flex: 1; font-size: 14px; font-weight: 600; color: var(--text-primary, #fff);
}
.rex-async-done-icon { color: #0d9488; flex-shrink: 0; }
.rex-async-arrow { color: var(--text-muted, #888); font-size: 11px; }
.rex-async-done {
  display: flex; align-items: center; gap: 6px;
  padding: 10px 16px 14px;
  font-size: 13px; color: #0d9488;
}
.rex-async-form {
  padding: 0 16px 16px;
}
</style>
