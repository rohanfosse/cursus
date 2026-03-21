// ─── Domaine métier ─────────────────────────────────────────────────────────

export interface User {
  id: number
  name: string
  avatar_initials: string
  photo_data: string | null
  type: 'teacher' | 'ta' | 'student'
  promo_id: number | null
  promo_name: string | null
  must_change_password?: number  // 1 = doit changer, 0 = ok
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
}

// backward compat alias — le backend renvoie toujours Travail, on l'aliase ici
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
  submitted_at: string
  note: string | null
  feedback: string | null
  late_seconds?: number | null
}

export interface AppDocument {
  id: number
  channel_id: number | null
  promo_id: number | null
  name: string
  type: 'file' | 'link'
  content: string
  category: string | null
  description: string | null
  created_at: string
  channel_name?: string
}

export interface Ressource {
  id: number
  travail_id: number
  name: string
  type: 'file' | 'link'
  content: string
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

// ─── Payloads IPC ────────────────────────────────────────────────────────────

export interface SendMessagePayload {
  channelId?: number | null
  dmStudentId?: number | null
  authorName: string
  authorType: 'teacher' | 'ta' | 'student'
  content: string
  channelName?: string | null
  promoId?: number | null
  replyToId?:      number | null
  replyToAuthor?:  string | null
  replyToPreview?: string | null
}
