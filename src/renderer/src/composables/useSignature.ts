import { ref, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'
import type { SignatureRequest } from '@/types'

const STORAGE_KEY = 'cc_teacher_signature'
// Cap dur sur la signature stockee localement : localStorage a une quota
// ~5MB globale, une signature PNG raisonnable fait <100KB. Au-dela le
// setItem throw QuotaExceededError silencieusement.
const MAX_SAVED_SIG_CHARS = 500_000

const requests = ref<SignatureRequest[]>([])
const loading  = ref(false)

export function useSignature() {
  const { api } = useApi()
  const { showToast } = useToast()

  // Signature sauvegardée du prof (base64 PNG). Si la valeur en LS est
  // corrompue (pas PNG), on la drop au premier load plutot que de cracher.
  const saved = (() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && raw.startsWith('data:image/png;base64,') && raw.length <= MAX_SAVED_SIG_CHARS) return raw
    if (raw) localStorage.removeItem(STORAGE_KEY)  // cleanup silencieux
    return null
  })()
  const savedSignature = ref<string | null>(saved)

  function saveSignature(base64: string): boolean {
    if (!base64.startsWith('data:image/png;base64,')) return false
    if (base64.length > MAX_SAVED_SIG_CHARS) return false
    try {
      localStorage.setItem(STORAGE_KEY, base64)
      savedSignature.value = base64
      return true
    } catch { return false }  // QuotaExceededError en mode prive par ex.
  }

  function clearSavedSignature() {
    savedSignature.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  const pendingCount = computed(() => requests.value.filter(r => r.status === 'pending').length)

  async function loadRequests(status?: string) {
    loading.value = true
    const res = await api<SignatureRequest[]>(
      () => window.api.getSignatureRequests(status) as Promise<{ ok: boolean; data: SignatureRequest[] }>,
      'signature',
    )
    requests.value = Array.isArray(res) ? res : []
    loading.value = false
  }

  async function requestSignature(messageId: number, dmStudentId: number, fileUrl: string, fileName: string) {
    const res = await api(
      () => window.api.createSignatureRequest({ message_id: messageId, dm_student_id: dmStudentId, file_url: fileUrl, file_name: fileName }),
      'signature',
    )
    if (res) {
      showToast('Demande de signature envoyée', 'success')
      return res
    }
    return null
  }

  async function signDocument(requestId: number, signatureBase64: string) {
    const res = await api<{ signed_file_url: string }>(
      () => window.api.signDocument(requestId, signatureBase64),
      'sign',
    )
    if (res) {
      showToast('Document signé avec succès', 'success', 'Le fichier signé a été envoyé à l\'étudiant.')
      // Mettre à jour localement
      const req = requests.value.find(r => r.id === requestId)
      if (req) {
        req.status = 'signed'
        req.signed_file_url = res.signed_file_url || null
      }
      return res
    }
    // Echec (rejet, 409 deja traite, reseau...) — on recharge la liste
    // pour que l UI reflete l etat serveur plutot que de garder un
    // "pending" obsolete qui donnera le meme 409 au prochain clic.
    await loadRequests()
    return null
  }

  async function rejectSignature(requestId: number, reason: string) {
    const res = await api(
      () => window.api.rejectSignature(requestId, reason),
      'signature',
    )
    if (res !== null) {
      showToast('Demande de signature refusée', 'info', reason ? `Motif : ${reason}` : undefined)
      const req = requests.value.find(r => r.id === requestId)
      if (req) {
        req.status = 'rejected'
        req.rejection_reason = reason
      }
      return true
    }
    return false
  }

  async function getSignatureForMessage(messageId: number): Promise<SignatureRequest | null> {
    return await api<SignatureRequest>(
      () => window.api.getSignatureByMessage(messageId) as Promise<{ ok: boolean; data: SignatureRequest | null }>,
      'signature',
    )
  }

  return {
    requests,
    loading,
    pendingCount,
    savedSignature,
    saveSignature,
    clearSavedSignature,
    loadRequests,
    requestSignature,
    signDocument,
    rejectSignature,
    getSignatureForMessage,
  }
}
