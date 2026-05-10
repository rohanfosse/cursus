/** SettingsAccount — section Mon compte du modal Settings. */
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { User, Camera, X, Shield, KeyRound, Lock, Download, HardDrive, LogOut, Trash2, AlertTriangle } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useSettingsAccount } from '@/composables/useSettingsAccount'
import { useSimpleFileDrop } from '@/composables/useSimpleFileDrop'

const appStore = useAppStore()

// Storage usage estimate
const storageUsed = ref('')
onMounted(() => {
  try {
    let totalBytes = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) totalBytes += (localStorage.getItem(key) ?? '').length * 2
    }
    if (totalBytes < 1024) storageUsed.value = `${totalBytes} o`
    else if (totalBytes < 1024 * 1024) storageUsed.value = `${(totalBytes / 1024).toFixed(1)} Ko`
    else storageUsed.value = `${(totalBytes / (1024 * 1024)).toFixed(1)} Mo`
  } catch { storageUsed.value = 'Indisponible' }
})

const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

const {
  pendingPhoto, photoChanged, pickPhoto, loadPhotoFromFile, removePhoto, savePhoto,
  avatarBg, roleLabel, roleIcon, showChangePwd, handleLogout,
  exporting, exportData, openPrivacyFromSettings,
  showDeleteAccount, deletePassword, deleteConfirmText, deleting,
  openDeleteAccount, confirmDeleteAccount, cancelDeleteAccount,
} = useSettingsAccount(emit)

// Drag-and-drop sur l'avatar : accepte une image, limite 5 Mo (photo de profil,
// pas besoin de plus). Lit via FileReader et convertit en data URI.
const {
  isDragOver: isPhotoDragOver,
  onDragEnter: onPhotoDragEnter,
  onDragOver: onPhotoDragOver,
  onDragLeave: onPhotoDragLeave,
  onDrop: onPhotoDrop,
} = useSimpleFileDrop({
  accept: 'image/*',
  maxBytes: 5 * 1024 * 1024,
  onDrop: ([item]) => { if (item) loadPhotoFromFile(item.file) },
})
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
        <div
          class="stg-avatar"
          :class="{ 'stg-avatar--drag-over': isPhotoDragOver }"
          :style="{ background: pendingPhoto ? 'transparent' : avatarBg }"
          role="button"
          tabindex="0"
          :title="isPhotoDragOver ? 'Relacher pour changer la photo' : 'Glisser une image ou cliquer pour changer'"
          @click="pickPhoto"
          @keydown.enter.prevent="pickPhoto"
          @keydown.space.prevent="pickPhoto"
          @dragenter="onPhotoDragEnter"
          @dragover="onPhotoDragOver"
          @dragleave="onPhotoDragLeave"
          @drop="onPhotoDrop"
        >
          <img v-if="pendingPhoto" :src="pendingPhoto" class="stg-avatar-img" alt="Photo de profil" />
          <span v-else class="stg-avatar-initials">{{ appStore.currentUser?.avatar_initials }}</span>
          <span v-if="isPhotoDragOver" class="stg-avatar-drop-hint">Deposer ici</span>
        </div>
        <div class="stg-profile-info">
          <h4 class="stg-profile-name">{{ appStore.currentUser?.name }}</h4>
          <div class="stg-profile-role">
            <component :is="roleIcon" :size="12" />
            <span>{{ roleLabel }}</span>
          </div>
          <div v-if="appStore.currentUser?.email" class="stg-profile-email">
            {{ appStore.currentUser.email }}
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

    <!-- Stockage local -->
    <div class="stg-group">
      <div class="stg-group-header">
        <HardDrive :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Stockage local</h4>
      </div>
      <div class="stg-info-chip">
        <span>Preferences et cache</span>
        <span class="stg-chip-badge">{{ storageUsed }}</span>
      </div>
    </div>

    <!-- Simulation -->
    <div v-if="appStore.isSimulating" class="stg-simulation-banner">
      <span>Simulation active en tant que <strong>{{ appStore.currentUser?.name }}</strong></span>
      <button class="stg-btn stg-btn-ghost" @click="appStore.stopSimulation()">
        Quitter
      </button>
    </div>

    <!-- ── Zone dangereuse : deconnexion + suppression compte ── -->
    <div class="stg-group stg-group-danger">
      <div class="stg-group-header">
        <AlertTriangle :size="13" class="stg-group-icon stg-group-icon-danger" />
        <h4 class="stg-group-title">Session</h4>
      </div>
      <div class="stg-action-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label">Se deconnecter</span>
          <span class="stg-toggle-desc">Vos preferences locales sont conservees pour la prochaine connexion.</span>
        </div>
        <button class="stg-btn stg-btn-ghost" @click="handleLogout">
          <LogOut :size="13" /> Deconnexion
        </button>
      </div>
      <div v-if="appStore.isStudent" class="stg-action-row">
        <div class="stg-toggle-info">
          <span class="stg-toggle-label stg-label-danger">Supprimer mon compte</span>
          <span class="stg-toggle-desc">
            Anonymisation conforme RGPD. Vos rendus de devoirs et notes sont conserves
            pour l'integrite de la formation, mais nom, email et photo seront effaces.
            <strong>Action irreversible.</strong>
          </span>
        </div>
        <button class="stg-btn stg-btn-danger" @click="openDeleteAccount">
          <Trash2 :size="13" /> Supprimer
        </button>
      </div>
    </div>

    <!-- Modale de confirmation de suppression -->
    <Teleport to="body">
      <Transition name="stg-delete-fade">
        <div v-if="showDeleteAccount" class="stg-delete-overlay" role="dialog" aria-modal="true">
          <div class="stg-delete-card">
            <div class="stg-delete-header">
              <AlertTriangle :size="20" class="stg-delete-icon" />
              <h3 class="stg-delete-title">Supprimer votre compte ?</h3>
            </div>
            <p class="stg-delete-text">
              Cette action est <strong>irreversible</strong>. Vos donnees personnelles
              (nom, email, photo) seront definitivement effacees. Vos rendus de devoirs
              et notes restent dans le systeme pour preserver l'integrite pedagogique
              (anonymisation conforme RGPD Art. 17).
            </p>
            <label class="stg-delete-label">
              Mot de passe actuel
              <input
                v-model="deletePassword"
                type="password"
                class="stg-delete-input"
                autocomplete="current-password"
                :disabled="deleting"
              />
            </label>
            <label class="stg-delete-label">
              Saisissez <strong>SUPPRIMER</strong> pour confirmer
              <input
                v-model="deleteConfirmText"
                type="text"
                class="stg-delete-input"
                placeholder="SUPPRIMER"
                :disabled="deleting"
              />
            </label>
            <div class="stg-delete-actions">
              <button class="stg-btn stg-btn-ghost" :disabled="deleting" @click="cancelDeleteAccount">
                Annuler
              </button>
              <button
                class="stg-btn stg-btn-danger"
                :disabled="deleting || deleteConfirmText !== 'SUPPRIMER' || !deletePassword"
                @click="confirmDeleteAccount"
              >
                <Trash2 :size="13" />
                {{ deleting ? 'Suppression...' : 'Supprimer definitivement' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.stg-group-danger {
  border: 1px solid color-mix(in srgb, var(--color-danger) 30%, var(--border));
  background: color-mix(in srgb, var(--color-danger) 4%, transparent);
}
.stg-group-icon-danger { color: var(--color-danger); }
.stg-label-danger      { color: var(--color-danger); font-weight: 600; }

.stg-btn-danger {
  background: var(--color-danger);
  color: #fff;
  border: 1px solid var(--color-danger);
}
.stg-btn-danger:hover:not(:disabled) {
  filter: brightness(.92);
}
.stg-btn-danger:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.stg-delete-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay, 9000);
  background: rgba(0, 0, 0, .65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.stg-delete-card {
  max-width: 480px;
  width: 100%;
  background: var(--bg-modal);
  border: 1px solid color-mix(in srgb, var(--color-danger) 40%, var(--border));
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, .55);
}
.stg-delete-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.stg-delete-icon  { color: var(--color-danger); flex-shrink: 0; }
.stg-delete-title { font-size: 17px; font-weight: 700; margin: 0; color: var(--text-primary); }

.stg-delete-text {
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
  margin: 0 0 18px;
}
.stg-delete-text strong { color: var(--color-danger); }

.stg-delete-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 14px;
}
.stg-delete-label strong { color: var(--color-danger); }

.stg-delete-input {
  padding: 9px 12px;
  background: var(--bg-input, var(--bg-elevated));
  border: 1px solid var(--border-input, var(--border));
  border-radius: var(--radius);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
}
.stg-delete-input:focus {
  outline: none;
  border-color: var(--color-danger);
}

.stg-delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.stg-delete-fade-enter-active,
.stg-delete-fade-leave-active {
  transition: opacity var(--t-base) ease;
}
.stg-delete-fade-enter-from,
.stg-delete-fade-leave-to {
  opacity: 0;
}
</style>
