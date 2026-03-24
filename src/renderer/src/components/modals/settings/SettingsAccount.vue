/** SettingsAccount — section Mon compte du modal Settings. */
<script setup lang="ts">
import { User, Camera, X, Shield, KeyRound, Lock, Download } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useSettingsAccount } from '@/composables/useSettingsAccount'

const appStore = useAppStore()

const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

const {
  pendingPhoto, photoChanged, pickPhoto, removePhoto, savePhoto,
  avatarBg, roleLabel, roleIcon, showChangePwd, handleLogout,
  exporting, exportData, openPrivacyFromSettings,
} = useSettingsAccount(emit)
</script>

<template>
  <section class="stg-section">
    <div class="stg-section-header">
      <User :size="18" />
      <h3 class="stg-section-title">Mon compte</h3>
    </div>

    <!-- Profil -->
    <div class="stg-profile-card">
      <div class="stg-profile-top">
        <div class="stg-avatar" :style="{ background: pendingPhoto ? 'transparent' : avatarBg }">
          <img v-if="pendingPhoto" :src="pendingPhoto" class="stg-avatar-img" alt="Photo de profil" />
          <span v-else class="stg-avatar-initials">{{ appStore.currentUser?.avatar_initials }}</span>
        </div>
        <div class="stg-profile-info">
          <h4 class="stg-profile-name">{{ appStore.currentUser?.name }}</h4>
          <div class="stg-profile-role">
            <component :is="roleIcon" :size="12" />
            <span>{{ roleLabel }}</span>
          </div>
          <div v-if="appStore.currentUser?.promo_name" class="stg-profile-promo">
            {{ appStore.currentUser.promo_name }}
          </div>
        </div>
      </div>
      <div class="stg-profile-actions">
        <button class="stg-btn stg-btn-ghost" @click="pickPhoto">
          <Camera :size="13" /> Changer la photo
        </button>
        <button v-if="pendingPhoto" class="stg-btn stg-btn-ghost stg-btn-remove" @click="removePhoto">
          <X :size="13" /> Supprimer
        </button>
        <button v-if="photoChanged" class="stg-btn stg-btn-accent" @click="savePhoto">
          Enregistrer
        </button>
      </div>
    </div>

    <!-- Sécurité -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Shield :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Sécurité</h4>
      </div>
      <div class="stg-action-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Mot de passe</span>
          <span class="stg-toggle-desc">Modifiez votre mot de passe de connexion.</span>
        </div>
        <button class="stg-btn stg-btn-ghost" @click="showChangePwd = true">
          <KeyRound :size="13" /> Modifier
        </button>
      </div>
    </div>

    <!-- Confidentialité -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Lock :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Confidentialité</h4>
      </div>
      <div class="stg-action-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Politique de confidentialité</span>
          <span class="stg-toggle-desc">Consultez comment vos données sont protégées et vos droits RGPD.</span>
        </div>
        <button class="stg-btn stg-btn-ghost" @click="openPrivacyFromSettings">
          <Shield :size="13" /> Consulter
        </button>
      </div>
    </div>

    <!-- Données personnelles (étudiants) -->
    <div v-if="appStore.isStudent" class="stg-group">
      <div class="stg-group-header">
        <Download :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Données personnelles</h4>
      </div>
      <div class="stg-action-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Exporter mes données</span>
          <span class="stg-toggle-desc">Fichier JSON avec vos messages, rendus et profil (Art. 20 RGPD).</span>
        </div>
        <button class="stg-btn stg-btn-ghost" :disabled="exporting" @click="exportData">
          <Download :size="13" />
          {{ exporting ? 'Export...' : 'Exporter' }}
        </button>
      </div>
    </div>

    <!-- Simulation -->
    <div v-if="appStore.isSimulating" class="stg-simulation-banner">
      <span>Simulation active en tant que <strong>{{ appStore.currentUser?.name }}</strong></span>
      <button class="stg-btn stg-btn-ghost" @click="appStore.stopSimulation()">
        Quitter
      </button>
    </div>
  </section>
</template>
