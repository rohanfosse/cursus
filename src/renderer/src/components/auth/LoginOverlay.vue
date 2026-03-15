<script setup lang="ts">
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAppStore } from '@/stores/app'
  import { useToast } from '@/composables/useToast'
  import { avatarColor } from '@/utils/format'
  import { escapeHtml } from '@/utils/html'

  const appStore = useAppStore()
  const router   = useRouter()
  const { showToast } = useToast()

  type Screen = 'login' | 'register'
  const screen = ref<Screen>('login')

  // ── Formulaire de connexion ───────────────────────────────────────────────
  const email     = ref('')
  const password  = ref('')
  const loginErr  = ref('')
  const submitting = ref(false)

  async function handleLogin() {
    loginErr.value = ''
    submitting.value = true
    try {
      const res = await window.api.loginWithCredentials(email.value.trim(), password.value)
      if (!res.ok || !res.data) {
        loginErr.value = 'Email ou mot de passe incorrect.'
        password.value = ''
        return
      }
      const u = res.data
      const initials_ = u.avatar_initials ?? u.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
      appStore.login({ ...u, avatar_initials: initials_ })
      router.replace('/messages')
    } finally {
      submitting.value = false
    }
  }

  // ── Formulaire d'inscription ──────────────────────────────────────────────
  const firstName   = ref('')
  const lastName    = ref('')
  const regEmail    = ref('')
  const regPassword = ref('')
  const regPromoId  = ref<number | ''>('')
  const regEmailErr = ref('')
  const regSubmitting = ref(false)
  const pendingPhoto  = ref<string | null>(null)
  const promotions    = ref<{ id: number; name: string }[]>([])

  async function loadPromos() {
    const res = await window.api.getPromotions()
    promotions.value = res?.ok ? res.data : []
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

  async function handleRegister() {
    regEmailErr.value = ''
    if (!regEmail.value.endsWith('@viacesi.fr')) {
      regEmailErr.value = "L'adresse doit se terminer par @viacesi.fr"
      return
    }
    if (!regPromoId.value) return
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
      const stu = stuRes.data
      const initials_ = fullName.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
      appStore.login({ ...stu, avatar_initials: initials_, type: 'student' })
      router.replace('/messages')
    } catch (e: unknown) {
      regEmailErr.value = (e as Error).message ?? 'Erreur lors de la création du compte.'
    } finally {
      regSubmitting.value = false
    }
  }

  async function goToRegister() {
    screen.value = 'register'
    await loadPromos()
  }
</script>

<template>
  <div id="login-overlay">
    <!-- ── Connexion ──────────────────────────────────────────────────────── -->
    <div v-if="screen === 'login'" id="login-panel">
      <div id="login-logo">
        <div class="logo-mark">CC</div>
        <span class="logo-text">CESI Cours</span>
      </div>
      <h2 id="login-title">Connexion</h2>
      <p id="login-subtitle">Entrez vos identifiants pour continuer</p>

      <form style="width:100%;display:flex;flex-direction:column;gap:12px;margin-top:8px" @submit.prevent="handleLogin">
        <div class="form-group">
          <label class="form-label" for="login-email">Adresse email</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            class="form-input"
            placeholder="prenom.nom@viacesi.fr"
            autocomplete="email"
            required
            autofocus
          />
        </div>
        <div class="form-group">
          <label class="form-label" for="login-password">Mot de passe</label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            class="form-input"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          />
        </div>
        <span v-if="loginErr" class="field-error">{{ loginErr }}</span>
        <button type="submit" class="btn-primary" style="margin-top:4px" :disabled="submitting">
          {{ submitting ? 'Connexion…' : 'Se connecter' }}
        </button>
      </form>

      <button class="btn-ghost" style="margin-top:16px;width:100%;font-size:13px" @click="goToRegister">
        Nouveau compte étudiant
      </button>
    </div>

    <!-- ── Inscription ────────────────────────────────────────────────────── -->
    <div v-else id="login-panel" style="max-width:480px">
      <div id="login-logo">
        <div class="logo-mark">CC</div>
        <span class="logo-text">CESI Cours</span>
      </div>
      <h2 id="login-title">Nouveau compte étudiant</h2>
      <p id="login-subtitle">Seules les adresses @viacesi.fr sont acceptées</p>

      <form style="width:100%;display:flex;flex-direction:column;gap:12px;margin-top:8px" @submit.prevent="handleRegister">
        <!-- Avatar preview -->
        <div class="register-photo-row">
          <div
            id="register-avatar-preview"
            class="register-avatar-preview"
            :style="{ background: pendingPhoto ? 'transparent' : previewColor() }"
          >
            <img v-if="pendingPhoto" :src="pendingPhoto" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />
            <span v-else>{{ previewInitials() }}</span>
          </div>
          <button type="button" class="btn-ghost" style="font-size:12px" @click="pickPhoto">Choisir une photo</button>
          <button v-if="pendingPhoto" type="button" class="btn-ghost register-btn-remove" style="font-size:12px" @click="pendingPhoto = null">Supprimer</button>
        </div>

        <div style="display:flex;gap:10px">
          <div class="form-group" style="flex:1">
            <label class="form-label">Prénom</label>
            <input v-model="firstName" type="text" class="form-input" placeholder="ex : Alice" required />
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Nom</label>
            <input v-model="lastName" type="text" class="form-input" placeholder="ex : Martin" required />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Adresse email CESI</label>
          <input v-model="regEmail" type="email" class="form-input" placeholder="prenom.nom@viacesi.fr" required />
          <span v-if="regEmailErr" class="field-error">{{ regEmailErr }}</span>
        </div>

        <div class="form-group">
          <label class="form-label">Promotion</label>
          <select v-model="regPromoId" class="form-select" required>
            <option value="">Choisir une promotion…</option>
            <option v-for="p in promotions" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Mot de passe</label>
          <input v-model="regPassword" type="password" class="form-input" placeholder="Choisissez un mot de passe" required minlength="4" />
        </div>

        <div style="display:flex;gap:10px;margin-top:6px">
          <button type="button" class="btn-ghost" style="flex:1" @click="screen = 'login'">Retour</button>
          <button type="submit" class="btn-primary" style="flex:2" :disabled="regSubmitting">
            {{ regSubmitting ? 'Création…' : 'Créer mon compte' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
