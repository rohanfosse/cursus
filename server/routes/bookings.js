/**
 * Routes Booking — UNIQUEMENT les sous-routes qui requierent l'auth JWT.
 *
 * Les sous-routes publiques (publicBooking, cancellation, campaignPublic)
 * sont montees a part dans server/index.js, AVANT le authMiddleware.
 * Sinon les liens d'invitation envoyes par mail (sans token JWT) sont
 * rejetes en 401 par authMiddleware avant d'atteindre la route — bug
 * remonte par le pilote 2026-05-06 : "Lien invalide / Non authentifié"
 * sur https://app.cursus.school/#/book/c/TOKEN.
 *
 *   teacherAdmin  - event-types, availability, tokens, my-bookings, /direct
 *   oauth         - Microsoft Graph OAuth
 *   campaigns     - admin enseignant des campagnes (CRUD + launch/remind)
 */
const router = require('express').Router()

router.use(require('./bookings/teacherAdmin'))
router.use(require('./bookings/oauth'))
router.use(require('./bookings/campaigns'))

module.exports = router
