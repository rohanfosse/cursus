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
import { Folder, FolderOpen, FileText, AlertTriangle, Check, StickyNote, Search, X, Eye, EyeOff, Sparkles } from 'lucide-vue-next'
import type { LumenRepo, LumenChapter } from '@/types'

interface Props {
  repos: LumenRepo[]
  currentRepoId: number | null
  currentChapterPath: string | null
  readChapters: Set<string>
  notedChapters: Set<string>
  canToggleVisibility?: boolean
}
interface Emits {
  (e: 'select', payload: { repoId: number; path: string }): void
  (e: 'toggle-visibility', payload: { repoId: number; visible: boolean }): void
}
const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const collapsed = ref<Set<number>>(new Set())
const filter = ref('')

function toggleRepo(id: number) {
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
}

function chapterKey(repoId: number, path: string): string {
  return `${repoId}::${path}`
}

const sortedRepos = computed(() => [...props.repos].sort((a, b) => a.fullName.localeCompare(b.fullName)))

interface SectionGroup {
  title: string
  chapters: LumenChapter[]
}

/**
 * Groupe une liste de chapitres par section en preservant l'ordre
 * d'apparition. Les chapitres sans champ `section` tombent dans un
 * bucket "Chapitres".
 */
function groupBySection(chapters: LumenChapter[]): SectionGroup[] {
  const map = new Map<string, LumenChapter[]>()
  for (const ch of chapters) {
    const key = ch.section?.trim() || 'Chapitres'
    const existing = map.get(key)
    if (existing) existing.push(ch)
    else map.set(key, [ch])
  }
  return Array.from(map.entries()).map(([title, chs]) => ({ title, chapters: chs }))
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

watch(filter, (v) => {
  if (v.trim()) collapsed.value = new Set()
})

function progressFor(repo: LumenRepo): { read: number; total: number } {
  const chapters = repo.manifest?.chapters ?? []
  let read = 0
  for (const c of chapters) {
    if (props.readChapters.has(chapterKey(repo.id, c.path))) read += 1
  }
  return { read, total: chapters.length }
}

function handleToggleVisibility(repo: LumenRepo, e: Event) {
  e.stopPropagation()
  emit('toggle-visibility', { repoId: repo.id, visible: !repo.isVisible })
}
</script>

<template>
  <div class="lumen-sidebar-nav">
    <div v-if="sortedRepos.length > 2" class="lumen-sidebar-filter">
      <Search :size="12" />
      <input
        v-model="filter"
        type="text"
        placeholder="Filtrer..."
        aria-label="Filtrer les cours"
      />
      <button
        v-if="filter"
        type="button"
        class="lumen-sidebar-clear"
        aria-label="Effacer le filtre"
        @click="filter = ''"
      >
        <X :size="12" />
      </button>
    </div>

    <nav class="lumen-sidebar-repos" aria-label="Cours">
      <p v-if="sortedRepos.length === 0" class="lumen-sidebar-empty">
        Aucun repo synchronise.
      </p>
      <p v-else-if="filteredRepos.length === 0" class="lumen-sidebar-empty">
        Aucun resultat pour "{{ filter }}".
      </p>
      <ul v-else class="lumen-repo-list">
        <li
          v-for="{ repo, groups } in filteredRepos"
          :key="repo.id"
          class="lumen-repo-item"
          :class="{ 'is-hidden-repo': canToggleVisibility && !repo.isVisible }"
        >
          <div class="lumen-repo-row">
            <button
              type="button"
              class="lumen-repo-header"
              :class="{ 'has-error': repo.manifestError }"
              @click="toggleRepo(repo.id)"
            >
              <component :is="collapsed.has(repo.id) ? Folder : FolderOpen" :size="14" />
              <span class="lumen-repo-name">{{ repo.manifest?.project ?? repo.fullName }}</span>
              <Sparkles
                v-if="repo.manifest?.autoGenerated"
                :size="11"
                class="lumen-repo-auto"
                title="Manifest genere automatiquement (aucun cursus.yaml)"
              />
              <AlertTriangle v-if="repo.manifestError" :size="13" class="lumen-repo-warning" />
              <span
                v-else-if="progressFor(repo).total > 0"
                class="lumen-repo-progress"
                :class="{ 'is-done': progressFor(repo).read === progressFor(repo).total }"
              >
                {{ progressFor(repo).read }}/{{ progressFor(repo).total }}
              </span>
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

          <p v-if="!collapsed.has(repo.id) && repo.manifestError" class="lumen-repo-error">
            {{ repo.manifestError }}
          </p>

          <div v-if="!collapsed.has(repo.id)" class="lumen-repo-body">
            <div v-for="group in groups" :key="group.title" class="lumen-section">
              <p class="lumen-section-title">{{ group.title }}</p>
              <ul class="lumen-chapter-list">
                <li v-for="ch in group.chapters" :key="ch.path">
                  <button
                    type="button"
                    class="lumen-chapter-item"
                    :class="{
                      'is-active': currentRepoId === repo.id && currentChapterPath === ch.path,
                      'is-read':   readChapters.has(chapterKey(repo.id, ch.path)),
                    }"
                    @click="emit('select', { repoId: repo.id, path: ch.path })"
                  >
                    <FileText :size="12" />
                    <span class="lumen-chapter-title">{{ ch.title }}</span>
                    <Check v-if="readChapters.has(chapterKey(repo.id, ch.path))" :size="11" class="lumen-chapter-read" />
                    <StickyNote v-if="notedChapters.has(chapterKey(repo.id, ch.path))" :size="11" class="lumen-chapter-noted" />
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </li>
      </ul>
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
  gap: 6px;
  padding: 8px 12px;
  margin: 8px 12px 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
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
  padding: 6px 0;
  overflow-y: auto;
  flex: 1;
}

.lumen-sidebar-empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.lumen-repo-list { list-style: none; margin: 0; padding: 0; }
.lumen-chapter-list { list-style: none; margin: 0; padding: 0; }

.lumen-repo-item { margin-bottom: 4px; }
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

.lumen-repo-header {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  padding: 7px 6px 7px 14px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  transition: background var(--t-fast) ease;
  min-width: 0;
}
.lumen-repo-header:hover { background: var(--bg-hover); }
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
  width: 30px;
  padding: 0 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  flex-shrink: 0;
  border-radius: 4px;
  transition: all var(--t-fast) ease;
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

.lumen-repo-progress {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: var(--text-muted);
  background: var(--bg-primary);
  border: 1px solid var(--border);
  padding: 1px 6px;
  border-radius: 8px;
  letter-spacing: 0;
  text-transform: none;
}
.lumen-repo-progress.is-done {
  color: var(--success, #4caf50);
  border-color: var(--success, #4caf50);
}

.lumen-repo-warning {
  color: var(--warning, #d98a00);
  flex-shrink: 0;
}

.lumen-repo-error {
  padding: 4px 14px 8px 34px;
  font-size: 11px;
  color: var(--warning, #d98a00);
  line-height: 1.4;
  margin: 0;
}

.lumen-repo-body {
  padding-bottom: 4px;
}

.lumen-section {
  margin-top: 4px;
}
.lumen-section-title {
  margin: 6px 0 2px;
  padding: 0 14px 0 34px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.lumen-chapter-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 14px 6px 34px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 12.5px;
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
</style>
