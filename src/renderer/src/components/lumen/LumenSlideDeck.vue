<script setup lang="ts">
/**
 * Rendu d'un chapitre Marp dans Lumen.
 *
 * Le declencheur est la frontmatter `marp: true`. Le contenu est passe par
 * le viewer parent (LumenChapterViewer) qui detecte le mode via
 * parseChapterContent. On utilise @marp-team/marp-core (browser-safe, ~50KB)
 * pour transformer le markdown en HTML + CSS de presentation.
 *
 * Navigation :
 *  - boutons prev / next
 *  - fleches gauche/droite (capturees au focus du conteneur)
 *  - indicateur N / Total
 *  - mode plein-ecran (Fullscreen API native)
 *
 * Cf. design-system/cursus/MASTER.md §7-8 : on utilise les tokens motion
 * et le focus-ring partage.
 */
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { Marp } from '@marp-team/marp-core'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, AlertTriangle } from 'lucide-vue-next'
import DOMPurify from 'dompurify'
import { MARP_CURSUS_THEME } from '@/utils/marpCursusTheme'

interface Props {
  /** Markdown brut (frontmatter incluse — Marp la consomme nativement) */
  source: string
  title?: string
}

const props = defineProps<Props>()

const containerRef = ref<HTMLElement | null>(null)
const slideHostRef = ref<HTMLElement | null>(null)
const currentIndex = ref(0)
const renderError = ref<string | null>(null)
const isFullscreen = ref(false)

interface RenderedDeck {
  slides: string[]   // tableau de HTML par slide
  css: string        // CSS global Marp + theme
  count: number
}

const rendered = ref<RenderedDeck>({ slides: [], css: '', count: 0 })

/**
 * Compile le markdown Marp en sections HTML individuelles.
 * Marp emet un seul HTML avec toutes les <section class="..."> consecutives.
 * On les decoupe pour pouvoir naviguer slide par slide.
 */
function renderDeck(): void {
  renderError.value = null
  if (!props.source) {
    rendered.value = { slides: [], css: '', count: 0 }
    return
  }
  try {
    const marp = new Marp({
      // html:true necessaire pour les templates qui utilisent <div class="columns">
      // ou autres elements HTML inline. Le contenu vient d'un repo GitHub
      // controle par le prof (write-access requis), DOMPurify reste comme
      // 2e couche de defense.
      html: true,
      math: 'katex',
      inlineSVG: true,
    })
    // Theme custom Cursus enregistre comme alternative opt-in : l'auteur peut
    // l'activer via `theme: cursus` dans sa frontmatter. Avec `theme: default`
    // (cas standard), Marp utilise le theme default Marpit et le `style: |`
    // de l'auteur prime.
    marp.themeSet.add(MARP_CURSUS_THEME)
    const { html, css } = marp.render(props.source)
    // Marp emet <section ...>...</section> ; on les separe.
    // On utilise un parser DOM plutot qu'une regex pour gerer les sections
    // imbriquees (ex. notes ou advanced fenced sections).
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const sections = Array.from(doc.querySelectorAll('section'))
    const slides = sections.map((s) => DOMPurify.sanitize(s.outerHTML, {
      // 'style' indispensable : Marpit injecte le `style: |` de la frontmatter
      // comme <style scoped> dans chaque <section>. Sans ce ADD_TAGS, tout
      // le theme inline de l'auteur est strippe silencieusement.
      ADD_TAGS: [
        'section', 'style',
        'foreignObject', 'svg', 'g', 'path', 'rect', 'text',
        'circle', 'line', 'polygon', 'polyline',
      ],
      // 'class' indispensable pour les directives Marpit `<!-- _class: title -->`
      // et les classes utilitaires du theme auteur (.columns, .lead, etc.).
      ADD_ATTR: [
        'xmlns', 'viewBox', 'preserveAspectRatio',
        'data-marpit-pagination', 'data-marpit-fragment',
        'class',
      ],
    }))
    rendered.value = { slides, css, count: slides.length }
    if (currentIndex.value >= slides.length) currentIndex.value = 0
  } catch (err) {
    renderError.value = (err as Error).message ?? 'Erreur de rendu Marp'
    rendered.value = { slides: [], css: '', count: 0 }
  }
}

const currentSlideHtml = computed(() => rendered.value.slides[currentIndex.value] ?? '')
const totalSlides = computed(() => rendered.value.count)
const hasPrev = computed(() => currentIndex.value > 0)
const hasNext = computed(() => currentIndex.value < totalSlides.value - 1)

function goPrev(): void {
  if (hasPrev.value) currentIndex.value -= 1
}
function goNext(): void {
  if (hasNext.value) currentIndex.value += 1
}
function goTo(index: number): void {
  if (index >= 0 && index < totalSlides.value) currentIndex.value = index
}

function onKeydown(ev: KeyboardEvent): void {
  // On ne capte que si le focus est sur le conteneur ou en plein-ecran
  if (!isFullscreen.value && document.activeElement !== containerRef.value) return
  if (ev.key === 'ArrowRight' || ev.key === 'PageDown' || ev.key === ' ') {
    ev.preventDefault()
    goNext()
  } else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') {
    ev.preventDefault()
    goPrev()
  } else if (ev.key === 'Home') {
    ev.preventDefault()
    goTo(0)
  } else if (ev.key === 'End') {
    ev.preventDefault()
    goTo(totalSlides.value - 1)
  } else if (ev.key === 'Escape' && isFullscreen.value) {
    exitFullscreen()
  }
}

async function enterFullscreen(): Promise<void> {
  if (!containerRef.value) return
  try {
    await containerRef.value.requestFullscreen()
    isFullscreen.value = true
  } catch {
    /* navigateur ou contexte sans support */
  }
}
async function exitFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
  } finally {
    isFullscreen.value = false
  }
}
function toggleFullscreen(): void {
  if (isFullscreen.value) exitFullscreen()
  else enterFullscreen()
}
function onFullscreenChange(): void {
  isFullscreen.value = !!document.fullscreenElement
}

onMounted(() => {
  renderDeck()
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('fullscreenchange', onFullscreenChange)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
})

watch(() => props.source, () => {
  currentIndex.value = 0
  renderDeck()
})
</script>

<template>
  <div ref="containerRef" class="lumen-slidedeck" :class="{ 'lumen-slidedeck--fullscreen': isFullscreen }" tabindex="0">
    <!-- Style Marp injecte une seule fois pour le deck courant -->
    <component :is="'style'" v-if="rendered.css">{{ rendered.css }}</component>

    <div v-if="renderError" class="lsd-error">
      <AlertTriangle :size="20" />
      <div>
        <p class="lsd-error-title">Impossible de rendre la presentation</p>
        <p class="lsd-error-msg">{{ renderError }}</p>
      </div>
    </div>

    <div v-else-if="totalSlides === 0" class="lsd-empty">
      Aucune slide detectee dans ce fichier Marp.
    </div>

    <template v-else>
      <div ref="slideHostRef" class="lsd-stage" v-html="currentSlideHtml" />

      <div class="lsd-controls">
        <button
          type="button"
          class="lsd-btn"
          :disabled="!hasPrev"
          aria-label="Slide precedente"
          @click="goPrev"
        >
          <ChevronLeft :size="16" />
        </button>

        <span class="lsd-counter">
          <strong>{{ currentIndex + 1 }}</strong>
          <span class="lsd-counter-sep">/</span>
          <span>{{ totalSlides }}</span>
        </span>

        <button
          type="button"
          class="lsd-btn"
          :disabled="!hasNext"
          aria-label="Slide suivante"
          @click="goNext"
        >
          <ChevronRight :size="16" />
        </button>

        <button
          type="button"
          class="lsd-btn lsd-btn--fullscreen"
          :aria-label="isFullscreen ? 'Quitter le plein-ecran' : 'Plein-ecran'"
          @click="toggleFullscreen"
        >
          <component :is="isFullscreen ? Minimize2 : Maximize2" :size="14" />
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.lumen-slidedeck {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl);
  background: var(--bg-main);
  border-radius: var(--radius-lg);
  outline: none;
}
.lumen-slidedeck:focus-visible {
  box-shadow: var(--focus-ring);
}
.lumen-slidedeck--fullscreen {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay, 2000);
  padding: var(--space-md);
  border-radius: 0;
  background: #000;
  justify-content: center;
}

.lsd-stage {
  width: 100%;
  max-width: 1100px;
  aspect-ratio: 16 / 9;
  background: #fff;
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--elevation-3);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Marp injecte ses propres styles ; on s'assure que la section
   prend bien tout l'espace du stage. */
.lsd-stage :deep(section) {
  width: 100%;
  height: 100%;
  margin: 0;
  display: flex;
  flex-direction: column;
}

.lumen-slidedeck--fullscreen .lsd-stage {
  max-width: min(100vw, calc(100vh * 16 / 9));
  max-height: 100vh;
}

.lsd-controls {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: var(--space-xs) var(--space-md);
  box-shadow: var(--elevation-2);
}

.lsd-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius);
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out);
}
.lsd-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.lsd-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.lsd-btn:disabled {
  opacity: .35;
  cursor: not-allowed;
}

.lsd-counter {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  min-width: 60px;
  justify-content: center;
}
.lsd-counter strong { font-weight: 700; color: var(--accent); }
.lsd-counter-sep { color: var(--text-muted); opacity: .5; }

.lsd-error {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: rgba(231,76,60,.08);
  border: 1px solid rgba(231,76,60,.25);
  border-radius: var(--radius-lg);
  color: var(--color-danger);
  max-width: 600px;
}
.lsd-error-title { font-weight: 700; margin: 0 0 var(--space-xs); }
.lsd-error-msg { margin: 0; font-size: 13px; opacity: .85; }

.lsd-empty {
  padding: var(--space-2xl, 48px) var(--space-xl);
  color: var(--text-muted);
  font-size: 14px;
}
</style>
