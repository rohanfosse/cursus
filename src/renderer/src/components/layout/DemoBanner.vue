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
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Beaker, ChevronDown, Check, PartyPopper } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useDemoMode } from '@/composables/useDemoMode'
import { useDemoMission } from '@/composables/useDemoMission'
import { STORAGE_KEYS } from '@/constants'
import type { User } from '@/types'

const appStore = useAppStore()
const router = useRouter()
const { isDemo } = useDemoMode()
const { actions, completedCount, totalCount, progress, allDone } = useDemoMission()

// Panneau deplie : ferme par defaut, on respecte la pref "ne plus afficher"
// pour les visiteurs qui ont deja fait le tour (>= 5/5 lifetime).
const expanded = ref(false)
function togglePanel() { expanded.value = !expanded.value }

// Auto-deploie le panneau a 5/5 pendant 5s pour celebrer + invite a creer
// un compte. Puis se referme.
const showCelebration = ref(false)
let celebrationT: ReturnType<typeof setTimeout> | null = null
watch(allDone, (done, prev) => {
  if (done && !prev && !showCelebration.value) {
    showCelebration.value = true
    expanded.value = true
    if (celebrationT) clearTimeout(celebrationT)
    celebrationT = setTimeout(() => { showCelebration.value = false }, 6000)
  }
})

// Click outside : ferme le panneau si on clique hors de son arbre.
const panelRef = ref<HTMLElement | null>(null)
function onDocClick(e: MouseEvent) {
  if (!expanded.value) return
  const target = e.target as Node
  if (panelRef.value && !panelRef.value.contains(target)) expanded.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick)
  if (celebrationT) clearTimeout(celebrationT)
})

// Action "Aller a..." : route mappee depuis l'id de l'action. Reutilise
// les memes paths que useDemoMission.ACTIONS_CATALOG.routeMatcher.
const ACTION_ROUTES: Record<string, string> = {
  dashboard:        '/dashboard',
  messages:         '/messages',
  lumen:            '/lumen',
  devoirs:          '/devoirs',
  live_or_booking:  '/live',
}
function gotoAction(id: string) {
  const path = ACTION_ROUTES[id]
  if (path) {
    expanded.value = false
    router.push(path).catch(() => { /* ignore navigation aborted */ })
  }
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
          <div v-if="allDone" class="demo-mission-cta">
            <button type="button" class="demo-mission-create" @click="createAccount">
              Creer un compte gratuit
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <button
      v-if="!hasBackup"
      type="button"
      class="demo-banner-cta"
      @click="createAccount"
    >
      Creer un compte
    </button>
    <button
      type="button"
      class="demo-banner-leave"
      :title="hasBackup ? 'Revenir a ma session' : 'Quitter la demo'"
      @click="leaveDemo"
    >
      {{ hasBackup ? 'Revenir a mon app' : 'Quitter' }}
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

.demo-banner-cta {
  flex-shrink: 0;
  padding: 4px 12px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: filter var(--motion-fast) var(--ease-out);
}
.demo-banner-cta:hover { filter: brightness(1.08); }
.demo-banner-cta:focus-visible { outline: none; box-shadow: var(--focus-ring); }

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
