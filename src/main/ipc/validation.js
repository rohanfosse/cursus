// ─── IPC : Validation des payloads avec Zod ──────────────────────────────────
const { z } = require('zod')

// ── Helpers ─────────────────────────────────────────────────────────────────
const id       = z.number().int().finite()
const optId    = id.optional().nullable()
const safeStr  = z.string().min(1).max(10_000)
const optStr   = z.string().max(10_000).optional().nullable()

// ── Messages ────────────────────────────────────────────────────────────────
const sendMessagePayload = z.object({
  channelId:      optId,
  dmStudentId:    optId,
  authorName:     safeStr,
  authorType:     z.enum(['teacher', 'ta', 'student']),
  content:        z.string().min(1).max(10_000),
  channelName:    optStr,
  promoId:        optId,
  replyToId:      optId,
  replyToAuthor:  optStr,
  replyToPreview: optStr,
}).refine(
  (d) => d.channelId != null || d.dmStudentId != null,
  { message: 'channelId ou dmStudentId requis' },
)

// ── Travaux ─────────────────────────────────────────────────────────────────
const createTravailPayload = z.object({
  channelId:    id,
  title:        safeStr,
  type:         z.enum(['soutenance', 'livrable', 'cctl', 'etude_de_cas', 'memoire', 'autre']),
  deadline:     z.string().min(1),
  description:  optStr,
  category:     optStr,
  startDate:    optStr,
  assignedTo:   z.enum(['all', 'group']).optional(),
  groupId:      optId,
  room:         optStr,
  aavs:         optStr,
  isPublished:  z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  requiresSubmission: z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
})

const addDepotPayload = z.object({
  travailId:  id,
  studentId:  id,
  type:       z.enum(['file', 'link']),
  content:    z.string().min(1).max(500_000),
  fileName:   optStr,
  linkUrl:    optStr,
  deployUrl:  optStr,
})

const setNotePayload = z.object({
  depotId: id,
  note:    z.string().max(20),
})

const setFeedbackPayload = z.object({
  depotId:  id,
  feedback: z.string().max(10_000),
})

// ── Structure ───────────────────────────────────────────────────────────────
const createChannelPayload = z.object({
  promoId:     id,
  name:        safeStr,
  type:        z.enum(['chat', 'annonce']).optional(),
  description: optStr,
  isPrivate:   z.union([z.boolean(), z.literal(0), z.literal(1)]).optional(),
  category:    optStr,
  members:     z.array(id).optional(),
})

const createPromotionPayload = z.object({
  name:  safeStr,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

const registerStudentPayload = z.object({
  name:     safeStr,
  email:    z.string().email().max(255),
  password: z.string().min(4).max(255),
  promoId:  id,
})

// ── Documents ───────────────────────────────────────────────────────────────
const addDocumentPayload = z.object({
  channelId:   optId,
  promoId:     optId,
  project:     optStr,
  type:        z.enum(['file', 'link']),
  name:        safeStr,
  pathOrUrl:   z.string().min(1).max(10_000),
  category:    optStr,
  description: optStr,
  authorName:  optStr,
  authorType:  optStr,
})

// ── Wrapper ─────────────────────────────────────────────────────────────────
/**
 * Crée un handler IPC validé avec un schéma Zod.
 * Compatible avec le helper `handle` existant.
 */
function validated(schema, fn) {
  return (...args) => {
    // Le payload est toujours le premier argument
    const result = schema.safeParse(args[0])
    if (!result.success) {
      const msg = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
      throw new Error(`Données invalides : ${msg}`)
    }
    return fn(result.data, ...args.slice(1))
  }
}

module.exports = {
  sendMessagePayload,
  createTravailPayload,
  addDepotPayload,
  setNotePayload,
  setFeedbackPayload,
  createChannelPayload,
  createPromotionPayload,
  registerStudentPayload,
  addDocumentPayload,
  validated,
}
