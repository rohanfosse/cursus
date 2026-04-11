/**
 * Detection legere de la frontmatter YAML d'un chapitre Lumen.
 *
 * On ne parse PAS la totalite du YAML (couteux et inutile en hot path) :
 * on extrait juste le bloc `---\n...\n---` du tout debut du contenu et
 * on le donne a js-yaml. Si la frontmatter est absente ou cassee on
 * renvoie un objet vide — jamais d'exception remontee a l'UI.
 *
 * Usage principal : detecter `marp: true` pour brancher le rendu sur
 * LumenSlideDeck plutot que sur le rendu Markdown standard.
 */
import yaml from 'js-yaml'

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

export interface LumenFrontmatter {
  marp?: boolean
  theme?: string
  paginate?: boolean
  title?: string
  [key: string]: unknown
}

export interface ParsedChapterContent {
  /** Frontmatter parsee (objet vide si absente ou invalide) */
  frontmatter: LumenFrontmatter
  /** Contenu markdown sans la frontmatter (ou contenu original si absente) */
  body: string
  /** True si la frontmatter contient `marp: true` */
  isMarp: boolean
}

export function parseChapterContent(content: string | null | undefined): ParsedChapterContent {
  if (!content) {
    return { frontmatter: {}, body: '', isMarp: false }
  }
  const match = content.match(FRONTMATTER_RE)
  if (!match) {
    return { frontmatter: {}, body: content, isMarp: false }
  }
  let parsed: LumenFrontmatter = {}
  try {
    const raw = yaml.load(match[1])
    if (raw && typeof raw === 'object') {
      parsed = raw as LumenFrontmatter
    }
  } catch {
    // Frontmatter invalide : on garde le contenu tel quel, frontmatter vide.
    return { frontmatter: {}, body: content, isMarp: false }
  }
  return {
    frontmatter: parsed,
    body: content.slice(match[0].length),
    isMarp: parsed.marp === true,
  }
}
