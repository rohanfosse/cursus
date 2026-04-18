/**
 * useRexTeacherSession : actions sur une session Rex cote enseignant
 * (create/select/clone/delete brouillon, start/end session, export).
 *
 * Le composant garde la main sur le form state (newTitle, isAsync,
 * openUntil) et delegue ici la logique d'appel store.
 */
import { useRexStore } from '@/stores/rex'
import type { RexSession } from '@/types'

export interface RexSessionCreateInput {
  newTitle: string
  isAsync: boolean
  openUntil: string
  promoId: number
}

export function useRexTeacherSession() {
  const rex = useRexStore()

  async function create(input: RexSessionCreateInput): Promise<boolean> {
    if (!input.newTitle.trim() || !input.promoId) return false
    const opts = input.isAsync
      ? { isAsync: true, openUntil: input.openUntil || undefined }
      : undefined
    await rex.createSession(input.newTitle.trim(), input.promoId, opts)
    return true
  }

  async function select(s: RexSession) {
    await rex.fetchSession(s.id)
    window.api.emitRexJoin(s.promo_id)
  }

  async function clone(s: RexSession, targetPromoId: number) {
    if (!targetPromoId) return
    await rex.cloneSession(s.id, targetPromoId)
  }

  async function deleteDraft(s: RexSession) {
    await rex.deleteSession(s.id)
  }

  async function start() {
    const session = rex.currentSession
    if (!session) return
    await rex.startSession(session.id)
  }

  async function end() {
    const session = rex.currentSession
    if (!session) return
    await rex.endSession(session.id)
  }

  async function doExport(format: string) {
    const session = rex.currentSession
    if (!session) return
    await rex.exportSession(session.id, format)
  }

  return { create, select, clone, deleteDraft, start, end, doExport }
}
