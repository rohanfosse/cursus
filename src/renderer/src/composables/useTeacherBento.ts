/**
 * useTeacherBento — gestion de la visibilite et de l ordre des tuiles du bento
 * professeur. Toutes les tuiles (y compris les "core") sont reorganisables et
 * masquables ; aucune n est obligatoire. Etat singleton + persistance
 * localStorage.
 */
import { ref, computed } from 'vue'
import {
  LayoutDashboard, Percent, Edit3, Award, Wifi, Clock, MessageSquare,
  PlusCircle, Activity, CheckSquare,
  Quote, Timer, Bookmark, CalendarDays, FileBox, Pen,
  Lightbulb, BarChart3, TrendingUp, StickyNote,
  ClipboardList, CalendarClock, Sparkles, Keyboard,
} from 'lucide-vue-next'
import { sizeToGridSpan, type WidgetCategory, type WidgetDef, type WidgetSize } from '@/types/widgets'

// Re-export pour compatibilite
export type TeacherTileDef = WidgetDef

export const TEACHER_TILES: WidgetDef[] = [
  // ── Widgets principaux (visibles par defaut, mais masquables) ──
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
  { id: 'at-risk',      label: 'Etudiants a risque', icon: TrendingUp,    description: 'Etudiants en difficulte a suivre',  category: 'tracking',      sizes: ['2x1'],                defaultSize: '2x1', defaultEnabled: true,  role: 'teacher' },
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
  { id: 'actu',               label: 'Quoi de neuf',       icon: Sparkles,      description: 'Nouveautes Cursus',                               category: 'fun',          sizes: ['1x1', '2x1'],         defaultSize: '2x1', defaultEnabled: false, role: 'both' },
  // ── Jeux (v2.172 — opt-in, module 'games') ──
  { id: 'typerace',           label: 'TypeRace',           icon: Keyboard,      description: 'Mini-jeu typing speed + classement du jour',     category: 'fun',          sizes: ['2x1', '2x2'],         defaultSize: '2x1', defaultEnabled: false, role: 'both' },
]

const STORAGE_KEY = 'teacher_bento_hidden'
// Legacy key (pre-v2.174 contenait uniquement l ordre des optionnels) — conserve
// pour compat avec tests et pour eviter une migration bruyante.
const ORDER_KEY   = 'teacher_bento_opt_order'
const SIZES_KEY   = 'teacher_bento_sizes'

const ALL_IDS = TEACHER_TILES.map(t => t.id)

function loadHidden(): Set<string> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const arr = JSON.parse(saved) as string[]
      const set = new Set(arr)
      // Nouveaux widgets absents des prefs : s ils ne sont pas defaultEnabled,
      // on les masque par defaut pour eviter un ajout intempestif.
      for (const t of TEACHER_TILES) {
        if (!t.defaultEnabled && !arr.includes(t.id)) set.add(t.id)
      }
      return set
    }
  } catch { /* ignore */ }
  return new Set(TEACHER_TILES.filter(t => !t.defaultEnabled).map(t => t.id))
}

function loadOrder(): string[] {
  try {
    const saved = localStorage.getItem(ORDER_KEY)
    if (saved) {
      const arr = (JSON.parse(saved) as string[]).filter(id => ALL_IDS.includes(id))
      // Append any new widget ids (including migration of core widgets
      // absents de l ancien storage qui ne contenait que les optionnels).
      for (const id of ALL_IDS) {
        if (!arr.includes(id)) arr.push(id)
      }
      return arr
    }
  } catch { /* ignore */ }
  return [...ALL_IDS]
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
const order = ref<string[]>(loadOrder())
const sizes = ref<Record<string, WidgetSize>>(loadSizes())

function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden.value])) }
function persistOrder() { localStorage.setItem(ORDER_KEY, JSON.stringify(order.value)) }
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
    order.value = [...ALL_IDS]
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

  // Tuiles visibles, dans l ordre choisi par l utilisateur.
  const visibleTiles = computed(() =>
    order.value
      .filter(id => !hidden.value.has(id))
      .map(id => TEACHER_TILES.find(t => t.id === id)!)
      .filter(Boolean),
  )

  function reorderTiles(newOrder: WidgetDef[]) {
    // Les tuiles deplacees (visibles) arrivent dans newOrder ; les masquees
    // conservent leur position relative dans order.value.
    const movedIds = newOrder.map(t => t.id)
    const hiddenIds = order.value.filter(id => hidden.value.has(id) && !movedIds.includes(id))
    order.value = [...movedIds, ...hiddenIds]
    persistOrder()
  }

  // ── Reorganisation intelligente ──────────────────────────────────────────
  // Priorites par categorie : les tuiles essentielles s ancrent en haut, la
  // detente descend en bas. Score utilise pour le tri initial.
  const CATEGORY_PRIORITY: Record<WidgetCategory, number> = {
    essential: 0,
    tracking: 1,
    communication: 2,
    productivity: 3,
    fun: 4,
  }
  const GRID_COLS = 4

  /**
   * Reorganise les tuiles visibles en minimisant les "trous" dans la grille
   * CSS 4 colonnes. Algo : tri par (categorie, taille decroissante) puis
   * bin-packing first-fit-decreasing ligne par ligne. Les grosses tuiles
   * ancrent visuellement le haut, les petites comblent les creux.
   */
  function smartReorganize() {
    const visibleIds = order.value.filter(id => !hidden.value.has(id))
    const hiddenIds = order.value.filter(id => hidden.value.has(id))

    type Scored = { id: string; cat: number; weight: number; colSpan: number }
    const scored: Scored[] = visibleIds.map(id => {
      const tile = TEACHER_TILES.find(t => t.id === id)!
      const { colSpan, rowSpan } = sizeToGridSpan(getWidgetSize(id))
      return {
        id,
        cat: CATEGORY_PRIORITY[tile.category] ?? 99,
        weight: colSpan * rowSpan,
        colSpan,
      }
    })
    // Tri : categorie croissante, puis taille decroissante.
    scored.sort((a, b) => a.cat - b.cat || b.weight - a.weight)

    // Bin-packing ligne par ligne : a chaque ligne on essaie de remplir
    // les 4 colonnes en prenant la plus grosse tuile qui tient.
    const placed: string[] = []
    const remaining = [...scored]
    while (remaining.length > 0) {
      let spaceLeft = GRID_COLS
      let placedThisRow = false
      for (let i = 0; i < remaining.length && spaceLeft > 0; ) {
        const w = remaining[i]
        if (w.colSpan <= spaceLeft) {
          placed.push(w.id)
          spaceLeft -= w.colSpan
          remaining.splice(i, 1)
          placedThisRow = true
        } else {
          i++
        }
      }
      // Securite : si aucune tuile ne tient (ne devrait jamais arriver avec
      // des tuiles <= 4 cols), on force la premiere pour avancer.
      if (!placedThisRow) placed.push(remaining.shift()!.id)
    }

    order.value = [...placed, ...hiddenIds]
    persistOrder()
  }

  // ── Back-compat (tests + code existant) ──────────────────────────────────
  /** @deprecated Utiliser visibleTiles — conserve pour compat. */
  const visibleOptionalTiles = visibleTiles
  /** @deprecated Utiliser reorderTiles — conserve pour compat. */
  const reorderOptional = reorderTiles
  /** @deprecated Plus necessaire : recompute via computed. */
  function refreshVisibleOptional() { /* no-op, visibleTiles est computed */ }

  return {
    hidden, isVisible, toggleTile, resetTiles,
    allTiles: TEACHER_TILES,
    visibleTiles, reorderTiles, smartReorganize,
    // Alias back-compat
    visibleOptionalTiles, reorderOptional, refreshVisibleOptional,
    getWidgetSize, setWidgetSize, sizes,
  }
}
