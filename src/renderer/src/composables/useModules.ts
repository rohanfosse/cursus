/**
 * useModules — gestion centralisee des modules enrichissement activables/desactivables.
 *
 * Les modules enrichissement peuvent etre desactives par l'administrateur.
 * Ce composable charge l'etat depuis le serveur et expose des helpers reactifs
 * pour conditionner l'affichage.
 */
import { ref, readonly } from 'vue'

export type ModuleName = 'kanban' | 'frise' | 'live' | 'signatures' | 'lumen' | 'games'

const MODULES: ModuleName[] = ['kanban', 'frise', 'live', 'signatures', 'lumen', 'games']

const MODULE_LABELS: Record<ModuleName, string> = {
  kanban: 'Kanban projet',
  frise: 'Frise chronologique',
  live: 'Live',
  signatures: 'Signature PDF',
  lumen: 'Lumen',
  games: 'Jeux',
}

const state = ref<Record<ModuleName, boolean>>({
  kanban: true, frise: true, live: true, signatures: true, lumen: true, games: false,
})

let loaded = false

export function useModules() {
  async function loadModules() {
    if (loaded) return
    try {
      const res = await window.api.getModules() as { ok: boolean; data?: Record<string, boolean> }
      if (res?.ok && res.data) {
        for (const m of MODULES) {
          if (m in res.data) state.value[m] = res.data[m]
        }
      }
    } catch { /* defaults to all enabled */ }
    loaded = true
  }

  function isEnabled(module: ModuleName): boolean {
    return state.value[module] ?? true
  }

  async function setEnabled(module: ModuleName, enabled: boolean) {
    state.value = { ...state.value, [module]: enabled }
    await window.api.setModuleEnabled(module, enabled)
  }

  /** Force un rechargement (utile apres modification admin) */
  function resetLoaded() {
    loaded = false
    state.value = { kanban: true, frise: true, live: true, signatures: true, lumen: true, games: false }
  }

  return { modules: readonly(state), MODULES, MODULE_LABELS, isEnabled, setEnabled, loadModules, resetLoaded }
}
