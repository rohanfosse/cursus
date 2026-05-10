/**
 * MobileNav - barre de navigation fixe en bas pour les ecrans < 768px.
 *
 * 5 emplacements fixes : 4 destinations principales + 1 bouton "Plus" qui
 * ouvre une bottom sheet (MobileAppsSheet) avec les apps secondaires
 * (Documents, Calendrier, RDV, Fichiers, Signets, Jeux, Admin, Live).
 *
 * Live : reste accessible via la sheet avec badge "En cours" pulsant quand
 * une session est active. Les invites Live arrivent deja en pop-up plein
 * ecran (cf. App.vue / live-invite-popup), donc pas de regression urgence.
 */
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { LayoutDashboard, MessageSquare, BookOpen, Calendar, Grid3x3 } from 'lucide-vue-next'
import { useAppStore }    from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { useLiveStore }   from '@/stores/live'
import { useModules }     from '@/composables/useModules'
import { useUnreadCounts } from '@/composables/useUnreadCounts'
import MobileAppsSheet from './MobileAppsSheet.vue'

const appStore     = useAppStore()
const travauxStore = useTravauxStore()
const liveStore    = useLiveStore()
const { isEnabled } = useModules()
const router       = useRouter()
const route        = useRoute()
const counts       = useUnreadCounts()

const pendingCount     = computed(() => travauxStore.urgentPendingCount)
const totalMsgUnread   = computed(() => counts.dmUnread.value + counts.channelUnread.value)
const unreadNotifsCount = counts.notificationsUnread

// Pastille rouge pulsante sur "Plus" si une session Live est en cours
// pour l'etudiant. Sans cet indicateur, l'etudiant raterait la session
// puisque Live est dans la sheet et plus dans la barre principale.
const hasActiveLive = computed(() =>
  isEnabled('live') && !appStore.isStaff && !!liveStore.currentSession && liveStore.currentSession.status !== 'ended',
)

const showAppsSheet = ref(false)
function openAppsSheet(): void  { showAppsSheet.value = true }
function closeAppsSheet(): void { showAppsSheet.value = false }
</script>

<template>
  <nav class="mobile-nav" aria-label="Navigation mobile">
    <button
      class="mobile-nav-btn"
      :class="{ active: route.name === 'dashboard' }"
      @click="router.push({ name: 'dashboard' })"
    >
      <LayoutDashboard :size="20" />
      <span>Accueil</span>
    </button>

    <button
      class="mobile-nav-btn"
      :class="{ active: route.name === 'messages' }"
      @click="router.push({ name: 'messages' })"
    >
      <MessageSquare :size="20" />
      <span>Messages</span>
      <span v-if="totalMsgUnread > 0" class="mobile-nav-badge">
        {{ totalMsgUnread > 99 ? '99+' : totalMsgUnread }}
      </span>
    </button>

    <button
      class="mobile-nav-btn"
      :class="{ active: route.name === 'devoirs' }"
      @click="router.push({ name: 'devoirs' })"
    >
      <BookOpen :size="20" />
      <span>Devoirs</span>
      <span v-if="appStore.isStudent && pendingCount > 0" class="mobile-nav-badge">
        {{ pendingCount > 9 ? '9+' : pendingCount }}
      </span>
    </button>

    <button
      class="mobile-nav-btn"
      :class="{ active: route.name === 'agenda' }"
      @click="router.push({ name: 'agenda' })"
    >
      <Calendar :size="20" />
      <span>Agenda</span>
    </button>

    <button
      class="mobile-nav-btn mobile-nav-btn-more"
      :class="{ active: showAppsSheet }"
      :aria-haspopup="'dialog'"
      :aria-expanded="showAppsSheet"
      aria-label="Plus d'applications"
      @click="openAppsSheet"
    >
      <Grid3x3 :size="20" />
      <span>Plus</span>
      <span v-if="hasActiveLive" class="mobile-nav-live-dot" aria-label="Live en cours" />
      <span
        v-else-if="unreadNotifsCount > 0"
        class="mobile-nav-badge"
        :aria-label="`${unreadNotifsCount} notification${unreadNotifsCount > 1 ? 's' : ''} non lue${unreadNotifsCount > 1 ? 's' : ''}`"
      >
        {{ unreadNotifsCount > 9 ? '9+' : unreadNotifsCount }}
      </span>
    </button>
  </nav>

  <MobileAppsSheet :open="showAppsSheet" @close="closeAppsSheet" />
</template>

<style scoped>
/* Visible uniquement en mobile */
.mobile-nav {
  display: none;
}

@media (max-width: 768px) {
  .mobile-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 56px;
    background: var(--bg-rail);
    border-top: 1px solid var(--border);
    z-index: var(--z-sidebar);
    align-items: center;
    justify-content: space-around;
    padding: 0 4px;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
}

.mobile-nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 10px;
  font-family: var(--font);
  cursor: pointer;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  position: relative;
  transition: color var(--t-fast), background var(--t-fast);
  min-width: 0;
}

.mobile-nav-btn.active {
  color: var(--accent);
}

.mobile-nav-btn.active::after {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 3px;
  background: var(--accent);
  border-radius: 0 0 3px 3px;
}

.mobile-nav-btn:active {
  background: var(--bg-hover);
}

.mobile-nav-badge {
  position: absolute;
  top: 2px;
  right: 6px;
  background: var(--color-danger);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  line-height: 1.2;
}

.mobile-nav-live-dot {
  position: absolute;
  top: 4px;
  right: 10px;
  width: 7px;
  height: 7px;
  background: #e74c3c;
  border-radius: 50%;
  animation: live-pulse 1.5s infinite;
}

.mobile-nav-btn-more :deep(svg) {
  color: var(--text-muted);
  transition: color var(--t-fast);
}
.mobile-nav-btn-more.active :deep(svg),
.mobile-nav-btn-more:active :deep(svg) {
  color: var(--accent);
}

@keyframes live-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-nav-live-dot {
    animation: none !important;
  }
}
</style>
