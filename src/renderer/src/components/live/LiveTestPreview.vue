/**
 * LiveTestPreview : rendu "cote etudiant" d'une activite, sans backend ni socket.
 * Permet au prof de verifier le rendu avant de diffuser aux etudiants.
 */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Smartphone, Smile, Star } from 'lucide-vue-next'
import {
  activityIcon, activityTypeLabel, getActivityCategory,
  ACTIVITY_CATEGORIES, HUMEUR_EMOJIS, parseJsonArray, parsePairs,
} from '@/utils/liveActivity'
import type { LiveActivity } from '@/types'
import LiveCodeViewer from './LiveCodeViewer.vue'

const props = defineProps<{
  activities: LiveActivity[]
  currentActivity?: LiveActivity | null
}>()

const selectedId = ref<number | null>(
  props.currentActivity?.id ?? props.activities[0]?.id ?? null,
)

const selected = computed<LiveActivity | null>(() => {
  if (props.currentActivity) return props.currentActivity
  return props.activities.find(a => a.id === selectedId.value) ?? null
})

const selectedOptions = computed<string[]>(() =>
  selected.value ? parseJsonArray<string>(selected.value.options as string | null) : [],
)
const selectedPairs = computed<{ left: string; right: string }[]>(() =>
  selected.value ? parsePairs(selected.value.correct_answers as string | null) : [],
)

// Mock interactive state (purely visual feedback, not persisted)
const mockSelected = ref<number | null>(null)
const mockText = ref('')
const mockRating = ref(0)
const mockEmoji = ref<string | null>(null)
</script>

<template>
  <div class="ltp-wrap" :style="{ '--cat-color': selected ? ACTIVITY_CATEGORIES[getActivityCategory(selected.type)].color : 'var(--accent)' }">
    <div class="ltp-header">
      <div class="ltp-header-title">
        <Smartphone :size="16" />
        <span>Apercu etudiant</span>
      </div>
      <select v-if="!currentActivity && activities.length > 0" v-model="selectedId" class="ltp-select">
        <option v-for="a in activities" :key="a.id" :value="a.id">
          {{ activityTypeLabel(a.type) }} &mdash; {{ a.title }}
        </option>
      </select>
    </div>

    <!-- Phone-like frame -->
    <div class="ltp-phone">
      <div class="ltp-phone-notch" />
      <div class="ltp-phone-screen">
        <!-- No activity -->
        <div v-if="!selected" class="ltp-empty">
          <Smartphone :size="28" class="ltp-empty-icon" />
          <span class="ltp-empty-title">Aucune activite a previsualiser</span>
          <span class="ltp-empty-desc">Ajoutez une activite ou lancez-en une pour voir le rendu cote etudiant.</span>
        </div>

        <template v-else>
          <div class="ltp-activity-header">
            <div class="ltp-cat-badge">
              <component :is="activityIcon(selected.type)" :size="12" />
              {{ activityTypeLabel(selected.type) }}
            </div>
            <h3 class="ltp-activity-title">{{ selected.title || 'Sans titre' }}</h3>
          </div>

          <!-- QCM / Sondage -->
          <div v-if="selected.type === 'qcm' || selected.type === 'sondage'" class="ltp-options">
            <button
              v-for="(opt, i) in selectedOptions"
              :key="i"
              class="ltp-option-btn"
              :class="{ selected: mockSelected === i }"
              @click="mockSelected = i"
            >
              <span class="ltp-option-letter">{{ String.fromCharCode(65 + i) }}</span>
              <span class="ltp-option-text">{{ opt }}</span>
            </button>
          </div>

          <!-- Vrai / Faux -->
          <div v-else-if="selected.type === 'vrai_faux'" class="ltp-vf">
            <button class="ltp-vf-btn ltp-vf-vrai" :class="{ selected: mockSelected === 0 }" @click="mockSelected = 0">Vrai</button>
            <button class="ltp-vf-btn ltp-vf-faux" :class="{ selected: mockSelected === 1 }" @click="mockSelected = 1">Faux</button>
          </div>

          <!-- Reponse courte / Question ouverte / Sondage libre / Nuage / Estimation -->
          <div v-else-if="['reponse_courte','question_ouverte','sondage_libre','nuage','estimation'].includes(selected.type)" class="ltp-input-wrap">
            <textarea
              v-if="selected.type !== 'reponse_courte' && selected.type !== 'estimation'"
              v-model="mockText"
              class="ltp-textarea"
              :placeholder="selected.type === 'nuage' ? `Jusqu'a ${selected.max_words ?? 2} mots-cles` : 'Votre reponse...'"
              rows="3"
            />
            <input
              v-else
              v-model="mockText"
              class="ltp-input"
              :type="selected.type === 'estimation' ? 'number' : 'text'"
              :placeholder="selected.type === 'estimation' ? 'Votre estimation...' : 'Votre reponse...'"
            />
          </div>

          <!-- Association -->
          <div v-else-if="selected.type === 'association'" class="ltp-pairs">
            <div v-for="(p, i) in selectedPairs" :key="i" class="ltp-pair-row">
              <span class="ltp-pair-left">{{ p.left }}</span>
              <span class="ltp-pair-arrow">&rarr;</span>
              <select class="ltp-pair-select">
                <option>Choisir...</option>
                <option v-for="pp in selectedPairs" :key="pp.right" :value="pp.right">{{ pp.right }}</option>
              </select>
            </div>
          </div>

          <!-- Echelle -->
          <div v-else-if="selected.type === 'echelle'" class="ltp-scale">
            <template v-if="(selected.max_rating ?? 5) <= 5">
              <button
                v-for="n in (selected.max_rating ?? 5)"
                :key="n"
                class="ltp-star-btn"
                :class="{ filled: mockRating >= n }"
                @click="mockRating = n"
              >
                <Star :size="22" :fill="mockRating >= n ? 'currentColor' : 'none'" />
              </button>
            </template>
            <div v-else class="ltp-slider-wrap">
              <input type="range" :min="1" :max="selected.max_rating ?? 10" v-model.number="mockRating" class="ltp-slider" />
              <span class="ltp-slider-val">{{ mockRating || 1 }} / {{ selected.max_rating ?? 10 }}</span>
            </div>
          </div>

          <!-- Humeur -->
          <div v-else-if="selected.type === 'humeur'" class="ltp-emojis">
            <button
              v-for="e in HUMEUR_EMOJIS"
              :key="e"
              class="ltp-emoji-btn"
              :class="{ selected: mockEmoji === e }"
              @click="mockEmoji = e"
            >{{ e }}</button>
          </div>

          <!-- Priorite -->
          <div v-else-if="selected.type === 'priorite'" class="ltp-priority">
            <div v-for="(item, i) in selectedOptions" :key="i" class="ltp-priority-item">
              <span class="ltp-priority-rank">{{ i + 1 }}</span>
              <span class="ltp-priority-text">{{ item }}</span>
            </div>
            <p class="ltp-hint">Les etudiants peuvent reordonner par glisser-deposer.</p>
          </div>

          <!-- Matrice -->
          <div v-else-if="selected.type === 'matrice'" class="ltp-matrix">
            <div v-for="(crit, i) in selectedOptions" :key="i" class="ltp-matrix-row">
              <span class="ltp-matrix-label">{{ crit }}</span>
              <div class="ltp-matrix-stars">
                <Star v-for="n in (selected.max_rating ?? 5)" :key="n" :size="14" class="ltp-matrix-star" />
              </div>
            </div>
          </div>

          <!-- Live Code -->
          <div v-else-if="selected.type === 'live_code'" class="ltp-code-preview">
            <LiveCodeViewer
              :activity-id="selected.id"
              :initial-content="selected.content ?? `// Prof ecrira du ${selected.language ?? 'code'} en direct`"
              :initial-language="selected.language ?? 'javascript'"
              :preview="true"
            />
          </div>

          <!-- Board -->
          <div v-else-if="selected.type === 'board'" class="ltp-board">
            <div v-for="(col, i) in selectedOptions" :key="i" class="ltp-board-col">
              <span class="ltp-board-col-title">{{ col }}</span>
              <div class="ltp-board-postit">Idee exemple</div>
              <button class="ltp-board-add">+ Ajouter</button>
            </div>
          </div>

          <div v-else class="ltp-empty">
            <span class="ltp-empty-desc">Apercu non disponible pour {{ selected.type }}.</span>
          </div>

          <!-- Mock submit (visuel uniquement) -->
          <button class="ltp-submit" disabled>Envoyer (apercu)</button>
        </template>
      </div>
    </div>

    <p class="ltp-footer">
      <Smile :size="11" />
      Mode apercu : aucune reponse n'est enregistree. Ajustez votre activite avant de la diffuser.
    </p>
  </div>
</template>

<style scoped>
.ltp-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  min-width: 280px;
  max-width: 380px;
}
.ltp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ltp-header-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .5px;
}
.ltp-select {
  font-size: 11px;
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border-input);
  border-radius: 6px;
  padding: 3px 6px;
  max-width: 180px;
  outline: none;
  font-family: inherit;
}

/* Phone frame */
.ltp-phone {
  position: relative;
  background: #0a0a0f;
  border: 2px solid var(--border);
  border-radius: 28px;
  padding: 26px 10px 14px;
  box-shadow: 0 8px 30px rgba(0,0,0,.25), inset 0 0 0 3px rgba(255,255,255,.02);
}
.ltp-phone-notch {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 5px;
  border-radius: 999px;
  background: #1a1a22;
}
.ltp-phone-screen {
  min-height: 360px;
  max-height: 520px;
  overflow-y: auto;
  background: #15151c;
  border-radius: 18px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  color: #e6e7ea;
  font-size: 13px;
}

.ltp-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
  padding: 24px 8px;
  color: #8a8a95;
}
.ltp-empty-icon { opacity: .4; }
.ltp-empty-title { font-size: 13px; font-weight: 700; color: #c8c8d0; }
.ltp-empty-desc { font-size: 11px; line-height: 1.4; }

.ltp-activity-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ltp-cat-badge {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cat-color) 18%, transparent);
  color: var(--cat-color);
  text-transform: uppercase;
  letter-spacing: .4px;
}
.ltp-activity-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
}

/* Options */
.ltp-options { display: flex; flex-direction: column; gap: 6px; }
.ltp-option-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  background: #1e1e27;
  border: 1.5px solid #2a2a35;
  border-radius: 8px;
  color: #e6e7ea;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  transition: all .12s;
}
.ltp-option-btn:hover { background: #23232e; }
.ltp-option-btn.selected {
  background: color-mix(in srgb, var(--cat-color) 15%, #1e1e27);
  border-color: var(--cat-color);
}
.ltp-option-letter {
  width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  background: #2a2a35; border-radius: 6px;
  font-size: 11px; font-weight: 700;
  flex-shrink: 0;
}
.ltp-option-btn.selected .ltp-option-letter {
  background: var(--cat-color); color: #fff;
}

/* Vrai/Faux */
.ltp-vf { display: flex; gap: 8px; }
.ltp-vf-btn {
  flex: 1;
  padding: 14px;
  background: #1e1e27;
  border: 2px solid #2a2a35;
  border-radius: 10px;
  color: #e6e7ea;
  font-size: 14px; font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all .12s;
}
.ltp-vf-vrai.selected { background: rgba(34,197,94,.15); border-color: #22c55e; color: #22c55e; }
.ltp-vf-faux.selected { background: rgba(239,68,68,.15); border-color: #ef4444; color: #ef4444; }

/* Textarea/input */
.ltp-textarea, .ltp-input {
  width: 100%;
  padding: 10px 12px;
  background: #1e1e27;
  border: 1.5px solid #2a2a35;
  border-radius: 8px;
  color: #e6e7ea;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  resize: vertical;
}
.ltp-textarea:focus, .ltp-input:focus { border-color: var(--cat-color); }

/* Pairs */
.ltp-pairs { display: flex; flex-direction: column; gap: 6px; }
.ltp-pair-row {
  display: flex; align-items: center; gap: 6px;
  padding: 6px;
  background: #1e1e27; border-radius: 6px;
  font-size: 11px;
}
.ltp-pair-left { flex: 1; color: #fff; font-weight: 600; }
.ltp-pair-arrow { color: #6a6a75; }
.ltp-pair-select {
  flex: 1;
  padding: 4px 6px;
  background: #0f0f15; color: #e6e7ea;
  border: 1px solid #2a2a35; border-radius: 5px;
  font-size: 11px;
  font-family: inherit;
}

/* Scale */
.ltp-scale { display: flex; justify-content: center; gap: 4px; padding: 8px 0; }
.ltp-star-btn {
  background: none; border: none; cursor: pointer;
  color: #3a3a45;
  transition: color .15s;
}
.ltp-star-btn.filled { color: #fbbf24; }
.ltp-slider-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; width: 100%; }
.ltp-slider { width: 100%; accent-color: var(--cat-color); }
.ltp-slider-val { font-size: 13px; font-weight: 700; color: var(--cat-color); }

/* Humeur */
.ltp-emojis { display: flex; gap: 6px; justify-content: space-around; padding: 6px 0; }
.ltp-emoji-btn {
  background: #1e1e27; border: 2px solid #2a2a35;
  border-radius: 50%;
  width: 46px; height: 46px;
  font-size: 24px; cursor: pointer;
  transition: all .12s;
}
.ltp-emoji-btn:hover { background: #23232e; transform: scale(1.05); }
.ltp-emoji-btn.selected { background: color-mix(in srgb, var(--cat-color) 20%, #1e1e27); border-color: var(--cat-color); }

/* Priorite */
.ltp-priority { display: flex; flex-direction: column; gap: 5px; }
.ltp-priority-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 9px; background: #1e1e27; border-radius: 6px;
  font-size: 12px;
}
.ltp-priority-rank {
  width: 22px; height: 22px;
  background: var(--cat-color); color: #fff;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700;
  flex-shrink: 0;
}
.ltp-priority-text { color: #e6e7ea; }
.ltp-hint { font-size: 10px; color: #8a8a95; font-style: italic; margin: 4px 0 0; }

/* Matrice */
.ltp-matrix { display: flex; flex-direction: column; gap: 6px; }
.ltp-matrix-row {
  display: flex; justify-content: space-between; align-items: center; gap: 6px;
  padding: 7px 9px; background: #1e1e27; border-radius: 6px;
  font-size: 11px;
}
.ltp-matrix-label { color: #e6e7ea; font-weight: 600; }
.ltp-matrix-stars { display: flex; gap: 2px; color: #3a3a45; }

/* Code */
.ltp-code-preview :deep(.lcv-wrap) { min-height: 200px; border-radius: 8px; }

/* Board */
.ltp-board { display: flex; gap: 4px; overflow-x: auto; padding-bottom: 4px; }
.ltp-board-col {
  min-width: 95px;
  display: flex; flex-direction: column; gap: 4px;
  padding: 6px; background: #1e1e27;
  border-radius: 6px; flex-shrink: 0;
}
.ltp-board-col-title {
  font-size: 10px; font-weight: 700;
  color: #c8c8d0; text-transform: uppercase;
  letter-spacing: .4px;
}
.ltp-board-postit {
  padding: 6px; background: #fef3c7; color: #78350f;
  border-radius: 4px; font-size: 10px;
}
.ltp-board-add {
  padding: 4px; font-size: 10px;
  background: transparent; border: 1px dashed #3a3a45;
  border-radius: 4px; color: #6a6a75;
  cursor: pointer; font-family: inherit;
}

/* Submit mock */
.ltp-submit {
  margin-top: auto;
  padding: 10px;
  background: var(--cat-color);
  color: #fff; border: none; border-radius: 8px;
  font-size: 13px; font-weight: 700;
  cursor: not-allowed; opacity: .55;
  font-family: inherit;
}

.ltp-footer {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--text-muted);
  font-style: italic;
  margin: 0;
  text-align: center;
  justify-content: center;
}
</style>
