<script setup lang="ts">
/**
 * DemoBanner - bandeau sticky affiche quand `currentUser.demo === true`.
 *
 * V2 : transforme le bandeau decoratif en mission tracker. Le visiteur voit
 * `X/5 actions decouvertes` et peut deplier la liste des etapes pour savoir
 * ce qui reste a tester. Resout le "cold start problem" : sans guide, un
 * visiteur arrive sur le dashboard et ne sait pas par ou commencer.
 *
 * Detection automatique des actions via `useDemoMission` (router.afterEach
 * coche au passage sur /lumen, /devoirs, etc.). Pas de hooks a poser dans
 * 20 composants, pas de modale qui bloque.
 *
 * Session reelle (backup/restore) : si l'utilisateur etait connecte avec
 * un vrai compte avant de lancer la demo, sa session est sauvegardee dans
 * `cc_session_backup`. Le bouton "Quitter la demo" la restaure pour qu'il
 * retrouve son app comme avant. La demo est strictement independante.
 */
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Beaker, ChevronDown, Check, PartyPopper, RotateCcw } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useDemoMode } from '@/composables/useDemoMode'
import { useDemoMission, DEMO_MISSION_TARGET_ROUTES } from '@/composables/useDemoMission'
import { STORAGE_KEYS } from '@/constants'
import type { User } from '@/types'

// Marqueur "panneau deja vu dans cette session" : on auto-deplie le panneau
// au premier chargement de la demo pour que le visiteur comprenne qu'il y a
// 5 etapes a decouvrir. Une fois marque, on ne re-deplie plus dans la meme
// session (sessionStorage = scope onglet, reset au reload propre du tab).
const FIRST_SEEN_KEY = 'cc_demo_banner_seen'
const AUTO_COLLAPSE_DELAY_MS = 8000     // duree de l'auto-ouverture de bienvenue
const CELEBRATION_DURATION_MS = 6000    // duree de l'effet de celebration a 5/5

const appStore = useAppStore()
const router = useRouter()
const { isDemo } = useDemoMode()
const { actions, completedCount, totalCount, progress, allDone, resetMission } = useDemoMission()

const expanded = ref(false)
function togglePanel() {
  expanded.value = !expanded.value
  // Une interaction explicite annule l'auto-collapse de bienvenue.
  cancelAutoCollapse()
}

// Auto-deploie le panneau a 5/5 pendant 5s pour celebrer.
const showCelebration = ref(false)
let celebrationT: ReturnType<typeof setTimeout> | null = null
watch(allDone, (done, prev) => {
  if (done && !prev && !showCelebration.value) {
    showCelebration.value = true
    expanded.value = true
    if (celebrationT) clearTimeout(celebrationT)
    celebrationT = setTimeout(() => { showCelebration.value = false }, CELEBRATION_DURATION_MS)
  }
})

// Click outside : ferme le panneau si on clique hors de son arbre.
const panelRef = ref<HTMLElement | null>(null)
function onDocClick(e: MouseEvent) {
  if (!expanded.value) return
  const target = e.target as Node
  if (panelRef.value && !panelRef.value.contains(target)) {
    expanded.value = false
    cancelAutoCollapse()
  }
}

// Esc ferme le panneau (a11y : cohere avec les modales / popovers de l'app).
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && expanded.value) {
    expanded.value = false
    cancelAutoCollapse()
  }
}

// Auto-collapse de l'ouverture de bienvenue : on laisse 8s pour lire et
// scanner les 5 etapes, puis on referme si l'utilisateur n'a pas interagi.
let autoCollapseT: ReturnType<typeof setTimeout> | null = null
function cancelAutoCollapse() {
  if (autoCollapseT) { clearTimeout(autoCollapseT); autoCollapseT = null }
}

onMounted(() => {
  document.addEventListener('click', onDocClick)
  document.addEventListener('keydown', onKeydown)

  // Auto-ouverture au 1er mount : resout le cold-start (visiteur qui arrive
  // sur le dashboard et ne sait pas par ou commencer). Skip si l'utilisateur
  // a deja interagi (completedCount > 0) ou deja vu cette session.
  try {
    const seen = sessionStorage.getItem(FIRST_SEEN_KEY)
    if (isDemo.value && completedCount.value === 0 && !seen) {
      // nextTick : laisse le shell parent terminer sa transition de monte.
      void nextTick(() => {
        expanded.value = true
        sessionStorage.setItem(FIRST_SEEN_KEY, '1')
        autoCollapseT = setTimeout(() => {
          // Ne se referme automatiquement que si l'utilisateur n'a pas
          // cliqué dedans entre-temps (cancelAutoCollapse() aura ete appele).
          if (autoCollapseT) expanded.value = false
          autoCollapseT = null
        }, AUTO_COLLAPSE_DELAY_MS)
      })
    }
  } catch { /* sessionStorage indisponible (privacy) : on n'auto-ouvre pas */ }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  document.removeEventListener('keydown', onKeydown)
  if (celebrationT) clearTimeout(celebrationT)
  cancelAutoCollapse()
})

function gotoAction(id: string) {
  const path = DEMO_MISSION_TARGET_ROUTES[id]
  if (path) {
    expanded.value = false
    cancelAutoCollapse()
    router.push(path).catch(() => { /* ignore navigation aborted */ })
  }
}

// Refaire le tour : remet les 5 actions a zero. Utile pour un prof qui veut
// re-montrer la demo a un collegue, ou un visiteur curieux. Ne touche pas a
// la session demo elle-meme (les donnees fictives restent).
function replayTour() {
  resetMission()
  showCelebration.value = false
  expanded.value = false
  cancelAutoCollapse()
}

const hasBackup = computed(() => {
  try { return !!localStorage.getItem(STORAGE_KEYS.SESSION_BACKUP) }
  catch { return false }
})

function endDemoOnServer() {
  try { void window.api.demoEnd?.() } catch { /* ignore */ }
}

function leaveDemo() {
  endDemoOnServer()

  // Si une session reelle a ete backup avant la demo, on la restaure et
  // on retourne sur l'app normale au lieu de logout completement.
  let backup: User | null = null
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SESSION_BACKUP)
    if (raw) backup = JSON.parse(raw) as User
  } catch { /* corrompu : on ignore et on logout */ }

  if (backup && backup.token) {
    // Restore : on logout d'abord (clear cc_session demo) puis on rejoue
    // login avec la session backup. Reload force le reset de tous les
    // stores qui ont charge des donnees demo.
    try { localStorage.removeItem(STORAGE_KEYS.SESSION_BACKUP) } catch { /* */ }
    appStore.logout()
    appStore.login(backup)
    window.api.setToken?.(backup.token)
    // Reload propre pour repartir de zero avec la vraie session.
    window.location.href = '/'
    return
  }

  // Pas de backup : logout simple (visiteur arrivee directement sur /demo).
  appStore.logout()
  window.location.href = '/'
}

function createAccount() {
  endDemoOnServer()
  // Pas de restore ici : l'utilisateur veut explicitement creer un nouveau
  // compte, donc on clean tout.
  try { localStorage.removeItem(STORAGE_KEYS.SESSION_BACKUP) } catch { /* */ }
  appStore.logout()
  window.location.href = 'https://app.cursus.school/'
}
</script>

<template>
  <div v-if="isDemo" class="demo-banner" role="status" aria-live="polite">
    <Beaker :size="14" class="demo-banner-icon" aria-hidden="true" />
    <span class="demo-banner-text">
      <strong>Mode demonstration</strong>
      <span class="demo-banner-sep">&middot;</span>
      <template v-if="hasBackup">Ta vraie session t'attend</template>
      <template v-else>Donnees fictives, reset 24h</template>
    </span>

    <!-- Mission tracker : pill cliquable + panneau deplie -->
    <div ref="panelRef" class="demo-mission" :class="{ 'demo-mission--open': expanded, 'demo-mission--celebrate': showCelebration }">
      <button
        type="button"
        class="demo-mission-pill"
        :class="{ 'demo-mission-pill--done': allDone }"
        :aria-expanded="expanded"
        aria-controls="demo-mission-panel"
        :title="allDone ? 'Tour complet ! Cree un compte pour garder ces donnees.' : 'Suivi des actions a decouvrir'"
        @click="togglePanel"
      >
        <span class="demo-mission-progress" aria-hidden="true">
          <span class="demo-mission-progress-fill" :style="{ width: progress + '%' }"></span>
        </span>
        <span class="demo-mission-count">
          <PartyPopper v-if="allDone" :size="12" aria-hidden="true" />
          <span>{{ completedCount }}/{{ totalCount }}</span>
          <span class="demo-mission-label">decouvertes</span>
        </span>
        <ChevronDown :size="12" :class="{ 'demo-mission-caret--open': expanded }" aria-hidden="true" />
      </button>

      <Transition name="demo-mission-pop">
        <div
          v-if="expanded"
          id="demo-mission-panel"
          class="demo-mission-panel"
          role="dialog"
          aria-label="Mission decouverte"
        >
          <div class="demo-mission-head">
            <span class="demo-mission-title">{{ allDone ? 'Tour complet !' : 'Decouvre Cursus en 5 etapes' }}</span>
            <span class="demo-mission-sub" v-if="!allDone">Clique sur une etape pour y aller. Coche au passage.</span>
            <span class="demo-mission-sub" v-else>Tu as vu l'essentiel. Cree un compte pour garder tes donnees.</span>
          </div>
          <ul class="demo-mission-list">
            <li
              v-for="(a, idx) in actions"
              :key="a.id"
              class="demo-mission-item"
              :class="{ 'demo-mission-item--done': a.done }"
            >
              <button type="button" class="demo-mission-step" @click="gotoAction(a.id)">
                <span class="demo-mission-bullet" aria-hidden="true">
                  <Check v-if="a.done" :size="12" />
                  <span v-else>{{ idx + 1 }}</span>
                </span>
                <span class="demo-mission-step-body">
                  <span class="demo-mission-step-label">{{ a.label }}</span>
                  <span class="demo-mission-step-hint">{{ a.hint }}</span>
                </span>
              </button>
            </li>
          </ul>
          <div class="demo-mission-cta">
            <!-- A 5/5 : CTA principal pour creer un compte. Avant : lien
                 discret pour le visiteur convaincu qui veut sauter la fin
                 du tour sans avoir a passer par "Quitter" -> login. -->
            <button
              v-if="allDone"
              type="button"
              class="demo-mission-create"
              @click="createAccount"
            >
              Creer un compte gratuit
            </button>
            <button
              v-else
              type="button"
              class="demo-mission-soft-cta"
              @click="createAccount"
            >
              Sauvegarder en creant un compte
            </button>
            <button
              v-if="allDone"
              type="button"
              class="demo-mission-replay"
              :title="'Reinitialiser les 5 etapes pour refaire le tour'"
              @click="replayTour"
            >
              <RotateCcw :size="11" aria-hidden="true" />
              <span>Refaire le tour</span>
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <button
      type="button"
      class="demo-banner-leave"
      :title="hasBackup ? 'Revenir a ma session' : 'Quitter la demo'"
      @click="leaveDemo"
    >
      {{ hasBackup ? 'Revenir a mon app' : 'Quitter la demo' }}
    </button>
  </div>
</template>

<style scoped>
.demo-banner {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  height: 32px;
  padding: 0 var(--space-md);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--accent) 18%, var(--bg-elevated)) 0%,
    color-mix(in srgb, var(--accent) 12%, var(--bg-elevated)) 100%
  );
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
  z-index: 90;
}

.demo-banner-icon { color: var(--accent); flex-shrink: 0; }

.demo-banner-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-secondary);
}
.demo-banner-text strong {
  color: var(--text-primary);
  font-weight: 700;
}

.demo-banner-sep { margin: 0 6px; color: var(--text-muted); }

/* ── Mission tracker (pill cliquable + dropdown) ────────────────────── */
.demo-mission {
  position: relative;
  flex-shrink: 0;
  margin-left: auto;
}
.demo-mission-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 6px;
  background: var(--bg-elevated);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  border-radius: 999px;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color var(--motion-fast) var(--ease-out),
              background var(--motion-fast) var(--ease-out);
  position: relative;
}
.demo-mission-pill:hover { border-color: var(--accent); }
.demo-mission-pill:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.demo-mission-pill--done {
  background: color-mix(in srgb, var(--accent) 14%, var(--bg-elevated));
  border-color: var(--accent);
}

.demo-mission-progress {
  width: 32px;
  height: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  overflow: hidden;
  flex-shrink: 0;
}
.demo-mission-progress-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 60%, white));
  transition: width 400ms var(--ease-spring);
  border-radius: inherit;
}
.demo-mission-count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-mono);
  letter-spacing: 0.2px;
}
.demo-mission-label {
  font-family: inherit;
  font-weight: 500;
  color: var(--text-secondary);
}
@media (max-width: 640px) {
  .demo-mission-label { display: none; }
}
.demo-mission-caret--open { transform: rotate(180deg); }

/* Pulse subtil tant que pas a 5/5 — attire l'oeil sans agresser */
.demo-mission:not(.demo-mission--open) .demo-mission-pill:not(.demo-mission-pill--done)::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  border: 2px solid color-mix(in srgb, var(--accent) 35%, transparent);
  opacity: 0;
  animation: demoMissionHalo 3.2s ease-in-out infinite;
  pointer-events: none;
}
@keyframes demoMissionHalo {
  0%, 100% { opacity: 0; transform: scale(1); }
  50%      { opacity: 1; transform: scale(1.06); }
}
@media (prefers-reduced-motion: reduce) {
  .demo-mission-pill::after { animation: none !important; }
  .demo-mission-progress-fill { transition: none; }
}

/* Celebration : confetti CSS-only via shadow rings */
.demo-mission--celebrate .demo-mission-pill {
  animation: demoMissionWiggle 700ms var(--ease-spring) 1;
}
@keyframes demoMissionWiggle {
  0%   { transform: scale(1) rotate(0); }
  25%  { transform: scale(1.08) rotate(-2deg); }
  50%  { transform: scale(1.1)  rotate(2deg); }
  75%  { transform: scale(1.06) rotate(-1deg); }
  100% { transform: scale(1)    rotate(0); }
}

/* ── Panneau deplie (au-dessous de la pill, ancre a droite) ─────────── */
.demo-mission-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 340px;
  /* Sur tres petit ecran, on rogne pour ne pas deborder du viewport. */
  max-width: calc(100vw - 16px);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--elevation-3);
  z-index: 200;
  overflow: hidden;
}
.demo-mission-pop-enter-active,
.demo-mission-pop-leave-active {
  transition: opacity 200ms var(--ease-out),
              transform 200ms var(--ease-spring);
}
.demo-mission-pop-enter-from,
.demo-mission-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}

.demo-mission-head {
  padding: 12px 14px 8px;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--accent) 4%, var(--bg-elevated));
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.demo-mission-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.2px;
}
.demo-mission-sub {
  font-size: 11.5px;
  color: var(--text-secondary);
  font-weight: 500;
  line-height: 1.4;
}

.demo-mission-list {
  list-style: none;
  margin: 0;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.demo-mission-step {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: var(--text-primary);
  transition: background var(--motion-fast) var(--ease-out);
}
.demo-mission-step:hover { background: color-mix(in srgb, var(--accent) 6%, transparent); }
.demo-mission-step:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.demo-mission-bullet {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--accent) 25%, var(--border));
  background: var(--bg-main);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  transition: background var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out);
}
.demo-mission-item--done .demo-mission-bullet {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.demo-mission-item--done .demo-mission-step-label {
  color: var(--text-secondary);
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--text-secondary) 40%, transparent);
}
.demo-mission-step-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.demo-mission-step-label {
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: -0.1px;
}
.demo-mission-step-hint {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.35;
  font-weight: 500;
}

.demo-mission-cta {
  padding: 10px 12px 12px;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--accent) 6%, var(--bg-elevated));
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.demo-mission-create {
  width: 100%;
  padding: 9px 14px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: filter var(--motion-fast) var(--ease-out);
}
.demo-mission-create:hover { filter: brightness(1.08); }
.demo-mission-create:focus-visible { outline: none; box-shadow: var(--focus-ring); }

/* CTA discret avant 5/5 : permet au visiteur convaincu d'avancer vers la
   creation de compte sans attendre la fin du tour. Style "lien" plutot que
   bouton plein pour ne pas couper la phase de decouverte. */
.demo-mission-soft-cta {
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
  border-radius: var(--radius-sm);
  color: var(--accent);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--motion-fast) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out),
    color var(--motion-fast) var(--ease-out);
}
.demo-mission-soft-cta:hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border-color: var(--accent);
  color: var(--text-primary);
}
.demo-mission-soft-cta:focus-visible { outline: none; box-shadow: var(--focus-ring); }

/* Lien secondaire "Refaire le tour" : reset les 5 actions a zero. Discret
   pour ne pas concurrencer la CTA de creation de compte. */
.demo-mission-replay {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 10px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-xs);
  transition: color var(--motion-fast) var(--ease-out), background var(--motion-fast) var(--ease-out);
}
.demo-mission-replay:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}
.demo-mission-replay:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.demo-banner-leave {
  flex-shrink: 0;
  padding: 4px 12px;
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out), color var(--motion-fast) var(--ease-out), border-color var(--motion-fast) var(--ease-out);
}
.demo-banner-leave:hover {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--text-primary);
  border-color: var(--accent);
}
.demo-banner-leave:focus-visible { outline: none; box-shadow: var(--focus-ring); }

@media (max-width: 640px) {
  .demo-banner-sep { display: none; }
  .demo-banner-text { font-size: 11px; }
}
</style>
