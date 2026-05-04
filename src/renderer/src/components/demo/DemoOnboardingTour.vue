<!--
  DemoOnboardingTour.vue
  Mini-tour de 5 etapes affiche au demarrage d'une session demo.
  Trouve la cible via document.querySelector('[data-tour="<id>"]') et
  positionne la bulle a cote, avec un ring de spotlight sur la cible.
  Cliquer "Passer" ou la touche Echap ferme le tour.
-->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { X, ChevronRight, ChevronLeft } from 'lucide-vue-next'
import { useDemoOnboarding } from '@/composables/useDemoOnboarding'

const tour = useDemoOnboarding()

interface TargetRect {
  top: number; left: number; width: number; height: number
}

const targetRect = ref<TargetRect | null>(null)
const bubbleStyle = ref<Record<string, string>>({})
const RECOMPUTE_INTERVAL_MS = 500
let recomputeTimer: ReturnType<typeof setInterval> | null = null

function updateRect() {
  const step = tour.currentStep.value
  if (!step || !step.target) {
    targetRect.value = null
    bubbleStyle.value = computeCenteredStyle()
    return
  }
  const el = document.querySelector(`[data-tour="${step.target}"]`)
  if (!el) {
    targetRect.value = null
    bubbleStyle.value = computeCenteredStyle()
    return
  }
  const r = el.getBoundingClientRect()
  targetRect.value = { top: r.top, left: r.left, width: r.width, height: r.height }
  bubbleStyle.value = computeBubbleStyle(r, step.placement ?? 'auto')
}

function computeCenteredStyle(): Record<string, string> {
  return {
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  }
}

function computeBubbleStyle(rect: DOMRect, placement: string): Record<string, string> {
  const margin = 16
  const bubbleW = 320
  const bubbleH = 180 // approx, suffisant pour clamp
  const vw = window.innerWidth
  const vh = window.innerHeight

  const tries = placement === 'auto'
    ? ['right', 'bottom', 'top', 'left']
    : [placement, 'right', 'bottom', 'top', 'left']

  for (const p of tries) {
    if (p === 'right' && rect.right + margin + bubbleW < vw) {
      return {
        top: `${Math.max(margin, Math.min(rect.top, vh - bubbleH - margin))}px`,
        left: `${rect.right + margin}px`,
      }
    }
    if (p === 'left' && rect.left - margin - bubbleW > 0) {
      return {
        top: `${Math.max(margin, Math.min(rect.top, vh - bubbleH - margin))}px`,
        left: `${rect.left - margin - bubbleW}px`,
      }
    }
    if (p === 'bottom' && rect.bottom + margin + bubbleH < vh) {
      return {
        top: `${rect.bottom + margin}px`,
        left: `${Math.max(margin, Math.min(rect.left, vw - bubbleW - margin))}px`,
      }
    }
    if (p === 'top' && rect.top - margin - bubbleH > 0) {
      return {
        top: `${rect.top - margin - bubbleH}px`,
        left: `${Math.max(margin, Math.min(rect.left, vw - bubbleW - margin))}px`,
      }
    }
  }
  // Fallback : centre ecran
  return computeCenteredStyle()
}

const ringStyle = computed(() => {
  if (!targetRect.value) return { display: 'none' } as Record<string, string>
  const padding = 6
  return {
    display: 'block',
    top: `${targetRect.value.top - padding}px`,
    left: `${targetRect.value.left - padding}px`,
    width: `${targetRect.value.width + padding * 2}px`,
    height: `${targetRect.value.height + padding * 2}px`,
  } as Record<string, string>
})

function onKeydown(e: KeyboardEvent) {
  if (!tour.visible.value) return
  if (e.key === 'Escape') {
    tour.finish()
    e.preventDefault()
  } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
    tour.next()
    e.preventDefault()
  } else if (e.key === 'ArrowLeft') {
    tour.prev()
    e.preventDefault()
  }
}

watch(
  () => tour.currentStep.value,
  () => { void nextTick(updateRect) },
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', updateRect)
  recomputeTimer = setInterval(updateRect, RECOMPUTE_INTERVAL_MS)
  updateRect()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', updateRect)
  if (recomputeTimer) clearInterval(recomputeTimer)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="tour.visible.value" class="onb-root" role="dialog" aria-labelledby="onb-title">
      <!-- Backdrop dim sur tout l'ecran -->
      <div class="onb-backdrop" @click="tour.finish()"></div>

      <!-- Spotlight ring autour de la cible (si target) -->
      <div v-if="targetRect" class="onb-ring" :style="ringStyle" aria-hidden="true"></div>

      <!-- Bulle d'info positionnee pres de la cible -->
      <div class="onb-bubble" :style="bubbleStyle">
        <button class="onb-close" :aria-label="'Fermer le tour'" @click="tour.finish()">
          <X :size="14" />
        </button>
        <div class="onb-step-counter">{{ tour.stepIndex.value + 1 }} / {{ tour.totalSteps }}</div>
        <h3 id="onb-title" class="onb-title">{{ tour.currentStep.value?.title }}</h3>
        <p class="onb-body">{{ tour.currentStep.value?.body }}</p>
        <div class="onb-actions">
          <button v-if="!tour.isFirstStep.value" class="onb-btn onb-btn-ghost" type="button" @click="tour.prev()">
            <ChevronLeft :size="14" />
            Precedent
          </button>
          <button class="onb-btn onb-btn-ghost" type="button" @click="tour.finish()">Passer</button>
          <button class="onb-btn onb-btn-primary" type="button" @click="tour.next()">
            {{ tour.isLastStep.value ? 'Terminer' : 'Suivant' }}
            <ChevronRight v-if="!tour.isLastStep.value" :size="14" />
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.onb-root {
  position: fixed;
  inset: 0;
  z-index: 10000;
  pointer-events: none;
}
.onb-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(2px);
  pointer-events: auto;
  animation: onbFadeIn 240ms ease-out;
}
.onb-ring {
  position: absolute;
  border-radius: var(--radius);
  box-shadow:
    0 0 0 3px var(--accent-color, #6366F1),
    0 0 0 9999px rgba(15, 23, 42, 0.55);
  pointer-events: none;
  transition: all 240ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.onb-bubble {
  position: absolute;
  width: 320px;
  max-width: calc(100vw - 32px);
  padding: 18px 18px 14px;
  background: var(--bg-elevated, #1f2937);
  color: var(--text-primary, #f8fafc);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color, #334155);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  pointer-events: auto;
  animation: onbBubbleIn 320ms cubic-bezier(0.16, 1, 0.3, 1);
}
.onb-close {
  position: absolute;
  top: 8px; right: 8px;
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px;
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--text-muted, #94a3b8);
  cursor: pointer;
  transition: background 120ms;
}
.onb-close:hover { background: rgba(255, 255, 255, 0.08); }
.onb-step-counter {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent-color, #6366F1);
  font-weight: 600;
  margin-bottom: 6px;
}
.onb-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 6px;
}
.onb-body {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary, #cbd5e1);
  margin: 0 0 14px;
}
.onb-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
}
.onb-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 120ms, transform 120ms;
  border: 1px solid transparent;
}
.onb-btn-ghost {
  background: transparent;
  color: var(--text-muted, #94a3b8);
}
.onb-btn-ghost:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary, #f8fafc);
}
.onb-btn-primary {
  background: var(--cta, #059669);
  color: white;
}
.onb-btn-primary:hover {
  transform: translateY(-1px);
  background: var(--cta-hover, #047857);
}

@keyframes onbFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes onbBubbleIn {
  from { opacity: 0; transform: translateY(8px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .onb-backdrop, .onb-bubble, .onb-ring { animation: none !important; transition: none !important; }
}
</style>
