<script setup lang="ts">
  import { ref, watch, computed } from 'vue'
  import { LogOut, Settings, User, Info, Camera, X, RotateCcw } from 'lucide-vue-next'
  import { useAppStore } from '@/stores/app'
  import { useRouter }   from 'vue-router'
  import { usePrefs }    from '@/composables/usePrefs'
  import { useToast }    from '@/composables/useToast'
  import { avatarColor } from '@/utils/format'
  import Modal from '@/components/ui/Modal.vue'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  type Section = 'general' | 'compte' | 'apropos'

  const appStore = useAppStore()
  const router   = useRouter()
  const { getPref, setPref } = usePrefs()
  const { showToast }        = useToast()

  const activeSection  = ref<Section>('general')
  const docsDefault    = ref(getPref('docsOpenByDefault'))
  const currentTheme   = ref(getPref('theme') ?? 'dark')
  const pendingPhoto   = ref<string | null>(null)
  const photoChanged   = ref(false)

  const THEMES = [
    { id: 'dark',   label: 'Sombre',  colors: ['#1a1d21', '#1d2128', '#222529'] },
    { id: 'light',  label: 'Clair',   colors: ['#E8EAED', '#F0F2F5', '#FFFFFF'] },
    { id: 'night',  label: 'Nuit',    colors: ['#08090c', '#0b0d11', '#0f1115'] },
    { id: 'marine', label: 'Marine',  colors: ['#0e1829', '#132036', '#192840'] },
  ]

  function applyTheme(theme: string) {
    document.body.classList.remove('light', 'night', 'marine')
    if (theme !== 'dark') document.body.classList.add(theme)
  }

  watch(() => props.modelValue, (open) => {
    if (open) {
      activeSection.value = 'general'
      currentTheme.value  = getPref('theme') ?? 'dark'
      pendingPhoto.value  = appStore.currentUser?.photo_data ?? null
      photoChanged.value  = false
    }
  })

  watch(docsDefault, (v) => setPref('docsOpenByDefault', v))

  function setTheme(theme: string) {
    currentTheme.value = theme
    setPref('theme', theme)
    applyTheme(theme)
  }

  async function pickPhoto() {
    const res = await window.api.openImageDialog()
    if (res?.ok && res.data) {
      pendingPhoto.value = res.data
      photoChanged.value = true
    }
  }

  function removePhoto() {
    pendingPhoto.value = null
    photoChanged.value = true
  }

  function savePhoto() {
    if (!appStore.currentUser) return
    appStore.login({ ...appStore.currentUser, photo_data: pendingPhoto.value })
    // Persister en DB pour les étudiants
    if (appStore.currentUser.type === 'student' && appStore.currentUser.id > 0) {
      window.api.updateStudentPhoto({ studentId: appStore.currentUser.id, photoData: pendingPhoto.value })
    }
    photoChanged.value = false
    showToast('Photo mise à jour.', 'success')
  }

  function handleLogout() {
    emit('update:modelValue', false)
    appStore.logout()
    router.replace('/')
    showToast('Déconnexion réussie.', 'info')
  }

  const avatarBg = computed(() =>
    appStore.currentUser?.type === 'teacher'
      ? 'var(--accent)'
      : avatarColor(appStore.currentUser?.name ?? ''),
  )

  const resetting = ref(false)
  async function resetDemoData() {
    if (!confirm('Réinitialiser toutes les données de démonstration ? Cette action est irréversible.')) return
    resetting.value = true
    try {
      const res = await window.api.resetAndSeed()
      if (res?.ok) {
        showToast('Données réinitialisées. Redémarrez ou rechargez la page.', 'success')
      } else {
        showToast(res?.error ?? 'Erreur lors de la réinitialisation.')
      }
    } finally {
      resetting.value = false
    }
  }

  const navItems: { key: Section; label: string }[] = [
    { key: 'general', label: 'Général' },
    { key: 'compte',  label: 'Mon compte' },
    { key: 'apropos', label: 'À propos' },
  ]
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Paramètres"
    max-width="700px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="stg-layout">

      <!-- ── Navigation latérale ── -->
      <nav class="stg-nav">
        <button
          v-for="item in navItems"
          :key="item.key"
          class="stg-nav-item"
          :class="{ active: activeSection === item.key }"
          @click="activeSection = item.key"
        >
          <Settings v-if="item.key === 'general'" :size="14" class="stg-nav-icon" />
          <User     v-else-if="item.key === 'compte'"  :size="14" class="stg-nav-icon" />
          <Info     v-else :size="14" class="stg-nav-icon" />
          {{ item.label }}
        </button>

        <div class="stg-nav-spacer" />

        <button class="stg-nav-item stg-nav-danger" @click="handleLogout">
          <LogOut :size="14" class="stg-nav-icon" />
          Se déconnecter
        </button>
      </nav>

      <!-- ── Contenu ── -->
      <div class="stg-body">

        <!-- ════ Général ════ -->
        <section v-if="activeSection === 'general'" class="stg-section">
          <h3 class="stg-section-title">Général</h3>

          <div class="stg-group">
            <h4 class="stg-group-title">Documents</h4>
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

          <div class="stg-group">
            <h4 class="stg-group-title">Interface</h4>
            <div class="stg-theme-grid">
              <button
                v-for="t in THEMES"
                :key="t.id"
                class="stg-theme-card"
                :class="{ active: currentTheme === t.id }"
                :title="t.label"
                @click="setTheme(t.id)"
              >
                <div class="stg-theme-preview">
                  <div class="stg-theme-rail"   :style="{ background: t.colors[0] }" />
                  <div class="stg-theme-sidebar" :style="{ background: t.colors[1] }" />
                  <div class="stg-theme-main"    :style="{ background: t.colors[2] }" />
                </div>
                <span class="stg-theme-label">{{ t.label }}</span>
                <span v-if="currentTheme === t.id" class="stg-theme-check">✓</span>
              </button>
            </div>
            <div class="stg-info-row">
              <span class="stg-info-label">Langue</span>
              <span class="stg-info-value">Français</span>
            </div>
          </div>
          <div v-if="appStore.isTeacher" class="stg-group">
            <h4 class="stg-group-title">Données de démonstration</h4>
            <div class="stg-toggle-row" style="cursor:default">
              <div class="stg-toggle-info">
                <span class="stg-toggle-label">Réinitialiser les données</span>
                <span class="stg-toggle-desc">Recharge les deux promotions d'exemple (CPIA2 / FISAA4) avec devoirs, dépôts et documents de test.</span>
              </div>
              <button class="btn-ghost stg-reset-btn" :disabled="resetting" @click="resetDemoData">
                <RotateCcw :size="13" />
                {{ resetting ? 'Réinitialisation…' : 'Réinitialiser' }}
              </button>
            </div>
          </div>
        </section>

        <!-- ════ Mon compte ════ -->
        <section v-else-if="activeSection === 'compte'" class="stg-section">
          <h3 class="stg-section-title">Mon compte</h3>

          <div class="stg-group">
            <h4 class="stg-group-title">Photo de profil</h4>
            <div class="stg-avatar-row">
              <!-- Avatar -->
              <div class="stg-avatar" :style="{ background: pendingPhoto ? 'transparent' : avatarBg }">
                <img v-if="pendingPhoto" :src="pendingPhoto" class="stg-avatar-img" />
                <span v-else class="stg-avatar-initials">{{ appStore.currentUser?.avatar_initials }}</span>
              </div>

              <div class="stg-avatar-actions">
                <button class="btn-ghost stg-photo-btn" @click="pickPhoto">
                  <Camera :size="13" /> Changer la photo
                </button>
                <button v-if="pendingPhoto" class="btn-ghost stg-photo-btn stg-photo-remove" @click="removePhoto">
                  <X :size="13" /> Supprimer
                </button>
                <button v-if="photoChanged" class="btn-primary stg-photo-btn" @click="savePhoto">
                  Enregistrer
                </button>
              </div>
            </div>
          </div>

          <div class="stg-group">
            <h4 class="stg-group-title">Informations</h4>

            <div class="form-group">
              <label class="form-label">Nom complet</label>
              <input
                :value="appStore.currentUser?.name"
                type="text"
                class="form-input stg-input-readonly"
                disabled
              />
            </div>

            <div class="form-group" style="margin-top:10px">
              <label class="form-label">Rôle</label>
              <input
                :value="appStore.currentUser?.type === 'teacher' ? 'Enseignant Responsable Pédagogique' : appStore.currentUser?.type === 'ta' ? 'Intervenant' : 'Étudiant'"
                type="text"
                class="form-input stg-input-readonly"
                disabled
              />
            </div>

            <div v-if="appStore.currentUser?.promo_name" class="form-group" style="margin-top:10px">
              <label class="form-label">Promotion</label>
              <input
                :value="appStore.currentUser.promo_name"
                type="text"
                class="form-input stg-input-readonly"
                disabled
              />
            </div>
          </div>

          <div v-if="appStore.isSimulating" class="stg-simulation-banner">
            <span>Simulation active en tant que <strong>{{ appStore.currentUser?.name }}</strong></span>
            <button class="btn-ghost" style="font-size:12px" @click="appStore.stopSimulation()">
              Quitter la simulation
            </button>
          </div>
        </section>

        <!-- ════ À propos ════ -->
        <section v-else class="stg-section">
          <h3 class="stg-section-title">À propos</h3>

          <div class="stg-group">
            <h4 class="stg-group-title">Application</h4>
            <div class="stg-info-row">
              <span class="stg-info-label">Nom</span>
              <span class="stg-info-value">CESI Cours</span>
            </div>
            <div class="stg-info-row">
              <span class="stg-info-label">Version</span>
              <span class="stg-info-value">1.0.0</span>
            </div>
            <div class="stg-info-row">
              <span class="stg-info-label">Plateforme</span>
              <span class="stg-info-value">Electron · Vue 3 · SQLite</span>
            </div>
          </div>

          <div class="stg-group">
            <h4 class="stg-group-title">Description</h4>
            <p class="stg-about-text">
              Plateforme pédagogique pour la gestion des cours, travaux et documents
              entre enseignants et étudiants CESI. Messagerie en temps réel, suivi
              des rendus, gestion des ressources et planification Gantt.
            </p>
          </div>
        </section>

      </div>
    </div>
  </Modal>
</template>

<style scoped>
.stg-layout {
  display: flex;
  min-height: 360px;
}

/* ── Navigation ── */
.stg-nav {
  width: 170px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stg-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font);
  cursor: pointer;
  text-align: left;
  transition: background var(--t-fast), color var(--t-fast);
}
.stg-nav-item:hover { background: var(--bg-hover); color: var(--text-primary); }
.stg-nav-item.active { background: var(--accent-subtle); color: var(--accent-light); }

.stg-nav-icon { flex-shrink: 0; }

.stg-nav-spacer { flex: 1; }

.stg-nav-danger { color: var(--color-danger); }
.stg-nav-danger:hover { background: rgba(231,76,60,.1); color: var(--color-danger); }

/* ── Corps ── */
.stg-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

.stg-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stg-section-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0;
}

/* Groupe */
.stg-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stg-group-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .6px;
  color: var(--text-muted);
}

/* Toggle row */
.stg-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 14px;
  background: rgba(255,255,255,.03);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.stg-toggle-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stg-toggle-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.stg-toggle-desc {
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.4;
}

/* Switch custom */
.stg-switch {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: rgba(255,255,255,.15);
  flex-shrink: 0;
  position: relative;
  cursor: pointer;
  transition: background .2s;
}
.stg-switch.on { background: var(--accent); }

.stg-switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  transition: transform .2s;
  box-shadow: 0 1px 3px rgba(0,0,0,.3);
}
.stg-switch.on .stg-switch-thumb { transform: translateX(16px); }

/* Info rows (read-only) */
.stg-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: rgba(255,255,255,.02);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

.stg-info-label { font-size: 12px; color: var(--text-muted); }
.stg-info-value { font-size: 12px; color: var(--text-secondary); font-weight: 500; }

/* Avatar */
.stg-avatar-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stg-avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.stg-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.stg-avatar-initials { font-size: 20px; font-weight: 700; color: #fff; }

.stg-avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stg-photo-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 5px 10px;
  justify-content: flex-start;
}

.stg-photo-remove { color: var(--color-danger) !important; }
.stg-photo-remove:hover { background: rgba(231,76,60,.1) !important; }

/* Input readonly */
.stg-input-readonly {
  opacity: .55;
  cursor: default;
}

/* Simulation banner */
.stg-simulation-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(230,126,34,.12);
  border: 1px solid rgba(230,126,34,.3);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: #E67E22;
}

/* Reset btn */
.stg-reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 5px 10px;
  white-space: nowrap;
  flex-shrink: 0;
  color: var(--color-danger) !important;
}
.stg-reset-btn:hover { background: rgba(231,76,60,.1) !important; }

/* À propos */
.stg-about-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  padding: 10px 14px;
  background: rgba(255,255,255,.02);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}

/* Sélecteur de thème */
.stg-theme-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.stg-theme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  padding: 10px 6px 8px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  background: rgba(255,255,255,.02);
  cursor: pointer;
  font-family: var(--font);
  transition: border-color .15s, background .15s, box-shadow .15s;
  position: relative;
}
.stg-theme-card:hover {
  border-color: rgba(255,255,255,.18);
  background: rgba(255,255,255,.05);
}
.stg-theme-card.active {
  border-color: var(--accent);
  background: var(--accent-subtle);
  box-shadow: 0 0 0 2px rgba(74,144,217,.18);
}

.stg-theme-preview {
  width: 100%;
  height: 44px;
  border-radius: 5px;
  overflow: hidden;
  display: flex;
  border: 1px solid rgba(0,0,0,.2);
}
.stg-theme-rail    { width: 22%; flex-shrink: 0; }
.stg-theme-sidebar { width: 35%; flex-shrink: 0; }
.stg-theme-main    { flex: 1; }

.stg-theme-label {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary);
  text-align: center;
}
.stg-theme-card.active .stg-theme-label { color: var(--accent-light); }

.stg-theme-check {
  position: absolute;
  top: 5px;
  right: 6px;
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  line-height: 1;
}
</style>
