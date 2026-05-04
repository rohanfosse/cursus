<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Pencil, Copy, Trash2 } from 'lucide-vue-next'
import { useProjects, type CreateProjectPayload, type Project } from '@/composables/useProjects'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { useContextMenu } from '@/composables/useContextMenu'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'

const appStore = useAppStore()
const { projects, loading, loadProjects, createProject, updateProject, deleteProject } = useProjects()
const { showToast } = useToast()
const { confirm } = useConfirm()

const showCreate = ref(false)
const newName = ref('')
const newDesc = ref('')
const newDeadline = ref('')

onMounted(() => loadProjects())
watch(() => appStore.activePromoId, () => loadProjects())

async function handleCreate(): Promise<void> {
  const name = newName.value.trim()
  if (!name || !appStore.activePromoId) return

  const payload: CreateProjectPayload = {
    promoId: appStore.activePromoId,
    name,
    description: newDesc.value.trim() || undefined,
    deadline: newDeadline.value || undefined,
  }

  await createProject(payload)
  newName.value = ''
  newDesc.value = ''
  newDeadline.value = ''
  showCreate.value = false
}

async function handleDelete(id: number): Promise<void> {
  if (!confirm('Supprimer ce projet ? Cette action est irréversible.')) return
  await deleteProject(id)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const { ctx, open: openCtx, close: closeCtx } = useContextMenu<Project>()
const ctxItems = computed<ContextMenuItem[]>(() => {
  const p = ctx.value?.target
  if (!p) return []
  const items: ContextMenuItem[] = [
    { label: 'Copier le nom', icon: Copy, action: async () => {
      await navigator.clipboard.writeText(p.name)
      showToast('Nom copié.', 'success')
    } },
  ]
  if (appStore.isTeacher) {
    items.push({ label: 'Renommer', icon: Pencil, separator: true, action: async () => {
      const next = window.prompt('Nouveau nom du projet', p.name)?.trim()
      if (!next || next === p.name) return
      const ok = await updateProject(p.id, { name: next })
      if (ok) showToast('Projet renommé.', 'success')
    } })
    items.push({ label: 'Supprimer', icon: Trash2, danger: true, action: async () => {
      if (!await confirm(`Supprimer le projet "${p.name}" ? Cette action est irréversible.`, 'danger', 'Supprimer')) return
      const ok = await deleteProject(p.id)
      if (ok) showToast('Projet supprimé.', 'success')
    } })
  }
  return items
})
</script>

<template>
  <div class="project-panel">
    <div class="panel-header">
      <h3>Projets</h3>
      <button
        v-if="appStore.isTeacher"
        class="btn-sm"
        @click="showCreate = !showCreate"
      >
        {{ showCreate ? 'Annuler' : '+ Projet' }}
      </button>
    </div>

    <!-- Formulaire de creation -->
    <div v-if="showCreate" class="create-form">
      <input
        v-model="newName"
        placeholder="Nom du projet"
        class="input-sm"
        @keydown.enter="handleCreate"
      />
      <input
        v-model="newDesc"
        placeholder="Description (optionnel)"
        class="input-sm"
      />
      <input
        v-model="newDeadline"
        type="date"
        class="input-sm"
      />
      <button
        class="btn-primary-sm"
        :disabled="!newName.trim()"
        @click="handleCreate"
      >
        Creer
      </button>
    </div>

    <!-- Chargement -->
    <div v-if="loading" class="empty">Chargement...</div>

    <!-- Liste des projets -->
    <div
      v-for="project in projects"
      :key="project.id"
      class="project-card"
      @contextmenu="openCtx($event, project)"
    >
      <div class="project-name">{{ project.name }}</div>
      <div v-if="project.description" class="project-desc">
        {{ project.description }}
      </div>
      <div class="project-meta">
        <span v-if="project.deadline">
          Deadline : {{ formatDate(project.deadline) }}
        </span>
      </div>
      <button
        v-if="appStore.isTeacher"
        class="btn-danger-sm"
        @click="handleDelete(project.id)"
      >
        Supprimer
      </button>
    </div>

    <!-- Etat vide -->
    <div v-if="!loading && projects.length === 0" class="empty">
      Aucun projet dans cette promotion.
    </div>

    <ContextMenu
      v-if="ctx"
      :x="ctx.x"
      :y="ctx.y"
      :items="ctxItems"
      @close="closeCtx"
    />
  </div>
</template>

<style scoped>
.project-panel {
  padding: 12px;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.panel-header h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
}
.create-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-2);
}
.input-sm {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-1);
  font-size: 13px;
  color: var(--text-1);
}
.input-sm:focus {
  outline: none;
  border-color: var(--accent);
}
.btn-sm {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: transparent;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-2);
}
.btn-sm:hover {
  background: var(--bg-2);
}
.btn-primary-sm {
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--cta);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.btn-primary-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-primary-sm:not(:disabled):hover {
  background: var(--cta-hover);
}
.btn-danger-sm {
  padding: 4px 8px;
  border-radius: var(--radius-xs);
  border: none;
  background: rgba(220, 38, 38, 0.1);
  color: #dc2626;
  font-size: 11px;
  cursor: pointer;
  margin-top: 4px;
}
.btn-danger-sm:hover {
  background: rgba(220, 38, 38, 0.2);
}
.project-card {
  padding: 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  margin-bottom: 8px;
}
.project-name {
  font-weight: 600;
  font-size: 14px;
}
.project-desc {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 2px;
}
.project-meta {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 4px;
}
.empty {
  font-size: 13px;
  color: var(--text-3);
  text-align: center;
  padding: 20px;
}
</style>
