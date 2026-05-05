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
        <span class="lpm-live-dot" aria-hidden="true" />
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
/* v2.281 : refonte mode projection — multi-layer gradient + dot pattern
   signature landing, plus dramatique pour la salle. */
.lpm {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background:
    radial-gradient(ellipse 70% 60% at 25% 20%,
      color-mix(in srgb, var(--cat-color) 22%, transparent) 0%, transparent 60%),
    radial-gradient(ellipse 50% 50% at 80% 80%,
      color-mix(in srgb, var(--cat-color) 14%, transparent) 0%, transparent 55%),
    radial-gradient(circle 1px at center,
      rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    radial-gradient(ellipse 100% 80% at 50% 0%,
      rgba(0, 0, 0, 0.4) 0%, transparent 60%),
    #08080f;
  background-size: 100% 100%, 100% 100%, 32px 32px, 100% 100%, 100% 100%;
  color: #fff;
  display: flex;
  flex-direction: column;
  padding: 24px 48px 32px;
  font-family: var(--font);
  animation: lpm-in .32s var(--ease-out);
}
@keyframes lpm-in {
  from { opacity: 0; transform: scale(1.02); }
  to   { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .lpm { animation: none; }
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
/* Join panel (v2.281) : plus visible depuis le fond de salle (QR + code
   en grand). Glassmorphism + gradient accent pour signaler "rejoignez". */
.lpm-join {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  background:
    linear-gradient(135deg,
      color-mix(in srgb, var(--cat-color) 14%, transparent) 0%,
      rgba(255, 255, 255, 0.04) 100%);
  border: 1px solid color-mix(in srgb, var(--cat-color) 30%, transparent);
  border-radius: var(--radius-lg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.lpm-qr {
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  /* Bordure blanche pour les scans (les QR fonctionnent mieux sur fond clair) */
  border: 4px solid #fff;
  background: #fff;
}
.lpm-join-label {
  display: block;
  font-size: 11px;
  color: rgba(255, 255, 255, .55);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.lpm-join-code {
  display: block;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 4px;
  color: var(--cat-color);
  margin-top: 2px;
  text-shadow: 0 0 24px color-mix(in srgb, var(--cat-color) 60%, transparent);
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
  border-radius: var(--radius);
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
/* Type chip (v2.281) : gradient accent + halo subtle */
.lpm-type-chip {
  position: relative;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--cat-color);
  padding: 6px 16px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--cat-color) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--cat-color) 40%, transparent);
  box-shadow: 0 0 28px color-mix(in srgb, var(--cat-color) 30%, transparent);
}
/* Title : signature display landing -0.03em + line-height 1.05 */
.lpm-title {
  font-size: clamp(36px, 6vw, 76px);
  font-weight: 800;
  text-align: center;
  line-height: 1.05;
  max-width: 1200px;
  margin: 0;
  letter-spacing: -0.03em;
  text-wrap: balance;
  color: #fff;
  text-shadow: 0 2px 24px rgba(0, 0, 0, 0.5);
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
  border-radius: var(--radius);
}
.lpm-results :deep(.rex-sondage-count) {
  font-size: 26px;
  flex: 0 0 56px;
}

/* Footer (v2.281) : stats avec live-dot pulse signature, glassy panels */
.lpm-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 18px 24px;
  margin-top: 8px;
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  flex-shrink: 0;
}
.lpm-stat {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: rgba(255, 255, 255, .65);
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.lpm-stat-big {
  color: #fff;
  gap: 14px;
  position: relative;
  padding: 6px 18px 6px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
}
/* Live dot signature (recording indicator pattern) */
.lpm-live-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--cat-color);
  box-shadow: 0 0 0 0 var(--cat-color);
  animation: lpm-live-pulse 1.6s ease-out infinite;
  flex-shrink: 0;
}
@keyframes lpm-live-pulse {
  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--cat-color) 70%, transparent); }
  70%  { box-shadow: 0 0 0 12px color-mix(in srgb, var(--cat-color) 0%, transparent); }
  100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--cat-color) 0%, transparent); }
}
@media (prefers-reduced-motion: reduce) {
  .lpm-live-dot { animation: none; }
}
.lpm-stat-val {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.lpm-stat-num {
  font-size: 44px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  line-height: 1;
}
.lpm-stat-lbl {
  font-size: 13px;
  color: rgba(255, 255, 255, .55);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.lpm-stat-warn {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.10);
  border: 1px solid rgba(251, 191, 36, 0.25);
  padding: 6px 14px;
  border-radius: 999px;
  animation: lpm-pulse-warn .8s ease-in-out infinite alternate;
}
@keyframes lpm-pulse-warn {
  from { opacity: .6 }
  to   { opacity: 1 }
}
@media (prefers-reduced-motion: reduce) {
  .lpm-stat-warn { animation: none; opacity: 1; }
}
.lpm-stat-caption {
  font-size: 10.5px;
  color: rgba(255, 255, 255, .45);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

@media (max-width: 900px) {
  .lpm { padding: 16px 20px 24px; }
  .lpm-join-code { font-size: 18px; }
  .lpm-results :deep(.rex-sondage-label) { flex: 0 0 140px; font-size: 16px; }
}
</style>
