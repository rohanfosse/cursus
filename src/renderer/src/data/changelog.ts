// Changelog interne consomme par WidgetActuCursus.
// Mise a jour manuelle a chaque release. Garder les 5 dernieres entrees,
// avec 3-5 highlights par release. Format markdown-like simple (pas de
// rendu MD : les highlights sont du texte plat).

export interface ChangelogEntry {
  version: string
  date: string
  title: string
  highlights: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '2.165.0',
    date: '2026-04-19',
    title: 'Six nouveaux widgets dashboard',
    highlights: [
      'WidgetMessages : inbox miniature avec DMs et mentions non lus',
      'WidgetAgendaJour : agenda detaille du jour pour le prof',
      'WidgetFeedbackTemplates : raccourcis pour vos retours frequents',
      'WidgetRendus : devoirs en attente de note cote etudiant',
      'WidgetCahier : raccourci vers vos cahiers collaboratifs',
      'WidgetActuCursus : ce changelog 🙂',
    ],
  },
  {
    version: '2.164.2',
    date: '2026-04-19',
    title: 'Empty states unifies',
    highlights: [
      '17 widgets migrent vers le composant EmptyState partage',
      '95 lignes de CSS dupliquee supprimees',
    ],
  },
  {
    version: '2.164.1',
    date: '2026-04-19',
    title: 'accentColor + UiWidgetHeaderLink',
    highlights: [
      'Couleur d\'accent sentinelle unifiee sur 6 widgets',
      'Composant UiWidgetHeaderLink pour le pattern "Ouvrir ›"',
    ],
  },
  {
    version: '2.164.0',
    date: '2026-04-19',
    title: 'UiWidgetCard + 36 widgets refondus',
    highlights: [
      'Nouveau wrapper UiWidgetCard (header + slot extra) pour tous les widgets',
      'Couleurs hex hardcodees remplacees par des tokens semantiques',
      'Accessibilite : Space + focus-ring sur tous les widgets cliquables',
      'Performance : WidgetGroupMembers parallelise ses appels IPC',
    ],
  },
]
