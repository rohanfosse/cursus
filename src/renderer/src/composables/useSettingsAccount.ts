/**
 * Account settings composable - profile photo upload/remove/save, avatar display,
 * password change, data export, demo reset, logout, and privacy link.
 * Used by SettingsModal.vue
 */
import { ref, computed } from 'vue'
import { User, BookOpen } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useRouter }   from 'vue-router'
import { useToast }    from '@/composables/useToast'
import { useConfirm }  from '@/composables/useConfirm'
import { avatarColor } from '@/utils/format'

export function useSettingsAccount(emit: (evt: 'update:modelValue', v: boolean) => void) {
  const appStore = useAppStore()
  const router   = useRouter()
  const { showToast }               = useToast()
  const { confirm: confirmAction }  = useConfirm()

  // ── Photo ──────────────────────────────────────────────────────────────────
  const pendingPhoto = ref<string | null>(null)
  const photoChanged = ref(false)

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
    if (appStore.currentUser.id > 0) {
      // Étudiant
      window.api.updateStudentPhoto({ studentId: appStore.currentUser.id, photoData: pendingPhoto.value })
    } else {
      // Enseignant (id négatif)
      window.api.updateTeacherPhoto({ teacherId: appStore.currentUser.id, photoData: pendingPhoto.value })
    }
    photoChanged.value = false
    showToast('Photo mise à jour.', 'success')
  }

  /** Re-sync photo state from store (called when modal opens). */
  function resetPhoto() {
    pendingPhoto.value = appStore.currentUser?.photo_data ?? null
    photoChanged.value = false
  }

  // ── Avatar computed ────────────────────────────────────────────────────────
  const avatarBg = computed(() =>
    appStore.currentUser?.type === 'teacher'
      ? 'var(--accent)'
      : avatarColor(appStore.currentUser?.name ?? ''),
  )

  const roleLabel = computed(() => {
    const t = appStore.currentUser?.type
    return t === 'teacher' ? 'Pilote' : t === 'ta' ? 'Intervenant' : 'Étudiant'
  })

  const roleIcon = computed(() => {
    const t = appStore.currentUser?.type
    return t === 'teacher' ? BookOpen : t === 'ta' ? BookOpen : User
  })

  // ── Password ───────────────────────────────────────────────────────────────
  const showChangePwd = ref(false)

  // ── Logout ─────────────────────────────────────────────────────────────────
  function handleLogout() {
    emit('update:modelValue', false)
    appStore.logout()
    router.replace('/')
    showToast('Déconnexion réussie.', 'info')
  }

  // ── Export data ────────────────────────────────────────────────────────────
  const exporting = ref(false)
  async function exportData() {
    if (!appStore.currentUser || appStore.currentUser.type !== 'student') return
    exporting.value = true
    try {
      const res = await window.api.exportPersonalData(Math.abs(appStore.currentUser.id))
      if (!res?.ok) throw new Error(res?.error ?? 'Erreur export')
      const json = JSON.stringify(res.data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `mes-donnees-${appStore.currentUser.name.replace(/\s+/g, '_')}.json`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Export téléchargé.', 'success')
    } catch (e: any) {
      showToast(e.message ?? 'Erreur lors de l\'export.', 'error')
    } finally {
      exporting.value = false
    }
  }

  // ── Reset demo ─────────────────────────────────────────────────────────────
  const resetting = ref(false)
  async function resetDemoData() {
    if (!await confirmAction('Réinitialiser toutes les données de démonstration ? Cette action est irréversible.', 'danger', 'Réinitialiser')) return
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

  // ── Privacy ────────────────────────────────────────────────────────────────
  function openPrivacyFromSettings() {
    emit('update:modelValue', false)
    setTimeout(() => {
      const win = window as Window & { __cursusShowPrivacy?: () => void }
      if (win.__cursusShowPrivacy) win.__cursusShowPrivacy()
    }, 200)
  }

  return {
    pendingPhoto,
    photoChanged,
    pickPhoto,
    removePhoto,
    savePhoto,
    resetPhoto,
    avatarBg,
    roleLabel,
    roleIcon,
    showChangePwd,
    handleLogout,
    exporting,
    exportData,
    resetting,
    resetDemoData,
    openPrivacyFromSettings,
  }
}
