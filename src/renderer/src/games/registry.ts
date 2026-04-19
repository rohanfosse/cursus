/**
 * Registre des mini-jeux Cursus (v2.172).
 *
 * Source unique consommee par :
 *   - GamesView (hub /jeux) pour generer la grille de cartes
 *   - Sidebar badge eventuel "nouveau jeu"
 *
 * Ajouter un jeu = 1 entree ici + 1 vue dediee + (optionnel) 1 widget.
 * Pas besoin de toucher a la sidebar ni au hub.
 */
import type { Component } from 'vue'
import { Keyboard } from 'lucide-vue-next'

export interface Game {
  id:          string
  label:       string
  icon:        Component
  /** Short pitch affiche sur la carte hub. */
  tagline:     string
  /** Description plus longue, tooltip ou detail. */
  description: string
  /** Route vers la vue plein ecran du jeu. */
  route:       string
  /** Badge visuel sur la carte : 'new', 'beta', null. */
  badge?:      'new' | 'beta' | null
  /** Couleur d'accent pour la carte (hex). */
  accent:      string
}

export const GAMES: Game[] = [
  {
    id:          'typerace',
    label:       'TypeRace',
    icon:        Keyboard,
    tagline:     'Tape une phrase FR le plus vite possible',
    description: 'Mini-jeu typing speed en francais. 60 secondes pour taper une phrase aleatoire. Score = WPM x precision. Leaderboard par promo remis a zero chaque jour.',
    route:       '/typerace',
    badge:       'new',
    accent:      '#3b82f6',
  },
]
