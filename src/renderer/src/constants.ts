// ─── Clés localStorage centralisées ──────────────────────────────────────────

export const STORAGE_KEYS = {
  SESSION:          'cc_session',
  REMEMBER_TOKEN:   'cc_remember_token',
  NAV_STATE:        'cc_nav_state',
  PREFS:            'cc_prefs',
  MUTED_DMS:        'cc_muted_dms',
  PRIVACY_SEEN:     'cc_privacy_seen',
  CUSTOM_PROJECTS:  'cc_custom_projects',
  BOOKMARKS:        'cesia:bookmarks',
  QUICKLINKS:       'cc_student_quicklinks',
  BENTO_PREFS:      'cc_bento_prefs',
  RECENT_CHANNELS:  'cc_recent_channels',
  LAST_ROUTE:       'cc_last_route',

  /** Clé dynamique par canal : `lastRead:ch:{channelId}` */
  lastReadChannel: (channelId: number) => `lastRead:ch:${channelId}` as const,
  /** Clé dynamique par DM : `lastRead:dm:{dmStudentId}` */
  lastReadDm:      (dmStudentId: number) => `lastRead:dm:${dmStudentId}` as const,
  /** Clé brouillon canal : `draft_ch_{channelId}` */
  draftChannel:    (channelId: number) => `draft_ch_${channelId}` as const,
  /** Clé brouillon DM : `draft_dm_{dmStudentId}` */
  draftDm:         (dmStudentId: number) => `draft_dm_${dmStudentId}` as const,
  /** Clé brouillon formulaire "Nouveau devoir" par promo */
  draftNewDevoir:  (promoId: number) => `draft_new_devoir_${promoId}` as const,
  /** Métadonnées projets par promo */
  projectsMeta:    (promoId: number) => `cc_projects_${promoId}` as const,
} as const

// ─── Constantes de timing ────────────────────────────────────────────────────

/** Seuil de regroupement de messages (5 min) */
export const GROUP_THRESHOLD_MS = 5 * 60 * 1000

/** Taille de page pour la pagination des messages */
export const MESSAGE_PAGE_SIZE = 50

/** Longueur max d'un message */
export const MAX_MESSAGE_LENGTH = 10_000

/** Durée d'affichage d'un toast (ms) */
export const TOAST_DURATION_MS = 4_000

/** Timeout typing indicator (ms) */
export const TYPING_TIMEOUT_MS = 3_000

/** Intervalle min entre émissions de typing (ms) */
export const TYPING_EMIT_INTERVAL_MS = 2_000

/** Nombre de contacts DM récents */
export const DM_RECENT_LIMIT = 10

/** Limite de l'historique de notifications */
export const NOTIFICATION_HISTORY_LIMIT = 100

// ─── Labels de rôles utilisateur ─────────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  admin:   'Admin',
  teacher: 'Responsable',
  ta:      'Intervenant',
  student: 'Etudiant',
}

export function roleLabel(type: string | undefined | null): string {
  return ROLE_LABELS[type ?? ''] ?? type ?? ''
}

// ─── Constantes du dashboard enseignant ───────────────────────────────────────

/** Nombre max d'éléments affichés dans les widgets */
export const MAX_WIDGET_ITEMS = 5

/** Nombre max d'actions dans le centre d'action */
export const MAX_ACTION_ITEMS = 6

/** Nombre max de taux de soumission affichés */
export const MAX_SUBMISSION_RATES = 15

/** Portée par défaut de la frise en jours */
export const FRISE_DEFAULT_SPAN_DAYS = 120

/** Ordre de priorité des urgences */
export const URGENCY_ORDER = { critical: 0, warning: 1, info: 2 } as const

// ─── Palette de couleurs (miroir des CSS custom properties) ─────────────────
// Utiliser ces constantes dans le JS quand les variables CSS ne sont pas accessibles
// (props dynamiques, canvas, etc.). Garder synchronisé avec base.css :root.

export const COLORS = {
  accent:      '#4dd0e1',
  danger:      '#E74C3C',
  warning:     '#F39C12',
  success:     '#2ECC71',

  // Types de devoirs
  livrable:    '#4A90D9',
  soutenance:  '#F39C12',
  cctl:        '#9B87F5',
  etudeDeCas:  '#2ECC71',
  memoire:     '#E74C3C',
  autre:       '#95A5A6',

  // Notes
  gradeA:      '#2ECC71',
  gradeB:      '#4A90D9',
  gradeC:      '#F39C12',
  gradeD:      '#E74C3C',
  gradeNA:     '#95A5A6',
} as const

// ─── Palette de couleurs prédéfinies pour les projets ───────────────────────

export const PROJECT_COLORS = [
  '#4A90D9', '#2ECC71', '#9B87F5', '#F39C12', '#E74C3C',
  '#1ABC9C', '#E67E22', '#3498DB', '#8E44AD', '#27AE60',
] as const
