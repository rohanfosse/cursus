<script setup lang="ts">
import { ref, computed } from 'vue'
import { renderMarkdown } from '@/utils/markdown'

interface Props {
  content: string
  title?: string
}

const props = defineProps<Props>()

const scrollEl = ref<HTMLDivElement | null>(null)

const html = computed(() => renderMarkdown(props.content))

// Indique si le contenu commence par un h1 markdown (# ...)
const startsWithH1 = computed(() => {
  const firstLine = props.content.split('\n').find(l => l.trim() !== '') ?? ''
  return /^#\s+/.test(firstLine.trim())
})

// Public API : sync scroll depuis l'editeur
function setScrollRatio(ratio: number) {
  const el = scrollEl.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  if (max <= 0) return
  el.scrollTop = ratio * max
}

function getScrollRatio(): number {
  const el = scrollEl.value
  if (!el) return 0
  const max = el.scrollHeight - el.clientHeight
  if (max <= 0) return 0
  return el.scrollTop / max
}

defineExpose({ setScrollRatio, getScrollRatio })
</script>

<template>
  <div ref="scrollEl" class="lumen-preview">
    <article class="lumen-preview-inner">
      <!-- Titre affiche seulement si le contenu markdown ne commence pas par un h1.
           Evite le double h1 si l'auteur met un titre + un # Titre dans le body. -->
      <p v-if="title && !startsWithH1" class="lumen-preview-title">{{ title }}</p>
      <div class="lumen-prose" v-html="html" />
      <div v-if="!content" class="lumen-preview-empty">
        <p>L'aperçu apparaîtra ici à mesure que tu écris.</p>
      </div>
    </article>
  </div>
</template>

<style scoped>
.lumen-preview {
  background: var(--bg, #f8fafc);
  overflow-y: auto;
  border-left: 1px solid var(--border, rgba(0, 0, 0, .08));
  height: 100%;
}

.lumen-preview-inner {
  max-width: 780px;
  margin: 0 auto;
  padding: 32px 36px 120px;
}

.lumen-preview-title {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.025em;
  margin: 0 0 28px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border, rgba(0, 0, 0, .1));
  line-height: 1.15;
}

.lumen-preview-empty {
  color: var(--text-3, #cbd5e1);
  text-align: center;
  margin-top: 80px;
  font-size: 14px;
}

/* ── Prose (markdown rendu) ─────────────────────────────────────────── */
.lumen-prose {
  font-size: 16px;
  line-height: 1.75;
  color: var(--text, #1e293b);
  font-family: var(--font, 'Plus Jakarta Sans', sans-serif);
}

.lumen-prose :deep(h1) {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 32px 0 14px;
  line-height: 1.2;
}
.lumen-prose :deep(h1):first-child { margin-top: 0; }

.lumen-prose :deep(h2) {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 28px 0 12px;
  line-height: 1.25;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border, rgba(0, 0, 0, .08));
}

.lumen-prose :deep(h3) {
  font-size: 18px;
  font-weight: 700;
  margin: 22px 0 10px;
}

.lumen-prose :deep(h4) {
  font-size: 16px;
  font-weight: 700;
  margin: 18px 0 8px;
  color: var(--text-2, #64748b);
}

.lumen-prose :deep(p) { margin: 0 0 16px; }
.lumen-prose :deep(ul),
.lumen-prose :deep(ol) { margin: 0 0 16px; padding-left: 26px; }
.lumen-prose :deep(li) { margin: 5px 0; }
.lumen-prose :deep(li > ul),
.lumen-prose :deep(li > ol) { margin: 6px 0 0; }

.lumen-prose :deep(a) {
  color: #b45309;
  text-decoration: underline;
  text-decoration-thickness: 1.5px;
  text-underline-offset: 2px;
}
.lumen-prose :deep(a:hover) { color: #92400e; }

.lumen-prose :deep(blockquote) {
  margin: 16px 0;
  padding: 10px 18px;
  border-left: 3px solid #b45309;
  background: rgba(245, 158, 11, 0.06);
  border-radius: 0 6px 6px 0;
  color: #475569;
}
.lumen-prose :deep(blockquote p:last-child) { margin-bottom: 0; }

.lumen-prose :deep(code) {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.88em;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(217, 119, 6, 0.1);
  color: #92400e;
}

.lumen-prose :deep(pre.lumen-code) {
  margin: 16px 0;
  padding: 16px 20px;
  border-radius: 10px;
  background: #0f172a;
  color: #e2e8f0;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.6;
}
.lumen-prose :deep(pre.lumen-code code) {
  background: transparent;
  padding: 0;
  color: inherit;
  font-size: inherit;
}

.lumen-prose :deep(table) {
  border-collapse: collapse;
  margin: 16px 0;
  width: 100%;
  font-size: 14px;
}
.lumen-prose :deep(th),
.lumen-prose :deep(td) {
  padding: 8px 14px;
  border: 1px solid var(--border, rgba(0, 0, 0, .1));
  text-align: left;
}
.lumen-prose :deep(th) {
  background: rgba(245, 158, 11, 0.06);
  font-weight: 700;
}

.lumen-prose :deep(hr) {
  border: none;
  border-top: 1px solid var(--border, rgba(0, 0, 0, .12));
  margin: 28px 0;
}

.lumen-prose :deep(img) {
  max-width: 100%;
  border-radius: 8px;
  margin: 16px 0;
  display: block;
}
</style>
