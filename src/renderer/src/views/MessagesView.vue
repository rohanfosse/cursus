<script setup lang="ts">
  import { computed, watch, ref } from 'vue'
  import { Search, X as XIcon, ClipboardList, BookOpen, FileText, FolderPlus, X as Close } from 'lucide-vue-next'
  import { useAppStore }      from '@/stores/app'
  import { useMessagesStore } from '@/stores/messages'
  import { useTravauxStore }  from '@/stores/travaux'
  import { useModalsStore }   from '@/stores/modals'
  import { useToast }         from '@/composables/useToast'
  import MessageList  from '@/components/chat/MessageList.vue'
  import MessageInput from '@/components/chat/MessageInput.vue'
  import PinnedBanner from '@/components/chat/PinnedBanner.vue'
  import { deadlineClass } from '@/utils/date'

  const appStore      = useAppStore()
  const messagesStore = useMessagesStore()
  const travauxStore  = useTravauxStore()
  const modals        = useModalsStore()
  const { showToast } = useToast()

  const searchInput = ref('')

  // ── Drag & drop → Documents ───────────────────────────────────────────────
  const isDragOver    = ref(false)
  const pendingDoc    = ref<{ name: string; path: string } | null>(null)
  const docAddName    = ref('')
  const docAddCat     = ref('')
  const docAdding     = ref(false)
  let   dragCounter   = 0

  function onDragEnter(e: DragEvent) {
    if (!appStore.activeChannelId) return
    if (!e.dataTransfer?.types.includes('Files')) return
    dragCounter++
    isDragOver.value = true
  }

  function onDragLeave() {
    dragCounter--
    if (dragCounter <= 0) { dragCounter = 0; isDragOver.value = false }
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    dragCounter = 0
    isDragOver.value = false
    if (!appStore.activeChannelId) return
    const file = e.dataTransfer?.files[0]
    if (!file) return
    const path = (file as unknown as { path: string }).path
    if (!path) return
    pendingDoc.value = { name: file.name, path }
    docAddName.value = file.name
    docAddCat.value  = ''
  }

  async function confirmDocAdd() {
    if (!pendingDoc.value || !appStore.activeChannelId) return
    docAdding.value = true
    try {
      const res = await window.api.addChannelDocument({
        channelId:  appStore.activeChannelId,
        type:       'file',
        name:       docAddName.value.trim() || pendingDoc.value.name,
        pathOrUrl:  pendingDoc.value.path,
        category:   docAddCat.value.trim() || 'Général',
        description: null,
      })
      if (res?.ok) {
        showToast(`"${docAddName.value || pendingDoc.value.name}" ajouté aux documents.`, 'success')
        pendingDoc.value = null
      } else {
        showToast('Erreur lors de l\'ajout du document.', 'error')
      }
    } finally {
      docAdding.value = false
    }
  }

  function cancelDocAdd() {
    pendingDoc.value = null
  }

  // ── Chargement quand le canal change ─────────────────────────────────────
  watch(
    () => [appStore.activeChannelId, appStore.activeDmStudentId],
    async ([chId]) => {
      messagesStore.clearSearch()
      searchInput.value = ''
      await messagesStore.fetchMessages()
      if (chId) {
        await messagesStore.fetchPinned(chId as number)
        if (appStore.isStudent) await travauxStore.fetchStudentDevoirs()
      }
    },
  )

  // ── Recherche ─────────────────────────────────────────────────────────────
  async function doSearch() {
    messagesStore.searchTerm = searchInput.value
    await messagesStore.fetchMessages()
  }

  function clearSearch() {
    searchInput.value = ''
    messagesStore.clearSearch()
    messagesStore.fetchMessages()
  }

  // ── Bannière travaux en attente ───────────────────────────────────────────
  const pendingForChannel = computed(() => {
    if (!appStore.isStudent || !appStore.activeChannelId) return []
    return travauxStore.pendingDevoirs.filter(
      (t) => t.channel_id === appStore.activeChannelId,
    )
  })

  const bannerUrgent = computed(() =>
    pendingForChannel.value.some((t) =>
      ['deadline-passed', 'deadline-critical'].includes(deadlineClass(t.deadline)),
    ),
  )

  const channelHeader = computed(() => {
    if (appStore.activeDmStudentId) return null
    return {
      name: appStore.activeChannelName,
      type: appStore.activeChannelType,
    }
  })
</script>

<template>
  <div
    id="main-area"
    class="main-area"
    @dragenter="onDragEnter"
    @dragleave="onDragLeave"
    @dragover="onDragOver"
    @drop="onDrop"
  >
    <!-- En-tête du canal -->
    <header v-if="appStore.activeChannelId || appStore.activeDmStudentId" id="channel-header" class="channel-header">
      <div class="channel-header-left">
        <span id="channel-icon">{{ appStore.activeDmStudentId ? '@' : '#' }}</span>
        <span id="channel-name" class="channel-name">{{ appStore.activeChannelName }}</span>
        <span
          v-if="channelHeader?.type === 'annonce'"
          id="channel-type-badge"
          class="channel-type-badge"
        >
          Annonce
        </span>
      </div>

      <!-- Barre de recherche -->
      <div id="header-actions" class="header-actions">
        <div id="search-wrapper" class="search-wrapper" :class="{ active: messagesStore.searchTerm }">
          <input
            id="search-input"
            v-model="searchInput"
            type="text"
            class="search-input"
            placeholder="Rechercher…"
            @keydown.enter="doSearch"
          />
          <span id="search-results-count" class="search-results-count">
            {{ messagesStore.searchTerm ? `${messagesStore.messages.length} résultat${messagesStore.messages.length > 1 ? 's' : ''}` : '' }}
          </span>
          <button v-if="messagesStore.searchTerm" id="btn-search-clear" class="btn-icon" aria-label="Effacer la recherche" @click="clearSearch">
            <XIcon :size="14" />
          </button>
          <button id="btn-search" class="btn-icon" aria-label="Lancer la recherche" @click="doSearch">
            <Search :size="16" />
          </button>
        </div>

        <!-- Timeline (prof) -->
        <button
          v-if="appStore.isTeacher"
          id="btn-timeline"
          class="btn-icon"
          title="Timeline"
          aria-label="Ouvrir la timeline"
          @click="modals.timeline = true"
        >
          <BookOpen :size="16" />
        </button>
      </div>
    </header>

    <!-- Messages épinglés -->
    <PinnedBanner v-if="appStore.activeChannelId" />

    <!-- Bannière travaux en attente (étudiant) -->
    <div
      v-if="pendingForChannel.length"
      class="channel-pending-banner"
      :class="{ 'channel-pending-urgent': bannerUrgent }"
    >
      <span>
        <ClipboardList :size="14" class="icon-inline" />
        {{ pendingForChannel.length }} devoir{{ pendingForChannel.length > 1 ? 's' : '' }}
        à rendre dans ce canal{{ bannerUrgent ? ' — ' : '' }}
        <strong v-if="bannerUrgent">urgent !</strong>
      </span>
      <button class="btn-primary btn-xs" @click="$router.push('/devoirs')">
        Voir mes devoirs
      </button>
    </div>

    <!-- Liste des messages + zone de saisie -->
    <div v-if="appStore.activeChannelId || appStore.activeDmStudentId" class="messages-container" id="messages-container">
      <MessageList />

      <!-- Barre de confirmation drag & drop -->
      <div v-if="pendingDoc" class="doc-drop-confirm">
        <FileText :size="18" class="doc-drop-icon" />
        <div class="doc-drop-fields">
          <input
            v-model="docAddName"
            type="text"
            class="doc-drop-input"
            placeholder="Nom du document"
            @keydown.enter="confirmDocAdd"
            @keydown.escape="cancelDocAdd"
          />
          <input
            v-model="docAddCat"
            type="text"
            class="doc-drop-input doc-drop-cat"
            placeholder="Catégorie (optionnel)"
            @keydown.enter="confirmDocAdd"
            @keydown.escape="cancelDocAdd"
          />
        </div>
        <span class="doc-drop-channel">→ #{{ appStore.activeChannelName }}</span>
        <button class="btn-primary doc-drop-btn" :disabled="docAdding" @click="confirmDocAdd">
          <FolderPlus :size="13" /> Ajouter
        </button>
        <button class="btn-ghost doc-drop-cancel" :disabled="docAdding" @click="cancelDocAdd">
          <Close :size="13" />
        </button>
      </div>

      <MessageInput />
    </div>

    <!-- Aucun canal sélectionné -->
    <div v-else class="no-channel-hint" id="no-channel-hint">
      <p>Sélectionnez un canal dans la barre latérale pour commencer.</p>
    </div>

    <!-- Overlay drag & drop -->
    <Transition name="drop-fade">
      <div v-if="isDragOver && appStore.activeChannelId" class="drop-overlay">
        <div class="drop-overlay-inner">
          <FolderPlus :size="40" class="drop-overlay-icon" />
          <p class="drop-overlay-title">Déposer pour ajouter aux documents</p>
          <p class="drop-overlay-sub">#{{ appStore.activeChannelName }}</p>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ── #main-area doit être position:relative pour l'overlay ── */
#main-area { position: relative; }

/* ── Overlay drag ── */
.drop-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  background: rgba(74, 144, 217, 0.12);
  backdrop-filter: blur(2px);
  border: 3px dashed var(--accent);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.drop-overlay-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  padding: 32px;
  background: var(--bg-modal);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-input);
}

.drop-overlay-icon    { color: var(--accent); }
.drop-overlay-title   { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.drop-overlay-sub     { font-size: 13px; color: var(--accent); font-weight: 600; }

/* Transition */
.drop-fade-enter-active,
.drop-fade-leave-active { transition: opacity .15s ease; }
.drop-fade-enter-from,
.drop-fade-leave-to     { opacity: 0; }

/* ── Barre de confirmation ── */
.doc-drop-confirm {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-input);
  border-top: 1px solid var(--accent);
  flex-shrink: 0;
}

.doc-drop-icon { color: var(--accent); flex-shrink: 0; }

.doc-drop-fields {
  display: flex;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.doc-drop-input {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  background: var(--bg-main);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 12.5px;
  font-family: var(--font);
  outline: none;
  transition: border-color var(--t-fast);
}
.doc-drop-input:focus { border-color: var(--accent); }
.doc-drop-cat { max-width: 160px; }

.doc-drop-channel {
  font-size: 12px;
  color: var(--accent);
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

.doc-drop-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  padding: 5px 10px;
  flex-shrink: 0;
}

.doc-drop-cancel {
  padding: 5px 7px;
  flex-shrink: 0;
}
</style>
