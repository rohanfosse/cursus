<script setup lang="ts">
/**
 * Sidebar Lumen : affiche la liste des repos de la promo avec leurs
 * chapitres (du manifest cursus.yaml) deplies. Supporte :
 * - Click sur un repo : collapse/expand
 * - Click sur un chapitre : selection + emission de l'event
 * - Affichage d'un etat erreur manifest
 * - Badge "lu" sur les chapitres deja lus
 * - Badge "note" sur les chapitres avec note privee
 */
import { ref, computed } from 'vue'
import { Folder, FolderOpen, FileText, AlertTriangle, Check, StickyNote } from 'lucide-vue-next'
import type { LumenRepo } from '@/types'

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
</script>

<template>
  <nav class="lumen-sidebar-repos" aria-label="Cours">
    <p v-if="sortedRepos.length === 0" class="lumen-sidebar-empty">
      Aucun repo synchronise.
    </p>
    <ul v-else class="lumen-repo-list">
      <li v-for="repo in sortedRepos" :key="repo.id" class="lumen-repo-item">
        <button
          type="button"
          class="lumen-repo-header"
          :class="{ 'has-error': repo.manifestError }"
          @click="toggleRepo(repo.id)"
        >
          <component :is="collapsed.has(repo.id) ? Folder : FolderOpen" :size="14" />
          <span class="lumen-repo-name">{{ repo.manifest?.project ?? repo.fullName }}</span>
          <AlertTriangle v-if="repo.manifestError" :size="13" class="lumen-repo-warning" />
        </button>

        <p v-if="!collapsed.has(repo.id) && repo.manifestError" class="lumen-repo-error">
          {{ repo.manifestError }}
        </p>

        <ul v-if="!collapsed.has(repo.id) && repo.manifest?.chapters?.length" class="lumen-chapter-list">
          <li v-for="ch in repo.manifest.chapters" :key="ch.path">
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
</template>

<style scoped>
.lumen-sidebar-repos {
  padding: 8px 0;
  overflow-y: auto;
  flex: 1;
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
