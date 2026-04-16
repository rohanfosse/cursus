/**
 * Parseur CSV universel pour les activites Live (Spark + Pulse).
 *
 * Format 1 (Kahoot compat, 7 colonnes) :
 *   Question;Reponse1;Reponse2;Reponse3;Reponse4;Temps;Bonne reponse
 *   → QCM uniquement
 *
 * Format 2 (Wooclap-like universel, 3-4 colonnes typees) :
 *   Type;Question;Options;Extra
 *   ou :
 *     Type       : qcm|sondage|nuage|echelle|question_ouverte|sondage_libre|humeur|priorite|matrice|vrai_faux
 *     Question   : texte (obligatoire)
 *     Options    : liste pipe-separated "Opt1|Opt2|Opt3" (QCM/sondage/priorite/matrice)
 *     Extra      : depend du type
 *                  - qcm           : index 1-based de la bonne reponse (ex "1" ou "1,3")
 *                  - echelle/matrice : max rating (5 ou 10)
 *                  - nuage         : max_words (1-3)
 *                  - autres        : ignore
 *
 * Les deux formats sont detectes automatiquement d'apres la premiere ligne :
 *  - Si la colonne 1 contient un type Pulse/Spark connu → Format 2
 *  - Sinon → Format 1 (Kahoot)
 *
 * Separateur : ; ou , (auto-detection).
 */

export type CsvActivityType =
  | 'qcm' | 'vrai_faux'
  | 'sondage' | 'sondage_libre' | 'nuage' | 'echelle'
  | 'question_ouverte' | 'humeur' | 'priorite' | 'matrice'

export interface CsvActivity {
  type: CsvActivityType
  title: string
  options?: string[]
  correctIndices?: number[]
  timerSeconds: number
  maxRating?: number
  maxWords?: number
}

export interface CsvParseResult {
  activities: CsvActivity[]
  errors: { line: number; message: string }[]
  format: 'kahoot' | 'universal'
  separator: ';' | ','
}

const ALLOWED_TIMERS = [10, 15, 20, 30, 45, 60, 90, 120]

// Aliases FR/EN -> type interne
const TYPE_ALIASES: Record<string, CsvActivityType> = {
  // QCM / Spark
  qcm: 'qcm', 'choix multiple': 'qcm', 'choix-multiple': 'qcm', multiple: 'qcm',
  'vrai_faux': 'vrai_faux', 'vrai/faux': 'vrai_faux', 'true_false': 'vrai_faux', 'true/false': 'vrai_faux',
  // Pulse
  sondage: 'sondage', poll: 'sondage',
  'sondage_libre': 'sondage_libre', 'poll_open': 'sondage_libre', ouvert: 'sondage_libre',
  nuage: 'nuage', wordcloud: 'nuage', 'word_cloud': 'nuage', 'nuage_de_mots': 'nuage', 'nuage de mots': 'nuage',
  echelle: 'echelle', scale: 'echelle', 'echelle_lineaire': 'echelle',
  'question_ouverte': 'question_ouverte', 'question ouverte': 'question_ouverte', ouverte: 'question_ouverte', open: 'question_ouverte',
  humeur: 'humeur', mood: 'humeur', emoji: 'humeur',
  priorite: 'priorite', priority: 'priorite', ranking: 'priorite', classement: 'priorite',
  matrice: 'matrice', matrix: 'matrice',
}

function normalize(s: string): string {
  return s.trim().toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
}

function detectSeparator(text: string): ';' | ',' {
  const firstLine = text.split(/\r?\n/)[0] ?? ''
  return (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === sep && !inQuotes) {
      out.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map(s => s.trim())
}

function snapTimer(raw: string | undefined): number {
  const n = Number(String(raw ?? '').replace(/[^\d.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return 30
  let best = ALLOWED_TIMERS[0]
  let bestDiff = Math.abs(n - best)
  for (const t of ALLOWED_TIMERS) {
    const d = Math.abs(n - t)
    if (d < bestDiff) { best = t; bestDiff = d }
  }
  return best
}

function parseCorrect(raw: string, answersCount: number): number[] | null {
  const parts = raw.split(/[,|]/).map(p => p.trim()).filter(Boolean)
  if (!parts.length) return null
  const indices: number[] = []
  for (const p of parts) {
    const n = Number(p)
    if (!Number.isInteger(n) || n < 1 || n > answersCount) return null
    indices.push(n - 1)
  }
  return Array.from(new Set(indices))
}

function parseOptionsPipe(raw: string): string[] {
  return raw.split('|').map(o => o.trim()).filter(Boolean).slice(0, 8)
}

function detectFormat(firstDataLine: string[]): 'kahoot' | 'universal' {
  if (!firstDataLine.length) return 'kahoot'
  const typeKey = normalize(firstDataLine[0] ?? '')
  return typeKey in TYPE_ALIASES ? 'universal' : 'kahoot'
}

function isHeaderLine(cells: string[]): boolean {
  const first = normalize(cells[0] ?? '')
  return first === 'question' || first === 'questions' || first === 'type'
}

function parseKahootRow(
  cells: string[],
  lineNo: number,
  errors: { line: number; message: string }[],
): CsvActivity | null {
  if (cells.length < 3) {
    errors.push({ line: lineNo, message: 'Ligne trop courte (attend question + reponses).' })
    return null
  }
  const question = cells[0].trim()
  if (!question) { errors.push({ line: lineNo, message: 'Question vide.' }); return null }

  const tail1 = cells[cells.length - 1] ?? ''
  const tail2 = cells[cells.length - 2] ?? ''
  const looksLikeCorrect = /^\s*\d+(\s*[,|]\s*\d+)*\s*$/.test(tail1)
  const looksLikeTimer = /^\s*\d+\s*s?\s*$/.test(tail2)
  const hasMeta = cells.length >= 4 && looksLikeTimer && looksLikeCorrect

  const rawAnswers = hasMeta ? cells.slice(1, cells.length - 2) : cells.slice(1)
  const answers = rawAnswers.map(a => a.trim()).filter(Boolean).slice(0, 4)
  if (answers.length < 2) {
    errors.push({ line: lineNo, message: 'Au moins deux reponses non vides sont requises.' })
    return null
  }

  const timerSeconds = snapTimer(hasMeta ? tail2 : '30')
  const correctIndices = parseCorrect(hasMeta ? tail1 : '1', answers.length)
  if (!correctIndices) {
    errors.push({ line: lineNo, message: `Bonne reponse invalide (attend un index 1-${answers.length}).` })
    return null
  }

  return {
    type: 'qcm',
    title: question.slice(0, 200),
    options: answers.map(a => a.slice(0, 100)),
    correctIndices,
    timerSeconds,
  }
}

function parseUniversalRow(
  cells: string[],
  lineNo: number,
  errors: { line: number; message: string }[],
): CsvActivity | null {
  if (cells.length < 2) {
    errors.push({ line: lineNo, message: 'Ligne trop courte (attend type + question).' })
    return null
  }
  const typeKey = normalize(cells[0] ?? '')
  const type = TYPE_ALIASES[typeKey]
  if (!type) {
    errors.push({ line: lineNo, message: `Type "${cells[0]}" inconnu.` })
    return null
  }
  const title = (cells[1] ?? '').trim()
  if (!title) { errors.push({ line: lineNo, message: 'Question vide.' }); return null }

  const rawOptions = (cells[2] ?? '').trim()
  const rawExtra   = (cells[3] ?? '').trim()
  const rawTimer   = (cells[4] ?? '').trim()

  const activity: CsvActivity = {
    type,
    title: title.slice(0, 200),
    timerSeconds: snapTimer(rawTimer || '30'),
  }

  switch (type) {
    case 'qcm':
    case 'sondage':
    case 'priorite': {
      const opts = parseOptionsPipe(rawOptions)
      if (opts.length < 2) {
        errors.push({ line: lineNo, message: `${type} : au moins deux options sont requises (separer par |).` })
        return null
      }
      activity.options = opts.map(o => o.slice(0, 100))
      if (type === 'qcm') {
        const correct = parseCorrect(rawExtra || '1', opts.length)
        if (!correct) {
          errors.push({ line: lineNo, message: `Bonne reponse invalide (attend un index 1-${opts.length}).` })
          return null
        }
        activity.correctIndices = correct
      }
      break
    }
    case 'matrice': {
      const opts = parseOptionsPipe(rawOptions)
      if (opts.length < 2) {
        errors.push({ line: lineNo, message: 'matrice : au moins deux criteres (separer par |).' })
        return null
      }
      activity.options = opts.map(o => o.slice(0, 100))
      const r = Number(rawExtra)
      activity.maxRating = Number.isInteger(r) && (r === 5 || r === 10) ? r : 5
      break
    }
    case 'echelle': {
      const r = Number(rawExtra || rawOptions)
      activity.maxRating = Number.isInteger(r) && (r === 5 || r === 10) ? r : 5
      break
    }
    case 'nuage': {
      const w = Number(rawExtra || rawOptions)
      activity.maxWords = Number.isInteger(w) && w >= 1 && w <= 3 ? w : 2
      break
    }
    case 'vrai_faux': {
      // rawExtra = "1" (vrai) ou "2" (faux), 1-based
      const correct = parseCorrect(rawExtra || '1', 2)
      if (!correct) {
        errors.push({ line: lineNo, message: 'vrai_faux : indiquer 1 (vrai) ou 2 (faux) en colonne Extra.' })
        return null
      }
      activity.correctIndices = correct
      break
    }
    case 'sondage_libre':
    case 'question_ouverte':
    case 'humeur':
      // Pas de validation supplementaire.
      break
  }

  return activity
}

export function parseLiveCsv(text: string): CsvParseResult {
  const errors: { line: number; message: string }[] = []
  const activities: CsvActivity[] = []
  const separator = detectSeparator(text)

  const lines = text.split(/\r?\n/)
    .map((l, i) => ({ raw: l, lineNo: i + 1 }))
    .filter(({ raw }) => raw.trim().length > 0)

  if (!lines.length) {
    errors.push({ line: 0, message: 'Fichier vide.' })
    return { activities, errors, format: 'kahoot', separator }
  }

  let startIdx = 0
  const firstCells = splitCsvLine(lines[0].raw, separator)
  if (isHeaderLine(firstCells)) startIdx = 1

  // Determine format en regardant la premiere ligne de donnees
  const firstDataCells = startIdx < lines.length
    ? splitCsvLine(lines[startIdx].raw, separator)
    : []
  const format = detectFormat(firstDataCells)

  for (let i = startIdx; i < lines.length; i++) {
    const { raw, lineNo } = lines[i]
    const cells = splitCsvLine(raw, separator)
    const activity = format === 'universal'
      ? parseUniversalRow(cells, lineNo, errors)
      : parseKahootRow(cells, lineNo, errors)
    if (activity) activities.push(activity)
  }

  return { activities, errors, format, separator }
}

/** Convertit une CsvActivity en payload pour liveStore.pushActivity(). */
export function csvActivityToPayload(a: CsvActivity): {
  type: CsvActivityType
  title: string
  options?: string[] | string
  correct_answers?: number[] | string[]
  timer_seconds: number
  max_rating?: number
  max_words?: number
} {
  const payload: ReturnType<typeof csvActivityToPayload> = {
    type: a.type,
    title: a.title,
    timer_seconds: a.timerSeconds,
  }
  if (a.options && a.options.length) {
    // Spark (qcm/vrai_faux) : string[] ; Pulse (sondage/priorite/matrice) : JSON string
    if (a.type === 'qcm' || a.type === 'vrai_faux') {
      payload.options = a.options
    } else {
      payload.options = JSON.stringify(a.options)
    }
  }
  if (a.correctIndices !== undefined) payload.correct_answers = a.correctIndices
  if (a.maxRating !== undefined) payload.max_rating = a.maxRating
  if (a.maxWords !== undefined) payload.max_words = a.maxWords
  if (a.type === 'vrai_faux') payload.options = ['Vrai', 'Faux']
  if (a.type === 'humeur')    payload.options = JSON.stringify(['\u{1F60A}', '\u{1F642}', '\u{1F610}', '\u{1F61F}', '\u{1F92F}'])
  return payload
}
