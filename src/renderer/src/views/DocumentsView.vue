<script setup lang="ts">
  import { ref, computed } from 'vue'
  import {
    FileText, Image, Link2, Video, File, Plus, Trash2,
    ExternalLink, Download, Search, X, Upload, FolderOpen, Eye, CheckCircle2, Menu,
    LayoutGrid, List,
  } from 'lucide-vue-next'
  import { useAppStore }       from '@/stores/app'
  import { useDocumentsStore } from '@/stores/documents'
  import Modal     from '@/components/ui/Modal.vue'
  import { formatDate } from '@/utils/date'
  import { parseCategoryIcon } from '@/utils/categoryIcon'

  import { useDocumentsData, docIconType, iconColors, iconLabels, TYPE_FILTERS } from '@/composables/useDocumentsData'
  import { useDocumentsAdd } from '@/composables/useDocumentsAdd'
  import { useFileDrop } from '@/composables/useFileDrop'
  import DropOverlay from '@/components/ui/DropOverlay.vue'

  const props = defineProps<{ toggleSidebar?: () => void }>()

  const api      = window.api
  const appStore = useAppStore()
  const docStore = useDocumentsStore()

  // ── View mode: grid vs list ───────────────────────────────────────────
  const viewMode = ref<'grid' | 'list'>('grid')

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

  // ── Data: loading, filtering, categories, actions ───────────────────────
  const {
    activeTypeFilter,
    filtered,
    categories,
    byCategory,
    openDoc,
    deleteDoc,
    loadDocuments,
  } = useDocumentsData()

  // ── "Nouveau" badge: documents added in the last 24 h ───────────────────
  function isRecent(dateStr: string): boolean {
    return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000
  }

  // ── Add modal ───────────────────────────────────────────────────────────
  const {
    showAddModal,
    addName,
    addCategory,
    addDescription,
    addType,
    addLink,
    addFile,
    addFileName,
    addProject,
    newCatName,
    projectList,
    adding,
    openAddModal,
    pickFile,
    clearFile,
    submitAdd,
  } = useDocumentsAdd()
</script>

<template>
  <div
    id="documents-area" class="docs-layout"
    @dragenter="onDragEnter" @dragleave="onDragLeave"
    @dragover="onDragOver" @drop="onDrop"
  >

    <!-- ── Header ─────────────────────────────────────────────────────── -->
    <header class="docs-header">
      <div class="docs-header-left">
        <button v-if="props.toggleSidebar" class="mobile-hamburger" aria-label="Ouvrir le menu" @click="props.toggleSidebar">
          <Menu :size="22" />
        </button>
        <FolderOpen :size="18" class="docs-header-icon" />
        <div class="docs-header-title-block">
          <h1 class="docs-header-title">Documents</h1>
          <span v-if="appStore.activeProject" class="docs-header-channel">{{ parseCategoryIcon(appStore.activeProject).label }}</span>
          <span v-else class="docs-header-channel">Tous les projets</span>
        </div>
      </div>

      <div class="docs-header-actions">
        <!-- Recherche -->
        <div class="docs-search">
          <Search :size="14" class="docs-search-icon" />
          <input
            v-model="docStore.searchQuery"
            type="text"
            class="docs-search-input"
            placeholder="Rechercher…"
          />
          <button v-if="docStore.searchQuery" class="docs-search-clear" @click="docStore.searchQuery = ''">
            <X :size="12" />
          </button>
        </div>
        <span v-if="searchResultsCount !== null" class="docs-results-count">{{ searchResultsCount }} résultat{{ searchResultsCount !== 1 ? 's' : '' }}</span>

        <!-- Toggle grille / liste -->
        <div class="docs-view-toggle">
          <button
            class="docs-view-btn"
            :class="{ active: viewMode === 'grid' }"
            title="Affichage grille"
            @click="viewMode = 'grid'"
          >
            <LayoutGrid :size="15" />
          </button>
          <button
            class="docs-view-btn"
            :class="{ active: viewMode === 'list' }"
            title="Affichage liste"
            @click="viewMode = 'list'"
          >
            <List :size="15" />
          </button>
        </div>

        <!-- Ajouter (prof) -->
        <button v-if="appStore.isTeacher" class="btn-primary docs-add-btn" @click="openAddModal">
          <Plus :size="14" />
          Ajouter
        </button>
      </div>
    </header>

    <!-- ── Filtres catégories ──────────────────────────────────────────── -->
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

    <!-- ── Filtres par type ──────────────────────────────────────────── -->
    <div class="docs-categories docs-type-filters">
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

      <!-- Documents groupés par catégorie -->
      <template v-else-if="filtered.length">
        <template v-for="[cat, docs] in byCategory" :key="cat">
          <div v-if="byCategory.size > 1" class="docs-group-header">
            <span class="docs-group-label">{{ cat }}</span>
            <span class="docs-group-count">{{ docs.length }} fichier{{ docs.length > 1 ? 's' : '' }}</span>
          </div>

          <div class="docs-grid" :class="{ 'docs-grid--list': viewMode === 'list' }">
            <div
              v-for="doc in docs"
              :key="doc.id"
              class="doc-card"
              :class="{ 'doc-card--list': viewMode === 'list' }"
              :title="doc.description ?? doc.name"
              @click="openDoc(doc)"
            >
              <div class="doc-card-icon" :style="{ background: iconColors[docIconType(doc)] + '1A', color: iconColors[docIconType(doc)] }">
                <Image    v-if="docIconType(doc) === 'image'" :size="viewMode === 'list' ? 20 : 28" />
                <Video    v-else-if="docIconType(doc) === 'video'" :size="viewMode === 'list' ? 20 : 28" />
                <Link2    v-else-if="docIconType(doc) === 'link'" :size="viewMode === 'list' ? 20 : 28" />
                <FileText v-else-if="docIconType(doc) === 'pdf'" :size="viewMode === 'list' ? 20 : 28" />
                <File     v-else :size="viewMode === 'list' ? 20 : 28" />
              </div>

              <span class="doc-card-type-badge" :style="{ background: iconColors[docIconType(doc)] + '22', color: iconColors[docIconType(doc)] }">
                {{ iconLabels[docIconType(doc)] }}
              </span>

              <p class="doc-card-name">
                {{ doc.name }}
                <span v-if="isRecent(doc.created_at)" class="doc-new-badge">Nouveau</span>
              </p>

              <p class="doc-card-meta">
                <span v-if="!appStore.activeChannelId && doc.channel_name">#{{ doc.channel_name }}</span>
                <span>{{ formatDate(doc.created_at) }}</span>
                <span v-if="doc.type === 'file' && formatFileSize(doc.file_size)" class="doc-card-size">{{ formatFileSize(doc.file_size) }}</span>
              </p>

              <div class="doc-card-actions" @click.stop>
                <button
                  class="doc-card-action-btn"
                  :title="doc.type === 'link' ? 'Ouvrir le lien' : 'Prévisualiser'"
                  @click="openDoc(doc)"
                >
                  <Eye v-if="doc.type === 'file'" :size="14" />
                  <ExternalLink v-else :size="14" />
                </button>
                <button
                  v-if="doc.type === 'file'"
                  class="doc-card-action-btn"
                  title="Télécharger"
                  @click="api.downloadFile(doc.content)"
                >
                  <Download :size="14" />
                </button>
                <button
                  v-if="appStore.isTeacher"
                  class="doc-card-action-btn doc-card-action-btn--danger"
                  title="Supprimer"
                  @click="deleteDoc(doc.id)"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
        </template>
      </template>

      <!-- État vide -->
      <div v-else class="docs-empty">
        <FolderOpen :size="40" class="docs-empty-icon" />
        <p class="docs-empty-title">Aucun document</p>
        <p class="docs-empty-sub">
          {{ docStore.searchQuery
            ? 'Aucun résultat pour cette recherche. Essayez d\'autres mots-clés.'
            : appStore.isStudent
              ? 'Aucun document pour le moment. Les documents seront ajoutés par votre pilote.'
              : 'Ce canal ne contient pas encore de document.'
          }}
        </p>
        <p v-if="appStore.isTeacher && !docStore.searchQuery" class="docs-empty-hint">
          <Upload :size="14" />
          Glissez un fichier ici ou cliquez Ajouter
        </p>
        <button v-if="appStore.isTeacher && !docStore.searchQuery" class="btn-primary" @click="openAddModal">
          <Plus :size="14" /> Ajouter un document
        </button>
      </div>

    </div>

    <!-- ── Modal ajout ─────────────────────────────────────────────────── -->
    <Modal v-model="showAddModal" title="Ajouter un document" max-width="520px">
      <form class="da" @submit.prevent="submitAdd">

        <!-- Toggle fichier / lien -->
        <div class="da-type-row">
          <button class="da-type-btn" :class="{ active: addType === 'file' }" type="button" @click="addType = 'file'">
            <Upload :size="15" /> Fichier
          </button>
          <button class="da-type-btn" :class="{ active: addType === 'link' }" type="button" @click="addType = 'link'">
            <Link2 :size="15" /> Lien URL
          </button>
        </div>

        <!-- Zone de depot fichier (en haut, bien visible) -->
        <div v-if="addType === 'file'" class="da-drop-zone">
          <div v-if="addFile" class="da-file-selected">
            <CheckCircle2 :size="20" class="da-file-icon" />
            <div class="da-file-info">
              <span class="da-file-name">{{ addFileName }}</span>
              <span class="da-file-hint">Fichier pret a etre envoye</span>
            </div>
            <button class="da-file-clear" type="button" title="Changer de fichier" @click="clearFile">
              <X :size="14" />
            </button>
          </div>
          <button v-else class="da-file-picker" type="button" @click="pickFile">
            <Upload :size="24" class="da-picker-icon" />
            <span class="da-picker-label">Cliquer ou glisser un fichier ici</span>
            <span class="da-picker-hint">PDF, Word, Excel, images, videos, archives</span>
          </button>
        </div>

        <!-- URL -->
        <div v-else class="da-field">
          <label class="da-label">Adresse URL</label>
          <input v-model="addLink" type="url" class="da-input" placeholder="https://drive.google.com/..." />
        </div>

        <!-- Nom -->
        <div class="da-field">
          <label class="da-label">Nom du document</label>
          <input v-model="addName" type="text" class="da-input" placeholder="ex : Cours reseaux - chapitre 3" autofocus />
        </div>

        <!-- Categorie (dropdown des existantes + saisie libre) -->
        <div class="da-row">
          <div class="da-field da-flex1">
            <label class="da-label">Categorie</label>
            <select v-if="categories.length && addCategory !== '__new__'" v-model="addCategory" class="da-input">
              <option value="">Sans categorie</option>
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
              <option value="__new__">+ Nouvelle categorie...</option>
            </select>
            <div v-if="!categories.length || addCategory === '__new__'" style="display:flex;gap:6px">
              <input
                v-model="newCatName"
                type="text"
                class="da-input"
                style="flex:1"
                placeholder="Nom de la categorie"
              />
              <button v-if="addCategory === '__new__'" type="button" class="btn-ghost" style="font-size:11px;padding:4px 8px" @click="addCategory = ''">Annuler</button>
            </div>
          </div>
          <div class="da-field da-flex1">
            <label class="da-label">Projet</label>
            <select v-model="addProject" class="da-input">
              <option value="">Aucun projet</option>
              <option v-for="p in projectList" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
        </div>

        <!-- Description -->
        <div class="da-field">
          <label class="da-label">Description <span class="da-hint">(optionnelle)</span></label>
          <textarea v-model="addDescription" class="da-input da-textarea" rows="2" placeholder="Breve description, consignes, contexte..." />
        </div>

        <!-- Footer -->
        <div class="da-footer">
          <button type="button" class="btn-ghost" @click="showAddModal = false">Annuler</button>
          <button
            type="submit" class="btn-primary da-submit"
            :disabled="!addName.trim() || (addType === 'file' && !addFile) || (addType === 'link' && !addLink.trim()) || adding"
          >
            {{ adding ? 'Envoi en cours...' : 'Ajouter' }}
          </button>
        </div>
      </form>
    </Modal>

    <!-- Drag & drop overlay -->
    <DropOverlay
      :is-drag-over="isDragOver"
      :pending-file="pendingFile"
      :uploading="uploading"
      @confirm="onDropConfirm"
      @cancel="cancelDrop"
    />
  </div>
</template>

<style scoped>
/* ── Layout global ── */
.docs-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--bg-main);
}

/* ── Header ── */
.docs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  background: var(--bg-main);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.docs-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.docs-header-icon { color: var(--accent); flex-shrink: 0; }

.docs-header-title-block {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.docs-header-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.docs-header-channel {
  font-size: 12px;
  color: var(--text-muted);
}

.docs-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Barre de recherche */
.docs-search {
  position: relative;
  display: flex;
  align-items: center;
}

.docs-search-icon {
  position: absolute;
  left: 9px;
  color: var(--text-muted);
  pointer-events: none;
}

.docs-search-input {
  background: var(--bg-hover);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font);
  font-size: 13px;
  padding: 5px 28px 5px 30px;
  width: 200px;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.docs-search-input:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }

.docs-search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(74,144,217,.15);
}

.docs-search-input::placeholder { color: var(--text-muted); }

.docs-search-clear {
  position: absolute;
  right: 7px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
}

.docs-add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  padding: 6px 12px;
  white-space: nowrap;
}

/* ── Catégories ── */
.docs-categories {
  display: flex;
  gap: 6px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.docs-categories::-webkit-scrollbar { display: none; }

.docs-cat-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  border-radius: 20px;
  border: 1.5px solid var(--border-input);
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  font-family: var(--font);
  cursor: pointer;
  white-space: nowrap;
  transition: all .15s;
  flex-shrink: 0;
}

.docs-cat-pill:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border);
}

.docs-cat-pill.active {
  background: var(--accent-subtle);
  color: var(--accent-light);
  border-color: var(--accent);
}

.docs-cat-count {
  background: var(--bg-elevated);
  border-radius: 8px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 600;
}

.docs-cat-pill.active .docs-cat-count {
  background: rgba(74,144,217,.2);
}

/* ── Corps ── */
.docs-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* ── En-tête de groupe ── */
.docs-group-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 8px 0 10px;
}

.docs-group-header:not(:first-child) { margin-top: 28px; }

.docs-group-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: var(--text-secondary);
}

.docs-group-count {
  font-size: 11px;
  color: var(--text-muted);
}

/* ── Grille ── */
.docs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 4px;
}

/* ── Carte ── */
.doc-card {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 14px 12px;
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0;
  transition: border-color .15s, box-shadow .15s, transform .15s;
  overflow: hidden;
}

.doc-card:hover {
  border-color: rgba(74,144,217,.3);
  box-shadow: 0 2px 12px rgba(0,0,0,.15);
  background: rgba(74,144,217,.07);
}

.doc-card--skel {
  cursor: default;
  min-height: 140px;
  animation: skel-pulse 1.8s ease-in-out infinite;
}
@keyframes skel-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: .45; }
}

.doc-card-icon-skel {
  width: 48px;
  height: 48px;
  border-radius: 10px;
}

.doc-card-icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-bottom: 12px;
}

.doc-card-type-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .4px;
  padding: 2px 6px;
  border-radius: 10px;
}

.doc-card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 6px;
}

.doc-card-meta {
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: auto;
}

/* Actions au survol */
.doc-card-actions {
  position: absolute;
  inset: 0;
  background: rgba(34,36,42,.88);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  opacity: 0;
  transition: opacity .15s;
  border-radius: var(--radius);
}

.doc-card:hover .doc-card-actions {
  opacity: 1;
}

.doc-card-action-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: none;
  background: var(--bg-active);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .12s;
}

.doc-card-action-btn:hover { background: var(--bg-elevated); }
.doc-card-action-btn--danger:hover { background: rgba(231,76,60,.3); color: #ff6b6b; }

/* ── Empty state ── */
.docs-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px 20px;
  text-align: center;
}

.docs-empty-icon { color: var(--text-muted); opacity: .3; }
.docs-empty-title { font-size: 15px; font-weight: 600; color: var(--text-secondary); }
.docs-empty-sub   { font-size: 13px; color: var(--text-muted); }

/* ── Form ajout ── */
.docs-add-form {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Modale ajout document (nouveau design) ── */
.da { display: flex; flex-direction: column; gap: 14px; padding: 16px 20px 4px; }
.da-field { display: flex; flex-direction: column; gap: 4px; }
.da-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; }
.da-hint { font-weight: 400; opacity: .6; }
.da-input {
  padding: 9px 12px; border-radius: 8px; font-size: 13px;
  border: 1px solid var(--border-input); background: var(--bg-input);
  color: var(--text-primary); font-family: var(--font); transition: border-color .15s;
}
.da-input:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 3px rgba(74,144,217,.12); }
.da-textarea { resize: vertical; min-height: 50px; }
.da-row { display: flex; gap: 10px; }
.da-flex1 { flex: 1; }
.da-cat-wrap { display: flex; flex-direction: column; gap: 6px; }

.da-type-row { display: flex; gap: 0; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
.da-type-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 10px; background: transparent; border: none;
  color: var(--text-muted); font-family: var(--font); font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all .15s;
}
.da-type-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.da-type-btn.active { background: var(--accent); color: #fff; }

.da-drop-zone { margin: 0; }
.da-file-picker {
  width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 28px 16px; border: 2px dashed var(--border-input); border-radius: 12px;
  background: var(--bg-elevated); color: var(--text-muted);
  font-family: var(--font); cursor: pointer; transition: all .2s; text-align: center;
}
.da-file-picker:hover { border-color: var(--accent); color: var(--accent); background: rgba(74,144,217,.04); }
.da-picker-icon { opacity: .5; margin-bottom: 2px; }
.da-picker-label { font-size: 13px; font-weight: 600; }
.da-picker-hint { font-size: 11px; opacity: .5; }

.da-file-selected {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; border: 1.5px solid var(--color-success); border-radius: 10px;
  background: rgba(39,174,96,.06);
}
.da-file-icon { color: var(--color-success); flex-shrink: 0; }
.da-file-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.da-file-name { font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.da-file-hint { font-size: 11px; color: var(--color-success); }
.da-file-clear {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; background: transparent; border: none; color: var(--text-muted);
  cursor: pointer; transition: all .15s; flex-shrink: 0;
}
.da-file-clear:hover { background: rgba(231,76,60,.1); color: var(--color-danger); }

.da-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 14px 0 4px; border-top: 1px solid var(--border);
}
.da-submit { min-width: 100px; }

@media (max-width: 500px) {
  .da-row { flex-direction: column; }
}

.form-label-hint {
  font-weight: 400;
  font-size: 11px;
  color: var(--text-muted);
  margin-left: 4px;
}

/* Badge canal read-only */
.docs-channel-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--accent-subtle);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  color: var(--accent-light);
  font-size: 13px;
  font-weight: 500;
}

.docs-channel-badge-hash {
  font-weight: 700;
  opacity: .7;
}

/* Toggle fichier / lien */
.docs-type-toggle {
  display: flex;
  gap: 8px;
}

.docs-type-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border: 1.5px solid var(--border-input);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font);
  font-size: 13px;
  cursor: pointer;
  transition: all .15s;
}

.docs-type-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.docs-type-btn.active {
  background: var(--accent-subtle);
  color: var(--accent-light);
  border-color: var(--accent);
}

/* Zone de dépôt fichier */
.docs-file-picker {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 20px 14px;
  border: 1.5px dashed var(--border-input);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-muted);
  font-family: var(--font);
  cursor: pointer;
  transition: border-color .15s, color .15s, background .15s;
  text-align: center;
}

.docs-file-picker:hover {
  border-color: var(--accent);
  color: var(--text-secondary);
  background: var(--accent-subtle);
}

.docs-file-picker-icon { margin-bottom: 2px; }
.docs-file-picker-label { font-size: 13px; font-weight: 500; }
.docs-file-picker-hint  { font-size: 11px; opacity: .6; }

/* Fichier sélectionné */
.docs-file-selected {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1.5px solid var(--color-success);
  border-radius: var(--radius-sm);
  background: rgba(39,174,96,.08);
}

.docs-file-selected-icon {
  color: var(--color-success);
  flex-shrink: 0;
}

.docs-file-selected-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.docs-file-selected-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  border-radius: 4px;
  flex-shrink: 0;
  transition: color .12s, background .12s;
}

.docs-file-selected-clear:hover {
  color: #ff6b6b;
  background: rgba(231,76,60,.12);
}

/* Footer modal */
.docs-modal-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* ── Search results count ── */
.docs-results-count {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  font-weight: 500;
}

/* ── View toggle ── */
.docs-view-toggle {
  display: flex;
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.docs-view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 30px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  transition: background .12s, color .12s;
}
.docs-view-btn:hover { background: var(--bg-hover); color: var(--text-secondary); }
.docs-view-btn.active { background: var(--accent-subtle); color: var(--accent-light); }
.docs-view-btn + .docs-view-btn { border-left: 1px solid var(--border-input); }

/* ── List mode ── */
.docs-grid--list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.doc-card--list {
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
}

.doc-card--list .doc-card-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  margin-bottom: 0;
  flex-shrink: 0;
}

.doc-card--list .doc-card-type-badge {
  position: static;
  flex-shrink: 0;
  order: 2;
}

.doc-card--list .doc-card-name {
  flex: 1;
  margin-bottom: 0;
  -webkit-line-clamp: 1;
  min-width: 0;
}

.doc-card--list .doc-card-meta {
  flex-direction: row;
  gap: 8px;
  margin-top: 0;
  flex-shrink: 0;
  order: 3;
}

.doc-card--list .doc-card-actions {
  position: static;
  background: none;
  opacity: 0;
  width: auto;
  gap: 4px;
  flex-shrink: 0;
  order: 4;
}

.doc-card--list:hover .doc-card-actions {
  opacity: 1;
}

.doc-card--list:hover {
  transform: none;
}

/* ── "Nouveau" badge ── */
.doc-new-badge {
  display: inline-block;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .4px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(39, 174, 96, .18);
  color: var(--color-success);
  vertical-align: middle;
  margin-left: 4px;
}

/* ── File size badge ── */
.doc-card-size {
  background: var(--bg-active);
  border-radius: 6px;
  padding: 1px 5px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .2px;
}

/* ── Empty drag-drop hint ── */
.docs-empty-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  opacity: .7;
  margin-top: 2px;
}
</style>
