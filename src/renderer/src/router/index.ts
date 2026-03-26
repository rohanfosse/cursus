import { createRouter, createWebHashHistory } from 'vue-router'
import MessagesView   from '@/views/MessagesView.vue'
import DevoirsView    from '@/views/DevoirsView.vue'
import DocumentsView  from '@/views/DocumentsView.vue'
import DashboardView  from '@/views/DashboardView.vue'

// HashHistory évite les problèmes de routing dans Electron
// (pas de serveur HTTP, les URLs en file:// ne supportent pas l'history API)
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/',           redirect: '/dashboard' },
    { path: '/dashboard',  component: DashboardView,  name: 'dashboard'  },
    { path: '/messages',   component: MessagesView,   name: 'messages'   },
    { path: '/devoirs',    component: DevoirsView,    name: 'devoirs'    },
    { path: '/travaux',    redirect: '/devoirs' },
    { path: '/documents',  component: DocumentsView,  name: 'documents'  },
    { path: '/live',       component: () => import('@/views/LiveView.vue'),   name: 'live'   },
    { path: '/rex',        component: () => import('@/views/RexView.vue'),   name: 'rex'    },
    { path: '/agenda',     component: () => import('@/views/AgendaView.vue'), name: 'agenda' },
    { path: '/fichiers',   component: () => import('@/views/FilesView.vue'),  name: 'fichiers', meta: { requiresTeacher: true } },
    // Catch-all → redirect au dashboard
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})

// ── Route guard : pages réservées aux enseignants ───────────────────────────
router.beforeEach((to, _from, next) => {
  if (to.meta?.requiresTeacher) {
    // Vérifier le rôle depuis localStorage (le store Pinia peut ne pas être prêt)
    try {
      const raw = localStorage.getItem('cc_session')
      if (raw) {
        const user = JSON.parse(raw)
        if (user?.type === 'student') {
          return next('/dashboard')
        }
      }
    } catch { /* session corrompue */ }
  }
  next()
})

export default router
