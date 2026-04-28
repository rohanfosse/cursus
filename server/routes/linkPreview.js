/**
 * Routes Link Preview (unfurl).
 *
 * - POST /api/link-preview/resolve  { urls: [...] } -> Array<Preview>
 * - GET  /api/link-preview/image?url=...            -> proxy image (evite la
 *   fuite d'IP user lors du chargement des images OG ; verifie SSRF)
 */
const router    = require('express').Router()
const { z }     = require('zod')
const https     = require('https')
const http      = require('http')
const { URL }   = require('url')
const rateLimit = require('express-rate-limit')
const { validate } = require('../middleware/validate')
const wrap      = require('../utils/wrap')
const { resolveUrls, normalizeUrl, assertPublicHost } = require('../services/unfurl')

// Rate limit : 60 requetes/min par user. Les images sont chargees via le
// proxy donc une page avec 5 liens = 5 + 5 = 10 hits.
//
// keyGenerator : `req.user.id` quand auth (cas standard, /api/link-preview
// est derriere authMiddleware), 'anon' en fallback. On evite `req.ip`
// directement car express-rate-limit v8+ throw ERR_ERL_KEY_GEN_IPV6 quand
// un keyGenerator custom utilise req.ip sans le helper ipKeyGenerator —
// merge avec ce que font les autres limiters du projet (cf. auth.js,
// messages.js, scheduled.js qui utilisent tous le pattern `?? 'anon'`).
const limiter = rateLimit({
  windowMs: 60_000, max: 60,
  keyGenerator: (req) => `unfurl:${req.user?.id ?? 'anon'}`,
  standardHeaders: true, legacyHeaders: false,
  message: { ok: false, error: 'Trop de previews demandees. Reessayez dans une minute.' },
  validate: { xForwardedForHeader: false },
})

const resolveSchema = z.object({
  urls: z.array(z.string().url().max(2048)).max(10),
})

router.post('/resolve', limiter, validate(resolveSchema), wrap(async (req) => {
  return resolveUrls(req.body.urls)
}))

/**
 * GET /api/link-preview/image?url=...
 * Proxy les images OG pour :
 *  1. Eviter la fuite d'IP de l'utilisateur (toutes les requetes passent
 *     par notre serveur, pas par le navigateur client).
 *  2. Appliquer les memes SSRF guards.
 *  3. Strip headers sensibles (Cookie, Authorization du client n'arrivent
 *     jamais a la cible).
 */
router.get('/image', limiter, async (req, res) => {
  const target = normalizeUrl(req.query.url)
  if (!target) return res.status(400).json({ ok: false, error: 'URL invalide' })
  let url
  try { url = new URL(target) } catch { return res.status(400).json({ ok: false, error: 'URL invalide' }) }

  try {
    await assertPublicHost(url.hostname)
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message })
  }

  const client = url.protocol === 'https:' ? https : http
  const upstream = client.request({
    method: 'GET',
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    timeout: 5000,
    headers: { 'User-Agent': 'CursusBot/1.0', 'Accept': 'image/*' },
  }, (r) => {
    const ct = String(r.headers['content-type'] ?? '')
    if (!ct.startsWith('image/')) {
      r.resume()
      return res.status(400).json({ ok: false, error: `Content-Type non-image : ${ct}` })
    }
    const cl = Number(r.headers['content-length'] ?? 0)
    if (cl && cl > 8 * 1024 * 1024) {
      r.resume()
      return res.status(400).json({ ok: false, error: 'Image trop volumineuse' })
    }
    res.setHeader('Content-Type', ct)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    if (r.headers['content-length']) res.setHeader('Content-Length', r.headers['content-length'])
    let total = 0
    r.on('data', (chunk) => {
      total += chunk.length
      if (total > 8 * 1024 * 1024) { r.destroy(); res.end(); return }
    })
    r.pipe(res)
  })

  upstream.on('timeout', () => {
    upstream.destroy()
    if (!res.headersSent) res.status(504).json({ ok: false, error: 'Timeout' })
  })
  upstream.on('error', (err) => {
    if (!res.headersSent) res.status(502).json({ ok: false, error: err.message })
  })
  upstream.end()
})

module.exports = router
