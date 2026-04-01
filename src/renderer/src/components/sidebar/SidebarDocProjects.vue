/**
 * Section projets/categories de la sidebar (vue Documents).
 * Affiche les projets comme filtres + sous-categories.
 */
<script setup lang="ts">
  import { FolderOpen } from 'lucide-vue-next'
  import { useAppStore } from '@/stores/app'
  import { useDocumentsStore } from '@/stores/documents'
  import { parseCategoryIcon } from '@/utils/categoryIcon'

  defineProps<{
    allProjects: string[]
    projectDocCounts: Record<string, number>
    docCategories: string[]
    docCatCounts: Record<string, number>
  }>()

  const appStore = useAppStore()
  const docStore = useDocumentsStore()
</script>

<template>
  <div class="sidebar-section-header">
    <span>{{ appStore.isStaff ? 'Projets' : 'Mes projets' }}</span>
  </div>

  <nav aria-label="Filtrer les documents par projet">
    <button
      class="sidebar-item"
      :class="{ active: appStore.activeProject === null }"
      @click="appStore.activeProject = null; docStore.activeCategory = ''"
    >
      <FolderOpen :size="13" class="project-icon" />
      <span class="channel-name">Tous les documents</span>
      <span v-if="docStore.documents.length" class="sidebar-doc-count">{{ docStore.documents.length }}</span>
    </button>

    <template v-for="proj in allProjects" :key="proj">
      <button
        class="sidebar-item"
        :class="{ active: appStore.activeProject === proj }"
        @click="appStore.activeProject = proj; docStore.activeCategory = ''"
      >
        <component
          v-if="parseCategoryIcon(proj).icon"
          :is="parseCategoryIcon(proj).icon!"
          :size="13"
          class="project-icon"
        />
        <span v-else class="project-bullet" />
        <span class="channel-name">{{ parseCategoryIcon(proj).label }}</span>
        <span class="sidebar-doc-count">{{ projectDocCounts[proj] ?? 0 }}</span>
      </button>

      <template v-if="appStore.activeProject === proj && docCategories.length > 1">
        <button
          v-for="cat in docCategories"
          :key="cat"
          class="sidebar-item sidebar-item--sub"
          :class="{ active: docStore.activeCategory === cat }"
          @click="docStore.activeCategory = docStore.activeCategory === cat ? '' : cat"
        >
          <span class="sidebar-sub-dot" />
          <span class="channel-name">{{ cat }}</span>
          <span class="sidebar-doc-count">{{ docCatCounts[cat] ?? 0 }}</span>
        </button>
      </template>
    </template>
  </nav>
</template>
