<script setup lang="ts">
  import { onMounted, onUnmounted, ref, computed, watch, watchEffect, onErrorCaptured } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { useAppStore }      from '@/stores/app'
  import { useModalsStore }   from '@/stores/modals'
  import { useMessagesStore } from '@/stores/messages'
  import { useLiveStore }     from '@/stores/live'
  import { usePrefs }       from '@/composables/usePrefs'
  import { useToast }       from '@/composables/useToast'
  import { useAppListeners } from '@/composables/useAppListeners'
  import { useSwipeNav }    from '@/composables/useSwipeNav'
  import { MessageSquare, FileText, Camera, Lock, Trash2, Download, UserX, Download as DownloadIcon, RefreshCw } from 'lucide-vue-next'
  import Toast        from '@/components/ui/Toast.vue'
  import ConfirmModal from '@/components/ui/ConfirmModal.vue'
  import NavRail    from '@/components/layout/NavRail.vue'
  import MobileNav  from '@/components/layout/MobileNav.vue'
  import TitleBar   from '@/components/layout/TitleBar.vue'
  import SidebarWrapper from '@/components/sidebar/SidebarWrapper.vue'
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
  import SignatureModal           from '@/components/modals/SignatureModal.vue'
  import OnboardingWizard         from '@/components/onboarding/OnboardingWizard.vue'

  const appStore = useAppStore()
  const modals   = useModalsStore()
  const liveStore = useLiveStore()
  const router   = useRouter()
  const { getPref } = usePrefs()
  const { showToast } = useToast()

  // ── Live invitation popup ─────────────────────────────────────────────────
  const liveInvite = ref<{ sessionId: number; title: string; joinCode: string; teacherName: string } | null>(null)
  let _liveInviteTimer: ReturnType<typeof setTimeout> | null = null
  let _unsubLiveInvite: (() => void) | null = null

  function dismissLiveInvite() {
    liveInvite.value = null
    if (_liveInviteTimer) { clearTimeout(_liveInviteTimer); _liveInviteTimer = null }
  }

  async function acceptLiveInvite() {
    if (!liveInvite.value) return
    const code = liveInvite.value.joinCode
    dismissLiveInvite()
    await liveStore.joinByCode(code)
    router.push('/live')
  }

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
      // Re-sync : recharger les messages du canal actif pour rattraper les messages manqués
      try { useMessagesStore().fetchMessages?.() } catch { /* ignore */ }
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

  // ── Mobile swipe navigation (ouvre/ferme la sidebar par glissement) ───────
  useSwipeNav(sidebarOpen, toggleSidebar)

  // ── Changement de mot de passe forcé (première connexion) ─────────────────
  const showForcedPasswordChange = computed(() =>
    !!appStore.currentUser && appStore.currentUser.must_change_password === 1,
  )

  // ── Onboarding wizard (étudiants, première connexion) ──────────────────────
  const showOnboarding = computed(() =>
    !!appStore.currentUser
    && appStore.currentUser.type === 'student'
    && appStore.currentUser.onboarding_done !== 1
    && appStore.currentUser.must_change_password !== 1,
  )
  const onboardingChannels = ref<Array<{ id: number; name: string; type: string; description?: string | null }>>([])

  watch(showOnboarding, async (show) => {
    if (show && appStore.currentUser?.promo_id) {
      try {
        const res = await window.api.getChannels(appStore.currentUser.promo_id)
        if (res?.ok) onboardingChannels.value = res.data
      } catch { /* ignore */ }
    }
  }, { immediate: true })

  async function onOnboardingComplete() {
    if (appStore.currentUser) {
      try {
        await window.api.completeOnboarding(appStore.currentUser.id)
      } catch { /* ignore */ }
      appStore.login({ ...appStore.currentUser, onboarding_done: 1 })
    }
  }

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

  // ── Floating feedback (étudiants uniquement) ──────────────────────────────
  const showFloatingFeedback = ref(false)
  const fbType = ref('bug')
  const fbDesc = ref('')
  const fbSending = ref(false)

  async function submitFloatingFeedback() {
    if (!fbDesc.value.trim()) return
    fbSending.value = true
    try {
      const page = window.location.hash || window.location.pathname
      const desc = `${fbDesc.value.trim()}\n\n[Page: ${page}]`
      const res = await window.api.submitFeedback(fbType.value, fbType.value === 'bug' ? 'Bug report' : fbType.value === 'suggestion' ? 'Suggestion' : 'Question', desc)
      if (res?.ok) {
        showToast('Merci pour votre retour !', 'success')
        fbDesc.value = ''
        showFloatingFeedback.value = false
      }
    } catch { showToast('Erreur lors de l\'envoi.', 'error') }
    fbSending.value = false
  }

  // ── Global error handler ──────────────────────────────────────────────────
  onErrorCaptured((err) => {
    console.error('[ErrorBoundary]', err)
    showToast('Une erreur est survenue. Utilisez le bouton de feedback pour la signaler.', 'error')
    return false
  })

  // ── Network status (online/offline) ───────────────────────────────────────
  const isOffline = ref(!navigator.onLine)
  function onOnline()  { isOffline.value = false; showToast('Connexion rétablie', 'success') }
  function onOffline() { isOffline.value = true }

  // ── Guard router : bloquer la navigation si must_change_password ou onboarding ─
  router.beforeEach((_to, _from, next) => {
    if (showForcedPasswordChange.value || showOnboarding.value) {
      next(false)
      return
    }
    next()
  })

  // ── Titre dynamique de l'onglet navigateur ────────────────────────────────
  const route = useRoute()
  const ROUTE_LABELS: Record<string, string> = {
    dashboard: 'Accueil',
    messages: 'Messages',
    devoirs: 'Devoirs',
    documents: 'Documents',
    live: 'Quiz',
  }

  const totalUnreadBadge = computed(() => {
    const dmCount = Object.values(appStore.unreadDms ?? {}).reduce((a: number, b) => a + (b as number), 0)
    const mentionCount = Object.values(appStore.mentionChannels ?? {}).reduce((a: number, b) => a + (b as number), 0)
    return dmCount + mentionCount
  })

  // Badge barre des taches Windows (debounce 200ms pour eviter les IPC repetitifs)
  let _badgeTimer: ReturnType<typeof setTimeout> | null = null
  watchEffect(() => {
    const hasUnread = totalUnreadBadge.value > 0
    if (_badgeTimer) clearTimeout(_badgeTimer)
    _badgeTimer = setTimeout(() => {
      if (hasUnread) window.api?.setBadge?.()
      else window.api?.clearBadge?.()
    }, 200)
  })

  watchEffect(() => {
    const section = ROUTE_LABELS[route.name as string] ?? 'Cursus'
    const count = totalUnreadBadge.value
    if (count > 0) {
      document.title = `(${count}) ${section} · Cursus`
    } else {
      document.title = `${section} · Cursus`
    }
  })

  // ── Bannière de mise à jour ───────────────────────────────────────────────
  type UpdateState = 'idle' | 'downloading' | 'ready'
  const updateState   = ref<UpdateState>('idle')
  const updateVersion = ref('')
  let _unsubUpdaterAvailable:  (() => void) | null = null
  let _unsubUpdaterDownloaded: (() => void) | null = null

  function dismissUpdate() { updateState.value = 'idle' }
  function quitAndInstall() { window.api.updaterQuitAndInstall() }

  // Listeners extraits dans un composable dedie
  const { initListeners, cleanupListeners } = useAppListeners()
  let unsubGradeNew: (() => void) | null = null

  onMounted(() => {
    initListeners()

    // Appliquer le theme sauvegarde
    const theme = getPref('theme') ?? 'dark'
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

    // Global error handlers
    window.onerror = (_msg, _src, _line, _col, err) => {
      console.error('[GlobalError]', err)
      showToast('Une erreur est survenue. Utilisez le bouton de feedback pour la signaler.', 'error')
    }
    window.onunhandledrejection = (e: PromiseRejectionEvent) => {
      console.error('[UnhandledRejection]', e.reason)
      showToast('Une erreur est survenue. Utilisez le bouton de feedback pour la signaler.', 'error')
    }

    // Network status listeners
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Restaurer la session depuis localStorage
    const restored = appStore.restoreSession()
    if (restored) router.replace('/messages')

    // Listeners globaux deja initialises via initListeners()

    // Écouter les invitations live (étudiants uniquement)
    _unsubLiveInvite = window.api.onLiveInvite((data) => {
      if (appStore.isStaff) return // Les profs n'ont pas besoin de l'invitation
      liveInvite.value = data
      if (_liveInviteTimer) clearTimeout(_liveInviteTimer)
      _liveInviteTimer = setTimeout(() => { liveInvite.value = null }, 30_000)
    })

    // Écouter les événements de mise à jour
    _unsubUpdaterAvailable = window.api.onUpdaterAvailable((version: string) => {
      updateVersion.value = version
      updateState.value = 'downloading'
    })
    _unsubUpdaterDownloaded = window.api.onUpdaterDownloaded((version: string) => {
      updateVersion.value = version
      updateState.value = 'ready'
    })

    // Écouter les notifications de notes (étudiants uniquement)
    unsubGradeNew = window.api.onGradeNew((data) => {
      if (appStore.isStaff) return
      const label = data.note
        ? `Nouvelle note : ${data.note} sur ${data.devoirTitle}`
        : `Nouveau feedback sur ${data.devoirTitle}`
      appStore.addNotification({
        category: 'grade',
        title: data.note ? 'Nouvelle note' : 'Nouveau feedback',
        preview: label,
        channelName: data.devoirTitle,
        authorName: data.note ? `Note : ${data.note}` : 'Feedback',
      })
      window.api?.setBadge?.()
    })

    // Écouter les mises à jour de signature (étudiants)
    window.api.onSignatureUpdate?.((data) => {
      if (appStore.isStaff) return
      appStore.addNotification({
        category: 'signature',
        title: data.status === 'signed' ? 'Document signe' : 'Signature refusee',
        preview: data.signer_name ? `Par ${data.signer_name}` : '',
        channelName: 'Signature',
      })
    })

    // Écouter les nouveaux documents
    window.api.onDocumentNew?.((data: { name: string; category?: string }) => {
      if (appStore.isStaff) return
      appStore.addNotification({
        category: 'document',
        title: 'Nouveau document',
        preview: data.name,
        channelName: data.category || 'Document',
      })
    })

    // Écouter les nouveaux devoirs
    window.api.onAssignmentNew?.((data: { title: string; category?: string; deadline?: string }) => {
      if (appStore.isStaff) return
      appStore.addNotification({
        category: 'assignment',
        title: 'Nouveau devoir',
        preview: data.title,
        channelName: data.category || 'Devoir',
      })
    })
  })

  onUnmounted(() => {
    cleanupListeners()
    _unsubLiveInvite?.()
    unsubGradeNew?.()
    _unsubUpdaterAvailable?.()
    _unsubUpdaterDownloaded?.()
    dismissLiveInvite()
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  })
</script>

<template>
  <!-- Toast global (accessible depuis n'importe quel composant) -->
  <Toast />
  <!-- Modal de confirmation global -->
  <ConfirmModal />

  <!-- Invitation Live (étudiants) - flottante en haut à droite -->
  <Transition name="live-invite-slide">
    <div v-if="liveInvite" class="live-invite-popup">
      <div class="live-invite-content">
        <div class="live-invite-header">
          <span class="live-invite-dot" />
          <strong>{{ liveInvite.teacherName }}</strong> vous invite a un quiz
        </div>
        <div class="live-invite-title">{{ liveInvite.title }}</div>
        <div class="live-invite-actions">
          <button class="live-invite-btn live-invite-join" @click="acceptLiveInvite">Rejoindre</button>
          <button class="live-invite-btn live-invite-dismiss" @click="dismissLiveInvite">Ignorer</button>
        </div>
      </div>
    </div>
  </Transition>

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
    <div v-if="!appStore.isOnline || isOffline" class="offline-banner offline-banner-yellow">
      <span>Connexion perdue - vos modifications seront envoyées à la reconnexion</span>
    </div>

    <!-- Bandeau reconnexion socket -->
    <!-- Reconnexion : toast discret au lieu de bandeau -->

    <!-- Bandeau session expirée -->
    <div v-if="appStore.sessionExpiredMessage" class="offline-banner offline-banner-red">
      <span>{{ appStore.sessionExpiredMessage }}</span>
    </div>

    <!-- Bandeau mise à jour -->
    <Transition name="reconnected-fade">
      <div v-if="updateState !== 'idle'" class="update-banner" :class="updateState === 'ready' ? 'update-banner--ready' : 'update-banner--downloading'">
        <div class="update-banner-left">
          <RefreshCw v-if="updateState === 'downloading'" :size="14" class="update-spin" />
          <DownloadIcon v-else :size="14" />
          <span v-if="updateState === 'downloading'">Mise à jour {{ updateVersion }} en cours de téléchargement…</span>
          <span v-else>Mise à jour {{ updateVersion }} prête à installer</span>
        </div>
        <div class="update-banner-actions">
          <button v-if="updateState === 'ready'" class="update-btn-restart" @click="quitAndInstall">
            Redémarrer maintenant
          </button>
          <button class="update-btn-dismiss" @click="dismissUpdate">&times;</button>
        </div>
      </div>
    </Transition>

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
      <SidebarWrapper @navigate="closeSidebar" />
    </aside>

    <main class="main-wrapper" :class="{ 'main-with-banner': appStore.isSimulating || !appStore.isOnline }">
      <!-- Vue active (messages / travaux / documents) -->
      <RouterView v-slot="{ Component }">
        <component :is="Component" :key="$route.path" :toggle-sidebar="toggleSidebar" />
      </RouterView>
    </main>
    </div><!-- /.app-columns -->

    <!-- Navigation mobile (bottom bar, < 768px) -->
    <MobileNav />

    <!-- Bouton flottant feedback (étudiants uniquement) -->
    <button
      v-if="appStore.isStudent"
      class="fab-feedback"
      title="Signaler un bug ou faire une suggestion"
      aria-label="Feedback"
      @click="showFloatingFeedback = !showFloatingFeedback"
    >?</button>

    <!-- Mini-modale feedback flottante -->
    <Transition name="fab-modal-fade">
      <div v-if="showFloatingFeedback && appStore.isStudent" class="fab-feedback-modal">
        <div class="fab-fb-header">
          <span class="fab-fb-title">Feedback rapide</span>
          <button class="fab-fb-close" @click="showFloatingFeedback = false">&times;</button>
        </div>
        <div class="fab-fb-types">
          <button v-for="t in [{id:'bug',label:'Bug'},{id:'suggestion',label:'Suggestion'},{id:'question',label:'Question'}]" :key="t.id" class="fab-fb-type" :class="{active:fbType===t.id}" @click="fbType=t.id">{{ t.label }}</button>
        </div>
        <textarea v-model="fbDesc" class="fab-fb-textarea" placeholder="Décrivez ce qui s'est passé..." rows="3" maxlength="1000" />
        <button class="fab-fb-submit" :disabled="!fbDesc.trim() || fbSending" @click="submitFloatingFeedback">
          {{ fbSending ? 'Envoi...' : 'Envoyer' }}
        </button>
      </div>
    </Transition>
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
    <SignatureModal
      v-if="modals.signatureRequest"
      :request="modals.signatureRequest"
      @close="modals.signatureRequest = null"
      @signed="modals.signatureRequest = null"
    />

    <!-- Changement de mot de passe forcé (première connexion) -->
    <ChangePasswordModal
      :model-value="showForcedPasswordChange"
      :forced="true"
      @update:model-value="() => {}"
      @changed="() => {}"
    />

    <!-- Wizard d'onboarding (étudiants, après changement de mot de passe) -->
    <OnboardingWizard
      v-if="showOnboarding"
      :user="appStore.currentUser!"
      :channels="onboardingChannels"
      @complete="onOnboardingComplete"
    />
  </template>

  <!-- Banniere RGPD (premiere utilisation ou via Settings) -->
  <Transition name="privacy-fade">
    <div v-if="showPrivacy && appStore.currentUser" class="privacy-overlay" role="dialog" aria-modal="true" aria-label="Politique de confidentialité">
      <div class="privacy-box">
        <div class="privacy-header">
          <div>
            <h3 class="privacy-title">Confidentialité et données</h3>
            <p class="privacy-subtitle">Comment Cursus protège vos informations</p>
          </div>
        </div>

        <div class="privacy-body">
          <div class="privacy-section">
            <h4 class="privacy-section-title">Données collectées</h4>
            <div class="privacy-grid">
              <div class="privacy-item">
                <MessageSquare :size="16" class="privacy-item-icon" />
                <div><strong>Messages</strong><span>Base de données locale</span></div>
              </div>
              <div class="privacy-item">
                <FileText :size="16" class="privacy-item-icon" />
                <div><strong>Rendus et notes</strong><span>Accessibles au responsable</span></div>
              </div>
              <div class="privacy-item">
                <Camera :size="16" class="privacy-item-icon" />
                <div><strong>Photo de profil</strong><span>Visible par votre promo</span></div>
              </div>
              <div class="privacy-item">
                <Lock :size="16" class="privacy-item-icon" />
                <div><strong>Mot de passe</strong><span>Chiffré (bcrypt)</span></div>
              </div>
            </div>
          </div>

          <div class="privacy-section">
            <h4 class="privacy-section-title">Vos droits <span class="privacy-badge">RGPD</span></h4>
            <div class="privacy-rights">
              <div class="privacy-right"><Trash2 :size="14" class="privacy-right-icon" /> Supprimer vos messages</div>
              <div class="privacy-right"><Download :size="14" class="privacy-right-icon" /> Exporter vos données <span class="privacy-path">Paramètres → Compte</span></div>
              <div class="privacy-right"><UserX :size="14" class="privacy-right-icon" /> Demander la suppression du compte</div>
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
    background: var(--color-warning);
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
    border: 1px solid var(--border) !important;
    padding: 3px 10px !important;
    font-size: 12px !important;
    border-radius: var(--radius-sm) !important;
  }
  .simulation-stop-btn:hover { background: var(--bg-active) !important; }
  .simulation-stop-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }

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
    border-bottom: 1px solid var(--border);
  }

  .offline-banner-red  { background: #991b1b; color: #fecaca; }
  .offline-banner-green { background: #166534; color: #bbf7d0; }
  .reconnected-fade-enter-active { transition: opacity var(--t-slow); }
  .reconnected-fade-leave-active { transition: opacity .5s; }
  .reconnected-fade-enter-from, .reconnected-fade-leave-to { opacity: 0; }
  .notif-request-banner {
    position: fixed;
    bottom: 16px; left: 50%; transform: translateX(-50%);
    z-index: var(--z-modal-bg);
    display: flex; align-items: center; gap: 12px;
    padding: 10px 16px; border-radius: var(--radius);
    background: var(--bg-elevated, #272829);
    border: 1px solid var(--border, rgba(255,255,255,.06));
    box-shadow: 0 8px 30px rgba(0,0,0,.4);
    font-size: 13px; color: var(--text-primary);
    max-width: 520px;
  }
  .notif-req-btn {
    padding: 5px 12px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600;
    border: none; cursor: pointer;
  }
  .notif-req-accept { background: var(--accent); color: #fff; }
  .notif-req-dismiss { background: var(--bg-active); color: var(--text-muted); }
  .simulation-banner.banner-shift { top: calc(var(--titlebar-height, 32px) + 36px); }

  /* ── Bannière mise à jour ── */
  .update-banner {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-modal-bg);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 10px 14px;
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 8px 30px rgba(0,0,0,.4);
    white-space: nowrap;
    border: 1px solid transparent;
  }
  .update-banner--downloading {
    background: var(--bg-elevated, #272829);
    border-color: var(--border, rgba(255,255,255,.08));
    color: var(--text-primary);
  }
  .update-banner--ready {
    background: #0f4c3a;
    border-color: var(--color-success);
    color: #bbf7d0;
  }
  .update-banner-left { display: flex; align-items: center; gap: 8px; }
  .update-banner-actions { display: flex; align-items: center; gap: 6px; }
  .update-btn-restart {
    padding: 5px 12px; border-radius: var(--radius-sm); border: none; cursor: pointer;
    background: var(--color-success); color: #0a2e1f; font-size: 12px; font-weight: 700;
    font-family: var(--font);
  }
  .update-btn-restart:hover { background: #4ade80; }
  .update-btn-restart:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }
  .update-btn-dismiss {
    background: transparent; border: none; cursor: pointer;
    color: inherit; opacity: .6; font-size: 16px; line-height: 1; padding: 2px 4px;
  }
  .update-btn-dismiss:hover { opacity: 1; }
  .update-btn-dismiss:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .update-spin { animation: spin 1.4s linear infinite; }

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
    border-bottom: 1px solid var(--border);
  }

  .socket-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--border);
    border-top-color: #fff;
    border-radius: var(--radius-full);
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
    border-radius: var(--radius-xl);
    padding: 0;
    max-width: 480px;
    width: 100%;
    box-shadow: 0 32px 80px rgba(0, 0, 0, .7);
    overflow: hidden;
  }

  .privacy-header {
    display: flex; align-items: center; gap: 14px;
    padding: 24px 28px 20px;
    border-bottom: 1px solid var(--border);
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
    padding: 2px 7px; border-radius: var(--radius-xs); letter-spacing: .5px;
  }

  .privacy-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

  .privacy-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px; background: var(--bg-elevated);
    border: 1px solid var(--border); border-radius: var(--radius);
  }

  .privacy-item-icon { flex-shrink: 0; color: var(--accent); margin-top: 1px; }
  .privacy-right-icon { flex-shrink: 0; color: var(--text-muted); }
  .privacy-item div { display: flex; flex-direction: column; gap: 1px; }
  .privacy-item strong { font-size: 12px; font-weight: 600; color: var(--text-primary); }
  .privacy-item span { font-size: 10.5px; color: var(--text-muted); line-height: 1.3; }

  .privacy-rights { display: flex; flex-direction: column; gap: 6px; }

  .privacy-right {
    display: flex; align-items: center; gap: 8px; font-size: 12.5px;
    color: var(--text-secondary); padding: 8px 12px; background: var(--bg-elevated);
    border-radius: var(--radius); border: 1px solid var(--border);
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
    padding: 11px; font-size: 13.5px; font-weight: 600; border-radius: var(--radius);
  }

  .privacy-fade-enter-active, .privacy-fade-leave-active { transition: opacity var(--t-base) ease; }
  .privacy-fade-enter-from, .privacy-fade-leave-to       { opacity: 0; }

  /* ── Route transition ── */
  .route-fade-enter-active { transition: opacity var(--t-base) ease; }
  .route-fade-leave-active { transition: opacity var(--t-fast) ease; }
  .route-fade-enter-from, .route-fade-leave-to { opacity: 0; }

  /* Décaler le shell quand le bandeau est visible */
  .sidebar-with-banner,
  .main-with-banner {
    padding-top: 36px;
  }

  /* ── Bandeau hors-ligne jaune ── */
  .offline-banner-yellow {
    background: #78350f;
    color: #fef3c7;
    border-bottom: 1px solid var(--border);
  }

  /* ── Bouton flottant feedback ── */
  .fab-feedback {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: var(--z-sticky);
    width: 40px;
    height: 40px;
    border-radius: var(--radius-full);
    background: var(--accent, #4A90D9);
    color: #fff;
    border: none;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,0,0,.35);
    transition: transform var(--t-base), box-shadow var(--t-base);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .fab-feedback:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(0,0,0,.45); }
  .fab-feedback:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }

  /* ── Mini-modale feedback ── */
  .fab-feedback-modal {
    position: fixed;
    bottom: 70px;
    right: 20px;
    z-index: var(--z-sticky);
    width: 300px;
    background: var(--bg-modal, #1e1f21);
    border: 1px solid var(--border, rgba(255,255,255,.08));
    border-radius: var(--radius-lg);
    padding: 14px;
    box-shadow: 0 12px 40px rgba(0,0,0,.5);
  }
  .fab-fb-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .fab-fb-title { font-size: 13px; font-weight: 700; color: var(--text-primary); }
  .fab-fb-close { background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer; padding: 0 4px; line-height: 1; }
  .fab-fb-types { display: flex; gap: 4px; margin-bottom: 8px; }
  .fab-fb-type {
    flex: 1; padding: 5px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 600;
    background: var(--bg-hover); color: var(--text-secondary);
    border: 1px solid var(--border); cursor: pointer; transition: all var(--t-fast);
  }
  .fab-fb-type.active { background: var(--accent-subtle); color: var(--accent); border-color: var(--accent); }
  .fab-fb-textarea {
    width: 100%; background: var(--bg-input); border: 1px solid var(--border-input);
    border-radius: var(--radius); padding: 8px 10px; color: var(--text-primary); font-size: 12px;
    margin-bottom: 8px; font-family: inherit; resize: vertical; box-sizing: border-box;
  }
  .fab-fb-submit {
    width: 100%; padding: 7px; border-radius: var(--radius); font-size: 12px; font-weight: 600;
    background: var(--accent); color: #fff; border: none; cursor: pointer;
  }
  .fab-fb-submit:disabled { opacity: .4; cursor: not-allowed; }

  .fab-modal-fade-enter-active { transition: opacity var(--t-base) ease, transform var(--t-base) ease; }
  .fab-modal-fade-leave-active { transition: opacity var(--t-fast) ease, transform var(--t-fast) ease; }
  .fab-modal-fade-enter-from { opacity: 0; transform: translateY(8px); }
  .fab-modal-fade-leave-to   { opacity: 0; transform: translateY(8px); }

  /* ── Live Invite Popup ── */
  .live-invite-popup {
    position: fixed;
    top: calc(var(--titlebar-height, 32px) + 12px);
    right: 16px;
    z-index: calc(var(--z-overlay, 9999) + 1);
    width: 340px;
    max-width: calc(100vw - 32px);
  }
  .live-invite-content {
    background: var(--bg-modal, #1e1f21);
    border: 2px solid var(--accent, #4a90d9);
    border-radius: var(--radius-lg);
    padding: 16px;
    box-shadow: 0 12px 40px rgba(0,0,0,.5), 0 0 0 1px rgba(74,144,217,.15);
  }
  .live-invite-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-primary);
    margin-bottom: 8px;
    line-height: 1.4;
  }
  .live-invite-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background: var(--color-danger);
    flex-shrink: 0;
    animation: live-invite-pulse 2s infinite;
  }
  @keyframes live-invite-pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(239,68,68,.4); }
    50% { opacity: .7; box-shadow: 0 0 0 4px rgba(239,68,68,0); }
  }
  .live-invite-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 12px;
    padding-left: 16px;
  }
  .live-invite-actions {
    display: flex;
    gap: 8px;
  }
  .live-invite-btn {
    flex: 1;
    padding: 8px 14px;
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all var(--t-base);
    font-family: var(--font);
  }
  .live-invite-join {
    background: var(--accent, #4a90d9);
    color: #fff;
  }
  .live-invite-join:hover {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }
  .live-invite-dismiss {
    background: var(--bg-active);
    color: var(--text-muted);
  }
  .live-invite-dismiss:hover {
    background: var(--bg-active);
    color: var(--text-primary);
  }
  .live-invite-btn:focus-visible { outline: var(--focus-ring); outline-offset: var(--focus-offset); }

  /* Slide-in from right */
  .live-invite-slide-enter-active { transition: opacity var(--t-slow) ease, transform var(--t-slow) cubic-bezier(.34,1.56,.64,1); }
  .live-invite-slide-leave-active { transition: opacity var(--t-base) ease, transform var(--t-base) ease; }
  .live-invite-slide-enter-from { opacity: 0; transform: translateX(60px); }
  .live-invite-slide-leave-to   { opacity: 0; transform: translateX(60px); }
</style>
