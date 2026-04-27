import { createRouter, createWebHashHistory } from 'vue-router'
import { hasRole, type Role } from '@/utils/permissions'
import { useModules, type ModuleName } from '@/composables/useModules'

// ── RouteMeta augmentation ──────────────────────────────────────────────────
declare module 'vue-router' {
  interface RouteMeta {
    requiredRole?: Role
    requiredModule?: ModuleName
    public?: boolean
  }
}

// Lazy-load toutes les vues pour reduire le bundle initial
const DashboardView = () => import('@/views/DashboardView.vue')
const MessagesView  = () => import('@/views/MessagesView.vue')
const DevoirsView   = () => import('@/views/DevoirsView.vue')
const DocumentsView = () => import('@/views/DocumentsView.vue')

// HashHistory evite les problemes de routing dans Electron
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/',           redirect: '/dashboard' },
    { path: '/dashboard',  component: DashboardView,  name: 'dashboard'  },
    { path: '/messages',   component: MessagesView,   name: 'messages'   },
    { path: '/devoirs',    component: DevoirsView,    name: 'devoirs'    },
    { path: '/travaux',    redirect: '/devoirs' },
    { path: '/documents',  component: DocumentsView,  name: 'documents'  },
    { path: '/live',       component: () => import('@/views/LiveView.vue'),   name: 'live',   meta: { requiredModule: 'live' }  },
    { path: '/lumen',      component: () => import('@/views/LumenView.vue'), name: 'lumen',  meta: { requiredModule: 'lumen' } },
    { path: '/agenda',     component: () => import('@/views/AgendaView.vue'), name: 'agenda' },
    { path: '/jeux',           component: () => import('@/views/GamesView.vue'),          name: 'jeux',           meta: { requiredModule: 'games' } },
    { path: '/typerace',       component: () => import('@/views/TypeRaceView.vue'),       name: 'typerace',       meta: { requiredModule: 'games' } },
    { path: '/snake',          component: () => import('@/views/SnakeView.vue'),          name: 'snake',          meta: { requiredModule: 'games' } },
    { path: '/space-invaders', component: () => import('@/views/SpaceInvadersView.vue'),  name: 'space-invaders', meta: { requiredModule: 'games' } },
    { path: '/fichiers',   component: () => import('@/views/FilesView.vue'),  name: 'fichiers', meta: { requiredRole: 'teacher' } },
    { path: '/signets',    component: () => import('@/views/BookmarksView.vue'), name: 'signets' },
    { path: '/admin',      component: () => import('@/views/AdminView.vue'),    name: 'admin', meta: { requiredRole: 'admin' } },
    // Public booking pages (no auth required)
    { path: '/book/c/:token',        component: () => import('@/views/BookingCampaignView.vue'),    name: 'booking-campaign',     meta: { public: true } },
    { path: '/book/e/:slug',         component: () => import('@/views/BookingPublicEventView.vue'), name: 'booking-public-event', meta: { public: true } },
    { path: '/book/:token',          component: () => import('@/views/BookingPublicView.vue'),     name: 'booking-public',       meta: { public: true } },
    { path: '/book/cancel/:token',   component: () => import('@/views/BookingCancelView.vue'),     name: 'booking-cancel',       meta: { public: true } },
    // Catch-all → redirect au dashboard
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})

// ── Route guard : role + module ──────────────────────────────────────────────
const { isEnabled, loadModules } = useModules()

/**
 * Modules opt-in : le prof peut toujours y acceder (preview / admin)
 * meme quand le module est desactive pour les etudiants. Les autres
 * modules (lumen, live, kanban...) gardent la regle stricte : si l'admin
 * coupe, plus personne n'y accede.
 */
const TEACHER_BYPASS_MODULES = new Set<string>(['games'])

router.beforeEach(async (to, _from, next) => {
  let role: Role = 'student'
  try {
    const raw = localStorage.getItem('cc_session')
    if (raw) role = JSON.parse(raw).type || 'student'
  } catch { /* session corrompue */ }

  if (to.meta.requiredRole && !hasRole(role, to.meta.requiredRole)) {
    return next('/dashboard')
  }

  if (to.meta.requiredModule) {
    const isTeacher = hasRole(role, 'teacher')
    const bypass = isTeacher && TEACHER_BYPASS_MODULES.has(to.meta.requiredModule)
    if (!bypass) {
      await loadModules()
      if (!isEnabled(to.meta.requiredModule)) {
        return next('/dashboard')
      }
    }
  }
  next()
})

export default router
