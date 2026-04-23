import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { SignatureRequest } from '@/types'

// ─── Store centralisé pour l'état d'ouverture de chaque modal ────────────────
// Chaque modal est un booléen ref. Les données contextuelles associées
// (ex: travailId pour un dépôt) sont dans les stores métier.

export const useModalsStore = defineStore('modals', () => {
  const depots          = ref(false)
  const suivi           = ref(false)
  const gestionDevoir   = ref(false)
  const ressources      = ref(false)
  const timeline        = ref(false)
  const echeancier      = ref(false)
  const settings        = ref(false)
  const documentPreview = ref(false)
  const newDevoir       = ref(false)
  const createChannel   = ref(false)
  const cmdPalette      = ref(false)
  const impersonate     = ref(false)
  const newProject        = ref(false)
  const studentTimeline   = ref(false)
  const rubric            = ref(false)
  const importStudents    = ref(false)
  const intervenants      = ref(false)
  const classe            = ref(false)
  const createPromo       = ref(false)
  const signatureRequest  = ref<SignatureRequest | null>(null)
  const createPoll        = ref(false)
  const createTable       = ref(false)
  const createCode        = ref(false)
  const createAnnounce    = ref(false)
  const createChecklist   = ref(false)
  const createDate        = ref(false)
  const createMath        = ref(false)
  const help              = ref(false)

  function closeAll() {
    depots.value            = false
    suivi.value             = false
    gestionDevoir.value     = false
    ressources.value        = false
    timeline.value          = false
    echeancier.value        = false
    settings.value          = false
    documentPreview.value   = false
    newDevoir.value         = false
    createChannel.value     = false
    cmdPalette.value        = false
    impersonate.value       = false
    newProject.value        = false
    studentTimeline.value   = false
    rubric.value            = false
    importStudents.value    = false
    intervenants.value      = false
    classe.value            = false
    createPromo.value       = false
    signatureRequest.value  = null
    createPoll.value        = false
    createTable.value       = false
    createCode.value        = false
    createAnnounce.value    = false
    createChecklist.value   = false
    createDate.value        = false
    createMath.value        = false
    help.value              = false
  }

  return {
    depots, suivi, gestionDevoir, ressources,
    timeline, echeancier, settings, documentPreview,
    newDevoir, createChannel, cmdPalette, impersonate, newProject,
    studentTimeline, rubric, importStudents, intervenants, classe, createPromo,
    signatureRequest,
    createPoll, createTable, createCode, createAnnounce, createChecklist, createDate, createMath, help,
    closeAll,
  }
})
