<script setup lang="ts">
  import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAppStore }      from '@/stores/app'
  import { useModalsStore }   from '@/stores/modals'
  import { useMessagesStore } from '@/stores/messages'
  import { usePrefs }       from '@/composables/usePrefs'
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

  const promoCreatedKey = ref(0)
  function onPromoCreated() { promoCreatedKey.value++ }

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

  // Réinitialiser après déconnexion/reconnexion
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

  let unsubUnread:  (() => void) | null = null
  let unsubOnline:  (() => void) | null = null
  let unsubSocket:  (() => void) | null = null
  let unsubTyping:  (() => void) | null = null

  onMounted(() => {
    // Appliquer le thème sauvegardé
    const theme = getPref('theme') ?? 'dark'
    document.body.classList.remove('light', 'night', 'marine')
    if (theme !== 'dark') document.body.classList.add(theme)

    // Demander la permission pour les notifications natives
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Restaurer la session depuis localStorage
    const restored = appStore.restoreSession()
    if (restored) router.replace('/messages')

    // Écouter les messages temps-réel (IPC push)
    unsubUnread = appStore.initUnreadListener()

    // Écouter les changements de connectivité réseau
    unsubOnline = appStore.initOnlineListener()

    // Écouter l'état du socket temps-réel
    unsubSocket = appStore.initSocketListener()

    // Écouter les indicateurs de frappe
    const messagesStore = useMessagesStore()
    unsubTyping = messagesStore.initTypingListener()
  })

  onUnmounted(() => { unsubUnread?.(); unsubOnline?.(); unsubSocket?.(); unsubTyping?.() })
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
    <div v-if="!appStore.isOnline" class="offline-banner">
      <span>Mode hors-ligne — les données locales restent accessibles, les liens externes sont indisponibles.</span>
    </div>

    <!-- Bandeau reconnexion socket -->
    <div v-else-if="appStore.currentUser && !appStore.socketConnected" class="socket-banner">
      <span class="socket-spinner" />
      <span>Reconnexion au serveur en cours…</span>
    </div>

    <!-- Bandeau simulation étudiant -->
    <div v-if="appStore.isSimulating" id="simulation-banner" class="simulation-banner" :class="{ 'banner-shift': !appStore.isOnline }">
      <span>
        Simulation : <strong>{{ appStore.currentUser?.name }}</strong>
        — vous voyez l'app comme cet étudiant
      </span>
      <button class="btn-ghost simulation-stop-btn" @click="appStore.stopSimulation()">
        Quitter la simulation
      </button>
    </div>

    <!-- Backdrop mobile pour fermer le drawer sidebar -->
    <div class="sidebar-backdrop" :class="{ visible: sidebarOpen }" @click="closeSidebar" />

    <aside class="sidebar-wrapper" :class="{ 'sidebar-with-banner': appStore.isSimulating || !appStore.isOnline || !appStore.socketConnected, 'mobile-open': sidebarOpen }">
      <Sidebar @navigate="closeSidebar" />
    </aside>

    <main class="main-wrapper" :class="{ 'main-with-banner': appStore.isSimulating || !appStore.isOnline || !appStore.socketConnected }">
      <!-- Vue active (messages / travaux / documents) -->
      <RouterView v-slot="{ Component }">
        <component :is="Component" :toggle-sidebar="toggleSidebar" />
      </RouterView>
    </main>
    </div><!-- /.app-columns -->
  </div>

  <!-- Modales globales — montées une fois, visibilité gérée par le store modals -->
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

  <!-- Bannière RGPD (première utilisation) -->
  <Transition name="privacy-fade">
    <div v-if="showPrivacy && appStore.currentUser" class="privacy-overlay" role="dialog" aria-modal="true" aria-label="Politique de confidentialité">
      <div class="privacy-box">
        <div class="privacy-icon">🔒</div>
        <h3 class="privacy-title">Vos données &amp; confidentialité</h3>
        <div class="privacy-body">
          <p>Cursus stocke localement les données suivantes :</p>
          <ul>
            <li><strong>Messages</strong> — conservés dans la base de données locale de l'établissement.</li>
            <li><strong>Rendus &amp; notes</strong> — accessibles à votre responsable pédagogique.</li>
            <li><strong>Photo de profil</strong> — visible par les membres de votre promotion.</li>
            <li><strong>Mot de passe</strong> — stocké de façon chiffrée (bcrypt), jamais transmis en clair.</li>
          </ul>
          <p>Conformément au <strong>RGPD (Art. 17 &amp; 20)</strong>, vous pouvez à tout moment :</p>
          <ul>
            <li>Supprimer vos propres messages</li>
            <li>Exporter vos données personnelles (Paramètres → Compte)</li>
            <li>Demander la suppression de votre compte à l'administrateur</li>
          </ul>
          <p class="privacy-note">Ces données sont exclusivement utilisées dans le cadre de votre formation et ne sont jamais transmises à des tiers.</p>
        </div>
        <button class="btn-primary privacy-accept" @click="acceptPrivacy">
          J'ai compris
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
    z-index: 200;
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
    z-index: 201;
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

  .simulation-banner.banner-shift { top: calc(var(--titlebar-height, 32px) + 36px); }

  /* Bandeau reconnexion socket */
  .socket-banner {
    position: fixed;
    top: var(--titlebar-height, 32px);
    left: 0;
    right: 0;
    z-index: 201;
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
    z-index: 2000;
    background: rgba(0, 0, 0, .65);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }

  .privacy-box {
    background: var(--bg-modal);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 28px 32px;
    max-width: 520px;
    width: 100%;
    box-shadow: 0 32px 80px rgba(0, 0, 0, .7);
  }

  .privacy-icon {
    font-size: 32px;
    margin-bottom: 12px;
    line-height: 1;
  }

  .privacy-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 14px;
  }

  .privacy-body {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .privacy-body p { margin: 0 0 8px; }
  .privacy-body ul { margin: 0 0 8px; padding-left: 20px; }
  .privacy-body li { margin-bottom: 4px; }

  .privacy-note {
    font-size: 11.5px !important;
    color: var(--text-muted) !important;
    font-style: italic;
    border-top: 1px solid var(--border);
    padding-top: 10px;
    margin-top: 10px !important;
  }

  .privacy-accept {
    margin-top: 18px;
    width: 100%;
    justify-content: center;
    padding: 10px;
    font-size: 14px;
  }

  .privacy-fade-enter-active, .privacy-fade-leave-active { transition: opacity .2s ease; }
  .privacy-fade-enter-from, .privacy-fade-leave-to       { opacity: 0; }

  /* Décaler le shell quand le bandeau est visible */
  .sidebar-with-banner,
  .main-with-banner {
    padding-top: 36px;
  }
</style>
