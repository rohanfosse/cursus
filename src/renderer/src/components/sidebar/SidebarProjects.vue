<script setup lang="ts">
  // Section projets sidebar (vue Devoirs) : mini-cards Notion (v2.99)
  import { Layers, Plus, Check } from 'lucide-vue-next'
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
    projectTimePct: (proj: string) => number | null
    isProjectDone: (proj: string) => boolean
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
    <span>Projets</span>
    <button
      v-if="appStore.isTeacher"
      class="dm-toggle-btn dm-toggle-btn--visible"
      title="Nouveau projet"
      aria-label="Nouveau projet"
      @click.stop="modals.newProject = true"
    ><Plus :size="13" /></button>
  </div>

  <nav aria-label="Projets" class="sidebar-projects-nav">
    <button
      class="sidebar-item sb-card-home"
      :class="{ active: appStore.activeProject === null }"
      @click="emit('selectProject', null)"
    >
      <Layers :size="13" />
      <span>Tout voir</span>
    </button>

    <div v-for="proj in allProjects" :key="proj" class="sidebar-project-group">
      <button
        class="sb-card"
        :class="{
          active: appStore.activeProject === proj,
          done: isProjectDone(proj),
        }"
        :style="{ '--card-color': getProjectColor(proj) }"
        @click="emit('selectProject', proj)"
        @contextmenu.prevent="emit('openProjectCtx', $event, proj)"
      >
        <div class="sb-card-head">
          <span class="sb-card-name">{{ parseCategoryIcon(proj).label }}</span>
          <Check v-if="isProjectDone(proj)" :size="12" class="sb-card-done" />
        </div>
        <div v-if="projectTimePct(proj) != null" class="sb-card-bar">
          <div class="sb-card-bar-fill" :style="{ width: projectTimePct(proj) + '%' }" />
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
  </nav>

  <NewProjectModal v-if="appStore.isTeacher" v-model="modals.newProject" @created="(name: string) => emit('projectCreated', name)" />
</template>

<style scoped>
.sb-card-home {
  margin-bottom: 4px;
}

.sb-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: calc(100% - 16px);
  padding: 8px 12px;
  margin: 2px 8px;
  border-radius: 6px;
  border: none;
  border-left: 3px solid var(--card-color, var(--accent));
  background: var(--bg-primary);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, box-shadow 0.15s;
}
.sb-card:hover {
  background: var(--bg-hover);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.sb-card.active {
  background: rgba(var(--accent-rgb), 0.12);
}
.sb-card.active .sb-card-name {
  font-weight: 700;
  color: var(--text-primary);
}
.sb-card.done {
  opacity: 0.55;
}

.sb-card-head {
  display: flex;
  align-items: center;
  gap: 6px;
}
.sb-card-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sb-card-done {
  flex-shrink: 0;
  color: var(--success, #4caf50);
}

.sb-card-bar {
  height: 2px;
  border-radius: 1px;
  background: var(--border);
  overflow: hidden;
}
.sb-card-bar-fill {
  height: 100%;
  border-radius: 1px;
  background: var(--card-color, var(--accent));
  transition: width 0.3s ease;
}
</style>
