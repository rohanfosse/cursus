/**
 * Routes du mini-jeu TypeRace (v73+).
 *
 * GET  /phrases/random?exclude=1,2,3 — une phrase aleatoire avec exclusion
 * POST /scores                        — enregistre une partie (anti-triche cote serveur)
 * GET  /leaderboard?scope=day|week|all — top 10 etudiants de la promo courante
 * GET  /me                             — stats perso + historique 30 jours
 */
const path    = require('path')
const fs      = require('fs')
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const log     = require('../utils/logger')
const wrap    = require('../utils/wrap')
const { validate } = require('../middleware/validate')
const { AppError, NotFoundError } = require('../utils/errors')

// ── Chargement des phrases ───────────────────────────────────────────────────
// Cache module-level : le fichier est lu une seule fois au premier import.
// C'est un JSON statique de ~100 phrases, aucun interet a relire a chaque GET.
let PHRASES_CACHE = null
function loadPhrases() {
  if (PHRASES_CACHE) return PHRASES_CACHE
  const file = path.join(__dirname, '..', 'data', 'typerace-phrases-fr.json')
  const raw = fs.readFileSync(file, 'utf8')
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed.phrases)) {
    throw new Error('typerace-phrases-fr.json malforme : `phrases` absent')
  }
  PHRASES_CACHE = parsed.phrases
  return PHRASES_CACHE
}

// ── GET /phrases/random ──────────────────────────────────────────────────────

router.get('/phrases/random', wrap((req) => {
  const phrases = loadPhrases()
  const excludeRaw = String(req.query.exclude ?? '').trim()
  const excludeIds = excludeRaw
    ? new Set(excludeRaw.split(',').map((s) => parseInt(s, 10)).filter(Number.isFinite))
    : new Set()

  // On pioche dans les non-exclus, ou si tout est exclu on repioche dans
  // tout (fallback pour ne pas bloquer le joueur qui a epuise la banque).
  const pool = phrases.filter((p) => !excludeIds.has(p.id))
  const effective = pool.length > 0 ? pool : phrases
  const chosen = effective[Math.floor(Math.random() * effective.length)]
  return { id: chosen.id, text: chosen.text }
}))

// ── POST /scores ─────────────────────────────────────────────────────────────

const scoreSchema = z.object({
  phraseId:   z.number().int().positive(),
  wpm:        z.number().min(0).max(300),
  accuracy:   z.number().min(0).max(1),
  durationMs: z.number().int().min(500).max(65_000),
}).strict()

/**
 * Verifie que le score declare est plausible : le nombre de mots dans la
 * phrase / durationMs (en minutes) doit etre proche du WPM declare.
 * Tolerance large (x3) car l'etudiant tape peut-etre plus vite que la
 * phrase et repete des fautes. On rejette seulement les cas aberrants.
 */
function isScoreCoherent(phrase, wpm, durationMs) {
  const wordCount = phrase.text.trim().split(/\s+/).length
  const durationMin = durationMs / 60000
  if (durationMin <= 0) return false
  const maxPossibleWpm = (wordCount / durationMin) * 3 // x3 = tres large
  return wpm <= Math.max(maxPossibleWpm, 50)
}

router.post('/scores', validate(scoreSchema), wrap((req) => {
  const { phraseId, wpm, accuracy, durationMs } = req.body
  const phrases = loadPhrases()
  const phrase = phrases.find((p) => p.id === phraseId)
  if (!phrase) {
    log.warn('typerace_score_phrase_missing', {
      userId: req.user.id, userType: req.user.type, phraseId,
    })
    throw new NotFoundError('Phrase inconnue')
  }

  if (!isScoreCoherent(phrase, wpm, durationMs)) {
    log.warn('typerace_suspicious_score', {
      userId: req.user.id, userType: req.user.type,
      wpm, durationMs, phraseId,
      phraseWords: phrase.text.trim().split(/\s+/).length,
      phraseChars: phrase.text.length,
    })
    throw new AppError('Score incoherent (anti-triche)', 400)
  }

  const score = Math.round(wpm * accuracy)
  const promoId = req.user.type === 'student'
    ? (req.user.promo_id ?? null)
    : null // teachers : promo_id null

  try {
    const { id } = queries.insertScore({
      userType: req.user.type,
      userId:   req.user.id,
      promoId,
      phraseId,
      wpm,
      accuracy,
      score,
      durationMs,
    })
    log.info('typerace_score_saved', {
      id, userId: req.user.id, userType: req.user.type, score, wpm, accuracy, durationMs,
    })
    return { id, score }
  } catch (err) {
    log.error('typerace_score_insert_failed', {
      userId: req.user.id, userType: req.user.type,
      error: err.message, code: err.code, stack: err.stack,
      phraseId, wpm, accuracy, durationMs,
    })
    throw err
  }
}))

// ── GET /leaderboard ─────────────────────────────────────────────────────────

router.get('/leaderboard', wrap((req) => {
  const scope = ['day', 'week', 'all'].includes(req.query.scope) ? req.query.scope : 'day'
  const promoIdParam = req.query.promoId
  // Par defaut : la promo courante de l'etudiant (ou teacher doit specifier).
  let promoId = null
  if (promoIdParam != null && promoIdParam !== '') {
    promoId = parseInt(promoIdParam, 10)
    if (!Number.isFinite(promoId)) throw new AppError('promoId invalide', 400)
  } else if (req.user.type === 'student') {
    promoId = req.user.promo_id ?? null
  }
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50)
  return queries.getLeaderboard({ promoId, scope, limit })
}))

// ── GET /me ──────────────────────────────────────────────────────────────────

router.get('/me', wrap((req) => {
  return queries.getUserStats(req.user.type, req.user.id)
}))

module.exports = router
