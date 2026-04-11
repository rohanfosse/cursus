/**
 * Auto-manifest Lumen : genere un manifest synthetique a partir de l'arbre
 * d'un repo GitHub, quand aucun `cursus.yaml` n'est present a la racine.
 *
 * Convention (pas de configuration) :
 *   - `README.md` racine -> premier chapitre "Accueil"
 *   - Top-level directories -> sections (ex: prosits/, workshops/, guides/)
 *   - Sous-dossiers -> prefixes dans le titre de section ("Guides · PHP")
 *   - Fichiers .md -> chapitres, ordonnes par prefixe numerique (01-, 1-, 2-)
 *     puis alphabetique
 *   - Titre derive du nom de fichier (sans prefixe numerique, ponctuation
 *     normalisee) — on n'ouvre PAS chaque fichier pour lire son H1, trop
 *     couteux (1 round-trip par chapitre).
 *   - Fichiers non-.md (pdf, zip, images) -> `resources`
 *   - Dossiers caches (.github, .vscode), node_modules, vendor, dist,
 *     build -> ignores
 *
 * Le prof qui veut du controle fin ajoute un cursus.yaml a la racine, qui
 * prend systematiquement le pas sur l'auto-manifest.
 */

const IGNORED_DIRS = new Set([
  '.github', '.vscode', '.idea', '.git',
  'node_modules', 'vendor', 'dist', 'build', 'out', 'target',
  '__pycache__', '.venv', 'venv',
])

const RESOURCE_EXTS = new Set([
  '.pdf', '.zip', '.tar', '.gz', '.7z',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.mp4', '.mp3', '.wav',
  '.xlsx', '.docx', '.pptx',
])

const MAX_CHAPTERS = 200
const MAX_RESOURCES = 200

/**
 * Liste recursivement l'arbre d'un repo via l'API Git Trees (un seul
 * round-trip, recursive=1). L'API accepte une branche directement comme
 * tree_sha — pas besoin de resoudre via getBranch d'abord.
 * @returns {Promise<Array<{path: string}>>}
 */
async function listRepoTree(octokit, { owner, repo, ref }) {
  const { data } = await octokit.rest.git.getTree({
    owner, repo, tree_sha: ref, recursive: '1',
  })
  // Note : si data.truncated est true, le repo depasse 100k entrees —
  // on laisse passer la partie disponible, c'est tres suffisant pour un
  // cours normal.
  return (data.tree || [])
    .filter((e) => e.type === 'blob' && typeof e.path === 'string')
    .map((e) => ({ path: e.path }))
}

/**
 * Determine si un chemin doit etre ignore (dossier cache, build, etc.).
 */
function isIgnoredPath(path) {
  const parts = path.split('/')
  return parts.some((p) => IGNORED_DIRS.has(p))
}

/**
 * Extrait l'extension en minuscules (avec le point). Renvoie '' si absent.
 */
function extOf(path) {
  const idx = path.lastIndexOf('.')
  const slash = path.lastIndexOf('/')
  if (idx <= slash) return ''
  return path.slice(idx).toLowerCase()
}

/**
 * Supprime le prefixe numerique d'un nom de fichier pour obtenir un titre
 * humain : "01-intro.md" -> "intro", "1-apache.md" -> "apache",
 * "prosit-3-mvc.md" -> "prosit 3 mvc".
 */
function humanizeFilename(name) {
  const base = name.replace(/\.md$/i, '')
  const noPrefix = base.replace(/^\d+[-_.]?/, '')
  const spaced = noPrefix.replace(/[-_]+/g, ' ').trim()
  if (!spaced) return base
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Humanise un nom de dossier pour en faire un titre de section.
 * "guides/php" -> "Guides · PHP", "mini-projet" -> "Mini projet".
 */
function humanizeDirPath(dirPath) {
  if (!dirPath) return 'Racine'
  return dirPath
    .split('/')
    .map((seg) => seg.replace(/[-_]+/g, ' ').trim())
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join(' · ')
}

/**
 * Cle de tri naturelle : prefixe numerique si present, sinon 9999. Tie-break
 * alphabetique. Permet d'ordonner "01-intro", "02-variables", "10-avance"
 * correctement sans tri lexical.
 */
function sortKey(path) {
  const name = path.split('/').pop() || ''
  const m = name.match(/^(\d+)[-_.]/)
  const num = m ? Number(m[1]) : 9999
  return { num, name: name.toLowerCase() }
}

function comparePaths(a, b) {
  const ka = sortKey(a)
  const kb = sortKey(b)
  if (ka.num !== kb.num) return ka.num - kb.num
  return ka.name.localeCompare(kb.name)
}

/**
 * Retourne le dossier contenant un fichier, ou '' pour la racine.
 */
function dirname(path) {
  const idx = path.lastIndexOf('/')
  return idx === -1 ? '' : path.slice(0, idx)
}

/**
 * Genere un manifest a partir d'un arbre de fichiers. Exposee separement
 * de listRepoTree pour les tests unitaires (pas besoin d'Octokit mocke).
 * @param {Array<{path: string}>} tree
 * @param {{ projectName?: string }} options
 * @returns {object} manifest au format lumenManifest
 */
function buildManifestFromTree(tree, { projectName = 'Cours' } = {}) {
  const files = tree
    .map((e) => e.path)
    .filter((p) => !isIgnoredPath(p))

  const mdFiles = files.filter((p) => p.toLowerCase().endsWith('.md'))
  const resourceFiles = files.filter((p) => RESOURCE_EXTS.has(extOf(p)))

  // README racine -> premier chapitre "Accueil", sinon on prend le premier
  // README.md rencontre en profondeur.
  const readmeRoot = mdFiles.find((p) => p.toLowerCase() === 'readme.md')
  const otherMd = mdFiles.filter((p) => p !== readmeRoot)
  otherMd.sort(comparePaths)

  const chapters = []

  if (readmeRoot) {
    chapters.push({
      title: 'Accueil',
      path: readmeRoot,
      section: 'Presentation',
    })
  }

  for (const path of otherMd) {
    if (chapters.length >= MAX_CHAPTERS) break
    const dir = dirname(path)
    const name = path.split('/').pop() || path
    chapters.push({
      title: humanizeFilename(name),
      path,
      section: humanizeDirPath(dir) || 'Racine',
    })
  }

  // Pas un seul .md : on cree un chapitre placeholder pour que le repo
  // s'affiche quand meme. Sinon le sync echoue sur le `min(1)` du schema
  // chapters.
  if (chapters.length === 0) {
    return {
      project: projectName,
      summary: 'Repo sans contenu Markdown detecte automatiquement.',
      chapters: [{
        title: 'Aucun chapitre',
        path: 'README.md',
        section: 'Racine',
      }],
      autoGenerated: true,
    }
  }

  const resources = []
  for (const path of resourceFiles) {
    if (resources.length >= MAX_RESOURCES) break
    const name = path.split('/').pop() || path
    resources.push({
      path,
      kind: extOf(path).slice(1),
      title: humanizeFilename(name.replace(/\.[^.]+$/, '')),
    })
  }

  return {
    project: projectName,
    summary: 'Manifest genere automatiquement depuis l\'arborescence du repo.',
    chapters,
    resources: resources.length ? resources : undefined,
    autoGenerated: true,
  }
}

/**
 * Point d'entree principal : fetch l'arbre puis genere le manifest.
 * Les erreurs Octokit remontent telles quelles (gerees par handleOctokit
 * dans la route).
 */
async function generateAutoManifest(octokit, { owner, repo, ref, projectName }) {
  const tree = await listRepoTree(octokit, { owner, repo, ref })
  return buildManifestFromTree(tree, { projectName: projectName || repo })
}

module.exports = {
  generateAutoManifest,
  buildManifestFromTree,
  listRepoTree,
  // exportes pour tests
  humanizeFilename,
  humanizeDirPath,
  comparePaths,
}
