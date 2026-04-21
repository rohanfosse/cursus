/**
 * Types des payloads emis par le serveur via Socket.io. Extraits dans un
 * module dedie pour decharger preload/index.ts et permettre de typer
 * les `onXxxEvent(cb)` exposes a la renderer sans dupliquer les types.
 */

// ── Messages ───────────────────────────────────────────────────────────────
export type MsgNewPayload = {
  channelId:       number | null
  dmStudentId:     number | null
  authorName:      string | null
  channelName:     string | null
  promoId:         number | null
  preview:         string | null
  mentionEveryone: boolean
  mentionNames:    string[]
  message?:        unknown
}

export type UserStatusPayload = { emoji: string | null; text: string | null; expiresAt: string | null }
export type PresenceEntry = { id: number; name: string; role: string; status?: UserStatusPayload | null }
export type TypingPayload = { channelId?: number; dmStudentId?: number; userName: string }

export type StatusChangePayload = { userId: number; status: UserStatusPayload | null }

export type PollUpdatePayload = {
  messageId: number
  poll_votes: { totals: number[]; voters: Record<string, number[]> }
}

// ── Live Quiz / Live v2 ────────────────────────────────────────────────────
export type LiveActivityPushedPayload = { activity: unknown }
export type LiveActivityClosedPayload = { activityId: number }
export type LiveResultsUpdatePayload  = { activityId: number; data: unknown }
export type LiveSessionStartedPayload = { sessionId: number }
export type LiveSessionEndedPayload   = { sessionId: number }
export type LiveInvitePayload         = { sessionId: number; title: string; joinCode: string; teacherName: string }
export type LiveScoresUpdatePayload   = { sessionId: number; activityId: number; leaderboard: unknown[] }

export type LiveCodeUpdatePayload  = { activityId: number; content: string; language: string | null }
export type LiveBoardUpdatePayload = { activityId: number; action: 'add' | 'delete' | 'vote' | 'update' | 'hide'; card?: unknown; cardId?: number; votes?: number; hidden?: boolean }
export type LiveConfusionUpdatePayload = { sessionId: number; count: number }
export type LiveSelfPacedPayload = { sessionId: number; selfPaced: boolean }

// ── Booking ────────────────────────────────────────────────────────────────
export type BookingNewPayload       = { bookingId: number; tutorName: string; studentName: string; eventTitle: string; startDatetime: string }
export type BookingCancelledPayload = { bookingId: number; tutorName: string; eventTitle: string }

// ── Notifications diverses ─────────────────────────────────────────────────
export type GradeNewPayload = { devoirTitle: string; note: string | null; feedback: string | null; devoirId: number; category: string | null }
export type SignatureUpdatePayload = { id: number; status: string; signed_file_url?: string; signer_name?: string; rejection_reason?: string }
export type DocumentNewPayload = { name: string; category?: string; promoId?: number }
export type AssignmentNewPayload = { title: string; category?: string; deadline?: string; promoId?: number }
