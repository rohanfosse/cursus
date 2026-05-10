/**
 * MobileAppsSheet - bottom sheet plein largeur des apps secondaires (mobile).
 *
 * Affiche en grille 3 colonnes les apps qui ne tiennent pas dans la barre du
 * bas (Documents, Calendrier, RDV, Fichiers, Signets, Jeux, Admin, Live...).
 * Visibilite filtree par role / module via les memes regles que NavRail.
 *
 * Pattern d'ouverture : tap sur le bouton "Plus" de MobileNav (cf. parent).
 * Fermeture : tap sur le backdrop, swipe down, Escape, navigation.
 */
<script setup lang="ts">
import { computed, watch, onUnmounted, ref, type Component } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  Bookmark, FileText, Paperclip, CalendarCheck,
  Zap, Gamepad2, Shield, X, Lightbulb, Bell,
} from 'lucide-vue-next'
import { useAppStore }    from '@/stores/app'
import { useLiveStore }   from '@/stores/live'
import { useModules }     from '@/composables/useModules'
import NotificationPanel  from './NotificationPanel.vue'

interface SheetItem {
  readonly id: string
  readonly label: string
  readonly icon: Component
  readonly route?: string
  readonly action?: () => void
  readonly isVisible: () => boolean
  readonly badge?: () => string | null
  readonly variant?: 'live' | 'unread'
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const router    = useRouter()
const route     = useRoute()
const appStore  = useAppStore()
const liveStore = useLiveStore()
const { isEnabled } = useModules()

const isDemo = () => appStore.currentUser?.demo === true

const showNotifs = ref(false)

const unreadNotifsCount = computed(() =>
  appStore.notificationHistory.filter(n => !n.read).length,
)

// Apps secondaires accessibles via le bouton "Plus".
// Notifications + Live + Cours en haut (urgence/frequence).
// L'ordre reflete la frequence d'usage attendue cote etudiant / prof.
const SHEET_ITEMS: readonly SheetItem[] = [
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    action: () => { showNotifs.value = true },
    isVisible: () => true,
    badge: () => unreadNotifsCount.value > 0 ? (unreadNotifsCount.value > 9 ? '9+' : String(unreadNotifsCount.value)) : null,
    variant: 'unread',
  },
  {
    id: 'live',
    label: 'Live',
    icon: Zap,
    route: '/live',
    isVisible: () => isEnabled('live'),
    badge: () => (!appStore.isStaff && liveStore.currentSession && liveStore.currentSession.status !== 'ended') ? 'En cours' : null,
    variant: 'live',
  },
  {
    id: 'lumen',
    label: 'Cours',
    icon: Lightbulb,
    route: '/lumen',
    isVisible: () => isEnabled('lumen'),
  },
  {
    id: 'booking',
    label: 'Rendez-vous',
    icon: CalendarCheck,
    route: '/booking',
    isVisible: () => appStore.isTeacher,
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: FileText,
    route: '/documents',
    isVisible: () => appStore.isStaff,
  },
  {
    id: 'fichiers',
    label: 'Fichiers',
    icon: Paperclip,
    route: '/fichiers',
    isVisible: () => appStore.isTeacher,
  },
  {
    id: 'signets',
    label: 'Signets',
    icon: Bookmark,
    route: '/signets',
    isVisible: () => !isDemo(),
  },
  {
    id: 'jeux',
    label: 'Jeux',
    icon: Gamepad2,
    route: '/jeux',
    isVisible: () => appStore.isTeacher || isEnabled('games'),
  },
  {
    id: 'admin',
    label: 'Administration',
    icon: Shield,
    route: '/admin',
    isVisible: () => appStore.isAdmin,
  },
]

const visibleItems = computed<SheetItem[]>(() =>
  SHEET_ITEMS.filter(item => item.isVisible()),
)

function handleItemTap(item: SheetItem): void {
  if (item.action) {
    item.action()
    return
  }
  emit('close')
  if (item.route) router.push(item.route)
}

function closeNotifs(): void {
  showNotifs.value = false
  emit('close')
}

function handleBackdropTap(): void {
  emit('close')
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

// Sauvegarde la valeur initiale de body.overflow pour la restaurer
// proprement apres fermeture (evite de clobber un overflow:hidden defini
// par une autre modale ou par l'app shell).
let bodyOverflowSnapshot: string | null = null

function lockBodyScroll(): void {
  if (bodyOverflowSnapshot === null) {
    bodyOverflowSnapshot = document.body.style.overflow
  }
  document.body.style.overflow = 'hidden'
}
function unlockBodyScroll(): void {
  if (bodyOverflowSnapshot !== null) {
    document.body.style.overflow = bodyOverflowSnapshot
    bodyOverflowSnapshot = null
  }
}

watch(() => props.open, (open) => {
  if (open) {
    document.addEventListener('keydown', onKeydown)
    lockBodyScroll()
  } else {
    document.removeEventListener('keydown', onKeydown)
    unlockBodyScroll()
  }
})

// Si l'utilisateur navigue (tap sur une tile, retour navigateur, deep link)
// alors que la sheet est ouverte, on force la fermeture pour eviter de
// laisser body.overflow:hidden actif sur la nouvelle page.
watch(() => route.fullPath, () => {
  if (props.open) emit('close')
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  unlockBodyScroll()
})

// Swipe-to-dismiss : on enregistre la position de depart au touchstart,
// puis si le drag total descend > 80px on declenche close. Pas de drag
// reel sur la sheet (overhead), juste un threshold simple et fiable.
let touchStartY: number | null = null

function onTouchStart(e: TouchEvent): void {
  touchStartY = e.touches[0]?.clientY ?? null
}

function onTouchEnd(e: TouchEvent): void {
  if (touchStartY === null) return
  const endY = e.changedTouches[0]?.clientY ?? touchStartY
  const dy = endY - touchStartY
  touchStartY = null
  if (dy > 80) emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet-fade">
      <div
        v-if="open"
        class="apps-sheet-backdrop"
        role="presentation"
        @click="handleBackdropTap"
      />
    </Transition>

    <Transition name="sheet-slide">
      <div
        v-if="open"
        class="apps-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Applications"
        @touchstart.passive="onTouchStart"
        @touchend.passive="onTouchEnd"
      >
        <div class="apps-sheet-handle" aria-hidden="true" />

        <header class="apps-sheet-header">
          <h2 class="apps-sheet-title">Applications</h2>
          <button
            type="button"
            class="apps-sheet-close"
            aria-label="Fermer"
            @click="handleBackdropTap"
          >
            <X :size="22" />
          </button>
        </header>

        <div class="apps-sheet-grid">
          <button
            v-for="item in visibleItems"
            :key="item.id"
            type="button"
            class="apps-sheet-tile"
            :class="{
              'apps-sheet-tile--live':   item.variant === 'live'   && item.badge?.(),
              'apps-sheet-tile--unread': item.variant === 'unread' && item.badge?.(),
            }"
            :aria-label="`Ouvrir ${item.label}`"
            @click="handleItemTap(item)"
          >
            <span class="apps-sheet-tile-icon-wrap">
              <component :is="item.icon" :size="26" aria-hidden="true" />
              <span
                v-if="item.badge?.()"
                class="apps-sheet-tile-badge"
                :class="{ 'apps-sheet-tile-badge--count': item.variant === 'unread' }"
              >
                {{ item.badge?.() }}
              </span>
            </span>
            <span class="apps-sheet-tile-label">{{ item.label }}</span>
          </button>
        </div>
      </div>
    </Transition>

    <!-- Panneau de notifications plein ecran sur mobile -->
    <Transition name="sheet-fade">
      <div
        v-if="showNotifs"
        class="mobile-notifs-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
      >
        <NotificationPanel @close="closeNotifs" />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.apps-sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, .55);
  backdrop-filter: blur(2px);
  z-index: var(--z-overlay, 9000);
}

.apps-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: calc(var(--z-overlay, 9000) + 1);
  background: var(--bg-elevated);
  border-top: 1px solid var(--border);
  border-radius: 18px 18px 0 0;
  padding: 8px 16px calc(20px + env(safe-area-inset-bottom, 0));
  box-shadow: 0 -12px 40px rgba(0, 0, 0, .35);
  max-height: 80vh;
  overflow-y: auto;
}

.apps-sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--text-muted);
  opacity: .35;
  margin: 0 auto 12px;
}

.apps-sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 0 4px;
}

.apps-sheet-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -.2px;
}

.apps-sheet-close {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
  transition: background var(--t-fast), color var(--t-fast);
}
.apps-sheet-close:hover,
.apps-sheet-close:active {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.apps-sheet-close:focus-visible {
  outline: var(--focus-ring);
  outline-offset: 2px;
}

.apps-sheet-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.apps-sheet-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px 8px;
  background: var(--bg-modal, var(--bg-primary));
  border: 1px solid var(--border);
  border-radius: 14px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: var(--font);
  min-height: 88px;
  transition:
    background var(--t-fast),
    border-color var(--t-fast),
    transform .15s cubic-bezier(.34, 1.56, .64, 1);
}
.apps-sheet-tile:hover,
.apps-sheet-tile:active {
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-modal, var(--bg-primary)));
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
  transform: translateY(-2px);
}
.apps-sheet-tile:focus-visible {
  outline: var(--focus-ring);
  outline-offset: 2px;
}
.apps-sheet-tile :deep(svg) {
  color: var(--accent);
}

.apps-sheet-tile--live :deep(svg) {
  color: var(--color-danger);
}
.apps-sheet-tile--live {
  border-color: color-mix(in srgb, var(--color-danger) 40%, var(--border));
  background: color-mix(in srgb, var(--color-danger) 8%, var(--bg-modal, var(--bg-primary)));
}

.apps-sheet-tile--unread :deep(svg) {
  color: var(--accent);
}
.apps-sheet-tile--unread {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--border));
}

.apps-sheet-tile-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.apps-sheet-tile-badge {
  position: absolute;
  top: -8px;
  right: -32px;
  background: var(--color-danger);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .4px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  line-height: 1.3;
  white-space: nowrap;
  animation: live-badge-pulse 1.6s ease-in-out infinite;
}

.apps-sheet-tile-badge--count {
  top: -6px;
  right: -14px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 10px;
  letter-spacing: 0;
  text-transform: none;
  background: var(--accent);
  border-radius: var(--radius-full, 999px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: none;
}

.mobile-notifs-overlay {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-overlay, 9000) + 2);
  background: var(--bg-primary);
  padding-top: env(safe-area-inset-top, 0);
  display: flex;
  flex-direction: column;
}
/* NotificationPanel est ancre absolute sur desktop ; en mobile on l'etire. */
.mobile-notifs-overlay :deep(.notif-panel) {
  position: static !important;
  width: 100% !important;
  height: 100% !important;
  max-height: 100% !important;
  border-radius: 0 !important;
  border: none !important;
}

@keyframes live-badge-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: .6; }
}

.apps-sheet-tile-label {
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  line-height: 1.25;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Transitions ouverture / fermeture */
.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: opacity var(--t-base) ease;
}
.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}

.sheet-slide-enter-active {
  transition: transform var(--t-slow) cubic-bezier(.32, .72, 0, 1);
}
.sheet-slide-leave-active {
  transition: transform var(--t-base) cubic-bezier(.4, 0, 1, 1);
}
.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .sheet-slide-enter-active,
  .sheet-slide-leave-active,
  .apps-sheet-tile {
    transition: none !important;
  }
  .apps-sheet-tile-badge {
    animation: none !important;
  }
}
</style>
