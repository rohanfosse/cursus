/**
 * useRexTeacherActivity : actions sur les activites Rex dans une session en
 * construction (enseignant) : add/edit/launch/close/delete/duplicate + view
 * results + toggle pin + edit form state.
 *
 * Les options sont stockees cote UI en `string[]` et serialisees en JSON
 * avant de passer au store (update uniquement, le store gere serialisation
 * a la creation).
 */
import { ref } from 'vue'
import { useRexStore } from '@/stores/rex'
import type { RexActivity } from '@/types'

export interface RexActivityPayload {
  type: RexActivity['type']
  title: string
  max_words?: number
  max_rating?: number
  options?: string[]
}

export function useRexTeacherActivity() {
  const rex = useRexStore()

  const editing = ref<RexActivity | null>(null)
  const showForm = ref(false)

  async function addOrUpdate(payload: RexActivityPayload): Promise<void> {
    const session = rex.currentSession
    if (!session) return
    if (editing.value) {
      const dbPayload = {
        ...payload,
        options: payload.options ? JSON.stringify(payload.options) : undefined,
      }
      await rex.updateActivity(editing.value.id, dbPayload)
      editing.value = null
    } else {
      await rex.pushActivity(session.id, payload)
    }
    showForm.value = false
  }

  function startEdit(act: RexActivity) {
    editing.value = act
    showForm.value = true
  }

  function cancelForm() {
    editing.value = null
    showForm.value = false
  }

  async function launch(act: RexActivity) {
    await rex.launchActivity(act.id)
  }

  async function closeCurrent() {
    const act = rex.currentActivity
    if (!act) return
    await rex.closeActivity(act.id)
  }

  async function remove(act: RexActivity) {
    await rex.deleteActivity(act.id)
  }

  async function viewResults(act: RexActivity) {
    rex.currentActivity = act
    await rex.fetchResults(act.id)
  }

  async function togglePin(responseId: number, pinned: boolean) {
    await rex.togglePin(responseId, pinned)
    if (rex.currentActivity) await rex.fetchResults(rex.currentActivity.id)
  }

  async function duplicate(act: RexActivity) {
    const session = rex.currentSession
    if (!session) return
    const payload: RexActivityPayload = {
      type: act.type,
      title: act.title + ' (copie)',
      max_words: act.max_words,
      max_rating: act.max_rating,
    }
    if (act.options) {
      try { payload.options = JSON.parse(act.options as string) } catch { /* ignore */ }
    }
    await rex.pushActivity(session.id, payload)
  }

  return {
    editing, showForm,
    addOrUpdate, startEdit, cancelForm,
    launch, closeCurrent, remove,
    viewResults, togglePin, duplicate,
  }
}
