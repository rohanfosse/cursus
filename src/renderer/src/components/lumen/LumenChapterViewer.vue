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
import { Loader2, FileText, FileDown, FileCode, Clock, User, ChevronLeft, ChevronRight, Copy, Check, ClipboardList, Plus, Calendar, RefreshCw, ChevronRight as CrumbSep, Presentation, Pencil, Save, X, Eye, EyeOff, Columns2, Link2, Printer, Sun, Moon } from 'lucide-vue-next'
import { renderMarkdown } from '@/utils/markdown'
import { renderTex } from '@/utils/texRenderer'
import { renderIpynb } from '@/utils/ipynbRenderer'
import { resolveAnchorTarget } from '@/utils/lumenDevoirLinks'
import { parseChapterContent } from '@/utils/lumenFrontmatter'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app'
import { useLumenStore } from '@/stores/lumen'
import { relativeTime } from '@/utils/date'
import LumenLinkDevoirModal from '@/components/lumen/LumenLinkDevoirModal.vue'
import LumenOutline from '@/components/lumen/LumenOutline.vue'
import LumenPdfViewer from '@/components/lumen/LumenPdfViewer.vue'
import LumenAnnotations from '@/components/lumen/LumenAnnotations.vue'
import LumenSlideDeck from '@/components/lumen/LumenSlideDeck.vue'
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

async function loadLinkedTravaux() {
  if (!props.chapter?.path) return
  linkedTravauxLoading.value = true
  try {
    const resp = await window.api.getLumenTravauxForChapter(props.repo.id, props.chapter.path) as {
      ok: boolean
      data?: { travaux: LumenLinkedTravail[] }
    }
    linkedTravaux.value = resp?.ok && resp.data?.travaux ? resp.data.travaux : []
  } catch {
    linkedTravaux.value = []
  } finally {
    linkedTravauxLoading.value = false
  }
}

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

const bodyRef = ref<HTMLElement | null>(null)

/**
 * Detection chapitre "Accueil" (v2.66) : le README racine du repo, ou tout
 * chapitre marque comme presentation. Quand actif, on bascule sur un layout
 * "tableau de bord du bloc" : titre h1 enrichi + sommaire des autres
 * chapitres en bas.
 */
const isAccueilChapter = computed(() => {
  const path = props.chapter.path?.toLowerCase() ?? ''
  return path === 'readme.md'
    || path.endsWith('/readme.md')
    || props.chapter.section === 'Presentation'
    || props.chapter.title === 'Accueil'
})

/**
 * Sommaire du bloc affiche en bas de l'Accueil : liste de tous les autres
 * chapitres du repo, groupes par section dans l'ordre de declaration.
 */
interface AccueilTocSection {
  title: string
  chapters: LumenChapter[]
}
const accueilToc = computed<AccueilTocSection[]>(() => {
  if (!isAccueilChapter.value) return []
  const all = props.repo.manifest?.chapters ?? []
  const others = all.filter((c) => c.path !== props.chapter.path)
  const map = new Map<string, LumenChapter[]>()
  for (const c of others) {
    const key = c.section?.trim() || 'Chapitres'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(c)
  }
  return Array.from(map.entries()).map(([title, chs]) => ({ title, chapters: chs }))
})

function openAccueilChapter(ch: LumenChapter) {
  emit('navigate-chapter', ch.path)
}

// ── Edition inline de chapitre par le prof (v2.104) ──────────────────────
// Toggle lecture/edition dans le viewer. Le prof modifie directement dans
// le contenu, sans modale. Split-view optionnel avec preview live.
const editMode = ref(false)
const editDraft = ref('')
const editMessage = ref('')
const editSaving = ref(false)
const editPreviewOpen = ref(true)
const editPreviewHtml = computed(() => {
  if (!editPreviewOpen.value || !editDraft.value) return ''
  if (chapterKind.value === 'tex') return renderTex(editDraft.value)
  return renderMarkdown(editDraft.value, { chapterPath: props.chapter.path })
})
const lumenStore = useLumenStore()

function enterEditMode(): void {
  if (!canEdit.value) return
  if (props.content == null) return
  editDraft.value = props.content
  editMessage.value = ''
  editMode.value = true
}

function exitEditMode(): void {
  if (editSaving.value) return
  editMode.value = false
}

async function saveEdit(): Promise<void> {
  if (editSaving.value) return
  if (!props.contentSha) {
    showToast('SHA du fichier introuvable, recharge le chapitre', 'error')
    return
  }
  editSaving.value = true
  try {
    const message = editMessage.value.trim() || `docs: edit ${props.chapter.path}`
    const resp = await window.api.updateLumenChapterFile(props.repo.id, {
      path: props.chapter.path,
      content: editDraft.value,
      sha: props.contentSha,
      message,
    }) as { ok: boolean; error?: string }
    if (!resp?.ok) {
      const msg = resp?.error || 'Echec de la sauvegarde'
      showToast(msg, 'error')
      return
    }
    showToast('Chapitre enregistre', 'success')
    editMode.value = false
    await lumenStore.fetchChapterContent(props.repo.id, props.chapter.path)
  } catch (err) {
    const msg = (err as { message?: string })?.message || 'Erreur reseau'
    showToast(msg, 'error')
  } finally {
    editSaving.value = false
  }
}

const canEdit = computed(() =>
  isTeacher.value
  && (chapterKind.value === 'markdown' || chapterKind.value === 'tex')
  && !isMarp.value
  && props.content != null
  && Boolean(props.contentSha),
)

// Mode lecture clair/sombre — persiste dans localStorage
const readingLight = ref(localStorage.getItem('lumen-reading-light') === '1')
watch(readingLight, (v) => { localStorage.setItem('lumen-reading-light', v ? '1' : '0') })

// v2.79 : imprimer le chapitre courant. Le stylesheet print masque tout
// sauf le body markdown pour obtenir un PDF propre (via le dialogue
// d'impression Chromium). Utile pour polycopies et archivage.
function printChapter() {
  // Chromium gere tout : on appelle juste window.print() et la feuille
  // @media print cachee dans le styles global fait le reste.
  window.print()
}

// v2.78 : copier un lien cross-repo lumen:// vers ce chapitre dans le
// presse-papiers. Utile pour partager un chapitre precis dans un message
// Slack / un devoir / un email.
const linkCopied = ref(false)
async function copyChapterLink() {
  // On utilise le nom court du repo (sans owner) pour que le lien
  // fonctionne avec handleNavigateLumenLink cote LumenView.
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

// Detection du format de chapitre (v2.64). Le `kind` vient du manifest
// auto-genere, sinon on infere
// depuis l'extension du path. Branches de rendu :
//  - pdf : iframe data: URL (PDF natif)
//  - tex : source LaTeX colorisee via highlight.js
//  - markdown : rendu standard, ou Marp si frontmatter `marp: true`
type ChapterKind = 'markdown' | 'pdf' | 'tex' | 'ipynb'

function inferKindFromPath(path: string): ChapterKind {
  const m = path.match(/\.([^./]+)$/)
  const ext = m ? m[1].toLowerCase() : ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'tex') return 'tex'
  if (ext === 'ipynb') return 'ipynb'
  return 'markdown'
}
const chapterKind = computed<ChapterKind>(() => {
  return (props.chapter.kind as ChapterKind | undefined) ?? inferKindFromPath(props.chapter.path)
})
const isPdf = computed(() => chapterKind.value === 'pdf')
const isTex = computed(() => chapterKind.value === 'tex')
const isIpynb = computed(() => chapterKind.value === 'ipynb')

// Detection Marp via frontmatter `marp: true`. Si detecte, on bascule sur
// LumenSlideDeck (rendu en slides) au lieu du rendu Markdown long-form.
// Marp ne s'applique qu'aux chapitres markdown — un .pdf ou .tex ne peut
// pas avoir de frontmatter Marp.
const parsed = computed(() =>
  chapterKind.value === 'markdown' ? parseChapterContent(props.content) : { frontmatter: {}, body: '', isMarp: false },
)
const isMarp = computed(() => parsed.value.isMarp)

const ipynbHtml = computed(() => {
  if (!isIpynb.value || !props.content) return ''
  return renderIpynb(props.content, props.chapter.path)
})

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
// Quand companionMode est true, on affiche le compagnon au lieu du contenu
// principal, en fetchant sa data a la demande (cache cote serveur).
const companionMode = ref(false)
const companionContent = ref<string | null>(null)
const companionLoading = ref(false)
const companionKind = ref<'pdf' | 'tex' | 'markdown' | null>(null)

const companionPath = computed<string | null>(() => {
  return props.chapter.companionPdf ?? props.chapter.companionTex ?? null
})
const hasCompanion = computed<boolean>(() => Boolean(companionPath.value))

/**
 * Bouton "Voir le PDF" / "Voir le source LaTeX" / "Voir le markdown".
 * Le label depend du format courant et du compagnon disponible.
 */
const companionToggleLabel = computed<string>(() => {
  if (companionMode.value) {
    if (isMarp.value) return 'Voir les slides'
    return chapterKind.value === 'markdown' ? 'Voir le markdown' : 'Voir le rendu'
  }
  if (props.chapter.companionPdf) return 'Voir le PDF'
  if (props.chapter.companionTex) return 'Voir le source'
  return ''
})

async function toggleCompanion(): Promise<void> {
  if (!companionPath.value) return
  if (companionMode.value) {
    companionMode.value = false
    return
  }
  companionLoading.value = true
  try {
    const resp = await window.api.getLumenChapterContent(props.repo.id, companionPath.value) as {
      ok: boolean
      data?: { content: string; sha: string; kind?: string }
      error?: string
    }
    if (!resp?.ok || !resp.data) {
      showToast(resp?.error || 'Impossible de charger le compagnon', 'error')
      return
    }
    const { content, kind } = resp.data
    companionContent.value = content
    companionKind.value = (kind as 'pdf' | 'tex' | 'markdown' | undefined) ?? 'markdown'
    companionMode.value = true
  } catch (err) {
    showToast((err as { message?: string })?.message || 'Erreur reseau', 'error')
  } finally {
    companionLoading.value = false
  }
}

// Reset le companion mode a chaque changement de chapitre.
watch(() => props.chapter.path, () => {
  companionMode.value = false
  companionContent.value = null
  companionKind.value = null
})

// Auto-open PDF pour Marp : les etudiants preferent le PDF imprimable.
watch(isMarp, (marp) => {
  if (marp && props.chapter.companionPdf && !companionMode.value) {
    toggleCompanion()
  }
})

// HTML du compagnon si mode tex
const companionTexHtml = computed<string>(() => {
  if (!companionMode.value || companionKind.value !== 'tex' || !companionContent.value) return ''
  const fenced = '```latex\n' + companionContent.value + '\n```'
  return renderMarkdown(fenced, { chapterPath: companionPath.value ?? '' })
})

// ── Outline (plan du chapitre) + breadcrumbs + stale indicator ────────────

interface HeadingEntry {
  id: string
  text: string
  level: number
}

const headings = ref<HeadingEntry[]>([])
const activeHeadingId = ref<string | null>(null)
// v2.73 : l'etat ouvert/ferme de l'outline est persiste en localStorage
// pour que le prof qui a masque l'outline ne doive pas le refermer a
// chaque changement de chapitre. Cle globale (pas per-repo).
const OUTLINE_STATE_KEY = 'lumen.outlineOpen'
const outlineOpen = ref<boolean>((() => {
  try {
    const v = localStorage.getItem(OUTLINE_STATE_KEY)
    if (v !== null) return v === '1'
    // Auto-collapse sur ecrans etroits (< 1400px) pour ne pas ecraser le contenu
    return typeof window !== 'undefined' ? window.innerWidth >= 1400 : true
  } catch { return true }
})())
watch(outlineOpen, (v) => {
  try { localStorage.setItem(OUTLINE_STATE_KEY, v ? '1' : '0') } catch { /* noop */ }
})

// Scroll spy (v2.77) : observe les headings du body pour highlighter
// celui actuellement visible dans l'outline. On utilise IntersectionObserver
// avec un rootMargin negatif en haut pour prendre le heading "en train
// d'entrer" dans le tiers superieur du viewport.
let outlineObserver: IntersectionObserver | null = null
function setupScrollSpy() {
  if (outlineObserver) {
    outlineObserver.disconnect()
    outlineObserver = null
  }
  if (!bodyRef.value || headings.value.length === 0) return
  const nodes = bodyRef.value.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
  if (!nodes.length) return

  // Map id -> heading index pour pouvoir resoudre le plus haut visible
  const visible = new Set<string>()

  outlineObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = entry.target.id
        if (!id) continue
        if (entry.isIntersecting) visible.add(id)
        else visible.delete(id)
      }
      // Le heading actif = le premier visible dans l'ordre du document.
      // On tombe dans ce cas sur tous les headings qui ont un rect dans
      // la zone d'intersection (les 40% du haut).
      for (const h of headings.value) {
        if (visible.has(h.id)) {
          activeHeadingId.value = h.id
          return
        }
      }
    },
    {
      root: bodyRef.value,
      // On ne prend en compte que le tiers superieur du viewport : un
      // heading devient "actif" quand il touche cette zone. Evite que
      // tous les headings visibles clignotent en meme temps.
      rootMargin: '0px 0px -60% 0px',
      threshold: 0,
    },
  )
  nodes.forEach((el) => outlineObserver?.observe(el))
}

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
    headings.value = []
    return
  }
  if (!bodyRef.value) return
  injectCopyButtons(bodyRef.value)
  headings.value = extractHeadings(bodyRef.value)
  // v2.77 : setup scroll spy apres l'extraction. On attend le prochain
  // tick pour que le DOM soit stabilise avant de poser l'observer.
  nextTick(() => setupScrollSpy())
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
  document.addEventListener('keydown', onLumenKeyboard)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKey)
  document.removeEventListener('keydown', onLumenKeyboard)
  outlineObserver?.disconnect()
  outlineObserver = null
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
          <button
            v-if="!isPdf"
            type="button"
            class="lumen-viewer-chip lumen-viewer-chip--light-toggle"
            :title="readingLight ? 'Mode sombre' : 'Mode clair'"
            @click="readingLight = !readingLight"
          >
            <Sun v-if="readingLight" :size="11" />
            <Moon v-else :size="11" />
          </button>
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

      <!-- Rendu Jupyter Notebook -->
      <div v-else-if="isIpynb" class="lumen-viewer-main lumen-viewer-main--ipynb">
        <div class="lumen-viewer-body markdown-body" :class="{ 'lumen-reading-light': readingLight }" v-html="ipynbHtml" />
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
              height="100%"
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
  background: var(--bg-primary);
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
.lumen-viewer-chip--link-copy {
  color: var(--text-muted);
  border-color: var(--border);
}
.lumen-viewer-chip--link-copy:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.lumen-viewer-chip--link-copy.copied {
  color: var(--color-success);
  border-color: rgba(46, 204, 113, .4);
  background: rgba(46, 204, 113, .1);
}
.lumen-viewer-chip--print {
  color: var(--text-muted);
  border-color: var(--border);
}
.lumen-viewer-chip--print:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
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
  border-radius: 6px;
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
  border-radius: 6px;
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
  background: var(--color-success, #2ea043);
  color: white;
  border-color: var(--color-success, #2ea043);
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
  border-radius: 6px;
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
  display: flex;
  flex-direction: column;
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
  border-radius: 6px;
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
  border-radius: 6px;
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
  color: var(--danger, #e74c3c);
  background: rgba(231, 76, 60, 0.08);
  padding: 8px;
  border-radius: 4px;
}
.ipynb-img {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
}
.ipynb-svg { max-width: 100%; overflow: auto; }
.ipynb-html-output { overflow-x: auto; font-size: 13px; }
.ipynb-parse-error {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
}

/* Mode lecture clair */
.lumen-viewer-chip--light-toggle {
  color: var(--text-muted);
  border-color: var(--border);
}
.lumen-viewer-chip--light-toggle:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.lumen-reading-light {
  background: #faf9f7 !important;
  color: #1a1a1a !important;
}
.lumen-reading-light :deep(h1),
.lumen-reading-light :deep(h2),
.lumen-reading-light :deep(h3),
.lumen-reading-light :deep(h4),
.lumen-reading-light :deep(h5),
.lumen-reading-light :deep(h6) {
  color: #111 !important;
}
.lumen-reading-light :deep(a) {
  color: #1a73e8 !important;
}
.lumen-reading-light :deep(code):not(:deep(pre) code) {
  background: rgba(0, 0, 0, 0.06) !important;
  color: #c7254e !important;
}
.lumen-reading-light :deep(blockquote) {
  border-color: #ddd !important;
  color: #555 !important;
}
.lumen-reading-light :deep(table) td,
.lumen-reading-light :deep(table) th {
  border-color: #ddd !important;
}
.lumen-reading-light :deep(hr) {
  border-color: #ddd !important;
}

.lumen-viewer-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg) 48px var(--space-md);
  max-width: 820px;
  width: 100%;
  margin: 0 auto;
}
@media (max-width: 1400px) {
  .lumen-viewer-body {
    padding: var(--space-lg) 24px var(--space-md);
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
  font-size: 32px;
  margin-bottom: var(--space-xl);
  padding-bottom: var(--space-md);
  border-bottom: 3px solid var(--accent);
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
}
.lumen-breadcrumbs-link:hover { color: var(--accent); text-decoration: underline; }
.lumen-breadcrumbs-current {
  color: var(--text-primary);
  font-weight: 700;
  font-size: 16px;
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
  margin: 8px 48px 0;
  padding: 10px 14px;
  background: rgba(217, 138, 0, 0.12);
  border: 1px solid rgba(217, 138, 0, 0.35);
  border-radius: 8px;
  font-size: 13px;
  color: var(--warning, #d98a00);
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
  margin: 24px 48px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--success, #4caf50) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--success, #4caf50) 25%, transparent);
  color: var(--success, #4caf50);
  font-size: 14px;
  font-weight: 600;
}
@supports not (color: color-mix(in srgb, white, black)) {
  .lumen-end-of-course { background: var(--bg-hover); border-color: var(--border); }
}
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
  opacity: 0.4;
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
  background: var(--code-bg, #1a1d23);
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
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--code-lang-color, rgba(255, 255, 255, 0.6));
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
  color: var(--code-text, #e8e9ea);
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
</style>
