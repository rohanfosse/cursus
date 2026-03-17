<script setup lang="ts">
  import { onMounted, onUnmounted } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAppStore }    from '@/stores/app'
  import { useModalsStore } from '@/stores/modals'
  import Toast    from '@/components/ui/Toast.vue'
  import NavRail  from '@/components/layout/NavRail.vue'
  import Sidebar  from '@/components/sidebar/Sidebar.vue'
  import LoginOverlay from '@/components/auth/LoginOverlay.vue'
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
  import ImpersonateModal     from '@/components/modals/ImpersonateModal.vue'

  const appStore = useAppStore()
  const modals   = useModalsStore()
  const router   = useRouter()

  let unsubUnread: (() => void) | null = null

  onMounted(() => {
    // Restaurer la session depuis localStorage
    const restored = appStore.restoreSession()
    if (restored) router.replace('/messages')

    // Écouter les messages temps-réel (IPC push)
    unsubUnread = appStore.initUnreadListener()
  })

  onUnmounted(() => { unsubUnread?.() })
</script>

<template>
  <!-- Toast global (accessible depuis n'importe quel composant) -->
  <Toast />

  <!-- Écran de connexion -->
  <LoginOverlay v-if="!appStore.currentUser" />

  <!-- Shell principal (après connexion) -->
  <div v-else id="app-shell" class="app-shell">
    <NavRail />

    <!-- Bandeau simulation étudiant -->
    <div v-if="appStore.isSimulating" id="simulation-banner" class="simulation-banner">
      <span>
        Simulation : <strong>{{ appStore.currentUser?.name }}</strong>
        — vous voyez l'app comme cet étudiant
      </span>
      <button class="btn-ghost simulation-stop-btn" @click="appStore.stopSimulation()">
        Quitter la simulation
      </button>
    </div>

    <aside class="sidebar-wrapper" :class="{ 'sidebar-with-banner': appStore.isSimulating }">
      <Sidebar />
    </aside>

    <main class="main-wrapper" :class="{ 'main-with-banner': appStore.isSimulating }">
      <!-- Vue active (messages / travaux / documents) -->
      <RouterView />
    </main>
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
    <ImpersonateModal     v-model="modals.impersonate"     />
  </template>
</template>

<style>
  /* Styles globaux gérés dans renderer/css/ */

  /* ── Bandeau simulation étudiant ── */
  .simulation-banner {
    position: fixed;
    top: 0;
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

  /* Décaler le shell quand le bandeau est visible */
  .sidebar-with-banner,
  .main-with-banner {
    padding-top: 36px;
  }
</style>
