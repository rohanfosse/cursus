/**
 * useWidgetPresets — Presets de layout pour les dashboards etudiant et prof.
 * Chaque preset est un objet BentoPrefs statique avec order, hidden, sizes.
 */
import type { WidgetSize } from '@/types/widgets'

interface PresetConfig {
  order: string[]
  hidden: string[]
  sizes: Record<string, WidgetSize>
  preset: string
}

export interface LayoutPreset {
  id: string
  label: string
  description: string
  config: PresetConfig
}

// ── Presets etudiant ──────────────────────────────────────────────────────────

export const STUDENT_PRESETS: LayoutPreset[] = [
  {
    id: 'balanced',
    label: 'Equilibre',
    description: 'Mix de tailles, tous les widgets essentiels',
    config: {
      order: ['live', 'project', 'exams', 'livrables', 'soutenances', 'feedback', 'recentDoc', 'promoActivity'],
      hidden: ['clock', 'quote', 'calendar', 'progress', 'quicklinks', 'pomodoro', 'grades', 'bookmarks', 'countdown', 'group'],
      sizes: {
        live: '2x1', project: '2x1', exams: '2x1',
        livrables: '1x1', soutenances: '1x1',
        feedback: '2x1', recentDoc: '1x1', promoActivity: '2x1',
      },
      preset: 'balanced',
    },
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'Tous les widgets en petit, dense et efficace',
    config: {
      order: ['live', 'project', 'exams', 'livrables', 'soutenances', 'feedback', 'recentDoc', 'promoActivity', 'grades', 'countdown'],
      hidden: ['clock', 'quote', 'calendar', 'progress', 'quicklinks', 'pomodoro', 'bookmarks', 'group'],
      sizes: {
        live: '2x1', project: '1x1', exams: '1x1',
        livrables: '1x1', soutenances: '1x1',
        feedback: '1x1', recentDoc: '1x1', promoActivity: '2x1',
        grades: '1x1', countdown: '1x1',
      },
      preset: 'compact',
    },
  },
  {
    id: 'focus',
    label: 'Focus projet',
    description: 'Projet en grand, livrables et notes mis en avant',
    config: {
      order: ['project', 'grades', 'livrables', 'exams', 'feedback', 'promoActivity'],
      hidden: ['live', 'soutenances', 'recentDoc', 'clock', 'quote', 'calendar', 'progress', 'quicklinks', 'pomodoro', 'bookmarks', 'countdown', 'group'],
      sizes: {
        project: '2x2', grades: '2x1', livrables: '2x1',
        exams: '2x1', feedback: '2x1', promoActivity: '4x1',
      },
      preset: 'focus',
    },
  },
]

// ── Presets prof ──────────────────────────────────────────────────────────────

export const TEACHER_PRESETS: LayoutPreset[] = [
  {
    id: 'overview',
    label: 'Vue d\'ensemble',
    description: 'Action center + stats + agenda, vision globale',
    config: {
      order: ['focus', 'stat-soumis', 'stat-noter', 'stat-moyenne', 'stat-online', 'schedule', 'messages', 'actions', 'activity', 'todo'],
      hidden: ['clock', 'quote', 'pomodoro', 'quicklinks', 'dm-files', 'week-cal', 'signatures'],
      sizes: {
        focus: '2x2', 'stat-soumis': '1x1', 'stat-noter': '1x1',
        'stat-moyenne': '1x1', 'stat-online': '1x1',
        schedule: '4x1', messages: '2x1', actions: '2x1',
        activity: '2x1', todo: '2x1',
      },
      preset: 'overview',
    },
  },
  {
    id: 'communication',
    label: 'Communication',
    description: 'Messages, mentions et activite en priorite',
    config: {
      order: ['messages', 'activity', 'focus', 'stat-soumis', 'stat-noter', 'stat-moyenne', 'stat-online', 'schedule', 'todo'],
      hidden: ['actions', 'clock', 'quote', 'pomodoro', 'quicklinks', 'dm-files', 'week-cal', 'signatures'],
      sizes: {
        messages: '2x1', activity: '4x1',
        focus: '2x2', 'stat-soumis': '1x1', 'stat-noter': '1x1',
        'stat-moyenne': '1x1', 'stat-online': '1x1',
        schedule: '2x1', todo: '2x1',
      },
      preset: 'communication',
    },
  },
  {
    id: 'tracking',
    label: 'Suivi',
    description: 'Notes, rendus et progression en grand format',
    config: {
      order: ['focus', 'stat-noter', 'stat-soumis', 'stat-moyenne', 'stat-online', 'todo', 'schedule', 'activity', 'signatures'],
      hidden: ['messages', 'actions', 'clock', 'quote', 'pomodoro', 'quicklinks', 'dm-files', 'week-cal'],
      sizes: {
        focus: '2x2', 'stat-noter': '1x1', 'stat-soumis': '1x1',
        'stat-moyenne': '1x1', 'stat-online': '1x1',
        todo: '2x2', schedule: '4x1', activity: '2x1', signatures: '2x1',
      },
      preset: 'tracking',
    },
  },
]
