<script setup lang="ts">
/**
 * Sidebar Lumen : liste des repos de la promo avec leurs chapitres, groupes
 * par section (derivee du champ `chapter.section` du manifest, ou "Chapitres"
 * par defaut).
 *
 * Supporte :
 * - Filtre par nom de projet / chapitre
 * - Click repo : collapse/expand
 * - Click chapitre : selection + emission de l'event
 * - Affichage erreur manifest
 * - Badge "lu"/"note" sur chaque chapitre
 * - Progress count par repo
 * - Toggle visibilite etudiant (teacher/admin uniquement) : eye icon
 * - Badge "auto" quand le manifest est genere automatiquement
 */
import { ref, computed, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { FileText, FileDown, FileCode, AlertTriangle, StickyNote, Search, X, Eye, EyeOff, BookOpen, Presentation, Lightbulb, Wrench, Hammer, Folder, Plus, Loader2, ChevronsDown, ChevronsUp, ChevronRight } from 'lucide-vue-next'
import type { Component } from 'vue'
import { useLumenStore } from '@/stores/lumen'
import { useToast } from '@/composables/useToast'
import { chapterKey } from '@/utils/lumenDevoirLinks'
import type { LumenRepo, LumenChapter, LumenSearchResult, LumenRepoKind } from '@/types'
import Modal from '@/components/ui/Modal.vue'

interface Props {
  repos: LumenRepo[]
  currentRepoId: number | null
  currentChapterPath: string | null
  notedChapters: Set<string>
  canToggleVisibility?: boolean
  /** Promo courante — necessaire pour la recherche fulltext FTS5 (v2.49). */
  promoId?: number | null
}
interface Emits {
  (e: 'select', payload: { repoId: number; path: string }): void
  (e: 'toggle-visibility', payload: { repoId: number; visible: boolean }): void
}
const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const filter = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

/**
 * Focus le champ de recherche. Expose via defineExpose pour que LumenView
 * puisse y attacher un raccourci global "/" (v2.73).
 */
function focusSearch(): void {
  searchInputRef.value?.focus()
  searchInputRef.value?.select()
}
defineExpose({ focusSearch })

// v2.73 : scroll l'item actif en vue quand il change (ex: navigation
// prev/next, ou clic sur un lien cross-repo lumen://). Sans ca, on peut
// cliquer Next plusieurs fois et perdre l'element selectionne hors
// viewport de la sidebar.
watch(() => [props.currentRepoId, props.currentChapterPath], async () => {
  await nextTick()
  const active = document.querySelector<HTMLElement>('.lumen-chapter-item.is-active')
  if (active) {
    active.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
})

/**
 * Extrait le prefixe numerique d'un nom de repo, ex: "0-Mathematiques" -> 0,
 * "4-Programmation-Web" -> 4, "Astruc-Sebastien" -> Infinity. Permet de trier
 * les blocs CESI dans l'ordre prevu (0, 1, 2, 3, 4, ...) plutot qu'en
 * lexical (qui mettrait "10-foo" avant "2-bar"). v2.66.
 */
function extractRepoNumericPrefix(repo: LumenRepo): number {
  const name = repo.repo ?? repo.fullName.split('/').pop() ?? ''
  const m = name.match(/^(\d+)[-_.]/)
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY
}

/**
 * Affiche un nom de repo plus humain en retirant le prefixe numerique :
 * "0-Mathematiques" -> "Mathematiques", "4-Programmation-Web" -> "Programmation Web".
 * Si pas de prefixe ou si le manifest expose un `project` lisible, on garde
 * le project name du manifest tel quel.
 */
function displayRepoName(repo: LumenRepo): string {
  if (repo.manifest?.project) return repo.manifest.project
  const name = repo.repo ?? repo.fullName.split('/').pop() ?? repo.fullName
  return name.replace(/^\d+[-_.]/, '').replace(/[-_]+/g, ' ')
}

// Lumen = cours uniquement. On exclut les repos etudiants, groupes et le
// repo .github (readme) qui est accessible via le bouton Accueil dans la topbar.
const HIDDEN_KINDS = new Set<LumenRepoKind>(['student', 'group', 'readme'])

const sortedRepos = computed(() => [...props.repos]
  .filter((r) => !HIDDEN_KINDS.has(r.manifest?.kind as LumenRepoKind))
  .sort((a, b) => {
    // 1. Prefixe numerique en premier (0-Math, 1-SE, 2-POO, ...)
    const pa = extractRepoNumericPrefix(a)
    const pb = extractRepoNumericPrefix(b)
    if (pa !== pb) return pa - pb
    // 2. Tie-break alphabetique sur le fullName
    return a.fullName.localeCompare(b.fullName)
  }))

interface SectionGroup {
  title: string
  chapters: LumenChapter[]
  /** Somme des durees des chapitres de cette section (minutes). 0 si aucun. */
  totalDuration: number
}

/**
 * Decompose un titre de section "A · B · C" en { parent: "A · B", child: "C" }.
 * Utilise pour afficher le parent en prefixe muted plus petit et le child
 * en label principal (v2.67.2) — evite la repetition visuelle dans la
 * sidebar quand plusieurs sections partagent le meme parent dossier.
 */
function splitSectionTitle(title: string): { parent: string; child: string } {
  const idx = title.lastIndexOf(' · ')
  if (idx === -1) return { parent: '', child: title }
  return { parent: title.slice(0, idx), child: title.slice(idx + 3) }
}

/**
 * Groupe une liste de chapitres par section. Les sections sont triees par
 * leur prefixe numerique (si present) puis alphabetiquement — evite que
 * "02 Labs" passe avant "01 Fundamentals" quand l'ordre des fichiers dans
 * le manifest est arbitraire. Les chapitres sans champ `section` tombent
 * dans un bucket "Chapitres".
 *
 * Le prefixe numerique est extrait du DEBUT de la section (ex: "01 Fundamentals"
 * -> 1, "02 Labs · Lab01" -> 2). Les sections sans prefixe tombent apres
 * les sections prefixees, triees alphabetiquement entre elles.
 */
function sectionSortKey(title: string): { num: number; title: string } {
  const m = title.match(/^(\d+)/)
  return {
    num: m ? Number(m[1]) : Number.POSITIVE_INFINITY,
    title: title.toLowerCase(),
  }
}

function groupBySection(chapters: LumenChapter[]): SectionGroup[] {
  const map = new Map<string, LumenChapter[]>()
  for (const ch of chapters) {
    const key = ch.section?.trim() || 'Chapitres'
    const existing = map.get(key)
    if (existing) existing.push(ch)
    else map.set(key, [ch])
  }
  return Array.from(map.entries())
    .map(([title, chs]) => ({
      title,
      chapters: chs,
      totalDuration: chs.reduce((sum, c) => sum + (c.duration ?? 0), 0),
    }))
    .sort((a, b) => {
      const ka = sectionSortKey(a.title)
      const kb = sectionSortKey(b.title)
      if (ka.num !== kb.num) return ka.num - kb.num
      return ka.title.localeCompare(kb.title)
    })
}

/**
 * Format une duree en minutes vers "1h30", "45 min", "2h", "5 min", etc.
 * Retourne null si la duree est 0 ou negative (pas d'affichage).
 */
function formatDuration(minutes: number): string | null {
  if (!minutes || minutes <= 0) return null
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

interface FilteredRepo {
  repo: LumenRepo
  groups: SectionGroup[]
  chaptersCount: number
}

const filteredRepos = computed<FilteredRepo[]>(() => {
  const needle = filter.value.trim().toLowerCase()
  const out: FilteredRepo[] = []
  for (const repo of sortedRepos.value) {
    const chapters = repo.manifest?.chapters ?? []
    if (!needle) {
      out.push({ repo, groups: groupBySection(chapters), chaptersCount: chapters.length })
      continue
    }
    const projectName = (repo.manifest?.project ?? repo.fullName).toLowerCase()
    const repoMatches = projectName.includes(needle)
    const matching = chapters.filter((c) =>
      c.title.toLowerCase().includes(needle)
      || c.path.toLowerCase().includes(needle)
      || (c.section ?? '').toLowerCase().includes(needle),
    )
    if (repoMatches) {
      out.push({ repo, groups: groupBySection(chapters), chaptersCount: chapters.length })
    } else if (matching.length) {
      out.push({ repo, groups: groupBySection(matching), chaptersCount: matching.length })
    }
  }
  return out
})

// ── Groupement par kind (v2.63) ──────────────────────────────────────────
// Les repos sont regroupes par categorie (cours, prosits, workshops...)
// dans un ordre canonique. README en premier (epingle "Accueil promo"),
// puis cours/prosits/workshops/mini-projets/projets/groupes.

// Seuls les kinds pedagogiques apparaissent dans la sidebar.
const KIND_ORDER: LumenRepoKind[] = [
  'course',
  'prosit',
  'workshop',
  'miniproject',
  'project',
]

const KIND_LABELS: Partial<Record<LumenRepoKind, string>> = {
  course:      'Cours',
  prosit:      'Prosits',
  workshop:    'Workshops',
  miniproject: 'Mini-projets',
  project:     'Projets',
}

const KIND_ICONS: Partial<Record<LumenRepoKind, Component>> = {
  course:      BookOpen,
  prosit:      Lightbulb,
  workshop:    Wrench,
  miniproject: Hammer,
  project:     Folder,
}

interface RepoSection {
  kind: LumenRepoKind
  label: string
  icon: Component
  repos: FilteredRepo[]
}

const groupedRepos = computed<RepoSection[]>(() => {
  // Buckets par kind. Defaut 'course' si manquant (couvre les anciens
  // manifests pre-v2.63 jusqu'au prochain sync).
  const buckets = new Map<LumenRepoKind, FilteredRepo[]>()
  for (const fr of filteredRepos.value) {
    const k: LumenRepoKind = fr.repo.manifest?.kind ?? 'course'
    if (!buckets.has(k)) buckets.set(k, [])
    buckets.get(k)!.push(fr)
  }
  return KIND_ORDER
    .filter((k) => buckets.has(k))
    .map((k) => ({
      kind: k,
      label: KIND_LABELS[k] ?? k,
      icon: KIND_ICONS[k] ?? BookOpen,
      repos: buckets.get(k)!,
    }))
})

// Sections collapsible : v2.76 on persiste maintenant en localStorage.
// Format : une chaine comma-separated des kinds collapsed (ex: "prosit,group").
const COLLAPSED_KINDS_KEY = 'lumen.sidebar.collapsedKinds'
function loadCollapsedKinds(): Set<LumenRepoKind> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KINDS_KEY)
    if (!raw) return new Set()
    const parts = raw.split(',').filter((k): k is LumenRepoKind =>
      KIND_ORDER.includes(k as LumenRepoKind),
    )
    return new Set(parts)
  } catch { return new Set() }
}
const collapsedKinds = ref<Set<LumenRepoKind>>(loadCollapsedKinds())
function saveCollapsedKinds(set: Set<LumenRepoKind>): void {
  try {
    localStorage.setItem(COLLAPSED_KINDS_KEY, Array.from(set).join(','))
  } catch { /* quota exceeded ou private mode */ }
}
function toggleKind(k: LumenRepoKind): void {
  const next = new Set(collapsedKinds.value)
  if (next.has(k)) next.delete(k)
  else next.add(k)
  collapsedKinds.value = next
  saveCollapsedKinds(next)
}

// v2.78 : toggle global "tout deplier / tout replier" les sections.
// Heuristique : si au moins une section est repliee, on deplie TOUT.
// Sinon on replie TOUT.
const allSectionsCollapsed = computed<boolean>(() => {
  // True si toutes les kinds presentes dans groupedRepos sont dans
  // le Set. On ne compte pas les kinds vides.
  return groupedRepos.value.length > 0
    && groupedRepos.value.every((s) => collapsedKinds.value.has(s.kind))
})
function toggleAllSections(): void {
  if (collapsedKinds.value.size === 0) {
    // Tout deplie -> on replie tout
    const all = new Set<LumenRepoKind>(groupedRepos.value.map((s) => s.kind))
    collapsedKinds.value = all
    saveCollapsedKinds(all)
  } else {
    // Au moins une repliee -> on deplie tout
    collapsedKinds.value = new Set()
    saveCollapsedKinds(new Set())
  }
}

// ── Repos collapsibles (v2.100) ──────────────────────────────────────────
// Chaque repo peut etre replie individuellement. Persiste en localStorage.
const COLLAPSED_REPOS_KEY = 'lumen.sidebar.collapsedRepos'
function loadCollapsedRepos(): Set<number> {
  try {
    const raw = localStorage.getItem(COLLAPSED_REPOS_KEY)
    if (!raw) return new Set()
    return new Set(raw.split(',').map(Number).filter(Boolean))
  } catch { return new Set() }
}
const collapsedRepos = ref<Set<number>>(loadCollapsedRepos())
function saveCollapsedRepos(set: Set<number>): void {
  try { localStorage.setItem(COLLAPSED_REPOS_KEY, Array.from(set).join(',')) } catch { /* noop */ }
}
function toggleRepo(repoId: number): void {
  const next = new Set(collapsedRepos.value)
  if (next.has(repoId)) next.delete(repoId)
  else next.add(repoId)
  collapsedRepos.value = next
  saveCollapsedRepos(next)
}

// ── Recherche fulltext FTS5 (v2.49) ──────────────────────────────────────
// Le champ filter a double usage :
//   1. Filtrage local instantane sur les TITRES de chapitres (ancien pattern)
//   2. Recherche fulltext sur le CONTENU via FTS5, debouncee 300ms, cross-repos
// Les deux jeux de resultats s'affichent cote a cote : la recherche fulltext
// apparait au-dessus de la liste filtree quand un query est actif.

const lumenStore = useLumenStore()
const { marpChapters, myReads } = storeToRefs(lumenStore)

function repoReadProgress(repo: LumenRepo): { read: number; total: number } {
  const chapters = repo.manifest?.chapters ?? []
  const total = chapters.length
  if (!total) return { read: 0, total: 0 }
  let read = 0
  for (const ch of chapters) {
    if (myReads.value.has(`${repo.id}::${ch.path}`)) read++
  }
  return { read, total }
}
const searchResults = ref<LumenSearchResult[]>([])
const searchInFlight = ref(false)
let searchDebounce: ReturnType<typeof setTimeout> | null = null

watch([filter, () => props.promoId], ([needle, pid]) => {
  if (searchDebounce) clearTimeout(searchDebounce)
  if (!pid || !needle || needle.trim().length < 2) {
    searchResults.value = []
    searchInFlight.value = false
    return
  }
  searchInFlight.value = true
  searchDebounce = setTimeout(async () => {
    try {
      searchResults.value = await lumenStore.searchChapters(pid, needle.trim(), 20)
    } finally {
      searchInFlight.value = false
    }
  }, 300)
})

function handleToggleVisibility(repo: LumenRepo, e: Event) {
  e.stopPropagation()
  emit('toggle-visibility', { repoId: repo.id, visible: !repo.isVisible })
}

function handleSelectSearchResult(r: LumenSearchResult) {
  emit('select', { repoId: r.repoId, path: r.chapterPath })
}

// ── Nouveau chapitre (v2.68) ──────────────────────────────────────────────
// Modale accessible via un bouton "+" en regard de chaque section (teacher
// only). Permet de creer un .md dans le meme dossier que les autres
// chapitres de la section. Le commit est pose via l'IPC createLumenChapterFile.
const { showToast } = useToast()

interface NewChapterContext {
  repo: LumenRepo
  sectionTitle: string
  sectionDir: string   // derive du 1er chapitre de la section
}

const newChapterOpen = ref(false)
const newChapterCtx = ref<NewChapterContext | null>(null)
const newTitle = ref('')
const newFilename = ref('')
const newMessage = ref('')
const newFilenameManual = ref(false)  // user a edite manuellement le filename
const newSaving = ref(false)

/**
 * Retourne le dossier d'une section — derive du premier chapitre de la
 * section. Un section sans chapitre est impossible (on ne peut creer dans
 * un dossier vide qu'on ne voit pas).
 */
function dirOfSection(group: SectionGroup): string {
  const firstPath = group.chapters[0]?.path ?? ''
  const slash = firstPath.lastIndexOf('/')
  return slash === -1 ? '' : firstPath.slice(0, slash)
}

/**
 * Slugify un titre en filename : lowercase, espaces -> -, supprime
 * les caracteres non [a-z0-9-]. Suffix .md. Retourne '' si le titre est
 * vide pour laisser le bouton Creer desactive.
 */
function slugifyTitleToFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // retire les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (!slug) return ''
  return `${slug}.md`
}

function openNewChapterModal(repo: LumenRepo, group: SectionGroup): void {
  newChapterCtx.value = {
    repo,
    sectionTitle: group.title,
    sectionDir: dirOfSection(group),
  }
  newTitle.value = ''
  newFilename.value = ''
  newFilenameManual.value = false
  newMessage.value = ''
  newChapterOpen.value = true
}

function closeNewChapterModal(): void {
  if (newSaving.value) return
  newChapterOpen.value = false
  newChapterCtx.value = null
}

watch(newTitle, (t) => {
  if (newFilenameManual.value) return
  newFilename.value = slugifyTitleToFilename(t)
})
function onFilenameInput(): void { newFilenameManual.value = true }

const newChapterPath = computed<string>(() => {
  if (!newChapterCtx.value) return ''
  const dir = newChapterCtx.value.sectionDir
  const name = newFilename.value.trim()
  if (!name) return ''
  return dir ? `${dir}/${name}` : name
})

const canCreateChapter = computed<boolean>(() => {
  return !newSaving.value
    && newTitle.value.trim().length > 0
    && /\.md$/i.test(newFilename.value)
    && newChapterPath.value.length > 0
})

async function saveNewChapter(): Promise<void> {
  if (!canCreateChapter.value || !newChapterCtx.value) return
  const { repo, sectionTitle } = newChapterCtx.value
  const path = newChapterPath.value
  const title = newTitle.value.trim()
  // Skeleton minimal — le prof completera ensuite via "Modifier"
  const content = `# ${title}\n\nContenu du chapitre.\n`
  const message = newMessage.value.trim() || `docs: add ${path}`

  newSaving.value = true
  try {
    const resp = await window.api.createLumenChapterFile(repo.id, {
      path, content, message,
    }) as { ok: boolean; error?: string }
    if (!resp?.ok) {
      const msg = resp?.error || 'Echec de la creation'
      showToast(msg, 'error')
      return
    }
    showToast(`Chapitre cree : ${title}`, 'success')
    newChapterOpen.value = false
    newChapterCtx.value = null
    // Re-sync le repo pour que l'auto-manifest decouvre le nouveau fichier
    try {
      await lumenStore.syncReposForPromo(repo.promoId)
    } catch { /* si sync echoue, le prochain sync manuel prendra le relais */ }
    // Selectionne le nouveau chapitre pour ouvrir immediatement le viewer
    emit('select', { repoId: repo.id, path })
    void sectionTitle  // lint suppress (l'info est dans le toast)
  } catch (err) {
    const msg = (err as { message?: string })?.message || 'Erreur reseau'
    showToast(msg, 'error')
  } finally {
    newSaving.value = false
  }
}
</script>

<template>
  <div class="lumen-sidebar-nav">
    <!-- Champ recherche : filtre titres + recherche fulltext FTS5 (v2.49).
         Toujours visible quand au moins 2 repos (ancien seuil >= 5 obsolete :
         la recherche fulltext apporte de la valeur meme avec peu de repos). -->
    <div v-if="sortedRepos.length >= 2" class="lumen-sidebar-filter">
      <Search :size="12" />
      <input
        ref="searchInputRef"
        v-model="filter"
        type="text"
        placeholder="Rechercher dans les cours... (/)"
        aria-label="Rechercher dans les cours"
      />
      <button
        v-if="filter"
        type="button"
        class="lumen-sidebar-clear"
        aria-label="Effacer la recherche"
        @click="filter = ''"
      >
        <X :size="12" />
      </button>
      <button
        type="button"
        class="lumen-sidebar-toggle-all"
        :title="allSectionsCollapsed ? 'Tout deplier' : 'Tout replier'"
        :aria-label="allSectionsCollapsed ? 'Deplier toutes les sections' : 'Replier toutes les sections'"
        @click="toggleAllSections"
      >
        <component :is="allSectionsCollapsed ? ChevronsDown : ChevronsUp" :size="12" />
      </button>
    </div>

    <!-- Resultats recherche fulltext : visible uniquement quand un query
         actif a retourne des matches. L'utilisateur voit directement les
         snippets contextualises, peut cliquer pour ouvrir le chapitre. -->
    <section
      v-if="filter.trim().length >= 2 && searchResults.length > 0"
      class="lumen-search-results"
      aria-label="Resultats de recherche"
      aria-live="polite"
    >
      <header class="lumen-search-head">
        <BookOpen :size="11" />
        <span>Dans le contenu ({{ searchResults.length }})</span>
      </header>
      <ul class="lumen-search-list">
        <li v-for="r in searchResults" :key="`${r.repoId}::${r.chapterPath}`">
          <button
            type="button"
            class="lumen-search-item"
            :class="{
              'is-active': currentRepoId === r.repoId && currentChapterPath === r.chapterPath,
            }"
            @click="handleSelectSearchResult(r)"
          >
            <span class="lumen-search-item-repo">{{ r.repoName }}</span>
            <span class="lumen-search-item-title">{{ r.chapterTitle }}</span>
            <!-- Le snippet est echappe HTML cote serveur via la strategie
                 sentinel : FTS5 utilise des sentinels Unicode invisibles,
                 le serveur escape() puis substitue par <mark>. v-html safe. -->
            <span class="lumen-search-item-snippet" v-html="r.snippet" />
          </button>
        </li>
      </ul>
    </section>

    <p
      v-else-if="filter.trim().length >= 2 && !searchInFlight && searchResults.length === 0 && promoId"
      class="lumen-search-empty"
    >
      Aucun resultat dans le contenu des cours.
    </p>

    <nav class="lumen-sidebar-repos" aria-label="Cours">
      <p v-if="sortedRepos.length === 0" class="lumen-sidebar-empty">
        Aucun repo synchronise.
      </p>
      <p v-else-if="filteredRepos.length === 0 && filter.trim().length >= 2" class="lumen-sidebar-empty">
        Aucun cours ne correspond a "{{ filter }}".
        <template v-if="searchResults.length > 0">
          Consulte les resultats dans le contenu ci-dessus.
        </template>
      </p>
      <p v-else-if="filteredRepos.length === 0" class="lumen-sidebar-empty">
        Aucun resultat pour "{{ filter }}".
      </p>
      <div v-else class="lumen-kind-sections">
        <section
          v-for="section in groupedRepos"
          :key="section.kind"
          class="lumen-kind-section"
          :class="{ 'is-collapsed': collapsedKinds.has(section.kind) }"
        >
          <button
            type="button"
            class="lumen-kind-header"
            :aria-expanded="!collapsedKinds.has(section.kind)"
            @click="toggleKind(section.kind)"
          >
            <component :is="section.icon" :size="13" class="lumen-kind-icon" />
            <span class="lumen-kind-label">{{ section.label }}</span>
            <span class="lumen-kind-count">{{ section.repos.length }}</span>
          </button>
          <ul v-show="!collapsedKinds.has(section.kind)" class="lumen-repo-list">
            <li
              v-for="{ repo, groups } in section.repos"
              :key="repo.id"
              class="lumen-repo-item"
              :class="{ 'is-hidden-repo': canToggleVisibility && !repo.isVisible }"
            >
          <div class="lumen-repo-row">
            <button
              type="button"
              class="lumen-repo-header"
              :class="{ 'has-error': repo.manifestError }"
              :aria-expanded="!collapsedRepos.has(repo.id)"
              @click="toggleRepo(repo.id)"
            >
              <ChevronRight :size="11" class="lumen-repo-chevron" :class="{ open: !collapsedRepos.has(repo.id) }" />
              <span class="lumen-repo-name">{{ displayRepoName(repo) }}</span>
              <span
                v-if="repoReadProgress(repo).total > 0"
                class="lumen-repo-progress"
                :title="`${repoReadProgress(repo).read}/${repoReadProgress(repo).total} chapitres lus`"
              >{{ repoReadProgress(repo).read }}/{{ repoReadProgress(repo).total }}</span>
              <AlertTriangle v-if="repo.manifestError" :size="13" class="lumen-repo-warning" />
            </button>
            <button
              v-if="canToggleVisibility"
              type="button"
              class="lumen-repo-visibility"
              :class="{ 'is-visible': repo.isVisible }"
              :aria-label="repo.isVisible ? 'Masquer aux etudiants' : 'Publier pour les etudiants'"
              :title="repo.isVisible ? 'Visible par les etudiants — cliquer pour masquer' : 'Masque aux etudiants — cliquer pour publier'"
              @click="handleToggleVisibility(repo, $event)"
            >
              <component :is="repo.isVisible ? Eye : EyeOff" :size="13" />
            </button>
          </div>

          <!-- Banner inline manifestError : message simplifie pour les etudiants -->
          <p v-if="repo.manifestError && !collapsedRepos.has(repo.id)" class="lumen-repo-error-banner" role="status" :title="repo.manifestError">
            <AlertTriangle :size="11" />
            <span>Ce cours a un probleme de configuration. Contacte ton enseignant.</span>
          </p>

          <div v-show="!collapsedRepos.has(repo.id)" class="lumen-repo-body">
            <div v-for="group in groups" :key="group.title" class="lumen-section">
              <div class="lumen-section-row">
                <p class="lumen-section-title">
                  <span v-if="splitSectionTitle(group.title).parent" class="lumen-section-parent">
                    {{ splitSectionTitle(group.title).parent }}
                  </span>
                  <span class="lumen-section-child">
                    {{ splitSectionTitle(group.title).child }}
                  </span>
                </p>
                <span
                  v-if="formatDuration(group.totalDuration)"
                  class="lumen-section-duration"
                  :title="`Duree totale : ${group.totalDuration} min (${group.chapters.length} chapitres)`"
                >
                  {{ formatDuration(group.totalDuration) }}
                </span>
                <button
                  v-if="canToggleVisibility"
                  type="button"
                  class="lumen-section-add"
                  title="Nouveau chapitre dans cette section"
                  aria-label="Ajouter un chapitre a cette section"
                  @click="openNewChapterModal(repo, group)"
                >
                  <Plus :size="11" />
                </button>
              </div>
              <ul class="lumen-chapter-list">
                <li v-for="ch in group.chapters" :key="ch.path">
                  <button
                    type="button"
                    class="lumen-chapter-item"
                    :class="{
                      'is-active': currentRepoId === repo.id && currentChapterPath === ch.path,
                      'is-read': myReads.has(`${repo.id}::${ch.path}`),
                    }"
                    @click="emit('select', { repoId: repo.id, path: ch.path })"
                  >
                    <!-- Icone selon le format du chapitre (v2.64). Marp prime
                         sur tout : un .md detecte avec frontmatter `marp: true`
                         affiche l'icone Presentation. -->
                    <Presentation
                      v-if="marpChapters.has(chapterKey(repo.id, ch.path))"
                      :size="12"
                      class="lumen-chapter-icon lumen-chapter-icon--marp"
                      aria-label="Presentation Marp"
                    />
                    <FileDown
                      v-else-if="ch.kind === 'pdf' || ch.path.toLowerCase().endsWith('.pdf')"
                      :size="12"
                      class="lumen-chapter-icon lumen-chapter-icon--pdf"
                      aria-label="Document PDF"
                    />
                    <FileCode
                      v-else-if="ch.kind === 'tex' || ch.path.toLowerCase().endsWith('.tex')"
                      :size="12"
                      class="lumen-chapter-icon lumen-chapter-icon--tex"
                      aria-label="Source LaTeX"
                    />
                    <FileText v-else :size="12" class="lumen-chapter-icon" />
                    <span class="lumen-chapter-title">{{ ch.title }}</span>
                    <span v-if="ch.duration" class="lumen-chapter-duration" :title="`~${ch.duration} minutes`">
                      {{ ch.duration }}<span class="lumen-chapter-duration-unit">m</span>
                    </span>
                    <StickyNote v-if="notedChapters.has(chapterKey(repo.id, ch.path))" :size="11" class="lumen-chapter-noted" />
                  </button>
                </li>
              </ul>
            </div>
          </div>
            </li>
          </ul>
        </section>
      </div>
    </nav>

    <!-- Modale "Nouveau chapitre" (v2.68) — teacher only, via le + de section -->
    <Modal v-model="newChapterOpen" max-width="520px">
      <div class="lumen-new-chapter">
        <header class="lumen-new-head">
          <div>
            <h2 class="lumen-new-title">Nouveau chapitre</h2>
            <p v-if="newChapterCtx" class="lumen-new-sub">
              dans <strong>{{ newChapterCtx.sectionTitle }}</strong>
            </p>
          </div>
          <button
            type="button"
            class="lumen-new-close"
            aria-label="Fermer"
            :disabled="newSaving"
            @click="closeNewChapterModal"
          >
            <X :size="16" />
          </button>
        </header>
        <div class="lumen-new-body">
          <label class="lumen-new-label">
            Titre du chapitre
            <input
              v-model="newTitle"
              type="text"
              class="form-input"
              placeholder="Ex: Introduction aux routeurs"
              maxlength="200"
              @keydown.enter.prevent="saveNewChapter"
            />
          </label>
          <label class="lumen-new-label">
            Nom de fichier
            <input
              v-model="newFilename"
              type="text"
              class="form-input"
              placeholder="introduction-routeurs.md"
              maxlength="200"
              @input="onFilenameInput"
            />
          </label>
          <p v-if="newChapterPath" class="lumen-new-path">
            <span class="lumen-new-path-label">Chemin complet :</span>
            <code>{{ newChapterPath }}</code>
          </p>
          <label class="lumen-new-label">
            Message de commit (optionnel)
            <input
              v-model="newMessage"
              type="text"
              class="form-input"
              :placeholder="`docs: add ${newChapterPath || 'nouveau-chapitre.md'}`"
              maxlength="200"
            />
          </label>
        </div>
        <footer class="lumen-new-foot">
          <button type="button" class="btn-ghost" :disabled="newSaving" @click="closeNewChapterModal">
            Annuler
          </button>
          <button type="button" class="btn-primary" :disabled="!canCreateChapter" @click="saveNewChapter">
            <Loader2 v-if="newSaving" :size="14" class="spin" />
            <Plus v-else :size="14" />
            {{ newSaving ? 'Creation...' : 'Creer' }}
          </button>
        </footer>
      </div>
    </Modal>
  </div>
</template>

<style scoped>
.lumen-sidebar-nav {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.lumen-sidebar-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  margin: 6px 10px 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.lumen-sidebar-filter:focus-within {
  border-color: var(--accent);
  color: var(--text-primary);
}
.lumen-sidebar-filter input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 12px;
  min-width: 0;
}
.lumen-sidebar-filter input::placeholder { color: var(--text-muted); }
.lumen-sidebar-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  display: flex;
  align-items: center;
  border-radius: 3px;
}
.lumen-sidebar-clear:hover { color: var(--text-primary); background: var(--bg-hover); }

.lumen-sidebar-repos {
  padding: 4px 0;
  overflow-y: auto;
  flex: 1;
}

/* ── Resultats recherche fulltext FTS5 (v2.49) ──────────────────────────── */
.lumen-search-results {
  margin: 4px 10px;
  padding: 6px 0;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  max-height: 45vh;
  overflow-y: auto;
  flex-shrink: 0;
}
.lumen-search-head {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px 6px;
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}
.lumen-search-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
}
.lumen-search-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 6px 10px;
  background: none;
  border: none;
  border-left: 2px solid transparent;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: all var(--t-fast) ease;
}
.lumen-search-item:hover {
  background: var(--bg-hover);
  border-left-color: var(--accent);
}
.lumen-search-item.is-active {
  background: var(--bg-selected, var(--bg-hover));
  border-left-color: var(--accent);
}
.lumen-search-item-repo {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lumen-search-item-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lumen-search-item-snippet {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.lumen-search-item-snippet :deep(mark) {
  background: rgba(255, 200, 0, 0.3);
  color: inherit;
  padding: 0 1px;
  border-radius: 2px;
  font-weight: 600;
}

.lumen-search-empty {
  margin: 4px 10px;
  padding: 12px;
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-primary);
  border: 1px dashed var(--border);
  border-radius: 6px;
  flex-shrink: 0;
}

.lumen-sidebar-empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.lumen-repo-list { list-style: none; margin: 0; padding: 0; }
.lumen-chapter-list { list-style: none; margin: 0; padding: 0; }

.lumen-repo-item { margin-bottom: 1px; }
.lumen-repo-item.is-hidden-repo {
  opacity: 0.55;
}
.lumen-repo-item.is-hidden-repo .lumen-repo-name::after {
  content: ' (masque)';
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: none;
  letter-spacing: 0;
}

.lumen-repo-row {
  display: flex;
  align-items: stretch;
}

/* Header repo : cliquable pour toggle collapse (v2.100) */
.lumen-repo-header {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  padding: 6px 4px 2px 6px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-align: left;
  min-width: 0;
}
.lumen-repo-header:hover { color: var(--accent); }
.lumen-repo-header.has-error { color: var(--text-muted); }

.lumen-repo-chevron {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: transform 0.15s ease;
}
.lumen-repo-chevron.open { transform: rotate(90deg); }

.lumen-repo-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lumen-repo-progress {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.lumen-repo-visibility {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  padding: 0 6px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  flex-shrink: 0;
  border-radius: 3px;
  transition: all var(--t-fast) ease;
  opacity: 0;
}
.lumen-repo-row:hover .lumen-repo-visibility,
.lumen-repo-visibility.is-visible,
.lumen-repo-visibility:focus-visible {
  opacity: 1;
}
.lumen-repo-visibility:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.lumen-repo-visibility.is-visible {
  color: var(--success, #4caf50);
}
.lumen-repo-visibility:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.lumen-repo-warning {
  color: var(--warning, #d98a00);
  flex-shrink: 0;
}

/* Banner inline manifestError : remplace l'ancien tooltip muet sur l'icone.
   Visible et lisible directement sous le nom du repo (PR2 v2.48). */
.lumen-repo-error-banner {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  margin: 2px 8px 4px 10px;
  padding: 4px 8px;
  background: rgba(217, 138, 0, 0.1);
  border: 1px solid rgba(217, 138, 0, 0.3);
  border-radius: 4px;
  font-size: 10.5px;
  line-height: 1.35;
  color: var(--warning, #d98a00);
}
.lumen-repo-error-banner svg { flex-shrink: 0; margin-top: 1px; }

.lumen-repo-body {
  padding-bottom: 4px;
}

.lumen-section {
  margin-top: 2px;
}
/* Section row : titre a gauche + bouton "+" a droite pour teacher (v2.68) */
.lumen-section-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 0 var(--space-sm) 0 26px;
  margin: var(--space-xs) 0 1px;
}
.lumen-section-title {
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}
.lumen-section-duration {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: 8px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}
.lumen-sidebar-toggle-all {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out);
}
.lumen-sidebar-toggle-all:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.lumen-section-add {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: var(--radius-sm);
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--motion-fast) var(--ease-out),
              background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out);
}
.lumen-section-row:hover .lumen-section-add,
.lumen-section-add:focus-visible {
  opacity: 1;
}
.lumen-section-add:hover {
  background: rgba(var(--accent-rgb), .14);
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), .35);
}
/* Parent dossier affiche en tres petit + muted en prefix. Evite la
   repetition visuelle quand plusieurs sections partagent le meme parent
   (ex: "02 Labs And Exercises · Lab01" + "... · Lab02"). v2.67.2. */
.lumen-section-parent {
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lumen-section-child {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lumen-chapter-item {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  padding: 7px 10px 7px 26px;
  min-height: 32px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.4;
  text-align: left;
  border-left: 2px solid transparent;
  transition: all var(--t-fast) ease;
}
.lumen-chapter-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.lumen-chapter-item.is-active {
  background: var(--bg-selected, var(--bg-hover));
  color: var(--text-primary);
  border-left-color: var(--accent);
}
.lumen-chapter-item.is-read { color: var(--text-muted); }

.lumen-chapter-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lumen-chapter-read  { color: var(--success, #4caf50); flex-shrink: 0; }
.lumen-chapter-noted { color: var(--accent); flex-shrink: 0; }
.lumen-chapter-icon { flex-shrink: 0; }
.lumen-chapter-icon--marp { color: var(--accent); }
.lumen-chapter-icon--pdf { color: var(--color-danger); }
.lumen-chapter-icon--tex { color: var(--color-warning); }

/* Badge duree (v2.76) : petit indicateur "15m" a droite du titre */
.lumen-chapter-duration {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 1px 5px;
  border-radius: 8px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.lumen-chapter-item.is-active .lumen-chapter-duration {
  background: rgba(var(--accent-rgb), .14);
  color: var(--accent);
}
.lumen-chapter-duration-unit {
  opacity: .6;
  margin-left: 1px;
}

/* ── Sections par kind (v2.63) ─────────────────────────────────────────── */
.lumen-kind-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.lumen-kind-section {
  display: flex;
  flex-direction: column;
}
.lumen-kind-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-xs) var(--space-md);
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  text-align: left;
  transition: color var(--motion-fast) var(--ease-out),
              background var(--motion-fast) var(--ease-out);
  border-radius: var(--radius-sm);
}
.lumen-kind-header:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
.lumen-kind-header:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.lumen-kind-icon {
  flex-shrink: 0;
  color: var(--accent);
}
.lumen-kind-label {
  flex: 1;
  min-width: 0;
}
.lumen-kind-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  padding: 1px 6px;
  background: rgba(var(--accent-rgb), .14);
  color: var(--accent);
  border-radius: 10px;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  text-transform: none;
  letter-spacing: 0;
  font-weight: 700;
}
.lumen-kind-section.is-collapsed .lumen-kind-header {
  color: var(--text-secondary);
}
.lumen-kind-section .lumen-repo-list {
  margin-top: var(--space-xs);
}

/* ── Modale Nouveau chapitre (v2.68) ──────────────────────────────────── */
.lumen-new-chapter {
  display: flex;
  flex-direction: column;
}
.lumen-new-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-lg) var(--space-xl) var(--space-md);
  border-bottom: 1px solid var(--border);
}
.lumen-new-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
}
.lumen-new-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
}
.lumen-new-sub strong {
  color: var(--accent);
  font-weight: 700;
}
.lumen-new-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius);
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out);
}
.lumen-new-close:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.lumen-new-close:disabled { opacity: .4; cursor: not-allowed; }

.lumen-new-body {
  padding: var(--space-lg) var(--space-xl);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
.lumen-new-label {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--text-secondary);
}
.lumen-new-label .form-input {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
}
.lumen-new-path {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 12px;
  margin: 0;
}
.lumen-new-path-label {
  color: var(--text-muted);
  font-weight: 600;
  flex-shrink: 0;
}
.lumen-new-path code {
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  color: var(--accent);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lumen-new-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-xl) var(--space-lg);
  border-top: 1px solid var(--border);
}
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
