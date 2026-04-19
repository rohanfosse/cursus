<script setup lang="ts">
  import { ref } from 'vue'
  import { Eye, EyeOff } from 'lucide-vue-next'
  import { useLoginForm } from '@/composables/useLoginForm'
  import { useRegisterForm } from '@/composables/useRegisterForm'
  import { useForgotPassword } from '@/composables/useForgotPassword'
  import logoUrl from '@/assets/logo.png'

  type Screen = 'login' | 'register' | 'forgot'
  const screen = ref<Screen>('login')

  // ── Login ─────────────────────────────────────────────────────────────
  const {
    email, password, loginErr, submitting, showPwd, rememberMe,
    submit: handleLogin,
  } = useLoginForm()

  // ── Inscription ──────────────────────────────────────────────────────
  const registerForm = useRegisterForm()
  const firstName     = registerForm.firstName
  const lastName      = registerForm.lastName
  const regEmail      = registerForm.email
  const regPassword   = registerForm.password
  const regPromoId    = registerForm.promoId
  const regEmailErr   = registerForm.emailErr
  const regSubmitting = registerForm.submitting
  const pendingPhoto  = registerForm.pendingPhoto
  const promotions    = registerForm.promotions
  const regPwdCriteria = registerForm.pwdCriteria
  const regPwdValid    = registerForm.pwdValid
  const isCesiEmail    = registerForm.isCesiEmail
  const regEmailHint   = registerForm.emailHint
  const pickPhoto       = registerForm.pickPhoto
  const previewInitials = registerForm.previewInitials
  const previewColor    = registerForm.previewColor

  async function goRegister() {
    await registerForm.loadPromotions()
    screen.value = 'register'
  }

  async function handleRegister() {
    const r = await registerForm.submit()
    if (r.loginFailed) screen.value = 'login'
  }

  // ── Mot de passe oublie ──────────────────────────────────────────────
  const forgot = useForgotPassword()
  const forgotEmail   = forgot.email
  const forgotSent    = forgot.sent
  const forgotErr     = forgot.err
  const handleForgot  = forgot.submit

  function goForgot() {
    forgot.reset(email.value)
    screen.value = 'forgot'
  }
</script>

<template>
  <div class="auth-shell">
    <!-- Panneau gauche - branding -->
    <div class="auth-brand">
      <div class="auth-brand-inner">
        <img :src="logoUrl" class="auth-brand-logo" alt="Cursus" />
        <h1 class="auth-brand-name">Cursus</h1>
        <p class="auth-brand-tagline">Suivez votre parcours<br>de formation</p>

        <ul class="auth-feature-list">
          <li><span class="auth-feature-dot" />Messagerie par promotion &amp; canal</li>
          <li><span class="auth-feature-dot" />Suivi des devoirs et rendus</li>
          <li><span class="auth-feature-dot" />Ressources centralisées par projet</li>
          <li><span class="auth-feature-dot" />Notifications en temps réel</li>
        </ul>
      </div>
    </div>

    <!-- Panneau droit - formulaire -->
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
                placeholder="prenom.nom@ecole.fr"
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
                  :aria-label="showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
                  @click="showPwd = !showPwd"
                >
                  <EyeOff v-if="showPwd" :size="15" />
                  <Eye v-else :size="15" />
                </button>
              </div>
            </div>

            <label class="auth-remember">
              <input v-model="rememberMe" type="checkbox" class="auth-remember-check" />
              <span>Se souvenir de moi</span>
            </label>

            <Transition name="err-pop">
              <div v-if="loginErr" class="auth-error">{{ loginErr }}</div>
            </Transition>

            <button type="submit" class="auth-submit" :disabled="submitting">
              <span v-if="submitting" class="auth-spinner" />
              {{ submitting ? 'Connexion…' : 'Se connecter' }}
            </button>

            <p class="auth-forgot">
              <button type="button" class="auth-forgot-link" @click="goForgot">
                Mot de passe oublié ?
              </button>
            </p>
          </form>

          <div class="auth-divider"><span>Pas encore de compte ?</span></div>

          <button class="auth-secondary-btn" @click="goRegister">
            Créer un compte étudiant
          </button>
        </div>

        <!-- ── Inscription ── -->
        <div v-else-if="screen === 'register'" key="register" class="auth-card auth-card-wide">
          <h2 class="auth-card-title">Créer un compte</h2>
          <p class="auth-card-sub">Renseignez vos informations pour rejoindre votre promotion</p>

          <form class="auth-form" @submit.prevent="handleRegister">
            <!-- Avatar -->
            <div class="auth-avatar-row">
              <div
                class="auth-avatar-preview"
                :style="{ background: pendingPhoto ? 'transparent' : previewColor() }"
              >
                <img v-if="pendingPhoto" :src="pendingPhoto" alt="Photo de profil" class="auth-avatar-img" />
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
              <input v-model="regEmail" type="email" class="auth-input" placeholder="prenom.nom@ecole.fr" required />
              <Transition name="err-pop">
                <span v-if="regEmailErr" class="auth-field-error">{{ regEmailErr }}</span>
                <span v-else-if="regEmailHint" class="auth-field-hint">{{ regEmailHint }}</span>
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
                <input v-model="regPassword" type="password" class="auth-input" placeholder="Min. 8 caractères" required minlength="8" />
                <div v-if="regPassword.length > 0" class="auth-pwd-criteria">
                  <span :class="{ valid: regPwdCriteria.length }">8+ caractères</span>
                  <span :class="{ valid: regPwdCriteria.uppercase }">1 majuscule</span>
                  <span :class="{ valid: regPwdCriteria.number }">1 chiffre</span>
                  <span :class="{ valid: regPwdCriteria.special }">1 spécial</span>
                </div>
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

        <!-- ── Mot de passe oublié ── -->
        <div v-else-if="screen === 'forgot'" key="forgot" class="auth-card">
          <h2 class="auth-card-title">Mot de passe oublié</h2>
          <p class="auth-card-sub">Saisissez votre adresse email pour recevoir les instructions</p>

          <template v-if="!forgotSent">
            <form class="auth-form" @submit.prevent="handleForgot">
              <div class="auth-field">
                <label class="auth-label">Adresse email</label>
                <input
                  v-model="forgotEmail"
                  type="email"
                  class="auth-input"
                  placeholder="votre.email@ecole.fr"
                  required
                  autofocus
                />
                <Transition name="err-pop">
                  <span v-if="forgotErr" class="auth-field-error">{{ forgotErr }}</span>
                </Transition>
              </div>

              <button type="submit" class="auth-submit">
                Continuer
              </button>
            </form>
          </template>

          <template v-else>
            <div class="auth-forgot-success">
              <div class="auth-forgot-icon">&#9993;</div>
              <p class="auth-forgot-msg">
                Contactez votre <strong>responsable de promotion</strong>
                pour qu'il réinitialise votre mot de passe depuis le panneau d'administration.
              </p>
              <p class="auth-forgot-detail">
                Un mot de passe temporaire vous sera communiqué.
                Vous devrez le changer lors de votre prochaine connexion.
              </p>
            </div>
          </template>

          <div class="auth-form-actions" style="margin-top: 16px">
            <button type="button" class="auth-back-btn" @click="screen = 'login'">
              ← Retour à la connexion
            </button>
          </div>
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
  background: linear-gradient(155deg, #1a2535 0%, #141618 55%, #111827 100%);
  background-size: 300% 300%;
  animation: auth-gradient-shift 12s ease infinite;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  position: relative;
  overflow: hidden;
}

@keyframes auth-gradient-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

/* Cercles décoratifs */
.auth-brand::before,
.auth-brand::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  opacity: .06;
  background: var(--accent);
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
  background: var(--accent);
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
  background: var(--bg-main);
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
  border: 1.5px solid var(--border-input, var(--border-input));
  background: var(--bg-input, rgba(255,255,255,.05));
  color: var(--text-primary);
  font-size: 14px;
  font-family: var(--font);
  outline: none;
  transition: border-color var(--motion-base) var(--ease-out), box-shadow var(--motion-base) var(--ease-out), background var(--motion-base) var(--ease-out);
  box-sizing: border-box;
}
.auth-input:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }
.auth-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3.5px rgba(var(--accent-rgb),.12);
  background: rgba(var(--accent-rgb),.04);
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
  padding: 4px;
  display: flex;
  color: var(--text-muted);
  opacity: .6;
  transition: opacity .12s, color .12s;
}
.auth-pwd-toggle:hover { opacity: 1; color: var(--text-secondary); }

/* ── Se souvenir de moi ── */
.auth-remember {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}
.auth-remember-check {
  width: 15px;
  height: 15px;
  accent-color: var(--accent);
  cursor: pointer;
}

/* ── Erreur ── */
.auth-forgot {
  text-align: center; font-size: 12px; color: var(--text-muted);
  margin-top: 8px;
}
.auth-error {
  background: rgba(var(--color-danger-rgb),.1);
  border: 1px solid rgba(var(--color-danger-rgb),.3);
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 13px;
  color: var(--color-danger);
  text-align: center;
}
.auth-field-error {
  font-size: 12px;
  color: var(--color-danger);
  margin-top: 2px;
}
.auth-field-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* ── Bouton principal ── */
.auth-submit {
  width: 100%;
  padding: 11px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
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
  box-shadow: 0 4px 14px rgba(var(--accent-rgb),.35);
  opacity: .95;
}
.auth-submit:disabled { opacity: .5; cursor: default; }
.auth-submit-flex { flex: 1; }

/* Spinner */
.auth-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
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
  border: 1.5px solid var(--border-input, var(--border-input));
  background: transparent;
  color: var(--text-secondary);
  font-size: 13.5px;
  font-weight: 600;
  font-family: var(--font);
  cursor: pointer;
  transition: background .12s, border-color .12s, color .12s;
}
.auth-secondary-btn:hover {
  background: var(--bg-hover);
  border-color: var(--border);
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
.auth-outline-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.auth-link-btn {
  background: transparent;
  border: none;
  color: var(--color-danger);
  font-size: 12px;
  font-family: var(--font);
  cursor: pointer;
  text-align: left;
  padding: 0 2px;
  opacity: .8;
}
.auth-link-btn:hover { opacity: 1; }

.auth-pwd-criteria {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}
.auth-pwd-criteria span {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(var(--color-danger-rgb),.1);
  color: var(--color-danger);
  transition: background .2s, color .2s;
}
.auth-pwd-criteria span.valid {
  background: rgba(var(--color-success-rgb),.12);
  color: #2ecc71;
}

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
  border: 1.5px solid var(--border-input, var(--border-input));
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-family: var(--font);
  cursor: pointer;
  white-space: nowrap;
  transition: background .1s, color .1s;
}
.auth-back-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ── Transitions ── */
.auth-slide-enter-active { transition: opacity var(--motion-base) var(--ease-out), transform var(--motion-base) var(--ease-out); }
.auth-slide-leave-active { transition: opacity var(--motion-fast) var(--ease-out), transform var(--motion-fast) var(--ease-out); }
.auth-slide-enter-from   { opacity: 0; transform: translateX(16px); }
.auth-slide-leave-to     { opacity: 0; transform: translateX(-12px); }

.err-pop-enter-active { transition: opacity .15s, transform .15s; }
.err-pop-leave-active { transition: opacity .1s; }
.err-pop-enter-from   { opacity: 0; transform: translateY(-4px); }
.err-pop-leave-to     { opacity: 0; }

/* ── Mot de passe oublié ── */
.auth-forgot-link {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 12px;
  font-family: var(--font);
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
  opacity: .8;
  transition: opacity .12s;
}
.auth-forgot-link:hover { opacity: 1; }

.auth-forgot-success {
  text-align: center;
  padding: 12px 0;
}
.auth-forgot-icon {
  font-size: 36px;
  margin-bottom: 12px;
  opacity: .7;
}
.auth-forgot-msg {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.6;
  margin: 0 0 10px;
}
.auth-forgot-detail {
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.5;
  margin: 0;
}
</style>
