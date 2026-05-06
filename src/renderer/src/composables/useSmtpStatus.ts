/**
 * useSmtpStatus — diagnostic SMTP cote prof/admin.
 *
 * Le code campagne envoie via le serveur SMTP configure cote backend
 * (env vars SMTP_*). Quand SMTP n'est pas configure ou ne repond pas,
 * les invites tombent en silence (sentIds vide). Ce composable permet
 * a l'utilisateur de voir l'etat depuis l'app sans SSH sur le VPS.
 *
 * Singleton (state module-level) : un seul fetch partage par les vues
 * qui affichent le chip statut, et le test envoi est forcement serial.
 */
import { ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { reportError } from '@/utils/reportError'

export interface SmtpStatus {
  configured: boolean
  host: string | null
  port: number
  secure: boolean
  userMasked: string
  from: string | null
  fromAddress: string
  fromMatchesUser: boolean
  sourceLabel: string
  reachable: boolean
  error: string | null
  errorCode?: string | null
}

const status = ref<SmtpStatus | null>(null)
const loading = ref(false)
const lastFetchedAt = ref<number | null>(null)
const STATUS_TTL_MS = 60_000  // 1 min de cache, evite de spammer le SMTP

const sendingTest = ref(false)

export function useSmtpStatus() {
  const { showToast } = useToast()

  async function refresh(force = false): Promise<SmtpStatus | null> {
    if (!force && status.value && lastFetchedAt.value
        && Date.now() - lastFetchedAt.value < STATUS_TTL_MS) {
      return status.value
    }
    loading.value = true
    try {
      const res = await window.api.getSmtpStatus()
      if (res?.ok && res.data) {
        status.value = res.data as SmtpStatus
        lastFetchedAt.value = Date.now()
        return status.value
      }
      return null
    } catch (err) {
      reportError(err, { tag: 'smtp', op: 'status' })
      return null
    } finally {
      loading.value = false
    }
  }

  async function sendTest(to: string): Promise<boolean> {
    sendingTest.value = true
    try {
      const res = await window.api.sendSmtpTest(to)
      if (res?.ok) {
        showToast(`Mail de test envoye a ${to}.`, 'success')
        // refresh apres test : `reachable` peut avoir bouge si le verify
        // marche mais l'envoi echoue (ou inversement).
        await refresh(true)
        return true
      }
      showToast(res?.error || 'Echec envoi du mail de test', 'error')
      return false
    } catch (err) {
      reportError(err, { tag: 'smtp', op: 'test', meta: { to } })
      showToast('Echec envoi du mail de test', 'error')
      return false
    } finally {
      sendingTest.value = false
    }
  }

  return { status, loading, sendingTest, refresh, sendTest }
}
