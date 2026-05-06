/**
 * Routes generiques pour les mini-jeux arcade (Snake, Space Invaders, Pacman...).
 * TypeRace a son propre endpoint dedie (/api/typerace) car son schema
 * inclut des metriques specifiques (wpm, accuracy, phrase_id).
 *
 * POST /api/games/:gameId/scores        — enregistre une partie
 * GET  /api/games/:gameId/leaderboard   — top 10 du scope (day/week/all)
 * GET  /api/games/:gameId/me            — stats perso + historique 30j
 *
 * Anti-triche : un score aberrant (trop eleve sur une trop courte duree)
 * est rejete par jeu via les bornes `MAX_SCORE_PER_SECOND` de chaque jeu
 * (empiriques, on assume bonne foi pour les cas limites).
 */
const router  = require('express').Router()
const { z }   = require('zod')
const queries = require('../db/index')
const log     = require('../utils/logger')
const wrap    = require('../utils/wrap')
const { validate } = require('../middleware/validate')
const { AppError } = require('../utils/errors')

// Limite score/sec par jeu pour filtrer les POST bot-like. Empirique :
// faut rester large car les joueurs pro peuvent enchainer tres vite.
const MAX_SCORE_PER_SECOND = {
  snake:          15,    // ~10 pts/sec en pointe humain (food + speed bonus)
  space_invaders: 60,    // aliens en rafale + multiplicateurs de wave
  tetris:         300,   // tetris back-to-back = 1200 pts en ~5 sec, soit 240 pts/s ; on garde de la marge
}

const KNOWN_GAMES = new Set(Object.keys(MAX_SCORE_PER_SECOND))

function assertKnownGame(gameId) {
  if (!KNOWN_GAMES.has(gameId)) {
    throw new AppError(`Jeu inconnu : ${gameId}`, 404)
  }
}

function isScoreCoherent(gameId, score, durationMs) {
  if (durationMs <= 0) return false
  const maxPerSec = MAX_SCORE_PER_SECOND[gameId] ?? 50
  const maxPossible = (durationMs / 1000) * maxPerSec
  return score <= Math.max(maxPossible, 50)
}

// ── POST /:gameId/scores ────────────────────────────────────────────────────

const scoreSchema = z.object({
  score:      z.number().int().min(0).max(1_000_000),
  durationMs: z.number().int().min(500).max(30 * 60 * 1000),
  meta:       z.record(z.string(), z.unknown()).optional(),
}).strict()

router.post('/:gameId/scores', validate(scoreSchema), wrap((req) => {
  const gameId = req.params.gameId
  assertKnownGame(gameId)
  const { score, durationMs, meta } = req.body

  if (!isScoreCoherent(gameId, score, durationMs)) {
    log.warn('game_suspicious_score', {
      gameId, userId: req.user.id, userType: req.user.type, score, durationMs,
    })
    throw new AppError('Score incoherent (anti-triche)', 400)
  }

  const promoId = req.user.type === 'student' ? (req.user.promo_id ?? null) : null
  try {
    const { id } = queries.insertGameScore({
      gameId,
      userType: req.user.type,
      userId:   req.user.id,
      promoId,
      score,
      durationMs,
      meta,
    })
    log.info('game_score_saved', {
      id, gameId, userId: req.user.id, userType: req.user.type, score, durationMs,
    })
    return { id, score }
  } catch (err) {
    log.error('game_score_insert_failed', {
      gameId, userId: req.user.id, userType: req.user.type,
      error: err.message, code: err.code, stack: err.stack,
      score, durationMs,
    })
    throw err
  }
}))

// ── GET /:gameId/leaderboard ───────────────────────────────────────────────

router.get('/:gameId/leaderboard', wrap((req) => {
  const gameId = req.params.gameId
  assertKnownGame(gameId)
  const scope = ['day', 'week', 'all'].includes(req.query.scope) ? req.query.scope : 'day'
  const promoIdParam = req.query.promoId
  let promoId = null
  if (promoIdParam != null && promoIdParam !== '') {
    promoId = parseInt(promoIdParam, 10)
    if (!Number.isFinite(promoId)) throw new AppError('promoId invalide', 400)
  } else if (req.user.type === 'student') {
    promoId = req.user.promo_id ?? null
  }
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50)
  return queries.getGameLeaderboard({ gameId, promoId, scope, limit })
}))

// ── GET /:gameId/me ────────────────────────────────────────────────────────

router.get('/:gameId/me', wrap((req) => {
  const gameId = req.params.gameId
  assertKnownGame(gameId)
  return queries.getGameUserStats(gameId, req.user.type, req.user.id)
}))

module.exports = router
