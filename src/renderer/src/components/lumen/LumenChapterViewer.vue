<script setup lang="ts">
/**
 * Rendu d'un chapitre Markdown dans Lumen.
 * Le contenu est fetche par le parent et passe en prop. Le rendu utilise
 * utils/markdown (marked + highlight.js + DOMPurify + admonitions).
 *
 * Auto-marque comme lu au bout de 3 secondes d'affichage visible.
 */
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { Loader2, FileText, Clock, User } from 'lucide-vue-next'
import { renderMarkdown } from '@/utils/markdown'
import type { LumenChapter, LumenRepo } from '@/types'

interface Props {
  repo: LumenRepo
  chapter: LumenChapter
  content: string | null
  loading: boolean
  isRead: boolean
}
interface Emits {
  (e: 'read'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const html = computed(() => {
  if (!props.content) return ''
  return renderMarkdown(props.content)
})

const cachedBannerVisible = computed(() => false)

let readTimer: ReturnType<typeof setTimeout> | null = null

function scheduleAutoRead() {
  if (readTimer) clearTimeout(readTimer)
  if (props.isRead || !props.content) return
  readTimer = setTimeout(() => {
    emit('read')
  }, 3000)
}

onMounted(scheduleAutoRead)
watch(() => [props.content, props.chapter?.path], scheduleAutoRead)
onBeforeUnmount(() => {
  if (readTimer) clearTimeout(readTimer)
})
</script>

<template>
  <article class="lumen-viewer">
    <header class="lumen-viewer-head">
      <div class="lumen-viewer-meta">
        <span class="lumen-viewer-project">{{ repo.manifest?.project ?? repo.fullName }}</span>
        <span class="lumen-viewer-sep">/</span>
        <span class="lumen-viewer-title">{{ chapter.title }}</span>
      </div>
      <div class="lumen-viewer-info">
        <span v-if="chapter.duration" class="lumen-viewer-chip">
          <Clock :size="11" /> {{ chapter.duration }} min
        </span>
        <span v-if="repo.manifest?.author" class="lumen-viewer-chip">
          <User :size="11" /> {{ repo.manifest.author }}
        </span>
      </div>
    </header>

    <div v-if="loading" class="lumen-viewer-loading">
      <Loader2 :size="20" class="spin" />
      Chargement du chapitre...
    </div>
    <div v-else-if="!content" class="lumen-viewer-empty">
      <FileText :size="32" />
      <p>Contenu indisponible</p>
    </div>
    <div v-else class="lumen-viewer-body markdown-body" v-html="html" />
  </article>
</template>

<style scoped>
.lumen-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
}

.lumen-viewer-head {
  padding: 14px 32px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.lumen-viewer-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.lumen-viewer-project {
  color: var(--text-muted);
  font-weight: 500;
}
.lumen-viewer-sep { color: var(--text-muted); }
.lumen-viewer-title {
  color: var(--text-primary);
  font-weight: 700;
}

.lumen-viewer-info {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.lumen-viewer-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 3px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-muted);
}

.lumen-viewer-loading,
.lumen-viewer-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: var(--text-sm);
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.lumen-viewer-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px 48px 64px;
  max-width: 820px;
  width: 100%;
  margin: 0 auto;
}
</style>
