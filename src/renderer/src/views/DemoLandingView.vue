<script setup lang="ts">
/**
 * DemoLandingView - ecran d'entree du mode demo.
 *
 * Affiche un choix prof / etudiant. Au clic :
 *  1. POST /api/demo/start { role }
 *  2. Stocke le token (prefixe `demo-`) via window.api.setToken
 *  3. Hydrate le store avec le `currentUser` retourne (incluant demo: true)
 *  4. router.replace('/dashboard')
 *
 * Si une session demo existe deja (token demo- dans localStorage), on la
 * reutilise et on saute directement vers le dashboard.
 */
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useToast } from '@/composables/useToast'
import { GraduationCap, UserCog, ArrowRight, Info } from 'lucide-vue-next'
import logoUrl from '@/assets/logo.png'

const router = useRouter()
const appStore = useAppStore()
const { showToast } = useToast()

const submitting = ref<'student' | 'teacher' | null>(null)
const errorMsg = ref('')

async function startDemo(role: 'student' | 'teacher') {
  if (submitting.value) return
  submitting.value = role
  errorMsg.value = ''
  try {
    // Appel direct /api/demo/start (pas via window.api : la session demo
    // n'est pas encore cree, donc pas encore de token a poser).
    const serverUrl = (import.meta.env.VITE_SERVER_URL as string)
      || (import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin)
    const res = await fetch(`${serverUrl}/api/demo/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    const json = await res.json() as {
      ok: boolean
      data?: { token: string; currentUser: import('@/types').User }
      error?: string
    }
    if (!json.ok || !json.data) {
      errorMsg.value = json.error || 'Impossible de demarrer la demo.'
      submitting.value = null
      return
    }
    // Pose le token + hydrate le store comme un login normal.
    window.api.setToken?.(json.data.token)
    appStore.login(json.data.currentUser)
    showToast('Demo demarree. Bonne exploration !', 'success')
    router.replace('/dashboard')
  } catch (err) {
    errorMsg.value = (err as Error).message || 'Erreur reseau.'
    submitting.value = null
  }
}

onMounted(() => {
  // Si l'utilisateur est deja loggue (demo ou non), on le redirige direct.
  if (appStore.currentUser) {
    router.replace('/dashboard')
  }
})
</script>

<template>
  <div class="demo-landing">
    <div class="demo-card">
      <img :src="logoUrl" class="demo-logo" alt="Cursus" />
      <h1 class="demo-title">Tester Cursus en demonstration</h1>
      <p class="demo-subtitle">
        Aucune inscription. Donnees fictives, regenerees apres 24h.<br />
        Choisis ton point de vue pour explorer l'app.
      </p>

      <div class="demo-roles">
        <button
          type="button"
          class="demo-role"
          :class="{ 'demo-role--loading': submitting === 'student' }"
          :disabled="submitting !== null"
          @click="startDemo('student')"
        >
          <div class="demo-role-icon demo-role-icon--student">
            <GraduationCap :size="28" />
          </div>
          <div class="demo-role-body">
            <span class="demo-role-title">Etudiant</span>
            <span class="demo-role-desc">
              Vois les devoirs, discute dans les canaux, ouvre Lumen pour lire un cours.
            </span>
          </div>
          <ArrowRight :size="18" class="demo-role-arrow" />
        </button>

        <button
          type="button"
          class="demo-role"
          :class="{ 'demo-role--loading': submitting === 'teacher' }"
          :disabled="submitting !== null"
          @click="startDemo('teacher')"
        >
          <div class="demo-role-icon demo-role-icon--teacher">
            <UserCog :size="28" />
          </div>
          <div class="demo-role-body">
            <span class="demo-role-title">Enseignant</span>
            <span class="demo-role-desc">
              Cree un devoir, envoie un message a la promo, gere les ressources et le dashboard.
            </span>
          </div>
          <ArrowRight :size="18" class="demo-role-arrow" />
        </button>
      </div>

      <Transition name="err-pop">
        <div v-if="errorMsg" class="demo-error">{{ errorMsg }}</div>
      </Transition>

      <div class="demo-info">
        <Info :size="13" />
        <span>
          Tes donnees demo sont isolees des autres visiteurs et seront effacees automatiquement.
          A tout moment, tu peux <a href="https://app.cursus.school/login">creer un compte</a> pour conserver tes donnees.
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-landing {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--accent) 8%, var(--bg-main)) 0%,
    var(--bg-main) 60%
  );
}

.demo-card {
  width: 100%;
  max-width: 560px;
  padding: var(--space-xl) var(--space-xl) var(--space-lg);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2);
  text-align: center;
}

.demo-logo {
  width: 56px;
  height: 56px;
  margin: 0 auto var(--space-md);
  border-radius: 14px;
}

.demo-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 6px;
  letter-spacing: -0.4px;
}

.demo-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: var(--space-lg);
}

.demo-roles {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.demo-role {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-main);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  color: var(--text-primary);
  transition:
    border-color var(--motion-fast) var(--ease-out),
    background var(--motion-fast) var(--ease-out),
    transform var(--motion-fast) var(--ease-spring);
}
.demo-role:hover:not(:disabled) {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 5%, var(--bg-main));
  transform: translateY(-1px);
}
.demo-role:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.demo-role:disabled {
  opacity: .55;
  cursor: not-allowed;
}
.demo-role--loading {
  border-color: var(--accent);
}

.demo-role-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  flex-shrink: 0;
}
.demo-role-icon--student {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}
.demo-role-icon--teacher {
  background: color-mix(in srgb, var(--color-cctl) 14%, transparent);
  color: var(--color-cctl);
}

.demo-role-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}
.demo-role-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}
.demo-role-desc {
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.4;
}
.demo-role-arrow {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: transform var(--motion-fast) var(--ease-out), color var(--motion-fast) var(--ease-out);
}
.demo-role:hover:not(:disabled) .demo-role-arrow {
  color: var(--accent);
  transform: translateX(3px);
}

.demo-error {
  margin-bottom: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-danger) 40%, transparent);
  border-radius: var(--radius-sm);
  color: var(--color-danger);
  font-size: 12.5px;
  font-weight: 500;
}

.demo-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding-top: var(--space-md);
  border-top: 1px solid var(--border);
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.5;
  text-align: left;
}
.demo-info svg { flex-shrink: 0; margin-top: 2px; color: var(--accent); }
.demo-info a { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
.demo-info a:hover { color: var(--text-primary); }

.err-pop-enter-active { transition: opacity var(--motion-fast) var(--ease-out); }
.err-pop-leave-active { transition: opacity var(--motion-fast) var(--ease-out); }
.err-pop-enter-from, .err-pop-leave-to { opacity: 0; }
</style>
