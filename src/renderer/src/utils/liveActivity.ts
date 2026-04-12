// Shared utilities for Spark (Live Quiz) components
import { ListChecks, ToggleLeft, Type, Link2, Hash, Cloud, MessageSquare, Zap } from 'lucide-vue-next'
import type { Component } from 'vue'

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  qcm: 'QCM',
  vrai_faux: 'Vrai / Faux',
  reponse_courte: 'Reponse courte',
  association: 'Association',
  estimation: 'Estimation',
  nuage: 'Nuage de mots',
  sondage: 'Sondage',
}

const ACTIVITY_ICONS: Record<string, Component> = {
  qcm: ListChecks,
  vrai_faux: ToggleLeft,
  reponse_courte: Type,
  association: Link2,
  estimation: Hash,
  nuage: Cloud,
  sondage: MessageSquare,
}

export function activityTypeLabel(type: string): string {
  return ACTIVITY_TYPE_LABELS[type] ?? 'Spark'
}

export function activityIcon(type: string): Component {
  return ACTIVITY_ICONS[type] ?? Zap
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
