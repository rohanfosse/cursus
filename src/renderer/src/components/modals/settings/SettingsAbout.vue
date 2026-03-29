/** SettingsAbout — section A propos du modal Settings. */
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Info, Globe, Monitor, Heart, Github, ExternalLink, Download, RefreshCw, CheckCircle, AlertCircle, RotateCw } from 'lucide-vue-next'
import logoUrl from '@/assets/logo.png'
import { version } from '../../../../../../package.json'

// ── Mise a jour ─────────────────────────────────────────────────────────────
type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'
const updateStatus  = ref<UpdateStatus>('idle')
const updateVersion = ref('')
const updateError   = ref('')
const downloadPercent = ref(0)

// Listeners auto-update (enregistres au mount, nettoyes au unmount)
let unsubAvailable: (() => void) | null = null
let unsubDownloaded: (() => void) | null = null
let unsubProgress: (() => void) | null = null
let unsubError: (() => void) | null = null

onMounted(() => {
  unsubAvailable = window.api.onUpdaterAvailable?.((v: string) => {
    updateVersion.value = v
    updateStatus.value = 'downloading'
    downloadPercent.value = 0
  })
  unsubDownloaded = window.api.onUpdaterDownloaded?.((v: string) => {
    updateVersion.value = v
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
        <!-- Idle -->
        <div v-if="updateStatus === 'idle'" class="stg-update-state">
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
          <span class="stg-info-value">MIT</span>
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
          <a href="https://github.com/rohanfosse/cursus" target="_blank" rel="noopener" class="stg-author-link">
            <Github :size="12" /> Voir sur GitHub <ExternalLink :size="10" />
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
  background: color-mix(in srgb, var(--color-success, #059669) 8%, transparent);
}

.stg-update-text {
  font-size: 12.5px; color: var(--text-secondary); margin: 0; line-height: 1.4;
}
.stg-update-text strong { color: var(--text-primary); }
.stg-update-checking { color: var(--accent); }
.stg-update-available { color: var(--text-primary); font-weight: 500; }
.stg-update-ready { color: var(--color-success, #059669); font-weight: 600; font-size: 13px; }
.stg-update-ok { color: var(--color-success, #059669); }
.stg-update-error { color: var(--color-danger, #dc2626); }

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
  color: var(--color-success, #059669); flex-shrink: 0; margin-top: 1px;
}
.stg-update-ok-icon { color: var(--color-success, #059669); flex-shrink: 0; }
.stg-update-error-icon { color: var(--color-danger, #dc2626); flex-shrink: 0; }

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
  background: var(--color-success, #059669); color: #fff; border-color: transparent;
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
  transition: width .3s ease;
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
</style>
