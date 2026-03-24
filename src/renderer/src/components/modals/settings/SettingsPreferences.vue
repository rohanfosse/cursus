/** SettingsPreferences — section Préférences du modal Settings. */
<script setup lang="ts">
import { Settings, BellRing, MousePointer, FileText, RotateCcw } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useSettingsPreferences } from '@/composables/useSettingsPreferences'
import { useSettingsAccount } from '@/composables/useSettingsAccount'

const appStore = useAppStore()
const { docsDefault, notifSound, notifDesktop, enterToSend } = useSettingsPreferences()
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()
const { resetting, resetDemoData } = useSettingsAccount(emit)
</script>

<template>
  <section class="stg-section">
    <div class="stg-section-header">
      <Settings :size="18" />
      <h3 class="stg-section-title">Préférences</h3>
    </div>

    <!-- Notifications -->
    <div class="stg-group">
      <div class="stg-group-header">
        <BellRing :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Notifications</h4>
      </div>
      <label class="stg-toggle-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Notifications bureau</span>
          <span class="stg-toggle-desc">Afficher les notifications système pour les nouveaux messages.</span>
        </div>
        <div class="stg-switch" :class="{ on: notifDesktop }" @click="notifDesktop = !notifDesktop">
          <div class="stg-switch-thumb" />
        </div>
      </label>
      <label class="stg-toggle-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Son de notification</span>
          <span class="stg-toggle-desc">Jouer un son lors de la réception d'un message.</span>
        </div>
        <div class="stg-switch" :class="{ on: notifSound }" @click="notifSound = !notifSound">
          <div class="stg-switch-thumb" />
        </div>
      </label>
    </div>

    <!-- Saisie -->
    <div class="stg-group">
      <div class="stg-group-header">
        <MousePointer :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Saisie</h4>
      </div>
      <label class="stg-toggle-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Entrée pour envoyer</span>
          <span class="stg-toggle-desc">Appuyer sur Entrée envoie le message. Désactivé : Ctrl+Entrée pour envoyer.</span>
        </div>
        <div class="stg-switch" :class="{ on: enterToSend }" @click="enterToSend = !enterToSend">
          <div class="stg-switch-thumb" />
        </div>
      </label>
    </div>

    <!-- Documents -->
    <div class="stg-group">
      <div class="stg-group-header">
        <FileText :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Documents</h4>
      </div>
      <label class="stg-toggle-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Ouvrir dans l'explorateur par défaut</span>
          <span class="stg-toggle-desc">Double-clic sur un fichier l'ouvre directement avec l'application système.</span>
        </div>
        <div class="stg-switch" :class="{ on: docsDefault }" @click="docsDefault = !docsDefault">
          <div class="stg-switch-thumb" />
        </div>
      </label>
    </div>

    <!-- Demo (profs) -->
    <div v-if="appStore.isTeacher" class="stg-group">
      <div class="stg-group-header">
        <RotateCcw :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Données de démonstration</h4>
      </div>
      <div class="stg-action-row stg-action-danger">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Réinitialiser les données</span>
          <span class="stg-toggle-desc">Recharge les promotions d'exemple avec devoirs, dépôts et documents de test.</span>
        </div>
        <button class="stg-btn stg-btn-danger" :disabled="resetting" @click="resetDemoData">
          <RotateCcw :size="13" />
          {{ resetting ? 'En cours...' : 'Réinitialiser' }}
        </button>
      </div>
    </div>
  </section>
</template>
