<script setup lang="ts">
/**
 * LiveCategoryDetail — sub-page de detail categorie (apres clic carte
 * categorie sur la home prof).
 * Extrait de TeacherLiveView.vue (v2.282).
 *
 * Affiche : header hero gradient + types d'activites + fonctionnalites
 * specifiques + panneau de creation avec input titre + CTA gradient.
 */
import { computed } from 'vue'
import { ArrowRight, Plus } from 'lucide-vue-next'
import { ACTIVITY_CATEGORIES, activityIcon, activityTypeLabel } from '@/utils/liveActivity'
import type { ActivityCategory } from '@/utils/liveActivity'

const props = defineProps<{
  category: ActivityCategory
  modelValue: string
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'update:modelValue', v: string): void
  (e: 'create'): void
}>()

const cat = computed(() => ACTIVITY_CATEGORIES[props.category])

const features = computed(() => {
  switch (props.category) {
    case 'spark':
      return [
        'Scoring et classement en temps reel',
        'Timer par question (optionnel)',
        'Leaderboard et podium final',
        'Correction automatique',
        'Export CSV des resultats',
      ]
    case 'pulse':
      return [
        'Reponses anonymes',
        'Nuage de mots, echelle, sondage, matrice',
        'Resultats agreges en direct',
        'Pas de scoring (feedback libre)',
        'Vote et priorisation',
      ]
    case 'code':
      return [
        'Editeur de code en direct',
        'Coloration syntaxique (JS, Python, Java...)',
        'Broadcast temps reel aux etudiants',
        'Snapshot automatique a la fermeture',
      ]
    case 'board':
      return [
        'Post-its collaboratifs par colonnes',
        'Drag & drop entre colonnes',
        'Votes (max configurable)',
        'Choix de couleur et edition inline',
        'Mode anonyme et export Markdown',
      ]
    default:
      return []
  }
})

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="live-cat-detail" :style="{ '--cat-color': cat.color }">
    <button class="live-home-back" @click="emit('back')">
      <ArrowRight :size="14" style="transform: rotate(180deg)" /> Accueil Live
    </button>

    <div class="lcd-header">
      <div class="lcd-icon">
        <component :is="cat.icon" :size="32" />
      </div>
      <div>
        <h2 class="lcd-title">{{ cat.label }}</h2>
        <p class="lcd-desc">{{ cat.description }}</p>
      </div>
    </div>

    <!-- Types d'activites disponibles -->
    <div class="lcd-section">
      <h3 class="lcd-section-title">Types d'activites disponibles</h3>
      <div class="lcd-types-grid">
        <div
          v-for="t in cat.types"
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

    <!-- Fonctionnalites -->
    <div class="lcd-section">
      <h3 class="lcd-section-title">Fonctionnalites</h3>
      <div class="lcd-features">
        <div v-for="f in features" :key="f" class="lcd-feat">{{ f }}</div>
      </div>
    </div>

    <!-- Zone creation -->
    <div class="lcd-create">
      <input
        :value="modelValue"
        class="live-home-input"
        :placeholder="`Nom de la session ${cat.label} (optionnel)`"
        maxlength="100"
        @input="onInput"
        @keydown.enter="emit('create')"
      />
      <button
        class="lcd-create-btn"
        :disabled="loading"
        @click="emit('create')"
      >
        <Plus :size="16" />
        {{ loading ? 'Creation...' : 'Creer et preparer' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Category detail sub-page (extracted v2.282 — refonte design v2.281) */
.live-cat-detail {
  width: 100%;
  max-width: 760px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

/* Back button (extrait du parent) */
.live-home-back {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-elevated);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: color var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out);
}
.live-home-back:hover {
  color: var(--text-primary);
  border-color: color-mix(in srgb, var(--cat-color, var(--color-live)) 35%, var(--border));
}

/* Header en hero panel */
.lcd-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 28px 32px;
  border-radius: var(--radius-bento);
  border: 1px solid var(--border);
  background:
    radial-gradient(ellipse 80% 100% at 0% 50%,
      color-mix(in srgb, var(--cat-color) 16%, transparent) 0%, transparent 70%),
    radial-gradient(circle 1px at center,
      color-mix(in srgb, var(--cat-color) 25%, transparent) 1px, transparent 1px),
    var(--bg-elevated);
  background-size: 100% 100%, 22px 22px, 100% 100%;
  overflow: hidden;
}
.lcd-header::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg,
    var(--cat-color),
    color-mix(in srgb, var(--cat-color) 50%, transparent));
}
.lcd-icon {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 20px;
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--cat-color) 90%, white) 0%,
    var(--cat-color) 100%);
  color: #fff;
  flex-shrink: 0;
  box-shadow:
    0 10px 28px color-mix(in srgb, var(--cat-color) 35%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}
.lcd-title {
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.03em;
  line-height: 1.1;
  margin: 0;
}
.lcd-desc {
  font-size: 15px;
  color: var(--text-secondary);
  letter-spacing: -0.005em;
  margin: 4px 0 0;
}
.lcd-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.lcd-section-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  line-height: 1.15;
  margin: 0;
}
.lcd-types-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}
.lcd-type-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: border-color var(--motion-fast) var(--ease-out),
              transform var(--motion-fast) var(--ease-out),
              box-shadow var(--motion-fast) var(--ease-out);
}
.lcd-type-card:hover {
  border-color: color-mix(in srgb, var(--cat-color) 40%, var(--border));
  transform: translateY(-1px);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--cat-color) 12%, transparent);
}
.lcd-type-icon {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: color-mix(in srgb, var(--cat-color) 14%, transparent);
  color: var(--cat-color);
  flex-shrink: 0;
}
.lcd-type-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lcd-type-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}
.lcd-type-id {
  font-size: 10.5px;
  color: var(--text-muted);
  font-family: var(--font-mono, ui-monospace, monospace);
}

.lcd-features {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}
.lcd-feat {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-secondary);
  padding: 10px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  border-left: 3px solid var(--cat-color);
}
.lcd-feat::before {
  content: '✓';
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  background: var(--cat-color);
  color: #fff;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Create panel : panneau gradient avec input + big CTA */
.lcd-create {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 24px;
  background:
    radial-gradient(ellipse 60% 100% at 100% 50%,
      color-mix(in srgb, var(--cat-color) 12%, transparent) 0%, transparent 70%),
    var(--bg-elevated);
  border: 1px solid color-mix(in srgb, var(--cat-color) 25%, var(--border));
  border-radius: var(--radius-bento);
  overflow: hidden;
}
.lcd-create::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg,
    var(--cat-color),
    color-mix(in srgb, var(--cat-color) 50%, transparent));
}
.live-home-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: var(--radius);
  background: var(--bg-input, var(--bg-main));
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 14px;
  outline: none;
  transition: border-color var(--motion-fast) var(--ease-out),
              box-shadow var(--motion-fast) var(--ease-out);
}
.live-home-input:focus {
  border-color: var(--cat-color);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--cat-color) 18%, transparent);
}
.live-home-input::placeholder { color: var(--text-muted); }

.lcd-create-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border-radius: var(--radius);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.01em;
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--cat-color) 90%, white) 0%,
    var(--cat-color) 100%);
  color: #fff;
  border: none;
  cursor: pointer;
  font-family: inherit;
  box-shadow: 0 6px 18px color-mix(in srgb, var(--cat-color) 30%, transparent);
  transition:
    transform var(--motion-fast) var(--ease-out),
    box-shadow var(--motion-fast) var(--ease-out),
    filter var(--motion-fast) var(--ease-out);
}
.lcd-create-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  filter: brightness(1.06);
  box-shadow: 0 8px 22px color-mix(in srgb, var(--cat-color) 40%, transparent);
}
.lcd-create-btn:active:not(:disabled) { transform: translateY(0); }
.lcd-create-btn:disabled { opacity: .4; cursor: not-allowed; }

@media (prefers-reduced-motion: reduce) {
  .lcd-type-card,
  .lcd-type-card:hover,
  .lcd-create-btn,
  .lcd-create-btn:hover { transform: none; transition: none; }
}
@media (max-width: 600px) {
  .lcd-header {
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    padding: 20px;
  }
  .lcd-title { font-size: 26px; }
  .lcd-create { padding: 18px; }
}
</style>
