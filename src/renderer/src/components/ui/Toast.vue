<script setup lang="ts">
  /**
   * Toast — refonte v2.300 alignee sur le design system landing :
   *   - surface --bg-elevated + ombre --elevation-3 (tintee indigo)
   *   - barre d'accent gauche 3px par type (success/error/info), echo
   *     des NavRail sectorielles tintees
   *   - icone dans cercle 28x28 plein-couleur (#fff sur fond --color-X)
   *     pour une lecture immediate du type
   *   - titre 13.5/700 en --text-primary, detail 12/400 en --text-secondary
   *     (vs. tout en couleur tintee avant — illisible a long messages)
   *   - radius --radius-lg (20px) au lieu de --radius (12px)
   *   - progress bar bottom 2px tintee par type
   *   - hover-pause : le countdown s'arrete sous la souris pour permettre
   *     de lire les messages d'erreur enrichis (v2.299 reportError)
   */
  import { onBeforeUnmount, ref } from 'vue'
  import { toastState, toastQueue, useToast, type ToastEntry } from '@/composables/useToast'
  import { AlertTriangle, CheckCircle, Info, X } from 'lucide-vue-next'

  const { dismissToast, removeToast } = useToast()

  // Hover-pause : on remplace le timer par un re-arming a la sortie du hover.
  // Stocke le timer restant pour chaque toast survole.
  const pausedTimers = ref<Map<string, { remaining: number; pausedAt: number }>>(new Map())
  const ITEM_DURATION_DEFAULT = 4000
  const ITEM_DURATION_ERROR = 8000

  function durationFor(type: ToastEntry['type']): number {
    return type === 'error' ? ITEM_DURATION_ERROR : ITEM_DURATION_DEFAULT
  }

  function onMouseEnter(entry: ToastEntry) {
    if (!entry.timer) return
    clearTimeout(entry.timer)
    entry.timer = undefined
    // Approxime le restant : impossible de lire le delay residuel d'un
    // setTimeout — on suppose que l'utilisateur a survole avant la fin
    // (le compteur reprendra avec ce qu'il reste affichable, jamais < 1.5s
    // pour qu'il reste le temps de lire apres un mouseleave fugace).
    const elapsed = Date.now() - entry._startedAt
    const total = durationFor(entry.type)
    const remaining = Math.max(1500, total - elapsed)
    pausedTimers.value.set(entry.id, { remaining, pausedAt: Date.now() })
  }

  function onMouseLeave(entry: ToastEntry) {
    const paused = pausedTimers.value.get(entry.id)
    if (!paused) return
    pausedTimers.value.delete(entry.id)
    entry.timer = setTimeout(() => removeToast(entry.id), paused.remaining)
  }

  onBeforeUnmount(() => {
    pausedTimers.value.clear()
  })
</script>

<template>
  <Teleport to="body">
    <!-- Legacy single toast (backward compat avec showUndoToast) -->
    <Transition name="toast">
      <div
        v-if="toastState.visible && toastQueue.length === 0"
        :id="'app-toast'"
        :class="[`toast-${toastState.type}`, { 'toast-has-detail': toastState.detail }]"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span class="toast-icon-wrap" aria-hidden="true">
          <AlertTriangle v-if="toastState.type === 'error'" :size="14" />
          <CheckCircle v-else-if="toastState.type === 'success'" :size="14" />
          <Info v-else :size="14" />
        </span>

        <div class="toast-content">
          <span class="toast-msg">{{ toastState.message }}</span>
          <span v-if="toastState.detail" class="toast-detail">{{ toastState.detail }}</span>
        </div>

        <button
          v-if="toastState.type === 'undo' && toastState.onUndo"
          class="toast-undo-btn"
          @click="toastState.onUndo?.()"
        >
          Annuler
        </button>

        <button class="toast-close-btn" title="Fermer" @click="dismissToast">
          <X :size="14" />
        </button>

        <span class="toast-progress" :class="{ 'toast-progress--slow': toastState.type === 'error' }" />
      </div>
    </Transition>

    <!-- Stacked toast queue -->
    <TransitionGroup name="toast-stack" tag="div" class="toast-stack">
      <div
        v-for="entry in toastQueue"
        :key="entry.id"
        class="toast-stack-item"
        :class="[`toast-${entry.type}`, { 'toast-paused': pausedTimers.has(entry.id) }]"
        role="status"
        aria-live="polite"
        @mouseenter="onMouseEnter(entry)"
        @mouseleave="onMouseLeave(entry)"
      >
        <span class="toast-icon-wrap" aria-hidden="true">
          <AlertTriangle v-if="entry.type === 'error'" :size="14" />
          <CheckCircle v-else-if="entry.type === 'success'" :size="14" />
          <Info v-else :size="14" />
        </span>

        <div class="toast-content">
          <span class="toast-msg">{{ entry.message }}</span>
          <span v-if="entry.detail" class="toast-detail">{{ entry.detail }}</span>
        </div>

        <button class="toast-close-btn" title="Fermer" @click="removeToast(entry.id)">
          <X :size="14" />
        </button>

        <span
          class="toast-progress"
          :class="{ 'toast-progress--slow': entry.type === 'error' }"
        />
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<style scoped>
  /* ─── Surface commune ────────────────────────────────────────────── */
  #app-toast,
  .toast-stack-item {
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px 12px 16px;
    border-radius: var(--radius-lg);
    background: var(--bg-elevated);
    color: var(--text-primary);
    border: 1px solid var(--border);
    box-shadow: var(--elevation-3);
    font-family: var(--font, sans-serif);
    max-width: 440px;
    min-width: 300px;
  }

  /* Barre d'accent gauche tintee par type — echo des NavRail sectorielles */
  #app-toast::before,
  .toast-stack-item::before {
    content: '';
    position: absolute;
    top: 8px;
    bottom: 8px;
    left: 0;
    width: 3px;
    border-radius: 0 2px 2px 0;
    background: var(--toast-accent, var(--accent));
  }

  #app-toast {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 10000;
  }

  .toast-stack {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    gap: 10px;
    pointer-events: none;
  }
  .toast-stack-item { pointer-events: auto; }

  /* ─── Icon wrap : cercle plein-couleur ──────────────────────────── */
  .toast-icon-wrap {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--toast-accent, var(--accent));
    color: #fff;
    margin-top: 1px;
  }

  /* ─── Content typo ──────────────────────────────────────────────── */
  .toast-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-top: 2px;
  }
  .toast-msg {
    font-size: 13.5px;
    font-weight: 700;
    line-height: 1.4;
    color: var(--text-primary);
    /* Allow wrap mais cap a 3 lignes pour eviter qu'une stack trace serveur
       ne fasse exploser le toast. L'utilisateur clique l'icone "logs" pour
       le detail complet (cf. main.log). */
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .toast-detail {
    font-size: 12px;
    font-weight: 400;
    line-height: 1.4;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ─── Type variants : seul --toast-accent change ────────────────── */
  .toast-success { --toast-accent: var(--color-success); }
  .toast-error   { --toast-accent: var(--color-danger);  }
  .toast-info    { --toast-accent: var(--accent);        }
  .toast-undo    { --toast-accent: var(--accent);        }

  /* ─── Boutons ───────────────────────────────────────────────────── */
  .toast-undo-btn {
    flex-shrink: 0;
    align-self: center;
    padding: 5px 11px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--bg-canvas);
    color: var(--text-primary);
    font: 600 12px var(--font, sans-serif);
    cursor: pointer;
    transition: background .12s, border-color .12s;
  }
  .toast-undo-btn:hover {
    background: var(--bg-hover);
    border-color: var(--toast-accent, var(--accent));
  }

  .toast-close-btn {
    flex-shrink: 0;
    align-self: flex-start;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    margin: -2px -2px 0 0;
    border-radius: var(--radius-xs);
    display: flex;
    align-items: center;
    transition: background .12s, color .12s;
  }
  .toast-close-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  /* ─── Progress bar : tintee par type ────────────────────────────── */
  .toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background: var(--toast-accent, var(--accent));
    opacity: .8;
    border-radius: 0 2px 0 0;
    animation: toast-timer 4s linear forwards;
    transform-origin: left center;
  }
  .toast-progress--slow { animation-duration: 8s; }

  /* Hover-pause : freeze la progress bar */
  .toast-paused .toast-progress { animation-play-state: paused; }

  @keyframes toast-timer {
    from { width: 100%; }
    to   { width: 0%;   }
  }

  /* ─── Animations entree/sortie ──────────────────────────────────── */
  .toast-enter-active,
  .toast-stack-enter-active {
    transition:
      opacity .25s var(--ease-out, cubic-bezier(.34,1.56,.64,1)),
      transform .25s var(--ease-spring, cubic-bezier(.34,1.56,.64,1));
  }
  .toast-leave-active,
  .toast-stack-leave-active {
    transition:
      opacity .18s var(--ease-in, ease-in),
      transform .18s var(--ease-in, ease-in);
  }
  .toast-enter-from,
  .toast-stack-enter-from {
    opacity: 0;
    transform: translateX(40px) scale(.95);
  }
  .toast-leave-to,
  .toast-stack-leave-to {
    opacity: 0;
    transform: translateX(20px) scale(.95);
  }
  .toast-stack-move { transition: transform .3s var(--ease-out, ease-out); }

  /* ─── Reduced motion ────────────────────────────────────────────── */
  @media (prefers-reduced-motion: reduce) {
    .toast-progress { animation: none; width: 100%; }
    .toast-enter-active, .toast-leave-active,
    .toast-stack-enter-active, .toast-stack-leave-active,
    .toast-stack-move { transition: opacity .15s ease; transform: none !important; }
  }

  /* ─── Compact sur petits ecrans ─────────────────────────────────── */
  @media (max-width: 480px) {
    #app-toast,
    .toast-stack-item { max-width: calc(100vw - 32px); min-width: 0; }
  }
</style>
