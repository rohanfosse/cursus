/** SettingsPreferences — section Preferences du modal Settings. */
<script setup lang="ts">
import { ref, watch } from 'vue'
import { Settings, MousePointer, FileText, RotateCcw, Lock } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useSettingsPreferences } from '@/composables/useSettingsPreferences'
import { useSettingsAccount } from '@/composables/useSettingsAccount'
import { usePrefs } from '@/composables/usePrefs'
import { STORAGE_KEYS } from '@/constants'

const appStore = useAppStore()
const { docsDefault, enterToSend } = useSettingsPreferences()
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()
const { resetting, resetDemoData } = useSettingsAccount(emit)
const { getPref, setPref } = usePrefs()

const rememberMe = ref(getPref('rememberMe') ?? false)
watch(rememberMe, (v) => {
  setPref('rememberMe', v)
  if (!v) localStorage.removeItem(STORAGE_KEYS.REMEMBER_TOKEN)
})
</script>

<template>
  <section class="stg-section">
    <div class="stg-section-header">
      <Settings :size="18" />
      <h3 class="stg-section-title">Preferences</h3>
    </div>

    <!-- Connexion -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Lock :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Connexion</h4>
      </div>
      <label class="stg-toggle-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Se souvenir de moi</span>
          <span class="stg-toggle-desc">Remplir automatiquement l'adresse e-mail lors de la prochaine connexion.</span>
        </div>
        <div class="stg-switch" :class="{ on: rememberMe }" role="switch" :aria-checked="rememberMe" tabindex="0" @click="rememberMe = !rememberMe" @keydown.enter.prevent="rememberMe = !rememberMe" @keydown.space.prevent="rememberMe = !rememberMe">
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
          <span class="stg-toggle-label">Entree pour envoyer</span>
          <span class="stg-toggle-desc">Appuyer sur Entree envoie le message. Desactive : Ctrl+Entree pour envoyer.</span>
        </div>
        <div class="stg-switch" :class="{ on: enterToSend }" role="switch" :aria-checked="enterToSend" tabindex="0" @click="enterToSend = !enterToSend" @keydown.enter.prevent="enterToSend = !enterToSend" @keydown.space.prevent="enterToSend = !enterToSend">
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
          <span class="stg-toggle-label">Ouvrir dans l'explorateur par defaut</span>
          <span class="stg-toggle-desc">Double-clic sur un fichier l'ouvre directement avec l'application systeme.</span>
        </div>
        <div class="stg-switch" :class="{ on: docsDefault }" role="switch" :aria-checked="docsDefault" tabindex="0" @click="docsDefault = !docsDefault" @keydown.enter.prevent="docsDefault = !docsDefault" @keydown.space.prevent="docsDefault = !docsDefault">
          <div class="stg-switch-thumb" />
        </div>
      </label>
    </div>

    <!-- Demo (profs) -->
    <div v-if="appStore.isTeacher" class="stg-group">
      <div class="stg-group-header">
        <RotateCcw :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Donnees de demonstration</h4>
      </div>
      <div class="stg-action-row stg-action-danger">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Reinitialiser les donnees</span>
          <span class="stg-toggle-desc">Recharge les promotions d'exemple avec devoirs, depots et documents de test.</span>
        </div>
        <button class="stg-btn stg-btn-danger" :disabled="resetting" @click="resetDemoData">
          <RotateCcw :size="13" />
          {{ resetting ? 'En cours...' : 'Reinitialiser' }}
        </button>
      </div>
    </div>
  </section>
</template>
