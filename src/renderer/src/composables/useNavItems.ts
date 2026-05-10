/**
 * useNavItems - source de verite unique pour les destinations de navigation.
 *
 * Avant cet extract, NavRail (desktop) et MobileAppsSheet (mobile) avaient
 * chacun leur propre liste : 11 items dans NavRail, 8 dans la sheet, avec
 * des regles `isVisible()` pratiquement identiques mais re-ecrites a la
 * main des deux cotes. Risque de drift : ajouter "Booking RDV" dans l'un
 * et oublier l'autre, ou diverger sur la regle de role/module.
 *
 * Ce composable reactive expose la liste maitre. Chaque consommateur la
 * filtre/reordonne selon ses besoins :
 *  - NavRail consomme tout sauf ce que l'utilisateur a manuellement masque
 *  - MobileAppsSheet consomme uniquement les items secondaires (hors barre
 *    du bas mobile) et y prepend Notifications
 */
import { computed, type Component, type ComputedRef } from 'vue'
import {
  LayoutDashboard, MessageSquare, Bookmark, BookOpen, Lightbulb,
  FileText, Paperclip, Calendar, CalendarCheck, Zap, Gamepad2, Shield,
} from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useModules } from '@/composables/useModules'

export type NavItemId =
  | 'dashboard' | 'messages' | 'signets' | 'devoirs' | 'lumen'
  | 'documents' | 'fichiers' | 'agenda'  | 'booking' | 'live' | 'jeux'
  | 'admin'

export interface NavItemSpec {
  readonly id: NavItemId
  readonly label: string
  /** Tooltip desktop. Plus descriptif que `label`. Optionnel : fallback `label`. */
  readonly title?: string
  readonly icon: Component
  /** Nom de route Vue Router. Defaut : meme que `id`. */
  readonly routeName?: string
  /** Routes qui mettent l'item dans l'etat actif. Defaut : `[routeName ?? id]`. */
  readonly activeRoutes?: readonly string[]
}

export interface ResolvedNavItem extends NavItemSpec {
  /** Calcule en fonction du role / module / mode demo. */
  readonly visible: boolean
}

/** IDs des items qui apparaissent dans la barre du bas mobile (MobileNav).
 *  La sheet "Plus" les exclut pour eviter les doublons. */
export const MOBILE_BAR_IDS: readonly NavItemId[] = ['dashboard', 'messages', 'devoirs', 'agenda']

export function useNavItems(): {
  items: ComputedRef<readonly ResolvedNavItem[]>
  itemById: ComputedRef<Record<NavItemId, ResolvedNavItem | undefined>>
} {
  const appStore = useAppStore()
  const { isEnabled } = useModules()

  const isDemo        = (): boolean => appStore.currentUser?.demo === true
  const isDemoTeacher = (): boolean => isDemo() && appStore.isTeacher

  // Audit UX : on masque les onglets accessoires en mode demo pour que
  // les features vedette ressortent en 30 s. Le commentaire detaillé est
  // dans NavRail.vue (audit demo) — preserve ici a haut niveau.
  const items = computed<readonly ResolvedNavItem[]>(() => [
    { id: 'dashboard', label: 'Accueil',       title: 'Tableau de bord',                                  icon: LayoutDashboard, visible: true },
    { id: 'messages',  label: 'Messages',      title: 'Messages',                                         icon: MessageSquare,   visible: true },
    { id: 'signets',   label: 'Signets',       title: 'Signets (messages sauvegardes)',                   icon: Bookmark,        visible: !isDemo() },
    { id: 'devoirs',   label: 'Devoirs',       title: 'Devoirs',                                          icon: BookOpen,        visible: true },
    { id: 'lumen',     label: 'Cours',         title: 'Cours',                                            icon: Lightbulb,       visible: isEnabled('lumen') },
    { id: 'documents', label: 'Documents',     title: 'Documents',                                        icon: FileText,        visible: appStore.isStaff },
    { id: 'fichiers',  label: 'Fichiers',      title: 'Fichiers partages par les etudiants',             icon: Paperclip,       visible: appStore.isTeacher && !isDemoTeacher() },
    { id: 'agenda',    label: 'Calendrier',    title: 'Calendrier',                                       icon: Calendar,        visible: !isDemo() },
    { id: 'booking',   label: 'RDV',           title: 'Rendez-vous (mini-Calendly + campagnes)',          icon: CalendarCheck,   visible: appStore.isTeacher },
    { id: 'live',      label: 'Live',          title: 'Live (quiz, feedback, code, tableau)',             icon: Zap,             visible: isEnabled('live') },
    { id: 'jeux',      label: 'Jeux',          title: 'Jeux (TypeRace, Snake, Space Invaders, ...)',      icon: Gamepad2,        visible: (appStore.isTeacher || isEnabled('games')) && !isDemoTeacher(), activeRoutes: ['jeux', 'typerace', 'snake', 'space-invaders'] },
    { id: 'admin',     label: 'Administration', title: 'Administration',                                  icon: Shield,          visible: appStore.isAdmin },
  ])

  const itemById = computed(() =>
    Object.fromEntries(items.value.map(i => [i.id, i])) as Record<NavItemId, ResolvedNavItem | undefined>,
  )

  return { items, itemById }
}
