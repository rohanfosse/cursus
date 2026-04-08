<script setup lang="ts">
/**
 * Arborescence expandable d'un projet d'exemple. Construit un arbre
 * hierarchique a partir d'une liste plate de paths (style GitHub tree).
 * Navigation clavier : fleches + Enter. Emet `select(path)` quand un
 * fichier est choisi. Fuzzy search Ctrl+P pour les gros projets.
 */
import { computed, ref, nextTick } from 'vue'
import {
  ChevronRight, File, FileCode, FileText, FileJson, Folder, FolderOpen, Image as ImageIcon, Search, X,
} from 'lucide-vue-next'
import { formatBytes } from '@/utils/format'

interface TreeFile { path: string; size: number }
interface Props {
  files: TreeFile[]
  activePath: string | null
}
const props = defineProps<Props>()
const emit = defineEmits<(e: 'select', path: string) => void>()
defineExpose({ openSearch: () => openSearch() })

// ── Construction de l'arbre ───────────────────────────────────────────────
interface TreeNode {
  name: string
  path: string
  isFile: boolean
  size: number
  children: TreeNode[]
}

const root = computed<TreeNode[]>(() => {
  const rootNodes: TreeNode[] = []
  for (const file of props.files) {
    const segments = file.path.split('/').filter(Boolean)
    let cursor = rootNodes
    for (let i = 0; i < segments.length; i++) {
      const name = segments[i]
      const isFile = i === segments.length - 1
      const fullPath = segments.slice(0, i + 1).join('/')
      let node = cursor.find(n => n.name === name)
      if (!node) {
        node = { name, path: fullPath, isFile, size: isFile ? file.size : 0, children: [] }
        cursor.push(node)
      }
      cursor = node.children
    }
  }
  sortTree(rootNodes)
  return rootNodes
})

// Dossiers en premier, puis fichiers, chacun par ordre alphabetique.
function sortTree(nodes: TreeNode[]) {
  nodes.sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
    return a.name.localeCompare(b.name)
  })
  for (const n of nodes) if (!n.isFile) sortTree(n.children)
}

// Etat d'expansion par path de dossier. Dossiers de premier niveau
// ouverts par defaut pour que l'etudiant voie tout de suite le projet.
const expanded = ref<Set<string>>(new Set())
function initDefaultExpanded(nodes: TreeNode[], depth = 0) {
  for (const n of nodes) {
    if (!n.isFile && depth === 0) expanded.value.add(n.path)
  }
}
initDefaultExpanded(root.value)

function toggle(path: string) {
  const next = new Set(expanded.value)
  if (next.has(path)) next.delete(path); else next.add(path)
  expanded.value = next
}

// ── Recherche fuzzy ───────────────────────────────────────────────────────
const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const searchOpen = ref(false)

/**
 * Score fuzzy simple : le pattern matche si toutes les lettres apparaissent
 * dans l'ordre dans la cible. Bonus de score si le match commence au debut
 * du nom de fichier ou d'un segment de chemin. Retourne null si pas de match.
 */
function fuzzyScore(pattern: string, target: string): number | null {
  if (!pattern) return 0
  const p = pattern.toLowerCase()
  const t = target.toLowerCase()

  // Match exact contigu : score maximal
  const directIdx = t.indexOf(p)
  if (directIdx !== -1) {
    // Bonus decroissant selon la position (plus tot = mieux)
    return 1000 - directIdx
  }

  // Match fuzzy : toutes les lettres de p apparaissent dans l'ordre dans t
  let ti = 0
  let matched = 0
  let score = 0
  let lastMatchIdx = -1
  for (let pi = 0; pi < p.length; pi++) {
    const ch = p[pi]
    while (ti < t.length && t[ti] !== ch) ti++
    if (ti >= t.length) return null
    matched++
    // Penalite pour les gaps (meilleure contiguite = meilleur score)
    if (lastMatchIdx !== -1) {
      score -= (ti - lastMatchIdx - 1)
    }
    lastMatchIdx = ti
    ti++
  }
  if (matched !== p.length) return null
  // Score de base : plus court = meilleur
  return score + (100 - t.length)
}

interface SearchMatch { file: TreeFile; score: number }
const searchResults = computed<SearchMatch[]>(() => {
  const q = searchQuery.value.trim()
  if (!q) return []
  const matches: SearchMatch[] = []
  for (const file of props.files) {
    const score = fuzzyScore(q, file.path)
    if (score !== null) matches.push({ file, score })
  }
  matches.sort((a, b) => b.score - a.score)
  return matches.slice(0, 50) // cap pour perf
})

const isSearching = computed(() => searchQuery.value.trim() !== '')

async function openSearch() {
  searchOpen.value = true
  await nextTick()
  searchInputRef.value?.focus()
}

function closeSearch() {
  searchOpen.value = false
  searchQuery.value = ''
}

function onSearchKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    closeSearch()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    // Focus le premier resultat
    const first = rootRef.value?.querySelector<HTMLButtonElement>('.search-result')
    first?.focus()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const first = searchResults.value[0]
    if (first) {
      emit('select', first.file.path)
      closeSearch()
    }
  }
}

function selectSearchResult(path: string) {
  emit('select', path)
  closeSearch()
}

// ── Flatten pour navigation clavier ───────────────────────────────────────
interface FlatEntry {
  node: TreeNode
  depth: number
}
const flatList = computed<FlatEntry[]>(() => {
  const out: FlatEntry[] = []
  const walk = (nodes: TreeNode[], depth: number) => {
    for (const node of nodes) {
      out.push({ node, depth })
      if (!node.isFile && expanded.value.has(node.path)) {
        walk(node.children, depth + 1)
      }
    }
  }
  walk(root.value, 0)
  return out
})

function focusIndex(idx: number) {
  const entry = flatList.value[idx]
  if (!entry) return
  const el = rootRef.value?.querySelector<HTMLButtonElement>(`[data-tree-path="${CSS.escape(entry.node.path)}"]`)
  el?.focus()
}

const rootRef = ref<HTMLDivElement | null>(null)

function onKey(e: KeyboardEvent, entry: FlatEntry, idx: number) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    focusIndex(Math.min(flatList.value.length - 1, idx + 1))
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    focusIndex(Math.max(0, idx - 1))
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    if (!entry.node.isFile) {
      if (!expanded.value.has(entry.node.path)) toggle(entry.node.path)
      else if (entry.node.children.length > 0) focusIndex(idx + 1)
    }
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    if (!entry.node.isFile && expanded.value.has(entry.node.path)) {
      toggle(entry.node.path)
    }
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    if (entry.node.isFile) emit('select', entry.node.path)
    else toggle(entry.node.path)
  }
}

function onItemClick(node: TreeNode) {
  if (node.isFile) emit('select', node.path)
  else toggle(node.path)
}

// ── Icones par extension ──────────────────────────────────────────────────
const CODE_EXTS = new Set([
  'js', 'jsx', 'ts', 'tsx', 'py', 'rb', 'java', 'c', 'cpp', 'h', 'hpp',
  'cs', 'go', 'rs', 'php', 'kt', 'swift', 'scala', 'sh', 'bash', 'zsh',
  'lua', 'r', 'dart', 'vue', 'svelte',
])
const DOC_EXTS  = new Set(['md', 'markdown', 'txt', 'rst', 'adoc'])
const JSON_EXTS = new Set(['json', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'env'])
const IMG_EXTS  = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'])

function iconFor(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (CODE_EXTS.has(ext)) return FileCode
  if (DOC_EXTS.has(ext))  return FileText
  if (JSON_EXTS.has(ext)) return FileJson
  if (IMG_EXTS.has(ext))  return ImageIcon
  return File
}

// Dans le tree, on cache les tailles < 1 Ko pour ne pas bruiter les
// petits fichiers texte (la taille est de toute facon affichee dans le
// viewer header quand on ouvre le fichier).
function formatSize(bytes: number): string {
  return bytes < 1024 ? '' : formatBytes(bytes)
}
</script>

<template>
  <div ref="rootRef" class="tree">
    <!-- Barre de recherche (toggle via bouton ou Ctrl+P depuis le parent) -->
    <div class="tree-searchbar">
      <button
        v-if="!searchOpen"
        type="button"
        class="tree-search-toggle"
        title="Rechercher un fichier (Ctrl+P)"
        aria-label="Rechercher un fichier"
        @click="openSearch"
      >
        <Search :size="12" />
        <span>Rechercher…</span>
        <span class="tree-search-kbd">Ctrl+P</span>
      </button>
      <div v-else class="tree-search-input-wrap">
        <Search :size="12" class="tree-search-input-icon" />
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          class="tree-search-input"
          placeholder="Rechercher un fichier…"
          aria-label="Rechercher un fichier"
          @keydown="onSearchKey"
        />
        <button
          type="button"
          class="tree-search-close"
          title="Fermer (Esc)"
          aria-label="Fermer la recherche"
          @click="closeSearch"
        >
          <X :size="12" />
        </button>
      </div>
    </div>

    <!-- Resultats de recherche (remplace l'arbre pendant que l'utilisateur tape) -->
    <div
      v-if="isSearching"
      class="tree-search-results"
      role="listbox"
      :aria-label="`${searchResults.length} resultat${searchResults.length > 1 ? 's' : ''}`"
    >
      <div v-if="searchResults.length === 0" class="tree-empty">Aucun resultat.</div>
      <button
        v-for="m in searchResults"
        :key="m.file.path"
        type="button"
        class="tree-item search-result"
        :class="{ 'tree-item--active': activePath === m.file.path }"
        :title="m.file.path"
        @click="selectSearchResult(m.file.path)"
      >
        <span class="tree-item-icon">
          <component :is="iconFor(m.file.path.split('/').pop() ?? '')" :size="13" />
        </span>
        <span class="tree-item-name">
          <span class="search-result-name">{{ m.file.path.split('/').pop() }}</span>
          <span class="search-result-path">{{ m.file.path }}</span>
        </span>
        <span class="tree-item-size">{{ formatSize(m.file.size) }}</span>
      </button>
    </div>

    <!-- Arborescence classique (cachee pendant la recherche) -->
    <div
      v-else
      class="tree-nav"
      role="tree"
      :aria-label="`Arborescence du projet d'exemple (${files.length} fichiers)`"
    >
      <div v-if="flatList.length === 0" class="tree-empty">Projet vide.</div>
      <button
        v-for="(entry, idx) in flatList"
        :key="entry.node.path"
        type="button"
        class="tree-item"
        :class="{
          'tree-item--file': entry.node.isFile,
          'tree-item--folder': !entry.node.isFile,
          'tree-item--active': entry.node.isFile && activePath === entry.node.path,
        }"
        :style="{ paddingLeft: `${8 + entry.depth * 14}px` }"
        role="treeitem"
        :aria-expanded="entry.node.isFile ? undefined : expanded.has(entry.node.path)"
        :aria-selected="entry.node.isFile && activePath === entry.node.path"
        :aria-level="entry.depth + 1"
        :data-tree-path="entry.node.path"
        tabindex="0"
        :title="entry.node.path"
        @click="onItemClick(entry.node)"
        @keydown="(e) => onKey(e, entry, idx)"
      >
        <span class="tree-item-chevron">
          <ChevronRight
            v-if="!entry.node.isFile"
            :size="12"
            :class="{ 'tree-item-chevron--open': expanded.has(entry.node.path) }"
          />
        </span>
        <span class="tree-item-icon">
          <template v-if="entry.node.isFile">
            <component :is="iconFor(entry.node.name)" :size="13" />
          </template>
          <template v-else>
            <FolderOpen v-if="expanded.has(entry.node.path)" :size="13" />
            <Folder v-else :size="13" />
          </template>
        </span>
        <span class="tree-item-name">{{ entry.node.name }}</span>
        <span v-if="entry.node.isFile" class="tree-item-size">{{ formatSize(entry.node.size) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tree {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  font-size: 13px;
}

.tree-nav,
.tree-search-results {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  min-height: 0;
}

/* ── Search bar ─────────────────────────────────────────────────────────── */
.tree-searchbar {
  flex-shrink: 0;
  padding: 8px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}
.tree-search-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 6px 10px;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 120ms ease;
}
.tree-search-toggle:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}
.tree-search-kbd {
  margin-left: auto;
  font-size: 10px;
  padding: 1px 5px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}
.tree-search-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-input);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  box-shadow: 0 0 0 2px var(--accent-subtle);
}
.tree-search-input-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}
.tree-search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: 12px;
  color: var(--text-primary);
  min-width: 0;
}
.tree-search-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.tree-search-close:hover { color: var(--text-primary); background: var(--bg-hover); }

/* Resultat de recherche : double ligne nom + chemin */
.search-result-name {
  display: block;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.search-result-path {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.search-result .tree-item-name {
  line-height: 1.3;
}

.tree-empty {
  padding: 16px;
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
}

.tree-item {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  padding: 4px 8px 4px 8px;
  background: none;
  border: none;
  border-left: 2px solid transparent;
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.4;
  transition: background 120ms ease, color 120ms ease;
}
.tree-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.tree-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.tree-item--folder { font-weight: 600; color: var(--text-primary); }
.tree-item--active {
  background: var(--accent-subtle);
  color: var(--accent);
  border-left-color: var(--accent);
  font-weight: 600;
}

.tree-item-chevron {
  width: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform 120ms ease;
}
.tree-item-chevron--open { transform: rotate(90deg); }

.tree-item-icon {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--text-muted);
}
.tree-item--folder .tree-item-icon { color: var(--accent); }

.tree-item-name {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.tree-item-size {
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
  padding-left: 6px;
  font-variant-numeric: tabular-nums;
}
</style>
