<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue'
  import {
    FileText, Image, Link2, Video, File, Plus, Trash2,
    ExternalLink, Download, Search, X, Upload, FolderOpen, Eye,
  } from 'lucide-vue-next'
  import { useAppStore }       from '@/stores/app'
  import { useDocumentsStore } from '@/stores/documents'
  import { useModalsStore }    from '@/stores/modals'
  import { useToast }          from '@/composables/useToast'
  import Modal     from '@/components/ui/Modal.vue'
  import { formatDate } from '@/utils/date'
  import type { AppDocument } from '@/types'

  const api      = window.api
  const appStore = useAppStore()
  const docStore = useDocumentsStore()
  const modals   = useModalsStore()
  const { showToast } = useToast()

  const promotions    = ref<{ id: number; name: string }[]>([])
  const promoFilter   = ref<number | null>(null)
  const channelFilter = ref<number | null>(null)
  const channelsList  = ref<{ id: number; name: string }[]>([])

  // ── Add modal ────────────────────────────────────────────────────────────
  const showAddModal  = ref(false)
  const addName       = ref('')
  const addCategory   = ref('')
  const addType       = ref<'file' | 'link'>('file')
  const addLink       = ref('')
  const addFile       = ref<string | null>(null)
  const addFileName   = ref<string | null>(null)
  const addChannelId  = ref<number | null>(null)
  const adding        = ref(false)

  onMounted(async () => {
    const res = await api.getPromotions()
    promotions.value = res?.ok ? res.data : []
    if (!promoFilter.value && promotions.value.length) {
      promoFilter.value = promotions.value[0].id
      await loadChannels()
    }
  })

  async function loadChannels() {
    if (!promoFilter.value) return
    const res = await api.getChannels(promoFilter.value)
    channelsList.value = res?.ok ? res.data : []
    await loadDocuments()
  }

  async function loadDocuments() {
    if (channelFilter.value) {
      await docStore.fetchDocuments(channelFilter.value)
    } else if (promoFilter.value) {
      await docStore.fetchDocuments(undefined, promoFilter.value)
    }
  }

  watch(promoFilter, loadChannels)
  watch(channelFilter, loadDocuments)

  watch(() => appStore.activeChannelId, (chId) => {
    if (chId !== null) channelFilter.value = chId
  })

  // ── Filtrage + catégories ────────────────────────────────────────────────
  const filtered = computed(() => {
    const q = docStore.searchQuery.trim().toLowerCase()
    return docStore.documents.filter((d) => {
      if (q && !d.name.toLowerCase().includes(q) && !(d.description ?? '').toLowerCase().includes(q)) return false
      if (docStore.activeCategory && d.category !== docStore.activeCategory) return false
      return true
    })
  })

  const categories = computed(() => {
    const cats = new Set(docStore.documents.map((d) => d.category ?? 'Général'))
    return Array.from(cats).sort()
  })

  const byCategory = computed(() => {
    const map = new Map<string, AppDocument[]>()
    for (const doc of filtered.value) {
      const cat = doc.category ?? 'Général'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(doc)
    }
    return map
  })

  const activeChannelName = computed(() =>
    channelFilter.value
      ? (channelsList.value.find((c) => c.id === channelFilter.value)?.name ?? null)
      : null,
  )

  // ── Icônes & couleurs selon le type ─────────────────────────────────────
  type DocIconType = 'image' | 'pdf' | 'video' | 'link' | 'file'

  function docIconType(doc: AppDocument): DocIconType {
    if (doc.type === 'link') return 'link'
    const ext = doc.content?.split('.').pop()?.toLowerCase() ?? ''
    if (['jpg','jpeg','png','gif','svg','webp','bmp'].includes(ext)) return 'image'
    if (ext === 'pdf') return 'pdf'
    if (['mp4','mov','avi','mkv','webm'].includes(ext)) return 'video'
    return 'file'
  }

  const iconColors: Record<DocIconType, string> = {
    pdf:   '#E74C3C',
    image: '#3498DB',
    video: '#9B59B6',
    link:  '#27AE60',
    file:  '#4A90D9',
  }

  const iconLabels: Record<DocIconType, string> = {
    pdf:   'PDF',
    image: 'Image',
    video: 'Vidéo',
    link:  'Lien',
    file:  'Fichier',
  }

  // ── Actions ─────────────────────────────────────────────────────────────
  async function openDoc(doc: AppDocument) {
    if (doc.type === 'link') {
      await api.openExternal(doc.content)
    } else {
      docStore.openPreview(doc)
      modals.documentPreview = true
    }
  }

  async function deleteDoc(id: number) {
    if (!confirm('Supprimer ce document ?')) return
    await docStore.deleteDocument(id)
  }

  // ── Ajout ────────────────────────────────────────────────────────────────
  function openAddModal() {
    addName.value      = ''
    addCategory.value  = ''
    addType.value      = 'file'
    addLink.value      = ''
    addFile.value      = null
    addFileName.value  = null
    addChannelId.value = channelFilter.value ?? (channelsList.value[0]?.id ?? null)
    showAddModal.value = true
  }

  async function pickFile() {
    const res = await api.openFileDialog()
    if (res?.ok && res.data) {
      addFile.value     = res.data
      addFileName.value = res.data.split(/[\\/]/).pop() ?? res.data
      if (!addName.value) addName.value = addFileName.value ?? ''
    }
  }

  async function submitAdd() {
    if (!addName.value.trim() || !addChannelId.value) return
    if (addType.value === 'file' && !addFile.value) return
    if (addType.value === 'link' && !addLink.value.trim()) return
    adding.value = true
    try {
      const ok = await docStore.addDocument({
        channelId:   addChannelId.value,
        name:        addName.value.trim(),
        type:        addType.value,
        path_or_url: addType.value === 'link' ? addLink.value.trim() : addFile.value,
        category:    addCategory.value.trim() || null,
        description: null,
      })
      if (ok) {
        showToast('Document ajouté.', 'success')
        showAddModal.value = false
        channelFilter.value = addChannelId.value
        await loadDocuments()
      } else {
        showToast('Erreur lors de l\'ajout.')
      }
    } finally {
      adding.value = false
    }
  }
</script>

<template>
  <div id="documents-area" class="docs-layout">

    <!-- ── Header ─────────────────────────────────────────────────────── -->
    <header class="docs-header">
      <div class="docs-header-left">
        <FolderOpen :size="18" class="docs-header-icon" />
        <div class="docs-header-title-block">
          <h1 class="docs-header-title">Documents</h1>
          <span v-if="activeChannelName" class="docs-header-channel">
            #{{ activeChannelName }}
          </span>
        </div>
      </div>

      <div class="docs-header-actions">
        <!-- Filtre promo (prof) -->
        <select
          v-if="appStore.isTeacher && promotions.length > 1"
          v-model="promoFilter"
          class="form-select docs-select"
        >
          <option v-for="p in promotions" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>

        <!-- Filtre canal -->
        <select
          v-if="channelsList.length"
          v-model="channelFilter"
          class="form-select docs-select"
        >
          <option :value="null">Tous les canaux</option>
          <option v-for="c in channelsList" :key="c.id" :value="c.id">#{{ c.name }}</option>
        </select>

        <!-- Recherche -->
        <div class="docs-search">
          <Search :size="14" class="docs-search-icon" />
          <input
            v-model="docStore.searchQuery"
            type="text"
            class="docs-search-input"
            placeholder="Rechercher un document…"
          />
          <button v-if="docStore.searchQuery" class="docs-search-clear" @click="docStore.searchQuery = ''">
            <X :size="12" />
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
          <!-- En-tête de groupe (seulement s'il y a plusieurs catégories) -->
          <div v-if="byCategory.size > 1" class="docs-group-header">
            <span class="docs-group-label">{{ cat }}</span>
            <span class="docs-group-count">{{ docs.length }} fichier{{ docs.length > 1 ? 's' : '' }}</span>
          </div>

          <!-- Grille de cartes -->
          <div class="docs-grid">
            <div
              v-for="doc in docs"
              :key="doc.id"
              class="doc-card"
              :title="doc.description ?? doc.name"
              @click="openDoc(doc)"
            >
              <!-- Icône de type -->
              <div class="doc-card-icon" :style="{ background: iconColors[docIconType(doc)] + '1A', color: iconColors[docIconType(doc)] }">
                <Image  v-if="docIconType(doc) === 'image'" :size="28" />
                <Video  v-else-if="docIconType(doc) === 'video'" :size="28" />
                <Link2  v-else-if="docIconType(doc) === 'link'" :size="28" />
                <FileText v-else-if="docIconType(doc) === 'pdf'" :size="28" />
                <File   v-else :size="28" />
              </div>

              <!-- Badge de type -->
              <span class="doc-card-type-badge" :style="{ background: iconColors[docIconType(doc)] + '22', color: iconColors[docIconType(doc)] }">
                {{ iconLabels[docIconType(doc)] }}
              </span>

              <!-- Nom -->
              <p class="doc-card-name">{{ doc.name }}</p>

              <!-- Canal + date -->
              <p class="doc-card-meta">
                <span v-if="!channelFilter && doc.channel_name">#{{ doc.channel_name }}</span>
                <span>{{ formatDate(doc.created_at) }}</span>
              </p>

              <!-- Actions au survol -->
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
          {{ docStore.searchQuery ? 'Aucun résultat pour cette recherche.' : 'Ce canal ne contient pas encore de document.' }}
        </p>
        <button v-if="appStore.isTeacher && !docStore.searchQuery" class="btn-primary" @click="openAddModal">
          <Plus :size="14" /> Ajouter un document
        </button>
      </div>

    </div>

    <!-- ── Modal ajout ─────────────────────────────────────────────────── -->
    <Modal v-model="showAddModal" title="Ajouter un document">
      <div class="docs-add-form">

        <!-- Quel canal ? -->
        <div class="form-group">
          <label class="form-label">Canal</label>
          <select v-model="addChannelId" class="form-select" required>
            <option :value="null" disabled>Choisir un canal…</option>
            <option v-for="c in channelsList" :key="c.id" :value="c.id">#{{ c.name }}</option>
          </select>
        </div>

        <!-- Nom -->
        <div class="form-group">
          <label class="form-label">Nom</label>
          <input v-model="addName" type="text" class="form-input" placeholder="ex : Cours réseaux — chapitre 3" autofocus />
        </div>

        <!-- Catégorie -->
        <div class="form-group">
          <label class="form-label">
            Catégorie <span style="opacity:.55;font-weight:400">(optionnelle)</span>
          </label>
          <input v-model="addCategory" type="text" class="form-input" placeholder="ex : Cours, TP, Exercices…" />
        </div>

        <!-- Type : fichier ou lien -->
        <div class="form-group">
          <label class="form-label">Type</label>
          <div class="docs-type-toggle">
            <button
              class="docs-type-btn"
              :class="{ active: addType === 'file' }"
              type="button"
              @click="addType = 'file'"
            >
              <Upload :size="14" /> Fichier
            </button>
            <button
              class="docs-type-btn"
              :class="{ active: addType === 'link' }"
              type="button"
              @click="addType = 'link'"
            >
              <Link2 :size="14" /> Lien URL
            </button>
          </div>
        </div>

        <!-- Sélection fichier -->
        <div v-if="addType === 'file'" class="form-group">
          <button class="docs-file-picker" type="button" @click="pickFile">
            <File :size="16" />
            <span>{{ addFileName ?? 'Cliquer pour choisir un fichier…' }}</span>
          </button>
        </div>

        <!-- URL -->
        <div v-else class="form-group">
          <label class="form-label">URL</label>
          <input v-model="addLink" type="url" class="form-input" placeholder="https://…" />
        </div>

      </div>

      <div class="modal-footer" style="padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
        <button class="btn-ghost" @click="showAddModal = false">Annuler</button>
        <button
          class="btn-primary"
          :disabled="!addName.trim() || !addChannelId || (addType === 'file' && !addFile) || (addType === 'link' && !addLink.trim()) || adding"
          @click="submitAdd"
        >
          {{ adding ? 'Ajout…' : 'Ajouter' }}
        </button>
      </div>
    </Modal>

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

.docs-header-icon { color: #27AE60; flex-shrink: 0; }

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
  flex-wrap: wrap;
}

.docs-select {
  font-size: 12px;
  padding: 5px 10px;
  height: 32px;
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
  background: rgba(255,255,255,.06);
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
  border-color: rgba(255,255,255,.2);
}

.docs-cat-pill.active {
  background: var(--accent-subtle);
  color: var(--accent-light);
  border-color: var(--accent);
}

.docs-cat-count {
  background: rgba(255,255,255,.1);
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
  border-color: rgba(255,255,255,.18);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.doc-card--skel {
  cursor: default;
  min-height: 140px;
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
  background: rgba(255,255,255,.12);
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .12s;
}

.doc-card-action-btn:hover { background: rgba(255,255,255,.2); }
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

.docs-empty-icon { color: var(--text-muted); opacity: .4; }
.docs-empty-title { font-size: 16px; font-weight: 600; color: var(--text-secondary); }
.docs-empty-sub   { font-size: 13px; color: var(--text-muted); }

/* ── Form ajout ── */
.docs-add-form {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

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

.docs-file-picker {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1.5px dashed var(--border-input);
  border-radius: var(--radius-sm);
  background: rgba(255,255,255,.03);
  color: var(--text-muted);
  font-family: var(--font);
  font-size: 13px;
  cursor: pointer;
  transition: border-color .15s, color .15s, background .15s;
}

.docs-file-picker:hover {
  border-color: var(--accent);
  color: var(--text-secondary);
  background: var(--accent-subtle);
}
</style>
