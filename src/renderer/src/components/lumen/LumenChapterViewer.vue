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
import { Loader2, FileText, FileDown, FileCode, Clock, User, ChevronLeft, ChevronRight, Check, ClipboardList, Plus, Calendar, RefreshCw, ChevronRight as CrumbSep, Presentation, Pencil, X, Link2, Printer, Search, Terminal, MoreHorizontal, ArrowUp, Copy, Highlighter, MessageSquarePlus, Star, BookOpen, Wrench } from 'lucide-vue-next'
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
import { useChapterEnrichment } from '@/composables/useChapterEnrichment'
import { useImageLightbox } from '@/composables/useImageLightbox'
import { useLumenAnnotations } from '@/composables/useLumenAnnotations'
import { useContextMenu, type ContextMenuItem } from '@/composables/useContextMenu'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import LumenLinkDevoirModal from '@/components/lumen/LumenLinkDevoirModal.vue'
import LumenOutline from '@/components/lumen/LumenOutline.vue'
import LumenAnnotations from '@/components/lumen/LumenAnnotations.vue'
// L'editeur inline (toolbar markdown, drag-drop images, status, banners) vit
// dans son propre composant pour garder ce viewer focalise sur la lecture.
import LumenChapterEditor from '@/components/lumen/LumenChapterEditor.vue'
import LumenImageLightbox from '@/components/lumen/LumenImageLightbox.vue'
import LumenAnnotPrompt from '@/components/lumen/LumenAnnotPrompt.vue'
// Lazy : pdfjs (~3 MB) et Marp (~2 MB) ne sont charges qu au premier chapitre
// PDF ou slides. Economise ~5 MB de parse JS au startup de chaque route.
const LumenPdfViewer = defineAsyncComponent(() => import('@/components/lumen/LumenPdfViewer.vue'))
const LumenSlideDeck = defineAsyncComponent(() => import('@/components/lumen/LumenSlideDeck.vue'))
// Lazy aussi : le runner .ipynb pull CodeMirror python + pyodide (CDN au
// runtime mais l'editor python n'est importe qu'en mode execution).
const LumenIpynbRunner = defineAsyncComponent(() => import('@/components/lumen/LumenIpynbRunner.vue'))
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

// ── Menu "more" header (v2.276) ───────────────────────────────────────────
// Regroupe les actions secondaires (Print, Copy-link, Exec ipynb) dans un
// popover ⋮ pour alleger le header. Ferme au clic-exterieur et a Escape.
const moreMenuOpen = ref(false)
const moreMenuRef = ref<HTMLElement | null>(null)
function toggleMoreMenu() { moreMenuOpen.value = !moreMenuOpen.value }
function closeMoreMenu() { moreMenuOpen.value = false }
function handleClickOutsideMoreMenu(e: MouseEvent) {
  if (!moreMenuOpen.value) return
  const target = e.target as HTMLElement
  if (moreMenuRef.value && !moreMenuRef.value.contains(target)) {
    moreMenuOpen.value = false
  }
}
function handleEscapeMoreMenu(e: KeyboardEvent) {
  if (e.key === 'Escape' && moreMenuOpen.value) closeMoreMenu()
}
onMounted(() => {
  document.addEventListener('click', handleClickOutsideMoreMenu)
  document.addEventListener('keydown', handleEscapeMoreMenu)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutsideMoreMenu)
  document.removeEventListener('keydown', handleEscapeMoreMenu)
})

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

// ── Temps de lecture estime (v2.283) ──────────────────────────────────────
// Calcul base sur 220 mots/min (moyenne lecteur francophone, source : etudes
// de lisibilite Substack/Medium). Affiche dans le header si aucune duree
// manuelle n'est definie sur le chapitre. Utile pour aider l'etudiant a
// planifier son temps d'etude.
const readingTimeMinutes = computed<number | null>(() => {
  if (!props.content) return null
  if (isPdf.value || isMarp.value) return null
  // Strip code/markdown noise pour estimer le nombre de mots reel.
  const stripped = props.content
    .replace(/```[\s\S]*?```/g, ' ')        // blocs de code
    .replace(/`[^`]*`/g, ' ')                // code inline
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')   // images
    .replace(/\[[^\]]*\]\([^)]+\)/g, ' ')    // liens
    .replace(/[#*_>`-]/g, ' ')               // markup
  const words = stripped.split(/\s+/).filter(Boolean).length
  if (words < 30) return null
  return Math.max(1, Math.ceil(words / 220))
})

// ── Edition inline de chapitre par le prof (v2.104, refonte v2.283) ─────
// useChapterEdit centralise l'etat (draft localStorage, dirty, conflict).
// L'experience UI (bandeau, toolbar markdown, drag-drop images) vit dans
// LumenChapterEditor — ce viewer ne connait que canEdit + editMode +
// enterEditMode pour ouvrir l'edition depuis le chip "Modifier".
const {
  editMode,
  draft: editDraft,
  message: editMessage,
  saving: editSaving,
  previewOpen: editPreviewOpen,
  showCommitMessage: editShowCommitMessage,
  isDirty: editIsDirty,
  saveState: editSaveState,
  hasRestoredDraft: editHasRestoredDraft,
  previewHtml: editPreviewHtml,
  canEdit,
  enter: enterEditMode,
  exit: exitEditModeRaw,
  save: saveEdit,
  reloadFromRemote: editReloadFromRemote,
  discardDraftAndReset: editDiscardDraft,
} = useChapterEdit({
  repo: repoRef,
  chapter: chapterRef,
  content: contentRef,
  contentSha: contentShaRef,
  isTeacher,
  chapterKind,
  isMarp,
})

function exitEditMode(): void {
  const wasDirty = editIsDirty.value
  exitEditModeRaw()
  if (wasDirty) {
    showToast('Brouillon sauvegarde, clique sur Modifier pour reprendre', 'info')
  }
}

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
const {
  headings,
  activeHeadingId,
  activePath: outlineActivePath,
  open: outlineOpen,
  width: outlineWidth,
  readingFocus: outlineReadingFocus,
  numbered: outlineNumbered,
  readingProgress: outlineReadingProgress,
  rebuild: rebuildOutline,
  scrollToHeading,
  MIN_OUTLINE_WIDTH,
  MAX_OUTLINE_WIDTH,
} = useChapterOutline(bodyRef)

// ── Reading progress (v2.276 — refonte v2.287) ──────────────────────────
// Le composable useChapterOutline expose deja outlineReadingProgress qui
// suit le scroll du body. On l'alias en readingProgress local pour ne pas
// dupliquer le listener (deux listeners sur le meme element = 2x la charge
// de calcul a chaque scroll event).
const readingProgress = outlineReadingProgress

/**
 * Scroll-to-top : remonte le body markdown en haut. Visible apres
 * scroll > 30 % via .lumen-scroll-top dans le template. Utile sur les
 * longs chapitres ou l'utilisateur veut revenir au sommaire / au titre.
 */
function scrollToTop() {
  bodyRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

// Banner stale : true si on lit du cache OU si le repo n'a pas ete sync
// depuis plus d'une heure. Invite l'utilisateur a resync.
const { isStale: isStaleContent, relativeSyncedAt: staleRelative } = useChapterStaleStatus(repoRef, cachedRef)

// ── Enrichissement post-render + lightbox ───────────────────────────────
// Composables dedies : useChapterEnrichment injecte les widgets non-Vue
// (boutons Copier, ancres "#") et rend les blocs Mermaid. useImageLightbox
// gere l'overlay plein ecran sur click image.
const enrichment = useChapterEnrichment({
  buildAnchorUrl: (headingId) => {
    const repoName = props.repo.repo || props.repo.fullName.split('/').pop() || ''
    return `lumen://${repoName}/${props.chapter.path}#${headingId}`
  },
})
const lightbox = useImageLightbox()

// ── Annotations locales (v2.285) ────────────────────────────────────────
// Etat detenu par le composable, partage avec le panneau d'annotations dans
// le header (LumenAnnotations) via props/emits. Le clic droit sur du texte
// dans le body markdown ouvre un menu contextuel pour copier / surligner /
// annoter avec un commentaire.
const repoIdRef = computed(() => props.repo.id)
const chapterPathRef = computed(() => props.chapter.path)
const {
  annotations: localAnnotations,
  add: addAnnotation,
  remove: removeAnnotation,
  update: updateAnnotation,
} = useLumenAnnotations(repoIdRef, chapterPathRef)

// Menu contextuel apparaissant sur clic droit dans le body markdown.
const { state: bodyMenuState, open: openBodyMenu, close: closeBodyMenu } = useContextMenu()

// Popover de saisie : commentaire (mode 'note') ou correction (mode
// 'correction', deux champs : suggestion + raison). Ferme par Escape,
// clic exterieur, Save, Cancel.
const annotPrompt = ref<{ x: number; y: number; text: string; mode: 'note' | 'correction' } | null>(null)

/** Considere comme "mot court" 1-3 mots — au-dela on n'offre pas l'item
 *  Definition (le wiktionnaire perd son utilite sur des phrases longues). */
function isLookupableTerm(text: string): boolean {
  const wc = text.split(/\s+/).filter(Boolean).length
  return wc >= 1 && wc <= 3 && text.length <= 60
}

function handleBodyContextMenu(e: MouseEvent) {
  // On ne capte le clic droit que si l'utilisateur a une selection ; sinon
  // on laisse le menu natif du navigateur (utile pour Inspect, Spell Check).
  const sel = window.getSelection()
  const text = sel?.toString().trim() ?? ''
  if (!text) return
  // Bloque si la selection contient l'editeur CodeMirror (eviter conflit).
  if ((e.target as HTMLElement)?.closest('.cm-editor')) return

  const items: ContextMenuItem[] = [
    {
      label: 'Copier la selection',
      icon: Copy,
      action: async () => {
        try {
          await navigator.clipboard.writeText(text)
          showToast('Selection copiee', 'success')
        } catch {
          showToast('Copie impossible', 'error')
        }
      },
    },
    {
      label: 'Rechercher dans le chapitre',
      icon: Search,
      action: () => {
        chapterSearchQuery.value = text
        chapterSearchOpen.value = true
        nextTick(() => findInputRef.value?.focus())
      },
    },
  ]

  // Definition : seulement si la selection ressemble a un terme.
  if (isLookupableTerm(text)) {
    items.push({
      label: `Definition de "${text.slice(0, 30)}${text.length > 30 ? '…' : ''}"`,
      icon: BookOpen,
      action: () => {
        const url = `https://fr.wiktionary.org/wiki/${encodeURIComponent(text)}`
        window.api?.openPath?.(url)
      },
    })
  }

  items.push(
    {
      label: 'Surligner',
      icon: Highlighter,
      separator: true,
      action: () => {
        const created = addAnnotation(text, '', { kind: 'note', priority: 'normal' })
        if (created) showToast('Passage surligne', 'success')
      },
    },
    {
      label: 'Marquer comme important',
      icon: Star,
      action: () => {
        const created = addAnnotation(text, '', { kind: 'note', priority: 'important' })
        if (created) showToast('Marque comme important', 'success')
      },
    },
    {
      label: 'Annoter avec un commentaire',
      icon: MessageSquarePlus,
      action: () => {
        annotPrompt.value = { x: e.clientX, y: e.clientY, text, mode: 'note' }
      },
    },
    {
      label: 'Suggerer une correction au prof',
      icon: Wrench,
      separator: true,
      action: () => {
        annotPrompt.value = { x: e.clientX, y: e.clientY, text, mode: 'correction' }
      },
    },
  )

  openBodyMenu(e, items)
}

/**
 * Construit le message formate pour une correction. Utilise quand la
 * suggestion est validee : on enregistre l'annotation localement ET on
 * copie le message dans le clipboard pour que l'etudiant puisse coller
 * dans son chat avec le prof. Pas de pipeline server-side pour l'instant
 * — la collab arrive plus tard.
 */
function buildCorrectionClipboard(payload: { text: string; suggestion: string; comment: string }): string {
  const lines = [
    `Correction suggeree pour ${props.chapter.title} (${props.chapter.path})`,
    `Original : "${payload.text}"`,
    `Proposition : "${payload.suggestion}"`,
  ]
  if (payload.comment) lines.push(`Pourquoi : ${payload.comment}`)
  return lines.join('\n')
}

async function submitAnnotPrompt(payload: { comment: string; suggestion?: string }) {
  if (!annotPrompt.value) return
  const { text, mode } = annotPrompt.value
  if (mode === 'correction') {
    const sug = (payload.suggestion ?? '').trim()
    if (!sug) {
      annotPrompt.value = null
      return
    }
    const created = addAnnotation(text, payload.comment, {
      kind: 'correction',
      priority: 'normal',
      suggestion: sug,
    })
    if (created) {
      try {
        await navigator.clipboard.writeText(buildCorrectionClipboard({ text, suggestion: sug, comment: payload.comment }))
        showToast('Correction enregistree et copiee — colle-la dans le chat avec ton prof', 'success')
      } catch {
        showToast('Correction enregistree (clipboard indisponible)', 'success')
      }
    }
  } else {
    const created = addAnnotation(text, payload.comment, { kind: 'note', priority: 'normal' })
    if (created) showToast('Annotation enregistree', 'success')
  }
  annotPrompt.value = null
}

function handleBodyClick(e: MouseEvent) {
  // Image click -> lightbox (sauf si l'image est dans un lien).
  if (lightbox.tryOpenFromClick(e)) return

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
  enrichment.injectCopyButtons(bodyRef.value)
  enrichment.injectHeadingAnchors(bodyRef.value)
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
  enrichment.renderMermaidBlocks(bodyRef.value).catch(() => { /* deja gere par bloc */ })
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
          <!-- Mode exec ipynb : reste en chip dedie car c'est un toggle
               de mode (etat persistant), pas une action one-shot. -->
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

          <!-- Menu "more" : actions secondaires regroupees (Print, Copy-link).
               Allege le header pour focaliser sur Edit/Companion/Devoirs. -->
          <div
            v-if="!editMode"
            ref="moreMenuRef"
            class="lumen-more-wrap"
          >
            <button
              type="button"
              class="lumen-viewer-chip lumen-viewer-chip--more"
              :class="{ active: moreMenuOpen }"
              :aria-expanded="moreMenuOpen"
              aria-haspopup="menu"
              title="Plus d'actions"
              @click.stop="toggleMoreMenu"
            >
              <MoreHorizontal :size="13" />
            </button>
            <div
              v-if="moreMenuOpen"
              class="lumen-more-menu"
              role="menu"
              aria-label="Actions du chapitre"
            >
              <button
                v-if="(chapterKind === 'markdown' || chapterKind === 'tex' || chapterKind === 'ipynb') && !isMarp"
                type="button"
                class="lumen-more-item"
                role="menuitem"
                @click="printChapter(); closeMoreMenu()"
              >
                <Printer :size="13" />
                <span>Imprimer / exporter PDF</span>
              </button>
              <button
                type="button"
                class="lumen-more-item"
                role="menuitem"
                @click="copyChapterLink(); closeMoreMenu()"
              >
                <Check v-if="linkCopied" :size="13" />
                <Link2 v-else :size="13" />
                <span>{{ linkCopied ? 'Lien copie' : 'Copier le lien lumen://' }}</span>
              </button>
            </div>
          </div>

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
          <span v-if="chapter.duration" class="lumen-viewer-meta-item" title="Duree definie par l'enseignant">
            <Clock :size="10" /> {{ chapter.duration }} min
          </span>
          <span
            v-else-if="readingTimeMinutes"
            class="lumen-viewer-meta-item"
            title="Temps de lecture estime (220 mots/min)"
          >
            <Clock :size="10" /> ~{{ readingTimeMinutes }} min de lecture
          </span>
          <span v-if="repo.manifest?.author" class="lumen-viewer-meta-item">
            <User :size="10" /> {{ repo.manifest.author }}
          </span>
          <LumenAnnotations
            v-if="!isPdf && !editMode"
            :annotations="localAnnotations"
            @remove="removeAnnotation"
            @update="updateAnnotation"
          />
        </div>
      </div>
      <!-- Reading progress : barre fine de progression sous le header,
           visible uniquement quand le chapitre a du contenu scrollable. -->
      <div
        v-if="readingProgress > 0 && readingProgress < 1"
        class="lumen-reading-progress"
        role="progressbar"
        :aria-valuenow="Math.round(readingProgress * 100)"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`Progression de lecture : ${Math.round(readingProgress * 100)}%`"
      >
        <div class="lumen-reading-progress-bar" :style="{ transform: `scaleX(${readingProgress})` }" />
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
        <div class="lumen-viewer-body markdown-body" v-html="texHtml" />
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

      <!-- Edition inline (refonte v2.283) — toute l'experience d'edition
           est encapsulee dans LumenChapterEditor. Ce viewer reste focalise
           sur la lecture et delegue l'edition au sous-composant. -->
      <LumenChapterEditor
        v-else-if="editMode"
        v-model:draft="editDraft"
        v-model:message="editMessage"
        v-model:preview-open="editPreviewOpen"
        v-model:show-commit-message="editShowCommitMessage"
        :path="chapter.path"
        :chapter-kind="chapterKind"
        :saving="editSaving"
        :is-dirty="editIsDirty"
        :save-state="editSaveState"
        :has-restored-draft="editHasRestoredDraft"
        :preview-html="editPreviewHtml"
        @save="saveEdit"
        @exit="exitEditMode"
        @reload-from-remote="editReloadFromRemote"
        @discard-draft="editDiscardDraft"
      />

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
          :class="{ 'lumen-viewer-body--accueil': isAccueilChapter }"
          @click="handleBodyClick"
          @contextmenu="handleBodyContextMenu"
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

          <!-- Navigation prev/next (refonte v2.284) : cartes pleine largeur
               en bas du contenu, scrollent avec lui. Pattern Mintlify /
               Stripe docs / Vue.js docs. Plus decouvrable que les boutons
               flottants verticaux qui forçaient a deviner ou cliquer ;
               raccourcis ←/→ restent geres par LumenView. -->
          <nav
            v-if="!isAccueilChapter && (prevChapter || nextChapter)"
            class="lumen-pagenav"
            aria-label="Navigation entre chapitres"
          >
            <button
              v-if="prevChapter"
              type="button"
              class="lumen-pagenav-card lumen-pagenav-card--prev"
              :aria-label="`Chapitre precedent : ${prevChapter.title}`"
              @click="emit('navigate-prev')"
            >
              <span class="lumen-pagenav-label"><ChevronLeft :size="12" /> Precedent</span>
              <span class="lumen-pagenav-title">{{ prevChapter.title }}</span>
            </button>
            <span v-else class="lumen-pagenav-spacer" aria-hidden="true" />

            <button
              v-if="nextChapter"
              type="button"
              class="lumen-pagenav-card lumen-pagenav-card--next"
              :aria-label="`Chapitre suivant : ${nextChapter.title}`"
              @click="emit('navigate-next')"
            >
              <span class="lumen-pagenav-label">Suivant <ChevronRight :size="12" /></span>
              <span class="lumen-pagenav-title">{{ nextChapter.title }}</span>
            </button>
            <span v-else class="lumen-pagenav-end" aria-hidden="true">
              <Check :size="12" /> Dernier chapitre du cours
            </span>
          </nav>
        </div>
        <LumenOutline
          v-if="headings.length > 0"
          :headings="headings"
          :collapsed="!outlineOpen"
          :active-heading-id="activeHeadingId"
          :active-path="outlineActivePath"
          :width="outlineWidth"
          :numbered="outlineNumbered"
          :reading-focus="outlineReadingFocus"
          :reading-progress="outlineReadingProgress"
          :is-teacher="isTeacher"
          :min-width="MIN_OUTLINE_WIDTH"
          :max-width="MAX_OUTLINE_WIDTH"
          @toggle="outlineOpen = !outlineOpen"
          @navigate="scrollToHeading"
          @update:width="outlineWidth = $event"
          @update:numbered="outlineNumbered = $event"
          @update:reading-focus="outlineReadingFocus = $event"
        />
      </div>

      <!-- Scroll-to-top FAB (v2.283) : visible apres 30 % de scroll. Utile
           sur les longs chapitres pour revenir au titre / sommaire. -->
      <Transition name="lumen-fab-fade">
        <button
          v-if="!isMarp && !isPdf && !editMode && readingProgress > 0.3"
          type="button"
          class="lumen-scroll-top"
          aria-label="Remonter en haut du chapitre"
          title="Remonter en haut"
          @click="scrollToTop"
        >
          <ArrowUp :size="16" />
        </button>
      </Transition>
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

    <!-- Lightbox image (v2.276 — extrait v2.283) -->
    <LumenImageLightbox :src="lightbox.src.value" :alt="lightbox.alt.value" @close="lightbox.close()" />

    <!-- Menu contextuel sur clic droit dans le body markdown (v2.285) -->
    <ContextMenu
      v-if="bodyMenuState"
      :x="bodyMenuState.x"
      :y="bodyMenuState.y"
      :items="bodyMenuState.items"
      @close="closeBodyMenu"
    />

    <!-- Popover de saisie d'annotation ou de correction (v2.285) -->
    <LumenAnnotPrompt
      v-if="annotPrompt"
      :x="annotPrompt.x"
      :y="annotPrompt.y"
      :text="annotPrompt.text"
      :mode="annotPrompt.mode"
      @submit="submitAnnotPrompt"
      @close="annotPrompt = null"
    />

  </article>
</template>

<!-- Style scoped extrait dans lumen-chapter-viewer.css (v2.283) :
     ~860 lignes deplacees pour rendre ce composant lisible. Vue applique
     automatiquement le scope hash aux selecteurs du fichier importe. -->
<style scoped src="./lumen-chapter-viewer.css"></style>

<!-- Style global du body markdown : extrait dans lumen-markdown-body.css.
     Volontairement non scoped — marked emet du HTML brut sans data-v-*. -->
<style src="./lumen-markdown-body.css"></style>
