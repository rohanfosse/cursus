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
  // .pdf et .tex etaient ici en v2.63 ; v2.64 les a promus en chapitres
  // (cf. CHAPTER_EXTS), donc plus dans les ressources.
  '.zip', '.tar', '.gz', '.7z',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.mp4', '.mp3', '.wav',
  '.xlsx', '.docx', '.pptx',
])

// Extensions qui deviennent des chapitres (v2.64) : markdown + pdf + tex.
// L'ordre de priorite (md > pdf > tex) est applique au moment du pairing.
const CHAPTER_EXTS = new Set(['.md', '.pdf', '.tex'])

const MAX_CHAPTERS = 200
const MAX_RESOURCES = 200

/**
 * Liste recursivement l'arbre d'un repo via l'API Git Trees (un seul
 * round-trip, recursive=1). L'API accepte une branche directement comme
 * tree_sha — pas besoin de resoudre via getBranch d'abord.
 *
 * @returns {Promise<{ tree: Array<{path: string}>, truncated: boolean }>}
 *
 * Si `truncated` est true, le repo depasse les 100k entrees que GitHub renvoie
 * en une page — l'auto-manifest sera incomplet et le sync doit propager un
 * warning lisible (cf. lumenRepoSync.syncRepo).
 */
async function listRepoTree(octokit, { owner, repo, ref }) {
  const { data } = await octokit.rest.git.getTree({
    owner, repo, tree_sha: ref, recursive: '1',
  })
  const tree = (data.tree || [])
    .filter((e) => e.type === 'blob' && typeof e.path === 'string')
    .map((e) => ({ path: e.path }))
  return { tree, truncated: Boolean(data.truncated) }
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
 * "prosit-3-mvc.md" -> "prosit 3 mvc". Toutes les extensions supportees
 * sont supprimees (md, pdf, tex).
 */
function humanizeFilename(name) {
  const base = name.replace(/\.(md|pdf|tex)$/i, '')
  const noPrefix = base.replace(/^\d+[-_.]?/, '')
  const spaced = noPrefix.replace(/[-_]+/g, ' ').trim()
  if (!spaced) return base
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Retourne le path sans son extension : "guides/scrum.md" -> "guides/scrum".
 * Utilise pour le pairing md/pdf/tex sur basename commun.
 */
function stripExt(path) {
  const idx = path.lastIndexOf('.')
  const slash = path.lastIndexOf('/')
  if (idx <= slash) return path
  return path.slice(0, idx)
}

/**
 * Normalise les sections des repos de groupes etudiants (v2.66). Les
 * conventions CESI sont incoherentes entre groupes : LIVRABLES vs Livrables,
 * PROSIT vs Prosits, etc. On uniformise vers une forme canonique pour que
 * tous les groupes aient des sections affichees avec la meme casse / pluriel.
 */
const GROUP_SECTION_ALIASES = {
  livrable: 'Livrables',
  livrables: 'Livrables',
  prosit: 'Prosits',
  prosits: 'Prosits',
  rendu: 'Rendus',
  rendus: 'Rendus',
  livraisons: 'Livraisons',
  livraison: 'Livraisons',
  cours: 'Cours',
  cm: 'Cours magistraux',
  td: 'TD',
  tp: 'TP',
}

/**
 * Humanise un nom de dossier pour en faire un titre de section.
 * "guides/php" -> "Guides · PHP", "mini-projet" -> "Mini projet".
 * Les sections "standard" des repos groupes (LIVRABLES, PROSIT, ...) sont
 * normalisees vers leur forme canonique francaise.
 */
function humanizeDirPath(dirPath) {
  if (!dirPath) return 'Racine'
  return dirPath
    .split('/')
    .map((seg) => {
      const cleaned = seg.replace(/[-_]+/g, ' ').trim()
      // Alias normalisation : on cherche le segment lowercased dans la table
      const alias = GROUP_SECTION_ALIASES[cleaned.toLowerCase()]
      if (alias) return alias
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    })
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
 * @param {{ projectName?: string, truncated?: boolean }} options
 * @returns {object} manifest au format lumenManifest, avec un champ
 *   `truncated: true` si l'arbre source etait incomplet
 */
function buildManifestFromTree(tree, { projectName = 'Cours', truncated = false } = {}) {
  const files = tree
    .map((e) => e.path)
    .filter((p) => !isIgnoredPath(p))

  // v2.64 : md, pdf et tex sont tous des chapitres potentiels. On groupe par
  // basename (sans extension) pour detecter les paires (ex: scrum.md +
  // scrum.pdf, qcm-equadiff.tex + qcm-equadiff.pdf). Priorite md > pdf > tex :
  // un .md a un compagnon pdf "Telecharger PDF", un .pdf a un compagnon tex
  // "Voir le source LaTeX", et chaque format orphelin emet son propre chapitre.
  const chapterFiles = files.filter((p) => CHAPTER_EXTS.has(extOf(p)))
  const resourceFiles = files.filter((p) => RESOURCE_EXTS.has(extOf(p)))

  const groups = new Map() // basenameSansExt -> { md, pdf, tex }
  for (const path of chapterFiles) {
    const key = stripExt(path)
    const ext = extOf(path)
    if (!groups.has(key)) groups.set(key, {})
    const slot = groups.get(key)
    if (ext === '.md') slot.md = path
    else if (ext === '.pdf') slot.pdf = path
    else if (ext === '.tex') slot.tex = path
  }

  // Pour chaque groupe, on emet UN chapitre canonique selon la priorite.
  // Le format choisi devient `kind`, l'autre format compagnon est stocke
  // dans companionPdf / companionTex pour exposition cote viewer.
  const emittedChapters = []
  for (const [key, slot] of groups) {
    if (slot.md) {
      emittedChapters.push({
        primary: slot.md,
        kind: 'markdown',
        ...(slot.pdf ? { companionPdf: slot.pdf } : {}),
      })
    } else if (slot.pdf) {
      emittedChapters.push({
        primary: slot.pdf,
        kind: 'pdf',
        ...(slot.tex ? { companionTex: slot.tex } : {}),
      })
    } else if (slot.tex) {
      emittedChapters.push({
        primary: slot.tex,
        kind: 'tex',
      })
    }
  }

  // README racine -> premier chapitre "Accueil", sinon ordre par prefixe.
  const readmeRoot = emittedChapters.find(
    (c) => c.primary.toLowerCase() === 'readme.md',
  )
  const others = emittedChapters.filter((c) => c !== readmeRoot)
  others.sort((a, b) => comparePaths(a.primary, b.primary))

  const chapters = []

  if (readmeRoot) {
    chapters.push({
      title: 'Accueil',
      path: readmeRoot.primary,
      section: 'Presentation',
      kind: readmeRoot.kind,
      ...(readmeRoot.companionPdf ? { companionPdf: readmeRoot.companionPdf } : {}),
      ...(readmeRoot.companionTex ? { companionTex: readmeRoot.companionTex } : {}),
    })
  }

  for (const ch of others) {
    if (chapters.length >= MAX_CHAPTERS) break
    const dir = dirname(ch.primary)
    const name = ch.primary.split('/').pop() || ch.primary
    chapters.push({
      title: humanizeFilename(name),
      path: ch.primary,
      section: humanizeDirPath(dir) || 'Racine',
      kind: ch.kind,
      ...(ch.companionPdf ? { companionPdf: ch.companionPdf } : {}),
      ...(ch.companionTex ? { companionTex: ch.companionTex } : {}),
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
      ...(truncated ? { truncated: true } : {}),
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
    ...(truncated ? { truncated: true } : {}),
  }
}

/**
 * Point d'entree principal : fetch l'arbre puis genere le manifest.
 * Les erreurs Octokit remontent telles quelles (gerees par handleOctokit
 * dans la route).
 */
async function generateAutoManifest(octokit, { owner, repo, ref, projectName }) {
  const { tree, truncated } = await listRepoTree(octokit, { owner, repo, ref })
  return buildManifestFromTree(tree, { projectName: projectName || repo, truncated })
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
