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
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { FileText, FileDown, FileCode, AlertTriangle, StickyNote, Search, X, Eye, EyeOff, Sparkles, BookOpen, Presentation, Home, Lightbulb, Wrench, Hammer, Folder, Users, User } from 'lucide-vue-next'
import type { Component } from 'vue'
import { useLumenStore } from '@/stores/lumen'
import { chapterKey } from '@/utils/lumenDevoirLinks'
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

const sortedRepos = computed(() => [...props.repos].sort((a, b) => {
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
    .map(([title, chs]) => ({ title, chapters: chs }))
    .sort((a, b) => {
      const ka = sectionSortKey(a.title)
      const kb = sectionSortKey(b.title)
      if (ka.num !== kb.num) return ka.num - kb.num
      return ka.title.localeCompare(kb.title)
    })
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

const KIND_ORDER: LumenRepoKind[] = [
  'readme',
  'course',
  'prosit',
  'workshop',
  'miniproject',
  'project',
  'group',
  'student',
]

const KIND_LABELS: Record<LumenRepoKind, string> = {
  readme:      'Accueil promo',
  course:      'Cours',
  prosit:      'Prosits',
  workshop:    'Workshops',
  miniproject: 'Mini-projets',
  project:     'Projets',
  group:       'Groupes etudiants',
  student:     'Etudiants individuels',
}

const KIND_ICONS: Record<LumenRepoKind, Component> = {
  readme:      Home,
  course:      BookOpen,
  prosit:      Lightbulb,
  workshop:    Wrench,
  miniproject: Hammer,
  project:     Folder,
  group:       Users,
  student:     User,
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
      label: KIND_LABELS[k],
      icon: KIND_ICONS[k],
      repos: buckets.get(k)!,
    }))
})

// Sections collapsible : etat persiste en memoire (pas de localStorage —
// le user a explicitement demande "categories simples" sans sur-config).
const collapsedKinds = ref<Set<LumenRepoKind>>(new Set())
function toggleKind(k: LumenRepoKind): void {
  const next = new Set(collapsedKinds.value)
  if (next.has(k)) next.delete(k)
  else next.add(k)
  collapsedKinds.value = next
}

// Note v2.48 : sidebar flat (pas de collapse).

// ── Recherche fulltext FTS5 (v2.49) ──────────────────────────────────────
// Le champ filter a double usage :
//   1. Filtrage local instantane sur les TITRES de chapitres (ancien pattern)
//   2. Recherche fulltext sur le CONTENU via FTS5, debouncee 300ms, cross-repos
// Les deux jeux de resultats s'affichent cote a cote : la recherche fulltext
// apparait au-dessus de la liste filtree quand un query est actif.

const lumenStore = useLumenStore()
const { marpChapters } = storeToRefs(lumenStore)
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
</script>

<template>
  <div class="lumen-sidebar-nav">
    <!-- Champ recherche : filtre titres + recherche fulltext FTS5 (v2.49).
         Toujours visible quand au moins 2 repos (ancien seuil >= 5 obsolete :
         la recherche fulltext apporte de la valeur meme avec peu de repos). -->
    <div v-if="sortedRepos.length >= 2" class="lumen-sidebar-filter">
      <Search :size="12" />
      <input
        v-model="filter"
        type="text"
        placeholder="Rechercher dans les cours..."
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
    </div>

    <!-- Resultats recherche fulltext : visible uniquement quand un query
         actif a retourne des matches. L'utilisateur voit directement les
         snippets contextualises, peut cliquer pour ouvrir le chapitre. -->
    <section
      v-if="filter.trim().length >= 2 && searchResults.length > 0"
      class="lumen-search-results"
      aria-label="Resultats de recherche"
    >
      <header class="lumen-search-head">
        <BookOpen :size="11" />
        <span>Resultats ({{ searchResults.length }})</span>
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
            <div
              class="lumen-repo-header"
              :class="{ 'has-error': repo.manifestError }"
            >
              <span class="lumen-repo-name">{{ displayRepoName(repo) }}</span>
              <Sparkles
                v-if="repo.manifest?.autoGenerated"
                :size="11"
                class="lumen-repo-auto"
                title="Manifest genere automatiquement (aucun cursus.yaml)"
              />
              <AlertTriangle v-if="repo.manifestError" :size="13" class="lumen-repo-warning" />
            </div>
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

          <!-- Banner inline manifestError : visible et lisible plutot que tooltip muet -->
          <p v-if="repo.manifestError" class="lumen-repo-error-banner" role="status">
            <AlertTriangle :size="11" />
            <span>{{ repo.manifestError }}</span>
          </p>

          <div class="lumen-repo-body">
            <div v-for="group in groups" :key="group.title" class="lumen-section">
              <p class="lumen-section-title">{{ group.title }}</p>
              <ul class="lumen-chapter-list">
                <li v-for="ch in group.chapters" :key="ch.path">
                  <button
                    type="button"
                    class="lumen-chapter-item"
                    :class="{
                      'is-active': currentRepoId === repo.id && currentChapterPath === ch.path,
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
  gap: 5px;
  padding: 5px 9px;
  margin: 6px 10px 2px;
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
  padding: 2px;
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

/* Header repo : un simple label depuis v2.48 (sidebar flat). Plus de toggle
   collapse, plus de cursor pointer, plus de hover background. */
.lumen-repo-header {
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  padding: 6px 4px 2px 10px;
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-align: left;
  min-width: 0;
}
.lumen-repo-header.has-error { color: var(--text-muted); }

.lumen-repo-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lumen-repo-auto {
  color: var(--accent);
  flex-shrink: 0;
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
.lumen-section-title {
  margin: 4px 0 1px;
  padding: 0 10px 0 26px;
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
  opacity: 0.75;
}

.lumen-chapter-item {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
  padding: 4px 10px 4px 26px;
  /* WCAG 2.5.5 minimum tactile : 4 + 4 + 12 * 1.4 = ~24.8px */
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
</style>
