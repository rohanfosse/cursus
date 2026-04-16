/**
 * LiveCodeViewer : affichage read-only du code diffuse par le prof.
 * Utilise highlight.js pour la coloration syntaxique. Met a jour en temps reel
 * via l'event socket live:code-update.
 */
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { Code2, Copy, Check, Maximize2, Minimize2 } from 'lucide-vue-next'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import sql from 'highlight.js/lib/languages/sql'
import markdown from 'highlight.js/lib/languages/markdown'
import json from 'highlight.js/lib/languages/json'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import DOMPurify from 'dompurify'
import { useToast } from '@/composables/useToast'

// Register languages
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)
hljs.registerLanguage('json', json)
hljs.registerLanguage('java', java)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('c', cpp)

const props = defineProps<{
  activityId: number
  initialContent?: string | null
  initialLanguage?: string | null
  /** Preview mode : n'abonne pas aux updates socket (evite les mutations cross-pane). */
  preview?: boolean
}>()

const { showToast } = useToast()

const content = ref(props.initialContent || '')
const language = ref(props.initialLanguage || 'plaintext')
const copied = ref(false)
const fullscreen = ref(false)
function toggleFullscreen() { fullscreen.value = !fullscreen.value }
let unsubscribe: (() => void) | null = null

const lineCount = computed(() => content.value ? content.value.split('\n').length : 0)

const highlighted = computed(() => {
  if (!content.value) return ''
  try {
    let raw: string
    if (language.value && hljs.getLanguage(language.value)) {
      raw = hljs.highlight(content.value, { language: language.value }).value
    } else {
      raw = hljs.highlightAuto(content.value).value
    }
    return DOMPurify.sanitize(raw, { ALLOW_DATA_ATTR: false })
  } catch {
    return DOMPurify.sanitize(
      content.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    )
  }
})

async function copyCode() {
  try {
    await navigator.clipboard.writeText(content.value)
    copied.value = true
    showToast('Code copie !', 'success')
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    showToast('Impossible de copier', 'error')
  }
}

onMounted(() => {
  if (props.preview) return
  unsubscribe = window.api.onLiveCodeUpdate((data) => {
    if (data.activityId === props.activityId) {
      content.value = data.content
      if (data.language) language.value = data.language
    }
  })
})

onBeforeUnmount(() => {
  unsubscribe?.()
})

watch(() => props.activityId, () => {
  content.value = props.initialContent || ''
  language.value = props.initialLanguage || 'plaintext'
})
</script>

<template>
  <div class="lcv-wrap" :class="{ 'lcv-fullscreen': fullscreen }">
    <div class="lcv-toolbar">
      <Code2 :size="14" class="lcv-icon" />
      <span class="lcv-lang-badge">{{ language }}</span>
      <span class="lcv-live">
        <span class="lcv-dot" /> En direct
      </span>
      <span v-if="lineCount > 0" class="lcv-lines">{{ lineCount }} ligne{{ lineCount > 1 ? 's' : '' }}</span>
      <button class="lcv-copy" :title="copied ? 'Copie !' : 'Copier'" @click="copyCode">
        <Check v-if="copied" :size="13" />
        <Copy v-else :size="13" />
      </button>
      <button class="lcv-copy" :title="fullscreen ? 'Quitter plein ecran' : 'Plein ecran'" @click="toggleFullscreen">
        <Minimize2 v-if="fullscreen" :size="13" />
        <Maximize2 v-else :size="13" />
      </button>
    </div>
    <pre class="lcv-code hljs"><code class="lcv-code-inner" v-html="highlighted" /></pre>
    <div v-if="!content" class="lcv-waiting">
      En attente que le prof commence a ecrire...
    </div>
  </div>
</template>

<style scoped>
.lcv-wrap {
  display: flex; flex-direction: column;
  border: 1px solid var(--border); border-radius: 10px;
  overflow: hidden; background: var(--bg-sidebar);
  min-height: 400px;
}
.lcv-wrap.lcv-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1000;
  border-radius: 0;
  border: none;
  min-height: 100vh;
}
.lcv-toolbar {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border-bottom: 1px solid var(--border);
  background: var(--bg-elevated); flex-shrink: 0;
}
.lcv-icon { color: var(--accent); flex-shrink: 0; }
.lcv-lang-badge {
  font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .5px; padding: 2px 8px; border-radius: 10px;
  background: rgba(74,144,217,.15); color: var(--accent);
}
.lcv-live {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 600; color: var(--color-success);
  padding: 2px 8px; border-radius: 10px;
  background: rgba(39,174,96,.1); margin-left: auto;
}
.lcv-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--color-success); animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: .4 } }
.lcv-lines { font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.lcv-copy {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); cursor: pointer; transition: all .15s;
}
.lcv-copy:hover { color: var(--accent); border-color: var(--accent); }

.lcv-code {
  flex: 1; margin: 0; padding: 16px;
  font-family: Menlo, Monaco, Consolas, monospace;
  font-size: 13px; line-height: 1.6;
  overflow: auto; background: #1e1e2e;
  color: #cdd6f4; white-space: pre-wrap; word-break: break-word;
}
.lcv-code-inner { transition: opacity .15s ease; }
.lcv-waiting {
  padding: 40px 20px; text-align: center;
  font-size: 13px; color: var(--text-muted); font-style: italic;
}
</style>
