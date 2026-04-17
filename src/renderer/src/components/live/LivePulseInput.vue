/**
 * LivePulseInput : un seul composant qui gere tous les inputs Pulse
 * (echelle, humeur, question_ouverte, sondage_libre, nuage, sondage, priorite, matrice).
 * Soumet la reponse via liveStore.submitResponse.
 */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Send, Star } from 'lucide-vue-next'
import { useLiveStore } from '@/stores/live'
import type { LiveActivity } from '@/types'

const props = defineProps<{ activity: LiveActivity }>()
const emit = defineEmits<{ submitted: [] }>()

const liveStore = useLiveStore()

const HUMEUR_EMOJIS = ['😊', '🙂', '😐', '😟', '🤯']

const textInput = ref('')
const wordInputs = ref<string[]>(['', '', ''])
const ratingInput = ref(0)
const sondageSelected = ref<number | null>(null)
const humeurSelected = ref<string | null>(null)
const prioriteOrder = ref<number[]>([])
const matriceRatings = ref<Record<string, number>>({})

const parsedOptions = computed<string[]>(() => {
  if (!props.activity.options) return []
  if (Array.isArray(props.activity.options)) return props.activity.options
  try { const arr = JSON.parse(props.activity.options as string); return Array.isArray(arr) ? arr : [] } catch { return [] }
})

// Initialize priorite order
if (props.activity.type === 'priorite' && parsedOptions.value.length > 0) {
  prioriteOrder.value = parsedOptions.value.map((_, i) => i)
}
// Initialize matrice ratings
if (props.activity.type === 'matrice' && parsedOptions.value.length > 0) {
  for (const crit of parsedOptions.value) matriceRatings.value[crit] = 0
}

async function submitText() {
  if (!textInput.value.trim()) return
  await liveStore.submitResponse(props.activity.id, { text: textInput.value.trim() })
  textInput.value = ''
  emit('submitted')
}

async function submitWords() {
  const words = wordInputs.value.map(w => w.trim()).filter(Boolean)
  if (!words.length) return
  await liveStore.submitResponse(props.activity.id, { answer: words.join(',') })
  wordInputs.value = ['', '', '']
  emit('submitted')
}

async function submitRating() {
  if (ratingInput.value <= 0) return
  await liveStore.submitResponse(props.activity.id, { answer: String(ratingInput.value) })
  emit('submitted')
}

async function submitSondage() {
  if (sondageSelected.value === null) return
  await liveStore.submitResponse(props.activity.id, { answer: String(sondageSelected.value) })
  emit('submitted')
}

async function submitHumeur() {
  if (!humeurSelected.value) return
  await liveStore.submitResponse(props.activity.id, { answer: humeurSelected.value })
  emit('submitted')
}

async function submitPriorite() {
  await liveStore.submitResponse(props.activity.id, { answer: prioriteOrder.value.join(',') })
  emit('submitted')
}

async function submitMatrice() {
  if (Object.values(matriceRatings.value).some(v => v === 0)) return
  await liveStore.submitResponse(props.activity.id, { answer: JSON.stringify(matriceRatings.value) })
  emit('submitted')
}

function movePriorite(from: number, to: number) {
  if (to < 0 || to >= prioriteOrder.value.length) return
  const arr = [...prioriteOrder.value]
  const [item] = arr.splice(from, 1)
  arr.splice(to, 0, item)
  prioriteOrder.value = arr
}

const maxRating = computed(() => props.activity.max_rating ?? 5)
const wordCount = computed(() => props.activity.max_words ?? 3)
</script>

<template>
  <div class="lpi-wrap">
    <!-- Sondage libre / texte anonyme -->
    <div v-if="activity.type === 'sondage_libre'" class="lpi-section">
      <input v-model="textInput" type="text" class="lpi-input" placeholder="Votre reponse..." @keydown.enter="submitText" />
      <button class="lpi-btn" :disabled="!textInput.trim()" @click="submitText">
        <Send :size="14" /> Envoyer
      </button>
    </div>

    <!-- Nuage de mots -->
    <div v-else-if="activity.type === 'nuage'" class="lpi-section">
      <input
        v-for="n in wordCount"
        :key="n"
        v-model="wordInputs[n - 1]"
        type="text"
        class="lpi-input"
        :placeholder="`Mot ${n}`"
      />
      <button class="lpi-btn" :disabled="!wordInputs.some(w => w.trim())" @click="submitWords">
        <Send :size="14" /> Envoyer
      </button>
    </div>

    <!-- Echelle -->
    <div v-else-if="activity.type === 'echelle'" class="lpi-section">
      <div v-if="maxRating <= 5" class="lpi-star-row">
        <button
          v-for="s in maxRating"
          :key="s"
          class="lpi-star-btn"
          :class="{ filled: s <= ratingInput }"
          @click="ratingInput = s"
        >
          <Star :size="36" />
        </button>
      </div>
      <div v-if="maxRating <= 5 && ratingInput > 0" class="lpi-rating-label">
        {{ ratingInput }} / {{ maxRating }}
        {{ ratingInput === 1 ? '- Insuffisant' : ratingInput === 2 ? '- Moyen' : ratingInput === 3 ? '- Correct' : ratingInput === 4 ? '- Bien' : '- Excellent' }}
      </div>
      <div v-if="maxRating > 5" class="lpi-slider-row">
        <span class="lpi-slider-min">1</span>
        <input v-model.number="ratingInput" type="range" min="1" :max="maxRating" class="lpi-slider" />
        <span class="lpi-slider-max">{{ maxRating }}</span>
      </div>
      <div v-if="maxRating > 5 && ratingInput > 0" class="lpi-slider-val-big">{{ ratingInput }}</div>
      <button class="lpi-btn" :disabled="ratingInput <= 0" @click="submitRating">
        <Send :size="14" /> Envoyer
      </button>
    </div>

    <!-- Question ouverte -->
    <div v-else-if="activity.type === 'question_ouverte'" class="lpi-section">
      <textarea v-model="textInput" class="lpi-textarea" placeholder="Votre retour..." rows="4" />
      <button class="lpi-btn" :disabled="!textInput.trim()" @click="submitText">
        <Send :size="14" /> Envoyer
      </button>
    </div>

    <!-- Sondage options -->
    <div v-else-if="activity.type === 'sondage'" class="lpi-section">
      <div class="lpi-opts">
        <button
          v-for="(opt, i) in parsedOptions"
          :key="i"
          class="lpi-opt"
          :class="{ selected: sondageSelected === i }"
          @click="sondageSelected = i"
        >{{ opt }}</button>
      </div>
      <button class="lpi-btn" :disabled="sondageSelected === null" @click="submitSondage">
        <Send :size="14" /> Envoyer
      </button>
    </div>

    <!-- Humeur -->
    <div v-else-if="activity.type === 'humeur'" class="lpi-section">
      <div class="lpi-humeur">
        <button
          v-for="emoji in HUMEUR_EMOJIS"
          :key="emoji"
          class="lpi-humeur-btn"
          :class="{ selected: humeurSelected === emoji }"
          @click="humeurSelected = emoji"
        >{{ emoji }}</button>
      </div>
      <button class="lpi-btn" :disabled="!humeurSelected" @click="submitHumeur">
        <Send :size="14" /> Envoyer
      </button>
    </div>

    <!-- Priorite -->
    <div v-else-if="activity.type === 'priorite'" class="lpi-section">
      <div class="lpi-priorite">
        <div v-for="(idx, rank) in prioriteOrder" :key="idx" class="lpi-priorite-item">
          <span class="lpi-priorite-rank">{{ rank + 1 }}</span>
          <span class="lpi-priorite-label">{{ parsedOptions[idx] }}</span>
          <div class="lpi-priorite-btns">
            <button v-if="rank > 0" class="lpi-priorite-move" @click="movePriorite(rank, rank - 1)">&uarr;</button>
            <button v-if="rank < prioriteOrder.length - 1" class="lpi-priorite-move" @click="movePriorite(rank, rank + 1)">&darr;</button>
          </div>
        </div>
      </div>
      <button class="lpi-btn" @click="submitPriorite">
        <Send :size="14" /> Envoyer
      </button>
    </div>

    <!-- Matrice -->
    <div v-else-if="activity.type === 'matrice'" class="lpi-section">
      <div class="lpi-matrice">
        <div v-for="crit in Object.keys(matriceRatings)" :key="crit" class="lpi-matrice-row">
          <span class="lpi-matrice-label">{{ crit }}</span>
          <div class="lpi-matrice-stars">
            <button
              v-for="n in maxRating"
              :key="n"
              class="lpi-matrice-star"
              :class="{ active: (matriceRatings[crit] || 0) >= n }"
              @click="matriceRatings[crit] = n"
            >&#9733;</button>
          </div>
        </div>
      </div>
      <button class="lpi-btn" :disabled="Object.values(matriceRatings).some(v => v === 0)" @click="submitMatrice">
        <Send :size="14" /> Envoyer
      </button>
    </div>
  </div>
</template>

<style scoped>
.lpi-wrap { display: flex; flex-direction: column; gap: 12px; }
.lpi-section { display: flex; flex-direction: column; gap: 10px; }
.lpi-input, .lpi-textarea {
  padding: 10px 12px; font-size: 14px; font-family: var(--font);
  border: 1px solid var(--border-input); border-radius: 8px;
  background: var(--bg-input); color: var(--text-primary); outline: none;
}
.lpi-input:focus, .lpi-textarea:focus { border-color: var(--accent); }
.lpi-textarea { resize: vertical; min-height: 100px; }

.lpi-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 10px 16px; font-size: 14px; font-weight: 600;
  border: none; border-radius: 8px; background: var(--accent); color: #fff;
  cursor: pointer; font-family: var(--font); transition: all .15s;
}
.lpi-btn:hover:not(:disabled) { filter: brightness(1.1); }
.lpi-btn:disabled { opacity: .5; cursor: not-allowed; }

/* Stars */
.lpi-star-row { display: flex; gap: 8px; justify-content: center; }
.lpi-star-btn {
  border: none; background: transparent; color: var(--text-muted);
  cursor: pointer; padding: 4px; transition: all .15s;
}
.lpi-star-btn:hover { color: #fbbf24; transform: scale(1.1); }
.lpi-star-btn.filled { color: #fbbf24; }

/* Rating label */
.lpi-rating-label {
  text-align: center; font-size: 14px; font-weight: 600;
  color: var(--accent); margin-top: 4px;
}

/* Slider */
.lpi-slider-row { display: flex; align-items: center; gap: 10px; }
.lpi-slider { flex: 1; height: 6px; accent-color: var(--accent); }
.lpi-slider-min, .lpi-slider-max { font-size: 12px; font-weight: 700; color: var(--text-muted); }
.lpi-slider-val-big {
  text-align: center; font-size: 36px; font-weight: 800; color: var(--accent);
  margin: 4px 0;
}

/* Options */
.lpi-opts { display: flex; flex-direction: column; gap: 8px; }
.lpi-opt {
  padding: 12px 16px; border: 2px solid var(--border-input); border-radius: 8px;
  background: var(--bg-sidebar); color: var(--text-primary); cursor: pointer;
  font-family: var(--font); font-size: 14px; text-align: left; transition: all .15s;
}
.lpi-opt:hover { border-color: var(--accent); }
.lpi-opt.selected { background: rgba(74,144,217,.1); border-color: var(--accent); }

/* Humeur */
.lpi-humeur { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.lpi-humeur-btn {
  width: 64px; height: 64px; font-size: 36px;
  border: 2px solid var(--border); border-radius: 12px;
  background: var(--bg-sidebar); cursor: pointer; transition: all .15s;
}
.lpi-humeur-btn:hover { transform: scale(1.1); }
.lpi-humeur-btn.selected { border-color: var(--accent); background: rgba(74,144,217,.1); }

/* Priorite */
.lpi-priorite { display: flex; flex-direction: column; gap: 6px; }
.lpi-priorite-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--bg-sidebar);
}
.lpi-priorite-rank {
  width: 28px; height: 28px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--accent); color: #fff; font-weight: 700; flex-shrink: 0;
}
.lpi-priorite-label { flex: 1; color: var(--text-primary); font-size: 14px; }
.lpi-priorite-btns { display: flex; gap: 4px; }
.lpi-priorite-move {
  width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border);
  background: transparent; color: var(--text-secondary); cursor: pointer;
}
.lpi-priorite-move:hover { background: var(--bg-hover); }

/* Matrice */
.lpi-matrice { display: flex; flex-direction: column; gap: 10px; }
.lpi-matrice-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--bg-sidebar);
}
.lpi-matrice-label { flex: 1; font-size: 13px; color: var(--text-primary); font-weight: 600; }
.lpi-matrice-stars { display: flex; gap: 2px; }
.lpi-matrice-star {
  width: 26px; height: 26px; border: none; background: transparent;
  color: var(--text-muted); font-size: 18px; cursor: pointer;
}
.lpi-matrice-star.active { color: #fbbf24; }

/* ── Mobile responsive ── */
@media (max-width: 640px) {
  .lpi-humeur-btn { width: 52px; height: 52px; font-size: 28px; }
  .lpi-star-btn { padding: 6px; }
  .lpi-star-btn :deep(svg) { width: 28px; height: 28px; }
  .lpi-slider-val-big { font-size: 28px; }
  .lpi-opt { padding: 14px; font-size: 15px; }
  .lpi-priorite-item { padding: 12px; }
  .lpi-matrice-row { flex-wrap: wrap; }
}
</style>
