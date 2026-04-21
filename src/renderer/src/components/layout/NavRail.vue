<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { MessageSquare, BookOpen, FileText, LayoutDashboard, Bell, Flame, Search, Shield, Bug, Zap, Paperclip, Lightbulb, Calendar, Gamepad2, PanelLeftClose, PanelLeftOpen, EyeOff, Eye, ArrowUp, ArrowDown, RotateCcw, Bookmark, Smile, Trash2 } from 'lucide-vue-next'
  import UserStatusPicker from '@/components/modals/UserStatusPicker.vue'
  import { useStatusesStore } from '@/stores/statuses'
  import ContextMenu from '@/components/ui/ContextMenu.vue'
  import type { ContextMenuQuickEmoji } from '@/components/ui/ContextMenu.vue'
  import { useContextMenu, type ContextMenuItem } from '@/composables/useContextMenu'
  import logoUrl from '@/assets/logo.png'
  import { useAppStore }    from '@/stores/app'
  import { useModalsStore } from '@/stores/modals'
  import { useTravauxStore } from '@/stores/travaux'
  import { useLiveStore }   from '@/stores/live'
  import { useToast }       from '@/composables/useToast'
  import { useModules }     from '@/composables/useModules'
  import { useNavRailOrder } from '@/composables/useNavRailOrder'
  import { avatarColor }    from '@/utils/format'
  import { formatExpiryShort } from '@/utils/date'
  import { getAuthToken }   from '@/utils/auth'
  import NotificationPanel from './NotificationPanel.vue'

  const appStore    = useAppStore()
  const modals      = useModalsStore()
  const travauxStore = useTravauxStore()
  const liveStore    = useLiveStore()
  const statusesStore = useStatusesStore()
  const showStatusPicker = ref(false)
  const { showToast } = useToast()
  const { isEnabled } = useModules()
  const router      = useRouter()
  const route       = useRoute()

  defineProps<{ sidebarCollapsed?: boolean }>()
  const emit = defineEmits<{ 'toggle-sidebar': [] }>()

  const user = computed(() => appStore.currentUser)

  const avatarStyle = computed(() => {
    if (!user.value) return {}
    if (user.value.type === 'admin' || user.value.type === 'teacher') return { background: 'var(--accent)' }
    if (user.value.type === 'ta')      return { background: '#7B5EA7' }
    return { background: avatarColor(user.value.name) }
  })

  const pendingCount = computed(() => travauxStore.urgentPendingCount)
  const devoirProgress = computed(() => {
    const total = travauxStore.devoirs.length
    if (!total) return 0
    const done = travauxStore.devoirs.filter(t => t.depot_id != null).length
    return Math.round((done / total) * 100)
  })

  function openAdmin() {
    const token = getAuthToken()
    const url = token
      ? `https://admin.cursus.school/?token=${encodeURIComponent(token)}`
      : 'https://admin.cursus.school/'
    window.open(url, '_blank')
  }

  // ── Centre de notifications ─────────────────────────────────────────────────
  const showNotifications = ref(false)
  const showFeedback = ref(false)
  const mentionCount = computed(() =>
    Object.values(appStore.mentionChannels).reduce((a, b) => a + b, 0),
  )

  const msgBadgeCount = computed(() => {
    const dmCount = Object.values(appStore.unreadDms ?? {}).reduce((a: number, b) => a + (b as number), 0)
    return dmCount + mentionCount.value
  })

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
    } catch {
      console.warn('[NavRail] Erreur chargement feedback')
    }
  }

  watch(showFeedback, (open) => { if (open) loadMyFeedback() })

  async function submitFeedback() {
    if (!feedbackTitle.value.trim()) return
    feedbackSending.value = true
    try {
      const res = await window.api.submitFeedback(feedbackType.value, feedbackTitle.value.trim(), feedbackDesc.value.trim())
      if (res?.ok) {
        showToast('Merci pour votre retour !', 'success')
        feedbackTitle.value = ''
        feedbackDesc.value = ''
        await loadMyFeedback()
      } else {
        showToast('Erreur lors de l\'envoi.', 'error')
      }
    } catch {
      showToast('Erreur lors de l\'envoi.', 'error')
    }
    feedbackSending.value = false
  }
  const unreadCount = computed(() =>
    Object.values(appStore.unread).reduce((a, b) => a + b, 0),
  )

  // ── Ordre personnalise des boutons de navigation principale ─────────────
  // Les ids doivent correspondre aux blocs de rendu dans le template. L'ordre
  // canonique est celui d'origine ; l'utilisateur peut drag-and-drop pour
  // reordonner, avec persistance locale.
  const DEFAULT_ORDER = ['dashboard', 'messages', 'signets', 'devoirs', 'lumen', 'documents', 'fichiers', 'agenda', 'live', 'jeux'] as const
  const {
    effectiveOrder: navOrder,
    hiddenIds: navHiddenIds,
    isHidden: isNavHidden,
    move: moveNavItem,
    moveTo: moveNavItemTo,
    hide: hideNavItem,
    show: showNavItem,
    reset: resetNavOrder,
  } = useNavRailOrder(DEFAULT_ORDER)

  function navItemLabel(id: string): string {
    switch (id) {
      case 'dashboard': return 'Accueil'
      case 'messages':  return 'Messages'
      case 'signets':   return 'Signets'
      case 'devoirs':   return 'Devoirs'
      case 'lumen':     return 'Cours'
      case 'documents': return 'Documents'
      case 'fichiers':  return 'Fichiers'
      case 'agenda':    return 'Calendrier'
      case 'live':      return 'Live'
      case 'jeux':      return 'Jeux'
      default:          return id
    }
  }

  // Visibilite par id, evaluee de maniere reactive cote template
  function isNavVisible(id: string): boolean {
    switch (id) {
      case 'dashboard': return true
      case 'messages':  return true
      case 'signets':   return true
      case 'devoirs':   return true
      case 'lumen':     return isEnabled('lumen')
      case 'documents': return appStore.isStaff
      case 'fichiers':  return appStore.isTeacher
      case 'agenda':    return true
      case 'live':      return isEnabled('live') && (appStore.isStaff || !!(liveStore.currentSession && liveStore.currentSession.status !== 'ended'))
      case 'jeux':      return appStore.isTeacher || isEnabled('games')
      default:          return false
    }
  }

  // ── Context menu (clic-droit) ──────────────────────────────────────────
  const { state: navCtx, open: openNavCtx, close: closeNavCtx } = useContextMenu()
  const navCtxQuickEmojis = ref<ContextMenuQuickEmoji[] | undefined>(undefined)

  function handleNavCtxClose(): void {
    closeNavCtx()
    navCtxQuickEmojis.value = undefined
  }

  function openItemContextMenu(ev: MouseEvent, id: string) {
    navCtxQuickEmojis.value = undefined
    const items: ContextMenuItem[] = [
      { label: 'Masquer ' + navItemLabel(id), icon: EyeOff, action: () => hideNavItem(id) },
      { separator: true, label: '' },
      { label: 'Deplacer en haut', icon: ArrowUp,   action: () => moveNavItemTo(id, 'top') },
      { label: 'Deplacer en bas',  icon: ArrowDown, action: () => moveNavItemTo(id, 'bottom') },
      { separator: true, label: '' },
      { label: 'Reinitialiser l\'ordre', icon: RotateCcw, action: () => resetNavOrder() },
    ]
    openNavCtx(ev, items)
  }

  function openRailContextMenu(ev: MouseEvent) {
    // Si on a clique sur un bouton, le handler de l'item a deja gere
    if ((ev.target as HTMLElement)?.closest('.nav-btn')) return
    navCtxQuickEmojis.value = undefined
    const hidden = navHiddenIds.value.filter(id => isNavVisible(id))
    const items: ContextMenuItem[] = []
    if (hidden.length) {
      for (const id of hidden) {
        items.push({ label: 'Afficher ' + navItemLabel(id), icon: Eye, action: () => showNavItem(id) })
      }
      items.push({ separator: true, label: '' })
    } else {
      items.push({ label: 'Aucun bouton masque', disabled: true })
      items.push({ separator: true, label: '' })
    }
    items.push({ label: 'Reinitialiser l\'ordre', icon: RotateCcw, action: () => resetNavOrder() })
    openNavCtx(ev, items)
  }

  // ── Drag & drop : l'utilisateur deplace les boutons ─────────────────────
  const draggingId = ref<string | null>(null)
  const dragOverId = ref<string | null>(null)

  function onNavDragStart(ev: DragEvent, id: string) {
    draggingId.value = id
    if (ev.dataTransfer) {
      ev.dataTransfer.effectAllowed = 'move'
      ev.dataTransfer.setData('text/plain', id)
    }
  }
  function onNavDragOver(ev: DragEvent, id: string) {
    if (!draggingId.value || draggingId.value === id) return
    ev.preventDefault()
    if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move'
    dragOverId.value = id
  }
  function onNavDragLeave(id: string) {
    if (dragOverId.value === id) dragOverId.value = null
  }
  function onNavDrop(ev: DragEvent, targetId: string) {
    ev.preventDefault()
    const dragged = draggingId.value ?? ev.dataTransfer?.getData('text/plain')
    if (dragged && dragged !== targetId) moveNavItem(dragged, targetId)
    draggingId.value = null
    dragOverId.value = null
  }
  function onNavDragEnd() {
    draggingId.value = null
    dragOverId.value = null
  }

  // ── Statut personnel : menu contextuel discret sur l'avatar ─────────────
  // Presets 1-clic pour le contexte formation (expiration 1h par defaut)
  const STATUS_QUICK_DURATION_MS = 60 * 60_000
  const STATUS_QUICK_PRESETS = [
    { emoji: '📝', text: 'En examen' },
    { emoji: '🧪', text: 'En TP' },
    { emoji: '📚', text: 'En cours' },
    { emoji: '☕', text: 'Pause' },
    { emoji: '🎧', text: 'Ne pas déranger' },
    { emoji: '✈️', text: 'Absent' },
  ] as const

  function applyQuickStatus(p: { emoji: string; text: string }): void {
    const expiresAt = new Date(Date.now() + STATUS_QUICK_DURATION_MS).toISOString()
    statusesStore.setMine({ emoji: p.emoji, text: p.text, expiresAt })
    showToast(`Statut : ${p.emoji} ${p.text} (1h)`, 'info')
  }

  function openAvatarContextMenu(ev: MouseEvent) {
    const mine = statusesStore.mine
    const hasStatus = !!(mine?.emoji || mine?.text)

    const items: ContextMenuItem[] = []

    if (hasStatus) {
      const label = `${mine!.emoji ?? '•'}  ${mine!.text ?? 'Statut'} — ${formatExpiryShort(mine!.expiresAt)}`
      items.push({ label, disabled: true })
      items.push({ separator: true, label: '' })
    }

    items.push({
      label: hasStatus ? 'Personnaliser…' : 'Définir un statut personnalisé…',
      icon: Smile,
      action: () => { showStatusPicker.value = true },
    })

    if (hasStatus) {
      items.push({
        label: 'Effacer le statut',
        icon: Trash2,
        danger: true,
        action: () => { statusesStore.setMine(null) },
      })
    }

    navCtxQuickEmojis.value = STATUS_QUICK_PRESETS.map(p => ({
      emoji: p.emoji,
      label: `${p.text} (1h)`,
      action: () => applyQuickStatus(p),
    }))
    openNavCtx(ev, items)
  }

</script>

<template>
  <nav class="nav-rail" aria-label="Navigation principale" @contextmenu="openRailContextMenu">
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

    <!-- ── Bandeau hors-ligne ── -->
    <div v-if="!appStore.isOnline" class="nav-offline-banner" aria-live="polite">
      <Wifi :size="12" />
      <span>Hors-ligne</span>
    </div>

    <!-- ── Navigation principale (ordre personnalisable via drag-and-drop) ── -->
    <template v-for="id in navOrder" :key="id">
      <button
        v-if="isNavVisible(id) && !isNavHidden(id)"
        class="nav-btn"
        :class="{
          active: id === 'dashboard' ? route.name === 'dashboard'
                : id === 'jeux' ? ['jeux', 'typerace', 'snake', 'space-invaders'].includes(route.name as string)
                : route.name === (id === 'lumen' ? 'lumen' : id === 'agenda' ? 'agenda' : id),
          'nav-btn--dragging': draggingId === id,
          'nav-btn--drop-target': dragOverId === id && draggingId !== id,
        }"
        :title="id === 'dashboard' ? 'Tableau de bord'
              : id === 'messages'  ? 'Messages'
              : id === 'signets'   ? 'Signets (messages sauvegardés)'
              : id === 'devoirs'   ? 'Devoirs'
              : id === 'lumen'     ? 'Cours'
              : id === 'documents' ? 'Documents'
              : id === 'fichiers'  ? 'Fichiers partagés par les étudiants'
              : id === 'agenda'    ? 'Calendrier'
              : id === 'live'      ? 'Live (quiz, feedback, code, tableau)'
              : id === 'jeux'      ? 'Jeux (TypeRace, Snake, Space Invaders, ...)'
              : ''"
        :aria-label="id === 'dashboard' ? 'Tableau de bord' : `Section ${id}`"
        draggable="true"
        @dragstart="onNavDragStart($event, id)"
        @dragover="onNavDragOver($event, id)"
        @dragleave="onNavDragLeave(id)"
        @drop="onNavDrop($event, id)"
        @dragend="onNavDragEnd"
        @contextmenu="openItemContextMenu($event, id)"
        @click="router.push(id === 'dashboard' ? '/dashboard' : id === 'jeux' ? '/jeux' : `/${id}`)"
      >
        <!-- Icones par id -->
        <LayoutDashboard v-if="id === 'dashboard'" :size="20" />
        <template v-else-if="id === 'messages'">
          <span class="nav-icon-wrap">
            <MessageSquare :size="20" />
            <span v-if="msgBadgeCount > 0" class="nav-msg-badge">{{ msgBadgeCount > 9 ? '9+' : msgBadgeCount }}</span>
          </span>
        </template>
        <Bookmark     v-else-if="id === 'signets'"   :size="20" />
        <BookOpen     v-else-if="id === 'devoirs'"   :size="20" />
        <Lightbulb    v-else-if="id === 'lumen'"     :size="20" />
        <FileText     v-else-if="id === 'documents'" :size="20" />
        <Paperclip    v-else-if="id === 'fichiers'"  :size="20" />
        <Calendar     v-else-if="id === 'agenda'"    :size="20" />
        <Zap          v-else-if="id === 'live'"      :size="20" />
        <Gamepad2     v-else-if="id === 'jeux'"      :size="20" />

        <!-- Libelles par id -->
        <span class="nav-label">
          {{ id === 'dashboard' ? 'Accueil'
             : id === 'messages' ? 'Messages'
             : id === 'signets' ? 'Signets'
             : id === 'devoirs' ? 'Devoirs'
             : id === 'lumen' ? 'Cours'
             : id === 'documents' ? 'Documents'
             : id === 'fichiers' ? 'Fichiers'
             : id === 'agenda' ? 'Calendrier'
             : id === 'live' ? 'Live'
             : id === 'jeux' ? 'Jeux'
             : '' }}
        </span>

        <!-- Badge devoirs en attente (student) -->
        <span
          v-if="id === 'devoirs' && appStore.isStudent && pendingCount > 0"
          id="nav-badge-devoirs"
          class="nav-badge"
        >
          {{ pendingCount > 9 ? '9+' : pendingCount }}
        </span>
        <!-- Mini progress bar (student) -->
        <div v-if="id === 'devoirs' && appStore.isStudent && travauxStore.devoirs.length > 0" class="nav-progress">
          <div class="nav-progress-fill" :style="{ width: devoirProgress + '%' }" />
        </div>
        <!-- Dot live pour les etudiants avec session active -->
        <span v-if="id === 'live' && !appStore.isStaff && liveStore.currentSession" class="nav-live-dot" />
      </button>
    </template>

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

    <!-- Espaceur -->
    <div style="flex:1" />

    <!-- Toggle sidebar collapse -->
    <button
      class="nav-btn nav-btn--collapse"
      :title="sidebarCollapsed ? 'Ouvrir la sidebar' : 'Fermer la sidebar'"
      @click="emit('toggle-sidebar')"
    >
      <component :is="sidebarCollapsed ? PanelLeftOpen : PanelLeftClose" :size="18" />
    </button>

    <!-- ── Admin (masque temporairement) ── -->
    <!-- <button
      v-if="appStore.isAdmin"
      class="nav-btn nav-admin-btn"
      title="Console d'administration"
      aria-label="Console d'administration"
      @click="openAdmin"
    >
      <Shield :size="20" />
      <span class="nav-label">Admin</span>
    </button> -->

    <!-- ── Feedback / Bugs (masque temporairement) ── -->
    <!-- <button
      class="nav-btn"
      title="Signaler un bug / Suggestion"
      aria-label="Feedback"
      @click="showFeedback = true"
    >
      <Bug :size="20" />
      <span class="nav-label">Feedback</span>
    </button> -->

    <!-- ── Avatar / Paramètres (clic-droit = statut personnel) ── -->
    <div class="nav-divider" />

    <button
      id="nav-user-avatar"
      class="nav-avatar-btn"
      :style="avatarStyle"
      :title="statusesStore.mine ? `${user?.name} — ${statusesStore.mine.text || statusesStore.mine.emoji} (clic droit pour modifier)` : `${user?.name} — Paramètres (clic droit : statut)`"
      aria-label="Paramètres du compte"
      @click="modals.settings = true"
      @contextmenu.prevent="openAvatarContextMenu"
    >
      <img v-if="user?.photo_data" :src="user.photo_data" :alt="user?.name" />
      <Flame v-else-if="user?.type === 'admin' || user?.type === 'teacher'" :size="18" style="color:#fff;opacity:.95" />
      <span v-else>{{ user?.avatar_initials }}</span>
      <span v-if="statusesStore.mine?.emoji" class="nav-avatar-status" aria-hidden="true">
        {{ statusesStore.mine.emoji }}
      </span>
    </button>
  </nav>

  <!-- Context menu (clic-droit sur un bouton, sur la nav, ou sur l'avatar pour le statut) -->
  <ContextMenu
    v-if="navCtx"
    :x="navCtx.x"
    :y="navCtx.y"
    :items="navCtx.items"
    :quick-emojis="navCtxQuickEmojis"
    @close="handleNavCtxClose"
  />

  <!-- Picker de statut personnel -->
  <UserStatusPicker v-model="showStatusPicker" />

  <!-- Modale Feedback -->
  <Teleport to="body">
    <Transition name="notif-panel-fade">
      <div v-if="showFeedback" class="feedback-overlay" @click.self="showFeedback = false">
        <div class="feedback-modal">
          <div class="feedback-header">
            <Bug :size="16" />
            <h3>Feedback</h3>
            <button class="feedback-close" aria-label="Fermer le formulaire de feedback" @click="showFeedback = false">&times;</button>
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
  border: 2px solid var(--bg-primary);
  animation: pulse-dot 2s infinite;
}

/* ── Message badge (DMs + mentions) ── */
.nav-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-msg-badge {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 9px;
  font-weight: 700;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  background: #ef4444;
  color: #fff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg-rail);
  line-height: 1;
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
  background: var(--bg-active);
  border: 1px solid var(--border);
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
  background: var(--color-danger);
}
.nav-badge-unread {
  background: var(--accent);
}

/* ── Mini progress bar (devoirs) ── */
.nav-progress {
  width: 28px; height: 3px; border-radius: 2px;
  background: rgba(255,255,255,.08);
  overflow: hidden; margin-top: 2px;
}
.nav-progress-fill {
  height: 100%; border-radius: 2px;
  background: var(--color-success);
  transition: width .5s ease;
  min-width: 1px;
}

/* ── Drag & drop : l'utilisateur peut reordonner les boutons ── */
.nav-btn { cursor: grab; }
.nav-btn:active { cursor: grabbing; }
.nav-btn--dragging {
  opacity: 0.5;
  transform: scale(0.95);
  transition: opacity .12s ease, transform .12s ease;
}
.nav-btn--drop-target {
  position: relative;
}
.nav-btn--drop-target::after {
  content: '';
  position: absolute;
  left: 4px; right: 4px; top: -3px;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
  box-shadow: 0 0 8px rgba(var(--accent-rgb), 0.6);
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
  background: var(--accent);
  animation: rail-indicator-in .2s cubic-bezier(.34,1.56,.64,1);
}
@keyframes rail-indicator-in {
  from { height: 0; opacity: 0; }
  to   { height: 20px; opacity: 1; }
}

/* Transition panneau */
.notif-panel-fade-enter-active { transition: opacity var(--motion-fast) var(--ease-out), transform var(--motion-fast) var(--ease-out); }
.notif-panel-fade-leave-active { transition: opacity .09s ease, transform .09s ease; }
.notif-panel-fade-enter-from,
.notif-panel-fade-leave-to     { opacity: 0; transform: translateX(-6px); }

/* ── Statut personnel : petit badge emoji discret en coin d'avatar ── */
.nav-avatar-status {
  position: absolute;
  bottom: -3px;
  right: -3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--bg-rail);
  border: 2px solid var(--bg-rail);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
  pointer-events: none;
  box-shadow: 0 1px 4px rgba(0, 0, 0, .4), 0 0 0 1px rgba(255, 255, 255, .06);
  animation: nav-avatar-status-in .22s cubic-bezier(.34, 1.56, .64, 1);
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
}
@keyframes nav-avatar-status-in {
  from { opacity: 0; transform: scale(.4); }
  to   { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .nav-avatar-status { animation: none; }
}

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
.nav-offline-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 6px;
  margin: 0 6px 4px;
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  animation: offline-pulse 2s ease-in-out infinite;
}
@keyframes offline-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}
.nav-status-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ef4444;
  border: 2px solid var(--bg-primary);
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
  background: var(--bg-active);
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
  color: var(--accent);
}

/* ── Feedback Modal ── */
.feedback-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center;
}
.feedback-modal {
  background: var(--bg-modal); border-radius: 14px; padding: 20px;
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
  background: var(--bg-hover); color: var(--text-secondary);
  border: 1px solid var(--border); cursor: pointer; transition: all .15s;
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
  padding: 8px; background: var(--bg-elevated); border-radius: 8px; margin-bottom: 6px;
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
  padding: 6px 8px; background: var(--bg-elevated); border-radius: 6px;
  border-left: 2px solid var(--accent);
}
</style>
