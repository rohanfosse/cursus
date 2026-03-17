import { ref } from 'vue'
import { defineStore } from 'pinia'

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
  const newProject      = ref(false)

  function closeAll() {
    depots.value          = false
    suivi.value           = false
    gestionDevoir.value   = false
    ressources.value      = false
    timeline.value        = false
    echeancier.value      = false
    settings.value        = false
    documentPreview.value = false
    newDevoir.value       = false
    createChannel.value   = false
    cmdPalette.value      = false
    impersonate.value     = false
    newProject.value      = false
  }

  return {
    depots, suivi, gestionDevoir, ressources,
    timeline, echeancier, settings, documentPreview,
    newDevoir, createChannel, cmdPalette, impersonate, newProject,
    closeAll,
  }
})
