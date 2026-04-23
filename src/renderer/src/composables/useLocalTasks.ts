// ─── État local des checklists (/checklist) ─────────────────────────────────
// Chaque utilisateur peut cocher/décocher les items d'une checklist sans
// modifier le message source. L'état est persisté en localStorage, keyé par
// msgId, et sert d'overlay au rendu markdown : on lit d'abord la source
// (`- [ ]` / `- [x]`), puis on applique l'override local si présent.
//
// Valeurs d'entrée dans le tableau par msgId :
//   - `true`  : l'utilisateur a coché cet item
//   - `false` : l'utilisateur l'a explicitement décoché
//   - `null`  : pas d'override (on garde l'état du markdown source)
import { ref } from 'vue'
import { safeGetJSON, safeSetJSON } from '@/utils/safeStorage'

const STORAGE_KEY = 'cc_local_tasks'

type LocalOverride = boolean | null
type LocalTasksMap = Record<string, LocalOverride[]>

const state = ref<LocalTasksMap>(safeGetJSON<LocalTasksMap>(STORAGE_KEY, {}))

function persist(): void {
  safeSetJSON(STORAGE_KEY, state.value)
}

export function useLocalTasks() {
  /** Retourne le tableau d'overrides pour un message (reactif). */
  function getForMsg(msgId: number | string): readonly LocalOverride[] {
    return state.value[String(msgId)] ?? []
  }

  /**
   * Toggle l'override local pour la Nième tâche d'un message.
   * `nextChecked` est l'état souhaité (typiquement l'inverse de l'état affiché).
   */
  function setOverride(msgId: number | string, idx: number, nextChecked: boolean): void {
    const key = String(msgId)
    const arr = state.value[key] ? [...state.value[key]] : []
    while (arr.length <= idx) arr.push(null)
    arr[idx] = nextChecked
    state.value = { ...state.value, [key]: arr }
    persist()
  }

  /** Efface tous les overrides pour un message (utile si le message est supprimé). */
  function clearForMsg(msgId: number | string): void {
    const key = String(msgId)
    if (!(key in state.value)) return
    const next = { ...state.value }
    delete next[key]
    state.value = next
    persist()
  }

  return { getForMsg, setOverride, clearForMsg }
}
