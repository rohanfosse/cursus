<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAppStore } from '@/stores/app'
  import { avatarColor }  from '@/utils/format'
  import logoUrl from '@/assets/logo.png'

  const appStore = useAppStore()
  const router   = useRouter()

  type Screen = 'login' | 'register'
  const screen = ref<Screen>('login')

  // ── Connexion ─────────────────────────────────────────────────────────────
  const email      = ref('')
  const password   = ref('')
  const loginErr   = ref('')
  const submitting = ref(false)
  const showPwd    = ref(false)

  async function handleLogin() {
    loginErr.value   = ''
    submitting.value = true
    try {
      const res = await window.api.loginWithCredentials(email.value.trim(), password.value)
      if (!res?.ok || !res.data) {
        loginErr.value = 'Email ou mot de passe incorrect.'
        password.value = ''
        return
      }
      const u = res.data as any
      appStore.login({ ...u, avatar_initials: u.avatar_initials ?? u.name.slice(0, 2).toUpperCase() })
      router.replace('/messages')
    } finally {
      submitting.value = false
    }
  }

  // ── Inscription ───────────────────────────────────────────────────────────
  const firstName     = ref('')
  const lastName      = ref('')
  const regEmail      = ref('')
  const regPassword   = ref('')
  const regPromoId    = ref<number | ''>('')
  const regEmailErr   = ref('')
  const regSubmitting = ref(false)
  const pendingPhoto  = ref<string | null>(null)
  const promotions    = ref<{ id: number; name: string }[]>([])

  async function goRegister() {
    const res = await window.api.getPromotions()
    promotions.value = res?.ok ? res.data : []
    screen.value = 'register'
  }

  const previewInitials = () => {
    const n = `${firstName.value} ${lastName.value}`.trim()
    return n.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  }
  const previewColor = () => avatarColor(`${firstName.value} ${lastName.value}`.trim() || '?')

  async function pickPhoto() {
    const res = await window.api.openImageDialog()
    if (res?.ok && res.data) pendingPhoto.value = res.data
  }

  // Validation mot de passe inscription
  const regPwdCriteria = computed(() => ({
    length:    regPassword.value.length >= 8,
    uppercase: /[A-Z]/.test(regPassword.value),
    number:    /[0-9]/.test(regPassword.value),
    special:   /[^A-Za-z0-9]/.test(regPassword.value),
  }))
  const regPwdValid = computed(() => Object.values(regPwdCriteria.value).every(Boolean))

  async function handleRegister() {
    regEmailErr.value = ''
    if (!regEmail.value.endsWith('@viacesi.fr')) {
      regEmailErr.value = "L'adresse doit se terminer par @viacesi.fr"
      return
    }
    if (!regPromoId.value) return
    if (!regPwdValid.value) {
      regEmailErr.value = 'Le mot de passe doit contenir au moins 8 caractères, 1 majuscule, 1 chiffre et 1 caractère spécial.'
      return
    }
    regSubmitting.value = true
    try {
      const fullName = `${firstName.value.trim()} ${lastName.value.trim()}`
      const res = await window.api.registerStudent({
        name: fullName, email: regEmail.value.trim().toLowerCase(),
        promoId: regPromoId.value, photoData: pendingPhoto.value,
        password: regPassword.value,
      })
      if (!res?.ok) { regEmailErr.value = res?.error ?? 'Erreur lors de la création du compte.'; return }
      const stuRes = await window.api.getStudentByEmail(regEmail.value.trim().toLowerCase())
      if (!stuRes?.ok || !stuRes.data) return
      const stu = stuRes.data as any
      appStore.login({ ...stu, type: 'student' })
      router.replace('/messages')
    } catch (e: unknown) {
      regEmailErr.value = (e as Error).message ?? 'Erreur.'
    } finally {
      regSubmitting.value = false
    }
  }
</script>

<template>
  <div class="auth-shell">
    <!-- Panneau gauche — branding -->
    <div class="auth-brand">
      <div class="auth-brand-inner">
        <img :src="logoUrl" class="auth-brand-logo" alt="Cursus" />
        <h1 class="auth-brand-name">Cursus</h1>
        <p class="auth-brand-tagline">Suivez votre parcours<br>de formation</p>

        <ul class="auth-feature-list">
          <li><span class="auth-feature-dot" />Messagerie par promotion &amp; canal</li>
          <li><span class="auth-feature-dot" />Suivi des devoirs et rendus</li>
          <li><span class="auth-feature-dot" />Documents et ressources centralisés</li>
          <li><span class="auth-feature-dot" />Notifications en temps réel</li>
        </ul>
      </div>
    </div>

    <!-- Panneau droit — formulaire -->
    <div class="auth-form-panel">
      <Transition name="auth-slide" mode="out-in">

        <!-- ── Connexion ── -->
        <div v-if="screen === 'login'" key="login" class="auth-card">
          <h2 class="auth-card-title">Connexion</h2>
          <p class="auth-card-sub">Entrez vos identifiants pour accéder à votre espace</p>

          <form class="auth-form" @submit.prevent="handleLogin">
            <div class="auth-field">
              <label class="auth-label" for="auth-email">Adresse email</label>
              <input
                id="auth-email"
                v-model="email"
                type="email"
                class="auth-input"
                placeholder="prenom.nom@viacesi.fr"
                autocomplete="email"
                required
                autofocus
              />
            </div>

            <div class="auth-field">
              <label class="auth-label" for="auth-pwd">Mot de passe</label>
              <div class="auth-input-wrap">
                <input
                  id="auth-pwd"
                  v-model="password"
                  :type="showPwd ? 'text' : 'password'"
                  class="auth-input auth-input-pwd"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  required
                />
                <button
                  type="button"
                  class="auth-pwd-toggle"
                  :aria-label="showPwd ? 'Masquer' : 'Afficher'"
                  @click="showPwd = !showPwd"
                >
                  {{ showPwd ? '🙈' : '👁' }}
                </button>
              </div>
            </div>

            <Transition name="err-pop">
              <div v-if="loginErr" class="auth-error">{{ loginErr }}</div>
            </Transition>

            <button type="submit" class="auth-submit" :disabled="submitting">
              <span v-if="submitting" class="auth-spinner" />
              {{ submitting ? 'Connexion…' : 'Se connecter' }}
            </button>
          </form>

          <div class="auth-divider"><span>Pas encore de compte ?</span></div>

          <button class="auth-secondary-btn" @click="goRegister">
            Créer un compte étudiant
          </button>
        </div>

        <!-- ── Inscription ── -->
        <div v-else key="register" class="auth-card auth-card-wide">
          <h2 class="auth-card-title">Créer un compte</h2>
          <p class="auth-card-sub">Utilisez votre adresse <strong>@viacesi.fr</strong></p>

          <form class="auth-form" @submit.prevent="handleRegister">
            <!-- Avatar -->
            <div class="auth-avatar-row">
              <div
                class="auth-avatar-preview"
                :style="{ background: pendingPhoto ? 'transparent' : previewColor() }"
              >
                <img v-if="pendingPhoto" :src="pendingPhoto" class="auth-avatar-img" />
                <span v-else>{{ previewInitials() }}</span>
              </div>
              <div class="auth-avatar-actions">
                <button type="button" class="auth-outline-btn" @click="pickPhoto">
                  Choisir une photo
                </button>
                <button v-if="pendingPhoto" type="button" class="auth-link-btn" @click="pendingPhoto = null">
                  Supprimer
                </button>
              </div>
            </div>

            <!-- Prénom + Nom -->
            <div class="auth-row-2">
              <div class="auth-field">
                <label class="auth-label">Prénom</label>
                <input v-model="firstName" type="text" class="auth-input" placeholder="Alice" required />
              </div>
              <div class="auth-field">
                <label class="auth-label">Nom</label>
                <input v-model="lastName" type="text" class="auth-input" placeholder="Martin" required />
              </div>
            </div>

            <div class="auth-field">
              <label class="auth-label">Adresse email</label>
              <input v-model="regEmail" type="email" class="auth-input" placeholder="prenom.nom@viacesi.fr" required />
              <Transition name="err-pop">
                <span v-if="regEmailErr" class="auth-field-error">{{ regEmailErr }}</span>
              </Transition>
            </div>

            <div class="auth-row-2">
              <div class="auth-field">
                <label class="auth-label">Promotion</label>
                <select v-model="regPromoId" class="auth-input" required>
                  <option value="">Choisir…</option>
                  <option v-for="p in promotions" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
              </div>
              <div class="auth-field">
                <label class="auth-label">Mot de passe</label>
                <input v-model="regPassword" type="password" class="auth-input" placeholder="Min. 4 caractères" required minlength="4" />
              </div>
            </div>

            <div class="auth-form-actions">
              <button type="button" class="auth-back-btn" @click="screen = 'login'">
                ← Retour
              </button>
              <button type="submit" class="auth-submit auth-submit-flex" :disabled="regSubmitting">
                <span v-if="regSubmitting" class="auth-spinner" />
                {{ regSubmitting ? 'Création…' : 'Créer mon compte' }}
              </button>
            </div>
          </form>
        </div>

      </Transition>
    </div>
  </div>
</template>

<style scoped>
/* ── Shell deux colonnes ── */
.auth-shell {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

/* ── Panneau gauche (branding) ── */
.auth-brand {
  flex: 0 0 42%;
  background: linear-gradient(155deg, #1a2a4a 0%, #111827 55%, #0d1d38 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  position: relative;
  overflow: hidden;
}

/* Cercles décoratifs */
.auth-brand::before,
.auth-brand::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  opacity: .06;
  background: var(--accent, #4A90D9);
}
.auth-brand::before {
  width: 340px; height: 340px;
  top: -80px; left: -80px;
}
.auth-brand::after {
  width: 260px; height: 260px;
  bottom: -60px; right: -60px;
}

.auth-brand-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
  max-width: 300px;
}

.auth-brand-logo {
  width: 56px;
  height: 56px;
  object-fit: contain;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,.4));
  margin-bottom: 16px;
}

.auth-brand-name {
  font-size: 32px;
  font-weight: 800;
  color: #fff;
  letter-spacing: -.8px;
  margin: 0 0 6px;
}

.auth-brand-tagline {
  font-size: 14px;
  color: rgba(255,255,255,.55);
  line-height: 1.55;
  margin: 0 0 32px;
}

.auth-feature-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 11px;
}

.auth-feature-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: rgba(255,255,255,.65);
}

.auth-feature-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent, #4A90D9);
  flex-shrink: 0;
  opacity: .9;
}

/* ── Panneau droit (formulaire) ── */
.auth-form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
  background: var(--bg-main, #111214);
  overflow-y: auto;
}

/* ── Carte de formulaire ── */
.auth-card {
  width: 100%;
  max-width: 380px;
}

.auth-card-wide {
  max-width: 460px;
}

.auth-card-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 4px;
  letter-spacing: -.3px;
}

.auth-card-sub {
  font-size: 13.5px;
  color: var(--text-muted);
  margin: 0 0 24px;
  line-height: 1.5;
}

/* ── Formulaire ── */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.auth-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: .4px;
}

.auth-input {
  width: 100%;
  padding: 10px 13px;
  border-radius: 8px;
  border: 1.5px solid var(--border-input, rgba(255,255,255,.12));
  background: var(--bg-input, rgba(255,255,255,.05));
  color: var(--text-primary);
  font-size: 14px;
  font-family: var(--font);
  outline: none;
  transition: border-color .15s, box-shadow .15s;
  box-sizing: border-box;
}
.auth-input:focus {
  border-color: var(--accent, #4A90D9);
  box-shadow: 0 0 0 3px rgba(74,144,217,.15);
}
.auth-input::placeholder { color: var(--text-muted); opacity: .6; }

/* Wrapper pour le mot de passe (avec bouton afficher) */
.auth-input-wrap {
  position: relative;
}
.auth-input-pwd {
  padding-right: 42px;
}
.auth-pwd-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 15px;
  padding: 2px;
  line-height: 1;
  opacity: .6;
  transition: opacity .12s;
}
.auth-pwd-toggle:hover { opacity: 1; }

/* ── Erreur ── */
.auth-error {
  background: rgba(231,76,60,.1);
  border: 1px solid rgba(231,76,60,.3);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--color-danger, #e74c3c);
  text-align: center;
}
.auth-field-error {
  font-size: 12px;
  color: var(--color-danger, #e74c3c);
  margin-top: 2px;
}

/* ── Bouton principal ── */
.auth-submit {
  width: 100%;
  padding: 11px;
  border-radius: 8px;
  border: none;
  background: var(--accent, #4A90D9);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  font-family: var(--font);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: opacity .15s, box-shadow .15s;
  margin-top: 2px;
}
.auth-submit:hover:not(:disabled) {
  box-shadow: 0 4px 14px rgba(74,144,217,.35);
  opacity: .95;
}
.auth-submit:disabled { opacity: .5; cursor: default; }
.auth-submit-flex { flex: 1; }

/* Spinner */
.auth-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin .7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Séparateur ── */
.auth-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0 14px;
}
.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border, rgba(255,255,255,.08));
}
.auth-divider span {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
}

/* ── Bouton secondaire ── */
.auth-secondary-btn {
  width: 100%;
  padding: 10px;
  border-radius: 8px;
  border: 1.5px solid var(--border-input, rgba(255,255,255,.12));
  background: transparent;
  color: var(--text-secondary);
  font-size: 13.5px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  transition: background .12s, border-color .12s, color .12s;
}
.auth-secondary-btn:hover {
  background: rgba(255,255,255,.05);
  border-color: rgba(255,255,255,.2);
  color: var(--text-primary);
}

/* ── Inscription ── */
.auth-avatar-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.auth-avatar-preview {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
  overflow: hidden;
}
.auth-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.auth-avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.auth-outline-btn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-input, rgba(255,255,255,.15));
  background: transparent;
  color: var(--text-secondary);
  font-size: 12.5px;
  font-family: var(--font);
  cursor: pointer;
  transition: background .1s, color .1s;
}
.auth-outline-btn:hover { background: rgba(255,255,255,.06); color: var(--text-primary); }

.auth-link-btn {
  background: transparent;
  border: none;
  color: var(--color-danger, #e74c3c);
  font-size: 12px;
  font-family: var(--font);
  cursor: pointer;
  text-align: left;
  padding: 0 2px;
  opacity: .8;
}
.auth-link-btn:hover { opacity: 1; }

.auth-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.auth-form-actions {
  display: flex;
  gap: 10px;
  margin-top: 2px;
}

.auth-back-btn {
  padding: 11px 16px;
  border-radius: 8px;
  border: 1.5px solid var(--border-input, rgba(255,255,255,.12));
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-family: var(--font);
  cursor: pointer;
  white-space: nowrap;
  transition: background .1s, color .1s;
}
.auth-back-btn:hover { background: rgba(255,255,255,.05); color: var(--text-primary); }

/* ── Transitions ── */
.auth-slide-enter-active { transition: opacity .2s ease, transform .2s ease; }
.auth-slide-leave-active { transition: opacity .15s ease, transform .15s ease; }
.auth-slide-enter-from   { opacity: 0; transform: translateX(16px); }
.auth-slide-leave-to     { opacity: 0; transform: translateX(-12px); }

.err-pop-enter-active { transition: opacity .15s, transform .15s; }
.err-pop-leave-active { transition: opacity .1s; }
.err-pop-enter-from   { opacity: 0; transform: translateY(-4px); }
.err-pop-leave-to     { opacity: 0; }
</style>
