<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Clock, List, ChevronLeft, ChevronRight, ArrowUp } from 'lucide-vue-next'
import { renderMarkdown, slugifyHeading } from '@/utils/markdown'
import { formatDate } from '@/utils/date'
import type { LumenCourse } from '@/types'
import LumenProjectPanel from '@/components/lumen/LumenProjectPanel.vue'
import LumenNotePanel from '@/components/lumen/LumenNotePanel.vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const isStudent = computed(() => !appStore.isTeacher)

interface Props {
  course: LumenCourse
  // Liste complete des cours publies de la promo pour la navigation prev/next.
  siblings?: LumenCourse[]
  // Deep link optionnel : propage au panneau projet pour auto-selection
  initialProjectFile?: string | null
}
interface Emits {
  (e: 'navigate', course: LumenCourse): void
  (e: 'back'): void
}

const props = withDefaults(defineProps<Props>(), { siblings: () => [], initialProjectFile: null })

// Raccourcis : Alt+← / Alt+→ pour naviguer entre cours publies de la promo
function onKeyboardNav(e: KeyboardEvent) {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
  if (e.key === 'ArrowLeft' && prevCourse.value) {
    e.preventDefault()
    emit('navigate', prevCourse.value)
  } else if (e.key === 'ArrowRight' && nextCourse.value) {
    e.preventDefault()
    emit('navigate', nextCourse.value)
  }
}
const emit = defineEmits<Emits>()

// ── Rendu HTML : on strip le h1 en tete (le titre du cours est deja
// affiche dans l'en-tete de lecture) pour eviter un double titre. ────────
const readerHtml = computed(() => {
  const raw = props.course.content ?? ''
  const stripped = raw.replace(/^\s*#\s+.+$/m, '').replace(/^\s*\n/, '')
  return renderMarkdown(stripped)
})

// ── Plan du cours (TOC) ───────────────────────────────────────────────────
interface TocEntry { level: number; text: string; id: string }
const toc = computed<TocEntry[]>(() => {
  const raw = props.course.content ?? ''
  const stripped = raw.replace(/^\s*#\s+.+$/m, '').replace(/^\s*\n/, '')
  const out: TocEntry[] = []
  const lines = stripped.split('\n')
  const seen = new Map<string, number>()
  let inCode = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      inCode = !inCode
      continue
    }
    if (inCode) continue
    const match = /^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/.exec(line)
    if (!match) continue
    const text = match[2].trim()
    let id = slugifyHeading(text)
    const count = seen.get(id) ?? 0
    seen.set(id, count + 1)
    if (count > 0) id = `${id}-${count}`
    out.push({ level: match[1].length, text, id })
  }
  return out
})

// ── Temps de lecture (hypothese 220 mots/minute) ──────────────────────────
const readingTime = computed(() => {
  const text = (props.course.content ?? '').replace(/[#*`_>\-[\]()]/g, '')
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 220))
})

// ── Progress bar : pourcentage de scroll dans l'article ──────────────────
const scrollRootRef = ref<HTMLElement | null>(null)
const progress = ref(0)

// Persistance de la position de scroll par cours : l'etudiant reprend
// la ou il etait quand il revient sur un cours deja lu. Debounce 300ms
// pour ne pas thrash localStorage pendant un scroll rapide.
const SCROLL_STORAGE_KEY = 'lumen:scroll:' // + courseId
let scrollPersistTimer: ReturnType<typeof setTimeout> | null = null

function persistScrollPosition() {
  if (scrollPersistTimer) clearTimeout(scrollPersistTimer)
  scrollPersistTimer = setTimeout(() => {
    try {
      const el = scrollRootRef.value
      if (!el || !props.course.id) return
      localStorage.setItem(`${SCROLL_STORAGE_KEY}${props.course.id}`, String(el.scrollTop))
    } catch { /* quota plein ou storage disabled, on ignore */ }
  }, 300)
}

function restoreScrollPosition() {
  try {
    const el = scrollRootRef.value
    if (!el || !props.course.id) return
    const stored = localStorage.getItem(`${SCROLL_STORAGE_KEY}${props.course.id}`)
    if (!stored) return
    const top = Number(stored)
    if (!Number.isFinite(top) || top < 20) return  // <20px = tete du cours, pas la peine
    // scrollBehavior auto : pas de scroll anime, on saute directement
    el.scrollTop = top
  } catch { /* no-op */ }
}

function updateProgress() {
  const el = scrollRootRef.value
  if (!el) return
  const max = el.scrollHeight - el.clientHeight
  progress.value = max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 1
  persistScrollPosition()
}

// ── Active section tracking : IntersectionObserver sur les headings ──────
const activeId = ref<string | null>(null)
let observer: IntersectionObserver | null = null

function setupObserver() {
  const root = scrollRootRef.value
  if (!root) return
  observer?.disconnect()
  const headings = root.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')
  if (headings.length === 0) {
    activeId.value = null
    return
  }
  observer = new IntersectionObserver(
    (entries) => {
      // Prend la plus haute section actuellement visible
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible.length > 0) {
        activeId.value = (visible[0].target as HTMLElement).id
      }
    },
    {
      root,
      rootMargin: '-72px 0px -70% 0px',
      threshold: 0,
    },
  )
  headings.forEach(h => observer!.observe(h))
  // Init : premier titre actif si rien visible encore
  if (!activeId.value && headings.length > 0) activeId.value = headings[0].id
}

function scrollToHeading(id: string) {
  const root = scrollRootRef.value
  if (!root) return
  const el = root.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
  if (!el) return
  // Offset pour tenir compte du sticky header interne
  const top = el.offsetTop - 48
  root.scrollTo({ top, behavior: 'smooth' })
  activeId.value = id
}

function scrollToTop() {
  scrollRootRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

// Re-setup quand le contenu du cours change
watch(() => props.course.id, async () => {
  activeId.value = null
  progress.value = 0
  await nextTick()
  restoreScrollPosition()
  updateProgress()
  setupObserver()
})

onMounted(async () => {
  await nextTick()
  restoreScrollPosition()
  updateProgress()
  setupObserver()
  window.addEventListener('keydown', onKeyboardNav)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('keydown', onKeyboardNav)
  if (scrollPersistTimer) clearTimeout(scrollPersistTimer)
})

// ── Prev / Next dans la liste de cours publies ────────────────────────────
const published = computed(() =>
  props.siblings.filter(c => c.status === 'published'),
)
const currentIndex = computed(() =>
  published.value.findIndex(c => c.id === props.course.id),
)
const prevCourse = computed(() =>
  currentIndex.value > 0 ? published.value[currentIndex.value - 1] : null,
)
const nextCourse = computed(() =>
  currentIndex.value >= 0 && currentIndex.value < published.value.length - 1
    ? published.value[currentIndex.value + 1]
    : null,
)
</script>

<template>
  <div class="reader-wrap">
    <!-- Progress bar globale (top) -->
    <div class="reader-progress" :style="{ transform: `scaleX(${progress})` }" aria-hidden="true" />

    <div
      ref="scrollRootRef"
      class="reader-scroll"
      @scroll.passive="updateProgress"
    >
      <div class="reader-grid">
        <!-- TOC sticky (desktop) -->
        <aside v-if="toc.length > 1" class="reader-toc" aria-label="Plan du cours">
          <div class="reader-toc-head">
            <List :size="12" />
            <span>Sur cette page</span>
          </div>
          <nav class="reader-toc-nav">
            <button
              v-for="h in toc"
              :key="h.id"
              type="button"
              class="reader-toc-item"
              :class="[
                `reader-toc-item--h${h.level}`,
                { 'reader-toc-item--active': activeId === h.id },
              ]"
              :title="h.text"
              @click="scrollToHeading(h.id)"
            >
              {{ h.text }}
            </button>
          </nav>
        </aside>

        <!-- Contenu du cours -->
        <article class="reader-article">
          <header class="reader-head">
            <h1 class="reader-title">{{ course.title }}</h1>
            <p v-if="course.summary" class="reader-summary">{{ course.summary }}</p>
            <div class="reader-meta">
              <span v-if="course.published_at" class="reader-meta-item">
                Publié le {{ formatDate(course.published_at) }}
              </span>
              <span class="reader-meta-sep" v-if="course.published_at">·</span>
              <span class="reader-meta-item">
                <Clock :size="13" />
                {{ readingTime }} min de lecture
              </span>
            </div>
          </header>

          <div class="reader-prose" v-html="readerHtml" />

          <!-- Projet d'exemple (si un snapshot existe) -->
          <LumenProjectPanel
            v-if="course.repo_snapshot_at"
            :course="course"
            :initial-file="initialProjectFile"
            class="reader-project"
          />

          <!-- Notes privees (etudiants uniquement, jamais pour les profs) -->
          <LumenNotePanel
            v-if="isStudent"
            :course-id="course.id"
          />

          <!-- Navigation prev / next -->
          <nav v-if="prevCourse || nextCourse" class="reader-nav" aria-label="Autres cours">
            <button
              v-if="prevCourse"
              type="button"
              class="reader-nav-btn reader-nav-btn--prev"
              @click="emit('navigate', prevCourse)"
            >
              <ChevronLeft :size="16" />
              <span class="reader-nav-btn-inner">
                <span class="reader-nav-label">Cours précédent</span>
                <span class="reader-nav-title">{{ prevCourse.title }}</span>
              </span>
            </button>
            <span v-else />
            <button
              v-if="nextCourse"
              type="button"
              class="reader-nav-btn reader-nav-btn--next"
              @click="emit('navigate', nextCourse)"
            >
              <span class="reader-nav-btn-inner">
                <span class="reader-nav-label">Cours suivant</span>
                <span class="reader-nav-title">{{ nextCourse.title }}</span>
              </span>
              <ChevronRight :size="16" />
            </button>
          </nav>
        </article>
      </div>
    </div>

    <!-- Back-to-top flottant -->
    <Transition name="reader-fade">
      <button
        v-if="progress > 0.15"
        type="button"
        class="reader-to-top"
        aria-label="Revenir en haut"
        title="Revenir en haut"
        @click="scrollToTop"
      >
        <ArrowUp :size="16" />
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.reader-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ── Progress bar ───────────────────────────────────────────────────────── */
.reader-progress {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent), var(--accent-hover, var(--accent)));
  transform-origin: 0 50%;
  transform: scaleX(0);
  transition: transform 120ms linear;
  z-index: 3;
  will-change: transform;
}

/* ── Scroll container ───────────────────────────────────────────────────── */
.reader-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
  scroll-padding-top: 48px;
}

.reader-grid {
  display: grid;
  grid-template-columns: 1fr;
  max-width: 1120px;
  margin: 0 auto;
  padding: 56px 32px 96px;
  gap: 48px;
}

@media (min-width: 1024px) {
  .reader-grid {
    grid-template-columns: 220px minmax(0, 1fr);
  }
}

/* ── TOC ────────────────────────────────────────────────────────────────── */
.reader-toc {
  display: none;
}
@media (min-width: 1024px) {
  .reader-toc {
    display: block;
    position: sticky;
    top: 48px;
    align-self: start;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
  }
}
.reader-toc-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  padding: 0 10px 10px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
.reader-toc-nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.reader-toc-item {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  border-left: 2px solid transparent;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-muted);
  padding: 5px 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 120ms ease;
}
.reader-toc-item:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
.reader-toc-item--active {
  color: var(--accent);
  border-left-color: var(--accent);
  font-weight: 600;
  background: var(--accent-subtle);
}
.reader-toc-item--h1 { font-weight: 600; color: var(--text-secondary); }
.reader-toc-item--h2 { padding-left: 20px; }
.reader-toc-item--h3 { padding-left: 30px; font-size: 12px; }
.reader-toc-item--h4,
.reader-toc-item--h5,
.reader-toc-item--h6 { padding-left: 40px; font-size: 12px; color: var(--text-muted); }

/* ── Article ────────────────────────────────────────────────────────────── */
.reader-article {
  max-width: 68ch;
  width: 100%;
  justify-self: start;
}

.reader-head {
  margin-bottom: 44px;
  padding-bottom: 28px;
  border-bottom: 1px solid var(--border);
}
.reader-title {
  font-size: clamp(28px, 4vw, 38px);
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -0.025em;
  margin: 0 0 16px;
  color: var(--text-primary);
}
.reader-summary {
  font-size: 17px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin: 0 0 18px;
  font-weight: 400;
}
.reader-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-muted);
}
.reader-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.reader-meta-sep { color: var(--text-muted); opacity: 0.5; }

/* ── Prose : typographie de lecture ────────────────────────────────────── */
.reader-prose {
  font-size: 16.5px;
  line-height: 1.75;
  color: var(--text-primary);
  word-wrap: break-word;
}
.reader-prose :deep(h1),
.reader-prose :deep(h2),
.reader-prose :deep(h3),
.reader-prose :deep(h4),
.reader-prose :deep(h5),
.reader-prose :deep(h6) {
  scroll-margin-top: 48px;
  color: var(--text-primary);
  letter-spacing: -0.015em;
}
.reader-prose :deep(h1) { font-size: 28px; font-weight: 800; margin: 40px 0 16px; }
.reader-prose :deep(h1):first-child { margin-top: 0; }
.reader-prose :deep(h2) {
  font-size: 22px; font-weight: 700;
  margin: 40px 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.reader-prose :deep(h3) { font-size: 18px; font-weight: 700; margin: 28px 0 12px; }
.reader-prose :deep(h4) { font-size: 16px; font-weight: 700; margin: 22px 0 10px; }
.reader-prose :deep(p) { margin: 0 0 18px; }
.reader-prose :deep(ul),
.reader-prose :deep(ol) { margin: 0 0 18px; padding-left: 26px; }
.reader-prose :deep(li) { margin: 6px 0; }
.reader-prose :deep(li > ul),
.reader-prose :deep(li > ol) { margin: 6px 0; }
.reader-prose :deep(a) {
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px solid var(--accent-subtle);
  transition: border-color 120ms ease;
}
.reader-prose :deep(a:hover) {
  border-bottom-color: var(--accent);
}
.reader-prose :deep(blockquote) {
  margin: 20px 0;
  padding: 12px 20px;
  border-left: 3px solid var(--accent);
  background: var(--accent-subtle);
  color: var(--text-secondary);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  font-style: italic;
}
.reader-prose :deep(blockquote > p:last-child) { margin-bottom: 0; }
.reader-prose :deep(code) {
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.88em;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background: var(--bg-elevated);
  border: 1px solid var(--border-input);
  color: var(--text-primary);
}
.reader-prose :deep(pre.lumen-code) {
  margin: 22px 0;
  padding: 16px 20px;
  border-radius: var(--radius);
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text-primary);
  overflow-x: auto;
  font-size: 13.5px;
  line-height: 1.6;
}
.reader-prose :deep(pre.lumen-code code) {
  background: transparent;
  border: none;
  padding: 0;
  color: inherit;
  font-size: inherit;
}
.reader-prose :deep(hr) {
  margin: 32px 0;
  border: none;
  border-top: 1px solid var(--border);
}
/* Admonitions Obsidian-style (> [!WARNING] etc.) */
.reader-prose :deep(.lumen-admonition) {
  margin: 20px 0;
  padding: 14px 18px;
  border-radius: var(--radius-sm);
  border-left: 4px solid;
  background: var(--bg-elevated);
}
.reader-prose :deep(.lumen-admonition-head) {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}
.reader-prose :deep(.lumen-admonition-icon) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
.reader-prose :deep(.lumen-admonition-icon svg) {
  width: 18px;
  height: 18px;
}
.reader-prose :deep(.lumen-admonition-body) {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
}
.reader-prose :deep(.lumen-admonition-body > *:first-child) { margin-top: 0; }
.reader-prose :deep(.lumen-admonition-body > *:last-child)  { margin-bottom: 0; }

.reader-prose :deep(.lumen-adm-note) {
  border-left-color: #4a90d9;
  background: rgba(74, 144, 217, 0.05);
}
.reader-prose :deep(.lumen-adm-note .lumen-admonition-head) { color: #4a90d9; }

.reader-prose :deep(.lumen-adm-tip) {
  border-left-color: #3fb76f;
  background: rgba(63, 183, 111, 0.05);
}
.reader-prose :deep(.lumen-adm-tip .lumen-admonition-head) { color: #3fb76f; }

.reader-prose :deep(.lumen-adm-warning) {
  border-left-color: #e6a700;
  background: rgba(230, 167, 0, 0.05);
}
.reader-prose :deep(.lumen-adm-warning .lumen-admonition-head) { color: #e6a700; }

.reader-prose :deep(.lumen-adm-danger) {
  border-left-color: #d9534f;
  background: rgba(217, 83, 79, 0.05);
}
.reader-prose :deep(.lumen-adm-danger .lumen-admonition-head) { color: #d9534f; }

/* Mots-cles pedagogiques (TODO/NOTE/WARNING) decorees par highlightKeywords */
.reader-prose :deep(.lumen-kw) {
  display: inline-block;
  padding: 0 6px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  font-size: 0.82em;
  font-weight: 800;
  letter-spacing: 0.04em;
}
.reader-prose :deep(.lumen-kw-todo) {
  background: rgba(217, 83, 79, 0.15);
  color: #d9534f;
}
.reader-prose :deep(.lumen-kw-warn) {
  background: rgba(230, 167, 0, 0.15);
  color: #e6a700;
}
.reader-prose :deep(.lumen-kw-note) {
  background: rgba(74, 144, 217, 0.15);
  color: #4a90d9;
}
.reader-prose :deep(.lumen-kw-tip) {
  background: rgba(63, 183, 111, 0.15);
  color: #3fb76f;
}
.reader-prose :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
  margin: 16px 0;
}
.reader-prose :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 20px 0;
  font-size: 14px;
}
.reader-prose :deep(th),
.reader-prose :deep(td) {
  padding: 8px 12px;
  border: 1px solid var(--border);
  text-align: left;
}
.reader-prose :deep(thead) {
  background: var(--bg-elevated);
}
.reader-prose :deep(th) {
  font-weight: 700;
  color: var(--text-primary);
}

/* ── Projet d'exemple ───────────────────────────────────────────────────── */
.reader-project {
  margin-top: 48px;
}

/* ── Prev / Next navigation ─────────────────────────────────────────────── */
.reader-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 56px;
  padding-top: 32px;
  border-top: 1px solid var(--border);
}
.reader-nav-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  cursor: pointer;
  color: var(--text-primary);
  text-align: left;
  font-family: inherit;
  transition: all 150ms ease;
}
.reader-nav-btn:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
  transform: translateY(-1px);
}
.reader-nav-btn--next {
  justify-content: flex-end;
  text-align: right;
}
.reader-nav-btn-inner {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.reader-nav-btn--next .reader-nav-btn-inner { align-items: flex-end; }
.reader-nav-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  font-weight: 600;
}
.reader-nav-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* ── Back-to-top ────────────────────────────────────────────────────────── */
.reader-to-top {
  position: absolute;
  right: 24px;
  bottom: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary);
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.15));
  transition: all 150ms ease;
  z-index: 4;
}
.reader-to-top:hover {
  color: var(--accent);
  border-color: var(--accent);
  transform: translateY(-2px);
}
.reader-fade-enter-active,
.reader-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.reader-fade-enter-from,
.reader-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (prefers-reduced-motion: reduce) {
  .reader-scroll,
  .reader-progress,
  .reader-nav-btn,
  .reader-to-top { transition: none !important; scroll-behavior: auto; }
}
</style>
