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
import { ZoomIn, ZoomOut, Maximize, FileText, Download, Search, X } from 'lucide-vue-next'
// Legacy build : evite Uint8Array.toHex() absent dans Electron 35 sandbox
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

interface Props {
  content: string | null
  title?: string
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

// ── Recherche dans le PDF ─────────────────────────────────────────────
const searchOpen = ref(false)
const searchQuery = ref('')
const searchResults = ref(0)
const searchCurrent = ref(0)
const searchInputRef = ref<HTMLInputElement | null>(null)

function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) {
    nextTick(() => searchInputRef.value?.focus())
  } else {
    clearHighlights()
    searchQuery.value = ''
    searchResults.value = 0
    searchCurrent.value = 0
  }
}

function clearHighlights() {
  const container = containerRef.value
  if (!container) return
  container.querySelectorAll('.lumen-pdf-highlight').forEach((el) => el.remove())
}

async function doSearch() {
  clearHighlights()
  searchResults.value = 0
  searchCurrent.value = 0
  const query = searchQuery.value.trim().toLowerCase()
  if (!query || !currentPdf) return

  const container = containerRef.value
  if (!container) return
  const pageDivs = container.querySelectorAll('.lumen-pdf-page')
  let total = 0

  for (let i = 1; i <= currentPdf.numPages; i++) {
    const page = await currentPdf.getPage(i)
    const textContent = await page.getTextContent()
    const viewport = page.getViewport({ scale: scale.value })
    const pageDiv = pageDivs[i - 1]
    if (!pageDiv) continue

    for (const item of textContent.items) {
      if (!('str' in item)) continue
      const text = item.str.toLowerCase()
      let idx = text.indexOf(query)
      while (idx >= 0) {
        total++
        // Create highlight overlay
        const tx = item.transform
        const x = tx[4]
        const y = viewport.height - tx[5]
        const charW = (item.width ?? 0) / (item.str.length || 1)
        const hlX = x + idx * charW
        const hlW = query.length * charW
        const hlH = item.height ?? 12

        const hl = document.createElement('div')
        hl.className = 'lumen-pdf-highlight'
        if (total === 1) hl.classList.add('lumen-pdf-highlight--active')
        hl.style.left = `${hlX}px`
        hl.style.top = `${y - hlH}px`
        hl.style.width = `${hlW}px`
        hl.style.height = `${hlH}px`
        pageDiv.appendChild(hl)

        idx = text.indexOf(query, idx + 1)
      }
    }
  }

  searchResults.value = total
  if (total > 0) {
    searchCurrent.value = 1
    scrollToHighlight(1)
  }
}

function scrollToHighlight(n: number) {
  const container = containerRef.value
  if (!container) return
  const highlights = container.querySelectorAll('.lumen-pdf-highlight')
  highlights.forEach((el, i) => {
    el.classList.toggle('lumen-pdf-highlight--active', i === n - 1)
  })
  const target = highlights[n - 1]
  if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function searchNext() {
  if (searchResults.value === 0) return
  searchCurrent.value = searchCurrent.value >= searchResults.value ? 1 : searchCurrent.value + 1
  scrollToHighlight(searchCurrent.value)
}

function searchPrev() {
  if (searchResults.value === 0) return
  searchCurrent.value = searchCurrent.value <= 1 ? searchResults.value : searchCurrent.value - 1
  scrollToHighlight(searchCurrent.value)
}

function downloadPdf() {
  if (!props.content) return
  const data = decodeBase64Content(props.content)
  if (!data) return
  const blob = new Blob([data as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.title ?? 'document'}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

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
      <button
        type="button"
        class="lumen-pdf-tool-btn"
        title="Telecharger le PDF"
        :disabled="!content"
        @click="downloadPdf"
      >
        <Download :size="14" />
      </button>
      <button
        type="button"
        class="lumen-pdf-tool-btn"
        :class="{ active: searchOpen }"
        title="Rechercher (Ctrl+F)"
        @click="toggleSearch"
      >
        <Search :size="14" />
      </button>
      <span v-if="pageCount" class="lumen-pdf-page-count">{{ pageCount }} page{{ pageCount > 1 ? 's' : '' }}</span>
    </div>

    <!-- Barre de recherche -->
    <div v-if="searchOpen" class="lumen-pdf-search-bar">
      <Search :size="13" class="lumen-pdf-search-icon" />
      <input
        ref="searchInputRef"
        v-model="searchQuery"
        type="text"
        class="lumen-pdf-search-input"
        placeholder="Rechercher dans le PDF..."
        @input="doSearch"
        @keydown.enter.prevent="searchNext"
        @keydown.escape.prevent="toggleSearch"
      />
      <span v-if="searchQuery" class="lumen-pdf-search-count">
        {{ searchResults > 0 ? `${searchCurrent}/${searchResults}` : 'Aucun resultat' }}
      </span>
      <button v-if="searchResults > 1" type="button" class="lumen-pdf-tool-btn lumen-pdf-tool-btn--sm" title="Precedent" @click="searchPrev">&#9650;</button>
      <button v-if="searchResults > 1" type="button" class="lumen-pdf-tool-btn lumen-pdf-tool-btn--sm" title="Suivant" @click="searchNext">&#9660;</button>
      <button type="button" class="lumen-pdf-tool-btn lumen-pdf-tool-btn--sm" title="Fermer" @click="toggleSearch">
        <X :size="12" />
      </button>
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
.lumen-pdf-tool-btn.active {
  background: rgba(var(--accent-rgb, 59, 130, 246), 0.15);
  color: var(--accent);
  border-color: var(--accent);
}
.lumen-pdf-tool-btn--sm {
  width: 24px;
  height: 24px;
  font-size: 10px;
}

.lumen-pdf-search-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--bg-elevated, var(--bg-main));
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.lumen-pdf-search-icon { color: var(--text-muted); flex-shrink: 0; }
.lumen-pdf-search-input {
  flex: 1;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--text-primary);
  font-family: inherit;
  outline: none;
}
.lumen-pdf-search-input:focus { border-color: var(--accent); }
.lumen-pdf-search-count {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

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
  position: relative;
}
.lumen-pdf-page canvas {
  display: block;
  max-width: 100%;
  height: auto;
}
.lumen-pdf-highlight {
  position: absolute;
  background: rgba(255, 213, 0, 0.35);
  border-radius: 1px;
  pointer-events: none;
  mix-blend-mode: multiply;
}
.lumen-pdf-highlight--active {
  background: rgba(255, 140, 0, 0.55);
  outline: 2px solid rgba(255, 140, 0, 0.8);
}
</style>
