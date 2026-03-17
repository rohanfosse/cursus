<script setup lang="ts">
  import { computed } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { MessageSquare, BookOpen, FileText, Calendar, UserCheck, Settings } from 'lucide-vue-next'
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

  const pendingCount = computed(() => travauxStore.pendingDevoirs.length)
</script>

<template>
  <nav class="nav-rail" aria-label="Navigation principale">
    <!-- Logo -->
    <div class="nav-logo">
      <div class="logo-mark" style="font-size:10px;letter-spacing:-0.5px">CeS</div>
    </div>

    <!-- ── Navigation principale ── -->
    <button
      class="nav-btn"
      :class="{ active: route.name === 'messages' }"
      title="Messages"
      aria-label="Section Messages"
      @click="router.push('/messages')"
    >
      <MessageSquare :size="20" />
      <span class="nav-label">Messages</span>
    </button>

    <button
      class="nav-btn"
      :class="{ active: route.name === 'devoirs' }"
      title="Devoirs"
      aria-label="Section Devoirs"
      @click="router.push('/devoirs')"
    >
      <BookOpen :size="20" />
      <span class="nav-label">Devoirs</span>
      <span
        v-if="appStore.isStudent && pendingCount > 0"
        id="nav-badge-devoirs"
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
      <span class="nav-label">Documents</span>
    </button>

    <!-- Espaceur -->
    <div style="flex:1" />

    <!-- ── Outils professeur ── -->
    <template v-if="appStore.isTeacher">
      <div class="nav-divider" />

      <button
        class="nav-btn"
        title="Simuler la vue d'un étudiant"
        aria-label="Simuler la vue d'un étudiant"
        @click="modals.impersonate = true"
      >
        <UserCheck :size="20" />
        <span class="nav-label">Simuler</span>
      </button>

      <button
        class="nav-btn"
        title="Échéancier"
        aria-label="Ouvrir l'échéancier"
        @click="modals.echeancier = true"
      >
        <Calendar :size="20" />
        <span class="nav-label">Agenda</span>
      </button>
    </template>

    <!-- ── Avatar / Paramètres ── -->
    <div class="nav-divider" />

    <button
      id="nav-user-avatar"
      class="nav-avatar-btn"
      :style="avatarStyle"
      :title="`${user?.name} — Paramètres`"
      aria-label="Paramètres du compte"
      @click="modals.settings = true"
    >
      <img v-if="user?.photo_data" :src="user.photo_data" :alt="user?.name" />
      <span v-else>{{ user?.avatar_initials }}</span>
    </button>
  </nav>
</template>

<style scoped>
/* Avatar circulaire en bas du rail */
.nav-avatar-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  margin: 4px 0 6px;
  cursor: pointer;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
  outline-offset: 2px;
  transition: box-shadow .15s, transform .15s;
  position: relative;
}

.nav-avatar-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(255,255,255,0);
  transition: background .15s;
}

.nav-avatar-btn:hover::after {
  background: rgba(255,255,255,.15);
}

.nav-avatar-btn:hover {
  box-shadow: 0 0 0 2px rgba(255,255,255,.25);
}

.nav-avatar-btn:focus-visible {
  outline: 2px solid var(--accent);
}

.nav-avatar-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
