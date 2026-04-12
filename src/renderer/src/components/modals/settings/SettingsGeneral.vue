/** SettingsGeneral — section General du modal Settings. */
<script setup lang="ts">
import { Home, User, Mail, Globe, Shield, Wifi, WifiOff, Clock } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { ROLE_LABELS } from '@/constants'

const appStore = useAppStore()

const connectionStatus = appStore.socketConnected ? 'Connecte' : 'Deconnecte'
const loginTime = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const roleLabels = ROLE_LABELS

const roleBadgeClass: Record<string, string> = {
  admin: 'stg-role-admin',
  teacher: 'stg-role-teacher',
  ta: 'stg-role-ta',
  student: 'stg-role-student',
}
</script>

<template>
  <section class="stg-section">
    <div class="stg-section-header">
      <Home :size="18" />
      <h3 class="stg-section-title">General</h3>
    </div>

    <!-- Profil resume -->
    <div class="stg-group">
      <div class="stg-group-header">
        <User :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Votre profil</h4>
      </div>
      <div class="stg-info-grid">
        <div class="stg-info-cell">
          <span class="stg-info-label">Nom complet</span>
          <span class="stg-info-value">{{ appStore.currentUser?.name ?? '-' }}</span>
        </div>
        <div class="stg-info-cell">
          <span class="stg-info-label">Role</span>
          <span class="stg-info-value">
            <span class="stg-role-badge" :class="roleBadgeClass[appStore.currentUser?.type ?? '']">
              {{ roleLabels[appStore.currentUser?.type ?? ''] ?? '-' }}
            </span>
          </span>
        </div>
        <div v-if="appStore.currentUser?.email" class="stg-info-cell">
          <span class="stg-info-label"><Mail :size="11" style="display:inline;vertical-align:-1px;margin-right:3px" /> Email</span>
          <span class="stg-info-value stg-info-mono">{{ appStore.currentUser.email }}</span>
        </div>
        <div class="stg-info-cell">
          <span class="stg-info-label">Promotion</span>
          <span class="stg-info-value">{{ appStore.currentUser?.promo_name ?? 'Aucune' }}</span>
        </div>
      </div>
    </div>

    <!-- Langue -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Globe :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Langue</h4>
      </div>
      <div class="stg-info-chip">
        <span>Francais</span>
        <span class="stg-chip-badge">Seule langue disponible</span>
      </div>
    </div>

    <!-- Securite (resume) -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Shield :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Securite</h4>
      </div>
      <div class="stg-info-chip">
        <span>Mot de passe</span>
        <span class="stg-chip-badge stg-chip-ok">Defini</span>
      </div>
    </div>

    <!-- Session -->
    <div class="stg-group">
      <div class="stg-group-header">
        <Clock :size="13" class="stg-group-icon" />
        <h4 class="stg-group-title">Session</h4>
      </div>
      <div class="stg-info-grid">
        <div class="stg-info-cell">
          <span class="stg-info-label">Statut</span>
          <span class="stg-info-value">
            <component :is="appStore.socketConnected ? Wifi : WifiOff" :size="12" :style="{ color: appStore.socketConnected ? '#22c55e' : '#ef4444' }" />
            {{ connectionStatus }}
          </span>
        </div>
        <div class="stg-info-cell">
          <span class="stg-info-label">Connecte depuis</span>
          <span class="stg-info-value">{{ loginTime }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stg-role-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 600;
}
.stg-role-admin { background: rgba(139,92,246,0.12); color: #8b5cf6; }
.stg-role-teacher { background: rgba(74,144,217,0.12); color: var(--accent); }
.stg-role-ta { background: rgba(245,158,11,0.12); color: #d97706; }
.stg-role-student { background: rgba(34,197,94,0.12); color: #16a34a; }
.stg-info-mono { font-family: 'Fira Code', monospace; font-size: 12.5px; letter-spacing: -0.3px; }
.stg-chip-ok { background: rgba(34,197,94,0.1) !important; color: #16a34a !important; }
</style>
