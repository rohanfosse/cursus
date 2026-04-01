<script setup lang="ts">
  // Section projets sidebar (vue Devoirs) : liste projets + barre progression
  import { Layers, Plus } from 'lucide-vue-next'
  import { useAppStore } from '@/stores/app'
  import { useModalsStore } from '@/stores/modals'
  import { parseCategoryIcon } from '@/utils/categoryIcon'
  import ProjectEditPanel from '@/components/sidebar/ProjectEditPanel.vue'
  import NewProjectModal from '@/components/modals/NewProjectModal.vue'

  import type { ProjectMeta } from '@/components/modals/NewProjectModal.vue'

  defineProps<{
    allProjects: string[]
    projectStats: Record<string, { depots: number; expected: number }>
    getProjectColor: (proj: string) => string
    editingProject: string | null
    getProjectMeta: (proj: string) => ProjectMeta | null
  }>()

  const emit = defineEmits<{
    selectProject: [key: string | null]
    openProjectCtx: [e: MouseEvent, proj: string]
    projectEditSave: [proj: string, data: ProjectMeta]
    cancelEdit: []
    projectCreated: [name: string]
  }>()

  const appStore = useAppStore()
  const modals = useModalsStore()
</script>

<template>
  <div class="sidebar-section-header">
    <span>{{ appStore.isStaff ? 'Projets' : 'Mes projets' }}</span>
  </div>

  <nav aria-label="Projets" class="sidebar-projects-nav">
    <button
      class="sidebar-item"
      :class="{ active: appStore.activeProject === null }"
      @click="emit('selectProject', null)"
    >
      <Layers :size="13" class="project-icon" />
      <span class="channel-name">Accueil</span>
    </button>

    <div v-for="proj in allProjects" :key="proj" class="sidebar-project-group">
      <button
        class="sidebar-item sb-project-rich"
        :class="{ active: appStore.activeProject === proj }"
        @click="emit('selectProject', proj)"
        @contextmenu.prevent="emit('openProjectCtx', $event, proj)"
      >
        <div class="sb-project-rich-top">
          <span class="project-color-dot" :style="{ background: getProjectColor(proj) }" />
          <component
            v-if="parseCategoryIcon(proj).icon"
            :is="parseCategoryIcon(proj).icon!"
            :size="13"
            class="project-icon"
          />
          <span v-else class="project-bullet" />
          <span class="channel-name">{{ parseCategoryIcon(proj).label }}</span>
        </div>
        <div v-if="projectStats[proj]" class="sb-project-rich-bar-wrap">
          <div class="sb-project-rich-bar">
            <div
              class="sb-project-rich-bar-fill"
              :style="{ width: (projectStats[proj].expected > 0 ? Math.round(projectStats[proj].depots / projectStats[proj].expected * 100) : 0) + '%', background: getProjectColor(proj) }"
            />
          </div>
          <span class="sb-project-rich-sub">{{ projectStats[proj].depots }}/{{ projectStats[proj].expected }} soumis</span>
        </div>
      </button>

      <ProjectEditPanel
        v-if="editingProject === proj"
        :project-key="proj"
        :meta="getProjectMeta(proj)"
        :color="getProjectColor(proj)"
        @save="emit('projectEditSave', proj, $event)"
        @cancel="emit('cancelEdit')"
      />
    </div>

    <button
      v-if="appStore.isTeacher"
      class="sidebar-item sidebar-add-project"
      @click="modals.newProject = true"
    >
      <Plus :size="13" class="project-icon" />
      <span class="channel-name">Nouveau projet</span>
    </button>
  </nav>

  <NewProjectModal v-if="appStore.isTeacher" v-model="modals.newProject" @created="(name: string) => emit('projectCreated', name)" />
</template>
