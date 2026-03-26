<script setup lang="ts">
  import { computed, watch, ref, nextTick, onMounted, onUnmounted } from 'vue'
  import { Search, X as XIcon, ClipboardList, BookCheck, FileText, FolderPlus, X as Close, CalendarRange, Users, FolderOpen, Menu, MessageSquare, Paperclip, Image as ImageIcon, ExternalLink } from 'lucide-vue-next'
  import { useAppStore }      from '@/stores/app'
  import { useMessagesStore } from '@/stores/messages'
  import { useTravauxStore }  from '@/stores/travaux'
  import { useModalsStore }   from '@/stores/modals'
  import { useToast }         from '@/composables/useToast'
  import { useApi }           from '@/composables/useApi'
  import { injectMd }         from '@/composables/useMsgAttachment'
  import MessageList         from '@/components/chat/MessageList.vue'
  import MessageInput        from '@/components/chat/MessageInput.vue'
  import PinnedBanner        from '@/components/chat/PinnedBanner.vue'
  import ChannelMembersPanel from '@/components/panels/ChannelMembersPanel.vue'
  import ChannelDocsPanel      from '@/components/panels/ChannelDocsPanel.vue'
  import ChannelTravauxPanel   from '@/components/panels/ChannelTravauxPanel.vue'
  import { deadlineClass } from '@/utils/date'
  import { authUrl, getAuthToken } from '@/utils/auth'

  const props = defineProps<{ toggleSidebar?: () => void }>()

  const appStore      = useAppStore()
  const messagesStore = useMessagesStore()
  const travauxStore  = useTravauxStore()
  const modals        = useModalsStore()
  const { showToast } = useToast()
  const { api }       = useApi()

  const searchInput      = ref('')
  const bannerDismissed  = ref(false)
  const rightPanel       = ref<'members' | 'docs' | 'travaux' | 'dm-files' | null>(null)

  // ── Indicateur en ligne du peer DM ─────────────────────────────────────
  const peerIsOnline = computed(() => {
    if (!appStore.activeDmStudentId) return false
    const peerName = appStore.activeChannelName
    if (!peerName) return false
    return (appStore.onlineUsers ?? []).some((u: { name: string }) => u.name === peerName)
  })

  // ── Fichiers partagés en DM ──────────────────────────────────────────────
  interface DmFile { message_id: number; student_id: number; student_name: string; file_name: string; file_url: string; is_image: boolean; sent_at: string }
  const dmFiles        = ref<DmFile[]>([])
  const dmFilesLoading = ref(false)
  const dmFileFilter   = ref<'all' | 'images' | 'docs'>('all')
  const filteredDmFiles = computed(() => {
    if (dmFileFilter.value === 'all') return dmFiles.value
    if (dmFileFilter.value === 'images') return dmFiles.value.filter(f => f.is_image)
    return dmFiles.value.filter(f => !f.is_image)
  })

  async function loadDmFiles() {
    if (!appStore.activeDmStudentId) return
    dmFilesLoading.value = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await api<DmFile[]>(() => window.api.getDmFiles() as any)
    const sid = appStore.activeDmStudentId
    dmFiles.value = (res ?? []).filter(f => f.student_id === sid)
    dmFilesLoading.value = false
  }

  function dmInitials(name: string) {
    return name.split(' ').map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('')
  }
  function dmAvatarColor(name: string) {
    const colors = ['#4a90d9','#9b87f5','#2ecc71','#e67e22','#e91e8c','#00bcd4']
    let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
    return colors[h % colors.length]
  }

  // ── Rafraîchir les DMs en temps réel ────────────────────────────────────
  function onDmLive(msg?: unknown) {
    if (msg && typeof msg === 'object' && 'id' in msg) {
      messagesStore.upsertMessage(msg as import('@/types').Message)
    } else {
      messagesStore.fetchMessages()
    }
  }
  onMounted(() => appStore.onDmRefresh(onDmLive))
  onUnmounted(() => appStore.offDmRefresh(onDmLive))

  function togglePanel(panel: 'members' | 'docs' | 'travaux' | 'dm-files') {
    rightPanel.value = rightPanel.value === panel ? null : panel
  }

  // Fermer le panel quand on change de canal/DM
  watch(() => appStore.activeChannelId, () => { rightPanel.value = null })
  watch(() => appStore.activeDmStudentId, (id) => {
    rightPanel.value = null
    if (id) loadDmFiles()
  })

  // Escape ferme le panneau lateral ou la recherche
  function onEscapeKey(e: KeyboardEvent) {
    if (e.key !== 'Escape') return
    if (rightPanel.value) { rightPanel.value = null; return }
    if (messagesStore.searchTerm) {
      searchInput.value = ''
      messagesStore.clearSearch()
      messagesStore.fetchMessages()
    }
  }
  onMounted(() => document.addEventListener('keydown', onEscapeKey))
  onUnmounted(() => document.removeEventListener('keydown', onEscapeKey))

  // ── Drag & drop ──────────────────────────────────────────────────────────
  const isDragOver    = ref(false)
  const dmUploading   = ref(false)
  const pendingDoc    = ref<{ name: string; path: string } | null>(null)
  const docAddName    = ref('')
  const docAddCat     = ref('')
  const docAdding     = ref(false)
  let   dragCounter   = 0

  function onDragEnter(e: DragEvent) {
    if (!appStore.activeChannelId && !appStore.activeDmStudentId) return
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

  async function onDrop(e: DragEvent) {
    e.preventDefault()
    dragCounter = 0
    isDragOver.value = false
    const file = e.dataTransfer?.files[0]
    if (!file) return

    // ── Mode canal : ajouter aux documents ─────────────────────────────────
    if (appStore.activeChannelId) {
      const path = (file as unknown as { path?: string }).path
      if (!path) return
      pendingDoc.value = { name: file.name, path }
      docAddName.value = file.name
      docAddCat.value  = ''
      return
    }

    // ── Mode DM : upload → injecter dans le champ de saisie ────────────────
    if (!appStore.activeDmStudentId) return
    dmUploading.value = true
    try {
      let url: string | null = null
      let fileSize = 0
      const electronPath = (file as unknown as { path?: string }).path
      if (electronPath) {
        // Electron : upload via preload
        const res = await window.api.uploadFile(electronPath) as { ok: boolean; data?: { url: string; file_size?: number } } | null
        if (res?.ok && res.data) { url = res.data.url; fileSize = res.data.file_size || 0 }
      } else {
        // Web : upload direct FormData
        const formData = new FormData()
        formData.append('file', file, file.name)
        const token = getAuthToken()
        const resp = await fetch('/api/files/upload', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        })
        const json = await resp.json() as { ok: boolean; data?: string; file_size?: number }
        if (json.ok && json.data) { url = window.location.origin + json.data; fileSize = json.file_size || 0 }
      }
      if (!url) { showToast('Échec de l\'upload.', 'error'); return }
      const sizedUrl = fileSize ? `${url}#size=${fileSize}` : url
      const isImage = /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(file.name)
      injectMd(isImage ? `![${file.name}](${sizedUrl})` : `[📎 ${file.name}](${sizedUrl})`)
      // Rafraîchir la liste des fichiers DM si le panel est ouvert
      if (rightPanel.value === 'dm-files') loadDmFiles()
    } catch { showToast('Erreur lors de l\'upload.', 'error') }
    finally { dmUploading.value = false }
  }

  async function confirmDocAdd() {
    if (!pendingDoc.value || !appStore.activeChannelId) return
    docAdding.value = true
    try {
      const result = await api(
        () => window.api.addChannelDocument({
          channelId:  appStore.activeChannelId,
          type:       'file',
          name:       docAddName.value.trim() || pendingDoc.value!.name,
          pathOrUrl:  pendingDoc.value!.path,
          category:   docAddCat.value.trim() || 'Général',
          description: null,
        }),
        'upload',
      )
      if (result !== null) {
        showToast(`"${docAddName.value || pendingDoc.value.name}" ajouté aux documents.`, 'success')
        pendingDoc.value = null
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
      searchInput.value    = ''
      bannerDismissed.value = false
      await messagesStore.fetchMessages()
      if (chId) {
        await messagesStore.fetchPinned(chId as number)
        if (appStore.isStudent) await travauxStore.fetchStudentDevoirs()
      }
    },
    { immediate: true },
  )

  // ── Scroll vers message surligné (depuis CmdPalette ou PinnedBanner) ─────
  async function scrollToMessage(id: number) {
    await nextTick()
    const el = document.querySelector<HTMLElement>(`[data-msg-id="${id}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('msg-highlight')
      setTimeout(() => { el.classList.remove('msg-highlight') }, 2200)
    }
  }

  watch(() => messagesStore.highlightMessageId, async (id) => {
    if (!id) return
    await scrollToMessage(id)
    messagesStore.highlightMessageId = null
  })

  function onPinnedJump(id: number) { scrollToMessage(id) }

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
        <button v-if="props.toggleSidebar" class="mobile-hamburger" aria-label="Ouvrir le menu" @click="props.toggleSidebar">
          <Menu :size="22" />
        </button>

        <!-- Icône DM -->
        <span v-if="appStore.activeDmStudentId" class="dm-header-icon">
          <MessageSquare :size="20" />
        </span>
        <!-- Icône canal classique -->
        <span v-else id="channel-icon" class="channel-icon">#</span>

        <div class="channel-header-info">
          <div class="channel-header-title-row">
            <span id="channel-name" class="channel-name">{{ appStore.activeChannelName }}</span>
            <span
              v-if="channelHeader?.type === 'annonce'"
              id="channel-type-badge"
              class="channel-type-badge channel-type-badge--annonce"
            >
              Annonce
            </span>
            <span
              v-else-if="channelHeader?.type === 'chat'"
              class="channel-type-badge channel-type-badge--chat"
            >
              Chat
            </span>
          </div>
          <span v-if="appStore.activeDmStudentId" class="dm-status">
            <span v-if="messagesStore.typingText" class="dm-typing">{{ messagesStore.typingText }}</span>
            <span v-else-if="peerIsOnline" class="dm-online"><span class="dm-online-dot" /> En ligne</span>
            <span v-else class="dm-offline">Hors ligne</span>
          </span>
          <span v-else-if="channelHeader?.type === 'annonce' && appStore.isStudent" class="channel-annonce-hint">Canal d'annonce - seuls les pilotes peuvent publier</span>
          <span v-else-if="appStore.activeChannelDescription" class="channel-description" :title="appStore.activeChannelDescription">{{ appStore.activeChannelDescription }}</span>
        </div>
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

        <!-- Timeline (prof, canal uniquement) -->
        <button
          v-if="appStore.isTeacher && !appStore.activeDmStudentId"
          id="btn-timeline"
          class="btn-icon"
          title="Échéancier"
          :class="{ active: rightPanel === 'travaux' }"
          aria-label="Travaux du canal"
          @click="togglePanel('travaux')"
        >
          <CalendarRange :size="16" />
        </button>

        <!-- Membres du canal (canal uniquement) -->
        <button
          v-if="!appStore.activeDmStudentId"
          id="btn-members"
          class="btn-icon header-panel-btn"
          :class="{ active: rightPanel === 'members' }"
          title="Membres du canal"
          aria-label="Afficher les membres"
          @click="togglePanel('members')"
        >
          <Users :size="16" />
        </button>

        <!-- Documents du canal (canal uniquement) -->
        <button
          v-if="!appStore.activeDmStudentId"
          id="btn-docs"
          class="btn-icon header-panel-btn"
          :class="{ active: rightPanel === 'docs' }"
          title="Documents du canal"
          aria-label="Afficher les documents"
          @click="togglePanel('docs')"
        >
          <FolderOpen :size="16" />
        </button>

        <!-- Fichiers partagés (DM uniquement) -->
        <button
          v-if="appStore.activeDmStudentId"
          id="btn-dm-files"
          class="btn-icon header-panel-btn"
          :class="{ active: rightPanel === 'dm-files' }"
          title="Fichiers partagés"
          aria-label="Fichiers partagés dans cette conversation"
          @click="togglePanel('dm-files')"
        >
          <Paperclip :size="16" />
        </button>
      </div>
    </header>

    <!-- Messages épinglés -->
    <PinnedBanner v-if="appStore.activeChannelId" @jump-to="onPinnedJump" />

    <!-- Bannière travaux en attente (étudiant) -->
    <Transition name="banner-slide">
      <div
        v-if="pendingForChannel.length && !bannerDismissed"
        class="channel-pending-banner"
        :class="{ 'channel-pending-urgent': bannerUrgent }"
      >
        <BookCheck :size="14" class="icon-inline banner-icon" />
        <span class="banner-text">
          <strong>{{ pendingForChannel.length }} devoir{{ pendingForChannel.length > 1 ? 's' : '' }}</strong>
          à rendre dans ce canal<template v-if="bannerUrgent"> - <span class="banner-urgent">urgent !</span></template>
        </span>
        <button class="btn-primary btn-xs" @click="$router.push('/devoirs')">
          Voir mes devoirs
        </button>
        <button class="btn-icon banner-close-btn" aria-label="Fermer" @click="bannerDismissed = true">
          <XIcon :size="13" />
        </button>
      </div>
    </Transition>

    <!-- Corps principal : messages + panels latéraux -->
    <div v-if="appStore.activeChannelId || appStore.activeDmStudentId" class="channel-body">
      <!-- Liste des messages + zone de saisie -->
      <div class="messages-container" id="messages-container">
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

      <!-- Panels latéraux (slide depuis la droite) -->
      <Transition name="panel-slide">
        <ChannelMembersPanel
          v-if="rightPanel === 'members' && appStore.activeChannelId"
          @close="rightPanel = null"
        />
      </Transition>
      <Transition name="panel-slide">
        <ChannelDocsPanel
          v-if="rightPanel === 'docs' && appStore.activeChannelId"
          @close="rightPanel = null"
        />
      </Transition>
      <Transition name="panel-slide">
        <ChannelTravauxPanel
          v-if="rightPanel === 'travaux' && appStore.activeChannelId"
          @close="rightPanel = null"
        />
      </Transition>

      <!-- Panel fichiers partagés DM -->
      <Transition name="panel-slide">
        <div v-if="rightPanel === 'dm-files' && appStore.activeDmStudentId" class="dm-files-panel">
          <div class="dm-files-panel-header">
            <span class="dm-files-panel-title"><Paperclip :size="14" /> Fichiers partagés</span>
            <button class="btn-icon" aria-label="Fermer" @click="rightPanel = null"><XIcon :size="14" /></button>
          </div>
          <div class="dm-files-filters">
            <button :class="{ active: dmFileFilter === 'all' }" @click="dmFileFilter = 'all'">Tout</button>
            <button :class="{ active: dmFileFilter === 'images' }" @click="dmFileFilter = 'images'">Images</button>
            <button :class="{ active: dmFileFilter === 'docs' }" @click="dmFileFilter = 'docs'">Documents</button>
          </div>
          <div v-if="dmFilesLoading" class="dm-files-empty">Chargement…</div>
          <div v-else-if="!filteredDmFiles.length" class="dm-files-empty">Aucun fichier {{ dmFileFilter === 'all' ? 'partagé dans cette conversation' : dmFileFilter === 'images' ? 'image' : 'document' }}.</div>
          <div v-else class="dm-files-list">
            <a
              v-for="f in filteredDmFiles"
              :key="f.message_id + f.file_url"
              class="dm-file-item"
              :href="authUrl(f.file_url)"
              target="_blank"
              rel="noopener"
            >
              <div class="dm-file-thumb">
                <img v-if="f.is_image" :src="authUrl(f.file_url)" :alt="f.file_name" class="dm-file-img" />
                <ImageIcon v-else-if="f.is_image" :size="18" />
                <Paperclip v-else :size="18" />
              </div>
              <div class="dm-file-meta">
                <span class="dm-file-name">{{ f.file_name }}</span>
                <span class="dm-file-date">{{ new Date(f.sent_at).toLocaleDateString('fr') }}</span>
              </div>
              <ExternalLink :size="12" class="dm-file-ext" />
            </a>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Aucun canal sélectionné - écran d'accueil -->
    <div v-else class="no-channel-hint" id="no-channel-hint">
      <div class="welcome-icon-wrapper">
        <MessageSquare :size="32" class="welcome-icon" />
      </div>
      <h3 class="welcome-heading">
        Bienvenue{{ appStore.currentUser ? ', ' + appStore.currentUser.name.split(' ')[0] : '' }} !
      </h3>
      <p class="welcome-sub">
        Sélectionnez un salon dans la barre latérale pour commencer à échanger.
      </p>
      <div v-if="appStore.isStudent" class="welcome-tips">
        <div class="welcome-tip">
          <MessageSquare :size="16" class="welcome-tip-icon" />
          <span><strong>Salons</strong> - Échangez avec votre promo dans les salons à gauche</span>
        </div>
        <div class="welcome-tip">
          <ClipboardList :size="16" class="welcome-tip-icon" />
          <span><strong>Devoirs</strong> - Consultez et rendez vos travaux dans l'onglet Devoirs</span>
        </div>
        <div class="welcome-tip">
          <Users :size="16" class="welcome-tip-icon" />
          <span><strong>Messages directs</strong> - Cliquez sur un nom dans le chat pour lui écrire en privé</span>
        </div>
        <div class="welcome-tip">
          <FileText :size="16" class="welcome-tip-icon" />
          <span><strong>Recherche</strong> - Utilisez <kbd style="font-size:10px;padding:1px 4px;border-radius:3px;background:var(--bg-active);border:1px solid var(--border)">Ctrl+K</kbd> pour rechercher partout</span>
        </div>
      </div>
    </div>

    <!-- Overlay drag & drop -->
    <Transition name="drop-fade">
      <div v-if="isDragOver && (appStore.activeChannelId || appStore.activeDmStudentId)" class="drop-overlay">
        <div class="drop-overlay-inner">
          <template v-if="appStore.activeDmStudentId">
            <Paperclip :size="40" class="drop-overlay-icon" />
            <p class="drop-overlay-title">Envoyer dans la conversation</p>
            <p class="drop-overlay-sub">{{ appStore.activeChannelName }}</p>
          </template>
          <template v-else>
            <FolderPlus :size="40" class="drop-overlay-icon" />
            <p class="drop-overlay-title">Déposer pour ajouter aux documents</p>
            <p class="drop-overlay-sub">#{{ appStore.activeChannelName }}</p>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
/* Animation surbrillance message depuis la recherche (non-scoped pour toucher MessageBubble) */
@keyframes msg-flash {
  0%, 10%  { background: rgba(74, 144, 217, .28); border-radius: 6px; }
  100%      { background: transparent; }
}
.msg-highlight { animation: msg-flash 2s ease forwards !important; }
</style>

<style scoped>
/* ── #main-area doit être position:relative pour l'overlay ── */
#main-area { position: relative; display: flex; flex-direction: column; min-height: 0; }

/* ── Corps canal (messages + panels) ── */
.channel-body {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}
.channel-body .messages-container {
  flex: 1;
  min-width: 0;
}

/* ── Icône DM dans le header ── */
.dm-header-icon {
  display: flex; align-items: center; justify-content: center;
  color: var(--accent-light);
  flex-shrink: 0;
}

/* ── DM status indicator ── */
.dm-status { font-size: 12px; font-weight: 500; }
.dm-online { display: inline-flex; align-items: center; gap: 5px; color: #4ade80; }
.dm-online-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #4ade80;
  box-shadow: 0 0 4px rgba(74, 222, 128, .4); display: inline-block;
}
.dm-typing { color: var(--accent); font-style: italic; }
.dm-offline { color: var(--text-muted); }

/* ── Channel type badges ── */
.channel-type-badge--annonce { background: rgba(231,76,60,.15); color: #e74c3c; }
.channel-type-badge--chat    { background: rgba(74,144,217,.15); color: var(--accent); }
.channel-type-badge--dm      { background: rgba(155,135,245,.12); color: var(--color-cctl); font-size: 10px; }
.channel-annonce-hint {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}

/* ── Boutons header avec état actif ── */
.header-panel-btn.active {
  color: var(--accent) !important;
  background: var(--accent-subtle);
  border-radius: 6px;
}

/* ── Transition panel latéral ── */
.panel-slide-enter-active,
.panel-slide-leave-active { transition: width .2s ease, opacity .15s ease; overflow: hidden; }
.panel-slide-enter-from,
.panel-slide-leave-to     { width: 0 !important; opacity: 0; min-width: 0 !important; }

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

/* ── Transition bannière ── */
.banner-slide-enter-active { transition: all .2s ease; }
.banner-slide-leave-active { transition: all .18s ease; }
.banner-slide-enter-from, .banner-slide-leave-to { opacity: 0; transform: translateY(-6px); max-height: 0; }

/* ── Amélioration bannière ── */
.banner-icon { flex-shrink: 0; }
.banner-text { flex: 1; min-width: 0; }
.banner-urgent { color: var(--color-warning, #c8a85a); font-weight: 600; }
.banner-close-btn {
  padding: 3px;
  flex-shrink: 0;
  opacity: .6;
  transition: opacity var(--t-fast);
}
.banner-close-btn:hover { opacity: 1; }

/* ── Panel fichiers partagés DM ── */
.dm-files-panel {
  width: 260px; min-width: 260px; max-width: 260px;
  border-left: 1px solid var(--border);
  display: flex; flex-direction: column;
  background: var(--bg-secondary);
  overflow: hidden;
}
.dm-files-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--border);
  font-size: 12px; font-weight: 600; color: var(--text-primary);
  flex-shrink: 0;
}
.dm-files-panel-title { display: flex; align-items: center; gap: 6px; }
.dm-files-filters { display: flex; gap: 4px; padding: 8px 12px; flex-shrink: 0; }
.dm-files-filters button {
  padding: 4px 12px; border-radius: 100px; border: 1px solid var(--border);
  background: transparent; font-size: 11px; font-weight: 600; cursor: pointer;
  color: var(--text-muted); font-family: inherit; transition: all .15s;
}
.dm-files-filters button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.dm-files-filters button:hover:not(.active) { border-color: var(--text-muted); }
.dm-files-empty { padding: 24px 16px; font-size: 12.5px; color: var(--text-muted); text-align: center; }
.dm-files-list { flex: 1; overflow-y: auto; padding: 6px 0; }
.dm-file-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 12px;
  text-decoration: none;
  color: var(--text-primary);
  transition: background .12s;
  cursor: pointer;
}
.dm-file-item:hover { background: var(--bg-hover); }
.dm-file-item:hover .dm-file-ext { opacity: .7; }
.dm-file-thumb {
  width: 36px; height: 36px; border-radius: 6px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden; color: var(--text-muted);
}
.dm-file-img { width: 100%; height: 100%; object-fit: cover; }
.dm-file-meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dm-file-name { font-size: 12.5px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.dm-file-date { font-size: 11px; color: var(--text-muted); }
.dm-file-ext { color: var(--text-muted); opacity: 0; transition: opacity .12s; flex-shrink: 0; }

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
.doc-drop-input:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }
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
