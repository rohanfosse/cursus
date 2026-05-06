/**
 * useCampaigns — composable pour la gestion des campagnes de RDV (visites tripartites).
 *
 * Une campagne = periode bornee + regle hebdo de creneaux + promo cible.
 * Cycle de vie : draft -> active (mails envoyes) -> closed.
 */
import { ref, computed } from 'vue'
import { useToast } from '@/composables/useToast'
import { toRawPayload } from '@/utils/ipcSafe'

export interface HebdoRule {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface CampaignInvite {
  id: number
  token: string
  invited_at: string | null
  last_reminded_at: string | null
  booking_id: number | null
  student_id: number
  student_name: string
  student_email: string
  start_datetime?: string | null
  end_datetime?: string | null
  tutor_name?: string | null
  tutor_email?: string | null
  booking_status?: string | null
  teams_join_url?: string | null
  cancel_token?: string | null
}

export interface Campaign {
  id: number
  teacher_id: number
  event_type_id: number | null
  title: string
  description: string | null
  duration_minutes: number
  buffer_minutes: number
  color: string
  start_date: string
  end_date: string
  hebdo_rules: HebdoRule[]
  excluded_dates: string[]
  promo_id: number | null
  with_tutor: number
  notify_email: string | null
  use_jitsi: number
  fallback_visio_url: string | null
  timezone: string
  status: 'draft' | 'active' | 'closed'
  launched_at: string | null
  created_at: string
  invite_count?: number
  booked_count?: number
  invites?: CampaignInvite[]
}

export interface CampaignDraft {
  title: string
  description?: string
  durationMinutes: number
  bufferMinutes?: number
  color: string
  startDate: string
  endDate: string
  hebdoRules: HebdoRule[]
  excludedDates?: string[]
  promoId: number
  withTutor?: boolean
  notifyEmail?: string
  useJitsi?: boolean
  fallbackVisioUrl?: string | null
  timezone?: string
}

export function useCampaigns() {
  const { showToast } = useToast()
  const campaigns = ref<Campaign[]>([])
  const loading = ref(false)
  const detail = ref<Campaign | null>(null)

  const activeCampaigns = computed(() => campaigns.value.filter(c => c.status === 'active'))
  const draftCampaigns  = computed(() => campaigns.value.filter(c => c.status === 'draft'))
  const closedCampaigns = computed(() => campaigns.value.filter(c => c.status === 'closed'))

  async function fetchAll() {
    loading.value = true
    try {
      const res = await window.api.getBookingCampaigns()
      if (res.ok && res.data) campaigns.value = res.data as Campaign[]
    } catch {
      showToast('Erreur lors du chargement des campagnes', 'error')
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: number) {
    try {
      const res = await window.api.getBookingCampaign(id)
      if (res.ok && res.data) detail.value = res.data as Campaign
      else showToast(res.error || 'Erreur de chargement', 'error')
    } catch {
      showToast('Erreur lors du chargement de la campagne', 'error')
    }
  }

  async function createCampaign(payload: CampaignDraft): Promise<Campaign | null> {
    // Snapshot leger pour les logs : on retire les rules pour rester
    // lisible mais on garde les champs structurants (title, dates, promo).
    const logPayload = {
      title: payload.title,
      promoId: payload.promoId,
      durationMinutes: payload.durationMinutes,
      startDate: payload.startDate,
      endDate: payload.endDate,
      hebdoRulesCount: payload.hebdoRules?.length ?? 0,
      excludedDatesCount: payload.excludedDates?.length ?? 0,
    }
    window.api.logToFile?.('info', 'campaign', 'create_attempt', logPayload)
    try {
      // toRawPayload : strip la reactivite Vue avant traversee contextBridge
      // (cf. utils/ipcSafe). Sans ca un Proxy reactive plante structuredClone.
      const res = await window.api.createBookingCampaign(toRawPayload(payload))
      if (res.ok && res.data) {
        const c = res.data as Campaign
        window.api.logToFile?.('info', 'campaign', 'create_ok', { id: c.id, title: c.title, inviteCount: c.invite_count ?? 0 })
        await fetchAll()
        showToast(`Campagne "${c.title}" creee — ${c.invite_count ?? 0} etudiants pre-invites`, 'success')
        return c
      }
      window.api.logToFile?.('error', 'campaign', 'create_failed', { ...logPayload, serverError: res.error ?? null })
      showToast(res.error || 'Erreur a la creation', 'error')
      return null
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      window.api.logToFile?.('error', 'campaign', 'create_threw', { ...logPayload, error: msg })
      showToast('Erreur a la creation', 'error')
      return null
    }
  }

  async function updateCampaign(id: number, fields: Partial<CampaignDraft>) {
    try {
      const res = await window.api.updateBookingCampaign(id, toRawPayload(fields))
      if (res.ok) {
        await fetchAll()
        showToast('Campagne mise a jour', 'success')
        return true
      }
      showToast(res.error || 'Erreur a la mise a jour', 'error')
      return false
    } catch {
      showToast('Erreur a la mise a jour', 'error')
      return false
    }
  }

  async function deleteCampaign(id: number) {
    if (!confirm('Supprimer cette campagne ? Les invitations envoyees seront invalidees.')) return false
    try {
      const res = await window.api.deleteBookingCampaign(id)
      if (res.ok) {
        await fetchAll()
        showToast('Campagne supprimee', 'success')
        return true
      }
      showToast(res.error || 'Erreur', 'error')
      return false
    } catch {
      showToast('Erreur a la suppression', 'error')
      return false
    }
  }

  async function launchCampaign(id: number) {
    try {
      const res = await window.api.launchBookingCampaign(id)
      if (res.ok && res.data) {
        await fetchAll()
        const { sent, skipped, alreadyInvited } = res.data as { sent: number; skipped: number; alreadyInvited: number }
        if (sent > 0) {
          showToast(`Campagne lancee : ${sent} mail(s) envoye(s)`, 'success')
        } else if (skipped > 0) {
          // Skipped > 0 alors que sent = 0 : SMTP non configure ou en echec.
          // On bascule sur un toast info avec consigne (la campagne est
          // lancee, juste les mails ne sont pas partis — l'utilisateur
          // peut copier les liens manuellement).
          showToast(
            `Campagne active. Aucun mail envoye (${skipped} en attente) — verifie la config SMTP ou copie les liens individuels.`,
            'info',
          )
        } else if (alreadyInvited > 0) {
          showToast(`Tous les etudiants ont deja ete invites (${alreadyInvited}).`, 'info')
        } else {
          showToast('Campagne active.', 'success')
        }
        return true
      }
      showToast(res.error || 'Erreur', 'error')
      return false
    } catch {
      showToast('Erreur au lancement', 'error')
      return false
    }
  }

  async function remindCampaign(id: number) {
    try {
      const res = await window.api.remindBookingCampaign(id)
      if (res.ok && res.data) {
        const { sent, pending } = res.data as { sent: number; pending: number }
        if (sent > 0) {
          showToast(`${sent} relance(s) envoyee(s) sur ${pending} en attente`, 'success')
        } else if (pending > 0) {
          showToast(
            `${pending} etudiant(s) en attente mais aucun mail envoye — verifie la config SMTP ou copie les liens individuels.`,
            'info',
          )
        } else {
          showToast('Aucun etudiant en attente de relance.', 'info')
        }
        return true
      }
      showToast(res.error || 'Erreur', 'error')
      return false
    } catch {
      showToast('Erreur a la relance', 'error')
      return false
    }
  }

  async function closeCampaign(id: number) {
    try {
      const res = await window.api.closeBookingCampaign(id)
      if (res.ok) {
        await fetchAll()
        showToast('Campagne cloturee', 'success')
        return true
      }
      return false
    } catch {
      return false
    }
  }

  return {
    campaigns, detail, loading,
    activeCampaigns, draftCampaigns, closedCampaigns,
    fetchAll, fetchDetail,
    createCampaign, updateCampaign, deleteCampaign,
    launchCampaign, remindCampaign, closeCampaign,
  }
}
