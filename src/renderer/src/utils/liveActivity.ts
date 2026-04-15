// Shared utilities for Live activities (Spark + Pulse + Code + Board)
import {
  ListChecks, ToggleLeft, Type, Link2, Hash, Cloud, MessageSquare, Zap,
  Star, FileText, BarChart, Smile, ArrowUpDown, Grid3X3, Code2, StickyNote,
} from 'lucide-vue-next'
import type { Component } from 'vue'

export type ActivityCategory = 'spark' | 'pulse' | 'code' | 'board'

export const ACTIVITY_CATEGORIES: Record<ActivityCategory, { label: string; description: string; types: string[]; color: string }> = {
  spark: {
    label: 'Spark',
    description: 'Quiz gamifie (scoring, leaderboard)',
    types: ['qcm', 'vrai_faux', 'reponse_courte', 'association', 'estimation'],
    color: '#f59e0b',
  },
  pulse: {
    label: 'Pulse',
    description: 'Feedback anonyme (pas de scoring)',
    types: ['sondage_libre', 'nuage', 'echelle', 'question_ouverte', 'sondage', 'humeur', 'priorite', 'matrice'],
    color: '#10b981',
  },
  code: {
    label: 'Code',
    description: 'Live coding prof broadcast',
    types: ['live_code'],
    color: '#3b82f6',
  },
  board: {
    label: 'Board',
    description: 'Brainstorming post-its + votes',
    types: ['board'],
    color: '#a855f7',
  },
}

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  // Spark
  qcm: 'QCM',
  vrai_faux: 'Vrai / Faux',
  reponse_courte: 'Reponse courte',
  association: 'Association',
  estimation: 'Estimation',
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
}

const ACTIVITY_ICONS: Record<string, Component> = {
  // Spark
  qcm: ListChecks, vrai_faux: ToggleLeft, reponse_courte: Type,
  association: Link2, estimation: Hash,
  // Pulse
  sondage_libre: MessageSquare, nuage: Cloud, echelle: Star,
  question_ouverte: FileText, sondage: BarChart,
  humeur: Smile, priorite: ArrowUpDown, matrice: Grid3X3,
  // Code
  live_code: Code2,
  // Board
  board: StickyNote,
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
  return type === 'board'
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
