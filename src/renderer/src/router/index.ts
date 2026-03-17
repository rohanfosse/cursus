import { createRouter, createWebHashHistory } from 'vue-router'
import MessagesView  from '@/views/MessagesView.vue'
import DevoirsView   from '@/views/DevoirsView.vue'
import DocumentsView from '@/views/DocumentsView.vue'

// HashHistory évite les problèmes de routing dans Electron
// (pas de serveur HTTP, les URLs en file:// ne supportent pas l'history API)
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/',          redirect: '/messages' },
    { path: '/messages',  component: MessagesView,  name: 'messages'  },
    { path: '/devoirs',   component: DevoirsView,   name: 'devoirs'   },
    { path: '/travaux',   redirect: '/devoirs' },
    { path: '/documents', component: DocumentsView, name: 'documents' },
  ],
})

export default router
