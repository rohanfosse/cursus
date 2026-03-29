<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useProjects, type CreateProjectPayload } from '@/composables/useProjects'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const { projects, loading, loadProjects, createProject, deleteProject } = useProjects()

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
  border-radius: 8px;
  background: var(--bg-2);
}
.input-sm {
  padding: 6px 10px;
  border-radius: 6px;
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
  border-radius: 6px;
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
  border-radius: 6px;
  border: none;
  background: var(--accent);
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
  filter: brightness(1.1);
}
.btn-danger-sm {
  padding: 4px 8px;
  border-radius: 4px;
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
  border-radius: 8px;
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
