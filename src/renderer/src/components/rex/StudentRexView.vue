/** StudentRexView — Vue etudiant pour les sessions REX anonymes. */
<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
  import { HeartPulse, CheckCircle2, Send, LogOut, Clock } from 'lucide-vue-next'
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
  const sondageSelected = ref<number | null>(null)
  const humeurSelected  = ref<string | null>(null)
  const prioriteOrder   = ref<number[]>([])
  const matriceRatings  = ref<Record<string, number>>({})

  const HUMEUR_EMOJIS = ['😊', '🙂', '😐', '😟', '🤯']

  // Async mode: track responded activity IDs + expanded activity
  const respondedIds       = ref<Set<number>>(new Set())
  const asyncExpandedId    = ref<number | null>(null)
  const asyncTextInputs    = ref<Record<number, string>>({})
  const asyncWordInputs    = ref<Record<number, string[]>>({})
  const asyncRatingInputs  = ref<Record<number, number>>({})
  const asyncSondageInputs = ref<Record<number, number | null>>({})
  const asyncHumeurInputs  = ref<Record<number, string | null>>({})
  const asyncPrioriteInputs = ref<Record<number, number[]>>({})
  const asyncMatriceInputs  = ref<Record<number, Record<string, number>>>({})

  const parsedOptions = computed<string[]>(() => {
    try { return JSON.parse(activity.value?.options as string ?? '[]') } catch { return [] }
  })

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
    if (act?.type === 'priorite') initPriorite(act)
    if (act?.type === 'matrice') initMatrice(act)
    textInput.value = ''
    ratingInput.value = 0
    sondageSelected.value = null
    humeurSelected.value = null
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

  async function submitSondage() {
    if (!activity.value || sondageSelected.value === null) return
    await rex.submitResponse(activity.value.id, { answer: String(sondageSelected.value) })
  }

  async function submitHumeur() {
    if (!activity.value || !humeurSelected.value) return
    await rex.submitResponse(activity.value.id, { answer: humeurSelected.value })
  }

  async function submitPriorite() {
    if (!activity.value || prioriteOrder.value.length === 0) return
    await rex.submitResponse(activity.value.id, { answer: prioriteOrder.value.join(',') })
  }

  async function submitMatrice() {
    if (!activity.value) return
    await rex.submitResponse(activity.value.id, { answer: JSON.stringify(matriceRatings.value) })
  }

  function initPriorite(act: { options?: string | null }) {
    try {
      const items = JSON.parse(act.options as string || '[]')
      prioriteOrder.value = Array.from({ length: items.length }, (_, i) => i)
    } catch { prioriteOrder.value = [] }
  }

  function initMatrice(act: { options?: string | null; max_rating?: number }) {
    try {
      const criteria = JSON.parse(act.options as string || '[]')
      const ratings: Record<string, number> = {}
      for (const c of criteria) ratings[c] = 0
      matriceRatings.value = ratings
    } catch { matriceRatings.value = {} }
  }

  function movePriorite(from: number, to: number) {
    const arr = [...prioriteOrder.value]
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    prioriteOrder.value = arr
  }

  // ── Async submit helpers ────────────────────────────────────────────────
  function initAsyncInputs(act: RexActivity) {
    if (!(act.id in asyncTextInputs.value))   asyncTextInputs.value[act.id] = ''
    if (!(act.id in asyncRatingInputs.value)) asyncRatingInputs.value[act.id] = 0
    if (!(act.id in asyncWordInputs.value))   asyncWordInputs.value[act.id] = Array.from({ length: act.max_words || 2 }, () => '')
    if (!(act.id in asyncSondageInputs.value)) asyncSondageInputs.value[act.id] = null
    if (!(act.id in asyncHumeurInputs.value)) asyncHumeurInputs.value[act.id] = null
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

  async function asyncSubmitSondage(actId: number) {
    const sel = asyncSondageInputs.value[actId]
    if (sel === null || sel === undefined) return
    const ok = await rex.submitResponse(actId, { answer: String(sel) })
    if (ok) respondedIds.value = new Set([...respondedIds.value, actId])
  }

  async function asyncSubmitHumeur(actId: number) {
    const emoji = asyncHumeurInputs.value[actId]
    if (!emoji) return
    const ok = await rex.submitResponse(actId, { answer: emoji })
    if (ok) respondedIds.value = new Set([...respondedIds.value, actId])
  }

  function leave() {
    rex.leaveSession()
  }

  function activityTypeLabel(type: string): string {
    if (type === 'sondage_libre') return 'Sondage libre'
    if (type === 'nuage') return 'Nuage de mots'
    if (type === 'echelle') return 'Echelle'
    if (type === 'sondage') return 'Sondage'
    if (type === 'humeur') return 'Humeur'
    if (type === 'priorite') return 'Priorite'
    if (type === 'matrice') return 'Matrice'
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
        <HeartPulse :size="32" />
      </div>
      <h2 class="rex-join-title">Rejoindre un Pulse</h2>
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

              <!-- Sondage (options) -->
              <template v-else-if="act.type === 'sondage' && act.options">
                <div class="rex-sondage-opts">
                  <button v-for="(opt, i) in ((() => { try { return JSON.parse(act.options as string) } catch { return [] } })())" :key="i" class="rex-sondage-opt" :class="{ selected: asyncSondageInputs[act.id] === i }" @click="asyncSondageInputs[act.id] = i">{{ opt }}</button>
                </div>
                <button class="rex-btn-primary" :disabled="asyncSondageInputs[act.id] === null" @click="asyncSubmitSondage(act.id)">
                  <Send :size="14" /> Envoyer
                </button>
              </template>

              <!-- Humeur -->
              <template v-else-if="act.type === 'humeur'">
                <div class="rex-humeur-grid">
                  <button v-for="emoji in HUMEUR_EMOJIS" :key="emoji" class="rex-humeur-btn" :class="{ selected: asyncHumeurInputs[act.id] === emoji }" @click="asyncHumeurInputs[act.id] = emoji">{{ emoji }}</button>
                </div>
                <button class="rex-btn-primary" :disabled="!asyncHumeurInputs[act.id]" @click="asyncSubmitHumeur(act.id)">
                  <Send :size="14" /> Envoyer
                </button>
              </template>

              <!-- Priorite + Matrice : not supported in async mode yet -->
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

        <!-- Sondage (options) -->
        <div v-else-if="activity.type === 'sondage' && activity.options" class="rex-respond-body">
          <div class="rex-sondage-opts">
            <button
              v-for="(opt, i) in parsedOptions"
              :key="i"
              class="rex-sondage-opt"
              :class="{ selected: sondageSelected === i }"
              @click="sondageSelected = i"
            >{{ opt }}</button>
          </div>
          <button class="rex-btn-primary" :disabled="sondageSelected === null" @click="submitSondage">
            <Send :size="14" /> Envoyer
          </button>
        </div>

        <!-- Humeur (emojis) -->
        <div v-else-if="activity.type === 'humeur'" class="rex-respond-body">
          <div class="rex-humeur-grid">
            <button
              v-for="emoji in HUMEUR_EMOJIS"
              :key="emoji"
              class="rex-humeur-btn"
              :class="{ selected: humeurSelected === emoji }"
              @click="humeurSelected = emoji"
            >{{ emoji }}</button>
          </div>
          <button class="rex-btn-primary" :disabled="!humeurSelected" @click="submitHumeur">
            <Send :size="14" /> Envoyer
          </button>
        </div>

        <!-- Priorite (classement) -->
        <div v-else-if="activity.type === 'priorite' && activity.options" class="rex-respond-body">
          <div class="rex-priorite-list">
            <div v-for="(idx, rank) in prioriteOrder" :key="idx" class="rex-priorite-item">
              <span class="rex-priorite-rank">{{ rank + 1 }}</span>
              <span class="rex-priorite-label">{{ parsedOptions[idx] }}</span>
              <div class="rex-priorite-btns">
                <button v-if="rank > 0" class="rex-priorite-move" @click="movePriorite(rank, rank - 1)">&uarr;</button>
                <button v-if="rank < prioriteOrder.length - 1" class="rex-priorite-move" @click="movePriorite(rank, rank + 1)">&darr;</button>
              </div>
            </div>
          </div>
          <button class="rex-btn-primary" @click="submitPriorite">
            <Send :size="14" /> Envoyer
          </button>
        </div>

        <!-- Matrice (multi-criteres) -->
        <div v-else-if="activity.type === 'matrice' && activity.options" class="rex-respond-body">
          <div class="rex-matrice-grid">
            <div v-for="crit in Object.keys(matriceRatings)" :key="crit" class="rex-matrice-row">
              <span class="rex-matrice-label">{{ crit }}</span>
              <div class="rex-matrice-stars">
                <button
                  v-for="n in (activity.max_rating || 5)"
                  :key="n"
                  class="rex-matrice-star"
                  :class="{ active: (matriceRatings[crit] || 0) >= n }"
                  @click="matriceRatings[crit] = n"
                >&#9733;</button>
              </div>
            </div>
          </div>
          <button class="rex-btn-primary" :disabled="Object.values(matriceRatings).some(v => v === 0)" @click="submitMatrice">
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
        <RexSondageResults
          v-else-if="results.type === 'sondage' && results.counts"
          :results="results.counts"
          :total="results.total"
        />
        <div v-else-if="results.type === 'humeur' && results.emojis" class="rex-humeur-results">
          <div v-for="e in results.emojis" :key="e.emoji" class="rex-humeur-result">
            <span class="rex-humeur-emoji">{{ e.emoji }}</span>
            <div class="rex-humeur-bar" :style="{ width: (results.total ? e.count / results.total * 100 : 0) + '%' }" />
            <span class="rex-humeur-count">{{ e.count }}</span>
          </div>
        </div>
        <div v-else-if="results.type === 'priorite' && results.rankings" class="rex-priorite-results">
          <div v-for="(r, i) in results.rankings" :key="r.item" class="rex-priorite-result">
            <span class="rex-priorite-rank">{{ i + 1 }}</span>
            <span class="rex-priorite-label">{{ r.item }}</span>
            <span class="rex-priorite-avg">moy. {{ r.avgRank + 1 }}</span>
          </div>
        </div>
        <div v-else-if="results.type === 'matrice' && results.criteria" class="rex-matrice-results">
          <div v-for="c in results.criteria" :key="c.name" class="rex-matrice-result">
            <span class="rex-matrice-label">{{ c.name }}</span>
            <div class="rex-matrice-bar-wrap">
              <div class="rex-matrice-bar" :style="{ width: (activity.max_rating ? c.average / activity.max_rating * 100 : 0) + '%' }" />
            </div>
            <span class="rex-matrice-avg">{{ c.average }}</span>
          </div>
        </div>
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
  transition: border-color var(--motion-slow) var(--ease-out);
}
.rex-join-input:focus { border-color: #0d9488; }

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
.rex-btn-ghost {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 8px;
  border: 1px solid var(--border, rgba(255,255,255,.08));
  background: transparent; color: var(--text-secondary, #aaa);
  font-size: 12px; font-weight: 600; cursor: pointer;
  transition: all var(--motion-slow) var(--ease-out); font-family: var(--font, inherit);
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
  transition: border-color var(--motion-slow) var(--ease-out);
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
  transition: border-color var(--motion-slow) var(--ease-out);
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
  transition: all var(--motion-slow) var(--ease-out);
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
  animation: rex-check-in var(--motion-slow) var(--ease-out);
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
/* Sondage options */
.rex-sondage-opts { display: flex; flex-direction: column; gap: 8px; }
.rex-sondage-opt { padding: 12px 16px; border-radius: 10px; border: 2px solid var(--border); background: var(--bg-elevated); color: var(--text-primary); font-size: 14px; text-align: left; cursor: pointer; transition: all .15s; }
.rex-sondage-opt.selected { border-color: #0d9488; background: rgba(13, 148, 136, .1); color: #0d9488; font-weight: 600; }
/* Humeur emojis */
.rex-humeur-grid { display: flex; justify-content: center; gap: 12px; }
.rex-humeur-btn { font-size: 36px; padding: 12px; border-radius: 14px; border: 2px solid transparent; background: var(--bg-elevated); cursor: pointer; transition: all .15s; }
.rex-humeur-btn.selected { border-color: #0d9488; background: rgba(13, 148, 136, .1); transform: scale(1.15); }
/* Priorite classement */
.rex-priorite-list { display: flex; flex-direction: column; gap: 6px; }
.rex-priorite-item { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 10px; background: var(--bg-elevated); border: 1px solid var(--border); }
.rex-priorite-rank { font-weight: 700; color: #0d9488; min-width: 20px; }
.rex-priorite-label { flex: 1; font-size: 14px; color: var(--text-primary); }
.rex-priorite-btns { display: flex; flex-direction: column; gap: 2px; }
.rex-priorite-move { background: none; border: 1px solid var(--border); border-radius: 4px; padding: 2px 6px; font-size: 12px; cursor: pointer; color: var(--text-secondary); }
.rex-priorite-move:hover { border-color: #0d9488; color: #0d9488; }
/* Matrice multi-criteres */
.rex-matrice-grid { display: flex; flex-direction: column; gap: 12px; }
.rex-matrice-row { display: flex; align-items: center; gap: 10px; }
.rex-matrice-label { flex: 1; font-size: 14px; color: var(--text-primary); }
.rex-matrice-stars { display: flex; gap: 4px; }
.rex-matrice-star { font-size: 20px; color: var(--border); background: none; border: none; cursor: pointer; transition: color .1s; }
.rex-matrice-star.active { color: #f59e0b; }
/* Resultats humeur */
.rex-humeur-results { display: flex; flex-direction: column; gap: 8px; }
.rex-humeur-result { display: flex; align-items: center; gap: 10px; }
.rex-humeur-emoji { font-size: 24px; }
.rex-humeur-bar { height: 20px; background: linear-gradient(90deg, #0d9488, #14b8a6); border-radius: 6px; min-width: 4px; transition: width .3s; }
.rex-humeur-count { font-size: 13px; font-weight: 600; color: var(--text-secondary); min-width: 24px; }
/* Resultats priorite */
.rex-priorite-results { display: flex; flex-direction: column; gap: 6px; }
.rex-priorite-result { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 8px; background: var(--bg-elevated); }
.rex-priorite-avg { font-size: 12px; color: var(--text-secondary); margin-left: auto; }
/* Resultats matrice */
.rex-matrice-results { display: flex; flex-direction: column; gap: 8px; }
.rex-matrice-result { display: flex; align-items: center; gap: 10px; }
.rex-matrice-bar-wrap { flex: 1; height: 16px; background: var(--bg-elevated); border-radius: 6px; overflow: hidden; }
.rex-matrice-bar { height: 100%; background: linear-gradient(90deg, #0d9488, #14b8a6); border-radius: 6px; transition: width .3s; }
.rex-matrice-avg { font-size: 13px; font-weight: 600; color: #0d9488; min-width: 30px; text-align: right; }
</style>
