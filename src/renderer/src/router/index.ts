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
    { path: '/typerace',   component: () => import('@/views/TypeRaceView.vue'), name: 'typerace' },
    { path: '/fichiers',   component: () => import('@/views/FilesView.vue'),  name: 'fichiers', meta: { requiredRole: 'teacher' } },
    // Public booking pages (no auth required)
    { path: '/book/:token',          component: () => import('@/views/BookingPublicView.vue'),  name: 'booking-public', meta: { public: true } },
    { path: '/book/cancel/:token',   component: () => import('@/views/BookingCancelView.vue'),  name: 'booking-cancel', meta: { public: true } },
    // Catch-all → redirect au dashboard
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})

// ── Route guard : role + module ──────────────────────────────────────────────
const { isEnabled, loadModules } = useModules()

router.beforeEach(async (to, _from, next) => {
  if (to.meta.requiredRole) {
    try {
      const raw = localStorage.getItem('cc_session')
      const role = raw ? (JSON.parse(raw).type || 'student') : 'student'
      if (!hasRole(role, to.meta.requiredRole)) {
        return next('/dashboard')
      }
    } catch { /* session corrompue */ }
  }
  if (to.meta.requiredModule) {
    await loadModules()
    if (!isEnabled(to.meta.requiredModule)) {
      return next('/dashboard')
    }
  }
  next()
})

export default router
