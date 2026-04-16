/**
 * msToken.js — Shared helper to decrypt + refresh Microsoft Graph access tokens.
 * Used by bookings and calendar routes.
 */
const queries = require('../db/index')
const graph   = require('../services/microsoftGraph')
const { encrypt, decrypt } = require('./crypto')
const log = require('./logger')

/**
 * Returns a valid decrypted access token for the given teacher,
 * refreshing it via MSAL if expired. Returns null if not connected or refresh fails.
 */
async function getValidMsToken(teacherId) {
  const msToken = queries.getMicrosoftToken(teacherId)
  if (!msToken) return null

  const accessToken = decrypt(msToken.access_token_enc)
  // Check expiry
  if (msToken.expires_at && new Date(msToken.expires_at).getTime() < Date.now()) {
    try {
      const account = JSON.parse(decrypt(msToken.refresh_token_enc))
      const newAccessToken = await graph.acquireTokenSilent(account)
      queries.saveMicrosoftToken(teacherId, {
        accessTokenEnc: encrypt(newAccessToken),
        refreshTokenEnc: msToken.refresh_token_enc,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      })
      return newAccessToken
    } catch (err) {
      log.warn('Token refresh failed', { error: err.message, teacherId })
      return null
    }
  }
  return accessToken
}

module.exports = { getValidMsToken }
