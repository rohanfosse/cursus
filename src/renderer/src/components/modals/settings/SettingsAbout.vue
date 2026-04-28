/** SettingsAbout — section A propos du modal Settings. */
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Info, Globe, Monitor, Heart, Github, ExternalLink, Download, RefreshCw, CheckCircle, AlertCircle, RotateCw, FlaskConical, Shield, BookOpen, Scale } from 'lucide-vue-next'
import logoUrl from '@/assets/logo.png'
import { version } from '../../../../../../package.json'

// ── Mise a jour ─────────────────────────────────────────────────────────────
type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error' | 'disabled'
const updateStatus    = ref<UpdateStatus>('idle')
const updateVersion   = ref('')
const updateError     = ref('')
const updateMessage   = ref<string | null>(null)
const releaseNotes    = ref<string | null>(null)
const downloadPercent = ref(0)

// Canal beta (opt-in local, persiste en localStorage)
const BETA_STORAGE_KEY = 'cursus:updater:beta'
const betaOptIn         = ref(false)
const betaRestartNeeded = ref(false)

// Listeners auto-update (enregistres au mount, nettoyes au unmount)
let unsubAvailable: (() => void) | null = null
let unsubDownloaded: (() => void) | null = null
let unsubProgress: (() => void) | null = null
let unsubError: (() => void) | null = null

onMounted(async () => {
  // Restaurer la preference beta et l'envoyer au main (effet au prochain restart)
  try {
    betaOptIn.value = localStorage.getItem(BETA_STORAGE_KEY) === '1'
    if (betaOptIn.value) await window.api.setUpdaterBetaOptIn?.(true)
  } catch { /* ignore */ }

  // Recuperer la config distante (message optionnel, canal impose serveur)
  try {
    const cfg = await window.api.getUpdaterRemoteConfig?.()
    if (cfg?.ok && cfg.data) {
      if (cfg.data.disabled) updateStatus.value = 'disabled'
      if (cfg.data.message) updateMessage.value = cfg.data.message
    }
  } catch { /* ignore */ }

  unsubAvailable = window.api.onUpdaterAvailable?.((v: string) => {
    updateVersion.value = v
    updateStatus.value = 'downloading'
    downloadPercent.value = 0
  })
  unsubDownloaded = window.api.onUpdaterDownloaded?.((payload) => {
    if (typeof payload === 'string') {
      updateVersion.value = payload
      releaseNotes.value  = null
    } else {
      updateVersion.value = payload.version
      releaseNotes.value  = payload.releaseNotes
    }
    updateStatus.value = 'downloaded'
    downloadPercent.value = 100
  })
  unsubProgress = window.api.onUpdaterProgress?.((percent: number) => {
    downloadPercent.value = percent
    if (updateStatus.value !== 'downloading') updateStatus.value = 'downloading'
  })
  unsubError = window.api.onUpdaterError?.((err: string) => {
    updateError.value = err
    updateStatus.value = 'error'
  })
})

onUnmounted(() => {
  unsubAvailable?.()
  unsubDownloaded?.()
  unsubProgress?.()
  unsubError?.()
})

async function checkUpdate() {
  updateStatus.value = 'checking'
  updateError.value  = ''
  try {
    const res = await window.api.checkForUpdates?.()
    if (!res?.ok) {
      updateStatus.value = 'error'
      updateError.value = res?.error ?? 'Impossible de verifier les mises a jour.'
      return
    }
    if (res.data?.disabled) {
      updateStatus.value = 'disabled'
      if (res.data.message) updateMessage.value = res.data.message
      return
    }
    if (res.data?.available) {
      updateStatus.value = 'available'
      updateVersion.value = res.data.version
    } else {
      updateStatus.value = 'up-to-date'
    }
  } catch {
    updateStatus.value = 'error'
    updateError.value = 'Erreur de connexion.'
  }
}

function installUpdate() { window.api.updaterQuitAndInstall() }

async function toggleBeta(enabled: boolean) {
  betaOptIn.value = enabled
  try {
    localStorage.setItem(BETA_STORAGE_KEY, enabled ? '1' : '0')
    const res = await window.api.setUpdaterBetaOptIn?.(enabled)
    if (res?.ok && res.data?.restartRequired) betaRestartNeeded.value = true
  } catch { /* ignore */ }
}

const systemPlatform = navigator.platform
const systemLanguage = navigator.language
</script>

<template>
  <section class="stg-section">
    <div class="stg-section-header">
      <Info :size="18" />
      <h3 class="stg-section-title">A propos</h3>
    </div>

    <div class="stg-about-hero">
      <img :src="logoUrl" class="stg-about-logo" alt="Cursus" />
      <div class="stg-about-hero-text">
        <h4 class="stg-about-name">Cursus</h4>
        <span class="stg-about-version">v{{ version }}</span>
      </div>
      <p class="stg-about-tagline">Suivez votre parcours de formation</p>
    </div>

    <!-- Mise a jour -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Download :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Mise a jour</h4>
      </div>
      <div class="stg-update-section">
        <!-- Message distant (annonce serveur, maintenance, etc.) -->
        <div v-if="updateMessage" class="stg-update-banner">
          <Info :size="14" /> <span>{{ updateMessage }}</span>
        </div>

        <!-- Desactive par le serveur (kill switch) -->
        <div v-if="updateStatus === 'disabled'" class="stg-update-state">
          <div class="stg-update-spinner-row">
            <AlertCircle :size="16" class="stg-update-error-icon" />
            <span class="stg-update-text">Les mises a jour sont temporairement desactivees.</span>
          </div>
          <p class="stg-update-hint">Version actuelle : <strong>v{{ version }}</strong></p>
        </div>

        <!-- Idle -->
        <div v-else-if="updateStatus === 'idle'" class="stg-update-state">
          <p class="stg-update-text">Version actuelle : <strong>v{{ version }}</strong></p>
          <button class="stg-update-btn" @click="checkUpdate">
            <RefreshCw :size="14" /> Chercher une mise a jour
          </button>
        </div>

        <!-- Checking -->
        <div v-else-if="updateStatus === 'checking'" class="stg-update-state">
          <div class="stg-update-spinner-row">
            <RefreshCw :size="16" class="stg-spin" />
            <span class="stg-update-text stg-update-checking">Recherche en cours...</span>
          </div>
        </div>

        <!-- Downloading -->
        <div v-else-if="updateStatus === 'available' || updateStatus === 'downloading'" class="stg-update-state">
          <div class="stg-update-download-header">
            <Download :size="14" class="stg-update-dl-icon" />
            <span class="stg-update-text stg-update-available">Telechargement de v{{ updateVersion }}</span>
            <span class="stg-update-percent">{{ Math.round(downloadPercent) }}%</span>
          </div>
          <div class="stg-progress-bar">
            <div class="stg-progress-fill" :style="{ width: downloadPercent + '%' }" />
          </div>
          <p class="stg-update-hint">Ne fermez pas l'application pendant le telechargement.</p>
        </div>

        <!-- Downloaded / Ready -->
        <div v-else-if="updateStatus === 'downloaded'" class="stg-update-state stg-update-state--ready">
          <div class="stg-update-ready-header">
            <CheckCircle :size="18" class="stg-update-ready-icon" />
            <div>
              <p class="stg-update-text stg-update-ready">Mise a jour v{{ updateVersion }} prete</p>
              <p class="stg-update-hint">Redemarrez pour appliquer la mise a jour.</p>
            </div>
          </div>
          <details v-if="releaseNotes" class="stg-release-notes">
            <summary>Voir les nouveautes</summary>
            <pre class="stg-release-notes-body">{{ releaseNotes }}</pre>
          </details>
          <button class="stg-update-btn stg-update-btn--install" @click="installUpdate">
            <RotateCw :size="14" /> Redemarrer maintenant
          </button>
        </div>

        <!-- Up to date -->
        <div v-else-if="updateStatus === 'up-to-date'" class="stg-update-state">
          <div class="stg-update-spinner-row">
            <CheckCircle :size="16" class="stg-update-ok-icon" />
            <span class="stg-update-text stg-update-ok">Vous etes a jour (v{{ version }})</span>
          </div>
          <button class="stg-update-btn stg-update-btn--small" @click="checkUpdate">
            Reverifier
          </button>
        </div>

        <!-- Error -->
        <div v-else-if="updateStatus === 'error'" class="stg-update-state">
          <div class="stg-update-spinner-row">
            <AlertCircle :size="16" class="stg-update-error-icon" />
            <span class="stg-update-text stg-update-error">{{ updateError }}</span>
          </div>
          <button class="stg-update-btn stg-update-btn--small" @click="checkUpdate">
            Reessayer
          </button>
        </div>

        <!-- Canal beta (opt-in) -->
        <label class="stg-beta-row" :title="'Recevez les nouveautes avant tout le monde (versions pre-release).'">
          <input type="checkbox" :checked="betaOptIn" @change="toggleBeta(($event.target as HTMLInputElement).checked)" />
          <span class="stg-beta-label">
            <FlaskConical :size="13" /> Recevoir les versions beta
          </span>
          <span v-if="betaRestartNeeded" class="stg-beta-hint">Effet au prochain redemarrage</span>
        </label>
      </div>
    </div>

    <!-- Liens -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Globe :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Liens</h4>
      </div>
      <div class="stg-info-grid">
        <a href="https://app.cursus.school" target="_blank" rel="noopener" class="stg-info-cell stg-info-link">
          <span class="stg-info-label">Application</span>
          <span class="stg-info-value">app.cursus.school <ExternalLink :size="10" /></span>
        </a>
        <a href="https://cursus.school" target="_blank" rel="noopener" class="stg-info-cell stg-info-link">
          <span class="stg-info-label">Site web</span>
          <span class="stg-info-value">cursus.school <ExternalLink :size="10" /></span>
        </a>
        <a href="https://github.com/rohanfosse/cursus" target="_blank" rel="noopener" class="stg-info-cell stg-info-link">
          <span class="stg-info-label">Code source</span>
          <span class="stg-info-value"><Github :size="10" /> rohanfosse/cursus <ExternalLink :size="10" /></span>
        </a>
        <a href="https://github.com/rohanfosse/cursus/blob/main/SECURITY.md" target="_blank" rel="noopener" class="stg-info-cell stg-info-link">
          <span class="stg-info-label">Politique de securite</span>
          <span class="stg-info-value"><Shield :size="10" /> SECURITY.md <ExternalLink :size="10" /></span>
        </a>
        <a href="https://github.com/rohanfosse/cursus/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener" class="stg-info-cell stg-info-link">
          <span class="stg-info-label">Contribuer</span>
          <span class="stg-info-value"><BookOpen :size="10" /> CONTRIBUTING.md <ExternalLink :size="10" /></span>
        </a>
        <a href="https://github.com/rohanfosse/cursus/blob/main/LICENSE" target="_blank" rel="noopener" class="stg-info-cell stg-info-link">
          <span class="stg-info-label">Licence</span>
          <span class="stg-info-value"><Scale :size="10" /> AGPL v3 <ExternalLink :size="10" /></span>
        </a>
      </div>
    </div>

    <!-- Technique -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Monitor :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Technique</h4>
      </div>
      <div class="stg-info-grid">
        <div class="stg-info-cell">
          <span class="stg-info-label">Plateforme</span>
          <span class="stg-info-value">Electron + Vue 3</span>
        </div>
        <div class="stg-info-cell">
          <span class="stg-info-label">Base de donnees</span>
          <span class="stg-info-value">SQLite (local)</span>
        </div>
        <div class="stg-info-cell">
          <span class="stg-info-label">Temps reel</span>
          <span class="stg-info-value">Socket.io</span>
        </div>
        <div class="stg-info-cell">
          <span class="stg-info-label">Licence</span>
          <span class="stg-info-value">AGPL v3</span>
        </div>
        <div class="stg-info-cell">
          <span class="stg-info-label">Systeme</span>
          <span class="stg-info-value">{{ systemPlatform }}</span>
        </div>
        <div class="stg-info-cell">
          <span class="stg-info-label">Langue</span>
          <span class="stg-info-value">{{ systemLanguage }}</span>
        </div>
      </div>
    </div>

    <!-- Auteur -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Heart :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Cree par</h4>
      </div>
      <div class="stg-author-card">
        <div class="stg-author-avatar">RF</div>
        <div class="stg-author-info">
          <span class="stg-author-name">Rohan Fosse</span>
          <span class="stg-author-copyright">&copy; 2025-2026 &middot; Distribué sous licence AGPL v3</span>
          <a href="https://github.com/rohanfosse" target="_blank" rel="noopener" class="stg-author-link">
            <Github :size="12" /> @rohanfosse <ExternalLink :size="10" />
          </a>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stg-update-section {
  display: flex; flex-direction: column; gap: 0;
  padding: 0; background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 10px; overflow: hidden;
}

.stg-update-state {
  display: flex; flex-direction: column; gap: 10px;
  padding: 14px 16px;
}

.stg-update-state--ready {
  background: color-mix(in srgb, var(--color-success) 8%, transparent);
}

.stg-update-text {
  font-size: 12.5px; color: var(--text-secondary); margin: 0; line-height: 1.4;
}
.stg-update-text strong { color: var(--text-primary); }
.stg-update-checking { color: var(--accent); }
.stg-update-available { color: var(--text-primary); font-weight: 500; }
.stg-update-ready { color: var(--color-success); font-weight: 600; font-size: 13px; }
.stg-update-ok { color: var(--color-success); }
.stg-update-error { color: var(--color-danger); }

.stg-update-hint {
  font-size: 11px; color: var(--text-muted); margin: 0; line-height: 1.4;
}

/* Spinner row */
.stg-update-spinner-row {
  display: flex; align-items: center; gap: 10px;
}

/* Download header */
.stg-update-download-header {
  display: flex; align-items: center; gap: 8px;
}
.stg-update-dl-icon { color: var(--accent); flex-shrink: 0; }
.stg-update-percent {
  margin-left: auto; font-size: 13px; font-weight: 700;
  color: var(--accent); font-variant-numeric: tabular-nums;
}

/* Ready header */
.stg-update-ready-header {
  display: flex; align-items: flex-start; gap: 10px;
}
.stg-update-ready-icon {
  color: var(--color-success); flex-shrink: 0; margin-top: 1px;
}
.stg-update-ok-icon { color: var(--color-success); flex-shrink: 0; }
.stg-update-error-icon { color: var(--color-danger); flex-shrink: 0; }

/* Buttons */
.stg-update-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 18px; border-radius: 8px; font-size: 12.5px; font-weight: 600;
  font-family: var(--font); cursor: pointer; border: 1px solid var(--border);
  background: var(--bg-hover); color: var(--text-primary); transition: all .15s;
  width: fit-content;
}
.stg-update-btn:hover:not(:disabled) { background: var(--bg-active); border-color: var(--accent); }
.stg-update-btn:disabled { opacity: .5; cursor: not-allowed; }

.stg-update-btn--install {
  background: var(--color-success); color: #fff; border-color: transparent;
  padding: 10px 22px; font-size: 13px; width: 100%; justify-content: center;
}
.stg-update-btn--install:hover { opacity: .9; }

.stg-update-btn--small {
  padding: 5px 12px; font-size: 11.5px; font-weight: 500;
}

/* Progress bar */
.stg-progress-bar {
  height: 8px; border-radius: 4px;
  background: var(--bg-hover); overflow: hidden;
  position: relative;
}
.stg-progress-fill {
  height: 100%; border-radius: 4px;
  background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 80%, #fff));
  transition: width var(--motion-slow) var(--ease-out);
  position: relative;
}
.stg-progress-fill::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.15) 50%, transparent 100%);
  animation: stg-shimmer 1.5s ease infinite;
}

@keyframes stg-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Spinner */
.stg-spin {
  color: var(--accent);
  animation: stg-spin .8s linear infinite;
}
@keyframes stg-spin {
  to { transform: rotate(360deg); }
}

/* Banner message distant */
.stg-update-banner {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; font-size: 12px; color: var(--text-secondary);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border-bottom: 1px solid var(--border);
}
.stg-update-banner :first-child { flex-shrink: 0; color: var(--accent); }

/* Release notes accordion */
.stg-release-notes {
  font-size: 12px; color: var(--text-secondary);
  border-top: 1px dashed var(--border); padding-top: 10px;
}
.stg-release-notes summary {
  cursor: pointer; user-select: none; font-weight: 600; color: var(--text-primary);
  padding: 2px 0;
}
.stg-release-notes summary:hover { color: var(--accent); }
.stg-release-notes-body {
  margin: 8px 0 0 0; padding: 10px 12px;
  background: var(--bg-hover); border-radius: 6px;
  font-family: var(--font); font-size: 11.5px; line-height: 1.5;
  white-space: pre-wrap; word-break: break-word;
  max-height: 180px; overflow-y: auto;
}

/* Canal beta */
.stg-beta-row {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; border-top: 1px solid var(--border);
  cursor: pointer; user-select: none;
}
.stg-beta-row input[type="checkbox"] { cursor: pointer; margin: 0; }
.stg-beta-label {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px; color: var(--text-primary);
}
.stg-beta-hint {
  margin-left: auto; font-size: 11px; color: var(--text-muted); font-style: italic;
}
</style>
