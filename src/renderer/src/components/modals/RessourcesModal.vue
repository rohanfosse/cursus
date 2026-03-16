<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { ExternalLink, FileText, Trash2, Upload, Link2, Plus, X, CheckCircle2 } from 'lucide-vue-next'
  import { useTravauxStore } from '@/stores/travaux'
  import { useAppStore }     from '@/stores/app'
  import { useToast }        from '@/composables/useToast'
  import Modal from '@/components/ui/Modal.vue'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const travauxStore  = useTravauxStore()
  const appStore      = useAppStore()
  const { showToast } = useToast()

  // ── Formulaire d'ajout ────────────────────────────────────────────────────
  const showForm    = ref(false)
  const addType     = ref<'file' | 'link'>('link')
  const addName     = ref('')
  const addLink     = ref('')
  const addFile     = ref<string | null>(null)
  const addFileName = ref<string | null>(null)
  const adding      = ref(false)

  watch(() => props.modelValue, async (open) => {
    if (open && appStore.currentTravailId) {
      await travauxStore.fetchRessources(appStore.currentTravailId)
      showForm.value = false
    }
  })

  function openForm() {
    addType.value     = 'link'
    addName.value     = ''
    addLink.value     = ''
    addFile.value     = null
    addFileName.value = null
    showForm.value    = true
  }

  async function pickFile() {
    const res = await window.api.openFileDialog()
    if (res?.ok && res.data) {
      addFile.value     = res.data
      addFileName.value = res.data.split(/[\\/]/).pop() ?? res.data
      if (!addName.value) addName.value = addFileName.value ?? ''
    }
  }

  function clearFile() {
    addFile.value     = null
    addFileName.value = null
  }

  async function submitAdd() {
    if (!addName.value.trim() || !appStore.currentTravailId) return
    if (addType.value === 'file' && !addFile.value) return
    if (addType.value === 'link' && !addLink.value.trim()) return
    adding.value = true
    try {
      const res = await window.api.addRessource({
        travailId:  appStore.currentTravailId,
        type:       addType.value,
        name:       addName.value.trim(),
        pathOrUrl:  addType.value === 'link' ? addLink.value.trim() : addFile.value,
      })
      if (res?.ok) {
        showToast('Ressource ajoutée.', 'success')
        showForm.value = false
        await travauxStore.fetchRessources(appStore.currentTravailId)
      } else {
        showToast('Erreur lors de l\'ajout.')
      }
    } finally {
      adding.value = false
    }
  }

  async function openResource(content: string, type: string) {
    if (type === 'link') await window.api.openExternal(content)
    else await window.api.openPath(content)
  }

  async function removeResource(id: number) {
    if (!confirm('Supprimer cette ressource ?')) return
    await window.api.deleteRessource(id)
    if (appStore.currentTravailId) await travauxStore.fetchRessources(appStore.currentTravailId)
  }
</script>

<template>
  <Modal :model-value="modelValue" title="Ressources pédagogiques" max-width="520px" @update:model-value="emit('update:modelValue', $event)">
    <div class="ress-body">

      <!-- Liste des ressources -->
      <ul class="ress-list">
        <li v-if="!travauxStore.ressources.length && !showForm" class="ress-empty">
          Aucune ressource attachée à ce travail.
        </li>

        <li
          v-for="r in travauxStore.ressources"
          :key="r.id"
          class="ress-item"
        >
          <div class="ress-item-icon" :class="r.type === 'link' ? 'icon-link' : 'icon-file'">
            <ExternalLink v-if="r.type === 'link'" :size="14" />
            <FileText     v-else :size="14" />
          </div>
          <button class="ress-item-name btn-ghost" @click="openResource(r.content, r.type)">
            {{ r.name }}
          </button>
          <span class="ress-item-type">{{ r.type === 'link' ? 'Lien' : 'Fichier' }}</span>
          <button
            v-if="appStore.isTeacher"
            class="btn-icon ress-item-delete"
            title="Supprimer"
            @click="removeResource(r.id)"
          >
            <Trash2 :size="13" />
          </button>
        </li>
      </ul>

      <!-- Formulaire d'ajout -->
      <div v-if="showForm && appStore.isTeacher" class="ress-form">
        <div class="ress-form-header">
          <span class="ress-form-title">Nouvelle ressource</span>
          <button class="btn-icon" @click="showForm = false"><X :size="14" /></button>
        </div>

        <!-- Toggle type -->
        <div class="ress-type-toggle">
          <button class="ress-type-btn" :class="{ active: addType === 'link' }" type="button" @click="addType = 'link'">
            <Link2 :size="13" /> Lien URL
          </button>
          <button class="ress-type-btn" :class="{ active: addType === 'file' }" type="button" @click="addType = 'file'">
            <Upload :size="13" /> Fichier
          </button>
        </div>

        <!-- Nom -->
        <div class="form-group">
          <label class="form-label">Nom affiché</label>
          <input
            v-model="addName"
            type="text"
            class="form-input"
            placeholder="ex : Cours chapitre 3, Documentation…"
            autofocus
          />
        </div>

        <!-- URL ou fichier -->
        <div class="form-group">
          <template v-if="addType === 'link'">
            <label class="form-label">URL</label>
            <input v-model="addLink" type="url" class="form-input" placeholder="https://…" />
          </template>
          <template v-else>
            <label class="form-label">Fichier</label>
            <div v-if="addFile" class="ress-file-selected">
              <CheckCircle2 :size="15" class="ress-file-selected-icon" />
              <span class="ress-file-selected-name">{{ addFileName }}</span>
              <button class="ress-file-clear" type="button" @click="clearFile"><X :size="12" /></button>
            </div>
            <button v-else class="ress-file-picker" type="button" @click="pickFile">
              <Upload :size="16" />
              <span>Cliquer pour choisir…</span>
            </button>
          </template>
        </div>

        <div class="ress-form-actions">
          <button class="btn-ghost" type="button" @click="showForm = false">Annuler</button>
          <button
            class="btn-primary"
            type="button"
            :disabled="!addName.trim() || (addType === 'link' ? !addLink.trim() : !addFile) || adding"
            @click="submitAdd"
          >
            {{ adding ? 'Ajout…' : 'Ajouter' }}
          </button>
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div class="modal-footer ress-footer">
      <button
        v-if="appStore.isTeacher && !showForm"
        class="btn-ghost ress-add-btn"
        @click="openForm"
      >
        <Plus :size="13" /> Ajouter une ressource
      </button>
      <button class="btn-ghost" style="margin-left:auto" @click="emit('update:modelValue', false)">Fermer</button>
    </div>
  </Modal>
</template>

<style scoped>
.ress-body {
  padding: 12px 16px;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ress-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ress-empty {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
}

.ress-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: rgba(255,255,255,.03);
  border: 1px solid var(--border);
  transition: background var(--t-fast);
}
.ress-item:hover { background: rgba(255,255,255,.06); }

.ress-item-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.icon-link { color: #27AE60; }
.icon-file { color: var(--accent); }

.ress-item-name {
  flex: 1;
  text-align: left;
  font-size: 13px;
  padding: 2px 4px;
  justify-content: flex-start;
}

.ress-item-type {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .3px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.ress-item-delete {
  color: var(--text-muted);
  flex-shrink: 0;
}
.ress-item-delete:hover { color: var(--color-danger); }

/* Formulaire */
.ress-form {
  background: rgba(255,255,255,.03);
  border: 1px solid var(--border-input);
  border-radius: var(--radius);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ress-form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ress-form-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.ress-type-toggle {
  display: flex;
  gap: 6px;
}

.ress-type-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border: 1.5px solid var(--border-input);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font);
  font-size: 12px;
  cursor: pointer;
  transition: all .15s;
}
.ress-type-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.ress-type-btn.active { background: var(--accent-subtle); color: var(--accent-light); border-color: var(--accent); }

.ress-file-picker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1.5px dashed var(--border-input);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  font-family: var(--font);
  font-size: 13px;
  cursor: pointer;
  width: 100%;
  transition: all .15s;
}
.ress-file-picker:hover { border-color: var(--accent); color: var(--text-secondary); background: var(--accent-subtle); }

.ress-file-selected {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1.5px solid #27AE60;
  border-radius: var(--radius-sm);
  background: rgba(39,174,96,.08);
}
.ress-file-selected-icon { color: #27AE60; flex-shrink: 0; }
.ress-file-selected-name { flex: 1; font-size: 13px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ress-file-clear { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; display: flex; align-items: center; border-radius: 4px; flex-shrink: 0; }
.ress-file-clear:hover { color: #ff6b6b; }

.ress-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* Footer */
.ress-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
}

.ress-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
</style>
