// ─── Routes projets : CRUD + travaux/documents + assignation TA ──────────────
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap    = require('../utils/wrap')
const { getDb } = require('../db/connection')
const { requireRole, requirePromo, promoFromParam, requireProjectOwner } = require('../middleware/authorize')

// ── Schémas Zod ────────────────────────────────────────────────────────────────
const createProjectSchema = z.object({
  promoId:     z.number().int().positive('promoId requis'),
  name:        z.string().min(1, 'Nom requis').max(200),
  description: z.string().max(5000).nullable().optional(),
  channelId:   z.number().int().nullable().optional(),
  deadline:    z.string().nullable().optional(),
}).passthrough()

const updateProjectSchema = z.object({
  name:        z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  deadline:    z.string().nullable().optional(),
}).passthrough()

const assignTaSchema = z.object({
  teacherId: z.number().int().positive('teacherId requis'),
}).passthrough()

/** Lookup : project id → promo_id */
function promoFromProject(req) {
  const projectId = Number(req.params.id)
  if (!projectId) return null
  const p = getDb().prepare('SELECT promo_id FROM projects WHERE id = ?').get(projectId)
  return p?.promo_id ?? null
}

// ── Projets CRUD ──────────────────────────────────────────────────────────────

// GET /ta/my-projects doit etre declare AVANT /:id pour eviter le conflit de route
router.get('/ta/my-projects', requireRole('ta'), wrap((req) => {
  const teacherId = Math.abs(req.user.id)
  return queries.getTaProjects(teacherId)
}))

router.get('/promo/:promoId', requirePromo(promoFromParam), wrap((req) => queries.getProjectsByPromo(Number(req.params.promoId))))

router.get('/:id', requirePromo(promoFromProject), wrap((req) => queries.getProjectById(Number(req.params.id))))

router.post('/', requireRole('teacher'), validate(createProjectSchema), wrap((req) => {
  const { promoId, name, description, channelId, deadline } = req.body
  const createdBy = Math.abs(req.user.id)
  return queries.createProject({ promoId, name, description, channelId, deadline, createdBy })
}))

router.put('/:id', requireRole('teacher'), requireProjectOwner, validate(updateProjectSchema), wrap((req) => {
  const { name, description, deadline } = req.body
  return queries.updateProject(Number(req.params.id), { name, description, deadline })
}))

router.delete('/:id', requireRole('teacher'), requireProjectOwner, wrap((req) => queries.deleteProject(Number(req.params.id))))

// ── Travaux d'un projet ───────────────────────────────────────────────────────

router.get('/:id/travaux', requirePromo(promoFromProject), wrap((req) => queries.getProjectTravaux(Number(req.params.id))))

router.post('/:id/travaux/:travailId', requireRole('teacher'), requireProjectOwner, wrap((req) =>
  queries.addTravailToProject(Number(req.params.id), Number(req.params.travailId))
))

router.delete('/:id/travaux/:travailId', requireRole('teacher'), requireProjectOwner, wrap((req) =>
  queries.removeTravailFromProject(Number(req.params.id), Number(req.params.travailId))
))

// ── Documents d'un projet ─────────────────────────────────────────────────────

router.get('/:id/documents', requirePromo(promoFromProject), wrap((req) => queries.getProjectLinkedDocuments(Number(req.params.id))))

router.post('/:id/documents/:documentId', requireRole('teacher'), requireProjectOwner, wrap((req) =>
  queries.addDocumentToProject(Number(req.params.id), Number(req.params.documentId))
))

// ── Assignation TA ────────────────────────────────────────────────────────────

router.get('/:id/tas', requirePromo(promoFromProject), wrap((req) => queries.getProjectTas(Number(req.params.id))))

router.post('/:id/assign-ta', requireRole('teacher'), requireProjectOwner, validate(assignTaSchema), wrap((req) => {
  return queries.assignTaToProject(req.body.teacherId, Number(req.params.id))
}))

router.delete('/:id/unassign-ta/:teacherId', requireRole('teacher'), requireProjectOwner, wrap((req) =>
  queries.unassignTaFromProject(Number(req.params.teacherId), Number(req.params.id))
))

module.exports = router
