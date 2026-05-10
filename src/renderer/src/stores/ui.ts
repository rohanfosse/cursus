/**
 * useUiStore - etat UI global (sidebar drawer, sidebar collapsed).
 *
 * Avant cet extract, App.vue exposait `sidebarOpen` + `toggleSidebar` et
 * les passait en prop a 14 vues qui les transferaient elles-memes a leurs
 * sous-composants (MobileMenuButton, headers de page). Le prop drilling
 * etait fragile : un nouvel ecran qui oubliait de declarer la prop ou de
 * la transmettre se retrouvait sans hamburger en mobile, sans erreur visible.
 *
 * Centraliser dans un store Pinia permet a n'importe quel composant
 * d'acceder a l'etat sans plombing intermediaire. La prop `toggleSidebar`
 * est conservee comme back-compat sur certaines vues le temps de la
 * migration, puis supprimee.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed'

export const useUiStore = defineStore('ui', () => {
  /** Drawer sidebar mobile : ouvert quand l'utilisateur tape le hamburger
   *  ou swipe depuis le bord gauche. Pas de persistance — fermee par defaut
   *  a chaque chargement. */
  const sidebarOpen = ref(false)

  /** Sidebar collapsed (desktop) : etat persiste localStorage car
   *  l'utilisateur s'attend a retrouver son layout. */
  const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1')

  function toggleSidebar(): void {
    sidebarOpen.value = !sidebarOpen.value
  }

  function closeSidebar(): void {
    sidebarOpen.value = false
  }

  function openSidebar(): void {
    sidebarOpen.value = true
  }

  function toggleSidebarCollapsed(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed.value ? '1' : '0')
    } catch {
      /* quota / private mode : non bloquant */
    }
  }

  return {
    sidebarOpen,
    sidebarCollapsed,
    toggleSidebar,
    closeSidebar,
    openSidebar,
    toggleSidebarCollapsed,
  }
})
