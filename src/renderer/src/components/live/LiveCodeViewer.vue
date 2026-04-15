/**
 * LiveCodeViewer : affichage read-only du code diffuse par le prof.
 * Utilise highlight.js pour la coloration syntaxique. Met a jour en temps reel
 * via l'event socket live:code-update.
 */
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { Code2, Copy, Check } from 'lucide-vue-next'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import sql from 'highlight.js/lib/languages/sql'
import { useToast } from '@/composables/useToast'

// Register languages
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('sql', sql)

const props = defineProps<{
  activityId: number
  initialContent?: string | null
  initialLanguage?: string | null
}>()

const { showToast } = useToast()

const content = ref(props.initialContent || '')
const language = ref(props.initialLanguage || 'plaintext')
const copied = ref(false)
let unsubscribe: (() => void) | null = null

const highlighted = computed(() => {
  if (!content.value) return ''
  try {
    if (language.value && hljs.getLanguage(language.value)) {
      return hljs.highlight(content.value, { language: language.value }).value
    }
    return hljs.highlightAuto(content.value).value
  } catch {
    // fallback : texte brut echappe
    return content.value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
})

async function copyCode() {
  await navigator.clipboard.writeText(content.value)
  copied.value = true
  showToast('Code copie !', 'success')
  setTimeout(() => { copied.value = false }, 1500)
}

onMounted(() => {
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
  <div class="lcv-wrap">
    <div class="lcv-toolbar">
      <Code2 :size="14" class="lcv-icon" />
      <span class="lcv-lang-badge">{{ language }}</span>
      <span class="lcv-live">
        <span class="lcv-dot" /> En direct
      </span>
      <button class="lcv-copy" :title="copied ? 'Copie !' : 'Copier'" @click="copyCode">
        <Check v-if="copied" :size="13" />
        <Copy v-else :size="13" />
      </button>
    </div>
    <pre class="lcv-code hljs"><code v-html="highlighted" /></pre>
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
  overflow: auto; background: var(--bg-main);
  color: var(--text-primary); white-space: pre-wrap; word-break: break-word;
}
.lcv-waiting {
  padding: 40px 20px; text-align: center;
  font-size: 13px; color: var(--text-muted); font-style: italic;
}
</style>
