import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// ── CSS de base ─────────────────────────────────────────────────────────────
import '@css/base.css'
import '@css/layout.css'
import '@css/components.css'
import 'highlight.js/styles/atom-one-dark.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')
