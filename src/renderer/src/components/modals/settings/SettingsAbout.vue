/** SettingsAbout — section A propos du modal Settings. */
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Info, Globe, Monitor, Heart, Github, ExternalLink, Download } from 'lucide-vue-next'
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
        <p v-if="updateStatus === 'idle'" class="stg-update-text">Verifiez si une nouvelle version est disponible.</p>
        <p v-else-if="updateStatus === 'checking'" class="stg-update-text stg-update-checking">Recherche en cours...</p>
        <p v-else-if="updateStatus === 'available'" class="stg-update-text stg-update-available">Mise a jour {{ updateVersion }} disponible, telechargement en cours...</p>
        <template v-else-if="updateStatus === 'downloading'">
          <p class="stg-update-text stg-update-available">Telechargement de {{ updateVersion }}... {{ downloadPercent }}%</p>
          <div class="stg-progress-bar">
            <div class="stg-progress-fill" :style="{ width: downloadPercent + '%' }" />
          </div>
        </template>
        <p v-else-if="updateStatus === 'downloaded'" class="stg-update-text stg-update-ready">Mise a jour {{ updateVersion }} prete. Redemarrez pour installer.</p>
        <p v-else-if="updateStatus === 'up-to-date'" class="stg-update-text stg-update-ok">Vous etes a jour (v{{ version }}).</p>
        <p v-else-if="updateStatus === 'error'" class="stg-update-text stg-update-error">{{ updateError }}</p>
        <div class="stg-update-actions">
          <button
            v-if="updateStatus === 'downloaded'"
            class="stg-update-btn stg-update-btn--install"
            @click="installUpdate"
          >Redemarrer et installer</button>
          <button
            v-else
            class="stg-update-btn"
            :disabled="updateStatus === 'checking' || updateStatus === 'downloading'"
            @click="checkUpdate"
          >Chercher une mise a jour</button>
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
  display: flex; flex-direction: column; gap: 10px;
  padding: 12px 14px; background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 10px;
}
.stg-update-text { font-size: 12.5px; color: var(--text-secondary); margin: 0; line-height: 1.4; }
.stg-update-checking { color: var(--accent); }
.stg-update-available { color: #f59e0b; }
.stg-update-ready { color: var(--color-success, #059669); font-weight: 600; }
.stg-update-ok { color: var(--color-success, #059669); }
.stg-update-error { color: var(--color-danger, #dc2626); }
.stg-update-actions { display: flex; gap: 8px; }
.stg-update-btn {
  padding: 7px 16px; border-radius: 8px; font-size: 12.5px; font-weight: 600;
  font-family: var(--font); cursor: pointer; border: 1px solid var(--border);
  background: var(--bg-hover); color: var(--text-primary); transition: all .15s;
}
.stg-update-btn:hover:not(:disabled) { background: var(--bg-active); border-color: var(--accent); }
.stg-update-btn:disabled { opacity: .5; cursor: not-allowed; }
.stg-update-btn--install {
  background: var(--color-success, #059669); color: #fff; border-color: transparent;
}
.stg-update-btn--install:hover { opacity: .9; }

/* Barre de progression download */
.stg-progress-bar {
  height: 4px; border-radius: 2px;
  background: var(--bg-hover); overflow: hidden;
}
.stg-progress-fill {
  height: 100%; border-radius: 2px;
  background: var(--accent);
  transition: width .3s ease;
}
</style>
