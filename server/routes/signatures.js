const router = require('express').Router()
const path   = require('path')
const fs     = require('fs')
const crypto = require('crypto')
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib')
const { requireTeacher } = require('../middleware/authorize')
const wrap   = require('../utils/wrap')
const queries = require('../db/models/signatures')

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'uploads')
  : path.join(__dirname, '../../uploads')

// ── Creer une demande de signature (etudiant) ───────────────────────────────
router.post('/', wrap((req) => {
  const { message_id, dm_student_id, file_url, file_name } = req.body
  if (!message_id || !dm_student_id || !file_url || !file_name) {
    throw new Error('Champs requis : message_id, dm_student_id, file_url, file_name')
  }
  const result = queries.createSignatureRequest(message_id, dm_student_id, file_url, file_name)
  return { id: result.lastInsertRowid }
}))

// ── Lister les demandes ─────────────────────────────────────────────────────
router.get('/', wrap((req) => {
  const status = req.query.status || undefined
  const studentId = req.query.student_id ? Number(req.query.student_id) : undefined
  return queries.getSignatureRequests({ status, studentId })
}))

// ── Nombre de demandes en attente (prof) ────────────────────────────────────
router.get('/pending-count', requireTeacher, wrap(() => {
  return { count: queries.getPendingCount() }
}))

// ── Signer un document (prof uniquement) ────────────────────────────────────
router.post('/:id/sign', requireTeacher, async (req, res) => {
  try {
    const sigReq = queries.getSignatureById(Number(req.params.id))
    if (!sigReq) return res.status(404).json({ ok: false, error: 'Demande introuvable' })
    if (sigReq.status !== 'pending') return res.status(400).json({ ok: false, error: 'Demande deja traitee' })

    const { signature_image } = req.body
    if (!signature_image) return res.status(400).json({ ok: false, error: 'Image de signature requise' })

    const signerName = req.user?.name || 'Professeur'

    // Lire le PDF original
    const fileUrl = sigReq.file_url
    const filePath = fileUrl.startsWith('/uploads/')
      ? path.join(UPLOAD_DIR, path.basename(fileUrl))
      : path.join(__dirname, '../../', fileUrl)

    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: 'Fichier PDF introuvable' })

    const pdfBytes = fs.readFileSync(filePath)

    // Tamponner la signature sur le PDF
    const signedPdfBytes = await stampSignature(pdfBytes, signature_image, signerName, sigReq.id)

    // Sauvegarder le PDF signe
    const signedFileName = `signed_${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${sigReq.file_name}`
    const signedFilePath = path.join(UPLOAD_DIR, signedFileName)
    fs.writeFileSync(signedFilePath, signedPdfBytes)

    const signedFileUrl = `/uploads/${signedFileName}`

    // Mettre a jour la DB
    queries.signDocument(sigReq.id, signerName, signedFileUrl)

    // Notification Socket.io (si disponible)
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
router.post('/:id/reject', requireTeacher, wrap((req) => {
  const sigReq = queries.getSignatureById(Number(req.params.id))
  if (!sigReq) throw new Error('Demande introuvable')
  if (sigReq.status !== 'pending') throw new Error('Demande deja traitee')

  const reason = req.body.reason || ''
  queries.rejectDocument(sigReq.id, reason)

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
  return queries.getSignatureByMessageId(Number(req.params.messageId))
}))

// ── PDF stamping ────────────────────────────────────────────────────────────
async function stampSignature(pdfBytes, signatureBase64, signerName, refId) {
  const doc = await PDFDocument.load(pdfBytes)
  const lastPage = doc.getPages()[doc.getPageCount() - 1]
  const { width } = lastPage.getSize()

  // Extraire les donnees base64 (retirer le prefix data:image/png;base64,)
  const base64Data = signatureBase64.replace(/^data:image\/\w+;base64,/, '')
  const sigImgBytes = Buffer.from(base64Data, 'base64')

  const sigImg = await doc.embedPng(sigImgBytes)
  const sigDims = sigImg.scale(0.25)

  // Position : bas droite de la derniere page
  const sigX = width - sigDims.width - 50
  const sigY = 70

  lastPage.drawImage(sigImg, {
    x: sigX,
    y: sigY,
    width: sigDims.width,
    height: sigDims.height,
  })

  // Texte sous la signature
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const dateStr = new Date().toLocaleDateString('fr-FR')
  lastPage.drawText(`Signe par ${signerName} le ${dateStr}`, {
    x: sigX,
    y: sigY - 12,
    size: 8,
    font,
    color: rgb(0.3, 0.3, 0.3),
  })
  lastPage.drawText(`REF-SIG-${String(refId).padStart(4, '0')}`, {
    x: sigX,
    y: sigY - 22,
    size: 7,
    font,
    color: rgb(0.5, 0.5, 0.5),
  })

  return Buffer.from(await doc.save())
}

module.exports = router
