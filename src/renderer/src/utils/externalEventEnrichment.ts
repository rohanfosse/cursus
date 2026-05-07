/**
 * externalEventEnrichment — extrait des metadonnees lisibles depuis le
 * `summary` et `description` des events ICS importes (Outlook publie /
 * Google public).
 *
 * Cas d'usage : un titre comme `"Workshop 1 - Creation d'une API w/ M. Deshors"`
 * contient implicitement :
 *   - kind: workshop
 *   - kindNumber: 1
 *   - cleanTitle: "Creation d'une API"
 *   - intervenant: "M. Deshors"
 *   - kindLabel: "Workshop 1"
 *
 * On parse cote front pour eviter une migration DB et eviter de re-importer
 * tous les events. Les regex sont prudentes : si le titre ne matche aucun
 * pattern, on retombe sur le titre brut (degraded gracefully).
 *
 * Patterns pris en charge :
 *   "Workshop N[ -:] <desc>"        -> kind=workshop
 *   "WSN[ -:] <desc>"               -> kind=workshop
 *   "Prosit Aller N" / "Prosit Retour N"  -> kind=prosit + variant
 *   "PN - Autonomie"                -> kind=autonomie
 *   "Lancement du Bloc..."          -> kind=lancement
 *   "Soutenance..."                 -> kind=soutenance
 *   "TOMIC", "/!\ TOMIC /!\"        -> kind=eval
 *   "Anglais"                        -> kind=langue
 *   "Projet"                         -> kind=projet
 *   ... w/ <Nom>                    -> intervenant
 *   ... Salle X / Amphi X / Lab X   -> location (si location vide)
 */

export type ExternalEventKind =
  | 'workshop'
  | 'prosit'
  | 'autonomie'
  | 'lancement'
  | 'soutenance'
  | 'eval'
  | 'langue'
  | 'projet'
  | 'period'
  | 'ferie'
  | 'autre'

export interface EnrichedExternalEvent {
  /** Titre nettoye, sans w/ ni prefixe technique. Ce qu'on affiche en gros. */
  cleanTitle: string
  /** Categorie semantique (pour badge couleur). */
  kind: ExternalEventKind
  /** Numero de l'item si applicable (Workshop 3 -> 3, Prosit Aller 5 -> 5). */
  kindNumber: number | null
  /** Variante pour kind=prosit : "Aller" / "Retour" / etc. */
  kindVariant: string | null
  /** Label affichable du kind ("Workshop 1", "Prosit Aller 5", "Autonomie P3", ...). */
  kindLabel: string | null
  /** Nom de l'intervenant extrait du `w/ X`. */
  intervenant: string | null
  /** Salle/lieu extrait depuis le titre si le champ location ICS est vide. */
  inferredLocation: string | null
}

const EMPTY: EnrichedExternalEvent = {
  cleanTitle: '',
  kind: 'autre',
  kindNumber: null,
  kindVariant: null,
  kindLabel: null,
  intervenant: null,
  inferredLocation: null,
}

/** Strip un suffixe "w/ Xxx" du titre et retourne {rest, intervenant}. */
function extractIntervenant(title: string): { rest: string; intervenant: string | null } {
  // "w/" suivi d'un nom : tolere caps, accents, points (M. Deshors), tirets,
  // apostrophes ("L'Anglais"). On stoppe au premier separateur structurel
  // (parenthese ouvrante, virgule, dash long ou court entoure d'espaces, ou
  // fin de chaine).
  const re = /\s*\bw\/\s*([^,()]+?)(?:\s*\([^)]*\))?\s*$/i
  const m = title.match(re)
  if (!m) return { rest: title, intervenant: null }
  const intervenant = m[1].replace(/\s+/g, ' ').trim().replace(/[.,;:-]+$/, '').trim()
  if (!intervenant) return { rest: title, intervenant: null }
  return { rest: title.slice(0, m.index).trim(), intervenant }
}

/** Cherche une mention de salle/amphi/lab dans le titre et la renvoie. */
function extractLocation(title: string): string | null {
  // "Salle B12", "Salle 312", "Amphi A", "Lab 3", "Room 12"
  const re = /\b(?:Salle|Amphi(?:theatre|théâtre)?|Lab|Room)\s+([A-Z]?\d+[A-Z]?|\b[A-Z]\b)/i
  const m = title.match(re)
  if (!m) return null
  return m[0].trim()
}

/**
 * Detecte le `kind` + extrait `kindNumber` + `kindVariant` + nettoie le titre.
 * Travaille sur le `rest` apres extraction de l'intervenant.
 */
function detectKind(rest: string): {
  kind: ExternalEventKind
  kindNumber: number | null
  kindVariant: string | null
  kindLabel: string | null
  cleanTitle: string
} {
  const trimmed = rest.trim().replace(/\s*-\s*$/, '').trim()

  // Workshop : "Workshop N - desc" ou "WSN - desc" ou "WS N: desc"
  const wsMatch = trimmed.match(/^(?:Workshop|WS)\s*(\d+)\s*[-:]?\s*(.*)$/i)
  if (wsMatch) {
    const n = parseInt(wsMatch[1], 10)
    const desc = wsMatch[2].trim()
    return {
      kind: 'workshop',
      kindNumber: n,
      kindVariant: null,
      kindLabel: `Workshop ${n}`,
      cleanTitle: desc || `Workshop ${n}`,
    }
  }

  // Prosit Aller/Retour N
  const prositMatch = trimmed.match(/^Prosit\s+(\w+)\s*(\d+)\s*$/i)
  if (prositMatch) {
    const variant = prositMatch[1].charAt(0).toUpperCase() + prositMatch[1].slice(1).toLowerCase()
    const n = parseInt(prositMatch[2], 10)
    return {
      kind: 'prosit',
      kindNumber: n,
      kindVariant: variant,
      kindLabel: `Prosit ${variant} ${n}`,
      cleanTitle: `Prosit ${variant} ${n}`,
    }
  }

  // Prosit court (sans variant) : "Prosit 3"
  const prositShort = trimmed.match(/^Prosit\s+(\d+)\s*$/i)
  if (prositShort) {
    const n = parseInt(prositShort[1], 10)
    return {
      kind: 'prosit',
      kindNumber: n,
      kindVariant: null,
      kindLabel: `Prosit ${n}`,
      cleanTitle: `Prosit ${n}`,
    }
  }

  // PN - Autonomie
  const autonomieMatch = trimmed.match(/^P(\d+)\s*[-–]\s*Autonomie\s*$/i)
  if (autonomieMatch) {
    const n = parseInt(autonomieMatch[1], 10)
    return {
      kind: 'autonomie',
      kindNumber: n,
      kindVariant: null,
      kindLabel: `Autonomie P${n}`,
      cleanTitle: `Autonomie P${n}`,
    }
  }

  // Lancement
  if (/^Lancement\b/i.test(trimmed)) {
    return { kind: 'lancement', kindNumber: null, kindVariant: null, kindLabel: 'Lancement de bloc', cleanTitle: trimmed }
  }

  // Soutenance / Restitution
  if (/^(?:Soutenance|Restitution)\b/i.test(trimmed)) {
    return { kind: 'soutenance', kindNumber: null, kindVariant: null, kindLabel: 'Soutenance', cleanTitle: trimmed }
  }

  // TOMIC (eval CESI), avec variantes "Revision TOMIC", "/!\\ TOMIC /!\\"
  if (/TOMIC/i.test(trimmed)) {
    const isRevision = /Revision|Révision/i.test(trimmed)
    return {
      kind: 'eval',
      kindNumber: null,
      kindVariant: null,
      kindLabel: isRevision ? 'Revision TOMIC' : 'TOMIC',
      cleanTitle: isRevision ? 'Revision TOMIC' : 'TOMIC',
    }
  }

  // Ferie. Pas de \b ici parce que JS ne traite pas les accentues comme word
  // chars : `\b` entre `é` et ` ` ne fire pas. On match en debut de chaine
  // tout simplement.
  if (/^F(?:e|é)ri(?:e|é)/i.test(trimmed) || /^Vacances/i.test(trimmed) || /Jour férié/i.test(trimmed)) {
    return { kind: 'ferie', kindNumber: null, kindVariant: null, kindLabel: trimmed, cleanTitle: trimmed }
  }

  // Anglais / Espagnol / langues
  if (/^(?:Anglais|Espagnol|Allemand|Français|Italien)\b/i.test(trimmed)) {
    return { kind: 'langue', kindNumber: null, kindVariant: null, kindLabel: trimmed, cleanTitle: trimmed }
  }

  // Projet
  if (/^Projet\b/i.test(trimmed)) {
    return { kind: 'projet', kindNumber: null, kindVariant: null, kindLabel: 'Projet', cleanTitle: trimmed }
  }

  // Period (Entreprise / module long all-day)
  if (/^(?:Entreprise|Stage)\b/i.test(trimmed)) {
    return { kind: 'period', kindNumber: null, kindVariant: null, kindLabel: trimmed, cleanTitle: trimmed }
  }

  // Defaut
  return { kind: 'autre', kindNumber: null, kindVariant: null, kindLabel: null, cleanTitle: trimmed }
}

/** Pipeline principal. */
export function enrichExternalEvent(input: {
  summary?: string | null
  location?: string | null
  description?: string | null
}): EnrichedExternalEvent {
  const summary = (input.summary || '').trim()
  if (!summary) return EMPTY

  // 1. Extract intervenant (si "w/ X")
  const { rest, intervenant } = extractIntervenant(summary)
  // 2. Detect kind + clean title
  const detected = detectKind(rest)
  // 3. Inferred location (si location ICS vide)
  const inferredLocation = !input.location ? extractLocation(summary) : null

  return {
    cleanTitle: detected.cleanTitle || rest || summary,
    kind: detected.kind,
    kindNumber: detected.kindNumber,
    kindVariant: detected.kindVariant,
    kindLabel: detected.kindLabel,
    intervenant,
    inferredLocation,
  }
}

/** Couleur (CSS var ou hex) associee au kind, pour le badge. */
export function colorForKind(kind: ExternalEventKind): string {
  switch (kind) {
    case 'workshop':   return '#0ea5e9'   // sky
    case 'prosit':     return '#a855f7'   // purple
    case 'autonomie':  return '#10b981'   // emerald
    case 'lancement':  return '#f59e0b'   // amber
    case 'soutenance': return '#ef4444'   // red
    case 'eval':       return '#dc2626'   // red-600 (TOMIC = important)
    case 'langue':     return '#8b5cf6'   // violet
    case 'projet':     return '#06b6d4'   // cyan
    case 'period':     return '#64748b'   // slate
    case 'ferie':      return '#f97316'   // orange
    default:           return '#6b7280'   // gray
  }
}
