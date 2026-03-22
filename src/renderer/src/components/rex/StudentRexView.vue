/** StudentRexView — Vue etudiant pour les sessions REX anonymes. */
<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
  import { Radio, CheckCircle2, Send, LogOut } from 'lucide-vue-next'
  import { Star } from 'lucide-vue-next'
  import { useAppStore }  from '@/stores/app'
  import { useRexStore }  from '@/stores/rex'

  import RexSondageResults          from './RexSondageResults.vue'
  import RexWordCloud               from './RexWordCloud.vue'
  import RexEchelleResults          from './RexEchelleResults.vue'
  import RexQuestionOuverteResults  from './RexQuestionOuverteResults.vue'

  const appStore = useAppStore()
  const rex      = useRexStore()

  const joinCode   = ref('')
  const joining    = ref(false)
  const textInput  = ref('')
  const wordInputs = ref<string[]>([])
  const ratingInput = ref(0)

  const promoId  = computed(() => appStore.currentUser?.promo_id ?? 0)
  const session  = computed(() => rex.currentSession)
  const activity = computed(() => rex.currentActivity)
  const results  = computed(() => rex.results)

  // Reset inputs when activity changes
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

  function leave() {
    rex.leaveSession()
  }

  function activityTypeLabel(type: string): string {
    if (type === 'sondage_libre') return 'Sondage libre'
    if (type === 'nuage') return 'Nuage de mots'
    if (type === 'echelle') return 'Echelle'
    return 'Question ouverte'
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
</style>
