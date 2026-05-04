/**
 * Accueil devoirs prof — redesign v2.213 :
 *  - Section "A traiter" compacte en haut (action-first)
 *  - Timeline unique des prochaines echeances (tous types melanges, tri date)
 *  - Grille projets dense (cartes plus petites, plus d'info par pixel)
 *  - v2.214 : filtre focus (brouillons / a noter) + recherche projet + '/' raccourci
 */
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  BookOpen, Clock, PlusCircle, FolderOpen,
  FileText, Mic, Award, Check, AlertTriangle, Search, X, SearchX, Sparkles,
} from 'lucide-vue-next'
import { useAppStore }     from '@/stores/app'
import { useTravauxStore } from '@/stores/travaux'
import { useModalsStore }  from '@/stores/modals'
import { deadlineClass, deadlineLabel } from '@/utils/date'
import { typeLabel, isRattrapage } from '@/utils/devoir'
import { useSlashFocusSearch } from '@/composables/useSlashFocusSearch'
import DevoirsProjectCard from './DevoirsProjectCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { GanttRow } from '@/types'

const props = defineProps<{
  teacherCategories: string[]
  globalDrafts: number
  globalToGrade: number
  globalSubmission: { expected: number; submitted: number; pct: number }
  upcomingDevoirs: GanttRow[]
  projectDevoirCount: (cat: string) => number
  projectNextDeadline: (cat: string) => string | null
  projectTypeCounts: (cat: string) => { type: string; count: number }[]
  projectStats: (cat: string) => { totalDepots: number; totalExpected: number; pct: number; noted: number; toGrade: number; drafts: number }
  openDevoir: (id: number) => void
  openCtxMenu: (e: MouseEvent, d: GanttRow) => void
}>()

const appStore     = useAppStore()
const travauxStore = useTravauxStore()
const modals       = useModalsStore()

const hasDevoirsAtAll     = computed(() => travauxStore.ganttData.length > 0)
const hasPublishedDevoirs = computed(() => travauxStore.ganttData.some(t => t.is_published))

/** Cache pour eviter de recalculer projectStats() a chaque acces dans le template. */
const cachedProjectStats = computed(() => {
  const map: Record<string, ReturnType<typeof props.projectStats>> = {}
  for (const cat of props.teacherCategories) map[cat] = props.projectStats(cat)
  return map
})

// ── Recherche projet + raccourci '/' ─────────────────────────────────────────
const searchQuery = ref('')
useSlashFocusSearch('.dh-search-input')

// ── Filtre focus : rien / seulement brouillons / seulement a noter ───────────
// Cliquer sur le pill "5 brouillons" ne doit pas juste scroller : il doit
// reduire la grille aux projets concernes. Un clic repete = reset.
type FocusFilter = 'all' | 'drafts' | 'toGrade'
const focusFilter = ref<FocusFilter>('all')

function toggleFocus(target: Exclude<FocusFilter, 'all'>) {
  focusFilter.value = focusFilter.value === target ? 'all' : target
  // Scroll doux vers la grille pour materialiser le filtrage
  requestAnimationFrame(() => {
    document.querySelector('.dh-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}
function resetFocus() { focusFilter.value = 'all'; searchQuery.value = '' }

/**
 * Set des categories dont au moins un devoir matche la recherche par titre.
 * Pre-calcule pour que `displayedCategories` reste O(n) et que la liste
 * "Devoirs trouves" partage la meme source de verite.
 */
const matchingDevoirs = computed<GanttRow[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return travauxStore.ganttData
    .filter(t => t.title.toLowerCase().includes(q))
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
})

const categoriesWithMatchingDevoir = computed<Set<string>>(() => {
  const set = new Set<string>()
  for (const t of matchingDevoirs.value) {
    const cat = t.category?.trim()
    if (cat) set.add(cat)
  }
  return set
})

const displayedCategories = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return props.teacherCategories.filter(cat => {
    if (q) {
      // Un projet apparait s'il matche par nom OU s'il contient au moins un
      // devoir qui matche par titre — indispensable pour retrouver un devoir
      // precis sans se souvenir de sa categorie.
      const catMatches = cat.toLowerCase().includes(q)
      const hasDevoirMatch = categoriesWithMatchingDevoir.value.has(cat)
      if (!catMatches && !hasDevoirMatch) return false
    }
    const st = cachedProjectStats.value[cat]
    if (focusFilter.value === 'drafts' && (!st || st.drafts <= 0)) return false
    if (focusFilter.value === 'toGrade' && (!st || st.toGrade <= 0)) return false
    return true
  })
})

/** Top N devoirs matches pour la liste dediee (cliquable direct). */
const matchingDevoirsTop = computed(() => matchingDevoirs.value.slice(0, 10))

const focusLabel = computed(() => {
  if (focusFilter.value === 'drafts') return 'Projets avec brouillons'
  if (focusFilter.value === 'toGrade') return 'Projets avec rendus à noter'
  return ''
})

// ── Timeline unifiee : tous types melanges, tri par date, max 8 items ──
// Avant : 3 cartes cote-a-cote par type (CCTL / Livrables / Soutenances), avec
// colonnes vides quand un type etait absent. Maintenant : une liste dense triee
// par echeance pour scanner tout en un coup d'oeil.
const now = Date.now()
interface UpcomingItem extends GanttRow { iconKey: 'exam' | 'livrable' | 'soutenance' }
const upcoming = computed<UpcomingItem[]>(() => {
  return travauxStore.ganttData
    .filter(t =>
      t.is_published
      && new Date(t.deadline).getTime() > now
      && !isRattrapage(t),
    )
    .map(t => {
      const iconKey: UpcomingItem['iconKey'] =
        t.type === 'soutenance' ? 'soutenance'
          : t.type === 'livrable' ? 'livrable'
            : 'exam'
      return { ...t, iconKey }
    })
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 8)
})

function iconForType(key: 'exam' | 'livrable' | 'soutenance') {
  if (key === 'soutenance') return Mic
  if (key === 'livrable') return FileText
  return Award
}

/**
 * Mappage type devoir -> cle iconKey pour reutiliser la meme palette visuelle
 * entre la timeline "Prochaines echeances" et la liste "Devoirs trouves".
 * Ainsi les matches CCTL/livrable/soutenance portent immediatement la bonne
 * couleur sans que l'utilisateur ait a lire le badge type.
 */
function iconKeyFor(d: GanttRow): 'exam' | 'livrable' | 'soutenance' {
  if (d.type === 'soutenance') return 'soutenance'
  if (d.type === 'livrable') return 'livrable'
  return 'exam'
}

/**
 * Decoupe un texte en segments (match / non-match) pour surligner la portion
 * cherchee. Utilise par "Devoirs trouves" afin de rendre evident pourquoi un
 * resultat apparait. Case-insensitive, preserve la casse d'origine.
 */
interface Segment { text: string; match: boolean }
function highlightSegments(text: string): Segment[] {
  const q = searchQuery.value.trim()
  if (!q) return [{ text, match: false }]
  const lower = text.toLowerCase()
  const qLower = q.toLowerCase()
  const segs: Segment[] = []
  let i = 0
  while (i < text.length) {
    const idx = lower.indexOf(qLower, i)
    if (idx === -1) { segs.push({ text: text.slice(i), match: false }); break }
    if (idx > i) segs.push({ text: text.slice(i, idx), match: false })
    segs.push({ text: text.slice(idx, idx + q.length), match: true })
    i = idx + q.length
  }
  return segs
}

// ── Etat "A traiter" : indicateur action-first ──
// Si 0 brouillon + 0 a noter + pas d'echeance proche, on affiche "Tout est a jour".
const nothingToDo = computed(() =>
  props.globalToGrade === 0 && props.globalDrafts === 0,
)
</script>

<template>
  <div v-if="travauxStore.loading" class="dh-loading">
    <div v-for="i in 4" :key="i" class="skel skel-line" style="height:100px;margin-bottom:10px;border-radius:10px" />
  </div>

  <EmptyState
    v-else-if="!teacherCategories.length"
    size="lg"
    :icon="BookOpen"
    :title="!hasDevoirsAtAll
      ? 'Aucun devoir pour cette promotion'
      : !hasPublishedDevoirs
        ? 'Aucun projet publié'
        : 'Aucun projet pour cette promotion'"
    :subtitle="!hasDevoirsAtAll
      ? 'Créez votre premier devoir pour commencer à organiser vos projets.'
      : !hasPublishedDevoirs
        ? 'Vos devoirs existent en brouillon. Publiez-les et associez-leur une catégorie pour les organiser.'
        : 'Les projets apparaîtront automatiquement quand vous créerez un devoir avec une catégorie.'"
  >
    <button class="btn-cta" @click="modals.newDevoir = true">
      <PlusCircle :size="14" /> Créer un devoir
    </button>
  </EmptyState>

  <template v-else>
    <div class="dv-page">

      <!-- ── A TRAITER : bandeau action-first (pills + stat + recherche) ─── -->
      <div class="dh-toolbar">
        <div class="dh-toolbar-left">
          <span class="dh-toolbar-label">À traiter</span>
          <template v-if="nothingToDo">
            <span class="dh-chip dh-chip--ok"><Check :size="12" /> Tout est à jour</span>
          </template>
          <template v-else>
            <button
              v-if="globalToGrade > 0"
              type="button"
              class="dh-chip dh-chip--warn"
              :class="{ 'is-active': focusFilter === 'toGrade' }"
              :aria-pressed="focusFilter === 'toGrade'"
              title="Filtrer : projets avec des rendus à noter"
              @click="toggleFocus('toGrade')"
            >
              <AlertTriangle :size="12" />
              <strong>{{ globalToGrade }}</strong>
              <span>{{ globalToGrade > 1 ? 'rendus à noter' : 'rendu à noter' }}</span>
            </button>
            <button
              v-if="globalDrafts > 0"
              type="button"
              class="dh-chip dh-chip--draft"
              :class="{ 'is-active': focusFilter === 'drafts' }"
              :aria-pressed="focusFilter === 'drafts'"
              title="Filtrer : projets contenant des brouillons"
              @click="toggleFocus('drafts')"
            >
              <FileText :size="12" />
              <strong>{{ globalDrafts }}</strong>
              <span>{{ globalDrafts > 1 ? 'brouillons' : 'brouillon' }}</span>
            </button>
          </template>
          <span v-if="globalSubmission.expected > 0" class="dh-toolbar-stat" title="Rendus attendus toutes promos confondues">
            <span class="dh-toolbar-stat-num">{{ globalSubmission.submitted }}<span class="dh-toolbar-stat-sep">/</span>{{ globalSubmission.expected }}</span>
            <span class="dh-toolbar-stat-label">rendus</span>
            <span class="dh-toolbar-stat-pct">{{ globalSubmission.pct }}%</span>
          </span>
        </div>

        <!-- Recherche projet ou devoir (raccourci '/' pour focus) -->
        <div class="dh-search" :class="{ 'is-filled': !!searchQuery }">
          <Search :size="13" class="dh-search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            class="dh-search-input"
            placeholder="Rechercher un projet ou un devoir…"
            aria-label="Rechercher un projet ou un devoir"
          />
          <kbd v-if="!searchQuery" class="dh-search-kbd" aria-hidden="true">/</kbd>
          <button
            v-else
            type="button"
            class="dh-search-clear"
            aria-label="Effacer la recherche"
            @click="searchQuery = ''"
          >
            <X :size="12" />
          </button>
        </div>
      </div>

      <!-- ── Devoirs trouves par la recherche (cliquable direct) ─────── -->
      <!-- Remplace visuellement la timeline quand une recherche est active :
           l'utilisateur qui cherche un devoir precis veut y sauter sans passer
           par la grille projets. -->
      <div v-if="searchQuery && matchingDevoirsTop.length" class="dh-next-section dh-next-section--results">
        <div class="dh-section-head">
          <h4 class="dv-section-title">
            <Sparkles :size="14" class="dh-section-title-icon" /> Devoirs trouvés
            <span class="dv-section-count">{{ matchingDevoirs.length }}</span>
            <span v-if="matchingDevoirs.length > matchingDevoirsTop.length" class="dh-section-more">
              10 premiers affichés
            </span>
          </h4>
        </div>
        <ul class="dh-timeline">
          <li
            v-for="d in matchingDevoirsTop" :key="d.id"
            class="dh-timeline-item"
            :class="[
              `dh-timeline-item--${iconKeyFor(d)}`,
              { 'dh-timeline-item--draft': !d.is_published },
            ]"
            :title="d.title"
            @click="openDevoir(d.id)"
            @contextmenu="openCtxMenu($event, d)"
          >
            <component :is="iconForType(iconKeyFor(d))" :size="14" class="dh-timeline-icon" :class="`dh-timeline-icon--${iconKeyFor(d)}`" />
            <span class="dh-timeline-title">
              <template v-for="(seg, idx) in highlightSegments(d.title)" :key="idx">
                <mark v-if="seg.match" class="dh-hl">{{ seg.text }}</mark>
                <template v-else>{{ seg.text }}</template>
              </template>
            </span>
            <span class="dh-timeline-type">{{ typeLabel(d.type) }}</span>
            <span v-if="d.category" class="dh-timeline-proj">{{ d.category }}</span>
            <span v-if="!d.is_published" class="dh-timeline-draft-tag">Brouillon</span>
            <span v-else class="deadline-badge" :class="deadlineClass(d.deadline)">{{ deadlineLabel(d.deadline) }}</span>
          </li>
        </ul>
      </div>

      <!-- ── Timeline unique des prochaines echeances ──────────────── -->
      <div v-else-if="upcoming.length && focusFilter === 'all'" class="dh-next-section">
        <div class="dh-section-head">
          <h4 class="dv-section-title"><Clock :size="14" class="dh-section-title-icon" /> Prochaines échéances</h4>
        </div>
        <ul class="dh-timeline">
          <li
            v-for="d in upcoming" :key="d.id"
            class="dh-timeline-item"
            :class="`dh-timeline-item--${d.iconKey}`"
            :title="d.title"
            @click="openDevoir(d.id)"
            @contextmenu="openCtxMenu($event, d)"
          >
            <component :is="iconForType(d.iconKey)" :size="14" class="dh-timeline-icon" :class="`dh-timeline-icon--${d.iconKey}`" />
            <span class="dh-timeline-title">{{ d.title }}</span>
            <span class="dh-timeline-type">{{ typeLabel(d.type) }}</span>
            <span v-if="d.category" class="dh-timeline-proj">{{ d.category }}</span>
            <span class="deadline-badge" :class="deadlineClass(d.deadline)">{{ deadlineLabel(d.deadline) }}</span>
          </li>
        </ul>
      </div>

      <!-- ── Projets : grille dense ─────────────────────────────────── -->
      <div class="dh-section">
        <div class="dh-section-head">
          <h4 class="dv-section-title">
            <FolderOpen :size="14" class="dh-section-title-icon" /> Projets
            <span class="dv-section-count">
              {{ displayedCategories.length }}<span v-if="displayedCategories.length !== teacherCategories.length" class="dv-section-count-total">/{{ teacherCategories.length }}</span>
            </span>
          </h4>
          <button
            v-if="focusFilter !== 'all' || searchQuery"
            type="button"
            class="dh-filter-chip"
            :title="focusLabel || 'Filtre actif'"
            @click="resetFocus"
          >
            <span class="dh-filter-chip-label">
              <span v-if="focusLabel">{{ focusLabel }}</span>
              <span v-else>Recherche : <em>« {{ searchQuery }} »</em></span>
            </span>
            <X :size="12" class="dh-filter-chip-x" />
          </button>
        </div>

        <div v-if="!displayedCategories.length" class="dh-empty-filter">
          <SearchX :size="28" class="dh-empty-filter-icon" />
          <p class="dh-empty-filter-title">Aucun projet ne correspond</p>
          <p class="dh-empty-filter-hint">
            <template v-if="searchQuery">Aucun projet ni devoir ne contient « <strong>{{ searchQuery }}</strong> ».</template>
            <template v-else>Aucun projet ne correspond au filtre sélectionné.</template>
          </p>
          <button class="dh-empty-filter-btn" @click="resetFocus">
            <X :size="12" /> Réinitialiser
          </button>
        </div>

        <div v-else class="dv-proj-grid">
          <DevoirsProjectCard
            v-for="cat in displayedCategories" :key="cat"
            :name="cat"
            :type-counts="projectTypeCounts(cat)"
            :submitted="cachedProjectStats[cat].totalDepots"
            :total="cachedProjectStats[cat].totalExpected"
            :pct="cachedProjectStats[cat].pct"
            :to-grade="cachedProjectStats[cat].toGrade"
            :drafts="cachedProjectStats[cat].drafts"
            :devoir-count="projectDevoirCount(cat)"
            :next-deadline="projectNextDeadline(cat)"
            @click="appStore.activeProject = cat"
          />
        </div>
      </div>

    </div>
  </template>
</template>

<style scoped>
/* ══════════════════════════════════════════════════════════════════════════
   Bandeau "À traiter" : card compacte regroupant pills + stat + recherche
   ══════════════════════════════════════════════════════════════════════════ */
.dh-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 14px;
  margin-bottom: 18px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  flex-wrap: wrap;
}
.dh-toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}
.dh-toolbar-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 3px 8px;
  background: var(--bg-hover);
  border-radius: var(--radius-xs);
}

/* ── Chips actionnables (a traiter) ─────────────────────────────────────── */
.dh-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  background: var(--bg-main);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background var(--t-fast),
    border-color var(--t-fast),
    color var(--t-fast),
    box-shadow var(--t-fast),
    transform var(--t-fast);
}
.dh-chip strong {
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.dh-chip:hover {
  background: var(--bg-hover);
  border-color: var(--border-input);
  transform: translateY(-1px);
}
.dh-chip:active { transform: translateY(0); }

.dh-chip--ok {
  color: var(--color-success);
  border-color: rgba(var(--color-success-rgb), .3);
  background: rgba(var(--color-success-rgb), .06);
  cursor: default;
}
.dh-chip--ok:hover { transform: none; }

.dh-chip--warn {
  color: var(--color-warning);
  border-color: rgba(var(--color-warning-rgb), .25);
}
.dh-chip--warn strong { color: var(--color-warning); }
.dh-chip--warn:hover { background: rgba(var(--color-warning-rgb), .08); }

.dh-chip--draft { color: var(--text-muted); }
.dh-chip--draft strong { color: var(--text-secondary); }

/* Etat actif : la chip cliquee est visuellement appuyee */
.dh-chip.is-active {
  border-color: currentColor;
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .1);
}
.dh-chip--warn.is-active {
  background: rgba(var(--color-warning-rgb), .12);
  color: var(--color-warning);
  box-shadow: 0 0 0 3px rgba(var(--color-warning-rgb), .14);
}
.dh-chip--draft.is-active {
  background: var(--bg-hover);
  color: var(--text-secondary);
  box-shadow: 0 0 0 3px rgba(127, 127, 127, .12);
}

/* ── Stat globale (soumis / attendu) ────────────────────────────────────── */
.dh-toolbar-stat {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  padding-left: 6px;
  font-size: 12px;
  color: var(--text-muted);
  border-left: 1px solid var(--border);
  padding: 2px 0 2px 12px;
}
.dh-toolbar-stat-num {
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  font-size: 13px;
}
.dh-toolbar-stat-sep { color: var(--text-muted); font-weight: 500; margin: 0 1px; }
.dh-toolbar-stat-label { font-size: 11px; color: var(--text-muted); }
.dh-toolbar-stat-pct {
  margin-left: 4px;
  font-size: 10.5px; font-weight: 700;
  padding: 1px 6px; border-radius: var(--radius-sm);
  background: rgba(var(--accent-rgb), .12);
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

/* ── Champ de recherche ─────────────────────────────────────────────────── */
.dh-search {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.dh-search-icon {
  position: absolute;
  left: 9px;
  color: var(--text-muted);
  pointer-events: none;
  transition: color var(--t-fast);
}
.dh-search.is-filled .dh-search-icon,
.dh-search:focus-within .dh-search-icon { color: var(--accent); }

.dh-search-input {
  font-family: inherit;
  font-size: 12.5px;
  padding: 6px 30px 6px 28px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  width: 220px;
  transition: border-color var(--t-fast), width var(--t-fast), box-shadow var(--t-fast), background var(--t-fast);
}
.dh-search-input::placeholder { color: var(--text-muted); }
.dh-search-input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--bg-elevated);
  width: 280px;
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .12);
}
.dh-search.is-filled .dh-search-input { border-color: rgba(var(--accent-rgb), .5); }

.dh-search-kbd {
  position: absolute;
  right: 8px;
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  background: var(--bg-main);
  border: 1px solid var(--border);
  color: var(--text-muted);
  pointer-events: none;
}
.dh-search-clear {
  position: absolute;
  right: 5px;
  background: var(--bg-hover);
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 3px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: background var(--t-fast), color var(--t-fast);
}
.dh-search-clear:hover { background: var(--color-danger); color: #fff; }

/* ══════════════════════════════════════════════════════════════════════════
   Sections (Devoirs trouves / Prochaines echeances / Projets)
   ══════════════════════════════════════════════════════════════════════════ */
.dh-next-section { margin-bottom: 20px; }

/* Animation d'entree de la section "Devoirs trouves" : glisse douce vers bas
   pour marquer que la recherche a produit des resultats. */
.dh-next-section--results {
  animation: dh-fade-slide .22s var(--ease-out);
}
@keyframes dh-fade-slide {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.dh-section { margin-bottom: 4px; }

/* Header commun des sections : titre a gauche, actions a droite */
.dh-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.dh-section-title-icon {
  color: var(--accent);
  opacity: .8;
}
.dh-section-more {
  font-size: 10.5px;
  color: var(--text-muted);
  font-weight: 500;
  padding-left: 4px;
  font-style: italic;
}

.dv-section-count {
  display: inline-flex;
  align-items: baseline;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  background: rgba(var(--accent-rgb), .12);
  padding: 1px 8px;
  border-radius: var(--radius);
  margin-left: 6px;
  font-variant-numeric: tabular-nums;
}
.dv-section-count-total {
  font-weight: 500;
  color: var(--text-muted);
  margin-left: 1px;
}

/* ── Timeline : carte contenant les items ────────────────────────────────── */
.dh-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--bg-elevated);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .04);
}
.dh-timeline-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px 9px 18px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background var(--t-fast), padding var(--t-fast);
}
.dh-timeline-item:last-child { border-bottom: none; }
.dh-timeline-item:hover { background: var(--bg-hover); padding-left: 22px; }

/* Barre latérale colorée selon le type — scan rapide du type a l'oeil */
.dh-timeline-item::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: var(--border);
  transition: background var(--t-fast);
}
.dh-timeline-item--exam::before       { background: var(--color-cctl, #9b87f5); }
.dh-timeline-item--livrable::before   { background: var(--accent); }
.dh-timeline-item--soutenance::before { background: var(--color-warning); }

.dh-timeline-icon { flex-shrink: 0; }
.dh-timeline-icon--exam       { color: var(--color-cctl, #9b87f5); }
.dh-timeline-icon--livrable   { color: var(--accent); }
.dh-timeline-icon--soutenance { color: var(--color-warning); }

.dh-timeline-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Surlignage des segments matches dans la recherche */
.dh-hl {
  background: rgba(var(--accent-rgb), .22);
  color: var(--accent);
  font-weight: 700;
  padding: 1px 2px;
  border-radius: 3px;
}

.dh-timeline-type {
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
  font-weight: 700;
  padding: 2px 7px;
  border-radius: var(--radius-xs);
  background: var(--bg-main);
  border: 1px solid var(--border);
  flex-shrink: 0;
}
.dh-timeline-proj {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
  flex-shrink: 0;
  font-style: italic;
}

/* Brouillon : hachure subtile + tag dedie au lieu de deadline */
.dh-timeline-item--draft {
  background:
    repeating-linear-gradient(
      135deg,
      rgba(127, 127, 127, .03) 0 6px,
      transparent 6px 12px
    );
}
.dh-timeline-item--draft .dh-timeline-title { color: var(--text-secondary); }
.dh-timeline-draft-tag {
  font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px;
  padding: 2px 8px; border-radius: var(--radius);
  background: var(--bg-main); color: var(--text-muted);
  border: 1px dashed var(--border-input);
  flex-shrink: 0;
}

/* ══════════════════════════════════════════════════════════════════════════
   Chip "Filtre actif" et empty state filtre
   ══════════════════════════════════════════════════════════════════════════ */
.dh-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px 4px 12px;
  border-radius: 999px;
  background: rgba(var(--accent-rgb), .1);
  color: var(--accent);
  border: 1px solid rgba(var(--accent-rgb), .3);
  cursor: pointer;
  font-family: inherit;
  font-size: 11.5px;
  font-weight: 600;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.dh-filter-chip:hover {
  background: rgba(var(--accent-rgb), .2);
  border-color: rgba(var(--accent-rgb), .5);
}
.dh-filter-chip-label { line-height: 1.2; }
.dh-filter-chip-label em { font-style: normal; font-weight: 700; color: var(--text-primary); }
.dh-filter-chip-x {
  background: rgba(var(--accent-rgb), .15);
  border-radius: 50%;
  padding: 2px;
  color: var(--accent);
  transition: background var(--t-fast);
  width: 18px; height: 18px;
}
.dh-filter-chip:hover .dh-filter-chip-x {
  background: var(--accent);
  color: #fff;
}

.dh-empty-filter {
  text-align: center;
  padding: 40px 20px;
  border: 1px dashed var(--border-input);
  border-radius: var(--radius);
  background: var(--bg-elevated);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.dh-empty-filter-icon {
  color: var(--text-muted);
  opacity: .4;
  margin-bottom: 8px;
}
.dh-empty-filter-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.dh-empty-filter-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  max-width: 360px;
  line-height: 1.4;
}
.dh-empty-filter-hint strong { color: var(--text-primary); font-weight: 700; }
.dh-empty-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 10px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  background: var(--bg-main);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast);
}
.dh-empty-filter-btn:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
  color: var(--accent);
}

/* ── Grille projets ──────────────────────────────────────────────────────── */
.dv-proj-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.dh-loading { padding: 24px 28px; }

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 720px) {
  .dh-toolbar { padding: 10px; gap: 10px; }
  .dh-search-input, .dh-search-input:focus { width: 100%; }
  .dh-search { flex: 1; min-width: 180px; }
}
@media (max-width: 600px) {
  .dh-timeline-type, .dh-timeline-proj { display: none; }
  .dh-toolbar { flex-direction: column; align-items: stretch; }
  .dh-toolbar-left { justify-content: flex-start; }
  .dh-search, .dh-search-input, .dh-search-input:focus { width: 100%; }
  .dh-toolbar-stat { border-left: none; padding-left: 0; }
}
</style>
