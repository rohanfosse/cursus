<script setup lang="ts">
  /**
   * DocumentsView — Bibliothèque de documents
   *
   * TODO: Implémenter l'upload drag-and-drop, la prévisualisation PDF,
   *       les catégories et la barre de recherche.
   * Référence : renderer/js/views/documents-view.js
   */
  import { ref, computed, onMounted, watch } from 'vue'
  import { FileText, Plus, Trash2, ExternalLink, Download } from '@lucide/vue-next'
  import { useAppStore }       from '@/stores/app'
  import { useDocumentsStore } from '@/stores/documents'
  import { useModalsStore }    from '@/stores/modals'
  import Modal from '@/components/ui/Modal.vue'
  import { formatDate } from '@/utils/date'

  const appStore  = useAppStore()
  const docStore  = useDocumentsStore()
  const modals    = useModalsStore()

  const promotions     = ref<{ id: number; name: string }[]>([])
  const promoFilter    = ref<number | null>(null)
  const channelFilter  = ref<number | null>(null)
  const channelsList   = ref<{ id: number; name: string }[]>([])

  onMounted(async () => {
    const res = await window.api.getPromotions()
    promotions.value = res?.ok ? res.data : []
    if (!promoFilter.value && promotions.value.length) {
      promoFilter.value = promotions.value[0].id
      await loadChannels()
    }
  })

  async function loadChannels() {
    if (!promoFilter.value) return
    const res = await window.api.getChannels(promoFilter.value)
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

  const filtered = computed(() => {
    const q = docStore.searchQuery.trim().toLowerCase()
    return docStore.documents.filter((d) => {
      if (q && !d.name.toLowerCase().includes(q)) return false
      if (docStore.activeCategory && d.category !== docStore.activeCategory) return false
      return true
    })
  })

  async function openDoc(doc: typeof docStore.documents[0]) {
    if (doc.type === 'link') {
      await window.api.openExternal(doc.content)
    } else {
      const res = await window.api.readFileBase64(doc.content)
      if (res?.ok && res.data) {
        docStore.openPreview(doc)
        modals.documentPreview = true
      }
    }
  }

  async function deleteDoc(id: number) {
    if (!confirm('Supprimer ce document ?')) return
    await docStore.deleteDocument(id)
  }
</script>

<template>
  <div id="documents-area" class="documents-area">
    <header class="documents-area-header">
      <div class="documents-area-title">
        <FileText :size="18" />
        <span id="documents-area-channel-name">Documents</span>
      </div>

      <!-- Filtres -->
      <div style="display:flex;gap:8px;align-items:center">
        <select
          v-if="promotions.length"
          v-model="promoFilter"
          class="form-select"
          style="font-size:12px;padding:4px 8px;width:auto"
        >
          <option v-for="p in promotions" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>

        <select
          v-if="channelsList.length"
          v-model="channelFilter"
          class="form-select"
          style="font-size:12px;padding:4px 8px;width:auto"
        >
          <option :value="null">Tous les canaux</option>
          <option v-for="c in channelsList" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>

        <input
          v-model="docStore.searchQuery"
          type="text"
          class="form-input"
          placeholder="Rechercher…"
          style="font-size:12px;padding:4px 8px;width:160px"
        />
      </div>

      <button
        v-if="appStore.isTeacher"
        id="btn-add-doc"
        class="btn-primary"
        style="font-size:12px"
        @click="modals.documentPreview = false; modals.newTravail = false"
      >
        <!-- TODO: ouvrir le modal d'ajout de document -->
        <!-- Référence : renderer/js/views/documents-view.js → bindDocumentsModal -->
        <Plus :size="14" /> Ajouter
      </button>
    </header>

    <div class="documents-main-content" id="documents-main-content">
      <!-- Squelette -->
      <template v-if="docStore.loading">
        <div v-for="i in 6" :key="i" class="skel-list-row" style="padding:10px 16px">
          <div class="skel skel-line skel-w70" />
        </div>
      </template>

      <!-- Documents -->
      <table v-else-if="filtered.length" class="documents-table" style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="font-size:11px;color:var(--text-muted);border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:8px 12px">Nom</th>
            <th style="text-align:left;padding:8px 12px">Catégorie</th>
            <th style="text-align:left;padding:8px 12px">Date</th>
            <th style="width:80px" />
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="doc in filtered"
            :key="doc.id"
            class="doc-row"
            style="border-bottom:1px solid var(--border);cursor:pointer"
            @click="openDoc(doc)"
          >
            <td style="padding:8px 12px">
              <FileText :size="14" style="margin-right:6px;color:var(--accent)" />
              {{ doc.name }}
            </td>
            <td style="padding:8px 12px;font-size:12px;color:var(--text-muted)">
              {{ doc.category ?? '—' }}
            </td>
            <td style="padding:8px 12px;font-size:12px;color:var(--text-muted)">
              {{ formatDate(doc.created_at) }}
            </td>
            <td style="padding:8px 12px;text-align:right">
              <button
                v-if="doc.type === 'link'"
                class="btn-icon"
                title="Ouvrir le lien"
                @click.stop="window.api.openExternal(doc.content)"
              >
                <ExternalLink :size="14" />
              </button>
              <button
                v-else
                class="btn-icon"
                title="Télécharger"
                @click.stop="window.api.downloadFile(doc.content)"
              >
                <Download :size="14" />
              </button>
              <button
                v-if="appStore.isTeacher"
                class="btn-icon"
                title="Supprimer"
                @click.stop="deleteDoc(doc.id)"
              >
                <Trash2 :size="14" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty-state">
        <p>Aucun document dans ce canal.</p>
      </div>
    </div>
  </div>
</template>
