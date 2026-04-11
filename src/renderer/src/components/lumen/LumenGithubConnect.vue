<script setup lang="ts">
/**
 * Ecran de connexion GitHub pour Lumen.
 * Demande un Personal Access Token a l'utilisateur (eleve ou prof),
 * le valide cote backend, et met a jour le store githubStatus.
 *
 * Dans l'UX v1 : pas d'OAuth device flow — juste un collage de PAT avec
 * un lien guide vers github.com/settings/tokens.
 */
import { ref } from 'vue'
import { Github, KeyRound, ExternalLink } from 'lucide-vue-next'
import { useLumenStore } from '@/stores/lumen'
import { useToast } from '@/composables/useToast'

const lumenStore = useLumenStore()
const { showToast } = useToast()

const token = ref('')
const submitting = ref(false)
const errorMsg = ref<string | null>(null)

async function handleConnect() {
  if (!token.value.trim()) {
    errorMsg.value = 'Colle ton token GitHub'
    return
  }
  errorMsg.value = null
  submitting.value = true
  try {
    const res = await lumenStore.connectGithub(token.value.trim())
    if (res.ok) {
      showToast('Compte GitHub connecte', 'success')
      token.value = ''
    } else {
      errorMsg.value = res.error ?? 'Echec de la connexion'
    }
  } finally {
    submitting.value = false
  }
}

function openTokenPage() {
  window.open('https://github.com/settings/tokens/new?scopes=repo,read:org&description=Cursus+Lumen', '_blank')
}
</script>

<template>
  <div class="lumen-connect">
    <div class="lumen-connect-card">
      <div class="lumen-connect-icon">
        <Github :size="40" />
      </div>
      <h2>Connecte ton compte GitHub</h2>
      <p class="lumen-connect-intro">
        Lumen lit tes cours depuis les repos GitHub de ta promo. Tu dois connecter ton compte
        une seule fois, avec un Personal Access Token (PAT).
      </p>

      <button class="lumen-connect-link" type="button" @click="openTokenPage">
        <ExternalLink :size="14" />
        Generer un token sur GitHub
      </button>

      <p class="lumen-connect-hint">
        Coche les scopes <code>repo</code> et <code>read:org</code>, puis copie le token genere.
      </p>

      <div class="lumen-connect-input">
        <KeyRound :size="16" />
        <input
          v-model="token"
          type="password"
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          autocomplete="off"
          spellcheck="false"
          @keydown.enter="handleConnect"
        />
      </div>

      <p v-if="errorMsg" class="lumen-connect-error">{{ errorMsg }}</p>

      <button
        class="lumen-connect-submit"
        type="button"
        :disabled="submitting || !token.trim()"
        @click="handleConnect"
      >
        {{ submitting ? 'Connexion...' : 'Se connecter a GitHub' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.lumen-connect {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 48px 24px;
  background: var(--bg-primary);
}

.lumen-connect-card {
  width: 100%;
  max-width: 480px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 40px 32px;
  text-align: center;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

.lumen-connect-icon {
  display: flex;
  justify-content: center;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.lumen-connect-card h2 {
  margin: 0 0 12px;
  font-size: 22px;
  color: var(--text-primary);
}

.lumen-connect-intro {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0 0 24px;
}

.lumen-connect-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid var(--border);
  color: var(--accent);
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: var(--text-sm);
  font-weight: 500;
  transition: background var(--t-fast) ease;
}
.lumen-connect-link:hover { background: var(--bg-hover); }

.lumen-connect-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 12px 0 20px;
}
.lumen-connect-hint code {
  background: var(--bg-primary);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 11px;
  font-family: var(--font-mono);
}

.lumen-connect-input {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  color: var(--text-muted);
}
.lumen-connect-input input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
}

.lumen-connect-error {
  color: var(--danger);
  font-size: var(--text-sm);
  margin: 0 0 12px;
}

.lumen-connect-submit {
  width: 100%;
  padding: 12px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: var(--text-base);
  font-weight: 600;
  transition: opacity var(--t-fast) ease;
}
.lumen-connect-submit:hover:not(:disabled) { opacity: 0.9; }
.lumen-connect-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
