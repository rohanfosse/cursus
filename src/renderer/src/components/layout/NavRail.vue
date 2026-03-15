<script setup lang="ts">
  import { computed } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { MessageSquare, BookOpen, FileText, Settings, Calendar } from '@lucide/vue-next'
  import { useAppStore }    from '@/stores/app'
  import { useModalsStore } from '@/stores/modals'
  import { useTravauxStore } from '@/stores/travaux'
  import { avatarColor }    from '@/utils/format'

  const appStore    = useAppStore()
  const modals      = useModalsStore()
  const travauxStore = useTravauxStore()
  const router      = useRouter()
  const route       = useRoute()

  const user = computed(() => appStore.currentUser)

  const avatarStyle = computed(() => {
    if (!user.value) return {}
    return user.value.type === 'teacher'
      ? { background: 'var(--accent)' }
      : { background: avatarColor(user.value.name) }
  })

  const pendingCount = computed(() => travauxStore.pendingTravaux.length)
</script>

<template>
  <nav class="nav-rail" aria-label="Navigation principale">
    <!-- Logo -->
    <div class="nav-logo">
      <div class="logo-mark" style="font-size:13px;width:32px;height:32px">CC</div>
    </div>

    <!-- Sections -->
    <button
      class="nav-btn"
      :class="{ active: route.name === 'messages' }"
      title="Messages"
      aria-label="Section Messages"
      @click="router.push('/messages')"
    >
      <MessageSquare :size="20" />
    </button>

    <button
      class="nav-btn"
      :class="{ active: route.name === 'travaux' }"
      title="Travaux"
      aria-label="Section Travaux"
      style="position:relative"
      @click="router.push('/travaux')"
    >
      <BookOpen :size="20" />
      <span
        v-if="appStore.isStudent && pendingCount > 0"
        id="nav-badge-travaux"
        class="nav-badge"
      >
        {{ pendingCount > 9 ? '9+' : pendingCount }}
      </span>
    </button>

    <button
      class="nav-btn"
      :class="{ active: route.name === 'documents' }"
      title="Documents"
      aria-label="Section Documents"
      @click="router.push('/documents')"
    >
      <FileText :size="20" />
    </button>

    <!-- Espaceur -->
    <div style="flex:1" />

    <!-- Échéancier (prof seulement) -->
    <button
      v-if="appStore.isTeacher"
      class="nav-btn"
      title="Échéancier"
      aria-label="Ouvrir l'échéancier"
      @click="modals.echeancier = true"
    >
      <Calendar :size="20" />
    </button>

    <!-- Avatar / Paramètres -->
    <button
      id="nav-user-avatar"
      class="nav-btn nav-avatar"
      :style="avatarStyle"
      :title="user?.name"
      aria-label="Paramètres du compte"
      @click="modals.settings = true"
    >
      <img v-if="user?.photo_data" :src="user.photo_data" :alt="user.name" />
      <span v-else>{{ user?.avatar_initials }}</span>
    </button>
  </nav>
</template>

<style scoped>
  .nav-avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    overflow: hidden;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    margin: 4px 0 8px;
  }

  .nav-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
