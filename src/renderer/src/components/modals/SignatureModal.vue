<script setup lang="ts">
/**
 * SignatureModal — signature prof d un document PDF.
 *
 * Flow instinctif (v2.182) :
 *   1. Si signature sauvegardee existe : auto-chargee, bouton "Signer" focus.
 *      Le prof peut signer en 1 clic (ou Enter).
 *   2. Sinon : prof dessine au stylus/souris + Enter pour signer.
 *   3. Escape : ferme la modale (ou sort du mode refus).
 *   4. Ctrl+Enter : "Signer et passer au suivant" si plusieurs demandes en attente.
 *
 * Robustesse :
 *   - Canvas HiDPI : scale par devicePixelRatio pour rendu net sur Retina/4K.
 *   - Limite 2000x2000 px validee cote serveur aussi.
 *   - Si le serveur renvoie 409 ("deja traite"), la liste est rechargee
 *     automatiquement par useSignature et la modale est fermee.
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { X, Eraser, Check, XCircle, Pen, ArrowRight } from 'lucide-vue-next'
import { authUrl } from '@/utils/auth'
import { useSignature } from '@/composables/useSignature'
import type { SignatureRequest } from '@/types'

const props = defineProps<{ request: SignatureRequest | null }>()
const emit = defineEmits<{ close: []; signed: [signedUrl: string]; nextRequest: [] }>()

const { savedSignature, saveSignature, signDocument, rejectSignature, requests } = useSignature()

const canvasEl = ref<HTMLCanvasElement>()
const signBtnEl = ref<HTMLButtonElement>()
let ctx: CanvasRenderingContext2D | null = null
let drawing = false
const signing = ref(false)
const rejecting = ref(false)
const rejectReason = ref('')
const showRejectForm = ref(false)
const hasDrawn = ref(false)

// ── Nb de demandes en attente (hors courante) — affiche dans le header
//    et conditionne le bouton "Signer et suivant".
const otherPendingCount = computed(() => requests.value.filter(
  (r) => r.status === 'pending' && r.id !== props.request?.id,
).length)

// ── HiDPI canvas ────────────────────────────────────────────────────────────
// Sans scale, une signature sur Retina est floue car le canvas interne est
// 400x120 CSS px mais le display le scale x2. On rend en resolution device
// et on laisse le CSS down-scaler.
function initCanvas() {
  const canvas = canvasEl.value
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 3)  // cap a 3 pour eviter des exports enormes
  const cssWidth = 400
  const cssHeight = 120
  canvas.width = cssWidth * dpr
  canvas.height = cssHeight * dpr
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${cssHeight}px`

  ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)
  ctx.strokeStyle = '#1a1a2e'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Si signature sauvegardee, la charger + focus sur le bouton Signer.
  if (savedSignature.value) {
    const img = new Image()
    img.onload = () => {
      if (!ctx) return
      ctx.drawImage(img, 0, 0, cssWidth, cssHeight)
      hasDrawn.value = true
      // Focus le bouton Signer pour permettre Enter immediat.
      nextTick(() => signBtnEl.value?.focus())
    }
    img.onerror = () => {
      // Signature corrompue en LS : on nettoie silencieusement.
      hasDrawn.value = false
    }
    img.src = savedSignature.value
  }
}

onMounted(() => {
  nextTick(initCanvas)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})

watch(() => props.request, () => {
  showRejectForm.value = false
  rejectReason.value = ''
  hasDrawn.value = false
  nextTick(initCanvas)
})

// ── Keyboard shortcuts ──────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (!props.request) return
  // Escape : ferme modale OU sort du mode refus
  if (e.key === 'Escape') {
    if (showRejectForm.value) showRejectForm.value = false
    else emit('close')
    return
  }
  // Ctrl+Enter : signer et passer au suivant
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && hasDrawn.value && !signing.value) {
    e.preventDefault()
    doSignAndNext()
    return
  }
  // Enter (hors textarea) : signer
  if (e.key === 'Enter' && hasDrawn.value && !signing.value && !showRejectForm.value) {
    const target = e.target as HTMLElement | null
    if (target?.tagName === 'TEXTAREA') return
    e.preventDefault()
    doSign()
  }
}

// ── Dessin ──────────────────────────────────────────────────────────────────
function getPos(e: MouseEvent | TouchEvent) {
  const rect = canvasEl.value!.getBoundingClientRect()
  const touch = 'touches' in e ? e.touches[0] : e
  return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
}

function startDraw(e: MouseEvent | TouchEvent) {
  if (!ctx) return
  e.preventDefault()
  drawing = true
  const { x, y } = getPos(e)
  ctx.beginPath()
  ctx.moveTo(x, y)
}

function draw(e: MouseEvent | TouchEvent) {
  if (!drawing || !ctx) return
  e.preventDefault()
  const { x, y } = getPos(e)
  ctx.lineTo(x, y)
  ctx.stroke()
  hasDrawn.value = true
}

function stopDraw() { drawing = false }

function clearCanvas() {
  if (!ctx || !canvasEl.value) return
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  ctx.clearRect(0, 0, canvasEl.value.width / dpr, canvasEl.value.height / dpr)
  hasDrawn.value = false
}

function getSignatureBase64(): string {
  return canvasEl.value?.toDataURL('image/png') ?? ''
}

// ── Actions ─────────────────────────────────────────────────────────────────
async function doSign(): Promise<boolean> {
  if (!props.request || !hasDrawn.value || signing.value) return false
  signing.value = true
  const sigBase64 = getSignatureBase64()
  saveSignature(sigBase64)
  const result = await signDocument(props.request.id, sigBase64)
  signing.value = false
  if (result) {
    emit('signed', result.signed_file_url)
    emit('close')
    return true
  }
  return false
}

async function doSignAndNext() {
  const ok = await doSign()
  if (ok && otherPendingCount.value > 0) {
    emit('nextRequest')
  }
}

async function doReject() {
  if (!props.request) return
  rejecting.value = true
  await rejectSignature(props.request.id, rejectReason.value)
  rejecting.value = false
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="request" class="sig-overlay" @click.self="$emit('close')">
      <div class="sig-modal" role="dialog" aria-modal="true" aria-labelledby="sig-title">
        <!-- Header -->
        <div class="sig-header">
          <div class="sig-header-info">
            <Pen :size="16" class="sig-header-icon" />
            <div>
              <h2 id="sig-title" class="sig-title">Signature demandée</h2>
              <p class="sig-sub">
                {{ request.student_name }} · {{ request.file_name }}
                <span v-if="otherPendingCount > 0" class="sig-pending-pill">
                  +{{ otherPendingCount }} en attente
                </span>
              </p>
            </div>
          </div>
          <button class="sig-close" aria-label="Fermer" @click="$emit('close')"><X :size="16" /></button>
        </div>

        <!-- Preview du document -->
        <div class="sig-preview">
          <iframe :src="authUrl(request.file_url)" class="sig-preview-frame" title="Aperçu du document" />
        </div>

        <!-- Zone de signature -->
        <div v-if="!showRejectForm" class="sig-pad-section">
          <div class="sig-pad-header">
            <span class="sig-pad-label">Votre signature</span>
            <span v-if="savedSignature && hasDrawn" class="sig-saved-hint">
              <Check :size="10" /> Signature sauvegardée
            </span>
          </div>
          <div class="sig-pad-wrap">
            <canvas
              ref="canvasEl"
              class="sig-canvas"
              aria-label="Zone de signature"
              @mousedown="startDraw"
              @mousemove="draw"
              @mouseup="stopDraw"
              @mouseleave="stopDraw"
              @touchstart="startDraw"
              @touchmove="draw"
              @touchend="stopDraw"
            />
            <button class="sig-clear-btn" title="Effacer et recommencer" aria-label="Effacer" @click="clearCanvas">
              <Eraser :size="14" />
            </button>
          </div>

          <div class="sig-actions">
            <button class="sig-btn sig-btn--reject" @click="showRejectForm = true">
              <XCircle :size="14" /> Refuser
            </button>
            <button
              v-if="otherPendingCount > 0"
              class="sig-btn sig-btn--next"
              :disabled="!hasDrawn || signing"
              :title="'Ctrl+Enter'"
              @click="doSignAndNext"
            >
              <Check :size="14" /> Signer + suivant <ArrowRight :size="12" />
            </button>
            <button
              ref="signBtnEl"
              class="sig-btn sig-btn--sign"
              :disabled="!hasDrawn || signing"
              :title="'Enter'"
              @click="doSign"
            >
              <Check :size="14" /> {{ signing ? 'Signature…' : 'Signer' }}
            </button>
          </div>
          <p class="sig-shortcuts">
            <kbd>Enter</kbd> pour signer · <kbd>Esc</kbd> pour fermer
            <template v-if="otherPendingCount > 0"> · <kbd>Ctrl+Enter</kbd> pour suivant</template>
          </p>
        </div>

        <!-- Formulaire de refus -->
        <div v-else class="sig-reject-section">
          <div class="sig-pad-label">Motif du refus</div>
          <textarea v-model="rejectReason" class="sig-reject-input" placeholder="Indiquez la raison du refus (optionnel)..." rows="3" />
          <div class="sig-actions">
            <button class="sig-btn sig-btn--cancel" @click="showRejectForm = false">Annuler</button>
            <button class="sig-btn sig-btn--reject" :disabled="rejecting" @click="doReject">
              <XCircle :size="14" /> {{ rejecting ? 'Refus…' : 'Confirmer le refus' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sig-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
}
.sig-modal {
  background: var(--bg-base); border: 1px solid var(--border);
  border-radius: 14px; width: 520px; max-width: 95vw; max-height: 90vh;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 24px 60px rgba(0,0,0,.25);
}

.sig-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--border);
}
.sig-header-info { display: flex; align-items: center; gap: 12px; }
.sig-header-icon { color: var(--accent); }
.sig-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; }
.sig-sub { font-size: 12px; color: var(--text-muted); margin: 0; display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sig-pending-pill {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10.5px;
  letter-spacing: .2px;
}

.sig-close {
  width: 30px; height: 30px; border-radius: 8px; border: none;
  background: transparent; color: var(--text-muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .12s;
}
.sig-close:hover { background: var(--bg-hover); }
.sig-close:focus-visible { outline: var(--focus-ring); outline-offset: 1px; }

.sig-preview { flex: 1; min-height: 200px; max-height: 320px; overflow: hidden; }
.sig-preview-frame { width: 100%; height: 100%; border: none; background: #fff; }

.sig-pad-section, .sig-reject-section { padding: 16px 20px; border-top: 1px solid var(--border); }

.sig-pad-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.sig-pad-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--text-muted); }
.sig-saved-hint {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10.5px; color: var(--color-success, #059669);
  font-weight: 600;
}

.sig-pad-wrap {
  position: relative; border: 2px dashed var(--border); border-radius: 10px;
  overflow: hidden; background: #fff;
}
.sig-pad-wrap:focus-within { border-color: var(--accent); border-style: solid; }
.sig-canvas { display: block; cursor: crosshair; touch-action: none; }
.sig-clear-btn {
  position: absolute; top: 6px; right: 6px;
  width: 28px; height: 28px; border-radius: 6px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  color: var(--text-muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: color .12s;
}
.sig-clear-btn:hover { color: var(--color-danger); }
.sig-clear-btn:focus-visible { outline: var(--focus-ring); outline-offset: 1px; }

.sig-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; flex-wrap: wrap; }
.sig-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; border: none;
  font-size: 13px; font-weight: 600; cursor: pointer;
  font-family: inherit; transition: opacity .12s, transform .08s;
}
.sig-btn:disabled { opacity: .5; cursor: not-allowed; }
.sig-btn:not(:disabled):hover { opacity: .9; }
.sig-btn:not(:disabled):active { transform: translateY(1px); }
.sig-btn:focus-visible { outline: var(--focus-ring); outline-offset: 2px; }
.sig-btn--sign { background: var(--color-success, #059669); color: #fff; }
.sig-btn--next {
  background: color-mix(in srgb, var(--color-success, #059669) 85%, transparent);
  color: #fff;
}
.sig-btn--reject { background: var(--color-danger, #dc2626); color: #fff; }
.sig-btn--cancel { background: var(--bg-elevated); color: var(--text-primary); border: 1px solid var(--border); }

.sig-shortcuts {
  margin: 8px 0 0;
  font-size: 10.5px;
  color: var(--text-muted);
  text-align: right;
}
.sig-shortcuts kbd {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.sig-reject-input {
  width: 100%; padding: 10px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--bg-elevated);
  color: var(--text-primary); font-size: 13px; font-family: inherit;
  resize: vertical; outline: none;
}
.sig-reject-input:focus { border-color: var(--accent); }
</style>
