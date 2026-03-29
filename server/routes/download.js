// ─── Route téléchargement - proxy vers GitHub Releases ────────────────────────
const { Router } = require('express')
const router = Router()

const REPO     = 'rohanfosse/cursus'
const CACHE_TTL = 60 * 60 * 1000 // 1h

let releaseCache = null
let cacheTime    = 0

async function getLatestRelease() {
  if (releaseCache && Date.now() - cacheTime < CACHE_TTL) return releaseCache
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { 'User-Agent': 'Cursus-Server', Accept: 'application/vnd.github+json' }
  })
  if (!res.ok) throw new Error(`GitHub API ${res.status}`)
  releaseCache = await res.json()
  cacheTime    = Date.now()
  return releaseCache
}

const EXT_MAP = { windows: '.exe', mac: '.dmg' }

router.get('/:platform', async (req, res) => {
  const ext = EXT_MAP[req.params.platform]
  if (!ext) return res.status(404).json({ error: 'Plateforme inconnue. Utiliser: windows, mac' })

  try {
    const release = await getLatestRelease()
    const asset   = release.assets?.find(a => a.name.endsWith(ext) && !a.name.includes('blockmap'))
    if (!asset) return res.status(404).json({ error: `Aucun asset ${ext} trouvé dans la dernière release` })
    res.redirect(302, asset.browser_download_url)
  } catch (err) {
    console.error('[download]', err.message)
    res.status(502).json({ error: 'Impossible de récupérer la release depuis GitHub' })
  }
})

// ─── Version actuelle (pour l'affichage landing) ──────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const release = await getLatestRelease()
    res.json({
      version:      release.tag_name,
      published_at: release.published_at,
      name:         release.name,
    })
  } catch {
    res.status(502).json({ error: 'Impossible de récupérer les informations de release' })
  }
})

module.exports = router
