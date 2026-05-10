/**
 * MobileAppsSheet - bottom sheet plein largeur des apps secondaires (mobile).
 *
 * Affiche en grille 3 colonnes les apps qui ne tiennent pas dans la barre du
 * bas (Documents, Calendrier, RDV, Fichiers, Signets, Jeux, Admin, Live...).
 * Visibilite filtree par role / module via `useNavItems` (meme source que
 * NavRail).
 *
 * Le wrapper sheet (slide-in, backdrop, swipe-down, escape, body lock,
 * route-change close) vit dans `BottomSheet`. On garde ici uniquement la
 * presentation des tiles + l'overlay plein ecran de NotificationPanel.
 */
<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { Bell } from 'lucide-vue-next'
import { useAppStore }    from '@/stores/app'
import { useLiveStore }   from '@/stores/live'
import { useUnreadCounts } from '@/composables/useUnreadCounts'
import { useNavItems, MOBILE_BAR_IDS, type NavItemId } from '@/composables/useNavItems'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import NotificationPanel  from './NotificationPanel.vue'

interface SheetItem {
  readonly id: string
  readonly label: string
  readonly icon: Component
  readonly routeName?: string
  readonly action?: () => void
  readonly badge?: () => string | null
  readonly variant?: 'live' | 'unread'
}

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const router    = useRouter()
const appStore  = useAppStore()
const liveStore = useLiveStore()

const showNotifs = ref(false)

const { notificationsUnread: unreadNotifsCount } = useUnreadCounts()
const { items: navItems } = useNavItems()

// Live et Cours en tete (urgence/frequence d'usage en mobilite). On exclut
// MOBILE_BAR_IDS pour eviter les doublons avec MobileNav.
const SHEET_ORDER: readonly NavItemId[] = [
  'live', 'lumen', 'booking', 'documents', 'fichiers', 'signets', 'jeux', 'admin',
]

function liveBadge(): string | null {
  return (!appStore.isStaff && liveStore.currentSession && liveStore.currentSession.status !== 'ended')
    ? 'En cours'
    : null
}

const visibleItems = computed<SheetItem[]>(() => {
  const map = new Map(navItems.value.map(i => [i.id, i]))
  const sheetItems: SheetItem[] = [
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      action: () => { showNotifs.value = true },
      badge: () => unreadNotifsCount.value > 0 ? (unreadNotifsCount.value > 9 ? '9+' : String(unreadNotifsCount.value)) : null,
      variant: 'unread',
    },
  ]
  for (const id of SHEET_ORDER) {
    if (MOBILE_BAR_IDS.includes(id)) continue
    const item = map.get(id)
    if (!item || !item.visible) continue
    sheetItems.push({
      id: item.id,
      label: id === 'booking' ? 'Rendez-vous' : item.label,
      icon: item.icon,
      routeName: item.routeName ?? item.id,
      ...(id === 'live' ? { badge: liveBadge, variant: 'live' as const } : {}),
    })
  }
  return sheetItems
})

function handleItemTap(item: SheetItem): void {
  if (item.action) {
    item.action()
    return
  }
  emit('close')
  if (item.routeName) router.push({ name: item.routeName })
}

function closeNotifs(): void {
  showNotifs.value = false
  emit('close')
}
</script>

<template>
  <BottomSheet :open="open" title="Applications" @close="emit('close')">
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
            :role="item.variant === 'live' ? 'status' : undefined"
            :aria-live="item.variant === 'live' ? 'polite' : undefined"
          >
            {{ item.badge?.() }}
          </span>
        </span>
        <span class="apps-sheet-tile-label">{{ item.label }}</span>
      </button>
    </div>
  </BottomSheet>

  <Teleport to="body">
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

.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: opacity var(--t-base) ease;
}
.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .apps-sheet-tile {
    transition: none !important;
  }
  .apps-sheet-tile-badge {
    animation: none !important;
  }
}
</style>
