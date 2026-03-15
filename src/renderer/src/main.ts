import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// ── CSS existant (répertoire renderer/css/ gardé en place) ──────────────────
import '@css/base.css'
import '@css/layout.css'
import '@css/components.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')
