<script setup lang="ts">
  import ErrorBoundary from '@/components/ui/ErrorBoundary.vue'
  import UiPageHeader from '@/components/ui/UiPageHeader.vue'
  import { computed, ref, watch } from 'vue'
  import {
    Plus, Trash2, Search, X, FolderOpen, Menu,
    LayoutGrid, List, Grid3x3, Star, SlidersHorizontal,
  } from 'lucide-vue-next'
  import { safeGetJSON, safeSetJSON } from '@/utils/safeStorage'

  import { useAppStore }       from '@/stores/app'
  import { useDocumentsStore } from '@/stores/documents'
  import { parseCategoryIcon } from '@/utils/categoryIcon'
  import { getDocumentIcon, TYPE_FILTERS } from '@/utils/documentIcons'

  import { useDocumentsData } from '@/composables/useDocumentsData'
  import { useDocumentsAdd } from '@/composables/useDocumentsAdd'
  import { useDocumentsEdit } from '@/composables/useDocumentsEdit'
  import { useDocumentsBatchSelection } from '@/composables/useDocumentsBatchSelection'
  import { useDocumentsViewMode } from '@/composables/useDocumentsViewMode'
  import { useSlashFocusSearch } from '@/composables/useSlashFocusSearch'
  // Cahiers collaboratifs (TipTap + Yjs + Hocuspocus) : desactives pour le
  // pilote CESI 2026 — feature non utilisee, economise ~800 Ko + dependances
  // hocuspocus cote serveur. Les composants Vue et la table DB restent pour
  // pouvoir reactiver sans migration.
  import DocumentAddModal from '@/components/documents/DocumentAddModal.vue'
  import DocumentEditModal from '@/components/documents/DocumentEditModal.vue'
  import DocumentCard from '@/components/documents/DocumentCard.vue'
  import DocumentsEmptyState from '@/components/documents/DocumentsEmptyState.vue'
  import { useFileDrop } from '@/composables/useFileDrop'
  import { useToast } from '@/composables/useToast'
  import DropOverlay from '@/components/ui/DropOverlay.vue'

  const props = defineProps<{ toggleSidebar?: () => void }>()

  const api      = window.api
  const appStore = useAppStore()
  const docStore = useDocumentsStore()

  // ── View mode: grid vs list (persiste en localStorage) ───────────────
  const { mode: viewMode } = useDocumentsViewMode()

  // ── Raccourci clavier : '/' focalise la recherche (convention cross-vues) ──
  useSlashFocusSearch('.docs-search-input')

  // ── Drag & drop ────────────────────────────────────────────────────────
  const { isDragOver, pendingFile, uploading, onDragEnter, onDragLeave, onDragOver, onDrop, submitDocument, cancelDrop } = useFileDrop()

  async function onDropConfirm(name: string, category: string) {
    const ok = await submitDocument({ name, category })
    if (ok) loadDocuments()
  }

  // ── Search results count ──────────────────────────────────────────────
  const searchResultsCount = computed(() => {
    if (!docStore.searchQuery.trim()) return null
    return filtered.value.length
  })

  // ── Human-readable file size ──────────────────────────────────────────
  function formatFileSize(bytes: number | undefined): string | null {
    if (bytes == null || bytes <= 0) return null
    const units = ['o', 'Ko', 'Mo', 'Go']
    let i = 0
    let size = bytes
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
    return `${i === 0 ? size : size.toFixed(1)} ${units[i]}`
  }

  // ── DocumentCard icon props (4 derivees d'un seul appel) ──────────────
  function iconBindings(doc: import('@/types').AppDocument) {
    const icon = getDocumentIcon(doc)
    return {
      iconKey:       icon.type,
      iconColor:     icon.color,
      iconLabel:     icon.label,
      iconComponent: icon.component,
    }
  }

  // ── Data: loading, filtering, categories, actions ───────────────────────
  const {
    activeTypeFilter,
    sortBy,
    showFavoritesOnly,
    filtered,
    categories,
    byCategory,
    totalStorageBytes,
    recentCount,
    openDoc,
    deleteDoc,
    loadDocuments,
  } = useDocumentsData()

  // ── Batch selection ──────────────────────────────────────────────────
  const {
    selectionMode,
    selectedIds,
    toggle: toggleSelection,
    selectAll,
    clear: clearSelection,
    deleteSelected,
  } = useDocumentsBatchSelection(filtered)

  /** Format storage size */
  function formatStorage(bytes: number): string {
    if (bytes <= 0) return '0 o'
    const units = ['o', 'Ko', 'Mo', 'Go']
    let i = 0; let size = bytes
    while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
    return `${i === 0 ? size : size.toFixed(1)} ${units[i]}`
  }

  // ── "Nouveau" badge: documents added in the last 24 h ───────────────────
  function isRecent(dateStr: string): boolean {
    return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000
  }

  // ── Add/Edit modals (extracted to components) ─────────────────────────────
  const { openAddModal } = useDocumentsAdd()
  const { openEditModal } = useDocumentsEdit()

  // ── Copy link ───────────────────────────────────────────────────────────
  const { showToast } = useToast()
  async function copyDocLink(doc: import('@/types').AppDocument) {
    await navigator.clipboard.writeText(doc.content)
    showToast('Lien copié !', 'success')
  }

  // ── Bandeau d'options repliable (style Word) ─────────────────────────────
  // Par defaut ferme pour alleger le header ; persiste le choix utilisateur.
  const OPTIONS_KEY = 'cc_docs_show_options'
  const showOptions = ref<boolean>(safeGetJSON<boolean>(OPTIONS_KEY, false))
  watch(showOptions, v => safeSetJSON(OPTIONS_KEY, v))
</script>

<template>
  <ErrorBoundary label="Ressources">
  <div
    id="documents-area" class="docs-layout"
    @dragenter="onDragEnter" @dragleave="onDragLeave"
    @dragover="onDragOver" @drop="onDrop"
  >

    <!-- ── Header ─────────────────────────────────────────────────────── -->
    <UiPageHeader wrap class="docs-header">
      <template #leading>
        <button v-if="props.toggleSidebar" class="mobile-hamburger" aria-label="Ouvrir le menu" @click="props.toggleSidebar">
          <Menu :size="22" />
        </button>
        <FolderOpen :size="18" class="docs-header-icon" />
      </template>
      <template #title>
        <div class="docs-header-title-block">
          <h1 class="docs-header-title">Ressources</h1>
          <span v-if="appStore.activeProject" class="docs-header-channel">{{ parseCategoryIcon(appStore.activeProject).label }}</span>
          <span v-else class="docs-header-channel">Tous les projets</span>
        </div>
      </template>

      <template #actions>
        <div class="docs-header-actions">
          <!-- Recherche (toujours visible, element principal) -->
          <div class="docs-search">
            <Search :size="14" class="docs-search-icon" />
            <input
              v-model="docStore.searchQuery"
              type="text"
              class="docs-search-input"
              placeholder="Rechercher…  ( / )"
            />
            <button v-if="docStore.searchQuery" class="docs-search-clear" aria-label="Effacer la recherche" @click="docStore.searchQuery = ''">
              <X :size="12" />
            </button>
          </div>
          <span v-if="searchResultsCount !== null" class="docs-results-count">{{ searchResultsCount }} résultat{{ searchResultsCount !== 1 ? 's' : '' }}</span>

          <!-- Bouton Options (ouvre/ferme le bandeau) -->
          <button
            class="docs-options-toggle"
            :class="{ active: showOptions }"
            :title="showOptions ? 'Masquer les options' : 'Afficher les options'"
            :aria-expanded="showOptions"
            aria-controls="docs-options-bar"
            @click="showOptions = !showOptions"
          >
            <SlidersHorizontal :size="14" />
            <span class="docs-options-label">Options</span>
          </button>

          <!-- Ajouter (prof) — action principale, reste visible -->
          <button v-if="appStore.isTeacher" class="btn-primary docs-add-btn" @click="openAddModal">
            <Plus :size="14" />
            Ajouter
          </button>
        </div>
      </template>
    </UiPageHeader>

    <!-- ── Bandeau d'options repliable (style Word) ─────────────────────── -->
    <Transition name="docs-options-slide">
      <div v-if="showOptions" id="docs-options-bar" class="docs-options-bar" role="region" aria-label="Options d'affichage">
        <!-- Vue -->
        <div class="docs-options-group">
          <span class="docs-options-group-label">Vue</span>
          <div class="docs-view-toggle">
            <button class="docs-view-btn" :class="{ active: viewMode === 'grid' }" title="Grille" aria-label="Vue grille" @click="viewMode = 'grid'"><LayoutGrid :size="14" /></button>
            <button class="docs-view-btn" :class="{ active: viewMode === 'dense' }" title="Dense" aria-label="Vue dense" @click="viewMode = 'dense'"><Grid3x3 :size="14" /></button>
            <button class="docs-view-btn" :class="{ active: viewMode === 'list' }" title="Liste" aria-label="Vue liste" @click="viewMode = 'list'"><List :size="14" /></button>
          </div>
        </div>

        <!-- Tri -->
        <div class="docs-options-group">
          <span class="docs-options-group-label">Trier</span>
          <select v-model="sortBy" class="docs-sort-select" aria-label="Trier les documents">
            <option value="date">Plus récents</option>
            <option value="name">Nom A-Z</option>
            <option value="type">Par type</option>
            <option value="size">Par taille</option>
          </select>
        </div>

        <!-- Type -->
        <div class="docs-options-group docs-options-group--type">
          <span class="docs-options-group-label">Type</span>
          <button
            v-for="tf in TYPE_FILTERS"
            :key="tf.id ?? 'all'"
            class="docs-cat-pill"
            :class="{ active: activeTypeFilter === tf.id }"
            @click="activeTypeFilter = activeTypeFilter === tf.id ? null : tf.id"
          >
            {{ tf.label }}
          </button>
        </div>

        <!-- Favoris + actions (teacher) -->
        <div class="docs-options-group">
          <button
            class="docs-cat-pill docs-fav-pill"
            :class="{ active: showFavoritesOnly }"
            @click="showFavoritesOnly = !showFavoritesOnly"
          >
            <Star :size="11" /> Favoris
          </button>
          <template v-if="appStore.isTeacher">
            <button v-if="!selectionMode" class="docs-cat-pill" @click="selectionMode = true">Sélectionner</button>
            <template v-else>
              <button class="docs-cat-pill" @click="selectAll">Tout cocher</button>
              <button v-if="selectedIds.size > 0" class="docs-cat-pill docs-batch-delete" @click="deleteSelected">
                <Trash2 :size="11" /> Supprimer ({{ selectedIds.size }})
              </button>
              <button class="docs-cat-pill" @click="clearSelection">Annuler</button>
            </template>
          </template>
        </div>

        <!-- Stats compactees : infos secondaires -->
        <div v-if="docStore.documents.length" class="docs-options-stats">
          <span>{{ docStore.documents.length }} docs</span>
          <span v-if="recentCount > 0" class="docs-stat-value--accent">· {{ recentCount }} cette semaine</span>
          <span v-if="totalStorageBytes > 0">· {{ formatStorage(totalStorageBytes) }}</span>
          <span>· {{ categories.length }} catégorie{{ categories.length > 1 ? 's' : '' }}</span>
        </div>
      </div>
    </Transition>

    <!-- ── Filtres catégories (reste visible, principal filtre) ─────────── -->
    <div v-if="categories.length > 1" class="docs-categories">
      <button
        class="docs-cat-pill"
        :class="{ active: !docStore.activeCategory }"
        @click="docStore.activeCategory = ''"
      >
        Tout <span class="docs-cat-count">{{ docStore.documents.length }}</span>
      </button>
      <button
        v-for="cat in categories"
        :key="cat"
        class="docs-cat-pill"
        :class="{ active: docStore.activeCategory === cat }"
        @click="docStore.activeCategory = docStore.activeCategory === cat ? '' : cat"
      >
        {{ cat }}
        <span class="docs-cat-count">{{ docStore.documents.filter((d) => (d.category ?? 'Général') === cat).length }}</span>
      </button>
    </div>

    <!-- ── Contenu ─────────────────────────────────────────────────────── -->
    <div class="docs-body">

      <!-- Squelettes -->
      <template v-if="docStore.loading">
        <div v-for="i in 8" :key="i" class="doc-card doc-card--skel">
          <div class="skel doc-card-icon-skel" />
          <div class="skel skel-line skel-w70" style="margin-top:10px" />
          <div class="skel skel-line skel-w50" style="margin-top:6px" />
        </div>
      </template>

      <!-- ── Dense mode (flat grid, no categories) ── -->
      <template v-else-if="filtered.length && viewMode === 'dense'">
        <div class="docs-grid docs-grid--dense">
          <DocumentCard
            v-for="doc in filtered"
            :key="doc.id"
            :doc="doc"
            view-mode="dense"
            :selection-mode="selectionMode"
            :selected="selectedIds.has(doc.id)"
            v-bind="iconBindings(doc)"
            :is-recent="isRecent(doc.created_at)"
            :file-size="doc.type === 'file' ? formatFileSize(doc.file_size) : null"
            @open="openDoc(doc)"
            @toggle-select="toggleSelection(doc.id)"
            @copy-link="copyDocLink(doc)"
            @download="api.downloadFile(doc.content)"
            @edit="openEditModal(doc)"
            @delete="deleteDoc(doc.id)"
          />
        </div>
      </template>

      <!-- ── Normal grouped view (grid / list) ── -->
      <template v-else-if="filtered.length">
        <template v-for="[cat, docs] in byCategory" :key="cat">
          <div v-if="byCategory.size > 1" class="docs-group-header">
            <span class="docs-group-label">{{ cat }}</span>
            <span class="docs-group-count">{{ docs.length }} fichier{{ docs.length > 1 ? 's' : '' }}</span>
          </div>

          <!-- List header (sortable columns) -->
          <div v-if="viewMode === 'list'" class="docs-list-header">
            <span class="docs-lh-icon" />
            <button class="docs-lh-col docs-lh-col--name" :class="{ active: sortBy === 'name' }" @click="sortBy = 'name'">Nom</button>
            <button class="docs-lh-col docs-lh-col--type" :class="{ active: sortBy === 'type' }" @click="sortBy = 'type'">Type</button>
            <button class="docs-lh-col docs-lh-col--date" :class="{ active: sortBy === 'date' }" @click="sortBy = 'date'">Date</button>
            <span class="docs-lh-col docs-lh-col--actions" />
          </div>

          <div class="docs-grid" :class="{ 'docs-grid--list': viewMode === 'list' }">
            <DocumentCard
              v-for="doc in docs"
              :key="doc.id"
              :doc="doc"
              :view-mode="viewMode"
              :selection-mode="selectionMode"
              :selected="selectedIds.has(doc.id)"
              v-bind="iconBindings(doc)"
              :is-recent="isRecent(doc.created_at)"
              :file-size="doc.type === 'file' ? formatFileSize(doc.file_size) : null"
              @open="openDoc(doc)"
              @toggle-select="toggleSelection(doc.id)"
              @copy-link="copyDocLink(doc)"
              @download="api.downloadFile(doc.content)"
              @edit="openEditModal(doc)"
              @delete="deleteDoc(doc.id)"
            />
          </div>
        </template>
      </template>

      <!-- Etat vide -->
      <DocumentsEmptyState v-else @add="openAddModal" />

    </div>

    <!-- Modales extraites en composants -->
    <DocumentAddModal />
    <DocumentEditModal />

    <!-- Drag & drop overlay -->
    <DropOverlay
      :is-drag-over="isDragOver"
      :pending-file="pendingFile"
      :uploading="uploading"
      @confirm="onDropConfirm"
      @cancel="cancelDrop"
    />
  </div> <!-- /docs-layout v-else -->
  </ErrorBoundary>
</template>


<style>@import '@/assets/css/documents.css';</style>
