<script setup lang="ts">
/**
 * Ecran de connexion GitHub pour Lumen (v2.87).
 * Guide pas-a-pas pour l'etudiant : explication simple de pourquoi
 * GitHub est necessaire, lien direct vers la page de creation de token
 * pre-rempli, et instructions claires etape par etape.
 */
import { ref, computed } from 'vue'
import { Github, KeyRound, ExternalLink, BookOpen, Loader2, AlertCircle, ChevronRight } from 'lucide-vue-next'
import { useLumenStore } from '@/stores/lumen'
import { useToast } from '@/composables/useToast'

const lumenStore = useLumenStore()
const { showToast } = useToast()

const token = ref('')
const submitting = ref(false)
const errorMsg = ref<string | null>(null)

const userFriendlyError = computed(() => {
  if (!errorMsg.value) return null
  const e = errorMsg.value.toLowerCase()
  if (e.includes('401') || e.includes('invalid') || e.includes('bad credentials'))
    return 'Token invalide. Verifie que tu as bien copie le token en entier.'
  if (e.includes('rate limit'))
    return 'GitHub est temporairement indisponible. Reessaie dans quelques minutes.'
  if (e.includes('network') || e.includes('fetch') || e.includes('econnrefused'))
    return 'Impossible de joindre GitHub. Verifie ta connexion internet.'
  return errorMsg.value
})

async function handleConnect() {
  if (!token.value.trim()) {
    errorMsg.value = 'Colle ton token GitHub dans le champ ci-dessus.'
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
      <!-- Pourquoi ? -->
      <div class="lumen-connect-why">
        <BookOpen :size="20" />
        <p>
          Tes cours sont heberges sur <strong>GitHub</strong>.
          Pour y acceder depuis Lumen, connecte ton compte une seule fois.
        </p>
      </div>

      <h2>Connexion a GitHub</h2>

      <!-- Etapes numerotees -->
      <ol class="lumen-connect-steps">
        <li>
          <span class="step-num">1</span>
          <div class="step-content">
            <p>Clique sur le bouton ci-dessous pour ouvrir GitHub :</p>
            <button class="lumen-connect-link" type="button" @click="openTokenPage">
              <ExternalLink :size="14" />
              Creer ma cle d'acces
            </button>
          </div>
        </li>
        <li>
          <span class="step-num">2</span>
          <div class="step-content">
            <p>
              Sur la page GitHub, <strong>ne change rien</strong> et clique
              sur le bouton vert <strong>"Generate token"</strong> tout en bas.
            </p>
          </div>
        </li>
        <li>
          <span class="step-num">3</span>
          <div class="step-content">
            <p>Copie le code qui s'affiche (il commence par <code>ghp_</code>) et colle-le ici :</p>
            <div class="lumen-connect-input">
              <KeyRound :size="16" />
              <input
                v-model="token"
                type="password"
                placeholder="ghp_..."
                autocomplete="off"
                spellcheck="false"
                aria-label="Cle d'acces GitHub"
                @keydown.enter="handleConnect"
              />
            </div>
          </div>
        </li>
      </ol>

      <!-- Erreur -->
      <div v-if="userFriendlyError" class="lumen-connect-error" role="alert">
        <AlertCircle :size="14" />
        <span>{{ userFriendlyError }}</span>
      </div>

      <!-- Submit -->
      <button
        class="lumen-connect-submit"
        type="button"
        :disabled="submitting || !token.trim()"
        :aria-busy="submitting"
        @click="handleConnect"
      >
        <Loader2 v-if="submitting" :size="16" class="spin" />
        <ChevronRight v-else :size="16" />
        {{ submitting ? 'Connexion en cours...' : 'Se connecter' }}
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
  max-width: 520px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 36px 32px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}

/* Encart "Pourquoi ?" */
.lumen-connect-why {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 20%, transparent);
  margin-bottom: 24px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.5;
}
@supports not (color: color-mix(in srgb, white, black)) {
  .lumen-connect-why {
    background: var(--bg-hover);
    border-color: var(--border);
  }
}
.lumen-connect-why svg { flex-shrink: 0; color: var(--accent); margin-top: 1px; }
.lumen-connect-why p { margin: 0; }
.lumen-connect-why strong { color: var(--text-primary); }

.lumen-connect-card h2 {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

/* Etapes numerotees */
.lumen-connect-steps {
  list-style: none;
  margin: 0 0 20px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.lumen-connect-steps li {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.step-num {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  font-size: 13px;
  font-weight: 700;
}
.step-content {
  flex: 1;
  min-width: 0;
}
.step-content p {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.5;
}
.step-content strong { color: var(--text-primary); }
.step-content code {
  background: var(--bg-primary);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--accent);
}

/* Bouton generer token */
.lumen-connect-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: 1px solid var(--accent);
  color: var(--accent);
  padding: 8px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background var(--t-fast) ease;
}
.lumen-connect-link:hover {
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
@supports not (color: color-mix(in srgb, white, black)) {
  .lumen-connect-link:hover { background: var(--bg-hover); }
}

/* Input token */
.lumen-connect-input {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  color: var(--text-muted);
  transition: border-color var(--t-fast) ease;
}
.lumen-connect-input:focus-within {
  border-color: var(--accent);
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

/* Erreur */
.lumen-connect-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--danger) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 20%, transparent);
  color: var(--danger);
  font-size: 13px;
  line-height: 1.4;
  margin-bottom: 16px;
}
@supports not (color: color-mix(in srgb, white, black)) {
  .lumen-connect-error { background: var(--bg-hover); border-color: var(--danger); }
}
.lumen-connect-error svg { flex-shrink: 0; margin-top: 1px; }

/* Submit */
.lumen-connect-submit {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: opacity var(--t-fast) ease;
}
.lumen-connect-submit:hover:not(:disabled) { opacity: 0.9; }
.lumen-connect-submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
