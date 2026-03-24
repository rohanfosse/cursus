<script setup lang="ts">
  import { ref, watch } from 'vue'
  import {
    LogOut, Settings, User, Info, Camera, X, RotateCcw, KeyRound,
    Download, Palette, Monitor, Moon, Sunset, Waves, Sparkles, Globe, Lock,
    FileText, ChevronRight, Github, Heart, Shield, Mail, BookOpen,
    ExternalLink, Type, BellRing, Maximize2, Sun, MessageSquare,
    Volume2, Clock, MousePointer, Home, AlignJustify,
  } from 'lucide-vue-next'
  import ChangePasswordModal  from '@/components/modals/ChangePasswordModal.vue'
  import SettingsAppearance   from './settings/SettingsAppearance.vue'
  import SettingsPreferences  from './settings/SettingsPreferences.vue'
  import SettingsAbout        from './settings/SettingsAbout.vue'
  import { useAppStore } from '@/stores/app'
  import Modal from '@/components/ui/Modal.vue'
  import logoUrl from '@/assets/logo.png'
  import { useSettingsAppearance } from '@/composables/useSettingsAppearance'
  import { useSettingsAccount }    from '@/composables/useSettingsAccount'
  import { useSettingsPreferences } from '@/composables/useSettingsPreferences'
  import { usePrefs } from '@/composables/usePrefs'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  type Section = 'general' | 'apparence' | 'preferences' | 'compte' | 'apropos'

  const appStore = useAppStore()
  const { getPref, setPref } = usePrefs()

  // ── Composables ────────────────────────────────────────────────────────────
  const {
    currentTheme, fontSize, density, msgSpacing, showTimestamps, compactImages,
    THEMES, setTheme, resetAppearance,
  } = useSettingsAppearance()

  const {
    pendingPhoto, photoChanged, pickPhoto, removePhoto, savePhoto, resetPhoto,
    avatarBg, roleLabel, roleIcon, showChangePwd, handleLogout,
    exporting, exportData, resetting, resetDemoData, openPrivacyFromSettings,
  } = useSettingsAccount(emit)

  const {
    docsDefault, notifSound, notifDesktop, enterToSend,
  } = useSettingsPreferences()

  // ── General tab state ───────────────────────────────────────────────────────
  const rememberMe = ref(getPref('rememberMe') ?? false)
  watch(rememberMe, (v) => {
    setPref('rememberMe', v)
    if (!v) localStorage.removeItem('cc_remember_token')
  })

  const roleLabels: Record<string, string> = {
    teacher: 'Enseignant',
    ta: 'Intervenant',
    student: 'Étudiant',
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const activeSection = ref<Section>('general')

  const navItems: { key: Section; label: string; icon: typeof Settings }[] = [
    { key: 'general',      label: 'General',      icon: Home },
    { key: 'apparence',    label: 'Apparence',    icon: Palette },
    { key: 'preferences',  label: 'Preferences',  icon: Settings },
    { key: 'compte',       label: 'Mon compte',   icon: User },
    { key: 'apropos',      label: 'A propos',     icon: Info },
  ]

  // ── Reset state when modal opens ──────────────────────────────────────────
  watch(() => props.modelValue, (open) => {
    if (open) {
      activeSection.value = 'general'
      resetAppearance()
      resetPhoto()
      rememberMe.value = getPref('rememberMe') ?? false
    }
  })
</script>

<template>
  <Modal
    :model-value="modelValue"
    max-width="740px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="stg-layout">

      <!-- ── Navigation laterale ── -->
      <nav class="stg-nav">
        <div class="stg-nav-header">
          <img :src="logoUrl" class="stg-nav-logo" alt="Cursus" />
          <span class="stg-nav-brand">Cursus</span>
        </div>

        <div class="stg-nav-items">
          <button
            v-for="item in navItems"
            :key="item.key"
            class="stg-nav-item"
            :class="{ active: activeSection === item.key }"
            @click="activeSection = item.key"
          >
            <component :is="item.icon" :size="15" class="stg-nav-icon" />
            {{ item.label }}
            <ChevronRight v-if="activeSection === item.key" :size="12" class="stg-nav-chevron" />
          </button>
        </div>

        <div class="stg-nav-spacer" />

        <button class="stg-nav-item stg-nav-danger" @click="handleLogout">
          <LogOut :size="15" class="stg-nav-icon" />
          Se deconnecter
        </button>
      </nav>

      <!-- ── Contenu ── -->
      <div class="stg-body">

        <!-- ════ General ════ -->
        <section v-if="activeSection === 'general'" class="stg-section">
          <div class="stg-section-header">
            <Home :size="18" />
            <h3 class="stg-section-title">General</h3>
          </div>

          <!-- Informations utilisateur -->
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
                <span class="stg-info-label">Role</span>
                <span class="stg-info-value">{{ roleLabels[appStore.currentUser?.type ?? ''] ?? '-' }}</span>
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

          <!-- Se souvenir de moi -->
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
              <div class="stg-switch" :class="{ on: rememberMe }" @click="rememberMe = !rememberMe">
                <div class="stg-switch-thumb" />
              </div>
            </label>
          </div>
        </section>

        <!-- ════ Apparence ════ -->
        <SettingsAppearance v-else-if="activeSection === 'apparence'" />

        <!-- ════ Preferences ════ -->
        <SettingsPreferences v-else-if="activeSection === 'preferences'" />

        <!-- ════ Mon compte ════ -->
        <section v-else-if="activeSection === 'compte'" class="stg-section">
          <div class="stg-section-header">
            <User :size="18" />
            <h3 class="stg-section-title">Mon compte</h3>
          </div>

          <!-- Profil card -->
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

          <!-- Securite -->
          <div class="stg-group">
            <div class="stg-group-header">
              <Shield :size="13" class="stg-group-icon" />
              <h4 class="stg-group-title">Securite</h4>
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

          <!-- Confidentialite -->
          <div class="stg-group">
            <div class="stg-group-header">
              <Lock :size="13" class="stg-group-icon" />
              <h4 class="stg-group-title">Confidentialite</h4>
            </div>
            <div class="stg-action-row">
              <div class="stg-toggle-info">
                <span class="stg-toggle-label">Politique de confidentialite</span>
                <span class="stg-toggle-desc">Consultez comment vos donnees sont protegees et vos droits RGPD.</span>
              </div>
              <button class="stg-btn stg-btn-ghost" @click="openPrivacyFromSettings">
                <Shield :size="13" /> Consulter
              </button>
            </div>
          </div>

          <!-- Donnees personnelles (etudiants) -->
          <div v-if="appStore.isStudent" class="stg-group">
            <div class="stg-group-header">
              <Download :size="13" class="stg-group-icon" />
              <h4 class="stg-group-title">Donnees personnelles</h4>
            </div>
            <div class="stg-action-row">
              <div class="stg-toggle-info">
                <span class="stg-toggle-label">Exporter mes donnees</span>
                <span class="stg-toggle-desc">Fichier JSON avec vos messages, rendus et profil (Art. 20 RGPD).</span>
              </div>
              <button class="stg-btn stg-btn-ghost" :disabled="exporting" @click="exportData">
                <Download :size="13" />
                {{ exporting ? 'Export...' : 'Exporter' }}
              </button>
            </div>
          </div>

          <!-- Simulation banner -->
          <div v-if="appStore.isSimulating" class="stg-simulation-banner">
            <span>Simulation active en tant que <strong>{{ appStore.currentUser?.name }}</strong></span>
            <button class="stg-btn stg-btn-ghost" @click="appStore.stopSimulation()">
              Quitter
            </button>
          </div>
        </section>

        <!-- ════ A propos ════ -->
        <SettingsAbout v-else />
        <!-- Dead code removal: old A propos section was here -->
        <section v-if="false" class="stg-section"><div class="stg-section-header"><Info :size="18" /><h3 class="stg-section-title">Dead</h3>
          </div>

          <!-- Hero a propos -->
          <div class="stg-about-hero">
            <img :src="logoUrl" class="stg-about-logo" alt="Cursus" />
            <div class="stg-about-hero-text">
              <h4 class="stg-about-name">Cursus</h4>
              <span class="stg-about-version">v0.1.0-beta</span>
            </div>
            <p class="stg-about-tagline">Suivez votre parcours de formation</p>
          </div>

          <!-- Liens -->
          <div class="stg-group">
            <div class="stg-group-header">
              <Globe :size="13" class="stg-group-icon" />
              <h4 class="stg-group-title">Liens</h4>
            </div>
            <div class="stg-info-grid">
              <a href="https://app.cursus.school" target="_blank" rel="noopener" class="stg-info-cell stg-info-link">
                <span class="stg-info-label">Application</span>
                <span class="stg-info-value">app.cursus.school <ExternalLink :size="10" /></span>
              </a>
              <a href="https://cursus.school" target="_blank" rel="noopener" class="stg-info-cell stg-info-link">
                <span class="stg-info-label">Site web</span>
                <span class="stg-info-value">cursus.school <ExternalLink :size="10" /></span>
              </a>
            </div>
          </div>

          <!-- Infos techniques -->
          <div class="stg-group">
            <div class="stg-group-header">
              <Monitor :size="13" class="stg-group-icon" />
              <h4 class="stg-group-title">Technique</h4>
            </div>
            <div class="stg-info-grid">
              <div class="stg-info-cell">
                <span class="stg-info-label">Plateforme</span>
                <span class="stg-info-value">Electron + Vue 3</span>
              </div>
              <div class="stg-info-cell">
                <span class="stg-info-label">Base de donnees</span>
                <span class="stg-info-value">SQLite (local)</span>
              </div>
              <div class="stg-info-cell">
                <span class="stg-info-label">Temps reel</span>
                <span class="stg-info-value">Socket.io</span>
              </div>
              <div class="stg-info-cell">
                <span class="stg-info-label">Licence</span>
                <span class="stg-info-value">MIT</span>
              </div>
            </div>
          </div>

          <!-- Auteur -->
          <div class="stg-group">
            <div class="stg-group-header">
              <Heart :size="13" class="stg-group-icon" />
              <h4 class="stg-group-title">Cree par</h4>
            </div>
            <div class="stg-author-card">
              <div class="stg-author-avatar">RF</div>
              <div class="stg-author-info">
                <span class="stg-author-name">Rohan Fosse</span>
                <a
                  href="https://github.com/rohanfosse/slack-like-electron"
                  target="_blank"
                  rel="noopener"
                  class="stg-author-link"
                >
                  <Github :size="12" />
                  Voir sur GitHub
                  <ExternalLink :size="10" />
                </a>
              </div>
            </div>
          </div>

          <!-- Description -->
          <div class="stg-about-desc">
            <p>
              Plateforme pedagogique open-source combinant messagerie en temps reel,
              suivi des devoirs et rendus, gestion documentaire et planification Gantt.
              Tout en un seul endroit.
            </p>
          </div>
        </section>

      </div>
    </div>
  </Modal>

  <ChangePasswordModal v-model="showChangePwd" />
</template>

<style scoped>
.stg-layout {
  display: flex;
  min-height: 420px;
  max-height: 72vh;
}

/* ── Navigation ── */
.stg-nav {
  width: 185px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  padding: 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: rgba(0,0,0,.1);
}

.stg-nav-header {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 4px 10px 14px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 10px;
}
.stg-nav-logo { width: 24px; height: 24px; border-radius: 6px; }
.stg-nav-brand { font-size: 14px; font-weight: 800; letter-spacing: -.3px; color: var(--text-primary); }

.stg-nav-items { display: flex; flex-direction: column; gap: 2px; }

.stg-nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 9px 11px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font);
  cursor: pointer;
  text-align: left;
  transition: background .12s, color .12s;
}
.stg-nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.stg-nav-item.active {
  background: var(--accent-subtle);
  color: var(--accent-light);
  font-weight: 600;
}

.stg-nav-icon { flex-shrink: 0; opacity: .8; }
.stg-nav-item.active .stg-nav-icon { opacity: 1; }
.stg-nav-chevron { margin-left: auto; opacity: .5; }

.stg-nav-spacer { flex: 1; }

.stg-nav-danger { color: var(--color-danger); }
.stg-nav-danger:hover { background: rgba(231,76,60,.08); color: var(--color-danger); }

/* ── Corps ── */
.stg-body {
  flex: 1;
  overflow-y: auto;
  padding: 22px 26px 26px;
}

.stg-section { display: flex; flex-direction: column; gap: 22px; }

.stg-section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-primary);
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
}
.stg-section-title { font-size: 16px; font-weight: 700; }

/* ── Groupe ── */
.stg-group { display: flex; flex-direction: column; gap: 10px; }

.stg-group-header {
  display: flex;
  align-items: center;
  gap: 7px;
}
.stg-group-icon { color: var(--text-muted); }
.stg-group-title {
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .7px;
  color: var(--text-muted);
}

/* ── Action row (toggle / bouton) ── */
.stg-action-row,
.stg-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: border-color .15s;
}
.stg-action-row:hover,
.stg-toggle-row:hover { border-color: var(--bg-elevated); }

.stg-action-danger {
  border-color: rgba(231,76,60,.15);
}
.stg-action-danger:hover { border-color: rgba(231,76,60,.3); }

.stg-toggle-info { display: flex; flex-direction: column; gap: 3px; }
.stg-toggle-label { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.stg-toggle-desc { font-size: 11.5px; color: var(--text-muted); line-height: 1.45; }

/* ── Buttons ── */
.stg-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: none;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all .12s;
}
.stg-btn:disabled { opacity: .5; cursor: default; }

.stg-btn-ghost {
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.stg-btn-ghost:hover:not(:disabled) {
  background: var(--bg-active);
  border-color: var(--border-input);
  color: var(--text-primary);
}

.stg-btn-accent {
  background: var(--accent);
  color: #fff;
}
.stg-btn-accent:hover { filter: brightness(1.1); }

.stg-btn-danger {
  background: rgba(231,76,60,.1);
  color: var(--color-danger);
  border: 1px solid rgba(231,76,60,.2);
}
.stg-btn-danger:hover:not(:disabled) {
  background: rgba(231,76,60,.18);
  border-color: rgba(231,76,60,.35);
}

.stg-btn-remove { color: var(--color-danger) !important; border-color: rgba(231,76,60,.2) !important; }
.stg-btn-remove:hover { background: rgba(231,76,60,.08) !important; }

/* ── Switch ── */
.stg-switch {
  width: 38px; height: 22px; border-radius: 11px;
  background: var(--bg-active);
  flex-shrink: 0; position: relative; cursor: pointer;
  transition: background .2s;
}
.stg-switch.on { background: var(--accent); }
.stg-switch-thumb {
  position: absolute; top: 3px; left: 3px;
  width: 16px; height: 16px; border-radius: 50%;
  background: #fff; transition: transform .2s;
  box-shadow: 0 1px 4px rgba(0,0,0,.25);
}
.stg-switch.on .stg-switch-thumb { transform: translateX(16px); }

/* ── Info chip (langue) ── */
.stg-info-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}
.stg-chip-badge {
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 3px 10px;
  border-radius: 100px;
}

/* ── Theme grid ── */
.stg-theme-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}
.stg-theme-card {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: var(--bg-elevated);
  cursor: pointer;
  font-family: var(--font);
  transition: border-color .15s, background .15s, box-shadow .15s;
  overflow: hidden;
}
.stg-theme-card:hover {
  border-color: var(--border-input);
  background: var(--bg-elevated);
}
.stg-theme-card.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-subtle);
}
.stg-theme-preview {
  width: 100%;
  height: 48px;
  display: flex;
  position: relative;
}
.stg-theme-rail    { width: 22%; flex-shrink: 0; }
.stg-theme-sidebar { width: 32%; flex-shrink: 0; border-right: 1px solid rgba(0,0,0,.15); }
.stg-theme-main    { flex: 1; position: relative; }
.stg-theme-accent {
  position: absolute;
  bottom: 8px; left: 8px; right: 8px;
  height: 5px; border-radius: 3px; opacity: .6;
}

.stg-theme-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 7px 0;
  border-top: 1px solid var(--border);
  color: var(--text-secondary);
}
.stg-theme-label { font-size: 11px; font-weight: 600; }
.stg-theme-card.active .stg-theme-footer { color: var(--accent-light); }

/* ── Profile card ── */
.stg-profile-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.stg-profile-top { display: flex; align-items: center; gap: 16px; }
.stg-avatar {
  width: 64px; height: 64px; border-radius: 16px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; overflow: hidden;
}
.stg-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.stg-avatar-initials { font-size: 22px; font-weight: 700; color: #fff; }

.stg-profile-info { display: flex; flex-direction: column; gap: 4px; }
.stg-profile-name { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.stg-profile-role {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; font-weight: 600; color: var(--accent-light);
}
.stg-profile-promo {
  font-size: 12px; color: var(--text-muted); font-weight: 500;
}

.stg-profile-actions {
  display: flex; gap: 8px; padding-top: 6px;
  border-top: 1px solid var(--border);
}

/* ── About hero ── */
.stg-about-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 28px 20px 24px;
  background: linear-gradient(180deg, rgba(74,144,217,.06) 0%, transparent 100%);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.stg-about-logo { width: 52px; height: 52px; border-radius: 14px; margin-bottom: 12px; }
.stg-about-hero-text { display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.stg-about-name { font-size: 20px; font-weight: 800; letter-spacing: -.4px; }
.stg-about-version {
  font-size: 11px; font-weight: 700; color: var(--accent);
  background: var(--accent-subtle); padding: 2px 8px; border-radius: 100px;
}
.stg-about-tagline {
  font-size: 13px; color: var(--text-muted); font-weight: 500;
}

/* ── Info grid (technique) ── */
.stg-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.stg-info-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.stg-info-link {
  text-decoration: none;
  transition: border-color .15s;
}
.stg-info-link:hover {
  border-color: var(--accent);
}
.stg-info-label { font-size: 10.5px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; }
.stg-info-value { font-size: 13px; font-weight: 600; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 4px; }

/* ── Author card ── */
.stg-author-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.stg-author-avatar {
  width: 40px; height: 40px; border-radius: 10px;
  background: var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; color: #fff;
  flex-shrink: 0;
}
.stg-author-info { display: flex; flex-direction: column; gap: 3px; }
.stg-author-name { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.stg-author-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  transition: color .12s;
}
.stg-author-link:hover { color: var(--accent); }

/* ── About description ── */
.stg-about-desc {
  padding: 14px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.stg-about-desc p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.65;
}

/* ── Segmented control (taille texte, densite) ── */
.stg-segmented {
  display: flex;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.stg-segmented-btn {
  flex: 1;
  padding: 9px 0;
  border: none;
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  transition: all .12s;
  border-right: 1px solid var(--border);
}
.stg-segmented-btn:last-child { border-right: none; }
.stg-segmented-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.stg-segmented-btn.active {
  background: var(--accent-subtle);
  color: var(--accent-light);
}

/* ── Email profil ── */
.stg-profile-email {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--text-muted);
  font-weight: 500;
}

/* ── Simulation banner ── */
.stg-simulation-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(230,126,34,.1);
  border: 1px solid rgba(230,126,34,.25);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: #E67E22;
}

/* ── Responsive ── */
@media (max-width: 600px) {
  .stg-nav { display: none; }
  .stg-info-grid { grid-template-columns: 1fr; }
  .stg-theme-grid { grid-template-columns: repeat(3, 1fr); }
}
</style>
