// ─── Clés localStorage centralisées ──────────────────────────────────────────

export const STORAGE_KEYS = {
  SESSION:          'cc_session',
  NAV_STATE:        'cc_nav_state',
  PREFS:            'cc_prefs',
  MUTED_DMS:        'cc_muted_dms',
  PRIVACY_SEEN:     'cc_privacy_seen',
  CUSTOM_PROJECTS:  'cc_custom_projects',
  BOOKMARKS:        'cesia:bookmarks',

  /** Clé dynamique par canal : `lastRead:ch:{channelId}` */
  lastReadChannel: (channelId: number) => `lastRead:ch:${channelId}` as const,
  /** Clé dynamique par DM : `lastRead:dm:{dmStudentId}` */
  lastReadDm:      (dmStudentId: number) => `lastRead:dm:${dmStudentId}` as const,
  /** Clé brouillon canal : `draft_ch_{channelId}` */
  draftChannel:    (channelId: number) => `draft_ch_${channelId}` as const,
  /** Clé brouillon DM : `draft_dm_{dmStudentId}` */
  draftDm:         (dmStudentId: number) => `draft_dm_${dmStudentId}` as const,
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

/** Durée idle avant fermeture AudioContext (ms) */
export const AUDIO_IDLE_TIMEOUT_MS = 30_000

/** Limite de l'historique de notifications */
export const NOTIFICATION_HISTORY_LIMIT = 50
