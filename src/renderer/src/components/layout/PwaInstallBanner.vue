<script setup lang="ts">
/*
 * PwaInstallBanner - bandeau "Installer Cursus" pour les visiteurs web
 * mobile qui ne sont pas encore en mode standalone.
 *
 * Pourquoi : sans ce bandeau, le visiteur web n'a aucun signal qu'il
 * peut installer l'app. Sur Chrome Android le menu "Installer
 * l'application" est planque dans le menu trois-points ; sur iOS
 * Safari il faut connaitre le geste "Partager > Sur l'ecran d'accueil".
 * On rend le geste visible et on guide l'utilisateur.
 *
 * Comportement :
 *  - Android/Chrome : ecoute `beforeinstallprompt`, stocke l'event,
 *    affiche un bouton "Installer" qui appelle `prompt()`.
 *  - iOS Safari : pas de `beforeinstallprompt` -> on detecte
 *    `iPhone|iPad|iPod` + `Safari` et on affiche les instructions
 *    "Partager > Sur l'ecran d'accueil".
 *  - Persistance : si l'utilisateur dismiss, on ne re-affiche pas
 *    pendant 30 jours. Si l'app est deja installee (`display-mode:
 *    standalone`), on n'affiche jamais.
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Download, X, Share, Plus } from 'lucide-vue-next'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const STORAGE_KEY = 'cc_pwa_install_dismissed'
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000

const installEvent = ref<BeforeInstallPromptEvent | null>(null)
const isVisible = ref(false)
const showIosInstructions = ref(false)

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent
  const isIos = /iPhone|iPad|iPod/.test(ua)
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
  return isIos && isSafari
}

function wasRecentlyDismissed(): boolean {
  try {
    const ts = Number(localStorage.getItem(STORAGE_KEY))
    return ts > 0 && Date.now() - ts < DISMISS_DURATION_MS
  } catch {
    return false
  }
}

function dismissForever(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {
    /* quota / private mode : non bloquant */
  }
  isVisible.value = false
  showIosInstructions.value = false
}

async function handleInstall(): Promise<void> {
  const ev = installEvent.value
  if (!ev) return
  await ev.prompt()
  const choice = await ev.userChoice
  installEvent.value = null
  if (choice.outcome === 'accepted') {
    isVisible.value = false
  } else {
    dismissForever()
  }
}

function onBeforeInstallPrompt(e: Event): void {
  e.preventDefault()
  installEvent.value = e as BeforeInstallPromptEvent
  if (!wasRecentlyDismissed() && !isStandalone()) {
    isVisible.value = true
  }
}

function onAppInstalled(): void {
  isVisible.value = false
  installEvent.value = null
}

const platform = computed<'android' | 'ios' | null>(() => {
  if (installEvent.value) return 'android'
  if (isIosSafari()) return 'ios'
  return null
})

let iosShowTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  if (isStandalone()) return
  if (wasRecentlyDismissed()) return

  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', onAppInstalled)

  // iOS Safari : pas d'event prompt, on declenche l'affichage manuellement
  // apres une breve temporisation pour laisser la page se stabiliser.
  if (isIosSafari()) {
    iosShowTimer = setTimeout(() => { isVisible.value = true }, 2000)
  }
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.removeEventListener('appinstalled', onAppInstalled)
  if (iosShowTimer !== null) {
    clearTimeout(iosShowTimer)
    iosShowTimer = null
  }
})
</script>

<template>
  <Transition name="pwa-banner-slide">
    <div v-if="isVisible" class="pwa-banner" role="dialog" aria-label="Installer l'application">
      <div class="pwa-banner-icon" aria-hidden="true">
        <Download :size="22" />
      </div>
      <div class="pwa-banner-content">
        <strong class="pwa-banner-title">Installer Cursus</strong>
        <p v-if="platform === 'android'" class="pwa-banner-text">
          Acces rapide depuis l'ecran d'accueil, fonctionne hors ligne.
        </p>
        <p v-else class="pwa-banner-text">
          Ajoutez Cursus a votre ecran d'accueil pour un acces rapide.
        </p>
      </div>
      <div class="pwa-banner-actions">
        <button
          v-if="platform === 'android'"
          type="button"
          class="pwa-banner-install"
          @click="handleInstall"
        >
          Installer
        </button>
        <button
          v-else-if="platform === 'ios'"
          type="button"
          class="pwa-banner-install"
          @click="showIosInstructions = !showIosInstructions"
        >
          Comment ?
        </button>
        <button
          type="button"
          class="pwa-banner-dismiss"
          aria-label="Fermer"
          @click="dismissForever"
        >
          <X :size="16" />
        </button>
      </div>
    </div>
  </Transition>

  <Transition name="pwa-modal-fade">
    <div
      v-if="showIosInstructions"
      class="pwa-ios-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Installer sur iOS"
      @click="showIosInstructions = false"
    >
      <div class="pwa-ios-card" @click.stop>
        <h3 class="pwa-ios-title">Installer sur iOS</h3>
        <ol class="pwa-ios-steps">
          <li>
            <Share :size="16" /> Touchez le bouton <strong>Partager</strong> dans Safari
          </li>
          <li>
            <Plus :size="16" /> Choisissez <strong>Sur l'ecran d'accueil</strong>
          </li>
          <li>Validez avec <strong>Ajouter</strong>.</li>
        </ol>
        <button type="button" class="pwa-ios-close" @click="showIosInstructions = false">
          Compris
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.pwa-banner {
  display: none;
}

@media (max-width: 768px) {
  .pwa-banner {
    display: flex;
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: calc(56px + env(safe-area-inset-bottom, 0) + 12px);
    z-index: var(--z-sticky, 800);
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgba(0, 0, 0, .35);
  }
}

.pwa-banner-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
}

.pwa-banner-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.pwa-banner-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.pwa-banner-text {
  margin: 0;
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pwa-banner-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.pwa-banner-install {
  background: var(--accent);
  color: #fff;
  border: none;
  font-size: 12px;
  font-weight: 700;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: inherit;
  min-height: 36px;
}
.pwa-banner-install:active {
  filter: brightness(.9);
}

.pwa-banner-dismiss {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  min-height: 36px;
}
.pwa-banner-dismiss:active {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.pwa-ios-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay, 9000);
  background: rgba(0, 0, 0, .6);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.pwa-ios-card {
  max-width: 360px;
  width: 100%;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, .5);
}

.pwa-ios-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.pwa-ios-steps {
  margin: 0 0 16px;
  padding-left: 20px;
  list-style: decimal;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}
.pwa-ios-steps li {
  display: list-item;
  padding-left: 4px;
}
.pwa-ios-steps li :deep(svg) {
  vertical-align: middle;
  margin-right: 4px;
  color: var(--accent);
}

.pwa-ios-close {
  width: 100%;
  padding: 10px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.pwa-banner-slide-enter-active,
.pwa-banner-slide-leave-active {
  transition:
    opacity var(--t-base) ease,
    transform var(--t-base) cubic-bezier(.34, 1.56, .64, 1);
}
.pwa-banner-slide-enter-from,
.pwa-banner-slide-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.pwa-modal-fade-enter-active,
.pwa-modal-fade-leave-active {
  transition: opacity var(--t-base) ease;
}
.pwa-modal-fade-enter-from,
.pwa-modal-fade-leave-to {
  opacity: 0;
}
</style>
