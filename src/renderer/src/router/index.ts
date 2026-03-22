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
    { path: '/live',       component: () => import('@/views/LiveView.vue'), name: 'live' },
    { path: '/rex',        component: () => import('@/views/RexView.vue'),  name: 'rex'  },
  ],
})

export default router
