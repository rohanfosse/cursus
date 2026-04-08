<script setup lang="ts">
/**
 * Panneau "Projet d'exemple" affiche dans le reader d'un cours Lumen.
 * Assemble LumenProjectTree + LumenProjectFileViewer + header avec
 * bouton telecharger et lien vers le repo d'origine.
 */
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Github, Download, ExternalLink, Package } from 'lucide-vue-next'
import { useLumenStore } from '@/stores/lumen'
import { useToast } from '@/composables/useToast'
import { formatBytes } from '@/utils/format'
import type { LumenCourse } from '@/types'
import LumenProjectTree from '@/components/lumen/LumenProjectTree.vue'
import LumenProjectFileViewer from '@/components/lumen/LumenProjectFileViewer.vue'

interface Props {
  course: LumenCourse
  // Deep link optionnel : auto-selectionne ce fichier au chargement de
  // l'arborescence (prioritaire sur le README par defaut).
  initialFile?: string | null
}
const props = withDefaults(defineProps<Props>(), { initialFile: null })

const lumenStore = useLumenStore()
const { showToast } = useToast()

const activePath = ref<string | null>(null)
const downloading = ref(false)
const treeRef = ref<InstanceType<typeof LumenProjectTree> | null>(null)
const panelRef = ref<HTMLElement | null>(null)

// L'arborescence est chargee lazy au montage ; le fichier n'est chargee
// qu'au clic dans le tree.
const tree = computed(() => lumenStore.snapshotTrees.get(props.course.id) ?? null)

async function loadTree() {
  activePath.value = null
  await lumenStore.fetchSnapshotTree(props.course.id)
  const t = tree.value
  if (!t || t.files.length === 0) return
  // Priorite 1 : deep link via prop initialFile (si le fichier existe
  // reellement dans le snapshot)
  if (props.initialFile && t.files.some(f => f.path === props.initialFile)) {
    activePath.value = props.initialFile
    return
  }
  // Priorite 2 : README racine pour donner du contexte immediat
  const readme = findRootReadme(t.files)
  if (readme) activePath.value = readme
}

// Si le deep link change apres le chargement (navigation depuis un autre
// ref chat sans changer de cours), on met a jour la selection.
watch(() => props.initialFile, (newPath) => {
  if (!newPath) return
  const t = tree.value
  if (t && t.files.some(f => f.path === newPath)) {
    activePath.value = newPath
  }
})

// Preference d'ordre : .md > .rst > .txt > sans extension.
// Limite au niveau racine du repo (pas de slash dans le path).
function findRootReadme(files: { path: string }[]): string | null {
  const priorities = ['readme.md', 'readme.rst', 'readme.txt', 'readme']
  const rootFiles = files.filter(f => !f.path.includes('/'))
  for (const target of priorities) {
    const found = rootFiles.find(f => f.path.toLowerCase() === target)
    if (found) return found.path
  }
  return null
}

onMounted(() => {
  loadTree()
  window.addEventListener('keydown', onGlobalKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKey)
})
watch(() => props.course.id, loadTree)

// Ctrl+P / Cmd+P : ouvre la recherche de fichier dans l'arborescence.
// N'intercepte que si le focus est dans le panneau (evite de casser le
// raccourci global quand l'utilisateur est dans un autre composant).
function onGlobalKey(e: KeyboardEvent) {
  const isFinder = (e.key === 'p' || e.key === 'P') && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey
  if (!isFinder) return
  if (!panelRef.value) return
  const active = document.activeElement
  if (active instanceof Node && !panelRef.value.contains(active)) return
  e.preventDefault()
  treeRef.value?.openSearch()
}

function slugForDownload(): string {
  const base = (props.course.title || 'cours')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || 'cours'
  return `${base}-exemple.zip`
}

async function handleDownload() {
  downloading.value = true
  try {
    const result = await window.api.downloadLumenSnapshot(props.course.id, slugForDownload())
    if (!result.ok) {
      showToast(result.error || 'Telechargement echoue', 'error')
      return
    }
    if (!result.data) return // utilisateur a annule le save dialog
    showToast('Zip telecharge', 'success')
  } finally {
    downloading.value = false
  }
}

function openRepo() {
  const url = tree.value?.repo_url ?? props.course.repo_url
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

const formatSize = formatBytes
</script>

<template>
  <section ref="panelRef" class="project-panel" aria-label="Projet d'exemple du cours" tabindex="-1">
    <header class="project-panel-head">
      <div class="project-panel-title">
        <Package :size="15" />
        <span>Projet d'exemple</span>
        <span v-if="tree" class="project-panel-stats">
          {{ tree.file_count }} fichier{{ tree.file_count > 1 ? 's' : '' }} · {{ formatSize(tree.total_size) }}
        </span>
      </div>
      <div class="project-panel-actions">
        <button
          type="button"
          class="project-btn project-btn--ghost"
          title="Voir le repo sur GitHub"
          @click="openRepo"
        >
          <Github :size="13" />
          <span>GitHub</span>
          <ExternalLink :size="11" />
        </button>
        <button
          type="button"
          class="project-btn project-btn--primary"
          :disabled="downloading || !tree"
          @click="handleDownload"
        >
          <Download :size="13" />
          <span>{{ downloading ? 'Telechargement…' : 'Telecharger (.zip)' }}</span>
        </button>
      </div>
    </header>

    <div v-if="!tree" class="project-panel-loading">Chargement du projet…</div>

    <div v-else class="project-panel-body">
      <aside class="project-panel-tree">
        <LumenProjectTree
          ref="treeRef"
          :files="tree.files"
          :active-path="activePath"
          @select="(path) => activePath = path"
        />
      </aside>
      <div class="project-panel-viewer">
        <LumenProjectFileViewer
          :course-id="course.id"
          :path="activePath"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.project-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.project-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: var(--bg-sidebar, var(--bg-elevated));
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.project-panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.project-panel-stats {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: none;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}
.project-panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.project-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--border);
  transition: all 120ms ease;
}
.project-btn--ghost {
  background: transparent;
  color: var(--text-secondary);
}
.project-btn--ghost:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-muted);
}
.project-btn--primary {
  background: var(--accent);
  color: var(--bg-primary, #111);
  border-color: var(--accent);
}
.project-btn--primary:hover:not(:disabled) {
  filter: brightness(1.1);
}
.project-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.project-panel-loading {
  padding: 32px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.project-panel-body {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 0;
  flex: 1;
  min-height: 0;
}
.project-panel-tree {
  border-right: 1px solid var(--border);
  background: var(--bg-input);
  overflow-y: auto;
  min-height: 320px;
  max-height: 520px;
}
.project-panel-viewer {
  display: flex;
  flex-direction: column;
  min-height: 320px;
  max-height: 520px;
  overflow: hidden;
  padding: 12px;
}

/* Mobile : empile tree et viewer */
@media (max-width: 720px) {
  .project-panel-body {
    grid-template-columns: 1fr;
  }
  .project-panel-tree {
    border-right: none;
    border-bottom: 1px solid var(--border);
    max-height: 220px;
  }
}
</style>
