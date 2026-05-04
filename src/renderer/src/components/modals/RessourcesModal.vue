<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import {
    ExternalLink, FileText, Trash2, Upload, Link2, Plus, X, CheckCircle2, Search,
    BookOpen, Github, Linkedin, Globe, Package, HelpCircle, ClipboardList,
  } from 'lucide-vue-next'
  import { useTravauxStore } from '@/stores/travaux'
  import { useAppStore }     from '@/stores/app'
  import { useToast }        from '@/composables/useToast'
  import { useConfirm }      from '@/composables/useConfirm'
  import { useOpenExternal } from '@/composables/useOpenExternal'
  import { useSimpleFileDrop } from '@/composables/useSimpleFileDrop'
  import Modal from '@/components/ui/Modal.vue'
  import type { AppDocument } from '@/types'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const travauxStore  = useTravauxStore()
  const appStore      = useAppStore()
  const { showToast }    = useToast()
  const { confirm }      = useConfirm()
  const { openExternal } = useOpenExternal()

  // ── Catégories disponibles ─────────────────────────────────────────────────
  const CATEGORIES = [
    { id: 'moodle',   label: 'Moodle',    icon: BookOpen,     color: '#f59e0b' },
    { id: 'github',   label: 'GitHub',    icon: Github,       color: '#24292e' },
    { id: 'linkedin', label: 'LinkedIn',  icon: Linkedin,     color: '#0a66c2' },
    { id: 'web',      label: 'Site Web',  icon: Globe,        color: '#22c55e' },
    { id: 'package',  label: 'Package',   icon: Package,        color: '#8b5cf6' },
    { id: 'grille',   label: 'Grille',    icon: ClipboardList, color: '#ef4444' },
    { id: 'autre',    label: 'Autre',     icon: HelpCircle,    color: '#8b8d91' },
  ]

  // ── Formulaire d'ajout ────────────────────────────────────────────────────
  const showForm    = ref(false)
  const addType     = ref<'file' | 'link'>('link')
  const addName     = ref('')
  const addLink     = ref('')
  const addFile     = ref<string | null>(null)
  const addFileName = ref<string | null>(null)
  const addCategory = ref('autre')
  const adding      = ref(false)

  // ── Recherche de documents existants ──────────────────────────────────────
  const showSearch       = ref(false)
  const searchQuery      = ref('')
  const searchResults    = ref<AppDocument[]>([])
  const searchLoading    = ref(false)
  let searchDebounce: ReturnType<typeof setTimeout> | null = null

  watch(searchQuery, (q) => {
    if (searchDebounce) clearTimeout(searchDebounce)
    if (!q.trim()) { searchResults.value = []; return }
    searchDebounce = setTimeout(() => doSearch(q.trim()), 300)
  })

  async function doSearch(q: string) {
    const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
    if (!promoId || !q) return
    searchLoading.value = true
    try {
      const res = await window.api.searchDocuments(promoId, q)
      if (res?.ok && res.data) {
        // Exclure les documents déjà liés à ce travail
        searchResults.value = (res.data as AppDocument[]).filter(
          d => d.travail_id !== selectedTravailId.value
        )
      }
    } finally {
      searchLoading.value = false
    }
  }

  async function linkExistingDoc(doc: AppDocument) {
    if (!selectedTravailId.value) return
    const res = await window.api.linkDocumentToTravail(doc.id, selectedTravailId.value)
    if (res?.ok) {
      showToast(`"${doc.name}" lié au devoir.`, 'success')
      searchResults.value = searchResults.value.filter(d => d.id !== doc.id)
      await travauxStore.fetchRessources(selectedTravailId.value)
    } else {
      showToast('Erreur lors de la liaison.', 'error')
    }
  }

  function openSearch() {
    showSearch.value = true
    showForm.value   = false
    searchQuery.value = ''
    searchResults.value = []
  }

  function closeSearch() {
    showSearch.value = false
    searchQuery.value = ''
    searchResults.value = []
  }

  // Travail sélectionné (défaut = currentTravailId du store)
  const selectedTravailId = ref<number | null>(appStore.currentTravailId)

  // Liste des travaux disponibles dans la promo active
  const availableTravaux = computed(() =>
    travauxStore.ganttData
      .filter(t => t.published)
      .sort((a, b) => a.title.localeCompare(b.title))
  )

  watch(() => props.modelValue, async (open) => {
    if (open) {
      // Initialiser le travail sélectionné
      selectedTravailId.value = appStore.currentTravailId ?? availableTravaux.value[0]?.id ?? null
      if (selectedTravailId.value) {
        await travauxStore.fetchRessources(selectedTravailId.value)
      }
      showForm.value   = false
      showSearch.value = false
    }
  })

  // Recharger les ressources quand on change de travail
  watch(selectedTravailId, async (id) => {
    if (id) await travauxStore.fetchRessources(id)
  })

  // Détecter automatiquement la catégorie depuis l'URL
  function detectCategory(url: string) {
    if (!url) return
    const lower = url.toLowerCase()
    if (lower.includes('moodle'))   { addCategory.value = 'moodle';   return }
    if (lower.includes('github'))   { addCategory.value = 'github';   return }
    if (lower.includes('linkedin')) { addCategory.value = 'linkedin'; return }
    if (lower.includes('npm') || lower.includes('pypi') || lower.includes('packag')) {
      addCategory.value = 'package'; return
    }
    addCategory.value = 'web'
  }

  function openForm() {
    addType.value     = 'link'
    addName.value     = ''
    addLink.value     = ''
    addFile.value     = null
    addFileName.value = null
    addCategory.value = 'autre'
    showForm.value    = true
    showSearch.value  = false
  }

  async function pickFile() {
    const res = await window.api.openFileDialog()
    if (res?.ok && res.data) {
      const paths = res.data as string[]
      const firstPath = paths[0]
      if (!firstPath) return
      addFile.value     = firstPath
      addFileName.value = firstPath.split(/[\\/]/).pop()?.replace(/^__web__\S+/, '') || firstPath.split(/[\\/]/).pop() || firstPath
      if (!addName.value) addName.value = addFileName.value ?? ''
    }
  }

  function clearFile() {
    addFile.value     = null
    addFileName.value = null
  }

  // Drag-and-drop sur la zone fichier (mode "file").
  const {
    isDragOver: isFileDragOver,
    onDragEnter: onFileDragEnter,
    onDragOver: onFileDragOver,
    onDragLeave: onFileDragLeave,
    onDrop: onFileZoneDrop,
  } = useSimpleFileDrop({
    onDrop: ([item]) => {
      if (!item?.path) return
      addFile.value     = item.path
      addFileName.value = item.name
      if (!addName.value) addName.value = item.name
    },
  })

  async function submitAdd() {
    if (!addName.value.trim() || !selectedTravailId.value) return
    if (addType.value === 'file' && !addFile.value) return
    if (addType.value === 'link' && !addLink.value.trim()) return
    adding.value = true
    try {
      let pathOrUrl: string | null = addType.value === 'link' ? addLink.value.trim() : addFile.value
      if (addType.value === 'file' && addFile.value) {
        const uploadRes = await window.api.uploadFile(addFile.value)
        if (!uploadRes?.ok || !uploadRes.data) { showToast('Erreur lors de l\'upload.', 'error'); return }
        pathOrUrl = uploadRes.data.url
      }
      const res = await window.api.addRessource({
        travailId:  selectedTravailId.value,
        type:       addType.value,
        name:       addName.value.trim(),
        pathOrUrl,
        category:   addCategory.value,
      })
      if (res?.ok) {
        showToast('Ressource ajoutée.', 'success')
        showForm.value = false
        await travauxStore.fetchRessources(selectedTravailId.value)
      } else {
        showToast('Erreur lors de l\'ajout.', 'error')
      }
    } finally {
      adding.value = false
    }
  }

  async function openResource(content: string, type: string) {
    if (type === 'link') await openExternal(content)
    else await window.api.openPath(content)
  }

  async function removeResource(id: number, source?: string) {
    if (!await confirm('Supprimer cette ressource ?', 'danger', 'Supprimer')) return
    if (source === 'document') {
      await window.api.deleteChannelDocument(id)
    } else {
      await window.api.deleteRessource(id)
    }
    if (selectedTravailId.value) await travauxStore.fetchRessources(selectedTravailId.value)
  }

  function catInfo(catId: string) {
    return CATEGORIES.find(c => c.id === catId) ?? CATEGORIES[CATEGORIES.length - 1]
  }
</script>

<template>
  <Modal :model-value="modelValue" title="Ressources pédagogiques" max-width="560px" @update:model-value="emit('update:modelValue', $event)">
    <div class="ress-body">

      <!-- Sélecteur de travail -->
      <div v-if="availableTravaux.length > 1" class="ress-travail-selector">
        <label class="ress-travail-label">Travail associé</label>
        <select v-model="selectedTravailId" class="ress-travail-select">
          <option v-for="t in availableTravaux" :key="t.id" :value="t.id">{{ t.title }}</option>
        </select>
      </div>

      <!-- Aucun travail disponible -->
      <div v-if="!selectedTravailId" class="ress-empty">
        Aucun travail publié disponible dans cette promotion.
      </div>

      <template v-else>
        <!-- Liste des ressources -->
        <ul class="ress-list">
          <li v-if="!travauxStore.ressources.length && !showForm && !showSearch" class="ress-empty">
            Aucune ressource attachée à ce travail.
          </li>

          <li v-for="r in travauxStore.ressources" :key="`${r.source}-${r.id}`" class="ress-item">
            <!-- Icône catégorie -->
            <div class="ress-item-cat" :style="{ background: catInfo(r.category ?? 'autre').color + '22', color: catInfo(r.category ?? 'autre').color }">
              <component :is="catInfo(r.category ?? 'autre').icon" :size="13" />
            </div>
            <button class="ress-item-name btn-ghost" @click="openResource(r.content, r.type)">
              {{ r.name }}
            </button>
            <span class="ress-item-badge" :style="{ background: catInfo(r.category ?? 'autre').color + '22', color: catInfo(r.category ?? 'autre').color }">
              {{ catInfo(r.category ?? 'autre').label }}
            </span>
            <span class="ress-item-type">{{ r.type === 'link' ? 'Lien' : 'Fichier' }}</span>
            <button v-if="appStore.isTeacher" class="btn-icon ress-item-delete" title="Supprimer" @click="removeResource(r.id, r.source)">
              <Trash2 :size="13" />
            </button>
          </li>
        </ul>

        <!-- Recherche de documents existants -->
        <div v-if="showSearch && appStore.isTeacher" class="ress-form">
          <div class="ress-form-header">
            <span class="ress-form-title">Associer un document existant</span>
            <button class="btn-icon" aria-label="Fermer" @click="closeSearch"><X :size="14" /></button>
          </div>

          <div class="ress-search-input-wrap">
            <Search :size="14" class="ress-search-icon" />
            <input
              v-model="searchQuery"
              type="text"
              class="form-input ress-search-input"
              placeholder="Rechercher un document par nom…"
              autofocus
            />
          </div>

          <div v-if="searchLoading" class="ress-empty" style="padding:12px">Recherche…</div>

          <ul v-else-if="searchResults.length" class="ress-list ress-search-results">
            <li v-for="doc in searchResults" :key="doc.id" class="ress-item ress-search-item" @click="linkExistingDoc(doc)">
              <div class="ress-item-cat" :style="{ background: catInfo(doc.category ?? 'autre').color + '22', color: catInfo(doc.category ?? 'autre').color }">
                <component :is="catInfo(doc.category ?? 'autre').icon" :size="13" />
              </div>
              <span class="ress-search-item-name">{{ doc.name }}</span>
              <span class="ress-item-type">{{ doc.type === 'link' ? 'Lien' : 'Fichier' }}</span>
              <Plus :size="14" class="ress-search-item-add" />
            </li>
          </ul>

          <div v-else-if="searchQuery.trim()" class="ress-empty" style="padding:12px">
            Aucun document trouvé.
          </div>
        </div>

        <!-- Formulaire d'ajout -->
        <div v-if="showForm && appStore.isTeacher" class="ress-form">
          <div class="ress-form-header">
            <span class="ress-form-title">Nouvelle ressource</span>
            <button class="btn-icon" aria-label="Fermer le formulaire" @click="showForm = false"><X :size="14" /></button>
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

          <!-- Catégorie -->
          <div class="form-group">
            <label class="form-label">Catégorie</label>
            <div class="ress-cat-pills">
              <button
                v-for="cat in CATEGORIES"
                :key="cat.id"
                type="button"
                class="ress-cat-pill"
                :class="{ active: addCategory === cat.id }"
                :style="addCategory === cat.id ? { background: cat.color + '22', color: cat.color, borderColor: cat.color } : {}"
                @click="addCategory = cat.id"
              >
                <component :is="cat.icon" :size="12" />
                {{ cat.label }}
              </button>
            </div>
          </div>

          <!-- Nom -->
          <div class="form-group">
            <label class="form-label">Nom affiché</label>
            <input v-model="addName" type="text" class="form-input" placeholder="ex : Cours chapitre 3, Documentation…" autofocus />
          </div>

          <!-- URL ou fichier -->
          <div class="form-group">
            <template v-if="addType === 'link'">
              <label class="form-label">URL</label>
              <input
                v-model="addLink"
                type="url"
                class="form-input"
                placeholder="https://…"
                @blur="detectCategory(addLink)"
              />
            </template>
            <template v-else>
              <label class="form-label">Fichier</label>
              <div v-if="addFile" class="ress-file-selected">
                <CheckCircle2 :size="15" class="ress-file-selected-icon" />
                <span class="ress-file-selected-name">{{ addFileName }}</span>
                <button class="ress-file-clear" type="button" aria-label="Retirer le fichier" @click="clearFile"><X :size="12" /></button>
              </div>
              <div
                v-else
                class="ress-file-picker"
                :class="{ 'ress-file-picker--drag-over': isFileDragOver }"
                role="button"
                tabindex="0"
                @click="pickFile"
                @keydown.enter.prevent="pickFile"
                @keydown.space.prevent="pickFile"
                @dragenter="onFileDragEnter"
                @dragover="onFileDragOver"
                @dragleave="onFileDragLeave"
                @drop="onFileZoneDrop"
              >
                <Upload :size="16" />
                <span>{{ isFileDragOver ? 'Relacher pour deposer' : 'Glisser un fichier ou cliquer' }}</span>
              </div>
            </template>
          </div>

          <div class="ress-form-actions">
            <button class="btn-ghost" type="button" @click="showForm = false">Annuler</button>
            <button
              class="btn-cta"
              type="button"
              :disabled="!addName.trim() || !selectedTravailId || (addType === 'link' ? !addLink.trim() : !addFile) || adding"
              @click="submitAdd"
            >
              {{ adding ? 'Ajout…' : 'Ajouter' }}
            </button>
          </div>
        </div>
      </template>

    </div>

    <!-- Footer -->
    <div class="modal-footer ress-footer">
      <template v-if="appStore.isTeacher && !showForm && !showSearch && selectedTravailId">
        <button class="btn-ghost ress-add-btn" @click="openForm">
          <Plus :size="13" /> Nouvelle ressource
        </button>
        <button class="btn-ghost ress-add-btn" @click="openSearch">
          <Search :size="13" /> Associer un document
        </button>
      </template>
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

/* ── Sélecteur travail ── */
.ress-travail-selector {
  display: flex; align-items: center; gap: 10px;
}
.ress-travail-label {
  font-size: 12px; font-weight: 600; color: var(--text-secondary); white-space: nowrap;
}
.ress-travail-select {
  flex: 1; font-size: 12.5px; padding: 5px 8px;
  border: 1px solid var(--border-input); border-radius: var(--radius-sm);
  background: var(--bg-elevated); color: var(--text-primary);
  cursor: pointer; outline: none;
}

/* ── Liste ── */
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
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  transition: background var(--t-fast);
}
.ress-item:hover { background: var(--bg-hover); }

.ress-item-cat {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: var(--radius-sm); flex-shrink: 0;
}

.ress-item-name {
  flex: 1;
  text-align: left;
  font-size: 13px;
  padding: 2px 4px;
  justify-content: flex-start;
}

.ress-item-badge {
  font-size: 10px; font-weight: 600;
  padding: 2px 7px; border-radius: var(--radius);
  white-space: nowrap; flex-shrink: 0;
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

/* ── Formulaire ── */
.ress-form {
  background: var(--bg-elevated);
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

/* ── Pills catégories ── */
.ress-cat-pills {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.ress-cat-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px;
  border: 1.5px solid var(--border-input);
  border-radius: 20px;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font);
  font-size: 11.5px;
  cursor: pointer;
  transition: all .15s;
}
.ress-cat-pill:hover { background: var(--bg-hover); }
.ress-cat-pill.active { font-weight: 600; }

/* ── Fichier ── */
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
.ress-file-picker:hover,
.ress-file-picker--drag-over { border-color: var(--accent); color: var(--text-secondary); background: var(--accent-subtle); }
.ress-file-picker--drag-over { border-style: solid; box-shadow: 0 0 0 3px rgba(var(--accent-rgb), 0.15); }

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
.ress-file-clear { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px; display: flex; align-items: center; border-radius: var(--radius-xs); flex-shrink: 0; }
.ress-file-clear:hover { color: #ff6b6b; }

.ress-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* ── Recherche documents ── */
.ress-search-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.ress-search-icon {
  position: absolute;
  left: 10px;
  color: var(--text-muted);
  pointer-events: none;
}
.ress-search-input {
  padding-left: 32px !important;
}
.ress-search-results {
  max-height: 200px;
  overflow-y: auto;
}
.ress-search-item {
  cursor: pointer;
  transition: all .15s;
}
.ress-search-item:hover {
  border-color: var(--accent);
  background: var(--accent-subtle);
}
.ress-search-item-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ress-search-item-add {
  color: var(--accent);
  flex-shrink: 0;
  opacity: 0;
  transition: opacity .15s;
}
.ress-search-item:hover .ress-search-item-add {
  opacity: 1;
}

/* ── Footer ── */
.ress-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 8px;
}

.ress-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
</style>
