// ─── Domaine métier ─────────────────────────────────────────────────────────

export interface User {
  id: number
  name: string
  email?: string
  avatar_initials: string
  photo_data: string | null
  type: 'admin' | 'teacher' | 'ta' | 'student'
  promo_id: number | null
  promo_name: string | null
  must_change_password?: number  // 1 = doit changer, 0 = ok
  onboarding_done?: number       // 1 = onboarding termine, 0 = a faire
}

export interface RubricCriterion {
  id: number
  rubric_id: number
  label: string
  max_pts: number
  weight: number
  position: number
}

export interface Rubric {
  id: number
  travail_id: number
  title: string
  criteria: RubricCriterion[]
}

export interface RubricScore {
  id?: number
  depot_id: number
  criterion_id: number
  points: number
  label?: string
  max_pts?: number
  weight?: number
  position?: number
}

export interface Promotion {
  id: number
  name: string
  color: string
}

export interface Channel {
  id: number
  name: string
  promo_id: number
  type: 'chat' | 'annonce'
  description?: string | null
  is_private: boolean | 0 | 1
  members?: number[]
  category?: string | null
  archived?: 0 | 1 | boolean
}

export interface Message {
  id: number
  channel_id: number | null
  dm_student_id: number | null
  author_id: number
  author_name: string
  author_type: 'teacher' | 'student'
  author_initials: string
  author_photo: string | null
  content: string
  created_at: string
  reactions: string | null
  is_pinned: boolean | 0 | 1
  edited:    0 | 1 | boolean
  reply_to_id?:      number | null
  reply_to_author?:  string | null
  reply_to_preview?: string | null
}

export interface Devoir {
  id: number
  title: string
  description: string | null
  channel_id: number
  channel_name?: string
  type: 'soutenance' | 'livrable' | 'cctl' | 'etude_de_cas' | 'memoire' | 'autre'
  category: string | null
  deadline: string
  start_date: string | null
  is_published: boolean | 0 | 1
  is_graded?: boolean | 0 | 1
  assigned_to: 'all' | 'group'
  group_id: number | null
  depot_id: number | null
  group_name?: string | null
  note?: string | null
  feedback?: string | null
  room?: string | null
  aavs?: string | null
  requires_submission?: number | 0 | 1
  promo_id?: number | null
  scheduled_publish_at?: string | null
}

// backward compat alias - le backend renvoie toujours Travail, on l'aliase ici
export type Travail = Devoir

export interface Depot {
  id: number
  travail_id: number
  student_id: number
  student_name: string
  student_initials?: string
  student_photo?: string | null
  type: 'file' | 'link'
  content: string
  file_name?: string | null
  link_url?: string | null
  submitted_at: string | null
  note: string | null
  feedback: string | null
  late_seconds?: number | null
  travail_title?: string
  deploy_url?: string | null
}

export interface AppDocument {
  id: number
  channel_id: number | null
  promo_id: number | null
  project?: string | null
  name: string
  type: 'file' | 'link'
  content: string
  category: string | null
  description: string | null
  created_at: string
  channel_name?: string
  file_size?: number
  travail_id?: number | null
  travail_title?: string | null
}

export interface Ressource {
  id: number
  travail_id: number
  name: string
  type: 'file' | 'link'
  content: string
  category?: string
  source?: 'ressource' | 'document'
}

export interface Group {
  id: number
  name: string
  promo_id: number
}

export interface Student {
  id: number
  name: string
  email: string
  promo_id: number
  promo_name: string | null
  avatar_initials: string | null
  photo_data: string | null
}

// ─── Données Gantt / Dashboard ───────────────────────────────────────────────

export interface GanttRow {
  id:             number
  title:          string
  description:    string | null
  deadline:       string
  start_date:     string | null
  type:           string
  published:      number
  is_published:   number
  category:       string | null
  channel_id:     number
  channel_name:   string
  promo_name:     string
  promo_color:    string
  depots_count:   number
  students_total: number
  room?:          string | null
  aavs?:          string | null
  assigned_to:    string
  group_id:       number | null
  group_name?:    string | null
  depot_id:       number | null
}

export interface RenduRow extends Depot {
  travail_id:    number
  travail_title?: string
}

export interface LoginResponse {
  id: number
  name: string
  type: 'admin' | 'teacher' | 'ta' | 'student'
  avatar_initials: string
  photo_data: string | null
  promo_id: number | null
  promo_name: string | null
  must_change_password?: number
  onboarding_done?: number
  token: string
}

// ─── Payloads IPC ────────────────────────────────────────────────────────────

// ─── Live Quiz ──────────────────────────────────────────────────────────────

export interface LiveSession {
  id: number; teacher_id: number; promo_id: number; title: string
  join_code: string; status: 'waiting' | 'active' | 'ended'
  created_at: string; ended_at: string | null; activities?: LiveActivity[]
  // V2 fields (Live unifie)
  is_async?: number
  open_until?: string | null
}
export interface LiveActivity {
  id: number; session_id: number
  type: 'qcm' | 'vrai_faux' | 'reponse_courte' | 'association' | 'estimation' | 'live_code' | 'board'
  title: string; options: string[] | string | null; multi: number
  max_words: number; position: number; status: 'pending' | 'live' | 'closed'
  started_at: string | null; closed_at: string | null
  timer_seconds: number; correct_answers: string | null
  // V2 fields
  category?: 'spark' | 'pulse' | 'code' | 'board'
  max_rating?: number
  content?: string | null
  language?: string | null
}
export interface LiveResults {
  activityId: number; type: string; totalResponses: number
  data: { option?: string; text?: string; word?: string; index?: number; count: number; percent?: number; size?: number }[]
  // Association / Estimation extended fields (returned by backend aggregation)
  correctCount?: number
  average?: number
  values?: number[]
  target?: number
  margin?: number
}
export interface LeaderboardEntry {
  rank: number; studentId: number; name: string; points: number; pointsThisRound?: number
}
export interface LiveScoreResult {
  isCorrect: boolean | null; points: number; rank: number | null; streak?: number
}

export interface LiveSessionWithStats extends LiveSession {
  activity_count: number; participant_count: number
}

// ─── Widget Sizing System ────────────────────────────────────────────────────
export { type WidgetSize, type WidgetCategory, type WidgetDef, sizeToGridSpan, SIZE_LABELS } from './widgets'

export interface LiveStats {
  totalSessions: number
  avgParticipationRate: number
  enrolledStudents: number
  avgResponseTimeMs?: number
  avgCorrectnessRate?: number
  activityTypeDistribution: { type: string; count: number }[]
  participationTrend: { sessionId: number; title: string; endedAt: string; participants: number; enrolled: number }[]
}

// ─── Live unifie v2 (Spark + Pulse + Code + Board) ─────────────────────────

export type LiveV2Category = 'spark' | 'pulse' | 'code' | 'board'

export type LiveV2ActivityType =
  // Spark (quiz)
  | 'qcm' | 'vrai_faux' | 'reponse_courte' | 'association' | 'estimation'
  // Pulse (feedback)
  | 'sondage_libre' | 'nuage' | 'echelle' | 'question_ouverte' | 'sondage' | 'humeur' | 'priorite' | 'matrice'
  // Code
  | 'live_code'
  // Board
  | 'board'

/** Alias : LiveV2Session est compatible avec LiveSession (les champs V2 sont optionnels) */
export type LiveV2Session = LiveSession

/** Alias : LiveV2Activity est compatible avec LiveActivity */
export type LiveV2Activity = LiveActivity

export interface BoardCard {
  id: number
  activity_id: number
  column_name: string
  content: string
  author_id: number
  author_name: string
  color: string
  votes: number
  created_at: string
  voted_by_me?: boolean
}

// ─── REX (Retour d'Experience) ──────────────────────────────────────────────

export interface RexSession {
  id: number; teacher_id: number; promo_id: number; title: string
  join_code: string; status: 'waiting' | 'active' | 'ended'
  is_async: number; open_until: string | null
  created_at: string; ended_at: string | null; activities?: RexActivity[]
}

export interface RexActivity {
  id: number; session_id: number
  type: 'sondage_libre' | 'nuage' | 'echelle' | 'question_ouverte' | 'sondage' | 'humeur' | 'priorite' | 'matrice'
  title: string; max_words: number; max_rating: number; options?: string | null
  position: number; status: 'pending' | 'live' | 'closed'
  started_at: string | null; closed_at: string | null
}

export interface RexResults {
  type: string; total: number
  counts?: { text: string; count: number }[]
  freq?: { word: string; count: number }[]
  average?: number; distribution?: { rating: number; count: number }[]
  answers?: { id: number; answer: string; pinned: boolean; created_at: string }[]
  // Humeur
  emojis?: { emoji: string; count: number }[]
  // Priorite
  rankings?: { item: string; avgRank: number }[]
  // Matrice
  criteria?: { name: string; average: number }[]
}

export interface RexSessionWithStats extends RexSession {
  activity_count: number; participant_count: number
}

export interface RexStats {
  totalSessions: number
  avgParticipationRate: number
  enrolledStudents: number
  activityTypeDistribution: { type: string; count: number }[]
  participationTrend: { sessionId: number; title: string; endedAt: string; participants: number; enrolled: number }[]
}

// ─── Lumen (liseuse de cours adossee a GitHub) ──────────────────────────────

/**
 * Format d'un chapitre Lumen (v2.64). Determine le rendu cote viewer :
 *  - markdown : rendu via marked + hljs + KaTeX (cas standard)
 *  - pdf      : iframe data: URL (PDF natif Electron)
 *  - tex      : source LaTeX colorisee via highlight.js
 */
export type LumenChapterKind = 'markdown' | 'pdf' | 'tex'

export interface LumenChapter {
  title: string
  path: string
  duration?: number
  summary?: string
  prerequis?: string[]
  /** Section/groupe d'affichage dans la sidebar (optionnel). */
  section?: string
  /** Format du chapitre (v2.64). Si absent, infere depuis l'extension. */
  kind?: LumenChapterKind
  /** Compagnon PDF (v2.64) : path d'un .pdf jumeau a un .md ou .tex. */
  companionPdf?: string
  /** Compagnon TeX (v2.64) : path d'une source .tex jumelle a un .pdf. */
  companionTex?: string
}

export interface LumenResource {
  path: string
  kind?: string
  title?: string
}

/**
 * Categorie d'un repo Lumen (v2.63). Determine le bucket dans la sidebar
 * et l'icone affichee. Inferable cote serveur depuis le nom du repo si
 * non explicite dans le manifest.
 */
export type LumenRepoKind =
  | 'course'      // cours magistral
  | 'prosit'      // prosit / etude de cas
  | 'workshop'    // atelier / TP encadre
  | 'miniproject' // mini-projet realisation court
  | 'project'     // projet long
  | 'readme'      // repo README de la promo (epingle en haut)
  | 'group'       // dossier d'un groupe d'etudiants
  | 'student'     // dossier d'un etudiant individuel (Nom-Prenom)

export interface LumenManifest {
  project: string
  module?: string
  author?: string
  summary?: string
  /** Nom du projet Cursus auquel ce cours est rattache (optionnel). */
  cursusProject?: string
  chapters: LumenChapter[]
  resources?: LumenResource[]
  /** Toujours true — le manifest est genere automatiquement depuis l'arbre du repo. */
  autoGenerated?: boolean
  /** Categorie de repo, pour le groupement dans la sidebar (v2.63). */
  kind?: LumenRepoKind
  /** Audience cible : promo entiere ou groupe specifique (v2.63). */
  audience?: 'promo' | 'group'
  /** Nom du groupe si audience='group' (v2.63). */
  groupName?: string
}

export interface LumenRepo {
  id: number
  promoId: number
  owner: string
  repo: string
  fullName: string
  defaultBranch: string
  manifest: LumenManifest | null
  manifestError: string | null
  lastCommitSha: string | null
  lastSyncedAt: string | null
  projectId: number | null
  projectName: string | null
  /** true quand le prof a publie ce repo pour les etudiants. */
  isVisible: boolean
}

export interface LumenGithubStatus {
  connected: boolean
  login?: string
  scopes?: string
}

export interface LumenChapterContent {
  content: string
  sha: string
  cached?: boolean
  fetchedAt?: string
  /** Format du contenu (v2.64). Le viewer branche dessus pour le rendu. */
  kind?: LumenChapterKind
}

export interface LumenSearchResult {
  repoId: number
  repoName: string
  chapterPath: string
  chapterTitle: string
  /** Snippet HTML contextualise avec `<mark>` autour des termes matchants. */
  snippet: string
  rank: number
}

export interface LumenChapterNote {
  student_id: number
  repo_id: number
  path: string
  content: string
  created_at: string
  updated_at: string
}

export interface LumenRead {
  repo_id: number
  path: string
  read_at: string
}

/** Devoir lie a un chapitre Lumen (shape retourne par la route). */
export interface LumenLinkedTravail {
  id: number
  title: string
  deadline: string | null
  type: string
  category: string | null
  promo_id: number
  published: number
}

/** Chapitre lie a un devoir (shape retourne par la route, avec repo meta). */
export interface LumenLinkedChapter {
  travail_id: number
  repo_id: number
  chapter_path: string
  created_at: string
  owner: string
  repo: string
  manifest_json: string | null
}

// ─── Kanban ──────────────────────────────────────────────────────────────────

export interface KanbanCard {
  id: number; travail_id: number; group_id: number
  title: string; description: string
  status: 'todo' | 'doing' | 'blocked' | 'done'
  position: number; created_by: string; created_at: string
}

// ─── Calendrier ──────────────────────────────────────────────────────────────

export interface Reminder {
  id: number; promo_tag: string | null; date: string
  title: string; description: string; bloc: string | null; created_at: string
}

export interface CalendarEvent {
  id: string
  start: string
  end: string
  title: string
  color: string
  eventType: 'deadline' | 'start_date' | 'reminder'
  sourceId: number
  category?: string | null
  submissionStatus?: 'submitted' | 'pending' | 'late' | 'upcoming'
  depotsCount?: number
  studentsTotal?: number
  promoId?: number
  promoName?: string
  promoColor?: string
}

// ─── Payloads IPC ────────────────────────────────────────────────────────────

export interface SignatureRequest {
  id: number
  message_id: number
  dm_student_id: number
  file_url: string
  file_name: string
  status: 'pending' | 'signed' | 'rejected'
  rejection_reason: string | null
  signed_file_url: string | null
  signer_name: string | null
  signed_at: string | null
  created_at: string
  student_name?: string
}

export interface SendMessagePayload {
  channelId?: number | null
  dmStudentId?: number | null
  dmPeerId?: number | null
  authorName: string
  authorType: 'admin' | 'teacher' | 'ta' | 'student'
  content: string
  channelName?: string | null
  promoId?: number | null
  replyToId?:      number | null
  replyToAuthor?:  string | null
  replyToPreview?: string | null
}
