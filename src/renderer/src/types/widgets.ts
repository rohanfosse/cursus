// ─── Widget Sizing System ────────────────────────────────────────────────────
// Types partages pour le systeme de widgets multi-tailles Android-style.

import type { Component } from 'vue'

/** Tailles de widget : colonnes x lignes dans la grille CSS Grid 4 colonnes. */
export type WidgetSize = '1x1' | '2x1' | '2x2' | '4x1'

/** Categories pour le widget picker. */
export type WidgetCategory = 'essential' | 'communication' | 'tracking' | 'productivity' | 'fun'

/** Definition d'un widget (etudiant + prof). */
export interface WidgetDef {
  id: string
  label: string
  icon: Component
  description: string
  category: WidgetCategory
  sizes: WidgetSize[]
  defaultSize: WidgetSize
  defaultEnabled: boolean
  /** 'student' | 'teacher' | 'both' */
  role: 'student' | 'teacher' | 'both'
}

/** Convertit une taille de widget en spans CSS Grid. */
export function sizeToGridSpan(size: WidgetSize): { colSpan: number; rowSpan: number } {
  switch (size) {
    case '1x1': return { colSpan: 1, rowSpan: 1 }
    case '2x1': return { colSpan: 2, rowSpan: 1 }
    case '2x2': return { colSpan: 2, rowSpan: 2 }
    case '4x1': return { colSpan: 4, rowSpan: 1 }
  }
}

/** Labels lisibles pour le picker de taille. */
export const SIZE_LABELS: Record<WidgetSize, string> = {
  '1x1': 'Petit',
  '2x1': 'Moyen',
  '2x2': 'Grand',
  '4x1': 'Pleine largeur',
}
