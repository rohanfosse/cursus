/**
 * useTeacherBento — gestion de la visibilite des tuiles du bento professeur.
 * Etat partage (module-level) + persistance localStorage.
 */
import { ref } from 'vue'
import {
  LayoutDashboard, Percent, Edit3, Award, Wifi, Clock, MessageSquare,
  PlusCircle, Activity, CheckSquare,
  Quote, Timer, Bookmark, CalendarDays, FileBox, Pen,
  Lightbulb, FileText, BarChart3, TrendingUp, StickyNote,
  ClipboardList, CalendarClock, Notebook, Sparkles, Keyboard,
} from 'lucide-vue-next'
import type { WidgetDef, WidgetSize } from '@/types/widgets'

// Re-export pour compatibilite
export type TeacherTileDef = WidgetDef

export const TEACHER_TILES: WidgetDef[] = [
  // ── Widgets principaux (visibles par defaut) ──
  { id: 'focus',        label: 'Action urgente',   icon: LayoutDashboard, description: 'Actions prioritaires',              category: 'essential',     sizes: ['2x2'],                defaultSize: '2x2', defaultEnabled: true,  role: 'teacher' },
  { id: 'stat-soumis',  label: 'Soumissions',      icon: Percent,         description: 'Nombre de soumissions',             category: 'tracking',      sizes: ['1x1'],                defaultSize: '1x1', defaultEnabled: true,  role: 'teacher' },
  { id: 'stat-noter',   label: 'A noter',          icon: Edit3,           description: 'Rendus en attente de note',         category: 'tracking',      sizes: ['1x1'],                defaultSize: '1x1', defaultEnabled: true,  role: 'teacher' },
  { id: 'stat-moyenne', label: 'Moyenne',          icon: Award,           description: 'Moyenne generale de la promo',      category: 'tracking',      sizes: ['1x1'],                defaultSize: '1x1', defaultEnabled: true,  role: 'teacher' },
  { id: 'stat-online',  label: 'En ligne',         icon: Wifi,            description: 'Etudiants connectes',               category: 'tracking',      sizes: ['1x1'],                defaultSize: '1x1', defaultEnabled: true,  role: 'teacher' },
  { id: 'schedule',     label: 'Agenda',           icon: Clock,           description: 'Agenda des prochaines 48h',         category: 'essential',     sizes: ['2x1', '4x1'],         defaultSize: '4x1', defaultEnabled: true,  role: 'teacher' },
  { id: 'messages',     label: 'Messages',         icon: MessageSquare,   description: 'DMs et mentions non lus',           category: 'communication', sizes: ['1x1', '2x1'],         defaultSize: '2x1', defaultEnabled: true,  role: 'teacher' },
  { id: 'actions',      label: 'Actions rapides',  icon: PlusCircle,      description: 'Raccourcis vers les actions courantes', category: 'productivity', sizes: ['1x1', '2x1'],      defaultSize: '2x1', defaultEnabled: true,  role: 'teacher' },
  { id: 'activity',     label: 'Activite recente', icon: Activity,        description: 'Derniers evenements de la promo',   category: 'communication', sizes: ['2x1', '4x1'],         defaultSize: '2x1', defaultEnabled: true,  role: 'teacher' },
  { id: 'todo',         label: 'Todo',             icon: CheckSquare,     description: 'Liste de taches personnelle',       category: 'productivity',  sizes: ['1x1', '2x1', '2x2'], defaultSize: '2x1', defaultEnabled: true,  role: 'teacher' },
  // ── Widgets optionnels (masques par defaut) ──
  { id: 'clock',        label: 'Horloge',          icon: Clock,           description: 'Heure et date en temps reel',       category: 'fun',           sizes: ['1x1'],                defaultSize: '1x1', defaultEnabled: false, role: 'both' },
  { id: 'quote',        label: 'Citation du jour',  icon: Quote,          description: 'Citation motivante quotidienne',    category: 'fun',           sizes: ['1x1', '2x1'],         defaultSize: '2x1', defaultEnabled: false, role: 'both' },
  { id: 'pomodoro',     label: 'Pomodoro',          icon: Timer,          description: 'Minuteur de concentration 25/5',    category: 'productivity',  sizes: ['1x1'],                defaultSize: '1x1', defaultEnabled: false, role: 'both' },
  { id: 'quicklinks',   label: 'Liens rapides',     icon: Bookmark,       description: 'Acces rapide a vos liens favoris',  category: 'productivity',  sizes: ['1x1', '2x1'],         defaultSize: '1x1', defaultEnabled: false, role: 'both' },
  { id: 'dm-files',     label: 'Fichiers DM',       icon: FileBox,        description: 'Fichiers recus par message direct', category: 'communication', sizes: ['1x1', '2x1'],         defaultSize: '1x1', defaultEnabled: false, role: 'teacher' },
  { id: 'week-cal',     label: 'Semaine',           icon: CalendarDays,   description: 'Vue semaine des echeances',         category: 'productivity',  sizes: ['2x1', '2x2'],         defaultSize: '2x1', defaultEnabled: false, role: 'teacher' },
  { id: 'signatures',   label: 'Signatures',        icon: Pen,            description: 'Feuilles de presence',              category: 'tracking',      sizes: ['1x1', '2x1'],         defaultSize: '1x1', defaultEnabled: false, role: 'teacher' },
  // ── Widgets Lumen (optionnels, masques par defaut) ──
  { id: 'lumen-engagement', label: 'Engagement Lumen', icon: Lightbulb,   description: 'Stats d engagement sur les cours Lumen publies', category: 'tracking',  sizes: ['1x1', '2x1'],         defaultSize: '2x1', defaultEnabled: false, role: 'teacher' },
  { id: 'lumen-my-courses', label: 'Mes cours Lumen',  icon: Lightbulb,   description: 'Cours Lumen publies avec leurs lectures',         category: 'tracking',  sizes: ['1x1', '2x1', '2x2'],  defaultSize: '2x1', defaultEnabled: false, role: 'teacher' },
  { id: 'lumen-top-read',   label: 'Top cours lus',    icon: BarChart3,   description: 'Top 3 des cours Lumen les plus lus',              category: 'tracking',  sizes: ['1x1', '2x1'],         defaultSize: '2x1', defaultEnabled: false, role: 'teacher' },
  // ── Widgets productivite prof (optionnels) ──
  { id: 'quick-create',     label: 'Creation rapide',  icon: PlusCircle,  description: 'Boutons rapides pour creer devoir / cours / doc',category: 'productivity', sizes: ['1x1', '2x1'],      defaultSize: '1x1', defaultEnabled: false, role: 'teacher' },
  { id: 'notation-pending', label: 'A noter (top)',    icon: Edit3,       description: 'Devoirs avec le plus de rendus en attente de note', category: 'essential', sizes: ['1x1', '2x1'],     defaultSize: '1x1', defaultEnabled: false, role: 'teacher' },
  { id: 'sticky-note',      label: 'Bloc-notes',       icon: StickyNote,  description: 'Note personnelle rapide (sauvegarde auto locale)',  category: 'productivity', sizes: ['1x1', '2x1'],      defaultSize: '1x1', defaultEnabled: false, role: 'teacher' },
  { id: 'promo-velocity',   label: 'Activite 7j',      icon: Activity,    description: 'Courbe des rendus soumis sur les 7 derniers jours', category: 'tracking', sizes: ['1x1', '2x1'],      defaultSize: '1x1', defaultEnabled: false, role: 'teacher' },
  // ── Nouveaux widgets v2.165 ──
  { id: 'feedback-templates', label: 'Templates feedback', icon: ClipboardList, description: 'Retours frequents copiables en 1 clic',         category: 'productivity', sizes: ['2x1', '2x2'],         defaultSize: '2x1', defaultEnabled: true,  role: 'teacher' },
  { id: 'agenda-jour',        label: 'Agenda du jour',     icon: CalendarClock, description: 'Cours, RDV et lives de la journee',              category: 'essential',    sizes: ['2x1', '2x2', '4x1'],  defaultSize: '2x2', defaultEnabled: true,  role: 'teacher' },
  { id: 'cahier',             label: 'Cahiers collab',     icon: Notebook,      description: 'Cahiers collaboratifs recents de la promo',      category: 'productivity', sizes: ['1x1', '2x1', '2x2'],  defaultSize: '2x1', defaultEnabled: false, role: 'teacher' },
  { id: 'actu',               label: 'Quoi de neuf',       icon: Sparkles,      description: 'Nouveautes Cursus',                               category: 'fun',          sizes: ['1x1', '2x1'],         defaultSize: '2x1', defaultEnabled: false, role: 'both' },
  // ── Jeux (v2.172 — opt-in, module 'games') ──
  { id: 'typerace',           label: 'TypeRace',           icon: Keyboard,      description: 'Mini-jeu typing speed + classement du jour',     category: 'fun',          sizes: ['2x1', '2x2'],         defaultSize: '2x1', defaultEnabled: false, role: 'both' },
]

const STORAGE_KEY = 'teacher_bento_hidden'
const ORDER_KEY   = 'teacher_bento_opt_order'
const SIZES_KEY   = 'teacher_bento_sizes'

const OPTIONAL_IDS = TEACHER_TILES.filter(t => !t.defaultEnabled).map(t => t.id)

function loadHidden(): Set<string> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const set = new Set(JSON.parse(saved) as string[])
      for (const t of TEACHER_TILES) {
        if (!t.defaultEnabled && !saved.includes(t.id)) set.add(t.id)
      }
      return set
    }
  } catch { /* ignore */ }
  return new Set(TEACHER_TILES.filter(t => !t.defaultEnabled).map(t => t.id))
}

function loadOptOrder(): string[] {
  try {
    const saved = localStorage.getItem(ORDER_KEY)
    if (saved) {
      const arr = JSON.parse(saved) as string[]
      for (const id of OPTIONAL_IDS) {
        if (!arr.includes(id)) arr.push(id)
      }
      return arr.filter(id => OPTIONAL_IDS.includes(id))
    }
  } catch { /* ignore */ }
  return [...OPTIONAL_IDS]
}

function loadSizes(): Record<string, WidgetSize> {
  try {
    const saved = localStorage.getItem(SIZES_KEY)
    if (saved) return JSON.parse(saved) as Record<string, WidgetSize>
  } catch { /* ignore */ }
  return {}
}

// Etat singleton partage
const hidden = ref<Set<string>>(loadHidden())
const optionalOrder = ref<string[]>(loadOptOrder())
const sizes = ref<Record<string, WidgetSize>>(loadSizes())

function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden.value])) }
function persistOrder() { localStorage.setItem(ORDER_KEY, JSON.stringify(optionalOrder.value)) }
function persistSizes() { localStorage.setItem(SIZES_KEY, JSON.stringify(sizes.value)) }

export function useTeacherBento() {
  function isVisible(id: string) { return !hidden.value.has(id) }

  function toggleTile(id: string) {
    if (hidden.value.has(id)) hidden.value.delete(id)
    else hidden.value.add(id)
    hidden.value = new Set(hidden.value)
    persist()
  }

  function resetTiles() {
    hidden.value = new Set(TEACHER_TILES.filter(t => !t.defaultEnabled).map(t => t.id))
    optionalOrder.value = [...OPTIONAL_IDS]
    sizes.value = {}
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(ORDER_KEY)
    localStorage.removeItem(SIZES_KEY)
  }

  function getWidgetSize(id: string): WidgetSize {
    if (sizes.value[id]) return sizes.value[id]
    const tile = TEACHER_TILES.find(t => t.id === id)
    return tile?.defaultSize ?? '1x1'
  }

  function setWidgetSize(id: string, size: WidgetSize) {
    sizes.value = { ...sizes.value, [id]: size }
    persistSizes()
  }

  const visibleOptionalTiles = ref(
    optionalOrder.value.filter(id => !hidden.value.has(id)).map(id => TEACHER_TILES.find(t => t.id === id)!).filter(Boolean)
  )

  function refreshVisibleOptional() {
    visibleOptionalTiles.value = optionalOrder.value
      .filter(id => !hidden.value.has(id))
      .map(id => TEACHER_TILES.find(t => t.id === id)!)
      .filter(Boolean)
  }

  function reorderOptional(newOrder: WidgetDef[]) {
    optionalOrder.value = newOrder.map(t => t.id)
    persistOrder()
    refreshVisibleOptional()
  }

  return {
    hidden, isVisible, toggleTile, resetTiles,
    allTiles: TEACHER_TILES, visibleOptionalTiles,
    reorderOptional, refreshVisibleOptional,
    getWidgetSize, setWidgetSize, sizes,
  }
}
