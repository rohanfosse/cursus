<script setup lang="ts">
  import { onMounted, onUnmounted, ref, computed, watch, watchEffect, onErrorCaptured, defineAsyncComponent } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { useAppStore }      from '@/stores/app'
  import { useModalsStore }   from '@/stores/modals'
  import { useMessagesStore } from '@/stores/messages'
  import { useLiveStore }     from '@/stores/live'
  import { useBookmarksStore } from '@/stores/bookmarks'
  import { useStatusesStore } from '@/stores/statuses'
  import { useScheduledStore } from '@/stores/scheduled'
  import { usePrefs }       from '@/composables/usePrefs'
  import { useToast }       from '@/composables/useToast'
  import { useAppListeners } from '@/composables/useAppListeners'
  import { useSwipeNav }    from '@/composables/useSwipeNav'
  import { useModules }     from '@/composables/useModules'
  import { useLumenFocus }  from '@/composables/useLumenFocus'
  import { useSocketReconnectToast } from '@/composables/useSocketReconnectToast'
  import { useNotificationBanner } from '@/composables/useNotificationBanner'
  import { useDemoPresence } from '@/composables/useDemoPresence'
  import { useDemoNotifications } from '@/composables/useDemoNotifications'
  import { useDemoTyping } from '@/composables/useDemoTyping'
  import { resolveStartRoute } from '@/router'
  import { reportError }    from '@/utils/errorReporter'
  import { MessageSquare, FileText, Camera, Lock, Trash2, Download, UserX, Download as DownloadIcon, RefreshCw, Shield, Scale, Clock, Mail, Globe, Eye, Pencil, ChevronDown, Server, Zap } from 'lucide-vue-next'
  import Toast        from '@/components/ui/Toast.vue'
  import ConfirmModal from '@/components/ui/ConfirmModal.vue'
  import NavRail    from '@/components/layout/NavRail.vue'
  import MobileNav  from '@/components/layout/MobileNav.vue'
  import TitleBar   from '@/components/layout/TitleBar.vue'
  import DemoBanner from '@/components/layout/DemoBanner.vue'
  import DemoOnboardingTour from '@/components/demo/DemoOnboardingTour.vue'
  import SidebarWrapper from '@/components/sidebar/SidebarWrapper.vue'
  import LoginOverlay        from '@/components/auth/LoginOverlay.vue'
  // Modales frequentes gardees synchrones : ConfirmModal (hot via useConfirm),
  // CmdPalette (Ctrl+K instant), ChangePasswordModal (force a la 1re connexion).
  import CmdPalette           from '@/components/modals/CmdPalette.vue'
  import ChangePasswordModal from '@/components/modals/ChangePasswordModal.vue'

  // Modales rares => async : chunk separe, charge au 1er usage seulement.
  // Economise ~400-800 Ko de JS au boot du renderer.
  const SettingsModal        = defineAsyncComponent(() => import('@/components/modals/SettingsModal.vue'))
  const CreateChannelModal   = defineAsyncComponent(() => import('@/components/modals/CreateChannelModal.vue'))
  const NewDevoirModal       = defineAsyncComponent(() => import('@/components/modals/NewDevoirModal.vue'))
  const DepotsModal          = defineAsyncComponent(() => import('@/components/modals/DepotsModal.vue'))
  const SuiviModal           = defineAsyncComponent(() => import('@/components/modals/SuiviModal.vue'))
  const GestionDevoirModal   = defineAsyncComponent(() => import('@/components/modals/GestionDevoirModal.vue'))
  const RessourcesModal      = defineAsyncComponent(() => import('@/components/modals/RessourcesModal.vue'))
  const TimelineModal        = defineAsyncComponent(() => import('@/components/modals/TimelineModal.vue'))
  const EcheancierModal      = defineAsyncComponent(() => import('@/components/modals/EcheancierModal.vue'))
  const DocumentPreviewModal = defineAsyncComponent(() => import('@/components/modals/DocumentPreviewModal.vue'))
  const ImpersonateModal     = defineAsyncComponent(() => import('@/components/modals/ImpersonateModal.vue'))
  const StudentTimelineModal = defineAsyncComponent(() => import('@/components/modals/StudentTimelineModal.vue'))
  const RubricModal          = defineAsyncComponent(() => import('@/components/modals/RubricModal.vue'))
  const ImportStudentsModal  = defineAsyncComponent(() => import('@/components/modals/ImportStudentsModal.vue'))
  const IntervenantsModal    = defineAsyncComponent(() => import('@/components/modals/IntervenantsModal.vue'))
  const ClasseModal          = defineAsyncComponent(() => import('@/components/modals/ClasseModal.vue'))
  const CreatePromoModal     = defineAsyncComponent(() => import('@/components/modals/CreatePromoModal.vue'))
  const SignatureModal       = defineAsyncComponent(() => import('@/components/modals/SignatureModal.vue'))
  const OnboardingWizard     = defineAsyncComponent(() => import('@/components/onboarding/OnboardingWizard.vue'))

  const appStore = useAppStore()
  const modals   = useModalsStore()
  const liveStore = useLiveStore()
  const bookmarksStore = useBookmarksStore()
  const statusesStore = useStatusesStore()
  const scheduledStore = useScheduledStore()
  const router   = useRouter()
  const { getPref } = usePrefs()
  const { showToast } = useToast()
  const { loadModules } = useModules()
  const { lumenFocusMode } = useLumenFocus()

  // ── Listeners extraits dans useAppListeners ────────────────────────────────
  const { initListeners, cleanupListeners, liveInvite, updateState, updateVersion, dismissLiveInvite } = useAppListeners()

  async function acceptLiveInvite() {
    if (!liveInvite.value) return
    const code = liveInvite.value.joinCode
    dismissLiveInvite()
    await liveStore.joinByCode(code)
    router.push('/live')
  }

  const promoCreatedKey = ref(0)
  function onPromoCreated() { promoCreatedKey.value++ }

  // "Signer + suivant" : apres une signature, on ouvre la prochaine demande
  // en attente (hors courante). Evite au prof de re-cliquer dans la sidebar.
  async function openNextPendingSignature() {
    try {
      const { useSignature } = await import('@/composables/useSignature')
      const sig = useSignature()
      await sig.loadRequests()
      const next = sig.requests.value.find((r) => r.status === 'pending')
      if (next) {
        // Petit delai pour laisser la fermeture precedente se terminer visuellement.
        setTimeout(() => { modals.signatureRequest = next }, 150)
      }
    } catch { /* non bloquant */ }
  }

  // Bandeau demande de notifications (extrait dans useNotificationBanner).
  const { visible: showNotifBanner, accept: acceptNotifs, dismiss: dismissNotifs } = useNotificationBanner()

  // Mode demo : presence Socket.IO simulee via polling (cf. v2.258 jalon V3).
  // Le composable s'auto-active quand currentUser.demo === true et s'arrete
  // au logout / sortie de la demo.
  useDemoPresence()

  // Mode demo : flux de fausses notifications periodiques pour montrer la
  // feature au visiteur. Auto-start sur currentUser.demo === true.
  useDemoNotifications()
  useDemoTyping()

  // Toast discret pour la connexion socket (extrait dans useSocketReconnectToast).
  useSocketReconnectToast()

  // ── Mobile sidebar drawer ──────────────────────────────────────────────────
  const sidebarOpen = ref(false)
  const sidebarCollapsed = ref(localStorage.getItem('sidebar-collapsed') === '1')
  function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value }
  function closeSidebar()  { sidebarOpen.value = false }
  function toggleSidebarCollapse() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem('sidebar-collapsed', sidebarCollapsed.value ? '1' : '0')
  }

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
  const privacySections = ref({ controller: false, legal: false, data: true, retention: false })
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
    // Charger l'etat des modules enrichissement des que l'utilisateur est connecte
    if (user) loadModules()
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
    reportError(err, { source: 'vue' })
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

  // Mode focus Lumen : sidebar globale masquee quand on est dans /lumen ET que
  // l'utilisateur a active le mode depuis la topbar (preference persistee).
  const isLumenFocus = computed(() => route.name === 'lumen' && lumenFocusMode.value)

  const ROUTE_LABELS: Record<string, string> = {
    dashboard: 'Accueil',
    messages: 'Messages',
    devoirs: 'Devoirs',
    documents: 'Ressources',
    live: 'Live',
  }

  const totalUnreadBadge = computed(() => {
    const dmCount = Object.values(appStore.unreadDms ?? {}).reduce((a: number, b) => a + (b as number), 0)
    const mentionCount = Object.values(appStore.mentionChannels ?? {}).reduce((a: number, b) => a + (b as number), 0)
    const notifUnread = appStore.notificationHistory.filter(n => !n.read && ['grade', 'deadline', 'assignment', 'spark', 'pulse', 'live'].includes(n.category)).length
    return dmCount + mentionCount + notifUnread
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

  function dismissUpdate() { updateState.value = 'idle' }
  function quitAndInstall() { window.api.updaterQuitAndInstall() }

  onMounted(() => {
    initListeners()

    // Appliquer le theme sauvegarde
    const theme = getPref('theme') ?? 'dark'
    document.body.classList.remove('light', 'night', 'marine', 'cursus')
    if (theme !== 'dark') document.body.classList.add(theme)

    // Appliquer la taille de police sauvegardée
    const fs = getPref('fontSize') ?? 'default'
    const sizes: Record<string, string> = { small: '13px', default: '14px', large: '16px' }
    document.documentElement.style.setProperty('--font-size-base', sizes[fs])

    // Appliquer la densité sauvegardée
    const dens = getPref('density') ?? 'default'
    const spacings: Record<string, string> = { compact: '2px', default: '6px', cozy: '10px' }
    document.documentElement.style.setProperty('--msg-spacing', spacings[dens])

    // (Bandeau notifications gere par useNotificationBanner — debounce 15s avec cleanup.)

    // Toast in-app pour les notifications quand la fenêtre est au premier plan
    window.addEventListener('cursus:notif-toast', ((e: CustomEvent) => {
      showToast(`${e.detail.title} - ${e.detail.body}`, 'info')
    }) as EventListener)

    // Global error handlers
    window.onerror = (_msg, _src, _line, _col, err) => {
      console.error('[GlobalError]', err)
      reportError(err ?? String(_msg), { source: 'window' })
      showToast('Une erreur est survenue. Utilisez le bouton de feedback pour la signaler.', 'error')
    }
    window.onunhandledrejection = (e: PromiseRejectionEvent) => {
      console.error('[UnhandledRejection]', e.reason)
      reportError(e.reason, { source: 'unhandled_rejection' })
      showToast('Une erreur est survenue. Utilisez le bouton de feedback pour la signaler.', 'error')
    }

    // Network status listeners
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Restaurer la session depuis localStorage
    const restored = appStore.restoreSession()
    if (restored) {
      // Si l'URL pointe deja sur une route publique (ex: /demo, /book/...),
      // respecter ce choix explicite plutot que de la remplacer par le
      // startView prefere. Sinon un visiteur logge qui clique "Tester en demo"
      // depuis la landing est silencieusement renvoye vers son dashboard.
      //
      // On lit window.location.hash directement plutot que router.currentRoute :
      // au moment ou onMounted fire, le router peut ne pas avoir fini de
      // resoudre les guards async (beforeEach charge les modules), donc
      // currentRoute.value.meta est `undefined` et le test `meta?.public`
      // devient falsy par accident -> l'utilisateur etait redirige a tort.
      const hashPath = (window.location.hash || '').replace(/^#/, '').split('?')[0].split('#')[0]
      const isPublicRoute = hashPath === '/demo' || hashPath.startsWith('/book/')
      if (!isPublicRoute) {
        router.replace(resolveStartRoute())
      }
      loadModules()
      bookmarksStore.initIds()
      statusesStore.init(appStore.currentUser?.id ?? null)
      scheduledStore.load()
    }

    // Init/reset stores par-user suivant l'etat de session
    watch(() => appStore.currentUser?.id ?? null, (uid, prev) => {
      if (uid && uid !== prev) {
        bookmarksStore.initIds()
        statusesStore.init(uid)
        scheduledStore.load(true)
      } else if (!uid && prev) {
        bookmarksStore.reset()
        statusesStore.reset()
        scheduledStore.reset()
      }
    })

    // Socket listener : status:change en temps reel
    const offStatusChange = window.api.onStatusChange(({ userId, status }) => {
      statusesStore.apply(userId, status)
      if (userId === appStore.currentUser?.id) {
        statusesStore.mine = status
      }
    })
    onUnmounted(() => { try { offStatusChange() } catch { /* ignore */ } })

    // Tous les listeners IPC sont geres par useAppListeners (liveInvite, updater, grade, signature, document, assignment)
  })

  onUnmounted(() => {
    cleanupListeners()
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
          <Zap :size="16" class="live-invite-icon" />
          <span class="live-invite-dot" />
          <strong>{{ liveInvite.teacherName }}</strong> vous invite a une session Live
        </div>
        <div class="live-invite-title">{{ liveInvite.title }}</div>
        <div class="live-invite-code">Code : <strong>{{ liveInvite.joinCode }}</strong></div>
        <div class="live-invite-actions">
          <button class="live-invite-btn live-invite-join" @click="acceptLiveInvite">Rejoindre</button>
          <button class="live-invite-btn live-invite-dismiss" @click="dismissLiveInvite">Ignorer</button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Pages publiques (booking) — pas de login requis -->
  <template v-if="$route.meta?.public">
    <RouterView />
  </template>

  <!-- Écran de connexion -->
  <LoginOverlay v-else-if="!appStore.currentUser" />

  <!-- Shell principal (après connexion) -->
  <div v-else id="app-shell" class="app-shell">
    <!-- Lien d'accessibilite : aller au contenu principal -->
    <a href="#main-content" class="sr-only sr-only-focusable">Aller au contenu principal</a>

    <!-- Bandeau mode demo (visible uniquement si currentUser.demo === true) -->
    <DemoBanner />

    <!-- Mini-tour d'onboarding (demo uniquement, auto-start a 1.5s) -->
    <DemoOnboardingTour v-if="appStore.currentUser?.demo" />

    <!-- Barre de titre custom (fenêtre sans chrome natif) -->
    <TitleBar />

    <!-- Colonnes nav + sidebar + main -->
    <div class="app-columns">
    <NavRail :sidebar-collapsed="sidebarCollapsed" @toggle-sidebar="toggleSidebarCollapse" />

    <!-- Bandeau hors-ligne -->
    <div v-if="!appStore.isOnline || isOffline" class="offline-banner offline-banner-yellow">
      <span>Connexion perdue - vos modifications seront envoyées à la reconnexion</span>
    </div>

    <!-- Bandeau reconnexion socket -->
    <!-- Reconnexion : toast discret au lieu de bandeau -->

    <!-- Bandeau session expirée (dismiss manuel via la croix) -->
    <div v-if="appStore.sessionExpiredMessage" class="offline-banner offline-banner-red">
      <span>{{ appStore.sessionExpiredMessage }}</span>
      <button class="offline-banner-close" @click="appStore.dismissSessionExpired" aria-label="Fermer">
        ×
      </button>
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

    <aside
      v-show="!isLumenFocus"
      class="sidebar-wrapper"
      :class="{ 'sidebar-with-banner': appStore.isSimulating || !appStore.isOnline, 'mobile-open': sidebarOpen, 'sidebar-wrapper--collapsed': sidebarCollapsed }"
    >
      <SidebarWrapper @navigate="closeSidebar" />
    </aside>

    <main id="main-content" class="main-wrapper" :class="{ 'main-with-banner': appStore.isSimulating || !appStore.isOnline }">
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
      @next-request="openNextPendingSignature"
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
    <div v-if="showPrivacy && appStore.currentUser" class="privacy-overlay" role="dialog" aria-modal="true" aria-label="Politique de confidentialite">
      <div class="privacy-box">
        <div class="privacy-header">
          <div class="privacy-header-icon"><Shield :size="20" /></div>
          <div>
            <h3 class="privacy-title">Protection de vos donnees</h3>
            <p class="privacy-subtitle">Reglement General sur la Protection des Donnees (RGPD)</p>
          </div>
        </div>

        <div class="privacy-body">
          <!-- Responsable de traitement -->
          <div class="privacy-section">
            <button class="privacy-section-toggle" @click="privacySections.controller = !privacySections.controller">
              <h4 class="privacy-section-title"><Scale :size="14" /> Responsable de traitement</h4>
              <ChevronDown :size="14" class="privacy-chevron" :class="{ open: privacySections.controller }" />
            </button>
            <div v-if="privacySections.controller" class="privacy-section-content">
              <p class="privacy-text"><strong>Rohan Fosse</strong>, enseignant au CESI.</p>
              <p class="privacy-text">Cursus est un outil pedagogique developpe dans le cadre des cours dispenses au CESI. Il n'est pas edite par le CESI.</p>
              <div class="privacy-contact">
                <Mail :size="13" /> <a href="mailto:rfosse@cesi.fr">rfosse@cesi.fr</a>
              </div>
            </div>
          </div>

          <!-- Base legale -->
          <div class="privacy-section">
            <button class="privacy-section-toggle" @click="privacySections.legal = !privacySections.legal">
              <h4 class="privacy-section-title"><Scale :size="14" /> Base legale</h4>
              <ChevronDown :size="14" class="privacy-chevron" :class="{ open: privacySections.legal }" />
            </button>
            <div v-if="privacySections.legal" class="privacy-section-content">
              <p class="privacy-text">Le traitement de vos donnees repose sur l'<strong>interet legitime</strong> (art. 6.1.f RGPD) dans le cadre de la mission educative : faciliter la communication, le suivi pedagogique et la remise de travaux au sein de votre promotion.</p>
            </div>
          </div>

          <!-- Donnees collectees -->
          <div class="privacy-section">
            <button class="privacy-section-toggle" @click="privacySections.data = !privacySections.data">
              <h4 class="privacy-section-title"><Server :size="14" /> Donnees collectees</h4>
              <ChevronDown :size="14" class="privacy-chevron" :class="{ open: privacySections.data }" />
            </button>
            <div v-if="privacySections.data" class="privacy-section-content">
              <div class="privacy-grid">
                <div class="privacy-item">
                  <MessageSquare :size="15" class="privacy-item-icon" />
                  <div><strong>Messages</strong><span>Stockes sur le serveur de cours</span></div>
                </div>
                <div class="privacy-item">
                  <FileText :size="15" class="privacy-item-icon" />
                  <div><strong>Rendus et notes</strong><span>Accessibles a l'enseignant</span></div>
                </div>
                <div class="privacy-item">
                  <Camera :size="15" class="privacy-item-icon" />
                  <div><strong>Photo de profil</strong><span>Visible par votre promo</span></div>
                </div>
                <div class="privacy-item">
                  <Lock :size="15" class="privacy-item-icon" />
                  <div><strong>Mot de passe</strong><span>Chiffre (bcrypt, irreversible)</span></div>
                </div>
                <div class="privacy-item">
                  <Globe :size="15" class="privacy-item-icon" />
                  <div><strong>Donnees techniques</strong><span>Adresse IP, navigateur, pages visitees</span></div>
                </div>
                <div class="privacy-item">
                  <Eye :size="15" class="privacy-item-icon" />
                  <div><strong>Traces d'activite</strong><span>Connexions, tentatives de login</span></div>
                </div>
              </div>
              <p class="privacy-text privacy-text-small">Aucune donnee n'est transmise a des tiers. Le serveur est heberge en France.</p>
            </div>
          </div>

          <!-- Duree de conservation -->
          <div class="privacy-section">
            <button class="privacy-section-toggle" @click="privacySections.retention = !privacySections.retention">
              <h4 class="privacy-section-title"><Clock :size="14" /> Duree de conservation</h4>
              <ChevronDown :size="14" class="privacy-chevron" :class="{ open: privacySections.retention }" />
            </button>
            <div v-if="privacySections.retention" class="privacy-section-content">
              <p class="privacy-text">Vos donnees sont conservees pendant la duree de votre formation, puis <strong>supprimees dans les 3 mois</strong> suivant la fin de la promotion. Les logs techniques (IP, visites) sont purges automatiquement apres 90 jours.</p>
            </div>
          </div>

          <!-- Vos droits -->
          <div class="privacy-section privacy-section-open">
            <h4 class="privacy-section-title privacy-section-title-static"><Shield :size="14" /> Vos droits <span class="privacy-badge">RGPD</span></h4>
            <div class="privacy-rights">
              <div class="privacy-right"><Eye :size="14" class="privacy-right-icon" /> <strong>Acces</strong> Consulter toutes vos donnees</div>
              <div class="privacy-right"><Download :size="14" class="privacy-right-icon" /> <strong>Portabilite</strong> Exporter vos donnees <span class="privacy-path">Parametres → Compte</span></div>
              <div class="privacy-right"><Pencil :size="14" class="privacy-right-icon" /> <strong>Rectification</strong> Corriger vos informations</div>
              <div class="privacy-right"><Trash2 :size="14" class="privacy-right-icon" /> <strong>Suppression</strong> Supprimer vos messages</div>
              <div class="privacy-right"><UserX :size="14" class="privacy-right-icon" /> <strong>Effacement</strong> Demander la suppression du compte</div>
            </div>
            <div class="privacy-contact privacy-contact-bottom">
              <Mail :size="13" /> Pour exercer vos droits : <a href="mailto:rfosse@cesi.fr">rfosse@cesi.fr</a>
            </div>
          </div>
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
  .offline-banner-close {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; color: inherit; opacity: 0.7;
    font-size: 18px; line-height: 1; cursor: pointer; padding: 4px 8px;
    border-radius: 4px;
  }
  .offline-banner-close:hover { opacity: 1; background: rgba(255, 255, 255, 0.1); }
  .reconnected-fade-enter-active { transition: opacity var(--t-slow); }
  .reconnected-fade-leave-active { transition: opacity .5s; }
  .reconnected-fade-enter-from, .reconnected-fade-leave-to { opacity: 0; }
  .notif-request-banner {
    position: fixed;
    bottom: 16px; left: 50%; transform: translateX(-50%);
    z-index: var(--z-modal-bg);
    display: flex; align-items: center; gap: 12px;
    padding: 10px 16px; border-radius: var(--radius);
    background: var(--bg-elevated);
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
    background: var(--bg-elevated);
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

  /* ── Banniere RGPD ── */
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
    max-width: 520px;
    width: 100%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 32px 80px rgba(0, 0, 0, .7);
    overflow: hidden;
  }

  .privacy-header {
    display: flex; align-items: center; gap: 14px;
    padding: 24px 28px 20px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .privacy-header-icon {
    width: 40px; height: 40px; border-radius: 10px;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    display: flex; align-items: center; justify-content: center;
    color: var(--accent); flex-shrink: 0;
  }

  .privacy-title {
    font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.3;
  }

  .privacy-subtitle {
    font-size: 11.5px; color: var(--text-muted); margin: 2px 0 0; font-weight: 500;
  }

  .privacy-body {
    padding: 16px 28px 20px;
    display: flex; flex-direction: column; gap: 4px;
    overflow-y: auto;
    flex: 1;
    min-height: 0;
  }

  .privacy-section {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .privacy-section-open {
    border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
  }

  .privacy-section-toggle {
    width: 100%;
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 14px;
    background: var(--bg-elevated);
    border: none; cursor: pointer;
    transition: background var(--motion-fast) var(--ease-out);
  }
  .privacy-section-toggle:hover { background: color-mix(in srgb, var(--accent) 5%, var(--bg-elevated)); }
  .privacy-section-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

  .privacy-section-title {
    font-size: 12px; font-weight: 700;
    color: var(--text-primary); margin: 0;
    display: flex; align-items: center; gap: 8px;
  }

  .privacy-section-title-static {
    padding: 12px 14px;
    background: var(--bg-elevated);
  }

  .privacy-chevron {
    color: var(--text-muted);
    transition: transform var(--motion-base) var(--ease-out);
    flex-shrink: 0;
  }
  .privacy-chevron.open { transform: rotate(180deg); }

  .privacy-section-content {
    padding: 12px 14px 14px;
    display: flex; flex-direction: column; gap: 10px;
  }

  .privacy-text {
    font-size: 12.5px; color: var(--text-secondary); line-height: 1.6; margin: 0;
  }
  .privacy-text strong { color: var(--text-primary); font-weight: 600; }
  .privacy-text-small { font-size: 11px; color: var(--text-muted); font-style: italic; }

  .privacy-contact {
    display: flex; align-items: center; gap: 6px;
    font-size: 12px; color: var(--text-muted);
  }
  .privacy-contact a {
    color: var(--accent); text-decoration: none; font-weight: 600;
  }
  .privacy-contact a:hover { text-decoration: underline; }
  .privacy-contact-bottom {
    padding: 10px 14px;
    border-top: 1px solid var(--border);
    margin-top: 4px;
  }

  .privacy-badge {
    font-size: 9px; font-weight: 800; background: var(--accent); color: #fff;
    padding: 2px 7px; border-radius: var(--radius-xs); letter-spacing: .5px;
  }

  .privacy-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

  .privacy-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px; background: var(--bg-modal);
    border: 1px solid var(--border); border-radius: var(--radius);
  }

  .privacy-item-icon { flex-shrink: 0; color: var(--accent); margin-top: 1px; }
  .privacy-right-icon { flex-shrink: 0; color: var(--text-muted); }
  .privacy-item div { display: flex; flex-direction: column; gap: 1px; }
  .privacy-item strong { font-size: 12px; font-weight: 600; color: var(--text-primary); }
  .privacy-item span { font-size: 10.5px; color: var(--text-muted); line-height: 1.3; }

  .privacy-rights {
    display: flex; flex-direction: column; gap: 5px;
    padding: 12px 14px 8px;
  }

  .privacy-right {
    display: flex; align-items: center; gap: 8px; font-size: 12px;
    color: var(--text-secondary); padding: 7px 10px; background: var(--bg-modal);
    border-radius: var(--radius); border: 1px solid var(--border);
  }
  .privacy-right strong {
    color: var(--text-primary); font-weight: 600; min-width: 80px;
  }

  .privacy-path {
    font-size: 10px; color: var(--accent); font-weight: 600; margin-left: auto; opacity: .8;
  }

  .privacy-accept {
    margin: 0 28px 24px; width: calc(100% - 56px); justify-content: center;
    padding: 11px; font-size: 13.5px; font-weight: 600; border-radius: var(--radius);
    flex-shrink: 0;
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
    background: var(--accent);
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
    background: var(--bg-modal);
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
    background: var(--bg-modal);
    border: 2px solid var(--accent);
    border-radius: var(--radius-lg);
    padding: 16px;
    box-shadow: 0 12px 40px rgba(0,0,0,.5), 0 0 0 1px rgba(var(--accent-rgb),.15);
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
  .live-invite-icon {
    color: var(--accent);
    flex-shrink: 0;
  }
  .live-invite-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
    padding-left: 16px;
  }
  .live-invite-code {
    font-size: 12px;
    color: var(--text-muted);
    padding-left: 16px;
    margin-bottom: 12px;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    letter-spacing: 1px;
  }
  .live-invite-code strong {
    color: var(--accent);
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
    background: var(--accent);
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
