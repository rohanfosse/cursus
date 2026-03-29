// ─── IPC : Onboarding wizard ─────────────────────────────────────────────────
const { handle } = require('./helpers')
const queries = require('../../../server/db/index')

function register() {
  handle('get-onboarding-status', (({ studentId }) => queries.getOnboardingStatus(studentId)))
  handle('complete-onboarding', (({ studentId }) => queries.completeOnboarding(studentId)))
}

module.exports = { register }
