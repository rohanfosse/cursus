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
    id: 'essentiel',
    label: 'Essentiel',
    description: '4 widgets : echeances, projet, cours, semaine',
    config: {
      order: ['echeances', 'project', 'lumenProgress', 'weekplanner'],
      hidden: ['live', 'exams', 'livrables', 'soutenances', 'feedback', 'recentDoc', 'lumenCourses', 'lumenNotes', 'dailyGoal', 'promoActivity', 'clock', 'quote', 'calendar', 'progress', 'quicklinks', 'pomodoro', 'grades', 'bookmarks', 'countdown', 'group', 'streak'],
      sizes: {
        echeances: '2x2', project: '2x1', lumenProgress: '1x1', weekplanner: '2x1',
      },
      preset: 'essentiel',
    },
  },
  {
    id: 'complet',
    label: 'Complet',
    description: 'Tous les widgets essentiels + notes et streak',
    config: {
      order: ['echeances', 'project', 'lumenProgress', 'weekplanner', 'grades', 'streak', 'feedback'],
      hidden: ['live', 'exams', 'livrables', 'soutenances', 'recentDoc', 'lumenCourses', 'lumenNotes', 'dailyGoal', 'promoActivity', 'clock', 'quote', 'calendar', 'progress', 'quicklinks', 'pomodoro', 'bookmarks', 'countdown', 'group'],
      sizes: {
        echeances: '2x2', project: '2x1', lumenProgress: '1x1',
        weekplanner: '2x1', grades: '2x1', streak: '1x1', feedback: '2x1',
      },
      preset: 'complet',
    },
  },
  {
    id: 'focus',
    label: 'Focus projet',
    description: 'Projet en grand, echeances et notes',
    config: {
      order: ['project', 'echeances', 'grades', 'lumenProgress'],
      hidden: ['live', 'exams', 'livrables', 'soutenances', 'feedback', 'recentDoc', 'lumenCourses', 'lumenNotes', 'dailyGoal', 'promoActivity', 'clock', 'quote', 'calendar', 'progress', 'quicklinks', 'pomodoro', 'bookmarks', 'countdown', 'group', 'streak', 'weekplanner'],
      sizes: {
        project: '2x2', echeances: '2x2', grades: '2x1', lumenProgress: '1x1',
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
