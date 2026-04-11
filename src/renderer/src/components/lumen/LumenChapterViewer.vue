<script setup lang="ts">
/**
 * Rendu d'un chapitre Markdown dans Lumen.
 * Le contenu est fetche par le parent et passe en prop. Le rendu utilise
 * utils/markdown (marked + highlight.js + DOMPurify + admonitions), enrichi
 * avec :
 *  - liens relatifs vers d'autres .md interceptes en navigation interne
 *  - liens http/https ouverts dans le navigateur systeme
 *  - copy button sur chaque bloc de code
 * v2.48 : l'accuse de lecture a ete supprime (plus de timer 3s). Ajout
 * du breadcrumbs, de la banner stale content, et du panneau Outline
 * auto-genere depuis les headings du DOM rendu.
 */
import { computed, onMounted, ref, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { Loader2, FileText, Clock, User, ChevronLeft, ChevronRight, Copy, Check, FolderGit2, ClipboardList, Plus, Calendar, RefreshCw, ChevronRight as CrumbSep, Presentation } from 'lucide-vue-next'
import { renderMarkdown } from '@/utils/markdown'
import { resolveAnchorTarget } from '@/utils/lumenDevoirLinks'
import { parseChapterContent } from '@/utils/lumenFrontmatter'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app'
import { relativeTime } from '@/utils/date'
import LumenLinkDevoirModal from '@/components/lumen/LumenLinkDevoirModal.vue'
import LumenOutline from '@/components/lumen/LumenOutline.vue'
import LumenSlideDeck from '@/components/lumen/LumenSlideDeck.vue'
import type { LumenChapter, LumenRepo, LumenLinkedTravail } from '@/types'

interface Props {
  repo: LumenRepo
  chapter: LumenChapter
  content: string | null
  loading: boolean
  prevChapter: LumenChapter | null
  nextChapter: LumenChapter | null
  cached?: boolean
  initialAnchor?: string | null
}
interface Emits {
  (e: 'navigate-chapter', path: string): void
  (e: 'navigate-prev'): void
  (e: 'navigate-next'): void
  (e: 'resync'): void
  (e: 'anchor-consumed'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { showToast } = useToast()
const router = useRouter()
const appStore = useAppStore()

const isTeacher = computed(() => appStore.currentUser?.type === 'teacher' || appStore.currentUser?.type === 'admin')

// ── Devoirs lies a ce chapitre ────────────────────────────────────────────
const linkedTravaux = ref<LumenLinkedTravail[]>([])
const linkedTravauxLoading = ref(false)
const linkDevoirModalOpen = ref(false)

async function loadLinkedTravaux() {
  if (!props.chapter?.path) return
  linkedTravauxLoading.value = true
  try {
    const resp = await window.api.getLumenTravauxForChapter(props.repo.id, props.chapter.path) as {
      ok: boolean
      data?: { travaux: LumenLinkedTravail[] }
    }
    linkedTravaux.value = resp?.ok && resp.data ? resp.data.travaux : []
  } finally {
    linkedTravauxLoading.value = false
  }
}

function openTravail(travail: LumenLinkedTravail) {
  // Navigation vers la vue devoir : on set le projet actif par category
  // et on route vers /devoirs qui affichera le projet contenant le devoir.
  if (travail.category) appStore.activeProject = travail.category
  router.push({ name: 'devoirs' })
}

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

// Detection Marp via frontmatter `marp: true`. Si detecte, on bascule sur
// LumenSlideDeck (rendu en slides) au lieu du rendu Markdown long-form.
const parsed = computed(() => parseChapterContent(props.content))
const isMarp = computed(() => parsed.value.isMarp)

const html = computed(() => {
  if (!props.content) return ''
  if (isMarp.value) return ''  // rendu via LumenSlideDeck, pas v-html
  return renderMarkdown(props.content, { chapterPath: props.chapter.path })
})

// ── Outline (plan du chapitre) + breadcrumbs + stale indicator ────────────

interface HeadingEntry {
  id: string
  text: string
  level: number
}

const headings = ref<HeadingEntry[]>([])
const outlineOpen = ref(true)

/**
 * Extrait les headings du DOM rendu pour alimenter l'outline. Les ids sont
 * deja dedupliques par injectHeadingIds (markdown.ts). On exclut les
 * headings imbriques dans une admonition (.lumen-admonition) pour eviter
 * de polluer le plan avec les titres des callouts (Note / Warning / etc.).
 */
function extractHeadings(root: HTMLElement): HeadingEntry[] {
  const nodes = root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
  const result: HeadingEntry[] = []
  nodes.forEach((el) => {
    if (!el.id) return
    if (el.closest('.lumen-admonition')) return
    result.push({
      id: el.id,
      text: el.textContent?.trim() ?? '',
      level: Number(el.tagName.slice(1)),
    })
  })
  return result
}

function scrollToHeading(id: string) {
  const el = bodyRef.value?.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// SQLite `datetime('now')` renvoie "YYYY-MM-DD HH:MM:SS" (separateur espace,
// sans timezone). Safari / WebKit retourne NaN sur `new Date("2026-04-11 15:30:00Z")`
// a cause du separateur non-ISO. Electron tourne sous Chromium donc ca marche
// mais on normalise quand meme pour la portabilite (web shim, tests Node).
function parseSqlTimestamp(raw: string | null): number | null {
  if (!raw) return null
  const iso = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const withTz = /Z|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z'
  const ts = new Date(withTz).getTime()
  return Number.isNaN(ts) ? null : ts
}

// Banner stale : true si on lit du cache OU si le repo n'a pas ete sync
// depuis plus d'une heure. Invite l'utilisateur a resync pour etre sur
// d'avoir la derniere version du chapitre.
const STALE_THRESHOLD_MS = 60 * 60 * 1000  // 1 heure
const isStaleContent = computed<boolean>(() => {
  if (props.cached) return true
  const syncedAt = parseSqlTimestamp(props.repo.lastSyncedAt)
  if (syncedAt === null) return false
  return Date.now() - syncedAt > STALE_THRESHOLD_MS
})

const staleRelative = computed(() => {
  const syncedAt = parseSqlTimestamp(props.repo.lastSyncedAt)
  if (syncedAt === null) return 'jamais'
  return relativeTime(syncedAt)
})

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

// Import dynamique de mermaid (~500kb) uniquement si un chapitre contient
// un schema. Le flag d'init est module-scope car mermaid est un singleton
// global partage entre toutes les instances du viewer.
let mermaidInitialized = false
async function renderMermaidBlocks(root: HTMLElement) {
  const blocks = root.querySelectorAll('pre.lumen-mermaid-src')
  if (!blocks.length) return
  try {
    const { default: mermaid } = await import('mermaid')
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'strict',
        fontFamily: 'inherit',
      })
      mermaidInitialized = true
    }
    let i = 0
    for (const pre of Array.from(blocks)) {
      const src = (pre as HTMLElement).textContent ?? ''
      const id = `lumen-mermaid-${Date.now()}-${i++}`
      try {
        const { svg } = await mermaid.render(id, src)
        const wrapper = document.createElement('div')
        wrapper.className = 'lumen-mermaid'
        wrapper.innerHTML = svg
        pre.replaceWith(wrapper)
      } catch (err) {
        const errBox = document.createElement('div')
        errBox.className = 'lumen-mermaid-error'
        errBox.textContent = `Schema Mermaid invalide : ${(err as Error).message}`
        pre.replaceWith(errBox)
      }
    }
  } catch {
    // mermaid indisponible : on laisse les pres en place (visibles comme texte)
  }
}

async function enrichRender() {
  await nextTick()
  // En mode Marp, le contenu est rendu par LumenSlideDeck — pas de bodyRef
  // a enrichir, pas de headings, pas de mermaid, pas d'ancres a scroller.
  if (isMarp.value) {
    headings.value = []
    return
  }
  if (!bodyRef.value) return
  injectCopyButtons(bodyRef.value)
  headings.value = extractHeadings(bodyRef.value)
  // Scroll en premier pour eviter que l'utilisateur voie un saut de layout
  // apres que mermaid remplace les <pre> par des SVG plus grands.
  // Si une ancre est fournie via le deep-link (ex: ouverture depuis un
  // devoir avec ?anchor=section-machin), on scrolle directement a la
  // section correspondante au lieu du top du chapitre.
  const targetAnchor = resolveAnchorTarget(
    props.initialAnchor ?? null,
    headings.value.map((h) => h.id),
  )
  if (targetAnchor) {
    scrollToHeading(targetAnchor)
    emit('anchor-consumed')
  } else if (bodyRef.value.scrollTo) {
    bodyRef.value.scrollTo({ top: 0 })
  }
  renderMermaidBlocks(bodyRef.value).catch(() => { /* deja gere par bloc */ })
}

onMounted(() => {
  enrichRender()
  loadLinkedTravaux()
})
watch(() => [props.content, props.chapter?.path], () => {
  enrichRender()
  loadLinkedTravaux()
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
        <span v-if="isMarp" class="lumen-viewer-chip lumen-viewer-chip--marp">
          <Presentation :size="11" /> Slides
        </span>
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
      </div>
      <!-- Breadcrumbs : orientation rapide via project / section / chapitre -->
      <nav class="lumen-breadcrumbs" aria-label="Fil d'ariane">
        <span class="lumen-breadcrumbs-seg">{{ repo.manifest?.project ?? repo.fullName }}</span>
        <CrumbSep v-if="chapter.section" :size="10" class="lumen-breadcrumbs-sep" />
        <span v-if="chapter.section" class="lumen-breadcrumbs-seg">{{ chapter.section }}</span>
        <CrumbSep :size="10" class="lumen-breadcrumbs-sep" />
        <span class="lumen-breadcrumbs-seg lumen-breadcrumbs-current">{{ chapter.title }}</span>
      </nav>
    </header>

    <!-- Banner stale : contenu potentiellement obsolete (cache > 1h ou lecture
         depuis cache offline). Un clic declenche un resync de la promo. -->
    <div v-if="isStaleContent && !loading && content" class="lumen-stale-banner">
      <Clock :size="12" />
      <span>Contenu potentiellement obsolete — derniere synchronisation {{ staleRelative }}</span>
      <button type="button" class="lumen-stale-refresh" @click="emit('resync')">
        <RefreshCw :size="11" /> Resynchroniser
      </button>
    </div>

    <div v-if="loading" class="lumen-viewer-loading">
      <Loader2 :size="20" class="spin" />
      Chargement du chapitre...
    </div>
    <div v-else-if="!content" class="lumen-viewer-empty">
      <FileText :size="32" />
      <p>Contenu indisponible</p>
    </div>
    <template v-else>
      <!-- Rendu Marp : slide deck dedie quand `marp: true` dans la frontmatter -->
      <div v-if="isMarp" class="lumen-viewer-main lumen-viewer-main--slides">
        <LumenSlideDeck :source="content ?? ''" :title="chapter.title" />
      </div>

      <!-- Rendu Markdown standard sinon -->
      <div v-else class="lumen-viewer-main">
        <div
          ref="bodyRef"
          class="lumen-viewer-body markdown-body"
          @click="handleBodyClick"
          v-html="html"
        />
        <LumenOutline
          v-if="headings.length > 0"
          :headings="headings"
          :collapsed="!outlineOpen"
          @toggle="outlineOpen = !outlineOpen"
          @navigate="scrollToHeading"
        />
      </div>

      <!-- Devoirs lies a ce chapitre : toujours visible s'il y en a,
           + bouton "Lier un devoir" pour le teacher meme si vide -->
      <section
        v-if="linkedTravaux.length > 0 || isTeacher"
        class="lumen-linked-travaux"
      >
        <header class="llt-head">
          <div class="llt-title">
            <ClipboardList :size="13" />
            <span>Devoirs lies</span>
            <span v-if="linkedTravaux.length" class="llt-count">{{ linkedTravaux.length }}</span>
          </div>
          <button
            v-if="isTeacher"
            type="button"
            class="llt-link-btn"
            @click="linkDevoirModalOpen = true"
          >
            <Plus :size="12" />
            Lier un devoir
          </button>
        </header>
        <ul v-if="linkedTravaux.length > 0" class="llt-list">
          <li v-for="t in linkedTravaux" :key="t.id">
            <button type="button" class="llt-item" @click="openTravail(t)">
              <span class="llt-item-title">{{ t.title }}</span>
              <span v-if="t.category" class="llt-item-cat">{{ t.category }}</span>
              <span v-if="t.deadline" class="llt-item-deadline">
                <Calendar :size="10" /> {{ relativeTime(t.deadline) }}
              </span>
            </button>
          </li>
        </ul>
        <p v-else-if="isTeacher" class="llt-empty">
          Ce chapitre n'est encore lie a aucun devoir. Lie-le pour que les etudiants voient le lien depuis leur vue devoir.
        </p>
      </section>

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

    <LumenLinkDevoirModal
      v-if="linkDevoirModalOpen && isTeacher"
      :repo-id="repo.id"
      :chapter-path="chapter.path"
      :chapter-title="chapter.title"
      :promo-id="repo.promoId"
      @close="linkDevoirModalOpen = false"
      @changed="loadLinkedTravaux"
    />
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
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out);
}
button.lumen-viewer-chip:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.lumen-viewer-chip--link {
  color: var(--accent);
  border-color: var(--accent);
}
.lumen-viewer-chip--link:hover {
  background: var(--accent);
  color: white;
}
.lumen-viewer-chip--marp {
  color: var(--accent);
  background: rgba(var(--accent-rgb), .12);
  border-color: rgba(var(--accent-rgb), .25);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
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

/* Wrapper flex : body markdown a gauche, outline a droite. Prend toute
   la hauteur dispo, le body scroll verticalement independamment. */
.lumen-viewer-main {
  flex: 1;
  display: flex;
  flex-direction: row;
  min-height: 0;
  overflow: hidden;
}
.lumen-viewer-main--slides {
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow-y: auto;
  padding: var(--space-md) var(--space-lg);
}

.lumen-viewer-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 48px 16px;
  max-width: 820px;
  width: 100%;
  margin: 0 auto;
}

/* Breadcrumbs : fil d'ariane discret sous la meta du header */
.lumen-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 10.5px;
  color: var(--text-muted);
  flex-wrap: wrap;
}
.lumen-breadcrumbs-seg {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
}
.lumen-breadcrumbs-current {
  color: var(--text-secondary);
  font-weight: 600;
  max-width: 420px;
}
.lumen-breadcrumbs-sep {
  color: var(--text-muted);
  opacity: 0.6;
  flex-shrink: 0;
}

/* Banner stale content : visible quand le contenu vient du cache ou est
   plus vieux que 1h. Non dismissable : incite au resync. */
.lumen-stale-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 48px 0;
  padding: 6px 12px;
  background: rgba(217, 138, 0, 0.09);
  border: 1px solid rgba(217, 138, 0, 0.3);
  border-radius: 6px;
  font-size: 11px;
  color: var(--warning, #d98a00);
  flex-shrink: 0;
}
.lumen-stale-banner svg { flex-shrink: 0; }
.lumen-stale-refresh {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 4px;
  color: inherit;
  font-family: inherit;
  font-size: 10.5px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
}
.lumen-stale-refresh:hover { background: rgba(217, 138, 0, 0.12); }

/* Footer "Devoirs lies" sous le contenu markdown */
.lumen-linked-travaux {
  max-width: 820px;
  width: 100%;
  margin: 0 auto;
  padding: 16px 48px 0;
  flex-shrink: 0;
}
.llt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.llt-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.llt-count {
  background: var(--bg-secondary);
  color: var(--text-muted);
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-transform: none;
  letter-spacing: 0;
}
.llt-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}
.llt-link-btn:hover { opacity: 0.9; }
.llt-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.llt-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: all var(--t-fast, 150ms) ease;
}
.llt-item:hover {
  border-color: var(--accent);
  background: var(--bg-hover);
}
.llt-item-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.llt-item-cat {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-primary);
  padding: 1px 6px;
  border-radius: 8px;
  flex-shrink: 0;
}
.llt-item-deadline {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.llt-empty {
  margin: 0;
  padding: 12px 14px;
  font-size: 11.5px;
  color: var(--text-muted);
  background: var(--bg-secondary);
  border: 1px dashed var(--border);
  border-radius: 6px;
  line-height: 1.5;
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
/* ── Wrapper de bloc de code avec header (badge langue) ────────────────── */
.lumen-viewer .markdown-body .lumen-codeblock {
  margin: 16px 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: #282c34; /* atom-one-dark base */
}
.lumen-viewer .markdown-body .lumen-codeblock-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.lumen-viewer .markdown-body .lumen-codeblock-lang {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.55);
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
}
.lumen-viewer .markdown-body .lumen-codeblock pre.lumen-code {
  margin: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  padding: 14px 16px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.55;
}
.lumen-viewer .markdown-body .lumen-codeblock pre.lumen-code code {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 13px;
}

/* ── Mermaid : SVG centre avec fond doux ──────────────────────────────── */
.lumen-viewer .markdown-body .lumen-mermaid {
  display: flex;
  justify-content: center;
  padding: 16px;
  margin: 16px 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow-x: auto;
}
.lumen-viewer .markdown-body .lumen-mermaid svg {
  max-width: 100%;
  height: auto;
}
.lumen-viewer .markdown-body .lumen-mermaid-error {
  padding: 12px 14px;
  margin: 16px 0;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: var(--danger, #ef4444);
  font-size: 12px;
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  white-space: pre-wrap;
}

/* ── KaTeX : display math centre, inline dans le flux ─────────────────── */
.lumen-viewer .markdown-body .katex-display {
  margin: 18px 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 0;
}
.lumen-viewer .markdown-body .katex {
  font-size: 1.05em;
}
.lumen-viewer .markdown-body .lumen-math-error {
  color: var(--danger, #ef4444);
  background: rgba(239, 68, 68, 0.1);
  padding: 1px 5px;
  border-radius: 3px;
}

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
