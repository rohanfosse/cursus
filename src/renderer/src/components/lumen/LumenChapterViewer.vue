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
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
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
// Popover "devoirs lies" : ferme par defaut pour ne pas encombrer la lecture.
// L'utilisateur l'ouvre via un chip dans le header. Auto-fermeture sur Esc
// et au clic exterieur.
const linkedPopoverOpen = ref(false)
const linkedPopoverRef = ref<HTMLElement | null>(null)
function toggleLinkedPopover(): void {
  linkedPopoverOpen.value = !linkedPopoverOpen.value
}
function closeLinkedPopover(): void {
  linkedPopoverOpen.value = false
}
function onDocumentClick(ev: MouseEvent): void {
  if (!linkedPopoverOpen.value) return
  const target = ev.target as Node | null
  if (linkedPopoverRef.value && target && !linkedPopoverRef.value.contains(target)) {
    linkedPopoverOpen.value = false
  }
}
function onDocumentKey(ev: KeyboardEvent): void {
  if (ev.key === 'Escape' && linkedPopoverOpen.value) {
    linkedPopoverOpen.value = false
  }
}

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

// Detection du format de chapitre (v2.64). Le `kind` peut venir du manifest
// (auto-manifest le pose, cursus.yaml peut le surcharger), sinon on infere
// depuis l'extension du path. Branches de rendu :
//  - pdf : iframe data: URL (PDF natif)
//  - tex : source LaTeX colorisee via highlight.js
//  - markdown : rendu standard, ou Marp si frontmatter `marp: true`
function inferKindFromPath(path: string): 'markdown' | 'pdf' | 'tex' {
  const m = path.match(/\.([^./]+)$/)
  const ext = m ? m[1].toLowerCase() : ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'tex') return 'tex'
  return 'markdown'
}
const chapterKind = computed<'markdown' | 'pdf' | 'tex'>(() => {
  return props.chapter.kind ?? inferKindFromPath(props.chapter.path)
})
const isPdf = computed(() => chapterKind.value === 'pdf')
const isTex = computed(() => chapterKind.value === 'tex')

// Detection Marp via frontmatter `marp: true`. Si detecte, on bascule sur
// LumenSlideDeck (rendu en slides) au lieu du rendu Markdown long-form.
// Marp ne s'applique qu'aux chapitres markdown — un .pdf ou .tex ne peut
// pas avoir de frontmatter Marp.
const parsed = computed(() =>
  chapterKind.value === 'markdown' ? parseChapterContent(props.content) : { frontmatter: {}, body: '', isMarp: false },
)
const isMarp = computed(() => parsed.value.isMarp)

const html = computed(() => {
  if (!props.content) return ''
  if (isPdf.value || isTex.value) return ''  // rendu dedie, pas v-html
  if (isMarp.value) return ''                // rendu via LumenSlideDeck
  return renderMarkdown(props.content, { chapterPath: props.chapter.path })
})

// Pour les .tex : on rend le source via highlight.js (mode latex). On
// reutilise le pipeline markdown + un fenced block ```latex pour beneficier
// du wrapper .lumen-codeblock standard (header + scroll + theming).
const texHtml = computed(() => {
  if (!isTex.value || !props.content) return ''
  const fenced = '```latex\n' + props.content + '\n```'
  return renderMarkdown(fenced, { chapterPath: props.chapter.path })
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

// Icones SVG du bouton copier (constants pour eviter de re-allouer une string
// par bloc et garder le code injecte concis).
const COPY_ICON_DEFAULT = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
const COPY_ICON_DONE = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

/**
 * Injecte un bouton "Copier" dans le header de chaque .lumen-codeblock,
 * a cote du label de langue. Le bouton est TOUJOURS visible (plus de
 * hover-only) pour faciliter la copie sur tablette et mieux signaler
 * l'affordance dans un contexte pedagogique (l'etudiant doit pouvoir
 * copier le code rapidement pour le coller dans son IDE).
 */
function injectCopyButtons(root: HTMLElement) {
  const blocks = root.querySelectorAll<HTMLElement>('.lumen-codeblock')
  blocks.forEach((block) => {
    const header = block.querySelector<HTMLElement>('.lumen-codeblock-header')
    const pre = block.querySelector<HTMLElement>('pre.lumen-code')
    if (!header || !pre) return
    if (header.querySelector('.lumen-copy-btn')) return

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'lumen-copy-btn'
    btn.title = 'Copier le code'
    btn.setAttribute('aria-label', 'Copier le code')
    btn.innerHTML = `${COPY_ICON_DEFAULT}<span class="lumen-copy-label">Copier</span>`

    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const code = pre.querySelector('code')?.innerText ?? ''
      try {
        await navigator.clipboard.writeText(code)
        btn.classList.add('copied')
        btn.innerHTML = `${COPY_ICON_DONE}<span class="lumen-copy-label">Copie</span>`
        setTimeout(() => {
          btn.classList.remove('copied')
          btn.innerHTML = `${COPY_ICON_DEFAULT}<span class="lumen-copy-label">Copier</span>`
        }, 1500)
      } catch {
        showToast('Copie impossible', 'error')
      }
    })
    header.appendChild(btn)
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
  // En mode PDF, le contenu est un iframe — rien a enrichir cote markdown.
  // En mode Marp, le contenu est rendu par LumenSlideDeck — pas de bodyRef.
  // En mode TeX, on rend un seul fenced block, pas de headings ni d'ancres.
  if (isPdf.value || isMarp.value || isTex.value) {
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
  document.addEventListener('mousedown', onDocumentClick)
  document.addEventListener('keydown', onDocumentKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKey)
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

        <!-- Devoirs lies : chip + popover. Cache par defaut, accessible via clic. -->
        <div
          v-if="linkedTravaux.length > 0 || isTeacher"
          ref="linkedPopoverRef"
          class="lumen-linked-popover-wrap"
        >
          <button
            type="button"
            class="lumen-viewer-chip lumen-viewer-chip--link"
            :class="{ active: linkedPopoverOpen }"
            :aria-expanded="linkedPopoverOpen"
            :title="linkedTravaux.length ? `${linkedTravaux.length} devoir(s) lie(s)` : 'Aucun devoir lie'"
            @click="toggleLinkedPopover"
          >
            <ClipboardList :size="11" />
            <span>Devoirs</span>
            <span v-if="linkedTravaux.length" class="llt-count">{{ linkedTravaux.length }}</span>
          </button>
          <div v-if="linkedPopoverOpen" class="lumen-linked-popover" role="dialog" aria-label="Devoirs lies a ce chapitre">
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
                @click="linkDevoirModalOpen = true; closeLinkedPopover()"
              >
                <Plus :size="12" />
                Lier
              </button>
            </header>
            <ul v-if="linkedTravaux.length > 0" class="llt-list">
              <li v-for="t in linkedTravaux" :key="t.id">
                <button type="button" class="llt-item" @click="openTravail(t); closeLinkedPopover()">
                  <span class="llt-item-title">{{ t.title }}</span>
                  <span v-if="t.category" class="llt-item-cat">{{ t.category }}</span>
                  <span v-if="t.deadline" class="llt-item-deadline">
                    <Calendar :size="10" /> {{ relativeTime(t.deadline) }}
                  </span>
                </button>
              </li>
            </ul>
            <p v-else-if="isTeacher" class="llt-empty">
              Ce chapitre n'est encore lie a aucun devoir.
            </p>
          </div>
        </div>
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
      <!-- Rendu PDF natif : iframe data: URL fetchee depuis le serveur (v2.64) -->
      <div v-if="isPdf" class="lumen-viewer-main lumen-viewer-main--pdf">
        <iframe
          :src="content ?? ''"
          class="lumen-pdf-frame"
          :title="chapter.title"
        />
      </div>

      <!-- Rendu source LaTeX : code block colorise via highlight.js (v2.64) -->
      <div v-else-if="isTex" class="lumen-viewer-main lumen-viewer-main--tex">
        <div class="lumen-viewer-body markdown-body" v-html="texHtml" />
      </div>

      <!-- Rendu Marp : slide deck dedie quand `marp: true` dans la frontmatter -->
      <div v-else-if="isMarp" class="lumen-viewer-main lumen-viewer-main--slides">
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

      <!-- Navigation prev/next : 2 boutons flottants en bordures du contenu.
           Apparaissent au hover du viewer, gardent l'espace disponible pour
           le contenu en permanence (cf. demande utilisateur v2.61). -->
      <div v-if="!isMarp && !isPdf && (prevChapter || nextChapter)" class="lumen-floating-nav">
        <button
          v-if="prevChapter"
          type="button"
          class="lumen-floating-nav-btn lumen-floating-nav-btn--prev"
          :title="`Precedent : ${prevChapter.title}`"
          :aria-label="`Chapitre precedent : ${prevChapter.title}`"
          @click="emit('navigate-prev')"
        >
          <ChevronLeft :size="18" />
        </button>
        <button
          v-if="nextChapter"
          type="button"
          class="lumen-floating-nav-btn lumen-floating-nav-btn--next"
          :title="`Suivant : ${nextChapter.title}`"
          :aria-label="`Chapitre suivant : ${nextChapter.title}`"
          @click="emit('navigate-next')"
        >
          <ChevronRight :size="18" />
        </button>
      </div>
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
  position: relative;
}
.lumen-viewer-main--slides {
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow-y: auto;
  padding: var(--space-md) var(--space-lg);
}

/* Mode PDF (v2.64) : iframe pleine taille rendant le PDF nativement
   via le moteur Chromium d'Electron. */
.lumen-viewer-main--pdf {
  flex-direction: column;
  background: var(--bg-rail);
  padding: 0;
}
.lumen-pdf-frame {
  flex: 1;
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}

/* Mode TeX (v2.64) : on reuse le wrapper markdown-body pour profiter du
   styling .lumen-codeblock standard, mais le contenu est uniquement un
   bloc <pre><code class="language-latex"> rendu par le pipeline. */
.lumen-viewer-main--tex .lumen-viewer-body {
  padding: var(--space-xl) var(--space-2xl, 32px);
  max-width: none;
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

/* Popover "Devoirs lies" depuis le chip header. Cache par defaut, ne prend
   pas de place verticale dans le contenu (cf. demande utilisateur v2.61). */
.lumen-linked-popover-wrap {
  position: relative;
  display: inline-flex;
}
.lumen-viewer-chip.active {
  background: rgba(var(--accent-rgb), .14);
  border-color: var(--accent);
  color: var(--accent);
}
.lumen-linked-popover {
  position: absolute;
  top: calc(100% + var(--space-xs));
  right: 0;
  width: min(360px, calc(100vw - 40px));
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
  padding: var(--space-md);
  z-index: 100;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
.llt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}
.llt-title {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}
.llt-count {
  background: rgba(var(--accent-rgb), .14);
  color: var(--accent);
  padding: 1px 7px;
  border-radius: 10px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 700;
}
.llt-link-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: filter var(--motion-fast) var(--ease-out);
}
.llt-link-btn:hover { filter: brightness(1.1); }
.llt-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  max-height: 320px;
  overflow-y: auto;
}
.llt-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out);
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
  background: var(--bg-main);
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
  padding: var(--space-md);
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-elevated);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  line-height: 1.5;
  text-align: center;
}

/* Navigation flottante prev/next : 2 boutons en bordure du contenu, opacite
   reduite au repos, opacite pleine au hover du viewer. */
.lumen-floating-nav {
  pointer-events: none;
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-md);
  z-index: 5;
}
.lumen-floating-nav-btn {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  box-shadow: var(--elevation-2);
  opacity: 0;
  transform: translateY(0);
  transition: opacity var(--motion-base) var(--ease-out),
              background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out),
              transform var(--motion-fast) var(--ease-out);
}
.lumen-viewer-main:hover .lumen-floating-nav-btn,
.lumen-floating-nav-btn:focus-visible {
  opacity: .85;
}
.lumen-floating-nav-btn:hover {
  opacity: 1;
  background: var(--accent);
  color: #fff;
  transform: scale(1.05);
}
.lumen-floating-nav-btn:focus-visible {
  outline: none;
  box-shadow: var(--elevation-2), var(--focus-ring);
}
</style>

<!-- Styles globaux pour le body markdown : pedagogique, hierarchique, copy button.
     Volontairement non scoped : marked emet du HTML brut sans data-v-* attributes,
     les selecteurs scoped ne matcheraient pas. -->
<style>
/* ════════════════════════════════════════════════════════════════════════
   TYPOGRAPHIE PEDAGOGIQUE (v2.65)

   Toute la mise en page d'un cours markdown : titres hierarchises, listes
   avec marker accent, blockquote callout, tables zebrees, liens lisibles,
   inline code souligne, hr discret. Tokenise sur les variables Cursus —
   suit automatiquement le theme actif (default / cursus / marine / pulse).
   ════════════════════════════════════════════════════════════════════════ */

.lumen-viewer .markdown-body {
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-primary);
  font-family: var(--font);
}

/* ── Titres : hierarchie visuelle nette ─────────────────────────────────── */
.lumen-viewer .markdown-body h1,
.lumen-viewer .markdown-body h2,
.lumen-viewer .markdown-body h3,
.lumen-viewer .markdown-body h4,
.lumen-viewer .markdown-body h5,
.lumen-viewer .markdown-body h6 {
  color: var(--text-primary);
  font-weight: 700;
  line-height: 1.25;
  scroll-margin-top: var(--space-lg);
}

.lumen-viewer .markdown-body h1 {
  font-size: 28px;
  margin: 0 0 var(--space-lg);
  padding-bottom: var(--space-sm);
  border-bottom: 2px solid var(--accent);
  letter-spacing: -0.01em;
}

.lumen-viewer .markdown-body h2 {
  font-size: 22px;
  margin: var(--space-xl) 0 var(--space-md);
  padding-left: var(--space-md);
  border-left: 3px solid var(--accent);
}

.lumen-viewer .markdown-body h3 {
  font-size: 18px;
  margin: var(--space-lg) 0 var(--space-sm);
  color: var(--accent);
}

.lumen-viewer .markdown-body h4 {
  font-size: 16px;
  margin: var(--space-lg) 0 var(--space-xs);
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--text-secondary);
}

.lumen-viewer .markdown-body h5,
.lumen-viewer .markdown-body h6 {
  font-size: 14px;
  margin: var(--space-md) 0 var(--space-xs);
  color: var(--text-secondary);
}

/* ── Paragraphes ─────────────────────────────────────────────────────────── */
.lumen-viewer .markdown-body p {
  margin: 0 0 var(--space-md);
}

/* ── Listes ─────────────────────────────────────────────────────────────── */
.lumen-viewer .markdown-body ul,
.lumen-viewer .markdown-body ol {
  margin: 0 0 var(--space-md);
  padding-left: var(--space-xl);
}

.lumen-viewer .markdown-body li {
  margin-bottom: var(--space-xs);
}
.lumen-viewer .markdown-body li::marker {
  color: var(--accent);
  font-weight: 700;
}
.lumen-viewer .markdown-body li > p { margin-bottom: var(--space-xs); }
.lumen-viewer .markdown-body li > ul,
.lumen-viewer .markdown-body li > ol {
  margin-top: var(--space-xs);
  margin-bottom: var(--space-xs);
}

/* Checkbox lists (GFM) */
.lumen-viewer .markdown-body li input[type="checkbox"] {
  accent-color: var(--accent);
  margin-right: var(--space-xs);
  vertical-align: middle;
}

/* ── Liens ──────────────────────────────────────────────────────────────── */
.lumen-viewer .markdown-body a {
  color: var(--accent);
  text-decoration: none;
  border-bottom: 1px solid rgba(var(--accent-rgb), .35);
  transition: border-color var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out);
}
.lumen-viewer .markdown-body a:hover {
  color: var(--accent-hover);
  border-bottom-color: var(--accent);
}
.lumen-viewer .markdown-body a:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
  border-radius: 2px;
}

/* ── Code inline ────────────────────────────────────────────────────────── */
.lumen-viewer .markdown-body :not(pre) > code {
  background: rgba(var(--accent-rgb), .12);
  color: var(--accent);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
  font-size: 0.88em;
  font-weight: 600;
  border: 1px solid rgba(var(--accent-rgb), .18);
}

/* ── Blockquotes (callout neutre par defaut) ───────────────────────────── */
.lumen-viewer .markdown-body blockquote {
  margin: var(--space-lg) 0;
  padding: var(--space-md) var(--space-lg);
  background: rgba(var(--accent-rgb), .06);
  border-left: 3px solid var(--accent);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  color: var(--text-secondary);
}
.lumen-viewer .markdown-body blockquote p:last-child { margin-bottom: 0; }

/* ── Hr / separateur ────────────────────────────────────────────────────── */
.lumen-viewer .markdown-body hr {
  margin: var(--space-xl) 0;
  border: none;
  border-top: 1px solid var(--border);
}

/* ── Tables : zebra + sticky header ────────────────────────────────────── */
.lumen-viewer .markdown-body table {
  width: 100%;
  margin: var(--space-lg) 0;
  border-collapse: collapse;
  font-size: 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.lumen-viewer .markdown-body th {
  background: rgba(var(--accent-rgb), .08);
  color: var(--text-primary);
  font-weight: 700;
  text-align: left;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 2px solid var(--accent);
  text-transform: uppercase;
  letter-spacing: .04em;
  font-size: 11px;
}
.lumen-viewer .markdown-body td {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
}
.lumen-viewer .markdown-body tr:last-child td { border-bottom: none; }
.lumen-viewer .markdown-body tr:nth-child(even) td {
  background: var(--bg-hover);
}
.lumen-viewer .markdown-body tr:hover td {
  background: rgba(var(--accent-rgb), .04);
}

/* ── Images ─────────────────────────────────────────────────────────────── */
.lumen-viewer .markdown-body img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius);
  margin: var(--space-md) 0;
  box-shadow: var(--elevation-1);
}

/* ── Strong / em / mark ─────────────────────────────────────────────────── */
.lumen-viewer .markdown-body strong { color: var(--text-primary); font-weight: 700; }
.lumen-viewer .markdown-body em { color: var(--text-primary); font-style: italic; }
.lumen-viewer .markdown-body mark {
  background: rgba(229, 168, 66, .25);
  color: var(--text-primary);
  padding: 1px 4px;
  border-radius: 3px;
}

/* ════════════════════════════════════════════════════════════════════════
   BLOCS DE CODE (v2.65)

   Wrapper avec header sticky (langue + bouton Copier toujours visible)
   et corps scrollable. Le bouton est dans le header, plus en absolute
   sur le pre, pour une affordance claire et touch-friendly.
   ════════════════════════════════════════════════════════════════════════ */

.lumen-viewer .markdown-body .lumen-codeblock {
  margin: var(--space-lg) 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: #1a1d23;
  box-shadow: var(--elevation-1);
}
.lumen-viewer .markdown-body .lumen-codeblock-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  min-height: 32px;
}
.lumen-viewer .markdown-body .lumen-codeblock-lang {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
}
.lumen-viewer .markdown-body .lumen-codeblock pre.lumen-code {
  margin: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  padding: var(--space-md) var(--space-lg);
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.6;
}
.lumen-viewer .markdown-body .lumen-codeblock pre.lumen-code code {
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
  font-size: 13px;
  background: transparent;
  border: none;
  padding: 0;
  color: #e8e9ea;
  font-weight: 400;
}

/* ── Bouton Copier dans le header (v2.65 — toujours visible) ───────────── */
.lumen-viewer .markdown-body .lumen-copy-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.7);
  font-family: var(--font);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out);
}
.lumen-viewer .markdown-body .lumen-copy-btn:hover {
  background: rgba(var(--accent-rgb), .18);
  color: #fff;
  border-color: rgba(var(--accent-rgb), .5);
}
.lumen-viewer .markdown-body .lumen-copy-btn.copied {
  background: rgba(46, 204, 113, .18);
  color: #6FCF97;
  border-color: rgba(46, 204, 113, .45);
}
.lumen-viewer .markdown-body .lumen-copy-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb), .5);
}
.lumen-viewer .markdown-body .lumen-copy-label {
  font-variant-numeric: tabular-nums;
}

/* ── Mermaid : SVG centre avec fond doux ──────────────────────────────── */
.lumen-viewer .markdown-body .lumen-mermaid {
  display: flex;
  justify-content: center;
  padding: var(--space-lg);
  margin: var(--space-lg) 0;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow-x: auto;
  box-shadow: var(--elevation-1);
}
.lumen-viewer .markdown-body .lumen-mermaid svg {
  max-width: 100%;
  height: auto;
}
.lumen-viewer .markdown-body .lumen-mermaid-error {
  padding: var(--space-md) var(--space-lg);
  margin: var(--space-lg) 0;
  background: rgba(231, 76, 60, .08);
  border: 1px solid rgba(231, 76, 60, .3);
  border-radius: var(--radius-sm);
  color: var(--color-danger);
  font-size: 12px;
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  white-space: pre-wrap;
}

/* ── KaTeX : display math centre, inline dans le flux ─────────────────── */
.lumen-viewer .markdown-body .katex-display {
  margin: var(--space-lg) 0;
  overflow-x: auto;
  overflow-y: hidden;
  padding: var(--space-xs) 0;
}
.lumen-viewer .markdown-body .katex {
  font-size: 1.05em;
}
.lumen-viewer .markdown-body .lumen-math-error {
  color: var(--color-danger);
  background: rgba(231, 76, 60, .1);
  padding: 1px 5px;
  border-radius: 3px;
}

/* ── Admonitions / callouts (note, warning, tip, danger) ─────────────── */
.lumen-viewer .markdown-body .lumen-admonition {
  margin: var(--space-lg) 0;
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius);
  border: 1px solid var(--border);
  border-left-width: 3px;
  background: var(--bg-elevated);
}
.lumen-viewer .markdown-body .lumen-admonition--note {
  border-left-color: var(--accent);
  background: rgba(var(--accent-rgb), .06);
}
.lumen-viewer .markdown-body .lumen-admonition--tip,
.lumen-viewer .markdown-body .lumen-admonition--success {
  border-left-color: var(--color-success);
  background: rgba(46, 204, 113, .06);
}
.lumen-viewer .markdown-body .lumen-admonition--warning,
.lumen-viewer .markdown-body .lumen-admonition--caution {
  border-left-color: var(--color-warning);
  background: rgba(232, 137, 26, .06);
}
.lumen-viewer .markdown-body .lumen-admonition--danger,
.lumen-viewer .markdown-body .lumen-admonition--important {
  border-left-color: var(--color-danger);
  background: rgba(231, 76, 60, .06);
}

/* Premier element d'une admonition : pas de margin top */
.lumen-viewer .markdown-body .lumen-admonition > *:first-child { margin-top: 0; }
.lumen-viewer .markdown-body .lumen-admonition > *:last-child { margin-bottom: 0; }
</style>
