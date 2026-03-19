<script setup lang="ts">
  import { computed, ref } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { MessageSquare, BookOpen, FileText, LayoutDashboard, UserPlus, Bell, Flame, Search } from 'lucide-vue-next'
  import logoUrl from '@/assets/logo.svg'
  import { useAppStore }    from '@/stores/app'
  import { useModalsStore } from '@/stores/modals'
  import { useTravauxStore } from '@/stores/travaux'
  import { avatarColor }    from '@/utils/format'
  import NotificationPanel from './NotificationPanel.vue'

  const appStore    = useAppStore()
  const modals      = useModalsStore()
  const travauxStore = useTravauxStore()
  const router      = useRouter()
  const route       = useRoute()

  const user = computed(() => appStore.currentUser)

  const avatarStyle = computed(() => {
    if (!user.value) return {}
    if (user.value.type === 'teacher') return { background: 'var(--accent)' }
    if (user.value.type === 'ta')      return { background: '#7B5EA7' }
    return { background: avatarColor(user.value.name) }
  })

  const pendingCount = computed(() => travauxStore.pendingDevoirs.length)

  // ── Centre de notifications ─────────────────────────────────────────────────
  const showNotifications = ref(false)
  const mentionCount = computed(() =>
    Object.values(appStore.mentionChannels).reduce((a, b) => a + b, 0),
  )
  const unreadCount = computed(() =>
    Object.values(appStore.unread).reduce((a, b) => a + b, 0),
  )

</script>

<template>
  <nav class="nav-rail" aria-label="Navigation principale">
    <!-- Logo — cliquable pour le prof -->
    <div class="nav-logo">
      <button
        v-if="appStore.isStaff"
        class="nav-logo-btn"
        title="Tableau de bord"
        aria-label="Accueil — Tableau de bord"
        @click="router.push('/dashboard')"
      >
        <img :src="logoUrl" class="nav-logo-img" alt="Cursus" />
      </button>
      <img v-else :src="logoUrl" class="nav-logo-img" alt="Cursus" />
    </div>

    <!-- ── Tableau de bord ── -->
    <button
      class="nav-btn"
      :class="{ active: route.name === 'dashboard' }"
      title="Tableau de bord"
      aria-label="Tableau de bord"
      @click="router.push('/dashboard')"
    >
      <LayoutDashboard :size="20" />
      <span class="nav-label">Accueil</span>
    </button>

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

    <!-- ── Cloche de notifications ── -->
    <div class="nav-notif-wrapper">
      <button
        class="nav-btn"
        :class="{ active: showNotifications }"
        title="Notifications"
        aria-label="Centre de notifications"
        @click="showNotifications = !showNotifications"
      >
        <Bell :size="20" />
        <span class="nav-label">Notifs</span>
        <span
          v-if="mentionCount > 0"
          class="nav-badge nav-badge-mention"
        >
          {{ mentionCount > 9 ? '9+' : mentionCount }}
        </span>
        <span
          v-else-if="unreadCount > 0"
          class="nav-badge nav-badge-unread"
        >
          {{ unreadCount > 9 ? '9+' : unreadCount }}
        </span>
      </button>
      <Transition name="notif-panel-fade">
        <NotificationPanel
          v-if="showNotifications"
          @close="showNotifications = false"
        />
      </Transition>
    </div>

    <!-- Recherche rapide (Ctrl+K) -->
    <button
      class="nav-btn nav-search-hint"
      title="Recherche rapide (Ctrl+K)"
      aria-label="Recherche rapide"
      @click="modals.cmdPalette = true"
    >
      <Search :size="18" />
      <kbd class="nav-kbd">⌘K</kbd>
    </button>

    <!-- Espaceur -->
    <div style="flex:1" />

    <!-- ── Outils professeur / TA ── -->
    <template v-if="appStore.isStaff">
      <div class="nav-divider" />

      <button
        class="nav-btn"
        title="Importer des étudiants (CSV)"
        aria-label="Importer des étudiants"
        @click="modals.importStudents = true"
      >
        <UserPlus :size="20" />
        <span class="nav-label">Importer</span>
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
      <Flame v-else-if="user?.type === 'teacher'" :size="18" style="color:#fff;opacity:.95" />
      <span v-else>{{ user?.avatar_initials }}</span>
    </button>
  </nav>
</template>

<style scoped>
/* ── Bouton recherche rapide ── */
.nav-search-hint {
  position: relative;
}
.nav-kbd {
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 10px;
  font-family: var(--font);
  font-weight: 600;
  color: var(--text-muted);
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 3px;
  padding: 0 3px;
  line-height: 14px;
  pointer-events: none;
}

/* ── Wrapper notifications (positioning du panel) ── */
.nav-notif-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Variantes de badge */
.nav-badge-mention {
  background: var(--color-danger, #e74c3c);
}
.nav-badge-unread {
  background: var(--accent, #4a90d9);
}

/* Transition panneau */
.notif-panel-fade-enter-active { transition: opacity .12s ease, transform .12s ease; }
.notif-panel-fade-leave-active { transition: opacity .09s ease, transform .09s ease; }
.notif-panel-fade-enter-from,
.notif-panel-fade-leave-to     { opacity: 0; transform: translateX(-6px); }

/* ── Logo ── */
.nav-logo-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  border-radius: 8px;
}
.nav-logo-img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 1px 3px rgba(0,0,0,.3));
  transition: transform .15s;
}
.nav-logo-img:hover {
  transform: scale(1.07);
}

/* Avatar carré arrondi en bas du rail (même style que les avatars dans le chat) */
.nav-avatar-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  overflow: hidden;
  border: none;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -.3px;
  color: #fff;
  margin: 4px 0 6px;
  cursor: pointer;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
  outline-offset: 2px;
  transition: box-shadow .15s, border-radius .15s;
  position: relative;
}

.nav-avatar-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 8px;
  background: rgba(255,255,255,0);
  transition: background .15s;
}

.nav-avatar-btn:hover::after {
  background: rgba(255,255,255,.15);
}

.nav-avatar-btn:hover {
  box-shadow: 0 0 0 2px rgba(255,255,255,.25);
  border-radius: 10px;
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
