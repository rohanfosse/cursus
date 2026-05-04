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
import { computed, onMounted, onBeforeUnmount, ref, watch, nextTick, toRef, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { Loader2, FileText, FileDown, FileCode, Clock, User, ChevronLeft, ChevronRight, Check, ClipboardList, Plus, Calendar, RefreshCw, ChevronRight as CrumbSep, Presentation, Pencil, Save, X, Eye, Columns2, Link2, Printer, Search, Terminal } from 'lucide-vue-next'
import { renderMarkdown } from '@/utils/markdown'
import { renderTex } from '@/utils/texRenderer'
import { renderIpynb } from '@/utils/ipynbRenderer'
import { resolveAnchorTarget } from '@/utils/lumenDevoirLinks'
import { relativeTime } from '@/utils/date'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app'
import { useChapterSearch } from '@/composables/useChapterSearch'
import { useChapterLinkedTravaux } from '@/composables/useChapterLinkedTravaux'
import { useChapterEdit } from '@/composables/useChapterEdit'
import { useChapterKind } from '@/composables/useChapterKind'
import { useChapterStaleStatus } from '@/composables/useChapterStaleStatus'
import { useChapterOutline } from '@/composables/useChapterOutline'
import { useChapterCompanion } from '@/composables/useChapterCompanion'
import { useChapterAccueil } from '@/composables/useChapterAccueil'
import LumenLinkDevoirModal from '@/components/lumen/LumenLinkDevoirModal.vue'
import LumenOutline from '@/components/lumen/LumenOutline.vue'
import LumenAnnotations from '@/components/lumen/LumenAnnotations.vue'
// Lazy : pdfjs (~3 MB) et Marp (~2 MB) ne sont charges qu au premier chapitre
// PDF ou slides. Economise ~5 MB de parse JS au startup de chaque route.
const LumenPdfViewer = defineAsyncComponent(() => import('@/components/lumen/LumenPdfViewer.vue'))
const LumenSlideDeck = defineAsyncComponent(() => import('@/components/lumen/LumenSlideDeck.vue'))
// Lazy aussi : le runner .ipynb pull CodeMirror python + pyodide (CDN au
// runtime mais l'editor python n'est importe qu'en mode execution).
const LumenIpynbRunner = defineAsyncComponent(() => import('@/components/lumen/LumenIpynbRunner.vue'))
import UiCodeEditor from '@/components/ui/UiCodeEditor.vue'
import type { LumenChapter, LumenRepo, LumenLinkedTravail } from '@/types'

interface Props {
  repo: LumenRepo
  chapter: LumenChapter
  content: string | null
  /** SHA git du blob courant. Necessaire pour l'edition atomique (v2.67). */
  contentSha?: string | null
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
  /** Cross-repo jump via lumen://repo/path (v2.72) */
  (e: 'navigate-lumen-link', payload: { repoName: string; path: string }): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()
const { showToast } = useToast()
const router = useRouter()
const appStore = useAppStore()

const isTeacher = computed(() => appStore.currentUser?.type === 'teacher' || appStore.currentUser?.type === 'admin')

const repoRef = toRef(props, 'repo') as unknown as import('vue').Ref<LumenRepo>
const chapterRef = toRef(props, 'chapter') as unknown as import('vue').Ref<LumenChapter>
const contentRef = toRef(props, 'content') as unknown as import('vue').Ref<string | null | undefined>
const contentShaRef = toRef(props, 'contentSha') as unknown as import('vue').Ref<string | null | undefined>
const cachedRef = toRef(props, 'cached') as unknown as import('vue').Ref<boolean | undefined>

// ── Devoirs lies a ce chapitre ────────────────────────────────────────────
const {
  travaux: linkedTravaux,
  linkModalOpen: linkDevoirModalOpen,
  popoverOpen: linkedPopoverOpen,
  popoverRef: linkedPopoverRef,
  togglePopover: toggleLinkedPopover,
  closePopover: closeLinkedPopover,
  load: loadLinkedTravaux,
} = useChapterLinkedTravaux(repoRef, chapterRef)

// ── Raccourcis clavier Lumen (v2.70) ──────────────────────────────────────
// Attaches au document : actifs quand le focus n'est pas dans un input ou
// quand une modale est ouverte.
//  - ArrowLeft       : chapitre precedent
//  - ArrowRight      : chapitre suivant
//  - e               : ouvrir la modale Modifier (teacher, markdown only)
//  - /               : focus la barre de recherche de la sidebar
//  - ?               : afficher l'aide (future)
// Les touches sont ignorees si l'utilisateur est en train de taper dans
// un champ ou si la modale d'edition est ouverte (CodeMirror a ses propres
// raccourcis pour ArrowLeft/Right etc.).
function isTypingInField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  // CodeMirror wrapper : le contenu editable est dans un element .cm-content
  if (target.closest('.cm-editor')) return true
  return false
}

function onLumenKeyboard(ev: KeyboardEvent): void {
  // Ctrl+S / Cmd+S en mode edition : sauvegarde rapide
  if (editMode.value && (ev.ctrlKey || ev.metaKey) && ev.key === 's') {
    ev.preventDefault()
    saveEdit()
    return
  }
  // Escape en mode edition : quitter sans sauvegarder
  if (editMode.value && ev.key === 'Escape') {
    ev.preventDefault()
    exitEditMode()
    return
  }
  if (editMode.value || linkDevoirModalOpen.value || linkedPopoverOpen.value) return
  // Si l'utilisateur tape dans un champ, on laisse passer (ex: la search
  // sidebar).
  if (isTypingInField(ev.target)) return
  // Modificateurs (Ctrl/Cmd/Alt/Meta) : on reserve aux shortcuts natifs
  // du navigateur et de l'app. Shift est accepte (pour shift+? = ?).
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return

  // Note v2.73 : ArrowLeft/ArrowRight sont geres par LumenView
  // (handleKeydown a un niveau plus haut), on ne duplique pas ici.
  // On gere seulement 'e' qui est contextuel au viewer.

  // 'e' ouvre l'edition (teacher only, markdown only)
  if (ev.key === 'e' || ev.key === 'E') {
    if (canEdit.value) {
      ev.preventDefault()
      enterEditMode()
    }
    return
  }
}

const bodyRef = ref<HTMLElement | null>(null)

// ── Recherche dans le chapitre (Ctrl+F) ─────────────────────────────────
const {
  open: chapterSearchOpen,
  query: chapterSearchQuery,
  count: chapterSearchCount,
  current: chapterSearchCurrent,
  inputRef: findInputRef,
  closeSearch: closeChapterSearch,
  findNext,
  findPrev,
} = useChapterSearch(bodyRef)

function navigateToFirstChapter() {
  const first = props.repo.manifest?.chapters[0]
  if (first) {
    emit('navigate-chapter', first.path)
  } else {
    showToast('Ce cours ne contient aucun chapitre', 'info')
  }
}

function openTravail(travail: LumenLinkedTravail) {
  // Navigation vers la vue devoir : on set le projet actif par category
  // et on route vers /devoirs qui affichera le projet contenant le devoir.
  if (travail.category) appStore.activeProject = travail.category
  router.push({ name: 'devoirs' })
}

// ── Page d'accueil du repo (README racine) ────────────────────────────────
const { isAccueil: isAccueilChapter, toc: accueilToc } = useChapterAccueil(repoRef, chapterRef)

function openAccueilChapter(ch: LumenChapter) {
  emit('navigate-chapter', ch.path)
}

// ── Detection du format de chapitre (markdown/pdf/tex/ipynb + Marp) ──────
const { kind: chapterKind, isPdf, isTex, isIpynb, isMarp } = useChapterKind(chapterRef, contentRef)

// ── Edition inline de chapitre par le prof (v2.104) ──────────────────────
const {
  editMode,
  draft: editDraft,
  message: editMessage,
  saving: editSaving,
  previewOpen: editPreviewOpen,
  previewHtml: editPreviewHtml,
  canEdit,
  enter: enterEditMode,
  exit: exitEditMode,
  save: saveEdit,
} = useChapterEdit({
  repo: repoRef,
  chapter: chapterRef,
  content: contentRef,
  contentSha: contentShaRef,
  isTeacher,
  chapterKind,
  isMarp,
})

// v2.79 : imprimer le chapitre courant (feuille @media print gere le reste).
function printChapter() {
  window.print()
}

// v2.78 : copier un lien cross-repo lumen:// vers ce chapitre.
const linkCopied = ref(false)
async function copyChapterLink() {
  const repoName = props.repo.repo || props.repo.fullName.split('/').pop() || ''
  const url = `lumen://${repoName}/${props.chapter.path}`
  try {
    await navigator.clipboard.writeText(url)
    linkCopied.value = true
    showToast('Lien copie', 'success')
    setTimeout(() => { linkCopied.value = false }, 1500)
  } catch {
    showToast('Copie impossible', 'error')
  }
}

const ipynbHtml = computed(() => {
  if (!isIpynb.value || !props.content) return ''
  return renderIpynb(props.content, props.chapter.path)
})

// Mode execution d'un .ipynb (phase 2 Lumen) : toggle local au chapitre,
// reinitialise a false au changement de chapitre via watch plus bas.
const ipynbExecMode = ref(false)
watch(() => props.chapter.path, () => { ipynbExecMode.value = false })

const html = computed(() => {
  if (!props.content) return ''
  if (isPdf.value || isTex.value || isIpynb.value) return ''
  if (isMarp.value) return ''
  return renderMarkdown(props.content, { chapterPath: props.chapter.path })
})

const texHtml = computed(() => {
  if (!isTex.value || !props.content) return ''
  return renderTex(props.content)
})

// ── Companion PDF/TeX toggle (v2.71) ──────────────────────────────────────
// Un chapitre markdown peut avoir un companionPdf (ex: scrum.md + scrum.pdf)
// et un chapitre PDF peut avoir un companionTex (ex: qcm.pdf + qcm.tex).
const {
  mode: companionMode,
  content: companionContent,
  loading: companionLoading,
  kind: companionKind,
  has: hasCompanion,
  toggleLabel: companionToggleLabel,
  toggle: toggleCompanion,
  texHtml: companionTexHtml,
} = useChapterCompanion(repoRef, chapterRef, chapterKind, isMarp)

// Reset edition au changement de chapitre (companion auto-reset par le composable).
watch(() => props.chapter.path, () => {
  if (editMode.value) editMode.value = false
})

// ── Outline (plan du chapitre) ────────────────────────────────────────────
const { headings, activeHeadingId, open: outlineOpen, rebuild: rebuildOutline, scrollToHeading } = useChapterOutline(bodyRef)

// Banner stale : true si on lit du cache OU si le repo n'a pas ete sync
// depuis plus d'une heure. Invite l'utilisateur a resync.
const { isStale: isStaleContent, relativeSyncedAt: staleRelative } = useChapterStaleStatus(repoRef, cachedRef)

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

  // v2.72 : lien cross-repo `lumen://repo/path` reecrit en
  // data-lumen-link="repo|path" par markdown.ts.
  const lumenLink = target.getAttribute('data-lumen-link')
  if (lumenLink) {
    e.preventDefault()
    const [repoName, path] = lumenLink.split('|')
    if (repoName && path) emit('navigate-lumen-link', { repoName, path })
    return
  }

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
    rebuildOutline(true)
    return
  }
  if (!bodyRef.value) return
  injectCopyButtons(bodyRef.value)
  rebuildOutline()
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
  document.addEventListener('keydown', onLumenKeyboard)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onLumenKeyboard)
})
watch(() => [props.content, props.chapter?.path], () => {
  enrichRender()
  loadLinkedTravaux()
})
</script>

<template>
  <article class="lumen-viewer">
    <header class="lumen-viewer-head">
      <!-- Header condensed v2.67.2 : le bloc .lumen-viewer-meta qui dupliquait
           "project / chapter" est supprime. Le titre est maintenant porte par
           le breadcrumb "current" (plus bas), qui contient deja l'info section. -->
      <div class="lumen-viewer-info">
        <!-- Groupe A : Actions (gauche) -->
        <div class="lumen-viewer-actions">
          <button
            v-if="canEdit"
            type="button"
            class="lumen-viewer-chip lumen-viewer-chip--edit"
            title="Modifier ce chapitre (raccourci : E)"
            @click="enterEditMode"
          >
            <Pencil :size="11" /> Modifier
            <kbd class="lumen-viewer-chip-kbd">E</kbd>
          </button>
          <button
            v-if="hasCompanion"
            type="button"
            class="lumen-viewer-chip lumen-viewer-chip--companion"
            :class="{ active: companionMode }"
            :disabled="companionLoading"
            :title="companionMode ? 'Retour au contenu principal' : `Voir ${chapter.companionPdf ? 'le PDF' : 'le source'} jumeau`"
            @click="toggleCompanion"
          >
            <Loader2 v-if="companionLoading" :size="11" class="spin" />
            <FileDown v-else-if="chapter.companionPdf && !companionMode" :size="11" />
            <FileCode v-else-if="chapter.companionTex && !companionMode" :size="11" />
            <FileText v-else :size="11" />
            {{ companionToggleLabel }}
          </button>
          <button
            v-if="(chapterKind === 'markdown' || chapterKind === 'tex' || chapterKind === 'ipynb') && !isMarp && !editMode"
            type="button"
            class="lumen-viewer-chip lumen-viewer-chip--print"
            title="Imprimer / exporter en PDF"
            @click="printChapter"
          >
            <Printer :size="11" />
          </button>
          <button
            v-if="isIpynb && !editMode"
            type="button"
            class="lumen-viewer-chip lumen-viewer-chip--exec"
            :class="{ active: ipynbExecMode }"
            :title="ipynbExecMode ? 'Revenir à la lecture statique' : 'Activer l\'exécution Python (Pyodide)'"
            @click="ipynbExecMode = !ipynbExecMode"
          >
            <Terminal :size="11" />
            <span>{{ ipynbExecMode ? 'Lecture' : 'Exécuter' }}</span>
          </button>
          <button
            type="button"
            class="lumen-viewer-chip lumen-viewer-chip--link-copy"
            :class="{ copied: linkCopied }"
            :title="linkCopied ? 'Lien copie' : 'Copier le lien lumen:// de ce chapitre'"
            @click="copyChapterLink"
          >
            <Check v-if="linkCopied" :size="11" />
            <Link2 v-else :size="11" />
          </button>

          <!-- Devoirs lies : chip + popover -->
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

        <!-- Groupe B : Metadonnees (droite, muted) -->
        <div class="lumen-viewer-meta-group">
          <span v-if="isMarp" class="lumen-viewer-chip lumen-viewer-chip--marp">
            <Presentation :size="11" /> Slides
          </span>
          <span v-if="chapter.duration" class="lumen-viewer-meta-item">
            <Clock :size="10" /> {{ chapter.duration }} min
          </span>
          <span v-if="repo.manifest?.author" class="lumen-viewer-meta-item">
            <User :size="10" /> {{ repo.manifest.author }}
          </span>
          <LumenAnnotations
            v-if="!isPdf && !editMode"
            :repo-id="repo.id"
            :chapter-path="chapter.path"
          />
        </div>
      </div>
      <!-- Breadcrumbs : orientation rapide via project / section / chapitre -->
      <nav class="lumen-breadcrumbs" aria-label="Fil d'ariane">
        <button
          type="button"
          class="lumen-breadcrumbs-seg lumen-breadcrumbs-link"
          @click="navigateToFirstChapter"
        >{{ repo.manifest?.project ?? repo.fullName }}</button>
        <CrumbSep v-if="chapter.section" :size="10" class="lumen-breadcrumbs-sep" />
        <span v-if="chapter.section" class="lumen-breadcrumbs-seg">{{ chapter.section }}</span>
        <CrumbSep :size="10" class="lumen-breadcrumbs-sep" />
        <span class="lumen-breadcrumbs-seg lumen-breadcrumbs-current">{{ chapter.title }}</span>
      </nav>
    </header>

    <!-- Banner stale : contenu potentiellement obsolete (cache > 1h ou lecture
         depuis cache offline). Un clic declenche un resync de la promo. -->
    <div v-if="isStaleContent && !loading && content" class="lumen-stale-banner" role="alert">
      <Clock :size="14" />
      <span>Ce chapitre n'est peut-etre pas a jour (derniere synchro {{ staleRelative }})</span>
      <button type="button" class="lumen-stale-refresh" @click="emit('resync')">
        <RefreshCw :size="12" /> Mettre a jour
      </button>
    </div>

    <div v-if="loading" class="lumen-viewer-loading">
      <Loader2 :size="20" class="spin" />
      Chargement du chapitre...
    </div>
    <div v-else-if="!content" class="lumen-viewer-empty">
      <FileText :size="32" />
      <h3>Contenu indisponible</h3>
      <p>Le chapitre n'a pas pu etre charge. Verifie ta connexion internet ou reessaie.</p>
      <button type="button" class="lumen-btn primary" @click="emit('resync')">
        <RefreshCw :size="14" /> Reessayer
      </button>
    </div>
    <template v-else>
      <!-- Compagnon PDF (v2.103 : rendu pdf.js au lieu d'iframe) -->
      <LumenPdfViewer v-if="companionMode && companionKind === 'pdf'" :content="companionContent" :title="chapter.title" />

      <!-- Compagnon TeX : source LaTeX du chapitre PDF courant -->
      <div v-else-if="companionMode && companionKind === 'tex'" class="lumen-viewer-main lumen-viewer-main--tex">
        <div class="lumen-viewer-body markdown-body" v-html="companionTexHtml" />
      </div>

      <!-- Rendu PDF via pdf.js (v2.103 — remplace l'iframe + plugin Chromium) -->
      <LumenPdfViewer v-else-if="isPdf" :content="content" :title="chapter.title" />

      <!-- Rendu TeX avec KaTeX -->
      <div v-else-if="isTex && !editMode" class="lumen-viewer-main lumen-viewer-main--tex">
        <div class="lumen-viewer-body markdown-body" :class="{ 'lumen-reading-light': readingLight }" v-html="texHtml" />
      </div>

      <!-- Rendu Jupyter Notebook : statique par défaut, runner Pyodide si mode exécution -->
      <div v-else-if="isIpynb" class="lumen-viewer-main lumen-viewer-main--ipynb">
        <LumenIpynbRunner
          v-if="ipynbExecMode && content"
          :source="content"
          :chapter-path="chapter.path"
        />
        <div
          v-else
          class="lumen-viewer-body markdown-body"
                    v-html="ipynbHtml"
        />
      </div>

      <!-- Rendu Marp : slide deck dedie quand `marp: true` dans la frontmatter -->
      <div v-else-if="isMarp" class="lumen-viewer-main lumen-viewer-main--slides">
        <LumenSlideDeck :source="content ?? ''" :title="chapter.title" />
      </div>

      <!-- Edition inline (v2.104) : remplace la vue lecture par l'editeur -->
      <div v-else-if="editMode" class="lumen-viewer-main lumen-edit-inline">
        <!-- Barre de commit fixe en haut (style GitHub) -->
        <header class="lumen-edit-toolbar">
          <div class="lumen-edit-toolbar-left">
            <Pencil :size="12" />
            <span class="lumen-edit-toolbar-path">{{ chapter.path }}</span>
          </div>
          <div class="lumen-edit-toolbar-right">
            <input
              v-model="editMessage"
              type="text"
              class="lumen-edit-message"
              :placeholder="`docs: edit ${chapter.path}`"
              maxlength="200"
            />
            <button
              type="button"
              class="lumen-edit-preview-toggle"
              :class="{ active: editPreviewOpen }"
              :title="editPreviewOpen ? 'Masquer la preview' : 'Afficher la preview'"
              :disabled="editSaving"
              @click="editPreviewOpen = !editPreviewOpen"
            >
              <Columns2 :size="14" />
            </button>
            <button type="button" class="lumen-edit-btn lumen-edit-btn--ghost" :disabled="editSaving" @click="exitEditMode">
              Annuler
            </button>
            <button type="button" class="lumen-edit-btn lumen-edit-btn--primary" :disabled="editSaving" @click="saveEdit">
              <Loader2 v-if="editSaving" :size="14" class="spin" />
              <Save v-else :size="14" />
              {{ editSaving ? 'Saving...' : 'Commit' }}
            </button>
          </div>
        </header>
        <!-- Editeur + preview -->
        <div class="lumen-edit-body" :class="{ 'lumen-edit-body--split': editPreviewOpen }">
          <div class="lumen-edit-pane lumen-edit-pane--editor">
            <UiCodeEditor
              v-model="editDraft"
              :language="chapterKind === 'tex' ? 'plaintext' : 'markdown'"
            />
          </div>
          <div v-if="editPreviewOpen" class="lumen-edit-pane lumen-edit-pane--preview">
            <div class="lumen-edit-pane-label">
              <Eye :size="11" /> Preview
            </div>
            <div class="lumen-edit-preview markdown-body" v-html="editPreviewHtml" />
          </div>
        </div>
      </div>

      <!-- Rendu Markdown standard sinon -->
      <div v-else class="lumen-viewer-main">
        <!-- Barre de recherche Ctrl+F -->
        <Transition name="find-slide">
          <div v-if="chapterSearchOpen" class="lumen-find-bar">
            <Search :size="14" class="lumen-find-icon" />
            <input
              ref="findInputRef"
              v-model="chapterSearchQuery"
              type="text"
              class="lumen-find-input"
              placeholder="Rechercher dans le chapitre..."
              @keydown.enter.prevent="findNext"
              @keydown.escape.prevent="closeChapterSearch"
            />
            <span v-if="chapterSearchCount > 0" class="lumen-find-count">
              {{ chapterSearchCurrent }} / {{ chapterSearchCount }}
            </span>
            <span v-else-if="chapterSearchQuery.trim()" class="lumen-find-count lumen-find-count--zero">
              0 resultat
            </span>
            <button class="lumen-find-nav" title="Precedent" @click="findPrev"><ChevronLeft :size="14" /></button>
            <button class="lumen-find-nav" title="Suivant" @click="findNext"><ChevronRight :size="14" /></button>
            <button class="lumen-find-close" @click="closeChapterSearch"><X :size="14" /></button>
          </div>
        </Transition>

        <div
          ref="bodyRef"
          class="lumen-viewer-body markdown-body"
          :class="{ 'lumen-viewer-body--accueil': isAccueilChapter, 'lumen-reading-light': readingLight }"
          @click="handleBodyClick"
        >
          <div v-html="html" />
          <section v-if="isAccueilChapter && accueilToc.length > 0" class="lumen-bloc-toc">
            <h2 class="lumen-bloc-toc-title">Sommaire du bloc</h2>
            <div v-for="section in accueilToc" :key="section.title" class="lumen-bloc-toc-section">
              <h3 class="lumen-bloc-toc-section-title">{{ section.title }}</h3>
              <ul class="lumen-bloc-toc-list">
                <li v-for="ch in section.chapters" :key="ch.path">
                  <button
                    type="button"
                    class="lumen-bloc-toc-item"
                    @click="openAccueilChapter(ch)"
                  >
                    <span class="lumen-bloc-toc-item-title">{{ ch.title }}</span>
                    <span v-if="ch.duration" class="lumen-bloc-toc-item-duration">
                      <Clock :size="11" /> {{ ch.duration }} min
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </section>
        </div>
        <LumenOutline
          v-if="headings.length > 0"
          :headings="headings"
          :collapsed="!outlineOpen"
          :active-heading-id="activeHeadingId"
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

      <!-- Indicateur de fin de cours (v2.87) -->
      <div v-if="!isMarp && !isPdf && !nextChapter && prevChapter" class="lumen-end-of-course">
        <Check :size="16" />
        <span>Dernier chapitre du cours</span>
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
  /* v2.273.5 : --bg-main au lieu de --bg-primary (qui en theme light vaut
     #E5E7EB, un gris trop fonce qui jaurissait sur le blanc des modales /
     widgets autour. Le viewer doit etre la zone de contenu propre = blanc). */
  background: var(--bg-main);
  /* height: 0 force le flex-basis a 0 pour que le container
     ne depasse pas la hauteur du parent (necessaire pour les PDFs) */
  height: 0;
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
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.lumen-viewer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.lumen-viewer-meta-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.lumen-viewer-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--text-muted);
}
.lumen-viewer-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 3px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-muted);
}
.lumen-viewer-chip.read {
  color: var(--color-success);
  border-color: var(--color-success);
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
.lumen-viewer-chip--edit {
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), .35);
  background: transparent;
  font-weight: 600;
  gap: 5px;
}
.lumen-viewer-chip--edit:hover {
  background: rgba(var(--accent-rgb), .14);
  color: var(--accent);
  border-color: var(--accent);
}
.lumen-viewer-chip-kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  padding: 0 4px;
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 9px;
  font-weight: 700;
  background: rgba(var(--accent-rgb), .18);
  border: 1px solid rgba(var(--accent-rgb), .3);
  border-radius: 3px;
  color: var(--accent);
  line-height: 1;
}
.lumen-viewer-chip--companion {
  color: var(--color-warning);
  border-color: rgba(232,137,26,.35);
  background: transparent;
  font-weight: 600;
}
.lumen-viewer-chip--companion:hover:not(:disabled) {
  background: rgba(232,137,26,.12);
  border-color: var(--color-warning);
}
.lumen-viewer-chip--companion.active {
  background: rgba(232,137,26,.16);
  color: var(--color-warning);
  border-color: var(--color-warning);
}
.lumen-viewer-chip--companion:disabled {
  opacity: .5;
  cursor: not-allowed;
}
/* Actions secondaires (Print, Copy-link, Exec) : style ghost minimal —
   icon + halo discret. v2.275 : demotees visuellement pour que l'oeil se
   focus sur Edit / Companion / Devoirs (les actions primaires).
   Cf. GitHub docs : un seul bouton "edit" flottant proeminent. */
.lumen-viewer-chip--link-copy,
.lumen-viewer-chip--print,
.lumen-viewer-chip--exec {
  color: var(--text-muted);
  border-color: transparent;
  background: transparent;
  padding: 4px 6px;
}
.lumen-viewer-chip--link-copy:hover,
.lumen-viewer-chip--print:hover,
.lumen-viewer-chip--exec:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.lumen-viewer-chip--link-copy.copied {
  color: var(--color-success);
  background: rgba(var(--color-success-rgb), .1);
}
.lumen-viewer-chip--exec.active {
  color: var(--accent);
  background: rgba(var(--accent-rgb), .12);
}

/* Edition inline (v2.104) */
.lumen-edit-inline {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Barre de commit fixe en haut (style GitHub) */
.lumen-edit-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: 8px 16px;
  background: var(--bg-main);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  z-index: 5;
}
.lumen-edit-toolbar-left {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  min-width: 0;
}
.lumen-edit-toolbar-path {
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lumen-edit-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.lumen-edit-message {
  width: 220px;
  padding: 5px 10px;
  font-size: 12px;
  font-family: inherit;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  outline: none;
}
.lumen-edit-message:focus { border-color: var(--accent); }
.lumen-edit-message::placeholder { color: var(--text-muted); }

.lumen-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.12s ease;
}
.lumen-edit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.lumen-edit-btn--ghost {
  background: transparent;
  color: var(--text-secondary);
  border-color: transparent;
}
.lumen-edit-btn--ghost:hover:not(:disabled) { background: var(--bg-hover); }
.lumen-edit-btn--primary {
  background: var(--color-success);
  color: white;
  border-color: var(--color-success);
}
.lumen-edit-btn--primary:hover:not(:disabled) { opacity: 0.9; }

.lumen-edit-preview-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.12s ease;
}
.lumen-edit-preview-toggle:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.lumen-edit-preview-toggle.active {
  background: rgba(var(--accent-rgb), .14);
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), .35);
}
.lumen-edit-preview-toggle:disabled { opacity: .4; cursor: not-allowed; }

/* Editeur + preview */
.lumen-edit-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.lumen-edit-pane--editor {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.lumen-edit-pane--editor :deep(.ui-code-editor) {
  flex: 1;
  height: auto !important;
  min-height: 0;
}
.lumen-edit-body--split .lumen-edit-pane--editor {
  flex: 1 1 50%;
}
.lumen-edit-body--split .lumen-edit-pane--preview {
  flex: 1 1 50%;
}
.lumen-edit-pane--preview {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-left: 1px solid var(--border);
  overflow-y: auto;
}
.lumen-edit-pane-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--text-muted);
  padding: 8px 16px 4px;
  flex-shrink: 0;
}
.lumen-edit-preview {
  padding: 16px 24px;
  flex: 1;
  overflow-y: auto;
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
  align-items: stretch;
  justify-content: stretch;
  /* Le slidedeck gere son propre padding interne et son alignement.
     v2.66.2 : on retire l'overflow-y:auto qui empechait le slidedeck
     d'utiliser toute la hauteur disponible. */
  overflow: hidden;
  padding: 0;
}


.lumen-viewer-main--tex .lumen-viewer-body {
  padding: var(--space-xl) var(--space-2xl, 32px);
  max-width: 800px;
  margin: 0 auto;
}
.lumen-tex-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--text-primary);
}
.lumen-tex-meta {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0 0 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.lumen-tex-img-placeholder {
  padding: 24px;
  text-align: center;
  background: var(--bg-secondary);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-size: 12px;
  margin: 16px 0;
}
.lumen-tex-table {
  width: 100%;
  border-collapse: collapse;
  margin: 16px 0;
}
.lumen-tex-table td,
.lumen-tex-table th {
  padding: 6px 10px;
  border: 1px solid var(--border);
  font-size: 13px;
}

/* Jupyter Notebook (v2.105) */
.lumen-viewer-main--ipynb .lumen-viewer-body {
  padding: var(--space-lg) var(--space-2xl, 32px);
  max-width: 900px;
  margin: 0 auto;
}
.ipynb-cell { margin-bottom: 16px; }
.ipynb-cell--code {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.ipynb-code-wrap {
  display: flex;
  gap: 0;
  background: var(--bg-secondary);
}
.ipynb-exec-count {
  display: flex;
  align-items: flex-start;
  padding: 10px 8px 10px 10px;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  min-width: 36px;
  justify-content: flex-end;
  user-select: none;
  flex-shrink: 0;
}
.ipynb-code-wrap .lumen-code {
  margin: 0;
  border-radius: 0;
  flex: 1;
  min-width: 0;
}
.ipynb-outputs {
  border-top: 1px solid var(--border);
  padding: 10px 14px;
  background: var(--bg-primary);
}
.ipynb-stream,
.ipynb-text {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
  color: var(--text-secondary);
}
.ipynb-error {
  margin: 0;
  font-size: 12px;
  white-space: pre-wrap;
  color: var(--danger);
  background: rgba(var(--color-danger-rgb), 0.08);
  padding: 8px;
  border-radius: var(--radius-xs);
}
.ipynb-img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-xs);
}
.ipynb-svg { max-width: 100%; overflow: auto; }
.ipynb-html-output { overflow-x: auto; font-size: 13px; }
.ipynb-parse-error {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
}

/* v2.275 : reading-light toggle retire — il dupliquait le theme switch
   global et utilisait des !important hardcodes qui cassaient le tokenisme.
   Si l'utilisateur veut un mode clair pour la lecture, il switch le theme
   global app (Settings -> Apparence). */

/* Corps markdown : largeur de lecture confortable (~70-75 caracteres en
   17px serif) capee a 760px. Centre dans le flex parent — l'outline
   (220px) reste a droite, le contenu reste lisible meme sur 4K.
   Cf. Stripe docs / Mintlify / Notion qui plafonnent autour de 720-780px. */
.lumen-viewer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xl) 56px var(--space-xl);
  max-width: 760px;
  width: 100%;
  margin: 0 auto;
}
/* Sur ecran moyen, on garde max-width 760px mais on reduit le padding
   horizontal pour que les marges ne mangent pas le contenu. */
@media (max-width: 1280px) {
  .lumen-viewer-body {
    padding: var(--space-xl) 32px var(--space-xl);
  }
}
/* Sous 900px le confort de 760px disparait : on laisse le body remplir
   l'espace dispo pour eviter les marges fantomes. */
@media (max-width: 900px) {
  .lumen-viewer-body {
    padding: var(--space-lg) 20px var(--space-lg);
    max-width: 100%;
  }
}

/* Mode Accueil (v2.66) : layout plus aere, h1 plus visible, padding genereux
   pour donner une impression de "tableau de bord du bloc". */
.lumen-viewer-body--accueil {
  max-width: 920px;
  padding: var(--space-xl) 64px var(--space-xl);
}
.lumen-viewer-body--accueil :deep(h1) {
  font-size: 36px;
  margin-bottom: var(--space-xl);
  letter-spacing: -0.025em;
}

/* Sommaire du bloc affiche en bas de la page d'accueil (v2.66) */
.lumen-bloc-toc {
  margin-top: var(--space-2xl, 48px);
  padding-top: var(--space-xl);
  border-top: 1px solid var(--border);
}
.lumen-bloc-toc-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 var(--space-lg);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
.lumen-bloc-toc-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 22px;
  background: var(--accent);
  border-radius: 2px;
}
.lumen-bloc-toc-section {
  margin-bottom: var(--space-lg);
}
.lumen-bloc-toc-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--text-muted);
  margin: 0 0 var(--space-sm);
}
.lumen-bloc-toc-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-sm);
}
.lumen-bloc-toc-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-md) var(--space-lg);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              border-color var(--motion-fast) var(--ease-out),
              transform var(--motion-base) var(--ease-out),
              box-shadow var(--motion-base) var(--ease-out);
}
.lumen-bloc-toc-item:hover {
  border-color: var(--accent);
  background: rgba(var(--accent-rgb), .04);
  transform: translateY(-2px);
  box-shadow: var(--elevation-2);
}
.lumen-bloc-toc-item:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.lumen-bloc-toc-item-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lumen-bloc-toc-item-duration {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
  font-weight: 500;
}

/* Breadcrumbs : fil d'ariane du header. Porte maintenant le titre du
   chapitre (v2.67.2) puisque le bloc meta redondant a ete supprime. */
.lumen-breadcrumbs {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: 12px;
  color: var(--text-muted);
  flex-wrap: wrap;
}
.lumen-breadcrumbs-seg {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
}
.lumen-breadcrumbs-link {
  background: none;
  border: none;
  cursor: pointer;
  font: inherit;
  padding: 0;
  color: var(--text-muted);
  font-weight: 500;
  transition: color var(--motion-fast) var(--ease-out);
}
.lumen-breadcrumbs-link:hover { color: var(--accent); text-decoration: underline; }
/* Section parente : italique pour la differencier du projet (memes muted)
   et du chapitre courant (bold). */
.lumen-breadcrumbs-seg:not(.lumen-breadcrumbs-link):not(.lumen-breadcrumbs-current) {
  font-style: italic;
  color: var(--text-secondary);
}
.lumen-breadcrumbs-current {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 16px;
  font-style: normal;
  max-width: 520px;
}
.lumen-breadcrumbs-sep {
  color: var(--text-muted);
  opacity: 0.5;
  flex-shrink: 0;
}

/* Banner stale content : visible quand le contenu vient du cache ou est
   plus vieux que 1h. Non dismissable : incite au resync. */
.lumen-stale-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px auto 0;
  max-width: 760px;
  padding: 12px 16px;
  background: rgba(var(--color-warning-rgb), 0.12);
  border: 1px solid rgba(var(--color-warning-rgb), 0.35);
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--color-warning);
  flex-shrink: 0;
}
.lumen-stale-banner svg { flex-shrink: 0; }

/* Indicateur fin de cours (v2.87) */
.lumen-end-of-course {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  margin: 24px auto;
  max-width: 760px;
  border-radius: var(--radius);
  background: rgba(var(--color-success-rgb), 0.08);
  border: 1px solid rgba(var(--color-success-rgb), 0.25);
  color: var(--color-success);
  font-size: 14px;
  font-weight: 600;
}
.lumen-stale-refresh {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: var(--radius-xs);
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
  border-radius: var(--radius);
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
  border-radius: var(--radius-sm);
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
  /* v2.275 : 0.4 etait quasi invisible sur fond clair. 0.65 = present
     mais pas intrusif, hover plein. */
  opacity: 0.65;
  transform: translateY(0);
  transition: opacity var(--motion-base) var(--ease-out),
              background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out),
              transform var(--motion-fast) var(--ease-out);
}
.lumen-viewer-main:hover .lumen-floating-nav-btn,
.lumen-floating-nav-btn:focus-visible {
  opacity: 1;
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

/* ── Recherche dans le chapitre (Ctrl+F) ── */
.lumen-find-bar {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px; background: var(--bg-sidebar);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 2px 8px rgba(0,0,0,.15);
}
.lumen-find-icon { color: var(--text-muted); flex-shrink: 0; }
.lumen-find-input {
  flex: 1; border: 1px solid var(--border-input); border-radius: var(--radius-sm);
  background: var(--bg-input); color: var(--text-primary);
  font-family: var(--font); font-size: 13px; padding: 5px 10px;
  outline: none; min-width: 120px;
}
.lumen-find-input:focus { border-color: var(--accent); }
.lumen-find-count {
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  white-space: nowrap; font-variant-numeric: tabular-nums;
}
.lumen-find-count--zero { color: var(--color-danger); }
.lumen-find-nav {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: transparent;
  color: var(--text-secondary); cursor: pointer; transition: all .12s;
}
.lumen-find-nav:hover { background: var(--bg-hover); color: var(--accent); }
.lumen-find-close {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: var(--radius-sm);
  border: none; background: transparent;
  color: var(--text-muted); cursor: pointer;
}
.lumen-find-close:hover { color: var(--color-danger); }
.find-slide-enter-active, .find-slide-leave-active { transition: all .2s ease; }
.find-slide-enter-from, .find-slide-leave-to { opacity: 0; transform: translateY(-100%); }
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

/* Voix editoriale UNIQUE — Newsreader serif 17px, line-height 1.72.
   Aligne sur les standards de lecture longue (Substack, Medium, NYT
   Reader). Decale du Plus Jakarta Sans du reste de l'app pour signaler
   "tu lis du contenu, pas de l'UI". */
.lumen-viewer .markdown-body {
  font-family: 'Newsreader', Georgia, 'Times New Roman', serif;
  font-size: 17px;
  line-height: 1.72;
  color: var(--text-primary);
  font-feature-settings: 'liga', 'kern';
}

/* ── Titres : hierarchie sobre, taille porte le poids ──────────────────── */
.lumen-viewer .markdown-body h1,
.lumen-viewer .markdown-body h2,
.lumen-viewer .markdown-body h3,
.lumen-viewer .markdown-body h4,
.lumen-viewer .markdown-body h5,
.lumen-viewer .markdown-body h6 {
  font-family: 'Newsreader', Georgia, 'Times New Roman', serif;
  color: var(--text-primary);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.015em;
  scroll-margin-top: var(--space-xl);
  text-wrap: balance;
}

.lumen-viewer .markdown-body h1 {
  font-size: 2.2em;
  margin: 0.2em 0 0.6em;
  letter-spacing: -0.02em;
  border-bottom: 1px solid var(--border);
  padding-bottom: 0.3em;
}
.lumen-viewer .markdown-body h2 {
  font-size: 1.65em;
  margin: 1.8em 0 0.5em;
}
.lumen-viewer .markdown-body h3 {
  font-size: 1.3em;
  margin: 1.5em 0 0.4em;
}
.lumen-viewer .markdown-body h4 {
  font-size: 1.1em;
  font-weight: 600;
  margin: 1.4em 0 0.3em;
}
.lumen-viewer .markdown-body h5,
.lumen-viewer .markdown-body h6 {
  font-size: 0.95em;
  font-weight: 600;
  margin: 1.2em 0 0.3em;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Paragraphes : rythme 1em vertical ─────────────────────────────────── */
.lumen-viewer .markdown-body p {
  margin: 0 0 1em;
}

/* ── Listes ─────────────────────────────────────────────────────────────── */
.lumen-viewer .markdown-body ul,
.lumen-viewer .markdown-body ol {
  margin: 0 0 1em;
  padding-left: 1.6em;
}
.lumen-viewer .markdown-body li {
  margin: 0.3em 0;
}
.lumen-viewer .markdown-body li::marker {
  color: var(--accent);
  font-weight: 700;
}
.lumen-viewer .markdown-body li > p { margin: 0.2em 0; }
.lumen-viewer .markdown-body li > ul,
.lumen-viewer .markdown-body li > ol {
  margin-top: 0.3em;
  margin-bottom: 0.3em;
}

/* Checkbox lists (GFM) */
.lumen-viewer .markdown-body li input[type="checkbox"] {
  accent-color: var(--accent);
  margin-right: 0.4em;
  vertical-align: middle;
}

/* ── Liens : underline subtil, accent au hover ──────────────────────────── */
.lumen-viewer .markdown-body a {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
  transition: text-decoration-thickness var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out);
}
.lumen-viewer .markdown-body a:hover {
  color: var(--accent-hover);
  text-decoration-thickness: 2px;
}
.lumen-viewer .markdown-body a:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
  border-radius: 2px;
}

/* ── Code inline ────────────────────────────────────────────────────────── */
.lumen-viewer .markdown-body :not(pre) > code {
  background: rgba(var(--accent-rgb), .1);
  color: var(--accent);
  padding: 1px 6px;
  border-radius: var(--radius-xs);
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
  font-size: 0.85em;
  font-weight: 500;
  font-style: normal;
}

/* ── Blockquotes : citation litteraire ──────────────────────────────────── */
.lumen-viewer .markdown-body blockquote {
  margin: 1.6em 0;
  padding: 0.2em 0 0.2em 1.2em;
  border-left: 3px solid var(--accent);
  color: var(--text-secondary);
  font-style: italic;
  font-size: 1.02em;
  line-height: 1.65;
}
.lumen-viewer .markdown-body blockquote p:last-child { margin-bottom: 0; }
.lumen-viewer .markdown-body blockquote code { font-style: normal; }

/* ── Hr / separateur ────────────────────────────────────────────────────── */
.lumen-viewer .markdown-body hr {
  margin: 2.4em 0;
  border: none;
  border-top: 1px solid var(--border);
}

/* ── Tables : zebra discrete, sans-serif pour lisibilite tabulaire ─────── */
.lumen-viewer .markdown-body table {
  width: 100%;
  margin: 1.6em 0;
  border-collapse: collapse;
  font-family: var(--font);
  font-size: 14px;
  line-height: 1.5;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.lumen-viewer .markdown-body th {
  background: var(--bg-hover);
  color: var(--text-primary);
  font-weight: 600;
  text-align: left;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}
.lumen-viewer .markdown-body td {
  padding: 10px 14px;
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

/* ── Images : caption-friendly, ombres douces ──────────────────────────── */
.lumen-viewer .markdown-body img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-sm);
  display: block;
  margin: 1.6em auto;
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
  background: var(--code-bg);
  box-shadow: var(--elevation-1);
}
.lumen-viewer .markdown-body .lumen-codeblock-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  background: var(--code-header-bg, rgba(255, 255, 255, 0.05));
  border-bottom: 1px solid var(--code-header-border, rgba(255, 255, 255, 0.08));
  min-height: 32px;
}
.lumen-viewer .markdown-body .lumen-codeblock-lang {
  font-size: 11px;
  font-weight: 500;
  color: var(--code-lang-color, rgba(255, 255, 255, 0.55));
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
  /* v2.275 : fade-right discret pour signaler "scrollable horizontal".
     Mask permet de garder la couleur du parent (peu importe le theme).
     Sans cet indicateur, les utilisateurs ignoraient qu'il y avait du
     contenu cache a droite sur lignes longues. */
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
          mask-image: linear-gradient(to right, #000 calc(100% - 32px), transparent);
}
/* Quand l'utilisateur a scroll jusqu'au bout, on retire le mask via
   un attribut data positionne en JS (best-effort) — sinon le mask reste
   inoffensif puisque les lignes se terminent avant la zone fade. */
.lumen-viewer .markdown-body .lumen-codeblock pre.lumen-code[data-scrolled-end="true"] {
  -webkit-mask-image: none;
          mask-image: none;
}
.lumen-viewer .markdown-body .lumen-codeblock pre.lumen-code code {
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
  font-size: 13px;
  background: transparent;
  border: none;
  padding: 0;
  color: var(--code-text);
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
  background: rgba(var(--color-success-rgb), .18);
  color: #6FCF97;
  border-color: rgba(var(--color-success-rgb), .45);
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
  background: rgba(var(--color-danger-rgb), .08);
  border: 1px solid rgba(var(--color-danger-rgb), .3);
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
  background: rgba(var(--color-danger-rgb), .1);
  padding: 1px 5px;
  border-radius: 3px;
}

/* ── Admonitions / callouts (note, tip, warning, danger) ──────────────── */
.lumen-viewer .markdown-body .lumen-admonition {
  margin: 1.6em 0;
  padding: 0.9em 1.2em;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  border-left-width: 3px;
  background: var(--bg-elevated);
}
/* Header avec icone + titre ("Note", "Astuce", "Attention", "Danger") */
.lumen-viewer .markdown-body .lumen-admonition-head {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 0.4em;
  font-family: var(--font);
  font-size: 0.85em;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.lumen-viewer .markdown-body .lumen-admonition-icon {
  display: inline-flex;
  align-items: center;
}
.lumen-viewer .markdown-body .lumen-admonition-body > *:first-child { margin-top: 0; }
.lumen-viewer .markdown-body .lumen-admonition-body > *:last-child { margin-bottom: 0; }

/* Variantes — classes telles que produites par utils/markdown.ts.
   v2.275 : alignement (etait casse, le HTML genere `lumen-adm-*` mais le
   CSS ciblait `lumen-admonition--*`, les variantes ne s'appliquaient pas). */
.lumen-viewer .markdown-body .lumen-adm-note {
  border-left-color: var(--accent);
  background: rgba(var(--accent-rgb), .06);
}
.lumen-viewer .markdown-body .lumen-adm-note .lumen-admonition-head { color: var(--accent); }

.lumen-viewer .markdown-body .lumen-adm-tip {
  border-left-color: var(--color-success);
  background: rgba(var(--color-success-rgb), .06);
}
.lumen-viewer .markdown-body .lumen-adm-tip .lumen-admonition-head { color: var(--color-success); }

.lumen-viewer .markdown-body .lumen-adm-warning {
  border-left-color: var(--color-warning);
  background: rgba(var(--color-warning-rgb), .08);
}
.lumen-viewer .markdown-body .lumen-adm-warning .lumen-admonition-head { color: var(--color-warning); }

.lumen-viewer .markdown-body .lumen-adm-danger {
  border-left-color: var(--color-danger);
  background: rgba(var(--color-danger-rgb), .06);
}
.lumen-viewer .markdown-body .lumen-adm-danger .lumen-admonition-head { color: var(--color-danger); }

/* ════════════════════════════════════════════════════════════════════════
   PRINT STYLESHEET (v2.79)
   Masque toute l'UI de l'app et ne garde que le body markdown, avec
   des couleurs optimisees pour l'impression papier (fond blanc, texte
   noir, code sur fond clair). Declenche par le bouton "Imprimer" du
   header viewer ou par Ctrl+P natif.
   ════════════════════════════════════════════════════════════════════════ */
@media print {
  /* Masque tout sauf le viewer */
  body > *:not(.lumen-view):not([data-lumen-view]),
  .lumen-sidebar,
  .lumen-topbar,
  .lumen-viewer-head,
  .lumen-stale-banner,
  .lumen-floating-nav,
  .lumen-outline,
  .lumen-viewer-chip,
  .lumen-linked-travaux,
  .lumen-viewer-nav,
  .mobile-hamburger {
    display: none !important;
  }
  /* Le viewer prend toute la page */
  .lumen-view, .lumen-body, .lumen-main, .lumen-viewer,
  .lumen-viewer-main, .lumen-viewer-body {
    position: static !important;
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    height: auto !important;
    overflow: visible !important;
    background: #fff !important;
    color: #000 !important;
    padding: 0 !important;
    margin: 0 !important;
    box-shadow: none !important;
  }
  .lumen-viewer-body.markdown-body {
    padding: 0 !important;
    font-size: 11pt !important;
    line-height: 1.5 !important;
    color: #000 !important;
  }
  .lumen-viewer-body.markdown-body h1,
  .lumen-viewer-body.markdown-body h2,
  .lumen-viewer-body.markdown-body h3,
  .lumen-viewer-body.markdown-body h4,
  .lumen-viewer-body.markdown-body h5,
  .lumen-viewer-body.markdown-body h6 {
    color: #000 !important;
    page-break-after: avoid;
  }
  .lumen-viewer-body.markdown-body h1 {
    font-size: 18pt !important;
    border-bottom: 2pt solid #000 !important;
    padding-bottom: 0.2em;
  }
  .lumen-viewer-body.markdown-body h2 {
    font-size: 15pt !important;
    border-left: 3pt solid #000 !important;
    padding-left: 0.4em;
    color: #000 !important;
  }
  .lumen-viewer-body.markdown-body h3 {
    font-size: 13pt !important;
    color: #000 !important;
  }
  .lumen-viewer-body.markdown-body p,
  .lumen-viewer-body.markdown-body li {
    orphans: 3;
    widows: 3;
  }
  .lumen-viewer-body.markdown-body a {
    color: #000 !important;
    border-bottom: 1pt dotted #666 !important;
  }
  /* Code inline & blocs sur fond pale pour l'impression */
  .lumen-viewer-body.markdown-body :not(pre) > code {
    background: #f0f0f0 !important;
    color: #000 !important;
    border: 1pt solid #ccc !important;
  }
  .lumen-viewer-body.markdown-body .lumen-codeblock {
    background: #f8f8f8 !important;
    border: 1pt solid #ccc !important;
    page-break-inside: avoid;
  }
  .lumen-viewer-body.markdown-body .lumen-codeblock-header {
    background: #e8e8e8 !important;
    border-bottom: 1pt solid #ccc !important;
  }
  .lumen-viewer-body.markdown-body .lumen-codeblock-lang {
    color: #444 !important;
  }
  .lumen-viewer-body.markdown-body .lumen-codeblock pre.lumen-code code {
    color: #000 !important;
  }
  .lumen-viewer-body.markdown-body .lumen-copy-btn {
    display: none !important;
  }
  .lumen-viewer-body.markdown-body blockquote {
    background: #f8f8f8 !important;
    border-left: 3pt solid #666 !important;
    color: #333 !important;
    page-break-inside: avoid;
  }
  .lumen-viewer-body.markdown-body table {
    page-break-inside: avoid;
    border: 1pt solid #000 !important;
  }
  .lumen-viewer-body.markdown-body th {
    background: #e8e8e8 !important;
    color: #000 !important;
    border-bottom: 1pt solid #000 !important;
  }
  .lumen-viewer-body.markdown-body td {
    color: #000 !important;
    border-bottom: 0.5pt solid #ccc !important;
  }
  .lumen-viewer-body.markdown-body img {
    max-width: 100% !important;
    box-shadow: none !important;
    border: 1pt solid #ccc !important;
    page-break-inside: avoid;
  }
  .lumen-viewer-body.markdown-body .lumen-admonition {
    background: #f8f8f8 !important;
    border: 1pt solid #999 !important;
    border-left-width: 3pt !important;
    page-break-inside: avoid;
  }
  @page {
    margin: 1.5cm 2cm 2cm 2cm;
    size: A4;
  }
}

/* ── Highlights de recherche in-page ── */
mark.lumen-find-hl {
  background: rgba(245,158,11,.3);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}
mark.lumen-find-hl.lumen-find-hl--active {
  background: #f59e0b;
  color: #000;
  box-shadow: 0 0 0 2px rgba(245,158,11,.4);
}
</style>
