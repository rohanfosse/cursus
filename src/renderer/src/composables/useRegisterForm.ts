/**
 * useRegisterForm : state + submit + validation pour l'inscription d'un
 * etudiant. Critere mot de passe (8+, maj, num, special), detection
 * email CESI, upload photo, auto-login apres creation du compte.
 */
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { avatarColor } from '@/utils/format'
import type { LoginResponse } from '@/types'

export function useRegisterForm() {
  const appStore = useAppStore()
  const router = useRouter()

  const firstName = ref('')
  const lastName = ref('')
  const email = ref('')
  const password = ref('')
  const promoId = ref<number | ''>('')
  const emailErr = ref('')
  const submitting = ref(false)
  const pendingPhoto = ref<string | null>(null)
  const promotions = ref<{ id: number; name: string }[]>([])

  async function loadPromotions() {
    const res = await window.api.getPromotions()
    promotions.value = res?.ok ? res.data : []
  }

  async function pickPhoto() {
    const res = await window.api.openImageDialog()
    if (res?.ok && res.data) pendingPhoto.value = res.data
  }

  /** Charge une photo depuis un objet File (drag-and-drop) en data URI base64. */
  function loadPhotoFromFile(file: File): void {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') pendingPhoto.value = reader.result
    }
    reader.readAsDataURL(file)
  }

  function previewInitials(): string {
    const n = `${firstName.value} ${lastName.value}`.trim()
    return n.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?'
  }

  function previewColor(): string {
    return avatarColor(`${firstName.value} ${lastName.value}`.trim() || '?')
  }

  const pwdCriteria = computed(() => ({
    length:    password.value.length >= 8,
    uppercase: /[A-Z]/.test(password.value),
    number:    /[0-9]/.test(password.value),
    special:   /[^A-Za-z0-9]/.test(password.value),
  }))
  const pwdValid = computed(() => Object.values(pwdCriteria.value).every(Boolean))

  const isCesiEmail = computed(() => email.value.trim().toLowerCase().endsWith('@viacesi.fr'))
  const emailHint = computed(() => {
    const v = email.value.trim()
    if (!v || v.length < 3) return ''
    if (v.includes('@') && !isCesiEmail.value) return 'Compte externe (non-CESI)'
    return ''
  })

  /**
   * Retourne true si l'inscription a reussi ET que le login auto a fonctionne
   * (redirect /dashboard). Retourne false si la creation a reussi mais que
   * le login a echoue — l'appelant doit alors basculer sur l'ecran login.
   */
  async function submit(): Promise<{ ok: boolean; loginFailed?: boolean }> {
    emailErr.value = ''
    if (!promoId.value) return { ok: false }
    if (!pwdValid.value) {
      emailErr.value = 'Le mot de passe doit contenir au moins 8 caracteres, 1 majuscule, 1 chiffre et 1 caractere special.'
      return { ok: false }
    }
    submitting.value = true
    try {
      const fullName = `${firstName.value.trim()} ${lastName.value.trim()}`
      const res = await window.api.registerStudent({
        name: fullName,
        email: email.value.trim().toLowerCase(),
        promoId: promoId.value as number,
        photoData: pendingPhoto.value,
        password: password.value,
      })
      if (!res?.ok) {
        emailErr.value = res?.error ?? 'Erreur lors de la creation du compte.'
        return { ok: false }
      }
      const loginRes = await window.api.loginWithCredentials(email.value.trim().toLowerCase(), password.value)
      if (!loginRes?.ok || !loginRes.data) {
        emailErr.value = 'Compte cree mais connexion impossible. Essayez de vous connecter.'
        return { ok: false, loginFailed: true }
      }
      const u = loginRes.data as LoginResponse
      appStore.login({ ...u, avatar_initials: u.avatar_initials ?? u.name.slice(0, 2).toUpperCase() })
      router.replace('/dashboard')
      return { ok: true }
    } catch (e: unknown) {
      emailErr.value = e instanceof Error ? e.message : 'Erreur.'
      return { ok: false }
    } finally {
      submitting.value = false
    }
  }

  return {
    firstName, lastName, email, password, promoId, emailErr,
    submitting, pendingPhoto, promotions,
    pwdCriteria, pwdValid, isCesiEmail, emailHint,
    loadPromotions, pickPhoto, loadPhotoFromFile, previewInitials, previewColor, submit,
  }
}
