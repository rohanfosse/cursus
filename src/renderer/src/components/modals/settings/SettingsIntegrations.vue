/** SettingsIntegrations — services externes connectables (Microsoft 365, GitHub, iCal). */
<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import {
  Plug, Check, X, Globe, ExternalLink, Info, Github, KeyRound,
  Calendar, Copy, RotateCw, Download, AlertCircle,
} from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useMicrosoftConnection } from '@/composables/useMicrosoftConnection'
import { useGithubConnection }    from '@/composables/useGithubConnection'
import { useCalendarFeed }        from '@/composables/useCalendarFeed'

const appStore = useAppStore()

// ── Microsoft 365 ────────────────────────────────────────────────────────────
const ms = useMicrosoftConnection()
const expiresText = computed(() => {
  if (!ms.expiresAt.value) return null
  const d = new Date(ms.expiresAt.value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
})

// ── GitHub ───────────────────────────────────────────────────────────────────
const gh = useGithubConnection()
const ghTokenInput = ref('')
const ghSubmitting = ref(false)
const ghError = ref<string | null>(null)

const ghUserFriendlyError = computed(() => {
  if (!ghError.value) return null
  const e = ghError.value.toLowerCase()
  if (e.includes('401') || e.includes('invalid') || e.includes('bad credentials'))
    return 'Token invalide. Verifie que tu l\'as colle en entier.'
  if (e.includes('rate limit'))
    return 'GitHub est temporairement indisponible. Reessaie dans quelques minutes.'
  if (e.includes('network') || e.includes('fetch'))
    return 'Impossible de joindre GitHub. Verifie ta connexion.'
  return ghError.value
})

async function handleGhConnect() {
  ghError.value = null
  ghSubmitting.value = true
  try {
    const res = await gh.connect(ghTokenInput.value)
    if (res.ok) {
      ghTokenInput.value = ''
    } else {
      ghError.value = res.error ?? 'Echec de la connexion'
    }
  } finally {
    ghSubmitting.value = false
  }
}

function openGhTokenPage() {
  window.api.openExternal?.('https://github.com/settings/tokens/new?scopes=repo,read:org&description=Cursus')
}

// ── iCal feed ────────────────────────────────────────────────────────────────
const feed = useCalendarFeed()
const feedCreatedText = computed(() => {
  if (!feed.createdAt.value) return null
  const d = new Date(feed.createdAt.value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
})

onMounted(() => {
  const tasks: Promise<void>[] = [feed.refresh()]
  if (appStore.isTeacher) {
    tasks.push(ms.refresh(), gh.refresh())
  }
  Promise.all(tasks).catch(() => { /* toasts handled in composables */ })
})
</script>

<template>
  <section class="stg-section">
    <div class="stg-section-header">
      <Plug :size="18" />
      <h3 class="stg-section-title">Integrations</h3>
    </div>

    <!-- ══════════════ iCal — tous les utilisateurs ══════════════ -->
    <div class="stg-integration-card">
      <div class="stg-integration-head">
        <div class="stg-integration-logo ical-logo">
          <Calendar :size="18" />
        </div>
        <div class="stg-integration-meta">
          <h4 class="stg-integration-title">Abonnement calendrier (iCal)</h4>
          <p class="stg-integration-desc">
            Genere une URL privee pour abonner Google Agenda, Outlook, Apple
            Calendar ou Thunderbird a tes echeances et rappels Cursus. Les
            nouveaux evenements apparaissent automatiquement (rafraichissement
            cote client toutes les 15 minutes a 1 heure selon l'app).
          </p>
        </div>
        <span
          class="stg-integration-status"
          :class="feed.url.value ? 'ok' : 'ko'"
        >
          <Check v-if="feed.url.value" :size="12" />
          <X v-else :size="12" />
          {{ feed.url.value ? 'Actif' : 'Inactif' }}
        </span>
      </div>

      <!-- Pas encore genere -->
      <div v-if="!feed.url.value" class="stg-integration-actions">
        <button
          class="btn-primary"
          :disabled="feed.loading.value"
          @click="feed.rotate()"
        >
          <Calendar :size="14" />
          {{ feed.loading.value ? 'Generation...' : 'Generer mon lien d\'abonnement' }}
        </button>
      </div>

      <!-- URL active -->
      <template v-else>
        <div class="stg-feed-url">
          <input
            :value="feed.url.value"
            readonly
            class="stg-feed-url-input"
            @click="($event.target as HTMLInputElement).select()"
          />
          <button
            class="stg-feed-btn"
            :disabled="feed.loading.value"
            title="Copier l'URL"
            @click="feed.copyUrl()"
          >
            <Copy :size="14" />
          </button>
        </div>

        <div v-if="feedCreatedText" class="stg-integration-info">
          <Info :size="12" />
          <span>Genere le {{ feedCreatedText }}</span>
        </div>

        <div class="stg-integration-actions">
          <button
            class="stg-btn stg-btn-ghost"
            :disabled="feed.loading.value"
            @click="feed.rotate()"
          >
            <RotateCw :size="14" />
            Regenerer
          </button>
          <button
            class="stg-btn stg-btn-danger"
            :disabled="feed.loading.value"
            @click="feed.revoke()"
          >
            <X :size="14" />
            Revoquer
          </button>
        </div>

        <div class="stg-feed-warning">
          <AlertCircle :size="12" />
          <span>
            Cette URL contient un secret. Ne la partage pas — regenere-la si
            tu penses qu'elle a fuite.
          </span>
        </div>
      </template>

      <details class="stg-integration-help">
        <summary>
          <ExternalLink :size="12" />
          Comment s'abonner ?
        </summary>
        <div class="stg-feed-steps">
          <div class="stg-feed-step">
            <strong>Google Agenda</strong>
            <p>Agenda -> Autres agendas -> "+" -> Depuis une URL -> colle l'URL.</p>
          </div>
          <div class="stg-feed-step">
            <strong>Outlook (Web/Desktop)</strong>
            <p>Calendrier -> Ajouter un calendrier -> S'abonner depuis le Web -> colle l'URL.</p>
          </div>
          <div class="stg-feed-step">
            <strong>Apple Calendar (macOS / iOS)</strong>
            <p>Fichier -> Nouvel abonnement a un calendrier -> colle l'URL. Sur iOS : Reglages -> Calendrier -> Comptes -> Ajouter -> Autre.</p>
          </div>
          <div class="stg-feed-step">
            <strong>Thunderbird</strong>
            <p>Calendrier -> Nouveau calendrier -> Sur le reseau -> iCalendar (ICS) -> colle l'URL.</p>
          </div>
        </div>
      </details>
    </div>

    <!-- ══════════════ GitHub — teachers only ══════════════ -->
    <template v-if="appStore.isTeacher">
      <div class="stg-integration-card">
        <div class="stg-integration-head">
          <div class="stg-integration-logo gh-logo">
            <Github :size="20" />
          </div>
          <div class="stg-integration-meta">
            <h4 class="stg-integration-title">GitHub</h4>
            <p class="stg-integration-desc">
              Necessaire pour Lumen (liseuse de cours). Le token te permet
              d'acceder aux repos de cours, de creer des scaffolds, et de
              beneficier de 5000 requetes/heure au lieu de 60 en anonyme.
            </p>
          </div>
          <span
            class="stg-integration-status"
            :class="gh.connected.value ? 'ok' : 'ko'"
          >
            <Check v-if="gh.connected.value" :size="12" />
            <X v-else :size="12" />
            {{ gh.connected.value ? 'Connecte' : 'Non connecte' }}
          </span>
        </div>

        <!-- Connecte -->
        <template v-if="gh.connected.value">
          <div class="stg-integration-info">
            <Info :size="12" />
            <span>
              Connecte en tant que <strong>@{{ gh.login.value }}</strong>
              <template v-if="gh.scopes.value">
                — scopes : <code>{{ gh.scopes.value }}</code>
              </template>
            </span>
          </div>
          <div class="stg-integration-actions">
            <button class="btn-danger" @click="gh.disconnect()">
              <X :size="14" />
              Deconnecter
            </button>
          </div>
        </template>

        <!-- Non connecte : instructions + input -->
        <template v-else>
          <ol class="stg-gh-steps">
            <li>
              Cree un Personal Access Token GitHub (tous les defauts conviennent) :
              <button class="stg-btn stg-btn-ghost stg-gh-link" @click="openGhTokenPage">
                <ExternalLink :size="12" />
                Ouvrir la page GitHub
              </button>
            </li>
            <li>Clique sur <strong>Generate token</strong> tout en bas de la page.</li>
            <li>Copie le token (commence par <code>ghp_</code>) et colle-le ici :</li>
          </ol>

          <div class="stg-gh-input-row">
            <KeyRound :size="16" class="stg-gh-input-icon" />
            <input
              v-model="ghTokenInput"
              type="password"
              class="stg-gh-input"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              :disabled="ghSubmitting"
              @keydown.enter="handleGhConnect"
            />
          </div>

          <div v-if="ghUserFriendlyError" class="stg-gh-error">
            <AlertCircle :size="12" />
            {{ ghUserFriendlyError }}
          </div>

          <div class="stg-integration-actions">
            <button
              class="btn-primary"
              :disabled="ghSubmitting || !ghTokenInput.trim()"
              @click="handleGhConnect"
            >
              <Github :size="14" />
              {{ ghSubmitting ? 'Verification...' : 'Connecter' }}
            </button>
          </div>

          <p class="stg-integration-note">
            Le token est chiffre localement (AES-GCM) avant stockage en base.
            Tu peux le revoquer a tout moment dans tes parametres GitHub.
          </p>
        </template>
      </div>
    </template>

    <!-- ══════════════ Microsoft 365 — teachers only ══════════════ -->
    <template v-if="appStore.isTeacher">
      <div class="stg-integration-card">
        <div class="stg-integration-head">
          <div class="stg-integration-logo ms-logo">
            <svg viewBox="0 0 23 23" width="22" height="22">
              <rect x="1"  y="1"  width="10" height="10" fill="#f25022" />
              <rect x="12" y="1"  width="10" height="10" fill="#7fba00" />
              <rect x="1"  y="12" width="10" height="10" fill="#00a4ef" />
              <rect x="12" y="12" width="10" height="10" fill="#ffb900" />
            </svg>
          </div>
          <div class="stg-integration-meta">
            <h4 class="stg-integration-title">Microsoft Outlook</h4>
            <p class="stg-integration-desc">
              Synchroniser ton calendrier Outlook avec l'agenda Cursus. Les
              evenements Outlook apparaissent dans la vue agenda et peuvent
              etre filtres independamment.
            </p>
          </div>
          <span class="stg-integration-status" :class="ms.connected.value ? 'ok' : 'ko'">
            <Check v-if="ms.connected.value" :size="12" />
            <X v-else :size="12" />
            {{ ms.connected.value ? 'Connecte' : 'Non connecte' }}
          </span>
        </div>

        <div v-if="ms.connected.value && expiresText" class="stg-integration-info">
          <Info :size="12" />
          <span>Token valide jusqu'au {{ expiresText }} (refresh automatique)</span>
        </div>

        <div class="stg-integration-actions">
          <button
            v-if="!ms.connected.value"
            class="btn-primary"
            :disabled="ms.loading.value"
            @click="ms.connect()"
          >
            <Globe :size="14" />
            {{ ms.loading.value ? 'Ouverture...' : 'Connecter Microsoft' }}
          </button>
          <button
            v-else
            class="btn-danger"
            :disabled="ms.loading.value"
            @click="ms.disconnect()"
          >
            <X :size="14" />
            Deconnecter
          </button>
        </div>

        <details class="stg-integration-help">
          <summary>
            <ExternalLink :size="12" />
            Comment ca marche ?
          </summary>
          <ol class="stg-integration-steps">
            <li>Clique sur "Connecter Microsoft" — ton navigateur s'ouvre.</li>
            <li>Connecte-toi avec ton compte Microsoft (pro ou perso).</li>
            <li>Accepte les permissions demandees (Calendrier).</li>
            <li>Revenir dans Cursus — l'integration s'active automatiquement.</li>
          </ol>
          <p class="stg-integration-note">
            Les donnees restent entre toi et Microsoft. Cursus stocke
            uniquement les tokens chiffres localement pour pouvoir relire ton
            calendrier. Tu peux te deconnecter a tout moment, ca revoque
            immediatement l'acces.
          </p>
        </details>
      </div>
    </template>
  </section>
</template>

<style scoped>
.stg-integration-card {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px;
  margin-top: 12px;
  background: var(--bg-hover);
}

.stg-integration-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.stg-integration-logo {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: var(--radius-sm);
  padding: 4px;
  color: #24292e;
}

.stg-integration-logo.ical-logo {
  background: var(--accent-subtle);
  color: var(--accent);
}

.stg-integration-meta { flex: 1; min-width: 0; }

.stg-integration-title {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.stg-integration-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.stg-integration-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  flex-shrink: 0;
  white-space: nowrap;
}
.stg-integration-status.ok {
  background: rgba(34, 197, 94, .15);
  color: rgb(34, 197, 94);
}
.stg-integration-status.ko {
  background: rgba(148, 163, 184, .15);
  color: var(--text-muted);
}

.stg-integration-info {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 6px 10px;
  font-size: 11px;
  color: var(--text-muted);
  background: rgba(59, 130, 246, .08);
  border-radius: var(--radius-sm);
}
.stg-integration-info code {
  font-size: 10.5px;
  padding: 1px 5px;
  background: var(--bg-elevated);
  border-radius: 3px;
}

.stg-integration-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.stg-integration-help {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
  font-size: 12px;
}
.stg-integration-help summary {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  color: var(--text-secondary);
  font-weight: 500;
}
.stg-integration-help summary:hover { color: var(--text-primary); }

.stg-integration-steps {
  margin: 8px 0 0;
  padding-left: 22px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.stg-integration-note {
  margin: 10px 0 0;
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
  line-height: 1.5;
}

/* ── iCal feed ───────────────────────────────────────────────────────────── */
.stg-feed-url {
  display: flex;
  gap: 6px;
  margin-top: 12px;
}
.stg-feed-url-input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  font-family: ui-monospace, 'Consolas', monospace;
  font-size: 11.5px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
}
.stg-feed-btn {
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background .12s, color .12s;
}
.stg-feed-btn:hover:not(:disabled) {
  background: var(--bg-active);
  color: var(--text-primary);
}

.stg-feed-warning {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 10px;
  padding: 8px 10px;
  font-size: 11px;
  color: #b45309;
  background: rgba(245, 158, 11, .1);
  border: 1px solid rgba(245, 158, 11, .25);
  border-radius: var(--radius-sm);
  line-height: 1.4;
}
:global(.high-contrast) .stg-feed-warning { color: #fbbf24; }

.stg-feed-steps {
  margin: 10px 0 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.stg-feed-step strong {
  display: block;
  font-size: 12px;
  color: var(--text-primary);
  margin-bottom: 2px;
}
.stg-feed-step p {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-secondary);
  line-height: 1.45;
}

/* ── GitHub ──────────────────────────────────────────────────────────────── */
.stg-gh-steps {
  margin: 12px 0 0;
  padding-left: 22px;
  color: var(--text-secondary);
  line-height: 1.7;
  font-size: 12px;
}
.stg-gh-steps code {
  font-size: 11px;
  padding: 1px 5px;
  background: var(--bg-elevated);
  border-radius: 3px;
}

.stg-gh-link {
  margin-left: 6px;
  vertical-align: middle;
}

.stg-gh-input-row {
  position: relative;
  margin-top: 10px;
}
.stg-gh-input-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}
.stg-gh-input {
  width: 100%;
  padding: 9px 10px 9px 34px;
  font-family: ui-monospace, 'Consolas', monospace;
  font-size: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
}
.stg-gh-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}

.stg-gh-error {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 6px 10px;
  font-size: 11.5px;
  color: var(--color-danger);
  background: rgba(var(--color-danger-rgb), .08);
  border-radius: var(--radius-sm);
}

/* ── Boutons partages ────────────────────────────────────────────────────── */
.btn-primary,
.btn-danger,
.stg-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: none;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  transition: all .12s;
}
.btn-primary {
  background: var(--accent);
  color: #fff;
}
.btn-primary:hover:not(:disabled) { filter: brightness(1.1); }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }

.btn-danger,
.stg-btn-danger {
  background: rgba(var(--color-danger-rgb), .1);
  color: var(--color-danger);
  border: 1px solid rgba(var(--color-danger-rgb), .2);
}
.btn-danger:hover:not(:disabled),
.stg-btn-danger:hover:not(:disabled) {
  background: rgba(var(--color-danger-rgb), .18);
  border-color: rgba(var(--color-danger-rgb), .35);
}

.stg-btn-ghost {
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.stg-btn-ghost:hover:not(:disabled) {
  background: var(--bg-active);
  border-color: var(--border-input);
  color: var(--text-primary);
}
</style>
