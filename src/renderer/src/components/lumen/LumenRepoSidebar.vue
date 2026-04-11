<script setup lang="ts">
/**
 * Sidebar Lumen : affiche la liste des repos de la promo avec leurs
 * chapitres (du manifest cursus.yaml) deplies. Supporte :
 * - Filtre par nom de projet / chapitre
 * - Click sur un repo : collapse/expand
 * - Click sur un chapitre : selection + emission de l'event
 * - Affichage d'un etat erreur manifest
 * - Badge "lu"/"note" sur chaque chapitre
 * - Progress count par repo : "X/Y chapitres lus"
 */
import { ref, computed, watch } from 'vue'
import { Folder, FolderOpen, FileText, AlertTriangle, Check, StickyNote, Search, X } from 'lucide-vue-next'
import type { LumenRepo, LumenChapter } from '@/types'

interface Props {
  repos: LumenRepo[]
  currentRepoId: number | null
  currentChapterPath: string | null
  readChapters: Set<string>
  notedChapters: Set<string>
}
interface Emits {
  (e: 'select', payload: { repoId: number; path: string }): void
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

/**
 * Repos filtres par le champ recherche. Match case-insensitive sur :
 * - nom du projet (manifest.project ou owner/repo si pas de manifest)
 * - titre de chapitre
 * - path de chapitre
 * Quand un repo match, il est deplie automatiquement pour montrer
 * les chapitres correspondants.
 */
interface FilteredRepo {
  repo: LumenRepo
  chapters: LumenChapter[]
}

const filteredRepos = computed<FilteredRepo[]>(() => {
  const needle = filter.value.trim().toLowerCase()
  if (!needle) {
    return sortedRepos.value.map((repo) => ({
      repo,
      chapters: repo.manifest?.chapters ?? [],
    }))
  }
  const out: FilteredRepo[] = []
  for (const repo of sortedRepos.value) {
    const projectName = (repo.manifest?.project ?? repo.fullName).toLowerCase()
    const repoMatches = projectName.includes(needle)
    const chapters = repo.manifest?.chapters ?? []
    const matchingChapters = chapters.filter((c) =>
      c.title.toLowerCase().includes(needle) || c.path.toLowerCase().includes(needle),
    )
    if (repoMatches) {
      out.push({ repo, chapters })
    } else if (matchingChapters.length) {
      out.push({ repo, chapters: matchingChapters })
    }
  }
  return out
})

/** Quand un filtre est actif, deplie automatiquement tous les repos match. */
watch(filter, (v) => {
  if (v.trim()) collapsed.value = new Set()
})

/** Progress count par repo : {read, total} sur les chapitres du manifest. */
function progressFor(repo: LumenRepo): { read: number; total: number } {
  const chapters = repo.manifest?.chapters ?? []
  let read = 0
  for (const c of chapters) {
    if (props.readChapters.has(chapterKey(repo.id, c.path))) read += 1
  }
  return { read, total: chapters.length }
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
        <li v-for="{ repo, chapters } in filteredRepos" :key="repo.id" class="lumen-repo-item">
          <button
            type="button"
            class="lumen-repo-header"
            :class="{ 'has-error': repo.manifestError }"
            @click="toggleRepo(repo.id)"
          >
            <component :is="collapsed.has(repo.id) ? Folder : FolderOpen" :size="14" />
            <span class="lumen-repo-name">{{ repo.manifest?.project ?? repo.fullName }}</span>
            <AlertTriangle v-if="repo.manifestError" :size="13" class="lumen-repo-warning" />
            <span
              v-else-if="progressFor(repo).total > 0"
              class="lumen-repo-progress"
              :class="{ 'is-done': progressFor(repo).read === progressFor(repo).total }"
            >
              {{ progressFor(repo).read }}/{{ progressFor(repo).total }}
            </span>
          </button>

          <p v-if="!collapsed.has(repo.id) && repo.manifestError" class="lumen-repo-error">
            {{ repo.manifestError }}
          </p>

          <ul v-if="!collapsed.has(repo.id) && chapters.length" class="lumen-chapter-list">
            <li v-for="ch in chapters" :key="ch.path">
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
.lumen-sidebar-filter input::placeholder {
  color: var(--text-muted);
}
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

.lumen-sidebar-empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.lumen-repo-list, .lumen-chapter-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.lumen-repo-item {
  margin-bottom: 2px;
}

.lumen-repo-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 14px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  transition: background var(--t-fast) ease;
}
.lumen-repo-header:hover { background: var(--bg-hover); }
.lumen-repo-header.has-error { color: var(--text-muted); }

.lumen-repo-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
