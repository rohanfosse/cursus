import { ref, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { useToast } from '@/composables/useToast'
import type { SignatureRequest } from '@/types'

const STORAGE_KEY = 'cc_teacher_signature'

const requests = ref<SignatureRequest[]>([])
const loading  = ref(false)

export function useSignature() {
  const { api } = useApi()
  const { showToast } = useToast()

  // Signature sauvegardee du prof (base64 PNG)
  const savedSignature = ref<string | null>(localStorage.getItem(STORAGE_KEY))

  function saveSignature(base64: string) {
    savedSignature.value = base64
    localStorage.setItem(STORAGE_KEY, base64)
  }

  function clearSavedSignature() {
    savedSignature.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  const pendingCount = computed(() => requests.value.filter(r => r.status === 'pending').length)

  async function loadRequests(status?: string) {
    loading.value = true
    const res = await api<SignatureRequest[]>(() => window.api.getSignatureRequests(status) as Promise<{ ok: boolean; data: SignatureRequest[] }>)
    requests.value = Array.isArray(res) ? res : []
    loading.value = false
  }

  async function requestSignature(messageId: number, dmStudentId: number, fileUrl: string, fileName: string) {
    const res = await window.api.createSignatureRequest({ message_id: messageId, dm_student_id: dmStudentId, file_url: fileUrl, file_name: fileName })
    if (res?.ok) {
      showToast('Demande de signature envoyee', 'success')
      return res.data
    }
    showToast('Erreur lors de la demande', 'error')
    return null
  }

  async function signDocument(requestId: number, signatureBase64: string) {
    const res = await window.api.signDocument(requestId, signatureBase64)
    if (res?.ok) {
      showToast('Document signe avec succes', 'success')
      // Mettre a jour localement
      const req = requests.value.find(r => r.id === requestId)
      if (req) {
        req.status = 'signed'
        req.signed_file_url = res.data?.signed_file_url || null
      }
      return res.data
    }
    showToast('Erreur lors de la signature', 'error')
    return null
  }

  async function rejectSignature(requestId: number, reason: string) {
    const res = await window.api.rejectSignature(requestId, reason)
    if (res?.ok) {
      showToast('Demande refusee', 'info')
      const req = requests.value.find(r => r.id === requestId)
      if (req) {
        req.status = 'rejected'
        req.rejection_reason = reason
      }
      return true
    }
    showToast('Erreur lors du refus', 'error')
    return false
  }

  async function getSignatureForMessage(messageId: number): Promise<SignatureRequest | null> {
    const res = await window.api.getSignatureByMessage(messageId) as { ok: boolean; data: SignatureRequest | null }
    return res?.ok ? res.data : null
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
