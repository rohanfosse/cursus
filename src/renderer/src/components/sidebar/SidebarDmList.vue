<script setup lang="ts">
  // Section Messages Directs de la sidebar
  import { ChevronDown, Plus, UserPlus } from 'lucide-vue-next'
  import Avatar from '@/components/ui/Avatar.vue'
  import EmptyState from '@/components/ui/EmptyState.vue'
  import { useAppStore } from '@/stores/app'
  import { avatarColor } from '@/utils/format'
  import type { Student } from '@/types'

  defineProps<{
    dmCollapsed: boolean
    dmContactsToShow: Student[]
    dmStudents: Student[]
    showAllDmStudents: boolean
    showNewDmSearch: boolean
    newDmQuery: string
    newDmFilteredStudents: Student[]
    getDmPreview: (name: string) => string | undefined
  }>()

  const emit = defineEmits<{
    'update:dmCollapsed': [v: boolean]
    'update:showAllDmStudents': [v: boolean]
    'update:newDmQuery': [v: string]
    toggleNewDmSearch: []
    selectDm: [s: Student]
    openDmContextMenu: [e: MouseEvent, s: Student]
    startNewDm: [s: Student]
  }>()

  const appStore = useAppStore()
</script>

<template>
  <div class="sidebar-separator" />
  <div
    class="sidebar-section-header sidebar-collapsible-header"
    role="button"
    tabindex="0"
    :aria-expanded="!dmCollapsed"
    aria-controls="sidebar-dm-list"
    @click="emit('update:dmCollapsed', !dmCollapsed)"
    @keydown.enter="emit('update:dmCollapsed', !dmCollapsed)"
    @keydown.space.prevent="emit('update:dmCollapsed', !dmCollapsed)"
  >
    <ChevronDown :size="12" class="sidebar-category-chevron" :class="{ rotated: dmCollapsed }" />
    <span>Messages directs</span>
    <button
      v-if="appStore.isStaff"
      class="dm-toggle-btn dm-toggle-btn--visible"
      :title="showAllDmStudents ? 'Masquer' : 'Nouvelle conversation'"
      :aria-label="showAllDmStudents ? 'Masquer' : 'Nouvelle conversation'"
      @click.stop="emit('update:showAllDmStudents', !showAllDmStudents)"
    ><Plus :size="13" /></button>
    <button
      v-if="appStore.isStudent"
      class="dm-toggle-btn dm-toggle-btn--visible"
      :title="showNewDmSearch ? 'Fermer' : 'Nouveau message'"
      :aria-label="showNewDmSearch ? 'Fermer' : 'Nouveau message'"
      @click.stop="emit('toggleNewDmSearch')"
    ><Plus :size="13" /></button>
  </div>

  <!-- Recherche nouveau DM (etudiant) -->
  <div v-if="showNewDmSearch && appStore.isStudent" class="dm-search">
    <input
      :value="newDmQuery"
      class="dm-search-input"
      placeholder="Rechercher un camarade..."
      aria-label="Rechercher un camarade"
      @input="emit('update:newDmQuery', ($event.target as HTMLInputElement).value)"
    />
    <button
      v-for="s in newDmFilteredStudents"
      :key="'search-' + s.id"
      class="sidebar-item dm-search-result"
      @click="emit('startNewDm', s)"
    >
      <Avatar
        :initials="s.avatar_initials ?? s.name.slice(0, 2).toUpperCase()"
        :color="avatarColor(s.name)"
        :photo-data="s.photo_data"
        :size="20"
      />
      <span class="dm-name">{{ s.name }}</span>
    </button>
    <EmptyState v-if="newDmQuery.trim() && !newDmFilteredStudents.length" title="Aucun resultat" compact />
  </div>

  <!-- Conversations -->
  <div v-show="!dmCollapsed" id="sidebar-dm-list" class="sidebar-scroll-list">
    <nav aria-label="Messages directs">
      <button
        v-for="s in dmContactsToShow"
        :key="s.id"
        class="sidebar-item dm-item"
        :class="{
          active: appStore.activeDmStudentId === s.id || appStore.activeDmPeerId === s.id,
          'dm-has-unread': !!appStore.unreadDms[s.name],
        }"
        @click="emit('selectDm', s)"
        @contextmenu.prevent="emit('openDmContextMenu', $event, s)"
      >
        <span class="dm-avatar-wrap">
          <Avatar
            :initials="s.avatar_initials ?? s.name.slice(0, 2).toUpperCase()"
            :color="s.id < 0 ? 'var(--accent)' : avatarColor(s.name)"
            :photo-data="s.photo_data"
            :size="20"
          />
          <span v-if="appStore.isUserOnline(s.name)" class="presence-dot presence-online" title="En ligne" role="img" aria-label="En ligne" />
        </span>
        <span class="dm-name">
          {{ s.name }}
          <span v-if="appStore.isDmMuted(s.name)" class="dm-muted-icon" title="Notifications desactivees">&#x1F507;</span>
        </span>
        <span v-if="appStore.unreadDms[s.name]" class="dm-unread-badge">
          {{ (appStore.unreadDms[s.name] as number) > 9 ? '9+' : appStore.unreadDms[s.name] }}
        </span>
      </button>
      <EmptyState v-if="!dmContactsToShow.length && !showAllDmStudents" title="Aucune conversation" compact />
    </nav>

    <template v-if="showAllDmStudents">
      <div class="dm-all-header">Tous les etudiants</div>
      <nav aria-label="Tous les etudiants">
        <button
          v-for="s in dmStudents"
          :key="'all-' + s.id"
          class="sidebar-item dm-item"
          :class="{ active: appStore.activeDmStudentId === s.id }"
          @click="emit('selectDm', s); emit('update:showAllDmStudents', false)"
        >
          <Avatar
            :initials="s.avatar_initials ?? s.name.slice(0, 2).toUpperCase()"
            :color="avatarColor(s.name)"
            :photo-data="s.photo_data"
            :size="20"
          />
          <span class="dm-name">{{ s.name }}</span>
        </button>
      </nav>
    </template>
  </div>
</template>
