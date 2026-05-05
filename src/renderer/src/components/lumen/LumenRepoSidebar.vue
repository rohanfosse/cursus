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
import { FileText, FileDown, FileCode, AlertTriangle, StickyNote, Search, X, Eye, EyeOff, BookOpen, Presentation, Lightbulb, Wrench, Hammer, Folder, ChevronsDown, ChevronsUp, ChevronRight, Check, Copy, CornerDownRight } from 'lucide-vue-next'
import type { Component } from 'vue'
import { useLumenStore } from '@/stores/lumen'
import { useToast } from '@/composables/useToast'
import { useContextMenu } from '@/composables/useContextMenu'
import { chapterKey } from '@/utils/lumenDevoirLinks'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'
import {
  extractRepoNumericPrefix, displayRepoName,
  splitSectionTitle, groupBySection, formatDuration,
  type SectionGroup,
} from '@/utils/lumenRepoDisplay'
import { useLumenCollapsedState } from '@/composables/useLumenCollapsedState'
import { useLumenNewChapter } from '@/composables/useLumenNewChapter'
import LumenNewChapterModal from '@/components/lumen/LumenNewChapterModal.vue'
import type { LumenRepo, LumenChapter, LumenSearchResult, LumenRepoKind } from '@/types'

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

// v2.103 : reagit au signal requestSearchFocus() du store (raccourci "/" global)
const lumenStore = useLumenStore()
watch(() => lumenStore.searchFocusTick, () => { focusSearch() })

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

// Lumen = cours uniquement. On exclut les repos etudiants, groupes et le
// repo .github (readme) qui est accessible via le bouton Accueil dans la topbar.
const HIDDEN_KINDS = new Set<LumenRepoKind>(['student', 'group', 'readme'])

const sortedRepos = computed(() => [...props.repos]
  .filter((r) => !HIDDEN_KINDS.has(r.manifest?.kind as LumenRepoKind))
  .sort((a, b) => {
    // 1. Cours termines en bas (v2.102)
    const aDone = isRepoDone(a)
    const bDone = isRepoDone(b)
    if (aDone !== bDone) return aDone ? 1 : -1
    // 2. Prefixe numerique (0-Math, 1-SE, 2-POO, ...)
    const pa = extractRepoNumericPrefix(a)
    const pb = extractRepoNumericPrefix(b)
    if (pa !== pb) return pa - pb
    // 3. Tie-break alphabetique
    return a.fullName.localeCompare(b.fullName)
  }))

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

// ── Persistance localStorage de l'etat replie/deplie (v2.76/v2.100/v2.102) ─
const {
  collapsedKinds, toggleKind, setKinds,
  collapsedRepos, toggleRepo,
  toggleSection, isSectionOpen, setSectionOpen,
} = useLumenCollapsedState(KIND_ORDER)

// v2.78 : toggle global "tout deplier / tout replier" les sections.
const allSectionsCollapsed = computed<boolean>(() =>
  groupedRepos.value.length > 0
    && groupedRepos.value.every((s) => collapsedKinds.value.has(s.kind)),
)
function toggleAllSections(): void {
  if (collapsedKinds.value.size === 0) {
    setKinds(new Set<LumenRepoKind>(groupedRepos.value.map((s) => s.kind)))
  } else {
    setKinds(new Set())
  }
}

// Auto-open : quand le chapitre actif change, ouvrir sa section
watch([() => props.currentRepoId, () => props.currentChapterPath], () => {
  if (!props.currentRepoId || !props.currentChapterPath) return
  const repo = props.repos.find(r => r.id === props.currentRepoId)
  if (!repo?.manifest?.chapters) return
  const ch = repo.manifest.chapters.find(c => c.path === props.currentChapterPath)
  if (ch?.section) setSectionOpen(repo.id, ch.section)
})

// ── Cours termines (v2.102) ─────────────────────────────────────────────
function isRepoDone(repo: LumenRepo): boolean {
  const chapters = repo.manifest?.chapters ?? []
  if (!chapters.length) return false
  return chapters.every(ch => myReads.value.has(`${repo.id}::${ch.path}`))
}

// ── Recherche fulltext FTS5 (v2.49) ──────────────────────────────────────
// Le champ filter a double usage :
//   1. Filtrage local instantane sur les TITRES de chapitres (ancien pattern)
//   2. Recherche fulltext sur le CONTENU via FTS5, debouncee 300ms, cross-repos
// Les deux jeux de resultats s'affichent cote a cote : la recherche fulltext
// apparait au-dessus de la liste filtree quand un query est actif.

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
// Nouveau chapitre : modale accessible via le "+" en regard de chaque section
// (teacher only). Le composable gere l'etat + appel IPC + re-sync du repo.
const {
  open: newChapterOpen,
  ctx: newChapterCtx,
  title: newTitle,
  filename: newFilename,
  message: newMessage,
  saving: newSaving,
  path: newChapterPath,
  canCreate: canCreateChapter,
  openModal: openNewChapterModal,
  closeModal: closeNewChapterModal,
  onFilenameInput,
  save: saveNewChapter,
} = useLumenNewChapter((payload) => emit('select', payload))

const { showToast } = useToast()
const { ctx, open: openChapterCtx, close: closeChapterCtx } = useContextMenu<{ repo: LumenRepo; chapter: LumenChapter }>()
const ctxItems = computed<ContextMenuItem[]>(() => {
  const t = ctx.value?.target
  if (!t) return []
  const { repo, chapter } = t
  const isRead = myReads.value.has(`${repo.id}::${chapter.path}`)
  const items: ContextMenuItem[] = [
    { label: 'Ouvrir', icon: CornerDownRight, action: () => emit('select', { repoId: repo.id, path: chapter.path }) },
    { label: 'Copier le titre', icon: Copy, separator: true, action: async () => {
      await navigator.clipboard.writeText(chapter.title)
      showToast('Titre copié.', 'success')
    } },
    { label: 'Copier le chemin', icon: Copy, action: async () => {
      await navigator.clipboard.writeText(chapter.path)
      showToast('Chemin copié.', 'success')
    } },
    { label: 'Copier le lien lumen://', icon: Copy, action: async () => {
      await navigator.clipboard.writeText(`lumen://${displayRepoName(repo)}/${chapter.path}`)
      showToast('Lien copié.', 'success')
    } },
  ]
  if (!isRead) {
    items.push({ label: 'Marquer comme lu', icon: Check, separator: true, action: async () => {
      await lumenStore.markChapterRead(repo.id, chapter.path)
      showToast('Chapitre marqué lu.', 'success')
    } })
  }
  return items
})
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
              :class="{ 'is-hidden-repo': canToggleVisibility && !repo.isVisible, 'is-done': isRepoDone(repo) }"
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
              <!-- v2.284 : compteur de progression masque tant que rien n'a
                   ete lu — "0/N" partout cree du bruit visuel pour les
                   etudiants qui decouvrent le cours. Reapparait des la
                   premiere lecture. -->
              <span
                v-if="repoReadProgress(repo).read > 0 && repoReadProgress(repo).total > 0"
                class="lumen-repo-progress"
                :title="`${repoReadProgress(repo).read}/${repoReadProgress(repo).total} chapitres lus`"
              >{{ repoReadProgress(repo).read }}/{{ repoReadProgress(repo).total }}</span>
              <Check v-if="isRepoDone(repo)" :size="12" class="lumen-repo-done" />
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

          <!-- Progress bar (v2.106) — v2.284 : seuil > 0 pour eviter une
               barre vide sur tous les cours non commences. -->
          <div
            v-if="repoReadProgress(repo).read > 0 && !collapsedRepos.has(repo.id)"
            class="lumen-repo-progress-bar"
          >
            <div
              class="lumen-repo-progress-fill"
              :style="{ width: `${(repoReadProgress(repo).read / repoReadProgress(repo).total) * 100}%` }"
            />
          </div>

          <!-- Banner inline manifestError : message simplifie pour les etudiants -->
          <p v-if="repo.manifestError && !collapsedRepos.has(repo.id)" class="lumen-repo-error-banner" role="status" :title="repo.manifestError">
            <AlertTriangle :size="11" />
            <span>Ce cours a un probleme de configuration. Contacte ton enseignant.</span>
          </p>

          <div v-show="!collapsedRepos.has(repo.id)" class="lumen-repo-body">
            <div v-for="group in groups" :key="group.title" class="lumen-section">
              <button
                type="button"
                class="lumen-section-row"
                :aria-expanded="isSectionOpen(repo.id, group.title)"
                @click="toggleSection(repo.id, group.title)"
              >
                <ChevronRight :size="10" class="lumen-section-chevron" :class="{ open: isSectionOpen(repo.id, group.title) }" />
                <span class="lumen-section-child">
                  {{ splitSectionTitle(group.title).child }}
                </span>
                <span class="lumen-section-count">{{ group.chapters.length }}</span>
                <span
                  v-if="formatDuration(group.totalDuration)"
                  class="lumen-section-duration"
                  :title="`Duree totale : ${group.totalDuration} min`"
                >
                  {{ formatDuration(group.totalDuration) }}
                </span>
              </button>
              <ul v-show="isSectionOpen(repo.id, group.title)" class="lumen-chapter-list">
                <li v-for="ch in group.chapters" :key="ch.path">
                  <button
                    type="button"
                    class="lumen-chapter-item"
                    :class="{
                      'is-active': currentRepoId === repo.id && currentChapterPath === ch.path,
                      'is-read': myReads.has(`${repo.id}::${ch.path}`),
                    }"
                    @click="emit('select', { repoId: repo.id, path: ch.path })"
                    @contextmenu="openChapterCtx($event, { repo, chapter: ch }, true)"
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

    <ContextMenu
      v-if="ctx"
      :x="ctx.x"
      :y="ctx.y"
      :items="ctxItems"
      @close="closeChapterCtx"
    />

    <!-- Modale "Nouveau chapitre" (v2.68) — teacher only, via le + de section -->
    <LumenNewChapterModal
      :model-value="newChapterOpen"
      :section-title="newChapterCtx?.sectionTitle ?? null"
      :title="newTitle"
      :filename="newFilename"
      :message="newMessage"
      :path="newChapterPath"
      :saving="newSaving"
      :can-create="canCreateChapter"
      @update:model-value="newChapterOpen = $event"
      @update:title="newTitle = $event"
      @update:filename="newFilename = $event"
      @update:message="newMessage = $event"
      @filename-input="onFilenameInput"
      @save="saveNewChapter"
      @close="closeNewChapterModal"
    />
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
  border-radius: var(--radius-sm);
  max-height: 45vh;
  overflow-y: auto;
  flex-shrink: 0;
}
.lumen-search-head {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px 6px;
  font-size: 10px;
  font-weight: 600;
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
  background: var(--bg-active, rgba(var(--accent-rgb), .16));
  border-left-color: var(--accent);
}
.lumen-search-item-repo {
  font-size: 9px;
  font-weight: 600;
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
  border-radius: var(--radius-sm);
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
  padding: 6px 6px 6px 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 700;
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
.lumen-repo-item.is-done { opacity: 0.5; }
.lumen-repo-done { flex-shrink: 0; color: var(--success); }

.lumen-repo-progress {
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 500;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
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
  color: var(--success);
}
.lumen-repo-visibility:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.lumen-repo-warning {
  color: var(--warning);
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
  border-radius: var(--radius-xs);
  font-size: 10.5px;
  line-height: 1.35;
  color: var(--warning);
}
.lumen-repo-error-banner svg { flex-shrink: 0; margin-top: 1px; }

.lumen-repo-progress-bar {
  height: 2px;
  background: var(--border);
  border-radius: 1px;
  margin: 0 8px 2px 22px;
  overflow: hidden;
}
.lumen-repo-progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 1px;
  transition: width 0.3s ease;
}

.lumen-repo-body {
  padding-bottom: 4px;
  position: relative;
  padding-left: 10px;
  animation: sidebar-expand 0.15s ease-out;
}
.lumen-repo-body::before {
  content: '';
  position: absolute;
  left: 10px;
  top: 0;
  bottom: 4px;
  width: 1px;
  background: var(--border);
  opacity: 0.35;
}
@keyframes sidebar-expand {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.lumen-section {
  margin-top: 2px;
}
/* Section row : accordeon cliquable (v2.102) */
.lumen-section-row {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 6px 8px 6px 8px;
  margin: 1px 0;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  border-radius: var(--radius-xs);
  transition: background 0.1s;
}
.lumen-section-row:hover { background: var(--bg-hover); }

.lumen-section-chevron {
  flex-shrink: 0;
  color: var(--text-muted);
  transition: transform 0.15s ease;
}
.lumen-section-chevron.open { transform: rotate(90deg); }

.lumen-section-count {
  margin-left: auto;
  font-size: 9px;
  font-weight: 500;
  color: var(--text-muted);
  opacity: 0.7;
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
  font-weight: 500;
  color: var(--text-muted);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
  opacity: 0.7;
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
  font-weight: 500;
  color: var(--text-muted);
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lumen-section-child {
  font-size: 11px;
  font-weight: 600;
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
  padding: 6px 10px 6px 14px;
  min-height: 30px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.4;
  text-align: left;
  border-left: 2px solid transparent;
  border-radius: 0 4px 4px 0;
  transition: all var(--t-fast) ease;
}
.lumen-chapter-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.lumen-chapter-item.is-active {
  background: var(--bg-active, rgba(var(--accent-rgb), .16));
  color: var(--text-primary);
  border-left-color: var(--accent);
  font-weight: 600;
}
.lumen-chapter-item.is-read { color: var(--text-muted); }

.lumen-chapter-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lumen-chapter-read  { color: var(--success); flex-shrink: 0; }
.lumen-chapter-noted { color: var(--accent); flex-shrink: 0; }
.lumen-chapter-icon { flex-shrink: 0; }
.lumen-chapter-icon--marp { color: var(--accent); }
.lumen-chapter-icon--pdf { color: var(--color-danger); }
.lumen-chapter-icon--tex { color: var(--color-warning); }

.lumen-chapter-duration {
  font-size: 9px;
  font-weight: 600;
  color: var(--text-muted);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.1s ease;
}
.lumen-chapter-item:hover .lumen-chapter-duration,
.lumen-chapter-item.is-active .lumen-chapter-duration {
  opacity: 1;
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
  font-size: 11px;
  font-weight: 700;
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
  border-radius: var(--radius);
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
