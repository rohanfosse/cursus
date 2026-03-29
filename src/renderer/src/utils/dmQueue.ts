// ─── File d'attente offline pour DM non envoyes ─────────────────────────────
// Stockage persistant via localStorage (safeStorage wrappers).
// FIFO : les messages les plus anciens sont evictes si la queue depasse MAX_QUEUE_SIZE.

import { safeGetJSON, safeSetJSON } from '@/utils/safeStorage'

export interface QueuedMessage {
  channelId?: number | null
  dmStudentId?: number | null
  dmPeerId?: number | null
  content: string
  authorName: string
  authorType: 'admin' | 'teacher' | 'ta' | 'student'
  timestamp: number
  replyToId?: number | null
  replyToAuthor?: string | null
  replyToPreview?: string | null
}

const QUEUE_KEY = 'cc_dm_queue'
const MAX_QUEUE_SIZE = 50

export function loadQueue(): QueuedMessage[] {
  return safeGetJSON<QueuedMessage[]>(QUEUE_KEY, [])
}

export function saveQueue(queue: QueuedMessage[]): void {
  safeSetJSON(QUEUE_KEY, queue)
}

export function enqueue(msg: QueuedMessage): void {
  const queue = loadQueue()
  const next = [...queue, msg]
  // FIFO eviction : retirer les plus anciens si depasse la limite
  const trimmed = next.length > MAX_QUEUE_SIZE
    ? next.slice(next.length - MAX_QUEUE_SIZE)
    : next
  saveQueue(trimmed)
}

export function dequeue(): QueuedMessage | undefined {
  const queue = loadQueue()
  if (queue.length === 0) return undefined
  const [first, ...rest] = queue
  saveQueue(rest)
  return first
}

export function peekAll(): QueuedMessage[] {
  return loadQueue()
}

export function clearQueue(): void {
  saveQueue([])
}

export function queueSize(): number {
  return loadQueue().length
}
