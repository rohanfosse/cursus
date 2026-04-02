// ─── Routes documents ────────────────────────────────────────────────────────
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const { validate } = require('../middleware/validate')
const wrap    = require('../utils/wrap')
const log     = require('../utils/logger')
const { AppError } = require('../utils/errors')
const { requireRole, requirePromo, promoFromChannel, promoFromParam } = require('../middleware/authorize')

// ── Constantes de sécurité ────────────────────────────────────────────────────
const path = require('path')
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.dll', '.scr', '.pif', '.vbs', '.wsf',
  '.jar', '.apk', '.ps1', '.sh',
])

/** Vérifie la sécurité d'un payload de document (traversée, extension, taille). */
function validateDocSecurity(payload) {
  if (payload.type === 'file') {
    const normalized = path.normalize(payload.pathOrUrl)
    if (normalized.includes('..')) {
      throw new AppError('Chemin de fichier invalide.')
    }
    const ext = payload.name.toLowerCase().match(/\.[^.]+$/)?.[0]
    if (ext && BLOCKED_EXTENSIONS.has(ext)) {
      throw new AppError('Type de fichier non autorise.')
    }
  }
  if (payload.fileSize && payload.fileSize > MAX_FILE_SIZE) {
    throw new AppError('Fichier trop volumineux (max 50 Mo).')
  }
}

// ── Schémas de validation ─────────────────────────────────────────────────────
const addChannelDocSchema = z.object({
  channelId:   z.number().int().positive().optional(),
  promoId:     z.number().int().positive().optional(),
  project:     z.string().max(200).nullable().optional(),
  category:    z.string().max(100).optional().default('Général'),
  type:        z.enum(['file', 'link']),
  name:        z.string().min(1, 'Nom requis').max(500, 'Nom trop long'),
  pathOrUrl:   z.string().min(1, 'Chemin ou URL requis').max(2000),
  description: z.string().max(2000).nullable().optional(),
  fileSize:    z.number().int().min(0).nullable().optional(),
  authorName:  z.string().max(200).nullable().optional(),
  authorType:  z.string().max(20).optional(),
  travailId:   z.number().int().nullable().optional(),
}).passthrough()

const updateDocSchema = z.object({
  name:        z.string().min(1).max(500).optional(),
  category:    z.string().max(100).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  project:     z.string().max(200).nullable().optional(),
  travailId:   z.number().int().nullable().optional(),
}).passthrough()

// ── Helper : vérifier que le document appartient à une promo du prof ─────────
function requireDocOwnership(req, res, next) {
  const { getDb } = require('../db/connection')
  const docId = Number(req.params.id)
  const doc = getDb().prepare('SELECT promo_id FROM channel_documents WHERE id = ?').get(docId)
  if (!doc) return res.status(404).json({ ok: false, error: 'Document introuvable.' })
  // En mode "teacher avec affectations", vérifier l'accès promo
  // (les profs sans affectation = admin ont accès total)
  const teacherId = Math.abs(req.user?.id ?? 0)
  const hasAny = getDb().prepare('SELECT 1 FROM teacher_promos WHERE teacher_id = ? LIMIT 1').get(teacherId)
  if (hasAny) {
    const hasAccess = getDb().prepare(
      'SELECT 1 FROM teacher_promos WHERE teacher_id = ? AND promo_id = ? LIMIT 1'
    ).get(teacherId, doc.promo_id)
    if (!hasAccess) return res.status(403).json({ ok: false, error: 'Vous n\'avez pas accès aux documents de cette promotion.' })
  }
  next()
}

// ── Documents de canal ────────────────────────────────────────────────────────
router.get('/channel/:channelId',             requirePromo(promoFromChannel), wrap((req) => queries.getChannelDocuments(Number(req.params.channelId))))
router.get('/channel/:channelId/categories',  requirePromo(promoFromChannel), wrap((req) => queries.getChannelDocumentCategories(Number(req.params.channelId))))
router.get('/promo/:promoId',                 requirePromo(promoFromParam), wrap((req) => queries.getPromoDocuments(Number(req.params.promoId))))

router.post('/channel', requireRole('teacher'), validate(addChannelDocSchema), wrap((req) => {
  const payload = req.body
  validateDocSecurity(payload)
  const result = queries.addChannelDocument(payload)
  const io = req.app.get('io')
  if (io && payload.promoId) {
    io.to(`promo:${payload.promoId}`).emit('document:new', { name: payload.name, category: payload.category || null, promoId: payload.promoId })
  }
  return result
}))

router.patch('/project/:id', requireRole('teacher'), requireDocOwnership, validate(updateDocSchema), wrap((req) => {
  return queries.updateProjectDocument({ id: Number(req.params.id), ...req.body })
}))

router.delete('/channel/:id', requireRole('teacher'), requireDocOwnership, wrap((req) => {
  return queries.deleteChannelDocument(Number(req.params.id))
}))

// ── Recherche & liaison ───────────────────────────────────────────────────────
router.get('/search', requirePromo(promoFromParam), wrap((req) => queries.searchDocuments(Number(req.query.promoId), req.query.q ?? '')))
router.patch('/link/:id', requireRole('teacher'), requireDocOwnership, wrap((req) => queries.linkDocumentToTravail(Number(req.params.id), req.body.travailId ?? null)))

// ── Documents de projet ───────────────────────────────────────────────────────
router.get('/project', requirePromo(promoFromParam), wrap((req) => queries.getProjectDocuments(
  Number(req.query.promoId),
  req.query.project ?? null,
)))
router.get('/project/categories', requirePromo(promoFromParam), wrap((req) => queries.getProjectDocumentCategories(
  Number(req.query.promoId),
  req.query.project ?? null,
)))

router.post('/project', requireRole('ta'), validate(addChannelDocSchema), wrap((req) => {
  const payload = req.body
  validateDocSecurity(payload)
  const result  = queries.addProjectDocument(payload)

  // Notification aux canaux du projet avec ref document cliquable
  const docId = result?.lastInsertRowid ?? null
  if (result?.changes && payload.project && payload.promoId && payload.authorName) {
    try {
      const channels = queries.getChannels(payload.promoId)
      const projectChannels = channels.filter((c) => c.category?.trim() === payload.project?.trim())
      const catPart = payload.category && payload.category !== 'Général' ? ` · ${payload.category}` : ''
      const docRef = docId ? `📄 [${payload.name}](doc:${docId})` : `📄 **${payload.name}**`
      const text   = `${docRef} a été ajouté aux documents${catPart}`
      for (const ch of projectChannels) {
        queries.sendMessage({
          channelId:  ch.id,
          authorName: payload.authorName,
          authorId:   payload.authorId ?? null,
          authorType: payload.authorType ?? 'teacher',
          content:    text,
        })
      }
    } catch (e) {
      log.warn('project_doc_notification_failed', { error: e.message })
    }
  }

  const io = req.app.get('io')
  if (io && payload.promoId) {
    io.to(`promo:${payload.promoId}`).emit('document:new', { name: payload.name, category: payload.category || null, promoId: payload.promoId })
  }

  return result
}))

module.exports = router
