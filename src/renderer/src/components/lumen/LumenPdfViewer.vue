<script setup lang="ts">
/**
 * Viewer PDF autonome base sur pdf.js (pdfjs-dist).
 * Remplace l'ancien iframe + plugin Chromium natif qui ne fonctionnait plus
 * correctement avec sandbox: true (Electron 35+).
 *
 * Recoit le contenu en data URL base64 et rend chaque page sur un canvas
 * avec une couche texte selectionnable (TextLayer).
 */
import { ref, watch, onBeforeUnmount, nextTick, computed } from 'vue'
import { ZoomIn, ZoomOut, Maximize, FileText } from 'lucide-vue-next'
import * as pdfjsLib from 'pdfjs-dist'

// Worker pdf.js — charge le worker inline via la version bundled
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface Props {
  content: string | null
}

const props = defineProps<Props>()

const containerRef = ref<HTMLElement | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const pageCount = ref(0)
const scale = ref(1.2)

const SCALE_MIN = 0.5
const SCALE_MAX = 3.0
const SCALE_STEP = 0.2

let currentPdf: pdfjsLib.PDFDocumentProxy | null = null
let renderGeneration = 0

function zoomIn() {
  if (scale.value < SCALE_MAX) {
    scale.value = Math.min(scale.value + SCALE_STEP, SCALE_MAX)
  }
}

function zoomOut() {
  if (scale.value > SCALE_MIN) {
    scale.value = Math.max(scale.value - SCALE_STEP, SCALE_MIN)
  }
}

function fitWidth() {
  if (!containerRef.value || !currentPdf) return
  // Get first page to compute fit scale
  currentPdf.getPage(1).then((page) => {
    const viewport = page.getViewport({ scale: 1 })
    const containerWidth = containerRef.value?.clientWidth ?? 800
    scale.value = Math.min(
      Math.max((containerWidth - 40) / viewport.width, SCALE_MIN),
      SCALE_MAX,
    )
  })
}

const zoomPercent = computed(() => Math.round(scale.value * 100))

/**
 * Decode le data URL base64 en Uint8Array.
 */
function decodeBase64Content(content: string): Uint8Array | null {
  const m = content.match(/^data:application\/pdf;base64,(.+)$/)
  if (!m) return null
  try {
    const binary = atob(m[1])
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

/** Release GPU memory from canvas elements before removing them. */
function clearContainer(container: HTMLElement) {
  container.querySelectorAll('canvas').forEach((c) => { c.width = 0; c.height = 0 })
  container.innerHTML = ''
}

/** Render all pages of an already-loaded PDF document onto canvases. */
async function renderPages(pdf: pdfjsLib.PDFDocumentProxy, gen: number) {
  await nextTick()
  const container = containerRef.value
  if (!container || gen !== renderGeneration) return

  clearContainer(container)

  const dpr = window.devicePixelRatio || 1
  const currentScale = scale.value

  // Pre-create page wrappers in order, then render in parallel
  const slots: { pageDiv: HTMLElement; pageNum: number }[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const pageDiv = document.createElement('div')
    pageDiv.className = 'lumen-pdf-page'
    container.appendChild(pageDiv)
    slots.push({ pageDiv, pageNum: i })
  }

  await Promise.all(slots.map(async ({ pageDiv, pageNum }) => {
    if (gen !== renderGeneration) return
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: currentScale })

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = Math.floor(viewport.width * dpr)
    canvas.height = Math.floor(viewport.height * dpr)
    canvas.style.width = `${Math.floor(viewport.width)}px`
    canvas.style.height = `${Math.floor(viewport.height)}px`
    ctx.scale(dpr, dpr)
    pageDiv.appendChild(canvas)

    if (gen !== renderGeneration) return
    await page.render({ canvasContext: ctx, viewport, canvas } as Parameters<typeof page.render>[0]).promise
  }))
}

/** Load a new PDF document from raw bytes, then render its pages. */
async function loadPdf(data: Uint8Array, gen: number) {
  loading.value = true
  error.value = null
  try {
    const pdf = await pdfjsLib.getDocument({ data }).promise
    if (gen !== renderGeneration) return
    currentPdf = pdf
    pageCount.value = pdf.numPages
    await renderPages(pdf, gen)
  } catch (err) {
    if (gen !== renderGeneration) return
    error.value = err instanceof Error ? err.message : 'Erreur lors du rendu PDF'
  } finally {
    if (gen === renderGeneration) loading.value = false
  }
}

// Content change: decode + load new PDF document
watch(() => props.content, (content) => {
  renderGeneration++
  const gen = renderGeneration
  if (currentPdf) { currentPdf.destroy(); currentPdf = null }
  pageCount.value = 0
  if (!content) { error.value = 'Aucun contenu PDF'; return }
  const data = decodeBase64Content(content)
  if (!data) { error.value = 'Format de donnees PDF invalide'; return }
  loadPdf(data, gen)
}, { immediate: true })

// Scale change: re-render pages only (PDF document already loaded)
watch(scale, () => {
  if (!currentPdf) return
  renderGeneration++
  renderPages(currentPdf, renderGeneration)
})

onBeforeUnmount(() => {
  renderGeneration++
  if (currentPdf) { currentPdf.destroy(); currentPdf = null }
})
</script>

<template>
  <div class="lumen-pdf-viewer">
    <!-- Toolbar -->
    <div class="lumen-pdf-toolbar">
      <button
        type="button"
        class="lumen-pdf-tool-btn"
        title="Zoom arriere"
        :disabled="scale <= SCALE_MIN"
        @click="zoomOut"
      >
        <ZoomOut :size="14" />
      </button>
      <span class="lumen-pdf-zoom-label">{{ zoomPercent }}%</span>
      <button
        type="button"
        class="lumen-pdf-tool-btn"
        title="Zoom avant"
        :disabled="scale >= SCALE_MAX"
        @click="zoomIn"
      >
        <ZoomIn :size="14" />
      </button>
      <button
        type="button"
        class="lumen-pdf-tool-btn"
        title="Ajuster a la largeur"
        @click="fitWidth"
      >
        <Maximize :size="14" />
      </button>
      <span v-if="pageCount" class="lumen-pdf-page-count">{{ pageCount }} page{{ pageCount > 1 ? 's' : '' }}</span>
    </div>

    <!-- Loading -->
    <div v-if="loading && !error" class="lumen-pdf-loading">
      <div class="lumen-pdf-spinner" />
    </div>

    <!-- Error -->
    <div v-if="error" class="lumen-pdf-error">
      <FileText :size="32" />
      <h3>Impossible d'afficher le PDF</h3>
      <p>{{ error }}</p>
    </div>

    <!-- Pages container -->
    <div ref="containerRef" class="lumen-pdf-pages" />
  </div>
</template>

<style scoped>
.lumen-pdf-viewer {
  display: flex;
  flex-direction: column;
  height: 0;
  flex-grow: 1;
  overflow: hidden;
  background: var(--bg-rail, #1e1e1e);
}

.lumen-pdf-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-main);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.lumen-pdf-tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--t-fast) ease;
}
.lumen-pdf-tool-btn:hover:not(:disabled) { background: var(--bg-hover); }
.lumen-pdf-tool-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.lumen-pdf-zoom-label {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
  min-width: 36px;
  text-align: center;
}

.lumen-pdf-page-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-muted);
}

.lumen-pdf-pages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.lumen-pdf-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
}

.lumen-pdf-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: pdf-spin 0.8s linear infinite;
}
@keyframes pdf-spin { to { transform: rotate(360deg); } }

.lumen-pdf-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 48px 24px;
  color: var(--text-muted);
  text-align: center;
}
.lumen-pdf-error h3 {
  margin: 0;
  font-size: 15px;
  color: var(--text-primary);
}
.lumen-pdf-error p {
  margin: 0;
  font-size: 12px;
}
</style>

<style>
/* Global (non-scoped) pour cibler les pages canvas injectees dynamiquement */
.lumen-pdf-page {
  background: white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  border-radius: 2px;
  line-height: 0;
}
.lumen-pdf-page canvas {
  display: block;
  max-width: 100%;
  height: auto;
}
</style>
