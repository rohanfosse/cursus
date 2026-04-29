<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  MessageSquare, BookOpen, FileText, LayoutDashboard, Bell, Flame,
  Shield, Zap, Paperclip, Lightbulb, Calendar, CalendarCheck, Gamepad2,
  PanelLeftClose, PanelLeftOpen, EyeOff, Eye, ArrowUp, ArrowDown, RotateCcw,
  Bookmark, Smile, Trash2, MoreHorizontal, WifiOff,
} from 'lucide-vue-next'
import UserStatusPicker from '@/components/modals/UserStatusPicker.vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import type { ContextMenuQuickEmoji } from '@/components/ui/ContextMenu.vue'
import { useContextMenu, type ContextMenuItem } from '@/composables/useContextMenu'
import { useAppStore } from '@/stores/app'
import { useModalsStore } from '@/stores/modals'
import { useTravauxStore } from '@/stores/travaux'
import { useLiveStore } from '@/stores/live'
import { useStatusesStore } from '@/stores/statuses'
import { useToast } from '@/composables/useToast'
import { useModules } from '@/composables/useModules'
import { useNavRailOrder } from '@/composables/useNavRailOrder'
import { useDemoMission } from '@/composables/useDemoMission'
import { avatarColor } from '@/utils/format'
import { formatExpiryShort } from '@/utils/date'
import logoUrl from '@/assets/logo.png'
import NotificationPanel from './NotificationPanel.vue'

// ── Props / émits ───────────────────────────────────────────────────────────
defineProps<{ sidebarCollapsed?: boolean }>()
const emit = defineEmits<{ 'toggle-sidebar': [] }>()

// ── Stores & composables ────────────────────────────────────────────────────
const appStore      = useAppStore()
const modals        = useModalsStore()
const travauxStore  = useTravauxStore()
const liveStore     = useLiveStore()
const statusesStore = useStatusesStore()
const { showToast } = useToast()
const { isEnabled } = useModules()

const router = useRouter()
const route  = useRoute()

// ── Utilisateur courant ─────────────────────────────────────────────────────
const user = computed(() => appStore.currentUser)
const avatarStyle = computed(() => {
  const u = user.value
  if (!u) return {}
  if (u.type === 'admin' || u.type === 'teacher') return { background: 'var(--accent)' }
  if (u.type === 'ta') return { background: '#7B5EA7' }
  return { background: avatarColor(u.name) }
})

// ── Compteurs badges ────────────────────────────────────────────────────────
const pendingCount = computed(() => travauxStore.urgentPendingCount)
const devoirProgress = computed(() => {
  const total = travauxStore.devoirs.length
  if (!total) return 0
  const done = travauxStore.devoirs.filter(t => t.depot_id != null).length
  return Math.round((done / total) * 100)
})
const unreadCount = computed(() =>
  Object.values(appStore.unread).reduce((a, b) => a + b, 0),
)
const mentionCount = computed(() =>
  Object.values(appStore.mentionChannels).reduce((a, b) => a + b, 0),
)
const msgBadgeCount = computed(() => {
  const dmCount = Object.values(appStore.unreadDms ?? {}).reduce((a: number, b) => a + (b as number), 0)
  return dmCount + mentionCount.value
})

// Mode demo : pulse "A essayer" sur les onglets pas encore visites. Disparait
// au 1er clic (la mission s'auto-coche au passage sur la route). Seul affichage
// du bord visuel — pas de texte intrusif. Mappe les nav-item ids aux ids de
// la mission (live_or_booking couvre live et booking, le reste matche 1:1).
const demoMission = useDemoMission()
const NAV_TO_MISSION: Record<string, string> = {
  messages: 'messages',
  lumen:    'lumen',
  devoirs:  'devoirs',
  live:     'live_or_booking',
  booking:  'live_or_booking',
  agenda:   'live_or_booking',
}
function showDemoDot(itemId: string): boolean {
  if (!demoMission.isActive.value) return false
  const missionId = NAV_TO_MISSION[itemId]
  if (!missionId) return false
  const action = demoMission.actions.value.find(a => a.id === missionId)
  return action ? !action.done : false
}

// ── État UI local ───────────────────────────────────────────────────────────
const showNotifications = ref(false)
const showStatusPicker  = ref(false)
const showMorePopup     = ref(false)
const moreBtnRef        = ref<HTMLButtonElement | null>(null)

// ── Configuration des onglets ───────────────────────────────────────────────
// Ajouter un onglet = ajouter une ligne à `NAV_ITEMS`. L'ordre par défaut,
// l'affichage conditionnel (rôle/module), l'icône, le libellé et les routes
// actives dérivent de cette seule config.
type NavItemId =
  | 'dashboard' | 'messages' | 'signets' | 'devoirs' | 'lumen'
  | 'documents' | 'fichiers' | 'agenda'  | 'booking' | 'live' | 'jeux'

interface NavItem {
  readonly id: NavItemId
  readonly label: string
  readonly title: string
  readonly icon: Component
  readonly isVisible: () => boolean
  /** Noms de routes qui activent ce bouton. Défaut : [id]. */
  readonly activeRoutes?: readonly string[]
}

const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', label: 'Accueil',    title: 'Tableau de bord',                            icon: LayoutDashboard, isVisible: () => true },
  { id: 'messages',  label: 'Messages',   title: 'Messages',                                   icon: MessageSquare,   isVisible: () => true },
  { id: 'signets',   label: 'Signets',    title: 'Signets (messages sauvegardés)',             icon: Bookmark,        isVisible: () => true },
  { id: 'devoirs',   label: 'Devoirs',    title: 'Devoirs',                                    icon: BookOpen,        isVisible: () => true },
  { id: 'lumen',     label: 'Cours',      title: 'Cours',                                      icon: Lightbulb,       isVisible: () => isEnabled('lumen') },
  { id: 'documents', label: 'Documents',  title: 'Documents',                                  icon: FileText,        isVisible: () => appStore.isStaff },
  { id: 'fichiers',  label: 'Fichiers',   title: 'Fichiers partagés par les étudiants',        icon: Paperclip,       isVisible: () => appStore.isTeacher },
  { id: 'agenda',    label: 'Calendrier', title: 'Calendrier',                                 icon: Calendar,        isVisible: () => true },
  { id: 'booking',   label: 'Rendez-vous', title: 'Rendez-vous (mini-Calendly + campagnes)',   icon: CalendarCheck,   isVisible: () => appStore.isTeacher },
  // Live : toujours visible pour les etudiants tant que le module est actif —
  // ils peuvent rejoindre une session en cours OU revoir/refaire d'anciennes
  // sessions terminees en mode entrainement (cf. StudentLiveView "Sessions
  // passees"). Avant on cachait l'onglet hors session active, ce qui rendait
  // la fonctionnalite review invisible aux etudiants.
  { id: 'live',      label: 'Live',       title: 'Live (quiz, feedback, code, tableau)',       icon: Zap,             isVisible: () => isEnabled('live') },
  { id: 'jeux',      label: 'Jeux',       title: 'Jeux (TypeRace, Snake, Space Invaders, ...)', icon: Gamepad2,        isVisible: () => appStore.isTeacher || isEnabled('games'), activeRoutes: ['jeux', 'typerace', 'snake', 'space-invaders'] },
]

// Lookup non-réactif : NAV_ITEMS ne change jamais, inutile de passer par un computed.
const NAV_ITEM_BY_ID = Object.freeze(
  Object.fromEntries(NAV_ITEMS.map(i => [i.id, i])) as Record<NavItemId, NavItem>,
)

// Les ids viennent du composable `useNavRailOrder` qui utilise `string`.
// Ces helpers font donc la narrow : un id inconnu renvoie un fallback neutre.
function navItemLabel(id: string): string {
  return NAV_ITEM_BY_ID[id as NavItemId]?.label ?? id
}
function isNavVisible(id: string): boolean {
  return NAV_ITEM_BY_ID[id as NavItemId]?.isVisible() ?? false
}
function isItemActive(item: NavItem): boolean {
  const name = route.name as string | undefined
  if (!name) return false
  const routes = item.activeRoutes ?? [item.id]
  return routes.includes(name)
}

// ── Ordre personnalisable + masquage ────────────────────────────────────────
const DEFAULT_ORDER: readonly NavItemId[] = NAV_ITEMS.map(i => i.id)
const {
  effectiveOrder: navOrder,
  hiddenIds:      navHiddenIds,
  isHidden:       isNavHidden,
  move:           moveNavItem,
  moveTo:         moveNavItemTo,
  hide:           hideNavItem,
  show:           showNavItem,
  reset:          resetNavOrder,
} = useNavRailOrder(DEFAULT_ORDER)

/** Onglets visibles dans l'ordre choisi — filtrage rôle/module + masquage utilisateur. */
const visibleNavItems = computed<NavItem[]>(() => {
  const items: NavItem[] = []
  for (const id of navOrder.value) {
    const item = NAV_ITEM_BY_ID[id as NavItemId]
    if (!item) continue
    if (!item.isVisible()) continue
    if (isNavHidden(id)) continue
    items.push(item)
  }
  return items
})

/** Onglets masqués mais visibles selon le rôle/modules — ceux qu'on peut rétablir. */
const hiddenVisibleNavIds = computed(() =>
  navHiddenIds.value.filter(id => isNavVisible(id)),
)

/** Onglets masqués résolus en NavItem (avec icône/label) pour la grille "..." */
const hiddenVisibleNavItems = computed<NavItem[]>(() => {
  const items: NavItem[] = []
  for (const id of hiddenVisibleNavIds.value) {
    const item = NAV_ITEM_BY_ID[id as NavItemId]
    if (item) items.push(item)
  }
  return items
})

/** Click sur une icône de la grille « Plus » : rétablit l'onglet puis navigue. */
function openHiddenApp(id: string): void {
  showNavItem(id)
  showMorePopup.value = false
  router.push(`/${id}`)
}

/** Fermeture au clic extérieur sur la popup « Plus ». */
function handleMorePopupOutside(e: MouseEvent): void {
  const target = e.target as Node
  if (moreBtnRef.value?.contains(target)) return
  const popup = document.querySelector('.nav-more-popup')
  if (popup?.contains(target)) return
  showMorePopup.value = false
}
function toggleMorePopup(): void {
  showMorePopup.value = !showMorePopup.value
}
// Gestion listener global (Escape + clic extérieur) quand la popup est ouverte.
function onMorePopupKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') showMorePopup.value = false
}
// Pose/retire les listeners globaux en fonction de l'état de la popup.
// (watch classique, pas onMounted : la popup peut s'ouvrir plusieurs fois.)
watch(showMorePopup, (open) => {
  if (open) {
    setTimeout(() => {
      document.addEventListener('click', handleMorePopupOutside)
      document.addEventListener('keydown', onMorePopupKeydown)
    }, 0)
  } else {
    document.removeEventListener('click', handleMorePopupOutside)
    document.removeEventListener('keydown', onMorePopupKeydown)
  }
})

// ── Navigation admin ────────────────────────────────────────────────────────
function openAdmin() {
  router.push('/admin')
}

// ── Context menu ────────────────────────────────────────────────────────────
const {
  state:  navCtx,
  open:   openNavCtx,
  close:  closeNavCtx,
} = useContextMenu()
const navCtxQuickEmojis = ref<ContextMenuQuickEmoji[] | undefined>(undefined)

function handleNavCtxClose(): void {
  closeNavCtx()
  navCtxQuickEmojis.value = undefined
}

function openItemContextMenu(ev: MouseEvent, id: string) {
  navCtxQuickEmojis.value = undefined
  const items: ContextMenuItem[] = [
    { label: `Masquer ${navItemLabel(id)}`, icon: EyeOff, action: () => hideNavItem(id) },
    { separator: true, label: '' },
    { label: 'Déplacer en haut', icon: ArrowUp,   action: () => moveNavItemTo(id, 'top') },
    { label: 'Déplacer en bas',  icon: ArrowDown, action: () => moveNavItemTo(id, 'bottom') },
    { separator: true, label: '' },
    { label: 'Réinitialiser l\'ordre', icon: RotateCcw, action: () => resetNavOrder() },
  ]
  openNavCtx(ev, items)
}

function buildHiddenItemsMenu(): ContextMenuItem[] {
  const hidden = hiddenVisibleNavIds.value
  const items: ContextMenuItem[] = []
  if (hidden.length) {
    for (const id of hidden) {
      items.push({ label: `Afficher ${navItemLabel(id)}`, icon: Eye, action: () => showNavItem(id) })
    }
    items.push({ separator: true, label: '' })
  } else {
    items.push({ label: 'Aucun onglet masqué', disabled: true })
    items.push({ separator: true, label: '' })
  }
  items.push({ label: 'Réinitialiser l\'ordre', icon: RotateCcw, action: () => resetNavOrder() })
  return items
}

function openRailContextMenu(ev: MouseEvent) {
  // Si on a cliqué sur un bouton, son handler a déjà pris la main.
  if ((ev.target as HTMLElement)?.closest('.nav-btn')) return
  navCtxQuickEmojis.value = undefined
  openNavCtx(ev, buildHiddenItemsMenu())
}

// ── Drag & drop réordonnement ───────────────────────────────────────────────
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

// ── Statut personnel ────────────────────────────────────────────────────────
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
    <!-- ── Logo ─────────────────────────────────────────────────────── -->
    <div class="nav-logo">
      <button
        class="nav-logo-btn"
        :title="!appStore.isOnline ? 'Hors ligne' : !appStore.socketConnected ? 'Reconnexion...' : 'Tableau de bord'"
        aria-label="Accueil — Tableau de bord"
        @click="router.push('/dashboard')"
      >
        <img :src="logoUrl" class="nav-logo-img" alt="Cursus" />
        <span
          v-if="!appStore.isOnline || !appStore.socketConnected"
          class="nav-status-dot"
          aria-hidden="true"
        />
      </button>
    </div>

    <!-- ── Bandeau hors-ligne ───────────────────────────────────────── -->
    <div v-if="!appStore.isOnline" class="nav-offline-banner" aria-live="polite">
      <WifiOff :size="12" aria-hidden="true" />
      <span>Hors-ligne</span>
    </div>

    <!-- ── Onglets principaux (data-driven via NAV_ITEMS) ───────────── -->
    <button
      v-for="item in visibleNavItems"
      :key="item.id"
      class="nav-btn"
      :class="{
        active:                 isItemActive(item),
        'nav-btn--dragging':    draggingId === item.id,
        'nav-btn--drop-target': dragOverId === item.id && draggingId !== item.id,
      }"
      :title="item.title"
      :aria-label="item.title"
      :aria-current="isItemActive(item) ? 'page' : undefined"
      draggable="true"
      @dragstart="onNavDragStart($event, item.id)"
      @dragover="onNavDragOver($event, item.id)"
      @dragleave="onNavDragLeave(item.id)"
      @drop="onNavDrop($event, item.id)"
      @dragend="onNavDragEnd"
      @contextmenu="openItemContextMenu($event, item.id)"
      @click="router.push(`/${item.id}`)"
    >
      <!-- Icône + badge d'unreads sur Messages -->
      <template v-if="item.id === 'messages'">
        <span class="nav-icon-wrap">
          <component :is="item.icon" :size="20" aria-hidden="true" />
          <span
            v-if="msgBadgeCount > 0"
            class="nav-msg-badge"
            :aria-label="`${msgBadgeCount} message${msgBadgeCount > 1 ? 's' : ''} non lu${msgBadgeCount > 1 ? 's' : ''}`"
          >
            {{ msgBadgeCount > 9 ? '9+' : msgBadgeCount }}
          </span>
        </span>
      </template>
      <component :is="item.icon" v-else :size="20" aria-hidden="true" />

      <span class="nav-label">{{ item.label }}</span>

      <!-- Badge devoirs urgents (étudiant) -->
      <span
        v-if="item.id === 'devoirs' && appStore.isStudent && pendingCount > 0"
        id="nav-badge-devoirs"
        class="nav-badge"
        :aria-label="`${pendingCount} devoir${pendingCount > 1 ? 's' : ''} urgent${pendingCount > 1 ? 's' : ''}`"
      >
        {{ pendingCount > 9 ? '9+' : pendingCount }}
      </span>
      <!-- Mini progress bar (étudiant) -->
      <div
        v-if="item.id === 'devoirs' && appStore.isStudent && travauxStore.devoirs.length > 0"
        class="nav-progress"
        role="progressbar"
        :aria-valuenow="devoirProgress"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`Progression devoirs : ${devoirProgress}%`"
      >
        <div class="nav-progress-fill" :style="{ width: devoirProgress + '%' }" />
      </div>
      <!-- Dot live (étudiant, session active) -->
      <span
        v-if="item.id === 'live' && !appStore.isStaff && liveStore.currentSession"
        class="nav-live-dot"
        aria-label="Live en cours"
      />
      <!-- Dot "A essayer" du mode demo (route pas encore visitee) -->
      <span
        v-if="showDemoDot(item.id)"
        class="nav-demo-dot"
        aria-label="A decouvrir en demo"
      />
    </button>

    <!-- Hairline divider avant les utilitaires (Plus / Notifs) -->
    <div class="nav-group-divider" aria-hidden="true" />

    <!-- ── Bouton « Plus » : onglets masqués, grille d'apps style Teams ── -->
    <div v-if="hiddenVisibleNavIds.length > 0" class="nav-more-wrapper">
      <button
        ref="moreBtnRef"
        class="nav-btn nav-more-btn"
        :class="{ active: showMorePopup }"
        :title="`${hiddenVisibleNavIds.length} application${hiddenVisibleNavIds.length > 1 ? 's' : ''}`"
        aria-label="Ouvrir la grille des applications masquées"
        aria-haspopup="dialog"
        :aria-expanded="showMorePopup"
        @click.stop="toggleMorePopup"
      >
        <MoreHorizontal :size="20" aria-hidden="true" />
        <span class="nav-label">Plus</span>
        <span class="nav-badge nav-badge-more" aria-hidden="true">{{ hiddenVisibleNavIds.length }}</span>
      </button>

      <!-- Popup grille d'icônes d'applications masquées (style Teams). -->
      <Transition name="more-popup-fade">
        <div
          v-if="showMorePopup"
          class="nav-more-popup"
          role="dialog"
          aria-label="Applications masquées"
        >
          <div class="nav-more-popup-title">Applications</div>
          <div class="nav-more-grid">
            <button
              v-for="item in hiddenVisibleNavItems"
              :key="item.id"
              type="button"
              class="nav-more-tile"
              :title="item.title"
              :aria-label="`Ouvrir ${item.label}`"
              @click="openHiddenApp(item.id)"
            >
              <component :is="item.icon" :size="22" aria-hidden="true" />
              <span class="nav-more-tile-label">{{ item.label }}</span>
            </button>
          </div>
          <button
            type="button"
            class="nav-more-reset"
            @click="resetNavOrder(); showMorePopup = false"
          >
            <RotateCcw :size="12" aria-hidden="true" />
            <span>Réinitialiser l'ordre</span>
          </button>
        </div>
      </Transition>
    </div>

    <!-- ── Cloche de notifications ──────────────────────────────────── -->
    <div class="nav-notif-wrapper">
      <button
        class="nav-btn"
        :class="{ active: showNotifications }"
        title="Notifications"
        aria-label="Centre de notifications"
        aria-haspopup="dialog"
        aria-controls="nav-notif-panel"
        :aria-expanded="showNotifications"
        @click="showNotifications = !showNotifications"
      >
        <Bell :size="20" aria-hidden="true" />
        <span class="nav-label">Notifs</span>
        <span v-if="mentionCount > 0" class="nav-badge nav-badge-mention">
          {{ mentionCount > 9 ? '9+' : mentionCount }}
        </span>
        <span v-else-if="unreadCount > 0" class="nav-badge nav-badge-unread">
          {{ unreadCount > 9 ? '9+' : unreadCount }}
        </span>
      </button>
      <Transition name="notif-panel-fade">
        <NotificationPanel
          v-if="showNotifications"
          id="nav-notif-panel"
          @close="showNotifications = false"
        />
      </Transition>
    </div>

    <!-- Espaceur qui pousse les utilitaires en bas -->
    <div class="nav-spacer" aria-hidden="true" />

    <!-- ── Toggle sidebar collapse ──────────────────────────────────── -->
    <button
      class="nav-btn nav-btn--collapse"
      :title="sidebarCollapsed ? 'Ouvrir la sidebar' : 'Fermer la sidebar'"
      :aria-label="sidebarCollapsed ? 'Ouvrir la sidebar' : 'Fermer la sidebar'"
      :aria-pressed="!sidebarCollapsed"
      @click="emit('toggle-sidebar')"
    >
      <component
        :is="sidebarCollapsed ? PanelLeftOpen : PanelLeftClose"
        :size="18"
        aria-hidden="true"
      />
    </button>

    <!-- ── Administration ───────────────────────────────────────────── -->
    <button
      v-if="appStore.isAdmin"
      class="nav-btn nav-admin-btn"
      :class="{ active: route.name === 'admin' }"
      title="Administration"
      aria-label="Administration"
      :aria-current="route.name === 'admin' ? 'page' : undefined"
      @click="openAdmin"
    >
      <Shield :size="20" aria-hidden="true" />
      <span class="nav-label">Admin</span>
    </button>

    <div class="nav-divider" aria-hidden="true" />

    <!-- ── Avatar / Paramètres (clic-droit = statut personnel) ──────── -->
    <button
      id="nav-user-avatar"
      class="nav-avatar-btn"
      :style="avatarStyle"
      :title="statusesStore.mine
        ? `${user?.name} — ${statusesStore.mine.text || statusesStore.mine.emoji} (clic droit pour modifier)`
        : `${user?.name} — Paramètres (clic droit : statut)`"
      aria-label="Paramètres du compte"
      aria-haspopup="menu"
      @click="modals.settings = true"
      @contextmenu.prevent="openAvatarContextMenu"
    >
      <img v-if="user?.photo_data" :src="user.photo_data" :alt="user?.name" />
      <Flame
        v-else-if="user?.type === 'admin' || user?.type === 'teacher'"
        :size="18"
        class="nav-avatar-flame"
        aria-hidden="true"
      />
      <span v-else>{{ user?.avatar_initials }}</span>
      <span v-if="statusesStore.mine?.emoji" class="nav-avatar-status" aria-hidden="true">
        {{ statusesStore.mine.emoji }}
      </span>
    </button>
  </nav>

  <!-- Context menu -->
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
</template>

<style scoped>
/* ── Logo ────────────────────────────────────────────────────────────── */
.nav-logo { position: relative; }
.nav-logo-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  border-radius: var(--radius);
  transition: filter var(--motion-base) var(--ease-out);
}
.nav-logo-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.nav-logo-btn:hover {
  filter: drop-shadow(0 0 10px rgba(var(--accent-rgb), .35));
}
.nav-logo-img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, .3));
  transition: transform var(--motion-base) var(--ease-spring);
}
.nav-logo-btn:hover .nav-logo-img { transform: scale(1.07); }

/* ── Statut de connexion (point rouge pulsant) ───────────────────────── */
.nav-status-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-danger);
  border: 2px solid var(--bg-primary);
  animation: pulse-dot 2s infinite;
}

/* ── Bandeau hors-ligne ──────────────────────────────────────────────── */
.nav-offline-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding: 4px 6px;
  margin: 0 6px 4px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--color-danger) 12%, transparent);
  color: var(--color-danger);
  font-size: var(--text-2xs);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  animation: offline-pulse 2s ease-in-out infinite;
}

@keyframes offline-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: .6; }
}
@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50%      { opacity: .4; }
}

/* ── Badge d'unreads sur l'icône Messages ────────────────────────────── */
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
  font-variant-numeric: tabular-nums;
  background: var(--color-danger);
  color: #fff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg-rail);
  line-height: 1;
  box-shadow: 0 2px 6px color-mix(in srgb, var(--color-danger) 40%, transparent);
  animation: badge-pop var(--motion-base) var(--ease-spring);
}

/* Badge devoirs + autres badges : même pop d'entrée */
:deep(.nav-badge) {
  animation: badge-pop var(--motion-base) var(--ease-spring);
}

@keyframes badge-pop {
  0%   { opacity: 0; transform: scale(.3); }
  60%  { opacity: 1; transform: scale(1.15); }
  100% { opacity: 1; transform: scale(1); }
}

/* ── Badges standards ────────────────────────────────────────────────── */
.nav-badge-mention { background: var(--color-danger); }
.nav-badge-unread  { background: var(--accent); }
.nav-badge-more {
  background: var(--bg-active, rgba(255, 255, 255, .12));
  color: var(--text-secondary);
  font-weight: 700;
}

/* ── Bouton « Plus » — visuellement secondaire ───────────────────────── */
.nav-more-wrapper { position: relative; }
.nav-more-btn :deep(svg) {
  color: var(--text-muted);
  transition: color var(--motion-fast) var(--ease-out);
}
.nav-more-btn:hover :deep(svg) { color: var(--text-primary); }

/* ── Popup grille d'applications masquées (style Teams) ──────────────── */
.nav-more-popup {
  position: absolute;
  left: calc(100% + 8px);
  top: 0;
  min-width: 240px;
  max-width: 280px;
  padding: 10px 10px 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow:
    0 12px 32px rgba(0, 0, 0, .28),
    0 2px 6px rgba(0, 0, 0, .18);
  z-index: 1000;
}
.nav-more-popup-title {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: var(--text-muted);
  padding: 2px 6px 8px;
}
.nav-more-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.nav-more-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 6px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 9px;
  color: var(--text-primary);
  cursor: pointer;
  transition:
    background var(--motion-fast) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out),
    transform .12s cubic-bezier(.34, 1.56, .64, 1);
}
.nav-more-tile :deep(svg) {
  color: var(--accent);
  transition: transform var(--motion-fast) var(--ease-out);
}
.nav-more-tile:hover {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  transform: translateY(-1px);
}
.nav-more-tile:hover :deep(svg) { transform: scale(1.08); }
.nav-more-tile:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--accent);
}
.nav-more-tile-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  line-height: 1.2;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nav-more-reset {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 6px 8px;
  width: 100%;
  justify-content: center;
  background: transparent;
  border: none;
  border-top: 1px solid var(--border);
  border-radius: 0;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: color var(--motion-fast) var(--ease-out);
}
.nav-more-reset:hover { color: var(--text-primary); }
.nav-more-reset:focus-visible {
  outline: none;
  color: var(--accent);
}

/* Transition douce d'ouverture/fermeture. */
.more-popup-fade-enter-active,
.more-popup-fade-leave-active {
  transition:
    opacity var(--motion-fast) var(--ease-out),
    transform var(--motion-fast) var(--ease-out);
}
.more-popup-fade-enter-from,
.more-popup-fade-leave-to {
  opacity: 0;
  transform: translateX(-4px) scale(.98);
}

/* ── Live dot ────────────────────────────────────────────────────────── */
.nav-live-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-danger);
  border: 2px solid var(--bg-primary);
  animation: pulse-dot 2s infinite;
}

/* ── Dot "A essayer" en mode demo ────────────────────────────────────── */
/* Pulse subtil sur les onglets pas encore visites par le visiteur. Disparait
   au 1er clic via la mission auto-cochee. Couleur accent (vert) pour eviter
   la confusion avec le live-dot rouge. */
.nav-demo-dot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg-primary);
  box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 60%, transparent);
  animation: navDemoPulse 2.4s ease-in-out infinite;
  pointer-events: none;
}
@keyframes navDemoPulse {
  0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 60%, transparent); transform: scale(1); }
  50%      { box-shadow: 0 0 0 6px transparent; transform: scale(1.15); }
}

/* ── Mini progress bar (devoirs) ─────────────────────────────────────── */
.nav-progress {
  width: 28px;
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, .08);
  overflow: hidden;
  margin-top: 2px;
}
.nav-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--color-success);
  transition: width var(--motion-slow) var(--ease-out);
  min-width: 1px;
}

/* ── Drag & drop ─────────────────────────────────────────────────────── */
.nav-btn              { cursor: grab; }
.nav-btn:active       { cursor: grabbing; }
.nav-btn--dragging {
  opacity: .5;
  transform: scale(.95);
  transition: opacity   var(--motion-fast) var(--ease-out),
              transform var(--motion-fast) var(--ease-out);
}
.nav-btn--drop-target::after {
  content: '';
  position: absolute;
  left: 4px;
  right: 4px;
  top: -3px;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
  box-shadow: 0 0 8px rgba(var(--accent-rgb), .6);
}

/* ── Micro-interaction icône : subtle lift au hover ──────────────────── */
.nav-btn :deep(svg) {
  transition: transform var(--motion-fast) var(--ease-spring),
              filter    var(--motion-base) var(--ease-out);
}
.nav-btn:hover :deep(svg) {
  transform: translateY(-1px);
}

/* Active icon : halo accent subtil pour feel "lit" */
.nav-btn.active :deep(svg) {
  filter: drop-shadow(0 0 6px rgba(var(--accent-rgb), .45));
}

/* ── Séparateur de groupes (main nav / utilitaires) ──────────────────── */
.nav-group-divider {
  width: 28px;
  height: 1px;
  margin: var(--space-xs) 0;
  background: linear-gradient(90deg,
    transparent,
    color-mix(in srgb, var(--text-muted) 35%, transparent),
    transparent);
  align-self: center;
  flex-shrink: 0;
}

/* ── Transition panneau de notifications ─────────────────────────────── */
.notif-panel-fade-enter-active {
  transition: opacity   var(--motion-fast) var(--ease-out),
              transform var(--motion-fast) var(--ease-out);
}
.notif-panel-fade-leave-active {
  transition: opacity   var(--motion-fast) var(--ease-in),
              transform var(--motion-fast) var(--ease-in);
}
.notif-panel-fade-enter-from,
.notif-panel-fade-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}

.nav-notif-wrapper {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.nav-spacer { flex: 1; }

/* ── Avatar (bas de rail) ────────────────────────────────────────────── */
.nav-avatar-btn {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: var(--radius);
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
  margin: var(--space-xs) 0 6px;
  cursor: pointer;
  flex-shrink: 0;
  -webkit-app-region: no-drag;
  transition: box-shadow   var(--motion-fast) var(--ease-out),
              border-radius var(--motion-fast) var(--ease-out);
}
.nav-avatar-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: transparent;
  transition: background var(--motion-fast) var(--ease-out);
}
.nav-avatar-btn:hover::after   { background: var(--bg-active); }
.nav-avatar-btn:hover {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--text-primary) 25%, transparent);
  border-radius: 12px;
}
.nav-avatar-btn:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.nav-avatar-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.nav-avatar-flame {
  color: #fff;
  opacity: .95;
}

/* ── Statut personnel (emoji sur l'avatar) ───────────────────────────── */
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
  box-shadow: var(--elevation-2);
  animation: nav-avatar-status-in var(--motion-base) var(--ease-spring);
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
}
@keyframes nav-avatar-status-in {
  from { opacity: 0; transform: scale(.4); }
  to   { opacity: 1; transform: scale(1);  }
}

/* ── Admin : accent sur l'icône ──────────────────────────────────────── */
.nav-admin-btn :deep(svg) { color: var(--accent); }

/* ── Reduced motion ──────────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .nav-logo-btn,
  .nav-logo-img,
  .nav-btn :deep(svg),
  .nav-btn--dragging,
  .nav-avatar-btn,
  .nav-avatar-btn::after,
  .nav-more-btn :deep(svg),
  .nav-progress-fill,
  .notif-panel-fade-enter-active,
  .notif-panel-fade-leave-active {
    transition: none !important;
  }
  .nav-btn:hover :deep(svg) { transform: none !important; }
  .nav-logo-btn:hover .nav-logo-img { transform: none !important; }
  .nav-status-dot,
  .nav-live-dot,
  .nav-demo-dot,
  .nav-offline-banner,
  .nav-avatar-status,
  .nav-msg-badge,
  :deep(.nav-badge) {
    animation: none !important;
  }
}
</style>
