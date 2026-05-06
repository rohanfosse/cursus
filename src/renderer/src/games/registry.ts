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
import { Keyboard, Joystick, Rocket, Blocks } from 'lucide-vue-next'

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
    description: 'Mini-jeu typing speed en francais. 60 secondes pour taper une phrase aleatoire. Score = WPM x precision.',
    route:       '/typerace',
    accent:      '#3b82f6',
  },
  {
    id:          'snake',
    label:       'Snake',
    icon:        Joystick,
    tagline:     'Mange les pommes, grandis, ne touche pas les murs',
    description: 'Classique Snake sur grille 20x15. Vitesse augmente tous les 5 pommes. 10 pts par pomme + 1 pt par tick de survie.',
    route:       '/snake',
    badge:       'new',
    accent:      '#22c55e',
  },
  {
    id:          'space_invaders',
    label:       'Space Invaders',
    icon:        Rocket,
    tagline:     'Defends la base contre l\'invasion',
    description: 'Vagues d\'aliens qui accelerent. Tire sur les aliens, esquive leurs tirs, 3 vies. Score boostes par le multiplicateur de vague.',
    route:       '/space-invaders',
    badge:       'new',
    accent:      '#22d3ee',
  },
  {
    id:          'tetris',
    label:       'Tetris',
    icon:        Blocks,
    tagline:     'Empile, aligne, casse 4 lignes d\'un coup',
    description: 'Tetris moderne avec rotations SRS, 7-bag randomizer, hold piece, ghost et T-spins. Score Guideline officiel avec combos et back-to-back.',
    route:       '/tetris',
    badge:       'new',
    accent:      '#a855f7',
  },
]
