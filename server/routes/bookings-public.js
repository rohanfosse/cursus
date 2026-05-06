/**
 * Routes Booking PUBLIQUES — aucun JWT requis.
 *
 * Mountees AVANT authMiddleware dans server/index.js. Cas d'usage :
 *   - Etudiant clique le lien d'invitation envoye par mail
 *   - Externe (tuteur entreprise) ouvre le lien public d'un event-type
 *   - Annulation / reschedule via le cancel_token cote etudiant
 *
 * Securite : aucun de ces endpoints n'expose de donnees sensibles sans
 * un token opaque (booking_token, cancel_token, invite_token, slug
 * public). Chaque sous-routeur valide le token et 404 sinon — voir
 * loadInviteContext / requireBookingToken / requirePublicEventType.
 *
 * Rate limiting : double couche (IP-level + token-level) deja appliquee
 * via les rate limiters declares dans bookings/_shared.js, attaches a
 * chaque route publique. Le authMiddleware est juste shunte ici, pas
 * la couche anti-bruteforce.
 */
const router = require('express').Router()

router.use(require('./bookings/publicBooking'))
router.use(require('./bookings/cancellation'))
router.use(require('./bookings/campaignPublic'))

module.exports = router
