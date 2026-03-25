/**
 * useTeacherBento — gestion de la visibilité des tuiles du bento professeur.
 * État partagé (module-level) + persistance localStorage.
 */
import { ref } from 'vue'
import {
  LayoutDashboard, Percent, Edit3, Award, Wifi, Clock, MessageSquare,
  PlusCircle, Activity, CheckSquare,
  Quote, Timer, Bookmark, CalendarDays, FileBox,
} from 'lucide-vue-next'
import type { FunctionalComponent } from 'vue'

export interface TeacherTileDef {
  id:    string
  label: string
  icon:  FunctionalComponent
  defaultHidden?: boolean
}

export const TEACHER_TILES: TeacherTileDef[] = [
  { id: 'focus',        label: 'Action urgente',  icon: LayoutDashboard },
  { id: 'stat-soumis',  label: 'Soumissions',     icon: Percent         },
  { id: 'stat-noter',   label: 'À noter',         icon: Edit3           },
  { id: 'stat-moyenne', label: 'Moyenne',         icon: Award           },
  { id: 'stat-online',  label: 'En ligne',        icon: Wifi            },
  { id: 'schedule',     label: 'Agenda',          icon: Clock           },
  { id: 'messages',     label: 'Messages',        icon: MessageSquare   },
  { id: 'actions',      label: 'Actions rapides', icon: PlusCircle      },
  { id: 'activity',     label: 'Activité récente',icon: Activity        },
  { id: 'todo',         label: 'Todo',            icon: CheckSquare     },
  // ── Widgets optionnels (masqués par défaut) ──
  { id: 'clock',       label: 'Horloge',         icon: Clock,        defaultHidden: true },
  { id: 'quote',       label: 'Citation du jour', icon: Quote,        defaultHidden: true },
  { id: 'pomodoro',    label: 'Pomodoro',         icon: Timer,        defaultHidden: true },
  { id: 'quicklinks',  label: 'Liens rapides',    icon: Bookmark,     defaultHidden: true },
  { id: 'dm-files',    label: 'Fichiers DM',      icon: FileBox,      defaultHidden: true },
  { id: 'week-cal',    label: 'Semaine',          icon: CalendarDays, defaultHidden: true },
]

const STORAGE_KEY = 'teacher_bento_hidden'

function loadHidden(): Set<string> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const set = new Set(JSON.parse(saved) as string[])
      // Ajouter les nouvelles tuiles defaultHidden non encore connues
      for (const t of TEACHER_TILES) {
        if (t.defaultHidden && !saved.includes(t.id)) set.add(t.id)
      }
      return set
    }
  } catch { /* ignore */ }
  // Premier chargement : masquer les tuiles defaultHidden
  return new Set(TEACHER_TILES.filter(t => t.defaultHidden).map(t => t.id))
}

// État singleton partagé entre tous les composants qui importent ce composable
const hidden = ref<Set<string>>(loadHidden())

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden.value]))
}

export function useTeacherBento() {
  function isVisible(id: string) { return !hidden.value.has(id) }

  function toggleTile(id: string) {
    if (hidden.value.has(id)) hidden.value.delete(id)
    else                      hidden.value.add(id)
    hidden.value = new Set(hidden.value) // déclenche la réactivité
    persist()
  }

  function resetTiles() {
    hidden.value = new Set()
    localStorage.removeItem(STORAGE_KEY)
  }

  return { hidden, isVisible, toggleTile, resetTiles, allTiles: TEACHER_TILES }
}
