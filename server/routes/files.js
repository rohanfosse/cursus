// ─── Route upload de fichiers ─────────────────────────────────────────────────
const router = require('express').Router()
const multer = require('multer')
const path   = require('path')
const fs     = require('fs')
const crypto = require('crypto')
const { recordUpload } = require('../db/models/uploads')

// Dossier de stockage - configurable via UPLOAD_DIR dans .env
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.join(process.env.UPLOAD_DIR, 'uploads')
  : path.join(__dirname, '../../uploads')

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

// ── Extensions dangereuses rejetées ─────────────────────────────────────────
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.dll', '.scr', '.pif', '.vbs', '.wsf',
  '.html', '.htm', '.svg', '.php', '.jsp', '.aspx', '.py', '.sh', '.ps1', '.reg',
])

// ── Multer : stockage disque ──────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const ext      = path.extname(file.originalname)
    const safeName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_\-\u00C0-\u024F]/g, '_')
      .slice(0, 60)
    const id = crypto.randomBytes(6).toString('hex')
    cb(null, `${Date.now()}_${id}_${safeName}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 Mo max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return cb(new Error(`Type de fichier non autorisé (${ext}).`))
    }
    cb(null, true)
  },
})

// POST /api/files/upload
//
// Le client peut passer en form-data les meta de scope :
//   kind          : 'message-attachment' | 'dm-attachment' | 'depot' |
//                   'document' | 'photo-profile' | 'signature' | 'cahier' |
//                   'image-paste' | 'audio' | 'attachment' (defaut)
//   channelId     : id du canal (pour message-attachment / document)
//   dmPeerId      : id du peer (pour dm-attachment)
//   travailId     : id du devoir (pour depot)
//
// Sans meta : `kind=attachment` et aucun scope. Le fichier reste accessible
// par son owner uniquement (et admin). Les anciens upload sans meta n'auront
// donc plus le comportement "tout JWT valide passe" pour les nouveaux fichiers.
router.post('/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ ok: false, error: 'Fichier trop volumineux (max 50 Mo).' })
      return res.status(400).json({ ok: false, error: err.message })
    }
    if (!req.file) return res.status(400).json({ ok: false, error: 'Aucun fichier reçu.' })

    try {
      recordUpload({
        filename:     req.file.filename,
        ownerId:      req.user?.id,
        ownerType:    req.user?.type ?? 'student',
        kind:         req.body?.kind,
        channelId:    req.body?.channelId ? Number(req.body.channelId) : null,
        dmPeerId:     req.body?.dmPeerId  ? Number(req.body.dmPeerId)  : null,
        travailId:    req.body?.travailId ? Number(req.body.travailId) : null,
        fileSize:     req.file.size,
        originalName: req.file.originalname,
      })
    } catch {
      // Non bloquant : si le tracking echoue (ex: DB indispo), on sert le
      // fichier quand meme. Le middleware /uploads aura le fallback legacy.
    }

    res.json({ ok: true, data: `/uploads/${req.file.filename}`, file_size: req.file.size })
  })
})

module.exports = router
