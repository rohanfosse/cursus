// Shared utilities for Pulse (REX) components
import { MessageSquare, Cloud, Star, FileText, BarChart, Smile, ArrowUpDown, Grid3X3 } from 'lucide-vue-next'
import type { Component } from 'vue'

export const REX_TYPE_LABELS: Record<string, string> = {
  sondage_libre: 'Sondage libre',
  nuage: 'Nuage de mots',
  echelle: 'Echelle',
  question_ouverte: 'Question ouverte',
  sondage: 'Sondage',
  humeur: 'Humeur',
  priorite: 'Priorite',
  matrice: 'Matrice',
}

const REX_ICONS: Record<string, Component> = {
  sondage_libre: MessageSquare,
  nuage: Cloud,
  echelle: Star,
  question_ouverte: FileText,
  sondage: BarChart,
  humeur: Smile,
  priorite: ArrowUpDown,
  matrice: Grid3X3,
}

export function rexActivityTypeLabel(type: string): string {
  return REX_TYPE_LABELS[type] ?? 'Question ouverte'
}

export function rexActivityIcon(type: string): Component {
  return REX_ICONS[type] ?? FileText
}
