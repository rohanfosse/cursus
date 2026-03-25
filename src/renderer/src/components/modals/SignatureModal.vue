<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import { X, Eraser, Check, XCircle, Pen } from 'lucide-vue-next'
import { useSignature } from '@/composables/useSignature'
import { useModalsStore } from '@/stores/modals'
import type { SignatureRequest } from '@/types'

const props = defineProps<{ request: SignatureRequest | null }>()
const emit = defineEmits<{ close: []; signed: [signedUrl: string] }>()

const modals = useModalsStore()
const { savedSignature, saveSignature, signDocument, rejectSignature } = useSignature()

const canvas = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null
let drawing = false
const signing = ref(false)
const rejecting = ref(false)
const rejectReason = ref('')
const showRejectForm = ref(false)
const hasDrawn = ref(false)

onMounted(() => {
  nextTick(initCanvas)
})

watch(() => props.request, () => {
  showRejectForm.value = false
  rejectReason.value = ''
  hasDrawn.value = false
  nextTick(initCanvas)
})

function initCanvas() {
  if (!canvas.value) return
  ctx = canvas.value.getContext('2d')
  if (!ctx) return
  ctx.strokeStyle = '#1a1a2e'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Si signature sauvegardee, la charger
  if (savedSignature.value) {
    const img = new Image()
    img.onload = () => {
      ctx!.drawImage(img, 0, 0)
      hasDrawn.value = true
    }
    img.src = savedSignature.value
  }
}

function getPos(e: MouseEvent | TouchEvent) {
  const rect = canvas.value!.getBoundingClientRect()
  const touch = 'touches' in e ? e.touches[0] : e
  return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
}

function startDraw(e: MouseEvent | TouchEvent) {
  e.preventDefault()
  drawing = true
  const { x, y } = getPos(e)
  ctx!.beginPath()
  ctx!.moveTo(x, y)
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
  if (!ctx || !canvas.value) return
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
  hasDrawn.value = false
}

function getSignatureBase64(): string {
  return canvas.value?.toDataURL('image/png') ?? ''
}

async function doSign() {
  if (!props.request || !hasDrawn.value) return
  signing.value = true
  const sigBase64 = getSignatureBase64()
  // Sauvegarder la signature pour les prochaines fois
  saveSignature(sigBase64)
  const result = await signDocument(props.request.id, sigBase64)
  signing.value = false
  if (result) {
    emit('signed', result.signed_file_url)
    emit('close')
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
      <div class="sig-modal">
        <!-- Header -->
        <div class="sig-header">
          <div class="sig-header-info">
            <Pen :size="16" class="sig-header-icon" />
            <div>
              <h2 class="sig-title">Signature demandee</h2>
              <p class="sig-sub">{{ request.student_name }} · {{ request.file_name }}</p>
            </div>
          </div>
          <button class="sig-close" @click="$emit('close')"><X :size="16" /></button>
        </div>

        <!-- Preview du document -->
        <div class="sig-preview">
          <iframe :src="request.file_url" class="sig-preview-frame" />
        </div>

        <!-- Zone de signature -->
        <div v-if="!showRejectForm" class="sig-pad-section">
          <div class="sig-pad-label">Votre signature</div>
          <div class="sig-pad-wrap">
            <canvas
              ref="canvas"
              class="sig-canvas"
              width="400"
              height="120"
              @mousedown="startDraw"
              @mousemove="draw"
              @mouseup="stopDraw"
              @mouseleave="stopDraw"
              @touchstart="startDraw"
              @touchmove="draw"
              @touchend="stopDraw"
            />
            <button class="sig-clear-btn" title="Effacer" @click="clearCanvas"><Eraser :size="14" /></button>
          </div>
          <p v-if="savedSignature && !hasDrawn" class="sig-saved-hint">Signature sauvegardee chargee</p>

          <div class="sig-actions">
            <button class="sig-btn sig-btn--reject" @click="showRejectForm = true">
              <XCircle :size="14" /> Refuser
            </button>
            <button class="sig-btn sig-btn--sign" :disabled="!hasDrawn || signing" @click="doSign">
              <Check :size="14" /> {{ signing ? 'Signature en cours...' : 'Signer le document' }}
            </button>
          </div>
        </div>

        <!-- Formulaire de refus -->
        <div v-else class="sig-reject-section">
          <div class="sig-pad-label">Motif du refus</div>
          <textarea v-model="rejectReason" class="sig-reject-input" placeholder="Indiquez la raison du refus (optionnel)..." rows="3" />
          <div class="sig-actions">
            <button class="sig-btn sig-btn--cancel" @click="showRejectForm = false">Annuler</button>
            <button class="sig-btn sig-btn--reject" :disabled="rejecting" @click="doReject">
              <XCircle :size="14" /> {{ rejecting ? 'Refus en cours...' : 'Confirmer le refus' }}
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
.sig-sub { font-size: 12px; color: var(--text-muted); margin: 0; }
.sig-close {
  width: 30px; height: 30px; border-radius: 8px; border: none;
  background: transparent; color: var(--text-muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .12s;
}
.sig-close:hover { background: var(--bg-hover); }

.sig-preview { flex: 1; min-height: 200px; max-height: 320px; overflow: hidden; }
.sig-preview-frame { width: 100%; height: 100%; border: none; background: #fff; }

.sig-pad-section, .sig-reject-section { padding: 16px 20px; border-top: 1px solid var(--border); }
.sig-pad-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--text-muted); margin-bottom: 8px; }

.sig-pad-wrap {
  position: relative; border: 2px dashed var(--border); border-radius: 10px;
  overflow: hidden; background: #fff;
}
.sig-canvas { display: block; cursor: crosshair; width: 100%; height: 120px; touch-action: none; }
.sig-clear-btn {
  position: absolute; top: 6px; right: 6px;
  width: 28px; height: 28px; border-radius: 6px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  color: var(--text-muted); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: color .12s;
}
.sig-clear-btn:hover { color: var(--color-danger); }
.sig-saved-hint { font-size: 11px; color: var(--color-success); margin-top: 4px; }

.sig-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px; }
.sig-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 16px; border-radius: 8px; border: none;
  font-size: 13px; font-weight: 600; cursor: pointer;
  font-family: inherit; transition: opacity .12s;
}
.sig-btn:disabled { opacity: .5; cursor: not-allowed; }
.sig-btn--sign { background: var(--color-success, #059669); color: #fff; }
.sig-btn--sign:hover:not(:disabled) { opacity: .9; }
.sig-btn--reject { background: var(--color-danger, #dc2626); color: #fff; }
.sig-btn--reject:hover:not(:disabled) { opacity: .9; }
.sig-btn--cancel { background: var(--bg-elevated); color: var(--text-primary); border: 1px solid var(--border); }

.sig-reject-input {
  width: 100%; padding: 10px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--bg-elevated);
  color: var(--text-primary); font-size: 13px; font-family: inherit;
  resize: vertical; outline: none;
}
.sig-reject-input:focus { border-color: var(--accent); }
</style>
