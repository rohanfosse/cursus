<!--
  LivePresentationMode : mode projection plein ecran style Wooclap.
  Affiche : code de session en permanence (coin haut-gauche),
            titre XXL centre,
            compteur de reponses en grand,
            slot pour les resultats en direct (n'importe quel composant passe).

  Le prof appuie sur ce mode quand il a un videoprojecteur ; les etudiants
  repondent depuis leur telephone comme d'habitude.
-->
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { X, Users, Clock, Maximize2, ChevronRight, AlertTriangle } from 'lucide-vue-next'
import { ACTIVITY_CATEGORIES, activityTypeLabel, getActivityCategory } from '@/utils/liveActivity'
import type { LiveActivity } from '@/types'
import QrCode from './QrCode.vue'

const props = defineProps<{
  activity: LiveActivity
  joinCode?: string | null
  responseCount: number
  elapsedSeconds?: number | null
  medianResponseSeconds?: number | null
  /** Position 1-based de l'activite dans la session (0 si N/A) */
  positionIndex?: number
  totalCount?: number
  /** True si une activite pending suit — affiche un bouton "Suivante". */
  hasNext?: boolean
  /** Nombre d'etudiants ayant signale une difficulte (confusion signal) */
  confusionCount?: number
}>()

const emit = defineEmits<{ close: []; closeActivity: []; next: [] }>()

const rootRef = ref<HTMLElement | null>(null)
const isFullscreen = ref(false)

const categoryColor = computed(() =>
  ACTIVITY_CATEGORIES[getActivityCategory(props.activity.type)].color,
)

async function requestFs() {
  try {
    const el = rootRef.value ?? document.documentElement
    if (!document.fullscreenElement) {
      await el.requestFullscreen()
    }
    isFullscreen.value = !!document.fullscreenElement
  } catch { /* ignore */ }
}

async function exitFs() {
  try { if (document.fullscreenElement) await document.exitFullscreen() } catch { /* ignore */ }
  isFullscreen.value = false
}

function onFsChange() {
  isFullscreen.value = !!document.fullscreenElement
  // Quand l'utilisateur appuie sur Esc (qui fait sortir du fullscreen), on ferme aussi le mode presentation
  if (!document.fullscreenElement) emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && !document.fullscreenElement) {
    emit('close')
  }
}

onMounted(async () => {
  document.addEventListener('fullscreenchange', onFsChange)
  window.addEventListener('keydown', onKeydown)
  // Rentree auto en fullscreen a l'ouverture
  await requestFs()
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', onFsChange)
  window.removeEventListener('keydown', onKeydown)
  if (document.fullscreenElement) document.exitFullscreen().catch(() => { /* ignore */ })
})

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}
</script>

<template>
  <div ref="rootRef" class="lpm" :style="{ '--cat-color': categoryColor }">
    <!-- Barre superieure minimaliste -->
    <header class="lpm-header">
      <div class="lpm-header-left">
        <div v-if="joinCode" class="lpm-join">
          <QrCode :value="`cursus://live/join/${joinCode}`" :size="80" class="lpm-qr" />
          <div>
            <span class="lpm-join-label">Rejoindre sur cursus.app</span>
            <span class="lpm-join-code">{{ joinCode }}</span>
          </div>
        </div>
      </div>

      <div class="lpm-header-right">
        <span v-if="totalCount && totalCount > 1 && positionIndex" class="lpm-position">
          {{ positionIndex }}<span class="lpm-position-sep">/</span>{{ totalCount }}
        </span>
        <button v-if="hasNext" class="lpm-ctrl lpm-ctrl-primary" title="Activite suivante (flecha droite)" @click="emit('next')">
          <ChevronRight :size="16" />
          Suivante
        </button>
        <button v-if="!isFullscreen" class="lpm-ctrl" title="Plein ecran (F11)" @click="requestFs">
          <Maximize2 :size="16" />
        </button>
        <button class="lpm-ctrl lpm-ctrl-danger" title="Terminer l'activite" @click="emit('closeActivity')">
          Terminer
        </button>
        <button class="lpm-ctrl" title="Fermer le mode projection (Esc)" @click="exitFs().then(() => emit('close'))">
          <X :size="18" />
        </button>
      </div>
    </header>

    <!-- Question + meta -->
    <main class="lpm-main">
      <div class="lpm-type-chip">{{ activityTypeLabel(activity.type) }}</div>
      <h1 class="lpm-title">{{ activity.title }}</h1>

      <!-- Slot : composant resultats live -->
      <div class="lpm-results">
        <slot />
      </div>
    </main>

    <!-- Footer stats -->
    <footer class="lpm-footer">
      <div class="lpm-stat lpm-stat-big">
        <Users :size="28" />
        <div class="lpm-stat-val">
          <span class="lpm-stat-num">{{ responseCount }}</span>
          <span class="lpm-stat-lbl">reponse{{ responseCount > 1 ? 's' : '' }}</span>
        </div>
      </div>
      <div v-if="elapsedSeconds !== null && elapsedSeconds !== undefined" class="lpm-stat">
        <Clock :size="18" />
        <span>{{ formatElapsed(elapsedSeconds) }}</span>
      </div>
      <div v-if="medianResponseSeconds !== null && medianResponseSeconds !== undefined" class="lpm-stat">
        <span class="lpm-stat-caption">Temps median</span>
        <span>~{{ Math.round(medianResponseSeconds) }}s</span>
      </div>
      <div v-if="confusionCount && confusionCount > 0" class="lpm-stat lpm-stat-warn">
        <AlertTriangle :size="20" />
        <div class="lpm-stat-val">
          <span class="lpm-stat-num">{{ confusionCount }}</span>
          <span class="lpm-stat-lbl">perdu{{ confusionCount > 1 ? 's' : '' }}</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.lpm {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background:
    radial-gradient(ellipse at top, color-mix(in srgb, var(--cat-color) 18%, transparent) 0%, transparent 55%),
    radial-gradient(ellipse at bottom, color-mix(in srgb, var(--cat-color) 10%, transparent) 0%, transparent 50%),
    #0a0a0f;
  color: #fff;
  display: flex;
  flex-direction: column;
  padding: 24px 48px 32px;
  font-family: var(--font);
  animation: lpm-in .28s var(--ease-out);
}
@keyframes lpm-in {
  from { opacity: 0; transform: scale(1.02); }
  to   { opacity: 1; transform: scale(1); }
}

/* Header */
.lpm-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  flex-shrink: 0;
  min-height: 40px;
}
.lpm-join {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, .06);
  border: 1px solid rgba(255, 255, 255, .1);
  border-radius: 10px;
  backdrop-filter: blur(8px);
}
.lpm-qr {
  border-radius: 6px;
  flex-shrink: 0;
}
.lpm-join-label {
  font-size: 12px;
  color: rgba(255, 255, 255, .55);
  font-weight: 500;
}
.lpm-join-code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 2px;
  color: var(--cat-color);
}

.lpm-header-right {
  display: flex;
  gap: 8px;
}
.lpm-ctrl {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  background: rgba(255, 255, 255, .06);
  border: 1px solid rgba(255, 255, 255, .1);
  color: rgba(255, 255, 255, .75);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all .15s;
}
.lpm-ctrl:hover {
  background: rgba(255, 255, 255, .1);
  color: #fff;
}
.lpm-ctrl-danger {
  background: rgba(239, 68, 68, .15);
  border-color: rgba(239, 68, 68, .3);
  color: #fca5a5;
}
.lpm-ctrl-danger:hover {
  background: rgba(239, 68, 68, .25);
  color: #fff;
}
.lpm-ctrl-primary {
  background: var(--cat-color);
  border-color: var(--cat-color);
  color: #fff;
  font-weight: 700;
}
.lpm-ctrl-primary:hover {
  filter: brightness(1.12);
  color: #fff;
}
.lpm-position {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, .06);
  border: 1px solid rgba(255, 255, 255, .1);
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, .75);
}
.lpm-position-sep {
  opacity: .4;
  margin: 0 3px;
}

/* Main */
.lpm-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  padding: 24px 0;
  min-height: 0;
  overflow: hidden;
}
.lpm-type-chip {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--cat-color);
  padding: 5px 14px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cat-color) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--cat-color) 35%, transparent);
}
.lpm-title {
  font-size: clamp(28px, 5vw, 62px);
  font-weight: 800;
  text-align: center;
  line-height: 1.15;
  max-width: 1200px;
  margin: 0;
  letter-spacing: -0.015em;
  text-wrap: balance;
}
.lpm-results {
  flex: 1;
  width: 100%;
  max-width: 1400px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  overflow: auto;
  padding: 16px 0;
}

/* Agrandit les composants Rex passes en slot */
.lpm-results :deep(.rex-cloud) {
  font-size: 1.5em;
  min-height: 300px;
  gap: 18px 28px;
}
.lpm-results :deep(.rex-cloud-item) {
  font-size: clamp(24px, 3vw, 72px) !important;
}
.lpm-results :deep(.rex-sondage),
.lpm-results :deep(.rex-echelle),
.lpm-results :deep(.rex-humeur),
.lpm-results :deep(.rex-priorite),
.lpm-results :deep(.rex-matrice),
.lpm-results :deep(.rex-qo) {
  width: 100%;
  max-width: 900px;
  font-size: 18px;
}
.lpm-results :deep(.rex-sondage-row) {
  gap: 16px;
}
.lpm-results :deep(.rex-sondage-label) {
  flex: 0 0 260px;
  font-size: 22px;
  color: #fff;
  font-weight: 600;
}
.lpm-results :deep(.rex-sondage-bar-wrap) {
  height: 48px;
  border-radius: 10px;
}
.lpm-results :deep(.rex-sondage-count) {
  font-size: 26px;
  flex: 0 0 56px;
}

/* Footer */
.lpm-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, .08);
  flex-shrink: 0;
}
.lpm-stat {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: rgba(255, 255, 255, .65);
  font-size: 16px;
  font-weight: 600;
}
.lpm-stat-big {
  color: #fff;
  gap: 14px;
}
.lpm-stat-val {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.lpm-stat-num {
  font-size: 36px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.lpm-stat-lbl {
  font-size: 14px;
  color: rgba(255, 255, 255, .55);
  font-weight: 500;
}
.lpm-stat-warn {
  color: #fbbf24;
  animation: lpm-pulse-warn .8s ease-in-out infinite alternate;
}
@keyframes lpm-pulse-warn {
  from { opacity: .6 }
  to   { opacity: 1 }
}
.lpm-stat-caption {
  font-size: 11px;
  color: rgba(255, 255, 255, .45);
  text-transform: uppercase;
  letter-spacing: 1px;
}

@media (max-width: 900px) {
  .lpm { padding: 16px 20px 24px; }
  .lpm-join-code { font-size: 18px; }
  .lpm-results :deep(.rex-sondage-label) { flex: 0 0 140px; font-size: 16px; }
}
</style>
