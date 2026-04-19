<script setup lang="ts">
import { watch, ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { Download, ExternalLink, FileText, Image, Video, File, Table2, BookOpen, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useDocumentsStore } from '@/stores/documents'
import { useOpenExternal }   from '@/composables/useOpenExternal'
import Modal from '@/components/ui/Modal.vue'
import LumenPdfViewer from '@/components/lumen/LumenPdfViewer.vue'
import * as mammoth from 'mammoth'
import ExcelJS from 'exceljs'
import DOMPurify from 'dompurify'
import { escapeHtml } from '@/utils/html'
import { base64ToUint8Array, base64ToArrayBuffer, base64ToBlobUrl } from '@/utils/base64'
import { isImage, isVideo, isPdf, isText, isWord, isExcel } from '@/utils/mimeTypes'

const api   = window.api
const { openExternal } = useOpenExternal()
const props = defineProps<{ modelValue: boolean }>()
const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

const docStore   = useDocumentsStore()
const blobUrl    = ref<string | null>(null)
const pdfBytes   = ref<Uint8Array | null>(null)
const wordHtml   = ref<string>('')
const excelHtml  = ref<string>('')
const textContent = ref('')
const mime       = ref<string>('')
const loading    = ref(false)
const error      = ref<string | null>(null)
const zoomLevel  = ref(100)

function zoomIn()  { zoomLevel.value = Math.min(300, zoomLevel.value + 25) }
function zoomOut() { zoomLevel.value = Math.max(50, zoomLevel.value - 25) }
function zoomReset() { zoomLevel.value = 100 }

const doc = computed(() => docStore.previewDoc)
const navInfo = computed(() => docStore.previewIndex())
const canPrev = computed(() => navInfo.value.current > 1)
const canNext = computed(() => navInfo.value.current < navInfo.value.total)

function goNext() { if (canNext.value) docStore.previewNext() }
function goPrev() { if (canPrev.value) docStore.previewPrev() }

function onKeydown(e: KeyboardEvent) {
  if (!props.modelValue) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goNext() }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goPrev() }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// ── Nettoyage du blob URL précédent ──────────────────────────────────────────
function revokeBlob() {
  if (blobUrl.value) { URL.revokeObjectURL(blobUrl.value); blobUrl.value = null }
}
onBeforeUnmount(revokeBlob)


// ── Catégorie de type à afficher ─────────────────────────────────────────────
const previewType = computed(() => {
  if (!doc.value) return 'none'
  if (doc.value.type === 'link') return 'link'
  if (loading.value)              return 'loading'
  if (error.value)                return 'error'
  if (!mime.value)                return 'none'
  if (isImage(mime.value)) return 'image'
  if (isPdf(mime.value))   return 'pdf'
  if (isVideo(mime.value)) return 'video'
  if (isText(mime.value))  return 'text'
  if (isWord(mime.value))  return 'word'
  if (isExcel(mime.value)) return 'excel'
  return 'unsupported'
})

// ── Chargement selon le type ──────────────────────────────────────────────────
watch(() => props.modelValue, async (open) => {
  revokeBlob()
  pdfBytes.value = null
  mime.value     = ''
  wordHtml.value = ''
  excelHtml.value = ''
  textContent.value = ''
  error.value    = null

  if (!open || !doc.value) return

  // Lien : ouvrir directement dans le navigateur et fermer la modal
  if (doc.value.type === 'link') {
    await openExternal(doc.value.content)
    emit('update:modelValue', false)
    return
  }

  loading.value = true
  try {
    const res = await api.readFileBase64(doc.value.content) as { ok: boolean; data?: { b64: string; mime: string }; error?: string }
    if (!res?.ok || !res.data) {
      console.error('[DocumentPreview] readFileBase64 failed:', { res, content: doc.value.content })
      error.value = res?.error
        ? `Lecture echouee : ${res.error}`
        : 'Impossible de lire le fichier.'
      return
    }
    mime.value = res.data.mime ?? ''
    const b64: string = res.data.b64

    if (isImage(mime.value) || isVideo(mime.value)) {
      blobUrl.value = base64ToBlobUrl(b64, mime.value)

    } else if (isPdf(mime.value)) {
      // pdf.js via LumenPdfViewer : bytes bruts (evite 3x pic RAM vs data URL)
      pdfBytes.value = base64ToUint8Array(b64)

    } else if (isText(mime.value)) {
      textContent.value = atob(b64)

    } else if (isWord(mime.value)) {
      const result = await mammoth.convertToHtml({ arrayBuffer: base64ToArrayBuffer(b64) })
      wordHtml.value = DOMPurify.sanitize(result.value)

    } else if (isExcel(mime.value)) {
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(base64ToArrayBuffer(b64))
      const ws = wb.worksheets[0]
      if (ws) {
        const rows: string[] = ['<table>']
        ws.eachRow((row) => {
          rows.push('<tr>')
          row.eachCell({ includeEmpty: true }, (cell) => {
            rows.push(`<td>${escapeHtml(cell.text)}</td>`)
          })
          rows.push('</tr>')
        })
        rows.push('</table>')
        excelHtml.value = DOMPurify.sanitize(rows.join(''), {
          ALLOWED_TAGS: ['table', 'tr', 'td', 'th'],
          ALLOWED_ATTR: [],
        })
      }
    }
  } catch (e) {
    console.error('[DocumentPreview] Parse error:', e, { content: doc.value?.content, mime: mime.value })
    const detail = e instanceof Error ? e.message : String(e)
    error.value = `Erreur lors de la lecture du fichier : ${detail}`
  } finally {
    loading.value = false
  }
})

function fileName() {
  return doc.value?.content?.split(/[\\/]/).pop() ?? doc.value?.name ?? ''
}

function openExternalFile() {
  if (doc.value) openExternal(doc.value.content)
}
function download() {
  if (doc.value) api.downloadFile(doc.value.content)
}
function openWith() {
  if (doc.value) api.openPath(doc.value.content)
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="doc?.name ?? 'Aperçu'"
    max-width="900px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- Navigation arrows -->
    <button v-if="canPrev" class="preview-nav preview-nav--prev" title="Précédent (←)" @click="goPrev">
      <ChevronLeft :size="24" />
    </button>
    <button v-if="canNext" class="preview-nav preview-nav--next" title="Suivant (→)" @click="goNext">
      <ChevronRight :size="24" />
    </button>

    <div class="preview-body">

      <!-- Chargement -->
      <div v-if="previewType === 'loading'" class="preview-state">
        <div class="preview-spinner" />
        <span>Chargement…</span>
      </div>

      <!-- Erreur -->
      <div v-else-if="previewType === 'error'" class="preview-state">
        <File :size="36" style="color:var(--color-danger);opacity:.6" />
        <p style="color:var(--color-danger);font-size:13px;max-width:480px;text-align:center">{{ error }}</p>
        <p style="color:var(--text-muted);font-size:11px;max-width:480px;text-align:center;margin-top:-6px">
          Si l'aperçu ne charge pas, télécharge le fichier ou ouvre-le avec une app externe.
        </p>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn-primary" @click="download">
            <Download :size="14" /> Télécharger
          </button>
          <button class="btn-ghost" @click="openWith">Ouvrir avec…</button>
        </div>
      </div>

      <!-- Image -->
      <div v-else-if="previewType === 'image'" class="preview-image-wrap">
        <div class="preview-zoom-controls">
          <button class="preview-zoom-btn" @click="zoomOut" title="Zoom -"><ZoomOut :size="14" /></button>
          <span class="preview-zoom-level">{{ zoomLevel }}%</span>
          <button class="preview-zoom-btn" @click="zoomIn" title="Zoom +"><ZoomIn :size="14" /></button>
          <button class="preview-zoom-btn" @click="zoomReset" title="Réinitialiser">1:1</button>
        </div>
        <div class="preview-image-scroll">
          <img :src="blobUrl!" :alt="doc?.name" class="preview-image" :style="{ transform: `scale(${zoomLevel / 100})` }" />
        </div>
      </div>

      <!-- PDF → pdf.js via LumenPdfViewer (fix Electron 35+ sandbox) -->
      <LumenPdfViewer
        v-else-if="previewType === 'pdf'"
        :content="pdfBytes"
        :title="doc?.name"
        class="preview-pdf"
      />

      <!-- Vidéo -->
      <div v-else-if="previewType === 'video'" class="preview-video-wrap">
        <video :src="blobUrl!" controls class="preview-video" />
      </div>

      <!-- Texte brut -->
      <pre v-else-if="previewType === 'text'" class="preview-text">{{ textContent }}</pre>

      <!-- Word (.docx) → HTML via mammoth -->
      <div v-else-if="previewType === 'word'" class="preview-word">
        <div class="preview-word-toolbar">
          <BookOpen :size="13" style="color:#2B5DBF" />
          <span>Document Word</span>
          <button class="btn-ghost preview-toolbar-btn" @click="openWith">Ouvrir avec Word</button>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="preview-word-content" v-html="wordHtml" />
      </div>

      <!-- Excel (.xlsx) → tableau HTML via ExcelJS -->
      <div v-else-if="previewType === 'excel'" class="preview-excel">
        <div class="preview-word-toolbar">
          <Table2 :size="13" style="color:#1D6F42" />
          <span>Classeur Excel - {{ doc?.name }}</span>
          <button class="btn-ghost preview-toolbar-btn" @click="openWith">Ouvrir avec Excel</button>
        </div>
        <div class="preview-excel-wrap">
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="preview-excel-table" v-html="excelHtml" />
        </div>
      </div>

      <!-- Lien (ne devrait pas s'afficher : la modal se ferme à l'ouverture) -->
      <div v-else-if="previewType === 'link'" class="preview-state">
        <ExternalLink :size="28" style="color:var(--color-success)" />
        <p style="font-size:13px;color:var(--text-muted)">Ouverture en cours…</p>
      </div>

      <!-- Format non prévisualisable -->
      <div v-else-if="previewType === 'unsupported'" class="preview-state">
        <File :size="40" class="preview-unsupported-icon" />
        <p class="preview-unsupported-name">{{ fileName() }}</p>
        <p class="preview-unsupported-msg">Aperçu non disponible pour ce format.</p>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn-primary" @click="download">
            <Download :size="14" /> Télécharger
          </button>
          <button class="btn-ghost" @click="openWith">Ouvrir avec…</button>
        </div>
      </div>

      <!-- Vide -->
      <div v-else class="preview-state">
        <FileText :size="32" style="opacity:.3" />
      </div>

    </div>

    <!-- Footer -->
    <div class="modal-footer preview-footer">
      <div class="preview-footer-left">
        <span class="preview-footer-name">{{ doc?.name }}</span>
        <span v-if="navInfo.total > 1" class="preview-footer-counter">{{ navInfo.current }}/{{ navInfo.total }}</span>
      </div>
      <div style="display:flex;gap:8px">
        <button
          v-if="doc?.type === 'file'"
          class="btn-ghost"
          style="display:flex;align-items:center;gap:6px"
          @click="download"
        >
          <Download :size="14" /> Télécharger
        </button>
        <button
          v-if="doc?.type === 'file'"
          class="btn-ghost"
          style="display:flex;align-items:center;gap:6px"
          @click="openWith"
        >
          <ExternalLink :size="14" /> Ouvrir avec…
        </button>
        <button class="btn-ghost" @click="emit('update:modelValue', false)">
          Fermer
        </button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
/* ── Navigation arrows ── */
.preview-nav {
  position: absolute; top: 50%; z-index: 10;
  transform: translateY(-50%);
  display: flex; align-items: center; justify-content: center;
  width: 40px; height: 40px; border-radius: 50%;
  background: rgba(0,0,0,.5); color: #fff;
  border: 1px solid rgba(255,255,255,.15);
  cursor: pointer; transition: all .2s;
  backdrop-filter: blur(4px);
}
.preview-nav:hover { background: rgba(0,0,0,.7); transform: translateY(-50%) scale(1.08); }
.preview-nav--prev { left: 12px; }
.preview-nav--next { right: 12px; }

.preview-footer-left {
  display: flex; align-items: center; gap: 10px;
  overflow: hidden; min-width: 0;
}
.preview-footer-counter {
  font-size: 11px; font-weight: 600;
  color: var(--text-muted); background: var(--bg-secondary);
  padding: 2px 8px; border-radius: 10px; white-space: nowrap;
}

.preview-body {
  min-height: 420px;
  max-height: 68vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #1a1c21;
}

/* ── État générique (loading / error / unsupported / vide) ── */
.preview-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.preview-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.preview-unsupported-icon { color: var(--text-muted); opacity: .5; }
.preview-unsupported-name { font-size: 15px; font-weight: 600; color: var(--text-secondary); }
.preview-unsupported-msg  { font-size: 13px; color: var(--text-muted); }

/* ── Image ── */
.preview-image-wrap {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  padding: 8px 16px 16px;
}
.preview-zoom-controls {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 0 8px;
  justify-content: center;
}
.preview-zoom-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); cursor: pointer; font-size: 11px; font-weight: 600;
  transition: all .15s; font-family: var(--font);
}
.preview-zoom-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.preview-zoom-level { font-size: 11px; font-weight: 600; color: var(--text-muted); min-width: 36px; text-align: center; }
.preview-image-scroll {
  flex: 1; overflow: auto;
  display: flex; align-items: center; justify-content: center;
}
.preview-image {
  max-width: 100%; max-height: 100%;
  object-fit: contain; border-radius: var(--radius-sm);
  transition: transform var(--motion-base) var(--ease-out);
  transform-origin: center center;
}

/* ── PDF ── */
.preview-pdf {
  width: 100%;
  height: 68vh;
  min-height: 420px;
  border: none;
  display: block;
  background: #fff;
}

/* ── Vidéo ── */
.preview-video-wrap {
  width: 100%; padding: 16px;
  display: flex; align-items: center; justify-content: center;
}
.preview-video {
  max-width: 100%; max-height: 60vh;
  border-radius: var(--radius-sm);
}

/* ── Texte brut ── */
.preview-text {
  width: 100%; height: 100%; min-height: 420px;
  padding: 20px 24px; overflow: auto;
  font-family: 'Courier New', monospace;
  font-size: 12.5px; line-height: 1.7;
  color: var(--text-secondary);
  white-space: pre-wrap; word-break: break-word;
  background: #161820; align-self: stretch;
}

/* ── Word ── */
.preview-word {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  overflow: hidden; align-self: stretch;
}
.preview-word-toolbar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  font-size: 12px; font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.preview-toolbar-btn {
  margin-left: auto;
  font-size: 11.5px;
  padding: 3px 10px;
}
.preview-word-content {
  flex: 1; overflow-y: auto;
  padding: 24px 32px;
  background: #fff; color: #1a1a1a;
  font-family: Georgia, serif;
  font-size: 14px; line-height: 1.7;
}
.preview-word-content :deep(h1) { font-size: 22px; margin: 16px 0 8px; }
.preview-word-content :deep(h2) { font-size: 18px; margin: 14px 0 6px; }
.preview-word-content :deep(h3) { font-size: 15px; margin: 12px 0 4px; }
.preview-word-content :deep(p)  { margin: 0 0 10px; }
.preview-word-content :deep(table) {
  border-collapse: collapse; width: 100%; margin-bottom: 12px;
}
.preview-word-content :deep(td),
.preview-word-content :deep(th) {
  border: 1px solid #ccc; padding: 6px 10px;
}

/* ── Excel ── */
.preview-excel {
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  overflow: hidden; align-self: stretch;
}
.preview-excel-wrap {
  flex: 1; overflow: auto; background: #fff;
}
.preview-excel-table {
  padding: 12px;
}
.preview-excel-table :deep(table) {
  border-collapse: collapse;
  font-size: 12.5px;
  font-family: 'Calibri', sans-serif;
  color: #1a1a1a;
  min-width: 100%;
}
.preview-excel-table :deep(td),
.preview-excel-table :deep(th) {
  border: 1px solid #d0d0d0;
  padding: 5px 10px;
  white-space: nowrap;
}
.preview-excel-table :deep(tr:nth-child(even)) {
  background: #f5f5f5;
}
.preview-excel-table :deep(tr:first-child) {
  background: #e8f0fe;
  font-weight: 600;
}

/* ── Footer ── */
.preview-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  display: flex; align-items: center;
  justify-content: space-between; gap: 12px;
}
.preview-footer-name {
  font-size: 13px; color: var(--text-muted);
  overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; max-width: 300px;
}
</style>
