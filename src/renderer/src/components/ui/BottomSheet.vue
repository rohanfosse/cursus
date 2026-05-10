<script setup lang="ts">
/*
 * BottomSheet - primitive plein largeur "sheet" qui glisse depuis le bas.
 *
 * Pattern iOS/Android natif. Gere :
 *  - Slide-in (translateY 100% -> 0) via Transition
 *  - Backdrop semi-transparent + blur (tap = fermeture)
 *  - Swipe-down sur la sheet (threshold 80px) = fermeture
 *  - Escape = fermeture
 *  - Focus trap : Tab / Shift+Tab cyclent dans la sheet ; le focus initial
 *    revient au bouton de fermeture, le focus precedent est restaure a la
 *    fermeture
 *  - Body scroll lock pendant l'ouverture (avec save/restore pour ne pas
 *    clobber un overflow:hidden defini par une autre modale)
 *  - Force-close au changement de route (evite scroll-lock orphelin)
 *  - Teleport to body pour echapper aux z-index parents
 *
 * Slots :
 *  - header : titre + actions custom. Defaut : utilise `title`.
 *  - default : contenu principal de la sheet.
 *
 * Premier consommateur : MobileAppsSheet. Pensee aussi pour la future
 * sheet de filtres mobile sur Devoirs/Documents.
 */
import { onUnmounted, ref, toRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { X } from 'lucide-vue-next'
import { useFocusTrap } from '@/composables/useFocusTrap'

const props = defineProps<{
  open: boolean
  /** Titre affiche dans le header par defaut. Ignore si slot `header`. */
  title?: string
  /** Label aria-label de la sheet (par defaut : title). */
  ariaLabel?: string
}>()

const emit = defineEmits<{ close: [] }>()

const route = useRoute()
const sheetEl = ref<HTMLElement | null>(null)
useFocusTrap(sheetEl, toRef(props, 'open'))

// Sauvegarde la valeur initiale de body.overflow pour la restaurer
// proprement apres fermeture (evite de clobber un overflow:hidden defini
// par une autre modale ou par l'app shell).
let bodyOverflowSnapshot: string | null = null

function lockBodyScroll(): void {
  if (bodyOverflowSnapshot === null) {
    bodyOverflowSnapshot = document.body.style.overflow
  }
  document.body.style.overflow = 'hidden'
}
function unlockBodyScroll(): void {
  if (bodyOverflowSnapshot !== null) {
    document.body.style.overflow = bodyOverflowSnapshot
    bodyOverflowSnapshot = null
  }
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

watch(() => props.open, (open) => {
  if (open) {
    document.addEventListener('keydown', onKeydown)
    lockBodyScroll()
  } else {
    document.removeEventListener('keydown', onKeydown)
    unlockBodyScroll()
  }
})

watch(() => route.fullPath, () => {
  if (props.open) emit('close')
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  unlockBodyScroll()
})

// Swipe-to-dismiss : threshold simple 80px. Pas de drag reel (overhead).
let touchStartY: number | null = null

function onTouchStart(e: TouchEvent): void {
  touchStartY = e.touches[0]?.clientY ?? null
}

function onTouchEnd(e: TouchEvent): void {
  if (touchStartY === null) return
  const endY = e.changedTouches[0]?.clientY ?? touchStartY
  const dy = endY - touchStartY
  touchStartY = null
  if (dy > 80) emit('close')
}

function handleClose(): void {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet-fade">
      <div
        v-if="open"
        class="bottom-sheet-backdrop"
        role="presentation"
        @click="handleClose"
      />
    </Transition>

    <Transition name="sheet-slide">
      <div
        v-if="open"
        ref="sheetEl"
        class="bottom-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="ariaLabel ?? title ?? 'Panneau'"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <div class="bottom-sheet-handle" aria-hidden="true" />

        <header v-if="title || $slots.header" class="bottom-sheet-header">
          <slot name="header">
            <h2 class="bottom-sheet-title">{{ title }}</h2>
            <button
              type="button"
              class="bottom-sheet-close"
              aria-label="Fermer"
              @click="handleClose"
            >
              <X :size="22" />
            </button>
          </slot>
        </header>

        <div class="bottom-sheet-body">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.bottom-sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, .55);
  backdrop-filter: blur(2px);
  z-index: var(--z-overlay, 9000);
}

.bottom-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: calc(var(--z-overlay, 9000) + 1);
  background: var(--bg-elevated);
  border-top: 1px solid var(--border);
  border-radius: 18px 18px 0 0;
  padding: 8px 16px calc(20px + env(safe-area-inset-bottom, 0));
  box-shadow: 0 -12px 40px rgba(0, 0, 0, .35);
  max-height: 80vh;
  overflow-y: auto;
}

.bottom-sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--text-muted);
  opacity: .35;
  margin: 0 auto 12px;
}

.bottom-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 0 4px;
}

.bottom-sheet-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -.2px;
}

.bottom-sheet-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  transition: background var(--t-fast), color var(--t-fast);
}
.bottom-sheet-close:hover,
.bottom-sheet-close:active {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.bottom-sheet-close:focus-visible {
  outline: var(--focus-ring);
  outline-offset: 2px;
}

.bottom-sheet-body {
  display: block;
}

.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: opacity var(--t-base) ease;
}
.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}

.sheet-slide-enter-active {
  transition: transform var(--t-slow) cubic-bezier(.32, .72, 0, 1);
}
.sheet-slide-leave-active {
  transition: transform var(--t-base) cubic-bezier(.4, 0, 1, 1);
}
.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .sheet-slide-enter-active,
  .sheet-slide-leave-active {
    transition: none !important;
  }
}
</style>
