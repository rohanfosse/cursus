<script setup lang="ts">
  import { watch, ref, computed } from 'vue'
  import { Download, ExternalLink, FileText, Image, Video, File } from 'lucide-vue-next'
  import { useDocumentsStore } from '@/stores/documents'
  import Modal from '@/components/ui/Modal.vue'

  const api   = window.api
  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const docStore   = useDocumentsStore()
  const previewSrc = ref<string | null>(null)
  const mime       = ref<string>('')
  const loading    = ref(false)

  const doc = computed(() => docStore.previewDoc)

  const previewType = computed(() => {
    if (!doc.value) return 'none'
    if (doc.value.type === 'link') return 'link'
    if (!previewSrc.value)         return 'none'
    if (mime.value.startsWith('image/'))     return 'image'
    if (mime.value === 'application/pdf')    return 'pdf'
    if (mime.value.startsWith('video/'))     return 'video'
    if (mime.value.startsWith('text/'))      return 'text'
    return 'unsupported'
  })

  const textContent = ref('')

  watch(() => props.modelValue, async (open) => {
    previewSrc.value  = null
    mime.value        = ''
    textContent.value = ''

    if (!open || !doc.value || doc.value.type === 'link') return
    loading.value = true
    try {
      const res = await api.readFileBase64(doc.value.content)
      if (res?.ok && res.data) {
        mime.value       = res.data.mime ?? ''
        previewSrc.value = `data:${mime.value};base64,${res.data.b64}`

        // Pour les fichiers texte : décoder le base64
        if (mime.value.startsWith('text/')) {
          textContent.value = atob(res.data.b64)
        }
      }
    } finally {
      loading.value = false
    }
  })

  function fileName() {
    return doc.value?.content?.split(/[\\/]/).pop() ?? doc.value?.name ?? ''
  }
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="doc?.name ?? 'Aperçu'"
    max-width="860px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="preview-body">

      <!-- Chargement -->
      <div v-if="loading" class="preview-loading">
        <div class="preview-spinner" />
        <span>Chargement du fichier…</span>
      </div>

      <!-- Image -->
      <div v-else-if="previewType === 'image'" class="preview-image-wrap">
        <img :src="previewSrc!" :alt="doc?.name" class="preview-image" />
      </div>

      <!-- PDF -->
      <iframe
        v-else-if="previewType === 'pdf'"
        :src="previewSrc!"
        class="preview-pdf"
        title="Aperçu PDF"
      />

      <!-- Vidéo -->
      <div v-else-if="previewType === 'video'" class="preview-video-wrap">
        <video :src="previewSrc!" controls class="preview-video" />
      </div>

      <!-- Texte -->
      <pre v-else-if="previewType === 'text'" class="preview-text">{{ textContent }}</pre>

      <!-- Lien externe -->
      <div v-else-if="previewType === 'link'" class="preview-link">
        <ExternalLink :size="36" class="preview-link-icon" />
        <p class="preview-link-url">{{ doc?.content }}</p>
        <button class="btn-primary" @click="doc && api.openExternal(doc.content)">
          <ExternalLink :size="14" /> Ouvrir dans le navigateur
        </button>
      </div>

      <!-- Format non prévisualisable -->
      <div v-else-if="previewType === 'unsupported'" class="preview-unsupported">
        <File :size="40" class="preview-unsupported-icon" />
        <p class="preview-unsupported-name">{{ fileName() }}</p>
        <p class="preview-unsupported-msg">Aperçu non disponible pour ce format.</p>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn-primary" @click="doc && api.downloadFile(doc.content)">
            <Download :size="14" /> Télécharger
          </button>
          <button class="btn-ghost" @click="doc && api.openPath(doc.content)">
            Ouvrir avec…
          </button>
        </div>
      </div>

      <!-- Pas encore chargé -->
      <div v-else class="preview-empty">
        <FileText :size="32" style="opacity:.3" />
      </div>

    </div>

    <!-- Footer -->
    <div class="modal-footer preview-footer">
      <span class="preview-footer-name">{{ doc?.name }}</span>
      <div style="display:flex;gap:8px">
        <button
          v-if="doc?.type === 'file'"
          class="btn-ghost"
          style="display:flex;align-items:center;gap:6px"
          @click="doc && api.downloadFile(doc.content)"
        >
          <Download :size="14" /> Télécharger
        </button>
        <button
          v-if="doc?.type === 'file'"
          class="btn-ghost"
          style="display:flex;align-items:center;gap:6px"
          @click="doc && api.openPath(doc.content)"
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
.preview-body {
  min-height: 400px;
  max-height: 65vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #1a1c21;
}

/* Chargement */
.preview-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
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

/* Image */
.preview-image-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--radius-sm);
}

/* PDF */
.preview-pdf {
  width: 100%;
  min-height: 500px;
  height: 65vh;
  border: none;
  display: block;
}

/* Vidéo */
.preview-video-wrap {
  width: 100%;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-video {
  max-width: 100%;
  max-height: 60vh;
  border-radius: var(--radius-sm);
}

/* Texte */
.preview-text {
  width: 100%;
  height: 100%;
  min-height: 400px;
  padding: 20px 24px;
  overflow: auto;
  font-family: 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text-secondary);
  white-space: pre-wrap;
  word-break: break-word;
  background: #161820;
  align-self: stretch;
}

/* Lien */
.preview-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 24px;
  text-align: center;
}

.preview-link-icon { color: #27AE60; }

.preview-link-url {
  font-size: 13px;
  color: var(--text-muted);
  word-break: break-all;
  max-width: 500px;
}

/* Non-prévisualisable */
.preview-unsupported {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px 24px;
  text-align: center;
}

.preview-unsupported-icon { color: var(--text-muted); opacity: .5; }
.preview-unsupported-name { font-size: 15px; font-weight: 600; color: var(--text-secondary); }
.preview-unsupported-msg  { font-size: 13px; color: var(--text-muted); }

/* Vide */
.preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

/* Footer */
.preview-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.preview-footer-name {
  font-size: 13px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}
</style>
