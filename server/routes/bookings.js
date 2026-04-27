/**
 * Routes Booking - split en sous-modules :
 *   teacherAdmin  - event-types, availability, tokens, my-bookings
 *   oauth         - Microsoft Graph OAuth
 *   publicBooking - /public/:token/(info|slots|book|book-recurring)
 *   cancellation  - /public/cancel/:token + reschedule + ics
 */
const router = require('express').Router()

router.use(require('./bookings/teacherAdmin'))
router.use(require('./bookings/oauth'))
router.use(require('./bookings/publicBooking'))
router.use(require('./bookings/cancellation'))
router.use(require('./bookings/campaigns'))
router.use(require('./bookings/campaignPublic'))

module.exports = router
