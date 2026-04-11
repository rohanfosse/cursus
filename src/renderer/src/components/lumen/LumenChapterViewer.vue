<script setup lang="ts">
/**
 * Rendu d'un chapitre Markdown dans Lumen.
 * Le contenu est fetche par le parent et passe en prop. Le rendu utilise
 * utils/markdown (marked + highlight.js + DOMPurify + admonitions), enrichi
 * avec :
 *  - liens relatifs vers d'autres .md interceptes en navigation interne
 *  - liens http/https ouverts dans le navigateur systeme
 *  - copy button sur chaque bloc de code
 * Auto-marque comme lu au bout de 3 secondes d'affichage visible.
 */
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Loader2, FileText, Clock, User, ChevronLeft, ChevronRight, Copy, Check, FolderGit2 } from 'lucide-vue-next'
import { renderMarkdown } from '@/utils/markdown'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app'
import type { LumenChapter, LumenRepo } from '@/types'

interface Props {
  repo: LumenRepo
  chapter: LumenChapter
  content: string | null
  loading: boolean
  isRead: boolean
  prevChapter: LumenChapter | null
  nextChapter: LumenChapter | null
}
interface Emits {
  (e: 'read'): void
  (e: 'navigate-chapter', path: string): void
  (e: 'navigate-prev'): void
  (e: 'navigate-next'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { showToast } = useToast()
const router = useRouter()
const appStore = useAppStore()

/**
 * Clic sur le chip projet dans le header : set le projet actif de Cursus
 * (pattern legacy ou les projets sont identifies par nom string) puis
 * route vers /devoirs. L'utilisateur atterrit sur la vue du projet qui
 * contient elle-meme LumenProjectSection — boucle fermee.
 */
function navigateToProject() {
  if (!props.repo.projectName) return
  appStore.activeProject = props.repo.projectName
  router.push({ name: 'devoirs' })
}

const bodyRef = ref<HTMLElement | null>(null)

const html = computed(() => {
  if (!props.content) return ''
  return renderMarkdown(props.content, { chapterPath: props.chapter.path })
})

// ── Auto mark-as-read ──────────────────────────────────────────────────────

let readTimer: ReturnType<typeof setTimeout> | null = null

function scheduleAutoRead() {
  if (readTimer) clearTimeout(readTimer)
  if (props.isRead || !props.content) return
  readTimer = setTimeout(() => emit('read'), 3000)
}

// ── Enrichissement post-render (copy buttons + click handlers) ────────────

function injectCopyButtons(root: HTMLElement) {
  const blocks = root.querySelectorAll('pre.lumen-code')
  blocks.forEach((pre) => {
    if ((pre as HTMLElement).querySelector('.lumen-copy-btn')) return
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'lumen-copy-btn'
    btn.title = 'Copier le code'
    btn.setAttribute('aria-label', 'Copier le code')
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const code = (pre as HTMLElement).querySelector('code')?.innerText ?? ''
      try {
        await navigator.clipboard.writeText(code)
        btn.classList.add('copied')
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
        setTimeout(() => {
          btn.classList.remove('copied')
          btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
        }, 1500)
      } catch {
        showToast('Copie impossible', 'error')
      }
    })
    pre.appendChild(btn)
  })
}

function handleBodyClick(e: MouseEvent) {
  const target = (e.target as HTMLElement)?.closest('a') as HTMLAnchorElement | null
  if (!target) return

  const chapterLink = target.getAttribute('data-chapter-link')
  if (chapterLink) {
    e.preventDefault()
    emit('navigate-chapter', chapterLink)
    return
  }
  if (target.getAttribute('data-external')) {
    e.preventDefault()
    const href = target.getAttribute('href')
    if (href) window.api?.openPath?.(href)
    return
  }
}

async function enrichRender() {
  await nextTick()
  if (!bodyRef.value) return
  injectCopyButtons(bodyRef.value)
  if (bodyRef.value.scrollTo) bodyRef.value.scrollTo({ top: 0 })
}

onMounted(() => {
  scheduleAutoRead()
  enrichRender()
})
watch(() => [props.content, props.chapter?.path], () => {
  scheduleAutoRead()
  enrichRender()
})
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
        <button
          v-if="repo.projectName"
          type="button"
          class="lumen-viewer-chip lumen-viewer-chip--link"
          :title="`Aller au projet Cursus : ${repo.projectName}`"
          @click="navigateToProject"
        >
          <FolderGit2 :size="11" /> {{ repo.projectName }}
        </button>
        <span v-if="chapter.duration" class="lumen-viewer-chip">
          <Clock :size="11" /> {{ chapter.duration }} min
        </span>
        <span v-if="repo.manifest?.author" class="lumen-viewer-chip">
          <User :size="11" /> {{ repo.manifest.author }}
        </span>
        <span v-if="isRead" class="lumen-viewer-chip read">
          <Check :size="11" /> Lu
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
    <template v-else>
      <div
        ref="bodyRef"
        class="lumen-viewer-body markdown-body"
        @click="handleBodyClick"
        v-html="html"
      />
      <footer class="lumen-viewer-nav">
        <button
          type="button"
          class="lumen-nav-btn"
          :disabled="!prevChapter"
          :aria-label="prevChapter ? `Chapitre precedent : ${prevChapter.title}` : 'Aucun chapitre precedent'"
          @click="emit('navigate-prev')"
        >
          <ChevronLeft :size="14" />
          <span class="lumen-nav-label">
            <span class="lumen-nav-direction">Precedent</span>
            <span v-if="prevChapter" class="lumen-nav-title">{{ prevChapter.title }}</span>
          </span>
        </button>
        <button
          type="button"
          class="lumen-nav-btn next"
          :disabled="!nextChapter"
          :aria-label="nextChapter ? `Chapitre suivant : ${nextChapter.title}` : 'Aucun chapitre suivant'"
          @click="emit('navigate-next')"
        >
          <span class="lumen-nav-label">
            <span class="lumen-nav-direction">Suivant</span>
            <span v-if="nextChapter" class="lumen-nav-title">{{ nextChapter.title }}</span>
          </span>
          <ChevronRight :size="14" />
        </button>
      </footer>
    </template>
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
.lumen-viewer-chip.read {
  color: var(--success, #4caf50);
  border-color: var(--success, #4caf50);
}

button.lumen-viewer-chip {
  font-family: inherit;
  cursor: pointer;
  transition: all var(--t-fast, 150ms) ease;
}
.lumen-viewer-chip--link {
  color: var(--accent);
  border-color: var(--accent);
}
.lumen-viewer-chip--link:hover {
  background: var(--accent);
  color: white;
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
  padding: 24px 48px 16px;
  max-width: 820px;
  width: 100%;
  margin: 0 auto;
}

/* Navigation bas-de-page (prev/next chapitre) */
.lumen-viewer-nav {
  display: flex;
  gap: 12px;
  padding: 16px 48px 24px;
  border-top: 1px solid var(--border);
  max-width: 820px;
  width: 100%;
  margin: 0 auto;
  flex-shrink: 0;
}
.lumen-nav-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: all var(--t-fast, 150ms) ease;
  min-height: 52px;
}
.lumen-nav-btn:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--accent);
}
.lumen-nav-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.lumen-nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.lumen-nav-btn.next {
  flex-direction: row-reverse;
  text-align: right;
}
.lumen-nav-label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.lumen-nav-direction {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.lumen-nav-title {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

<!-- Styles globaux additionnels pour le body markdown : copy button injecte dynamiquement -->
<style>
.lumen-viewer .markdown-body pre.lumen-code {
  position: relative;
}
.lumen-viewer .markdown-body .lumen-copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all 150ms ease;
  padding: 0;
}
.lumen-viewer .markdown-body pre.lumen-code:hover .lumen-copy-btn,
.lumen-viewer .markdown-body .lumen-copy-btn:focus-visible {
  opacity: 1;
}
.lumen-viewer .markdown-body .lumen-copy-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
.lumen-viewer .markdown-body .lumen-copy-btn.copied {
  opacity: 1;
  color: var(--success, #4caf50);
  border-color: var(--success, #4caf50);
}
.lumen-viewer .markdown-body .lumen-copy-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
</style>
