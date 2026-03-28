/** SettingsGeneral — section Général du modal Settings. */
<script setup lang="ts">
import { ref, watch } from 'vue'
import { Home, User, Globe, Lock } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { STORAGE_KEYS } from '@/constants'
import { usePrefs } from '@/composables/usePrefs'

const appStore = useAppStore()
const { getPref, setPref } = usePrefs()

const roleLabels: Record<string, string> = {
  teacher: 'Enseignant',
  ta: 'Intervenant',
  student: 'Étudiant',
}

const rememberMe = ref(getPref('rememberMe') ?? false)
watch(rememberMe, (v) => {
  setPref('rememberMe', v)
  if (!v) localStorage.removeItem(STORAGE_KEYS.REMEMBER_TOKEN)
})
</script>

<template>
  <section class="stg-section">
    <div class="stg-section-header">
      <Home :size="18" />
      <h3 class="stg-section-title">Général</h3>
    </div>

    <div class="stg-group">
      <div class="stg-group-header">
        <User :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Informations</h4>
      </div>
      <div class="stg-info-grid">
        <div class="stg-info-cell">
          <span class="stg-info-label">Nom</span>
          <span class="stg-info-value">{{ appStore.currentUser?.name ?? '-' }}</span>
        </div>
        <div class="stg-info-cell">
          <span class="stg-info-label">Rôle</span>
          <span class="stg-info-value">{{ roleLabels[appStore.currentUser?.type ?? ''] ?? '-' }}</span>
        </div>
        <div class="stg-info-cell">
          <span class="stg-info-label">Promotion</span>
          <span class="stg-info-value">{{ appStore.currentUser?.promo_name ?? 'Aucune' }}</span>
        </div>
      </div>
    </div>

    <div class="stg-group">
      <div class="stg-group-header">
        <Globe :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Langue</h4>
      </div>
      <div class="stg-info-chip">
        <span>Français</span>
        <span class="stg-chip-badge">Seule langue disponible</span>
      </div>
    </div>

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
  </section>
</template>
