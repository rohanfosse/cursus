<script setup lang="ts">
/** SidebarDocProjects — vue Documents, redesign style Lumen v2.114. */
import { ref, computed } from 'vue'
import { FolderOpen, Search, X, FileText, ChevronRight } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useDocumentsStore } from '@/stores/documents'
import { parseCategoryIcon } from '@/utils/categoryIcon'

const props = defineProps<{
  allProjects: string[]
  projectDocCounts: Record<string, number>
  docCategories: string[]
  docCatCounts: Record<string, number>
}>()

const appStore = useAppStore()
const docStore = useDocumentsStore()

const filter = ref('')

const totalDocs = computed(() => docStore.documents.length)

const filteredProjects = computed(() => {
  const q = filter.value.toLowerCase().trim()
  if (!q) return props.allProjects
  return props.allProjects.filter((p) => parseCategoryIcon(p).label.toLowerCase().includes(q))
})

function selectProject(proj: string | null) {
  appStore.activeProject = proj
  docStore.activeCategory = ''
}

function selectCategory(cat: string) {
  docStore.activeCategory = docStore.activeCategory === cat ? '' : cat
}
</script>

<template>
  <div class="sb-docs">
    <div class="sb-docs-head">
      <span class="sb-docs-title">{{ appStore.isStaff ? 'Projets' : 'Mes projets' }}</span>
      <span v-if="totalDocs" class="sb-docs-count">{{ totalDocs }}</span>
    </div>

    <!-- Search -->
    <div v-if="allProjects.length >= 4" class="sb-docs-search">
      <Search :size="11" class="sb-docs-search-icon" />
      <input v-model="filter" type="text" class="sb-docs-search-input" placeholder="Rechercher..." />
      <button v-if="filter" type="button" class="sb-docs-search-clear" @click="filter = ''"><X :size="10" /></button>
    </div>

    <!-- All docs -->
    <button
      type="button"
      class="sb-docs-item sb-docs-all"
      :class="{ 'is-active': appStore.activeProject === null }"
      @click="selectProject(null)"
    >
      <FolderOpen :size="12" />
      <span>Tous les documents</span>
      <span v-if="totalDocs" class="sb-docs-item-count">{{ totalDocs }}</span>
    </button>

    <!-- Projects -->
    <div class="sb-docs-list">
      <div v-for="proj in filteredProjects" :key="proj">
        <button
          type="button"
          class="sb-docs-item"
          :class="{ 'is-active': appStore.activeProject === proj }"
          @click="selectProject(proj)"
        >
          <component
            :is="parseCategoryIcon(proj).icon!"
            v-if="parseCategoryIcon(proj).icon"
            :size="12"
            class="sb-docs-item-icon"
          />
          <span v-else class="sb-docs-item-dot" />
          <span class="sb-docs-item-name">{{ parseCategoryIcon(proj).label }}</span>
          <span class="sb-docs-item-count">{{ projectDocCounts[proj] ?? 0 }}</span>
        </button>

        <!-- Sub-categories (visible when project active) -->
        <template v-if="appStore.activeProject === proj && docCategories.length > 1">
          <button
            v-for="cat in docCategories"
            :key="cat"
            type="button"
            class="sb-docs-item sb-docs-sub"
            :class="{ 'is-active': docStore.activeCategory === cat }"
            @click="selectCategory(cat)"
          >
            <FileText :size="10" class="sb-docs-sub-icon" />
            <span class="sb-docs-item-name">{{ cat }}</span>
            <span class="sb-docs-item-count">{{ docCatCounts[cat] ?? 0 }}</span>
          </button>
        </template>
      </div>
    </div>

    <div v-if="filteredProjects.length === 0 && filter" class="sb-docs-empty">Aucun projet pour "{{ filter }}"</div>
  </div>
</template>

<style scoped>
.sb-docs { padding: 6px 10px; display: flex; flex-direction: column; gap: 4px; }

.sb-docs-head { display: flex; align-items: center; gap: 4px; margin-bottom: 2px; }
.sb-docs-title { font-size: 11px; font-weight: 700; color: var(--text-muted); flex: 1; }
.sb-docs-count {
  font-size: 9px; font-weight: 700; color: var(--accent);
  background: rgba(var(--accent-rgb), .14); padding: 1px 5px; border-radius: 8px;
}

/* Search */
.sb-docs-search {
  display: flex; align-items: center; gap: 4px;
  padding: 5px 7px; margin-bottom: 2px;
  background: var(--bg-primary); border: 1px solid var(--border); border-radius: 5px;
}
.sb-docs-search:focus-within { border-color: var(--accent); }
.sb-docs-search-icon { color: var(--text-muted); flex-shrink: 0; }
.sb-docs-search-input {
  flex: 1; background: transparent; border: none; color: var(--text-primary);
  font-size: 11px; font-family: inherit; outline: none;
}
.sb-docs-search-input::placeholder { color: var(--text-muted); }
.sb-docs-search-clear { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 1px; }

/* Items */
.sb-docs-item {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 6px 8px; border-radius: 6px; border: none; border-left: 2px solid transparent;
  background: transparent; cursor: pointer; text-align: left; font-family: inherit; transition: all 0.1s;
}
.sb-docs-item:hover { background: var(--bg-hover); }
.sb-docs-item.is-active {
  background: var(--bg-active, rgba(var(--accent-rgb), .16));
  border-left-color: var(--accent);
}

.sb-docs-all { margin-bottom: 4px; font-size: 12px; font-weight: 500; color: var(--text-secondary); }
.sb-docs-all.is-active { font-weight: 600; color: var(--text-primary); }

.sb-docs-item-icon { flex-shrink: 0; color: var(--text-muted); }
.sb-docs-item-dot {
  width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); flex-shrink: 0; opacity: 0.5;
}
.sb-docs-item-name {
  flex: 1; font-size: 12px; font-weight: 500; color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.sb-docs-item.is-active .sb-docs-item-name { font-weight: 600; }
.sb-docs-item-count {
  font-size: 9px; font-weight: 500; color: var(--text-muted); flex-shrink: 0; font-variant-numeric: tabular-nums;
}

/* Sub-categories (indented) */
.sb-docs-sub {
  padding-left: 22px;
}
.sb-docs-sub-icon { color: var(--text-muted); opacity: 0.6; }

.sb-docs-list { display: flex; flex-direction: column; gap: 1px; }
.sb-docs-empty { font-size: 11px; color: var(--text-muted); padding: 8px 4px; }
</style>
