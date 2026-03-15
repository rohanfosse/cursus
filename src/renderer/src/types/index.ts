// ─── Domaine métier ─────────────────────────────────────────────────────────

export interface User {
  id: number
  name: string
  avatar_initials: string
  photo_data: string | null
  type: 'teacher' | 'student'
  promo_id: number | null
  promo_name: string | null
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
  is_private: boolean | 0 | 1
  members?: number[]
}

export interface Message {
  id: number
  channel_id: number | null
  dm_student_id: number | null
  author_id: number
  author_name: string
  author_initials: string
  author_photo: string | null
  content: string
  created_at: string
  reactions: string | null
  is_pinned: boolean | 0 | 1
}

export interface Travail {
  id: number
  title: string
  description: string | null
  channel_id: number
  channel_name?: string
  type: 'devoir' | 'jalon' | 'projet'
  category: string | null
  deadline: string
  start_date: string | null
  is_published: boolean | 0 | 1
  assigned_to: 'all' | 'group'
  group_id: number | null
  depot_id: number | null
  group_name?: string | null
}

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
  authorId: number
  content: string
}
