// Shared utilities for Live activities (Spark + Pulse + Code + Board)
import {
  ListChecks, ToggleLeft, Type, Link2, Hash, Cloud, MessageSquare, Zap,
  Star, FileText, BarChart, Smile, ArrowUpDown, Grid3X3, Code2, StickyNote,
  Sparkles, Activity, MessagesSquare, TextCursorInput,
} from 'lucide-vue-next'
import type { Component } from 'vue'

export type ActivityCategory = 'spark' | 'pulse' | 'code' | 'board'

export const ACTIVITY_CATEGORIES: Record<ActivityCategory, { label: string; description: string; types: string[]; color: string; icon: Component }> = {
  spark: {
    label: 'Spark',
    description: 'Quiz gamifie (scoring, leaderboard)',
    types: ['qcm', 'vrai_faux', 'reponse_courte', 'association', 'estimation', 'texte_a_trous', 'tri'],
    color: '#f59e0b',
    icon: Sparkles,
  },
  pulse: {
    label: 'Pulse',
    description: 'Feedback anonyme (pas de scoring)',
    types: ['sondage_libre', 'nuage', 'echelle', 'question_ouverte', 'sondage', 'humeur', 'priorite', 'matrice'],
    color: '#10b981',
    icon: Activity,
  },
  code: {
    label: 'Code',
    description: 'Live coding prof broadcast',
    types: ['live_code'],
    color: '#3b82f6',
    icon: Code2,
  },
  board: {
    label: 'Board',
    description: 'Brainstorming post-its + votes',
    types: ['board', 'message_wall'],
    color: '#a855f7',
    icon: StickyNote,
  },
}

/** Emojis d'humeur — utilise dans ActivityForm, LivePulseInput, LiveTestPreview */
export const HUMEUR_EMOJIS = ['\u{1F60A}', '\u{1F642}', '\u{1F610}', '\u{1F61F}', '\u{1F92F}'] as const

/** Parse un champ JSON serialise (options, correct_answers) en tableau. */
export function parseJsonArray<T>(raw: string | T[] | null | undefined, fallback: T[] = []): T[] {
  if (!raw) return fallback
  if (Array.isArray(raw)) return raw
  try {
    const arr = JSON.parse(raw as string)
    return Array.isArray(arr) ? (arr as T[]) : fallback
  } catch {
    return fallback
  }
}

/** Parse les paires gauche/droite pour les activites d'association. */
export function parsePairs(
  correctAnswers: string | null | undefined,
  fallback: { left: string; right: string }[] = [],
): { left: string; right: string }[] {
  return parseJsonArray<{ left: string; right: string }>(correctAnswers, fallback)
}

/** Construit le payload de reponse selon le type d'activite et l'etat UI.
 *  Renvoie null si les champs requis sont absents. Partage entre mode live et replay. */
export function buildResponsePayload(
  activityType: string,
  state: {
    selectedAnswers?: number[]
    textInput?: string
    associationMapping?: number[]
  },
): { answers?: number[]; text?: string; answer?: string } | null {
  const { selectedAnswers = [], textInput = '', associationMapping = [] } = state
  if (activityType === 'qcm' || activityType === 'vrai_faux') {
    if (selectedAnswers.length === 0) return null
    return { answers: selectedAnswers }
  }
  if (activityType === 'reponse_courte' || activityType === 'estimation') {
    const t = textInput.trim()
    if (!t) return null
    return { text: t }
  }
  if (activityType === 'association') {
    if (associationMapping.some(v => v === -1) || associationMapping.length === 0) return null
    return { answer: associationMapping.join(',') }
  }
  if (activityType === 'texte_a_trous') {
    const t = textInput?.trim()
    if (!t) return null
    return { text: t }
  }
  if (activityType === 'tri') {
    if (associationMapping && associationMapping.length > 0) {
      return { answer: associationMapping.join(',') }
    }
    return null
  }
  return null
}

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  // Spark
  qcm: 'QCM',
  vrai_faux: 'Vrai / Faux',
  reponse_courte: 'Reponse courte',
  association: 'Association',
  estimation: 'Estimation',
  texte_a_trous: 'Texte a trous',
  tri: 'Tri (ordre)',
  // Pulse
  sondage_libre: 'Sondage libre',
  nuage: 'Nuage de mots',
  echelle: 'Echelle',
  question_ouverte: 'Question ouverte',
  sondage: 'Sondage',
  humeur: 'Humeur',
  priorite: 'Priorite',
  matrice: 'Matrice',
  // Code
  live_code: 'Live Code',
  // Board
  board: 'Tableau',
  message_wall: 'Mur de messages',
}

const ACTIVITY_ICONS: Record<string, Component> = {
  // Spark
  qcm: ListChecks, vrai_faux: ToggleLeft, reponse_courte: Type,
  association: Link2, estimation: Hash, texte_a_trous: TextCursorInput,
  tri: ArrowUpDown,
  // Pulse
  sondage_libre: MessageSquare, nuage: Cloud, echelle: Star,
  question_ouverte: FileText, sondage: BarChart,
  humeur: Smile, priorite: ArrowUpDown, matrice: Grid3X3,
  // Code
  live_code: Code2,
  // Board
  board: StickyNote,
  message_wall: MessagesSquare,
}

export function activityTypeLabel(type: string): string {
  return ACTIVITY_TYPE_LABELS[type] ?? 'Activite'
}

export function activityIcon(type: string): Component {
  return ACTIVITY_ICONS[type] ?? Zap
}

/** Derive la categorie depuis le type d'activite (fonction pure) */
export function getActivityCategory(type: string): ActivityCategory {
  for (const [cat, cfg] of Object.entries(ACTIVITY_CATEGORIES)) {
    if (cfg.types.includes(type)) return cat as ActivityCategory
  }
  console.warn(`[liveActivity] Unknown activity type "${type}", defaulting to spark`)
  return 'spark'
}

export function isSparkType(type: string): boolean {
  return getActivityCategory(type) === 'spark'
}
export function isPulseType(type: string): boolean {
  return getActivityCategory(type) === 'pulse'
}
export function isCodeType(type: string): boolean {
  return type === 'live_code'
}
export function isBoardType(type: string): boolean {
  return type === 'board' || type === 'message_wall'
}

export function medal(rank: number, fallback: string | ((r: number) => string) = ''): string {
  if (rank === 1) return '\u{1F947}'
  if (rank === 2) return '\u{1F948}'
  if (rank === 3) return '\u{1F949}'
  return typeof fallback === 'function' ? fallback(rank) : fallback
}

export const KAHOOT_COLORS = ['#E21B3C', '#1368CE', '#26890C', '#D89E00', '#9b59b6', '#1abc9c']
export const KAHOOT_SHAPES = ['\u25B2', '\u25C6', '\u25CF', '\u25A0', '\u2605', '\u2B22']

// Park-Miller LCG, period 2^31-2
export function seededRandom(seed: number): () => number {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}

export function shuffleArray<T>(arr: T[], seed?: number): T[] {
  const a = [...arr]
  const rng = seed !== undefined ? seededRandom(seed) : Math.random
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
