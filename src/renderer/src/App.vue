<script setup lang="ts">
  import { onMounted, onUnmounted, ref, computed, watch, watchEffect, onErrorCaptured } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { useAppStore }      from '@/stores/app'
  import { useModalsStore }   from '@/stores/modals'
  import { useMessagesStore } from '@/stores/messages'
  import { useLiveStore }     from '@/stores/live'
  import { usePrefs }       from '@/composables/usePrefs'
  import { useToast }       from '@/composables/useToast'
  import { useSwipeNav }    from '@/composables/useSwipeNav'
  import { MessageSquare, FileText, Camera, Lock, Trash2, Download, UserX } from 'lucide-vue-next'
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

  // ── Guard router : bloquer la navigation si must_change_password ──────────
  router.beforeEach((_to, _from, next) => {
    if (showForcedPasswordChange.value) {
      // Empêcher la navigation tant que le mot de passe n'a pas été changé
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
    live: 'Live',
  }

  const totalUnreadBadge = computed(() => {
    const dmCount = Object.values(appStore.unreadDms ?? {}).reduce((a: number, b) => a + (b as number), 0)
    const mentionCount = Object.values(appStore.mentionChannels ?? {}).reduce((a: number, b) => a + (b as number), 0)
    return dmCount + mentionCount
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

  let unsubUnread:   (() => void) | null = null
  let unsubOnline:   (() => void) | null = null
  let unsubSocket:   (() => void) | null = null
  let unsubTyping:   (() => void) | null = null
  let unsubPresence:    (() => void) | null = null
  let unsubAuthExpired: (() => void) | null = null
  let unsubGradeNew:    (() => void) | null = null

  onMounted(() => {
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

    // Écouter les invitations live (étudiants uniquement)
    _unsubLiveInvite = window.api.onLiveInvite((data) => {
      if (appStore.isStaff) return // Les profs n'ont pas besoin de l'invitation
      liveInvite.value = data
      if (_liveInviteTimer) clearTimeout(_liveInviteTimer)
      _liveInviteTimer = setTimeout(() => { liveInvite.value = null }, 30_000)
    })

    // Écouter les notifications de notes (étudiants uniquement)
    unsubGradeNew = window.api.onGradeNew((data) => {
      if (appStore.isStaff) return
      // Toast in-app
      const label = data.note
        ? `Nouvelle note : ${data.note} sur ${data.devoirTitle}`
        : `Nouveau feedback sur ${data.devoirTitle}`
      showToast(label, 'info')

      // Ajouter à l'historique de notifications
      const entry = {
        id:          `grade-${Date.now()}`,
        channelId:   null,
        channelName: data.devoirTitle,
        dmStudentId: null,
        promoId:     null,
        authorName:  data.note ? `Note : ${data.note}` : 'Feedback',
        isMention:   true,
        timestamp:   Date.now(),
        read:        false,
      }
      appStore.notificationHistory.unshift(entry)
      if (appStore.notificationHistory.length > 50) appStore.notificationHistory.length = 50

      // Notification navigateur si app en arrière-plan
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Cursus - Nouvelle note', { body: label, icon: '/assets/icon-192.png' })
      }
    })
  })

  onUnmounted(() => {
    unsubUnread?.(); unsubOnline?.(); unsubSocket?.(); unsubTyping?.(); unsubPresence?.(); unsubAuthExpired?.()
    _unsubLiveInvite?.()
    unsubGradeNew?.()
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
          <strong>{{ liveInvite.teacherName }}</strong> vous invite à une session live
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

    <!-- AppHeader retire pour tous les utilisateurs -->

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
    border: 1px solid var(--border) !important;
    padding: 3px 10px !important;
    font-size: 12px !important;
    border-radius: var(--radius-sm) !important;
  }
  .simulation-stop-btn:hover { background: var(--bg-active) !important; }

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
  .notif-req-dismiss { background: var(--bg-active); color: var(--text-muted); }
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
    border-bottom: 1px solid var(--border);
  }

  .socket-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--border);
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
    padding: 2px 7px; border-radius: 4px; letter-spacing: .5px;
  }

  .privacy-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

  .privacy-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px; background: var(--bg-elevated);
    border: 1px solid var(--border); border-radius: 10px;
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
    border-radius: 50%;
    background: var(--accent, #4A90D9);
    color: #fff;
    border: none;
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,0,0,.35);
    transition: transform .15s, box-shadow .15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .fab-feedback:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(0,0,0,.45); }

  /* ── Mini-modale feedback ── */
  .fab-feedback-modal {
    position: fixed;
    bottom: 70px;
    right: 20px;
    z-index: var(--z-sticky);
    width: 300px;
    background: var(--bg-modal, #1e1f21);
    border: 1px solid var(--border, rgba(255,255,255,.08));
    border-radius: 12px;
    padding: 14px;
    box-shadow: 0 12px 40px rgba(0,0,0,.5);
  }
  .fab-fb-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .fab-fb-title { font-size: 13px; font-weight: 700; color: var(--text-primary); }
  .fab-fb-close { background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer; padding: 0 4px; line-height: 1; }
  .fab-fb-types { display: flex; gap: 4px; margin-bottom: 8px; }
  .fab-fb-type {
    flex: 1; padding: 5px; border-radius: 6px; font-size: 11px; font-weight: 600;
    background: var(--bg-hover); color: var(--text-secondary);
    border: 1px solid var(--border); cursor: pointer; transition: all .12s;
  }
  .fab-fb-type.active { background: var(--accent-subtle); color: var(--accent); border-color: var(--accent); }
  .fab-fb-textarea {
    width: 100%; background: var(--bg-input); border: 1px solid var(--border-input);
    border-radius: 8px; padding: 8px 10px; color: var(--text-primary); font-size: 12px;
    margin-bottom: 8px; font-family: inherit; resize: vertical; box-sizing: border-box;
  }
  .fab-fb-submit {
    width: 100%; padding: 7px; border-radius: 8px; font-size: 12px; font-weight: 600;
    background: var(--accent); color: #fff; border: none; cursor: pointer;
  }
  .fab-fb-submit:disabled { opacity: .4; cursor: not-allowed; }

  .fab-modal-fade-enter-active { transition: opacity .15s ease, transform .15s ease; }
  .fab-modal-fade-leave-active { transition: opacity .1s ease, transform .1s ease; }
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
    border-radius: 14px;
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
    border-radius: 50%;
    background: #ef4444;
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
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all .15s;
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

  /* Slide-in from right */
  .live-invite-slide-enter-active { transition: opacity .25s ease, transform .25s cubic-bezier(.34,1.56,.64,1); }
  .live-invite-slide-leave-active { transition: opacity .15s ease, transform .15s ease; }
  .live-invite-slide-enter-from { opacity: 0; transform: translateX(60px); }
  .live-invite-slide-leave-to   { opacity: 0; transform: translateX(60px); }
</style>
