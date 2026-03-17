<script setup lang="ts">
  import { computed, watch, ref } from 'vue'
  import { Search, X as XIcon, ClipboardList, BookOpen } from 'lucide-vue-next'
  import { useAppStore }      from '@/stores/app'
  import { useMessagesStore } from '@/stores/messages'
  import { useTravauxStore }  from '@/stores/travaux'
  import { useModalsStore }   from '@/stores/modals'
  import MessageList  from '@/components/chat/MessageList.vue'
  import MessageInput from '@/components/chat/MessageInput.vue'
  import PinnedBanner from '@/components/chat/PinnedBanner.vue'
  import { deadlineClass } from '@/utils/date'

  const appStore      = useAppStore()
  const messagesStore = useMessagesStore()
  const travauxStore  = useTravauxStore()
  const modals        = useModalsStore()

  const searchInput = ref('')

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
  <div id="main-area" class="main-area">
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
      <MessageInput />
    </div>

    <!-- Aucun canal sélectionné -->
    <div v-else class="no-channel-hint" id="no-channel-hint">
      <p>Sélectionnez un canal dans la barre latérale pour commencer.</p>
    </div>
  </div>
</template>
