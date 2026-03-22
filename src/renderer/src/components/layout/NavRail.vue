<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { MessageSquare, BookOpen, FileText, LayoutDashboard, Bell, Flame, Search, Shield, Bug, Radio } from 'lucide-vue-next'
  import logoUrl from '@/assets/logo.png'
  import { useAppStore }    from '@/stores/app'
  import { useModalsStore } from '@/stores/modals'
  import { useTravauxStore } from '@/stores/travaux'
  import { useLiveStore }   from '@/stores/live'
  import { avatarColor }    from '@/utils/format'
  import NotificationPanel from './NotificationPanel.vue'

  const appStore    = useAppStore()
  const modals      = useModalsStore()
  const travauxStore = useTravauxStore()
  const liveStore    = useLiveStore()
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

  function openAdmin() {
    window.open('https://admin.cursus.school', '_blank')
  }

  // ── Centre de notifications ─────────────────────────────────────────────────
  const showNotifications = ref(false)
  const showFeedback = ref(false)
  const mentionCount = computed(() =>
    Object.values(appStore.mentionChannels).reduce((a, b) => a + b, 0),
  )

  // ── Feedback ────────────────────────────────────────────────────────────────
  const feedbackTypes = [
    { id: 'bug',         label: 'Bug' },
    { id: 'improvement', label: 'Amélioration' },
    { id: 'question',    label: 'Question' },
  ]
  const feedbackType    = ref('bug')
  const feedbackTitle   = ref('')
  const feedbackDesc    = ref('')
  const feedbackSending = ref(false)
  const myFeedbacks     = ref<{ id: number; type: string; title: string; status: string; admin_reply: string | null }[]>([])

  function feedbackTypeLabel(t: string) {
    return t === 'bug' ? 'Bug' : t === 'improvement' ? 'Amélioration' : 'Question'
  }
  function feedbackStatusLabel(s: string) {
    return s === 'open' ? 'Ouvert' : s === 'in_progress' ? 'En cours' : s === 'resolved' ? 'Résolu' : 'Refusé'
  }

  async function loadMyFeedback() {
    try {
      const res = await window.api.getMyFeedback()
      if (res?.ok) myFeedbacks.value = res.data as typeof myFeedbacks.value
    } catch {}
  }

  watch(showFeedback, (open) => { if (open) loadMyFeedback() })

  async function submitFeedback() {
    if (!feedbackTitle.value.trim()) return
    feedbackSending.value = true
    try {
      const res = await window.api.submitFeedback(feedbackType.value, feedbackTitle.value.trim(), feedbackDesc.value.trim())
      if (res?.ok) {
        feedbackTitle.value = ''
        feedbackDesc.value = ''
        await loadMyFeedback()
      }
    } catch {}
    feedbackSending.value = false
  }
  const unreadCount = computed(() =>
    Object.values(appStore.unread).reduce((a, b) => a + b, 0),
  )

</script>

<template>
  <nav class="nav-rail" aria-label="Navigation principale">
    <!-- Logo - cliquable pour le prof -->
    <div class="nav-logo">
      <button
        v-if="appStore.isStaff"
        class="nav-logo-btn"
        :title="!appStore.isOnline ? 'Hors ligne' : !appStore.socketConnected ? 'Reconnexion...' : 'Tableau de bord'"
        aria-label="Accueil - Tableau de bord"
        @click="router.push('/dashboard')"
      >
        <img :src="logoUrl" class="nav-logo-img" alt="Cursus" />
        <span v-if="!appStore.isOnline || !appStore.socketConnected" class="nav-status-dot" />
      </button>
      <button
        v-else
        class="nav-logo-btn"
        :title="!appStore.isOnline ? 'Hors ligne' : !appStore.socketConnected ? 'Reconnexion...' : 'Tableau de bord'"
        aria-label="Accueil - Tableau de bord"
        @click="router.push('/dashboard')"
      >
        <img :src="logoUrl" class="nav-logo-img" alt="Cursus" />
        <span v-if="!appStore.isOnline || !appStore.socketConnected" class="nav-status-dot" />
      </button>
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

    <!-- Live indicator pour étudiants - visible uniquement quand invitation active -->
    <button
      v-if="!appStore.isStaff && liveStore.currentSession && liveStore.currentSession.status !== 'ended'"
      class="nav-btn"
      :class="{ active: route.name === 'live' }"
      title="Session Live en cours"
      aria-label="Session Live en cours"
      @click="router.push('/live')"
    >
      <Radio :size="20" />
      <span class="nav-label">Live</span>
      <span class="nav-live-dot" />
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

    <!-- ── Admin (prof uniquement) ── -->
    <button
      v-if="appStore.isTeacher"
      class="nav-btn nav-admin-btn"
      title="Console d'administration"
      aria-label="Console d'administration"
      @click="openAdmin"
    >
      <Shield :size="20" />
      <span class="nav-label">Admin</span>
    </button>

    <!-- ── Feedback / Bugs ── -->
    <button
      class="nav-btn"
      title="Signaler un bug / Suggestion"
      aria-label="Feedback"
      @click="showFeedback = true"
    >
      <Bug :size="20" />
      <span class="nav-label">Feedback</span>
    </button>

    <!-- ── Avatar / Paramètres ── -->
    <div class="nav-divider" />

    <button
      id="nav-user-avatar"
      class="nav-avatar-btn"
      :style="avatarStyle"
      :title="`${user?.name} - Paramètres`"
      aria-label="Paramètres du compte"
      @click="modals.settings = true"
    >
      <img v-if="user?.photo_data" :src="user.photo_data" :alt="user?.name" />
      <Flame v-else-if="user?.type === 'teacher'" :size="18" style="color:#fff;opacity:.95" />
      <span v-else>{{ user?.avatar_initials }}</span>
    </button>
  </nav>

  <!-- Modale Feedback -->
  <Teleport to="body">
    <Transition name="notif-panel-fade">
      <div v-if="showFeedback" class="feedback-overlay" @click.self="showFeedback = false">
        <div class="feedback-modal">
          <div class="feedback-header">
            <Bug :size="16" />
            <h3>Feedback</h3>
            <button class="feedback-close" @click="showFeedback = false">&times;</button>
          </div>

          <!-- Formulaire de soumission -->
          <div class="feedback-form">
            <div class="feedback-type-row">
              <button v-for="t in feedbackTypes" :key="t.id" class="feedback-type-btn" :class="{ active: feedbackType === t.id }" @click="feedbackType = t.id">
                {{ t.label }}
              </button>
            </div>
            <input v-model="feedbackTitle" class="feedback-input" placeholder="Titre (ex: Le bouton X ne marche pas)" maxlength="200" />
            <textarea v-model="feedbackDesc" class="feedback-textarea" placeholder="Décrivez le problème ou votre suggestion..." rows="3" maxlength="2000" />
            <button class="feedback-submit" :disabled="!feedbackTitle.trim() || feedbackSending" @click="submitFeedback">
              {{ feedbackSending ? 'Envoi...' : 'Envoyer' }}
            </button>
          </div>

          <!-- Mes feedbacks précédents -->
          <div v-if="myFeedbacks.length" class="feedback-history">
            <h4 class="feedback-history-title">Mes retours</h4>
            <div v-for="f in myFeedbacks" :key="f.id" class="feedback-item">
              <div class="feedback-item-header">
                <span class="feedback-item-type" :class="'feedback-type-' + f.type">{{ feedbackTypeLabel(f.type) }}</span>
                <span class="feedback-item-status" :class="'feedback-status-' + f.status">{{ feedbackStatusLabel(f.status) }}</span>
              </div>
              <span class="feedback-item-title">{{ f.title }}</span>
              <p v-if="f.admin_reply" class="feedback-item-reply">{{ f.admin_reply }}</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ── Live dot pulsing indicator ── */
.nav-live-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  border: 2px solid var(--bg-primary, #111214);
  animation: pulse-dot 2s infinite;
}

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

/* ── Active indicator (animated bar) ── */
.nav-btn.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  border-radius: 0 3px 3px 0;
  background: var(--accent, #4a90d9);
  animation: rail-indicator-in .2s cubic-bezier(.34,1.56,.64,1);
}
@keyframes rail-indicator-in {
  from { height: 0; opacity: 0; }
  to   { height: 20px; opacity: 1; }
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
.nav-logo {
  position: relative;
}
.nav-status-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ef4444;
  border: 2px solid var(--bg-primary, #111214);
  animation: pulse-dot 2s infinite;
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: .4; }
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

/* ── Bouton Admin ── */
.nav-admin-btn :deep(svg) {
  color: var(--accent, #4a90d9);
}

/* ── Feedback Modal ── */
.feedback-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center;
}
.feedback-modal {
  background: var(--bg-modal, #1e1f21); border-radius: 14px; padding: 20px;
  width: 440px; max-width: 92vw; max-height: 80vh; overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,.5);
}
.feedback-header {
  display: flex; align-items: center; gap: 8px; margin-bottom: 16px;
}
.feedback-header h3 { font-size: 15px; font-weight: 600; color: var(--text-primary); flex: 1; }
.feedback-close {
  background: none; border: none; color: var(--text-muted); font-size: 20px;
  cursor: pointer; padding: 0 4px; line-height: 1;
}
.feedback-type-row { display: flex; gap: 6px; margin-bottom: 10px; }
.feedback-type-btn {
  flex: 1; padding: 6px; border-radius: 8px; font-size: 12px; font-weight: 600;
  background: rgba(255,255,255,.05); color: var(--text-secondary);
  border: 1px solid rgba(255,255,255,.08); cursor: pointer; transition: all .15s;
}
.feedback-type-btn.active { background: var(--accent-subtle); color: var(--accent); border-color: var(--accent); }
.feedback-input, .feedback-textarea {
  width: 100%; background: var(--bg-input); border: 1px solid var(--border-input);
  border-radius: 8px; padding: 8px 10px; color: var(--text-primary); font-size: 13px;
  margin-bottom: 8px; font-family: inherit;
}
.feedback-textarea { resize: vertical; }
.feedback-submit {
  width: 100%; padding: 8px; border-radius: 8px; font-size: 13px; font-weight: 600;
  background: var(--accent); color: #fff; border: none; cursor: pointer;
}
.feedback-submit:disabled { opacity: .4; cursor: not-allowed; }
.feedback-history { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 12px; }
.feedback-history-title { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
.feedback-item {
  padding: 8px; background: rgba(255,255,255,.03); border-radius: 8px; margin-bottom: 6px;
}
.feedback-item-header { display: flex; gap: 6px; margin-bottom: 4px; }
.feedback-item-type, .feedback-item-status {
  font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px;
  border-radius: 4px; letter-spacing: .3px;
}
.feedback-type-bug         { background: rgba(239,68,68,.15); color: #f87171; }
.feedback-type-improvement { background: rgba(59,130,246,.15); color: #60a5fa; }
.feedback-type-question    { background: rgba(168,85,247,.15); color: #a78bfa; }
.feedback-status-open        { background: rgba(251,191,36,.15); color: #fbbf24; }
.feedback-status-in_progress { background: rgba(59,130,246,.15); color: #60a5fa; }
.feedback-status-resolved    { background: rgba(34,197,94,.15); color: #22c55e; }
.feedback-status-wontfix     { background: rgba(107,114,128,.15); color: #9ca3af; }
.feedback-item-title { font-size: 13px; color: var(--text-primary); display: block; }
.feedback-item-reply {
  font-size: 12px; color: var(--text-secondary); margin-top: 4px;
  padding: 6px 8px; background: rgba(255,255,255,.04); border-radius: 6px;
  border-left: 2px solid var(--accent);
}
</style>
