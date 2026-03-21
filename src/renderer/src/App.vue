<script setup lang="ts">
  import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAppStore }      from '@/stores/app'
  import { useModalsStore }   from '@/stores/modals'
  import { useMessagesStore } from '@/stores/messages'
  import { usePrefs }       from '@/composables/usePrefs'
  import { useToast }       from '@/composables/useToast'
  import Toast        from '@/components/ui/Toast.vue'
  import ConfirmModal from '@/components/ui/ConfirmModal.vue'
  import NavRail  from '@/components/layout/NavRail.vue'
  import TitleBar from '@/components/layout/TitleBar.vue'
  import Sidebar  from '@/components/sidebar/Sidebar.vue'
  import LoginOverlay        from '@/components/auth/LoginOverlay.vue'
  import ChangePasswordModal from '@/components/modals/ChangePasswordModal.vue'
  // Modales
  import CmdPalette           from '@/components/modals/CmdPalette.vue'
  import SettingsModal        from '@/components/modals/SettingsModal.vue'
  import CreateChannelModal   from '@/components/modals/CreateChannelModal.vue'
  import NewDevoirModal       from '@/components/modals/NewDevoirModal.vue'
  import DepotsModal          from '@/components/modals/DepotsModal.vue'
  import SuiviModal           from '@/components/modals/SuiviModal.vue'
  import GestionDevoirModal   from '@/components/modals/GestionDevoirModal.vue'
  import RessourcesModal      from '@/components/modals/RessourcesModal.vue'
  import TimelineModal        from '@/components/modals/TimelineModal.vue'
  import EcheancierModal      from '@/components/modals/EcheancierModal.vue'
  import DocumentPreviewModal from '@/components/modals/DocumentPreviewModal.vue'
  import ImpersonateModal        from '@/components/modals/ImpersonateModal.vue'
  import StudentTimelineModal    from '@/components/modals/StudentTimelineModal.vue'
  import RubricModal             from '@/components/modals/RubricModal.vue'
  import ImportStudentsModal     from '@/components/modals/ImportStudentsModal.vue'
  import IntervenantsModal       from '@/components/modals/IntervenantsModal.vue'
  import ClasseModal             from '@/components/modals/ClasseModal.vue'
  import CreatePromoModal        from '@/components/modals/CreatePromoModal.vue'

  const appStore = useAppStore()
  const modals   = useModalsStore()
  const router   = useRouter()
  const { getPref } = usePrefs()
  const { showToast } = useToast()

  const promoCreatedKey = ref(0)
  function onPromoCreated() { promoCreatedKey.value++ }

  // Bandeau demande de notifications
  const showNotifBanner = ref(false)
  function acceptNotifs() {
    Notification.requestPermission().catch(() => {})
    showNotifBanner.value = false
  }
  function dismissNotifs() {
    showNotifBanner.value = false
  }

  // Toast discret pour la connexion socket
  let _wasDisconnected = false
  let _disconnectTimer: ReturnType<typeof setTimeout> | null = null
  watch(() => appStore.socketConnected, (connected) => {
    if (connected && _wasDisconnected) {
      if (_disconnectTimer) { clearTimeout(_disconnectTimer); _disconnectTimer = null }
      showToast('Reconnecté', 'success')
    } else if (!connected && appStore.currentUser) {
      // Afficher le toast seulement après 3s de déconnexion (éviter les micro-coupures)
      _disconnectTimer = setTimeout(() => {
        showToast('Reconnexion en cours…', 'info')
      }, 3000)
    }
    _wasDisconnected = !connected
  })

  // ── Mobile sidebar drawer ──────────────────────────────────────────────────
  const sidebarOpen = ref(false)
  function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value }
  function closeSidebar()  { sidebarOpen.value = false }

  // ── Changement de mot de passe forcé (première connexion) ─────────────────
  const showForcedPasswordChange = computed(() =>
    !!appStore.currentUser && appStore.currentUser.must_change_password === 1,
  )

  // ── Bannière de confidentialité RGPD (première ouverture) ─────────────────
  const PRIVACY_KEY  = 'cc_privacy_seen'
  const showPrivacy  = ref(false)
  function acceptPrivacy() {
    localStorage.setItem(PRIVACY_KEY, '1')
    showPrivacy.value = false
  }
  function openPrivacy() { showPrivacy.value = true }
  ;(window as Window & { __cursusShowPrivacy?: () => void }).__cursusShowPrivacy = openPrivacy

  // Afficher uniquement la premiere fois (revoir via Settings)
  watch(() => appStore.currentUser, (user) => {
    if (user && !localStorage.getItem(PRIVACY_KEY)) {
      showPrivacy.value = true
    }
  })

  // ── Guard router : bloquer la navigation si must_change_password ──────────
  router.beforeEach((_to, _from, next) => {
    if (showForcedPasswordChange.value) {
      // Empêcher la navigation tant que le mot de passe n'a pas été changé
      next(false)
      return
    }
    next()
  })

  let unsubUnread:   (() => void) | null = null
  let unsubOnline:   (() => void) | null = null
  let unsubSocket:   (() => void) | null = null
  let unsubTyping:   (() => void) | null = null
  let unsubPresence:    (() => void) | null = null
  let unsubAuthExpired: (() => void) | null = null

  onMounted(() => {
    // Appliquer le thème sauvegardé (ou suivre le thème système si pas de préférence)
    let theme = getPref('theme') as string | null
    if (!theme) {
      // Première visite : suivre le thème système
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      theme = prefersDark ? 'dark' : 'cursus'
    }
    document.body.classList.remove('light', 'night', 'marine', 'cursus')
    if (theme !== 'dark') document.body.classList.add(theme)

    // Appliquer la taille de police sauvegardée
    const fs = getPref('fontSize') ?? 'default'
    const sizes: Record<string, string> = { small: '13px', default: '14.5px', large: '16px' }
    document.documentElement.style.setProperty('--font-size-base', sizes[fs])

    // Appliquer la densité sauvegardée
    const dens = getPref('density') ?? 'default'
    const spacings: Record<string, string> = { compact: '2px', default: '6px', cozy: '10px' }
    document.documentElement.style.setProperty('--msg-spacing', spacings[dens])

    // Demander la permission notifications APRÈS un délai (pas au premier chargement)
    // pour laisser l'utilisateur voir l'app d'abord
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => {
        showNotifBanner.value = true
      }, 15_000) // Afficher le bandeau après 15s
    }

    // Toast in-app pour les notifications quand la fenêtre est au premier plan
    window.addEventListener('cursus:notif-toast', ((e: CustomEvent) => {
      showToast(`${e.detail.title} - ${e.detail.body}`, 'info')
    }) as EventListener)

    // Restaurer la session depuis localStorage
    const restored = appStore.restoreSession()
    if (restored) router.replace('/messages')

    // Écouter les messages temps-réel (IPC push)
    unsubUnread = appStore.initUnreadListener()

    // Écouter les changements de connectivité réseau
    unsubOnline = appStore.initOnlineListener()

    // Écouter l'état du socket temps-réel
    unsubSocket = appStore.initSocketListener()
    unsubPresence = appStore.initPresenceListener()
    unsubAuthExpired = appStore.initAuthExpiredListener()

    // Écouter les indicateurs de frappe
    const messagesStore = useMessagesStore()
    unsubTyping = messagesStore.initTypingListener()
  })

  onUnmounted(() => { unsubUnread?.(); unsubOnline?.(); unsubSocket?.(); unsubTyping?.(); unsubPresence?.(); unsubAuthExpired?.() })
</script>

<template>
  <!-- Toast global (accessible depuis n'importe quel composant) -->
  <Toast />
  <!-- Modal de confirmation global -->
  <ConfirmModal />

  <!-- Écran de connexion -->
  <LoginOverlay v-if="!appStore.currentUser" />

  <!-- Shell principal (après connexion) -->
  <div v-else id="app-shell" class="app-shell">
    <!-- Barre de titre custom (fenêtre sans chrome natif) -->
    <TitleBar />

    <!-- Colonnes nav + sidebar + main -->
    <div class="app-columns">
    <NavRail />

    <!-- Bandeau hors-ligne -->
    <div v-if="!appStore.isOnline" class="offline-banner offline-banner-red">
      <span>Vous êtes hors ligne - vérifiez votre connexion internet.</span>
    </div>

    <!-- Bandeau reconnexion socket -->
    <!-- Reconnexion : toast discret au lieu de bandeau -->

    <!-- Bandeau session expirée -->
    <div v-if="appStore.sessionExpiredMessage" class="offline-banner offline-banner-red">
      <span>{{ appStore.sessionExpiredMessage }}</span>
    </div>

    <!-- Bandeau demande de notifications -->
    <Transition name="reconnected-fade">
      <div v-if="showNotifBanner && appStore.currentUser" class="notif-request-banner">
        <span>Activez les notifications pour ne pas manquer les messages et les deadlines.</span>
        <div style="display:flex;gap:6px">
          <button class="notif-req-btn notif-req-accept" @click="acceptNotifs">Activer</button>
          <button class="notif-req-btn notif-req-dismiss" @click="dismissNotifs">Plus tard</button>
        </div>
      </div>
    </Transition>

    <!-- Bandeau simulation étudiant -->
    <div v-if="appStore.isSimulating" id="simulation-banner" class="simulation-banner" :class="{ 'banner-shift': !appStore.isOnline }">
      <span>
        Simulation : <strong>{{ appStore.currentUser?.name }}</strong>
        - vous voyez l'app comme cet étudiant
      </span>
      <button class="btn-ghost simulation-stop-btn" @click="appStore.stopSimulation()">
        Quitter la simulation
      </button>
    </div>

    <!-- Backdrop mobile pour fermer le drawer sidebar -->
    <div class="sidebar-backdrop" :class="{ visible: sidebarOpen }" @click="closeSidebar" />

    <aside class="sidebar-wrapper" :class="{ 'sidebar-with-banner': appStore.isSimulating || !appStore.isOnline, 'mobile-open': sidebarOpen }">
      <Sidebar @navigate="closeSidebar" />
    </aside>

    <main class="main-wrapper" :class="{ 'main-with-banner': appStore.isSimulating || !appStore.isOnline }">
      <!-- Vue active (messages / travaux / documents) -->
      <RouterView v-slot="{ Component }">
        <Transition name="route-fade" mode="out-in">
          <component :is="Component" :key="$route.path" :toggle-sidebar="toggleSidebar" />
        </Transition>
      </RouterView>
    </main>
    </div><!-- /.app-columns -->
  </div>

  <!-- Modales globales - montées une fois, visibilité gérée par le store modals -->
  <template v-if="appStore.currentUser">
    <CmdPalette />
    <SettingsModal        v-model="modals.settings"        />
    <CreateChannelModal   v-model="modals.createChannel"   />
    <NewDevoirModal       v-model="modals.newDevoir"       />
    <DepotsModal          v-model="modals.depots"          />
    <SuiviModal           v-model="modals.suivi"           />
    <GestionDevoirModal   v-model="modals.gestionDevoir"   />
    <RessourcesModal      v-model="modals.ressources"      />
    <TimelineModal        v-model="modals.timeline"        />
    <EcheancierModal      v-model="modals.echeancier"      />
    <DocumentPreviewModal v-model="modals.documentPreview" />
    <ImpersonateModal        v-model="modals.impersonate"        />
    <StudentTimelineModal    v-model="modals.studentTimeline"    />
    <RubricModal             v-model="modals.rubric"             />
    <ImportStudentsModal     v-model="modals.importStudents"    />
    <IntervenantsModal       v-model="modals.intervenants"      />
    <ClasseModal             v-model="modals.classe"            />
    <CreatePromoModal        v-model="modals.createPromo"       @created="onPromoCreated" />

    <!-- Changement de mot de passe forcé (première connexion) -->
    <ChangePasswordModal
      :model-value="showForcedPasswordChange"
      :forced="true"
      @update:model-value="() => {}"
      @changed="() => {}"
    />
  </template>

  <!-- Banniere RGPD (premiere utilisation ou via Settings) -->
  <Transition name="privacy-fade">
    <div v-if="showPrivacy && appStore.currentUser" class="privacy-overlay" role="dialog" aria-modal="true" aria-label="Politique de confidentialité">
      <div class="privacy-box">
        <div class="privacy-header">
          <div class="privacy-icon-wrap">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div>
            <h3 class="privacy-title">Confidentialité &amp; données</h3>
            <p class="privacy-subtitle">Comment Cursus protège vos informations</p>
          </div>
        </div>

        <div class="privacy-body">
          <div class="privacy-section">
            <h4 class="privacy-section-title">Données collectées</h4>
            <div class="privacy-grid">
              <div class="privacy-item">
                <span class="privacy-item-icon">💬</span>
                <div><strong>Messages</strong><span>Base de données locale</span></div>
              </div>
              <div class="privacy-item">
                <span class="privacy-item-icon">📝</span>
                <div><strong>Rendus &amp; notes</strong><span>Accessibles au responsable</span></div>
              </div>
              <div class="privacy-item">
                <span class="privacy-item-icon">📷</span>
                <div><strong>Photo de profil</strong><span>Visible par votre promo</span></div>
              </div>
              <div class="privacy-item">
                <span class="privacy-item-icon">🔑</span>
                <div><strong>Mot de passe</strong><span>Chiffré (bcrypt)</span></div>
              </div>
            </div>
          </div>

          <div class="privacy-section">
            <h4 class="privacy-section-title">Vos droits <span class="privacy-badge">RGPD</span></h4>
            <div class="privacy-rights">
              <div class="privacy-right">🗑️ Supprimer vos messages</div>
              <div class="privacy-right">📦 Exporter vos données <span class="privacy-path">Paramètres → Compte</span></div>
              <div class="privacy-right">✉️ Demander la suppression du compte</div>
            </div>
          </div>

          <p class="privacy-note">Données utilisées uniquement dans le cadre de votre formation, jamais transmises à des tiers.</p>
        </div>

        <button class="btn-primary privacy-accept" @click="acceptPrivacy">
          Compris, continuer
        </button>
      </div>
    </div>
  </Transition>
</template>

<style>
  /* Styles globaux gérés dans renderer/css/ */

  /* ── Bandeau simulation étudiant ── */
  .simulation-banner {
    position: fixed;
    top: var(--titlebar-height, 32px);
    left: 0;
    right: 0;
    z-index: var(--z-sticky);
    height: 36px;
    background: #E67E22;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(0,0,0,.25);
  }

  .simulation-stop-btn {
    color: #fff !important;
    border: 1px solid rgba(255,255,255,.4) !important;
    padding: 3px 10px !important;
    font-size: 12px !important;
    border-radius: var(--radius-sm) !important;
  }
  .simulation-stop-btn:hover { background: rgba(255,255,255,.15) !important; }

  /* Bandeau hors-ligne */
  .offline-banner {
    position: fixed;
    top: var(--titlebar-height, 32px);
    left: 0;
    right: 0;
    z-index: var(--z-banner);
    height: 36px;
    background: #2c2c2e;
    color: #a0a0a8;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    font-size: 12.5px;
    font-weight: 500;
    border-bottom: 1px solid rgba(255,255,255,.07);
  }

  .offline-banner-red  { background: #991b1b; color: #fecaca; }
  .offline-banner-green { background: #166534; color: #bbf7d0; }
  .reconnected-fade-enter-active { transition: opacity .3s; }
  .reconnected-fade-leave-active { transition: opacity .5s; }
  .reconnected-fade-enter-from, .reconnected-fade-leave-to { opacity: 0; }
  .notif-request-banner {
    position: fixed;
    bottom: 16px; left: 50%; transform: translateX(-50%);
    z-index: var(--z-modal-bg);
    display: flex; align-items: center; gap: 12px;
    padding: 10px 16px; border-radius: 10px;
    background: var(--bg-elevated, #272829);
    border: 1px solid var(--border, rgba(255,255,255,.06));
    box-shadow: 0 8px 30px rgba(0,0,0,.4);
    font-size: 13px; color: var(--text-primary);
    max-width: 520px;
  }
  .notif-req-btn {
    padding: 5px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;
    border: none; cursor: pointer;
  }
  .notif-req-accept { background: var(--accent); color: #fff; }
  .notif-req-dismiss { background: rgba(255,255,255,.08); color: var(--text-muted); }
  .simulation-banner.banner-shift { top: calc(var(--titlebar-height, 32px) + 36px); }

  /* Bandeau reconnexion socket */
  .socket-banner {
    position: fixed;
    top: var(--titlebar-height, 32px);
    left: 0;
    right: 0;
    z-index: var(--z-banner);
    height: 36px;
    background: #7f5539;
    color: #fde8cd;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 16px;
    font-size: 12.5px;
    font-weight: 500;
    border-bottom: 1px solid rgba(255,255,255,.07);
  }

  .socket-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255,255,255,.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin .8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg) } }

  /* ── Bannière RGPD ── */
  .privacy-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    background: rgba(0, 0, 0, .7);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .privacy-box {
    background: var(--bg-modal);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 0;
    max-width: 480px;
    width: 100%;
    box-shadow: 0 32px 80px rgba(0, 0, 0, .7);
    overflow: hidden;
  }

  .privacy-header {
    display: flex; align-items: center; gap: 14px;
    padding: 24px 28px 20px;
    background: linear-gradient(135deg, rgba(74,144,217,.1) 0%, rgba(155,135,245,.06) 100%);
    border-bottom: 1px solid var(--border);
  }

  .privacy-icon-wrap {
    width: 44px; height: 44px; border-radius: 12px;
    background: var(--accent); color: #fff;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }

  .privacy-title {
    font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.3;
  }

  .privacy-subtitle {
    font-size: 12px; color: var(--text-muted); margin: 2px 0 0; font-weight: 500;
  }

  .privacy-body {
    padding: 20px 28px 24px; display: flex; flex-direction: column; gap: 18px;
  }

  .privacy-section-title {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px;
    color: var(--text-muted); margin: 0 0 10px; display: flex; align-items: center; gap: 8px;
  }

  .privacy-badge {
    font-size: 9px; font-weight: 800; background: var(--accent); color: #fff;
    padding: 2px 7px; border-radius: 4px; letter-spacing: .5px;
  }

  .privacy-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

  .privacy-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px; background: rgba(255,255,255,.03);
    border: 1px solid var(--border); border-radius: 10px;
  }

  .privacy-item-icon { font-size: 16px; line-height: 1; margin-top: 1px; flex-shrink: 0; }
  .privacy-item div { display: flex; flex-direction: column; gap: 1px; }
  .privacy-item strong { font-size: 12px; font-weight: 600; color: var(--text-primary); }
  .privacy-item span { font-size: 10.5px; color: var(--text-muted); line-height: 1.3; }

  .privacy-rights { display: flex; flex-direction: column; gap: 6px; }

  .privacy-right {
    display: flex; align-items: center; gap: 8px; font-size: 12.5px;
    color: var(--text-secondary); padding: 8px 12px; background: rgba(255,255,255,.02);
    border-radius: 8px; border: 1px solid var(--border);
  }

  .privacy-path {
    font-size: 10px; color: var(--accent); font-weight: 600; margin-left: auto; opacity: .8;
  }

  .privacy-note {
    font-size: 11px; color: var(--text-muted); font-style: italic; text-align: center;
    padding-top: 4px; border-top: 1px solid var(--border); margin: 0; line-height: 1.5;
  }

  .privacy-accept {
    margin: 0 28px 24px; width: calc(100% - 56px); justify-content: center;
    padding: 11px; font-size: 13.5px; font-weight: 600; border-radius: 10px;
  }

  .privacy-fade-enter-active, .privacy-fade-leave-active { transition: opacity .2s ease; }
  .privacy-fade-enter-from, .privacy-fade-leave-to       { opacity: 0; }

  /* ── Route transition ── */
  .route-fade-enter-active { transition: opacity .15s ease; }
  .route-fade-leave-active { transition: opacity .1s ease; }
  .route-fade-enter-from, .route-fade-leave-to { opacity: 0; }

  /* Décaler le shell quand le bandeau est visible */
  .sidebar-with-banner,
  .main-with-banner {
    padding-top: 36px;
  }
</style>
