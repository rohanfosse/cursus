// ─── Routes signatures sécurisées ────────────────────────────────────────────
const router    = require('express').Router()
const path      = require('path')
const fs        = require('fs')
const crypto    = require('crypto')
const { z }     = require('zod')
const rateLimit = require('express-rate-limit')
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib')
const { requireRole } = require('../middleware/authorize')
const { validate }       = require('../middleware/validate')
const { getDb }          = require('../db/connection')
const wrap    = require('../utils/wrap')
const queries = require('../db/models/signatures')

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'uploads')
  : path.join(__dirname, '../../uploads')

// ── Rate limiters spécifiques ────────────────────────────────────────────────
const createLimiter = rateLimit({
  windowMs: 60_000, max: 10,
  keyGenerator: (req) => `sig-create:${req.user?.id ?? 'anon'}`,
  message: { ok: false, error: 'Trop de demandes de signature. Réessayez dans une minute.' },
  validate: { xForwardedForHeader: false },
})
const signLimiter = rateLimit({
  windowMs: 60_000, max: 15,
  keyGenerator: (req) => `sig-sign:${req.user?.id ?? 'anon'}`,
  message: { ok: false, error: 'Trop de signatures. Réessayez dans une minute.' },
  validate: { xForwardedForHeader: false },
})

// ── Schémas de validation ────────────────────────────────────────────────────
const createSchema = z.object({
  message_id:    z.number().int().positive(),
  dm_student_id: z.number().int().positive(),
  file_url:      z.string().min(1).max(500),
  file_name:     z.string().min(1).max(255),
})

const signSchema = z.object({
  signature_image: z.string().min(100).max(700_000), // ~500KB base64
})

const rejectSchema = z.object({
  reason: z.string().max(1000).optional().default(''),
})

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Calcule le SHA-256 d'un Buffer ou fichier. */
function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return null
  const buf = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(buf).digest('hex')
}

/** Résout un chemin de fichier uploadé de manière sécurisée (anti path-traversal). */
function resolveUploadPath(fileUrl) {
  // Seules les URLs /uploads/ sont autorisées
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) return null
  const fileName = path.basename(fileUrl)
  const resolved = path.join(UPLOAD_DIR, fileName)
  // Vérifier que le chemin résolu reste dans UPLOAD_DIR
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR))) return null
  return resolved
}

/** Log d'audit pour les opérations signature. */
function auditSignature(req, action, target, details) {
  try {
    const { logAudit } = require('../db/models/admin')
    logAudit({
      actorId: req.user?.id, actorName: req.user?.name, actorType: req.user?.type,
      action, target, details: details ? JSON.stringify(details) : null, ip: req.ip,
    })
  } catch { /* non bloquant */ }
}

// ── Créer une demande de signature ──────────────────────────────────────────
// Seuls les étudiants peuvent créer, et uniquement dans leur propre boîte DM.
router.post('/', createLimiter, validate(createSchema), (req, res) => {
  try {
    const { message_id, dm_student_id, file_url, file_name } = req.body

    // ── Sécurité : un étudiant ne peut créer que dans sa propre boîte DM
    if (req.user.type === 'student' && req.user.id !== dm_student_id) {
      return res.status(403).json({ ok: false, error: 'Vous ne pouvez demander une signature que dans vos propres conversations.' })
    }

    // ── Sécurité : vérifier que le message existe et appartient au DM
    const msg = getDb().prepare(
      'SELECT id, dm_student_id FROM messages WHERE id = ? AND dm_student_id = ? AND deleted_at IS NULL'
    ).get(message_id, dm_student_id)
    if (!msg) {
      return res.status(400).json({ ok: false, error: 'Message introuvable ou ne correspond pas à la conversation.' })
    }

    // ── Sécurité : vérifier que le fichier existe et calculer son hash
    const filePath = resolveUploadPath(file_url)
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({ ok: false, error: 'Fichier introuvable. Seuls les fichiers uploadés sont acceptés.' })
    }
    const fileHash = hashFile(filePath)

    // ── Sécurité : empêcher les doublons (un seul pending par message)
    const existing = queries.getSignatureByMessageId(message_id)
    if (existing && existing.status === 'pending') {
      return res.status(409).json({ ok: false, error: 'Une demande de signature est déjà en cours pour ce fichier.' })
    }

    const result = queries.createSignatureRequest(
      message_id, dm_student_id, file_url, file_name,
      fileHash, req.user.id, req.ip
    )

    auditSignature(req, 'signature:request', `signature:${result.lastInsertRowid}`, {
      message_id, dm_student_id, file_name,
    })

    res.json({ ok: true, data: { id: result.lastInsertRowid } })
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message })
  }
})

// ── Lister les demandes ─────────────────────────────────────────────────────
router.get('/', requireRole('teacher'), wrap((req) => {
  const status = req.query.status || undefined
  const studentId = req.query.student_id ? Number(req.query.student_id) : undefined
  return queries.getSignatureRequests({ status, studentId })
}))

// ── Nombre de demandes en attente (prof) ────────────────────────────────────
router.get('/pending-count', requireRole('teacher'), wrap(() => {
  return { count: queries.getPendingCount() }
}))

// ── Signer un document (prof uniquement) ────────────────────────────────────
router.post('/:id/sign', requireRole('teacher'), signLimiter, validate(signSchema), async (req, res) => {
  try {
    const sigReq = queries.getSignatureById(Number(req.params.id))
    if (!sigReq) return res.status(404).json({ ok: false, error: 'Demande introuvable' })
    if (sigReq.status !== 'pending') return res.status(400).json({ ok: false, error: 'Demande déjà traitée' })

    // ── Securite : verifier que le prof a acces au DM de l'etudiant (via teacher_promos)
    const teacherId = Math.abs(req.user.id)
    const student = getDb().prepare('SELECT promo_id FROM students WHERE id = ?').get(sigReq.dm_student_id)
    if (student) {
      const hasAssignment = getDb().prepare('SELECT 1 FROM teacher_promos WHERE teacher_id = ? LIMIT 1').get(teacherId)
      if (hasAssignment) {
        const hasAccess = getDb().prepare(
          'SELECT 1 FROM teacher_promos WHERE teacher_id = ? AND promo_id = ? LIMIT 1'
        ).get(teacherId, student.promo_id)
        if (!hasAccess) {
          return res.status(403).json({ ok: false, error: 'Vous n\'êtes pas affecté à la promotion de cet étudiant.' })
        }
      }
    }

    const { signature_image } = req.body

    // ── Sécurité : valider le format de l'image signature
    const mimeMatch = signature_image.match(/^data:(image\/png);base64,/)
    if (!mimeMatch) {
      return res.status(400).json({ ok: false, error: 'Format de signature invalide. Seul PNG est accepté.' })
    }

    const signerName = req.user?.name || 'Professeur'

    // ── Sécurité : résoudre le chemin de manière sûre (anti path-traversal)
    const filePath = resolveUploadPath(sigReq.file_url)
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ ok: false, error: 'Fichier PDF introuvable' })
    }

    // ── Sécurité : vérifier l'intégrité du document (hash)
    if (sigReq.file_hash) {
      const currentHash = hashFile(filePath)
      if (currentHash !== sigReq.file_hash) {
        return res.status(409).json({ ok: false, error: 'Le fichier a été modifié depuis la demande de signature. Intégrité compromise.' })
      }
    }

    const pdfBytes = fs.readFileSync(filePath)

    // Tamponner la signature sur le PDF
    const signedPdfBytes = await stampSignature(pdfBytes, signature_image, signerName, sigReq.id)

    // Nom de fichier sécurisé (16 bytes aléatoires, pas de nom original pour éviter path traversal)
    const signedFileName = `signed_${crypto.randomBytes(16).toString('hex')}.pdf`
    const signedFilePath = path.join(UPLOAD_DIR, signedFileName)
    fs.writeFileSync(signedFilePath, signedPdfBytes)

    const signedFileUrl = `/uploads/${signedFileName}`

    // Mettre à jour la DB avec l'identité du signataire
    queries.signDocument(sigReq.id, signerName, signedFileUrl, req.user.id, req.ip)

    // Audit log
    auditSignature(req, 'signature:sign', `signature:${sigReq.id}`, {
      student_id: sigReq.dm_student_id, file_name: sigReq.file_name,
      signed_file: signedFileName,
    })

    // Notification Socket.io
    const io = req.app.get('io')
    if (io) {
      io.to(`user:${sigReq.dm_student_id}`).emit('signature:update', {
        id: sigReq.id,
        status: 'signed',
        signed_file_url: signedFileUrl,
        signer_name: signerName,
      })
    }

    res.json({ ok: true, data: { signed_file_url: signedFileUrl } })
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message })
  }
})

// ── Refuser une demande (prof uniquement) ───────────────────────────────────
router.post('/:id/reject', requireRole('teacher'), validate(rejectSchema), wrap((req) => {
  const sigReq = queries.getSignatureById(Number(req.params.id))
  if (!sigReq) throw new Error('Demande introuvable')
  if (sigReq.status !== 'pending') throw new Error('Demande déjà traitée')

  const reason = req.body.reason || ''
  queries.rejectDocument(sigReq.id, reason, req.user.id, req.ip)

  auditSignature(req, 'signature:reject', `signature:${sigReq.id}`, {
    student_id: sigReq.dm_student_id, file_name: sigReq.file_name, reason,
  })

  const io = req.app.get('io')
  if (io) {
    io.to(`user:${sigReq.dm_student_id}`).emit('signature:update', {
      id: sigReq.id,
      status: 'rejected',
      rejection_reason: reason,
    })
  }

  return { ok: true }
}))

// ── Obtenir la signature pour un message ────────────────────────────────────
router.get('/by-message/:messageId', wrap((req) => {
  const result = queries.getSignatureByMessageId(Number(req.params.messageId))
  if (req.user.type === 'student' && result && result.dm_student_id !== req.user.id) {
    throw Object.assign(new Error('Acces non autorise.'), { statusCode: 403 })
  }
  return result
}))

// ── PDF stamping ────────────────────────────────────────────────────────────
async function stampSignature(pdfBytes, signatureBase64, signerName, refId) {
  const doc = await PDFDocument.load(pdfBytes)
  const lastPage = doc.getPages()[doc.getPageCount() - 1]
  const { width } = lastPage.getSize()

  // Extraire les données base64 (retirer le prefix data:image/png;base64,)
  const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, '')
  const sigImgBytes = Buffer.from(base64Data, 'base64')

  const sigImg = await doc.embedPng(sigImgBytes)
  const sigDims = sigImg.scale(0.25)

  // Position : bas droite de la dernière page
  const sigX = width - sigDims.width - 50
  const sigY = 70

  lastPage.drawImage(sigImg, {
    x: sigX, y: sigY,
    width: sigDims.width, height: sigDims.height,
  })

  // Texte sous la signature
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const dateStr = new Date().toLocaleDateString('fr-FR')
  const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  lastPage.drawText(`Signé par ${signerName} le ${dateStr} à ${timeStr}`, {
    x: sigX, y: sigY - 12, size: 8, font, color: rgb(0.3, 0.3, 0.3),
  })

  // Référence unique + hash pour traçabilité
  const sigHash = crypto.createHash('sha256')
    .update(`${refId}:${signerName}:${dateStr}:${timeStr}`)
    .digest('hex').slice(0, 12).toUpperCase()
  lastPage.drawText(`REF-SIG-${String(refId).padStart(4, '0')} · ${sigHash}`, {
    x: sigX, y: sigY - 22, size: 7, font, color: rgb(0.5, 0.5, 0.5),
  })

  return Buffer.from(await doc.save())
}

module.exports = router
