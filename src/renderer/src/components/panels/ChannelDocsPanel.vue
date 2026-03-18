<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  import {
    X, FolderOpen, FileText, Link2, ExternalLink, Trash2,
    FolderPlus, RefreshCw, ChevronDown,
  } from 'lucide-vue-next'
  import { useAppStore } from '@/stores/app'
  import { useToast }    from '@/composables/useToast'

  const emit = defineEmits<{ (e: 'close'): void }>()

  const appStore      = useAppStore()
  const { showToast } = useToast()

  interface ChannelDoc {
    id: number
    channel_id: number
    type: 'file' | 'link'
    name: string
    path_or_url: string
    category: string | null
    description: string | null
    created_at: string
  }

  const docs    = ref<ChannelDoc[]>([])
  const loading = ref(true)
  const collapsed = ref<Set<string>>(new Set())

  const docsByCategory = computed(() => {
    const map = new Map<string, ChannelDoc[]>()
    for (const d of docs.value) {
      const cat = d.category?.trim() || 'Général'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(d)
    }
    // Sort: Général last
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'Général') return 1
      if (b === 'Général') return -1
      return a.localeCompare(b)
    })
  })

  async function load() {
    if (!appStore.activeChannelId) return
    loading.value = true
    try {
      const res = await window.api.getChannelDocuments(appStore.activeChannelId)
      if (res) docs.value = res as ChannelDoc[]
    } finally {
      loading.value = false
    }
  }

  async function openDoc(doc: ChannelDoc) {
    if (doc.type === 'link') {
      await window.api.openExternal(doc.path_or_url)
    } else {
      await window.api.openPath(doc.path_or_url)
    }
  }

  async function deleteDoc(doc: ChannelDoc) {
    await window.api.deleteChannelDocument(doc.id)
    docs.value = docs.value.filter(d => d.id !== doc.id)
    showToast(`"${doc.name}" supprimé.`, 'success')
  }

  function toggleCategory(cat: string) {
    if (collapsed.value.has(cat)) collapsed.value.delete(cat)
    else collapsed.value.add(cat)
    collapsed.value = new Set(collapsed.value) // trigger reactivity
  }

  watch(() => appStore.activeChannelId, load)
  onMounted(load)
</script>

<template>
  <aside class="dp-panel">
    <!-- Header -->
    <div class="dp-header">
      <FolderOpen :size="15" class="dp-hicon" />
      <span class="dp-title">Documents</span>
      <button class="btn-icon dp-refresh" title="Actualiser" @click="load">
        <RefreshCw :size="13" />
      </button>
      <button class="btn-icon dp-close" @click="emit('close')"><X :size="15" /></button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="dp-body dp-loading">
      <div v-for="i in 4" :key="i" class="skel dp-skel" />
    </div>

    <!-- Empty -->
    <div v-else-if="!docs.length" class="dp-empty">
      <FolderOpen :size="32" style="opacity:.2" />
      <p>Aucun document dans ce canal.</p>
      <p class="dp-empty-hint">Glissez-déposez un fichier dans le chat pour en ajouter un.</p>
    </div>

    <!-- Doc list -->
    <div v-else class="dp-body">
      <div v-for="[cat, catDocs] in docsByCategory" :key="cat" class="dp-category">

        <!-- Category header -->
        <button class="dp-cat-header" @click="toggleCategory(cat)">
          <ChevronDown
            :size="13"
            class="dp-chevron"
            :class="{ rotated: collapsed.has(cat) }"
          />
          <span class="dp-cat-name">{{ cat }}</span>
          <span class="dp-cat-count">{{ catDocs.length }}</span>
        </button>

        <!-- Doc rows -->
        <ul v-if="!collapsed.has(cat)" class="dp-doc-list">
          <li v-for="doc in catDocs" :key="doc.id" class="dp-doc-row">
            <div class="dp-doc-icon" :class="doc.type === 'link' ? 'icon-link' : 'icon-file'">
              <Link2 v-if="doc.type === 'link'" :size="13" />
              <FileText v-else :size="13" />
            </div>
            <div class="dp-doc-info">
              <span class="dp-doc-name" :title="doc.name">{{ doc.name }}</span>
              <span v-if="doc.description" class="dp-doc-desc">{{ doc.description }}</span>
            </div>
            <div class="dp-doc-actions">
              <button class="btn-icon dp-open-btn" title="Ouvrir" @click="openDoc(doc)">
                <ExternalLink :size="12" />
              </button>
              <button
                v-if="appStore.isTeacher"
                class="btn-icon dp-del-btn"
                title="Supprimer"
                @click="deleteDoc(doc)"
              >
                <Trash2 :size="12" />
              </button>
            </div>
          </li>
        </ul>

      </div>
    </div>
  </aside>
</template>

<style scoped>
.dp-panel {
  width: 260px;
  min-width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border);
  background: var(--bg-sidebar);
  overflow: hidden;
}

/* ── Header ── */
.dp-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  height: var(--header-height, 52px);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.dp-hicon  { color: var(--accent); flex-shrink: 0; }
.dp-title  { flex: 1; font-size: 13px; font-weight: 700; color: var(--text-primary); }
.dp-refresh { color: var(--text-muted); }
.dp-refresh:hover { color: var(--accent); }
.dp-close  { color: var(--text-muted); }
.dp-close:hover { color: var(--text-primary); }

/* ── Body ── */
.dp-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0 20px;
}
.dp-loading { display: flex; flex-direction: column; gap: 8px; padding: 14px; }
.dp-skel    { height: 38px; border-radius: 7px; }

/* ── Empty ── */
.dp-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
.dp-empty-hint { font-size: 11px; color: var(--text-muted); opacity: .7; }

/* ── Category ── */
.dp-cat-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 8px 12px 5px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: var(--font);
  text-align: left;
}
.dp-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform .18s ease;
}
.dp-chevron.rotated { transform: rotate(-90deg); }
.dp-cat-name {
  flex: 1;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--text-muted);
}
.dp-cat-count {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  background: rgba(255,255,255,.06);
  border-radius: 8px;
  padding: 1px 6px;
}

/* ── Doc list ── */
.dp-doc-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0 6px 4px;
}

.dp-doc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background .1s;
}
.dp-doc-row:hover { background: rgba(255,255,255,.05); }

.dp-doc-icon {
  width: 28px;
  height: 28px;
  min-width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  flex-shrink: 0;
}
.icon-file { background: rgba(74,144,217,.12); color: var(--accent); }
.icon-link { background: rgba(39,174,96,.1);   color: var(--color-success); }

.dp-doc-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.dp-doc-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dp-doc-desc {
  font-size: 10.5px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dp-doc-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity .1s;
}
.dp-doc-row:hover .dp-doc-actions { opacity: 1; }

.dp-open-btn { color: var(--text-muted); padding: 3px; }
.dp-open-btn:hover { color: var(--accent) !important; }
.dp-del-btn  { color: var(--text-muted); padding: 3px; }
.dp-del-btn:hover { color: var(--color-danger) !important; }
</style>
