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
  FileText, Mic, Award, Check, AlertTriangle, Search, X,
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
    <button class="btn-primary" @click="modals.newDevoir = true">
      <PlusCircle :size="14" /> Créer un devoir
    </button>
  </EmptyState>

  <template v-else>
    <div class="dv-page">

      <!-- ── A TRAITER : section action-first en haut ──────────────── -->
      <div class="dh-todo">
        <span class="dh-todo-label">À traiter</span>
        <template v-if="nothingToDo">
          <span class="dh-todo-ok"><Check :size="12" /> Tout est à jour</span>
        </template>
        <template v-else>
          <button
            v-if="globalToGrade > 0"
            type="button"
            class="dh-todo-item dh-todo-item--warn"
            :class="{ 'is-active': focusFilter === 'toGrade' }"
            :aria-pressed="focusFilter === 'toGrade'"
            title="Filtrer : projets avec des rendus à noter"
            @click="toggleFocus('toGrade')"
          >
            <AlertTriangle :size="12" />
            <strong>{{ globalToGrade }}</strong> {{ globalToGrade > 1 ? 'rendus à noter' : 'rendu à noter' }}
          </button>
          <button
            v-if="globalDrafts > 0"
            type="button"
            class="dh-todo-item dh-todo-item--draft"
            :class="{ 'is-active': focusFilter === 'drafts' }"
            :aria-pressed="focusFilter === 'drafts'"
            title="Filtrer : projets contenant des brouillons"
            @click="toggleFocus('drafts')"
          >
            <FileText :size="12" />
            <strong>{{ globalDrafts }}</strong> {{ globalDrafts > 1 ? 'brouillons' : 'brouillon' }}
          </button>
        </template>
        <span v-if="globalSubmission.expected > 0" class="dh-todo-stat" title="Rendus attendus toutes promos confondues">
          {{ globalSubmission.submitted }}/{{ globalSubmission.expected }} rendus
          <span class="dh-todo-stat-pct">· {{ globalSubmission.pct }}%</span>
        </span>

        <!-- Recherche projet (raccourci '/' pour focus) -->
        <div class="dh-search">
          <Search :size="12" class="dh-search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            class="dh-search-input"
            placeholder="Rechercher un projet…"
            aria-label="Rechercher un projet"
          />
          <kbd v-if="!searchQuery" class="dh-search-kbd" aria-hidden="true">/</kbd>
          <button
            v-else
            type="button"
            class="dh-search-clear"
            aria-label="Effacer la recherche"
            @click="searchQuery = ''"
          >
            <X :size="11" />
          </button>
        </div>
      </div>

      <!-- ── Devoirs trouves par la recherche (cliquable direct) ─────── -->
      <!-- Remplace visuellement la timeline quand une recherche est active :
           l'utilisateur qui cherche un devoir precis veut y sauter sans passer
           par la grille projets. -->
      <div v-if="searchQuery && matchingDevoirsTop.length" class="dh-next-section">
        <h4 class="dv-section-title">
          <Search :size="14" /> Devoirs trouvés
          <span class="dv-section-count">{{ matchingDevoirs.length }}<span v-if="matchingDevoirs.length > matchingDevoirsTop.length"> (10 affichés)</span></span>
        </h4>
        <ul class="dh-timeline">
          <li
            v-for="d in matchingDevoirsTop" :key="d.id"
            class="dh-timeline-item"
            :class="{ 'dh-timeline-item--draft': !d.is_published }"
            :title="d.title"
            @click="openDevoir(d.id)"
            @contextmenu="openCtxMenu($event, d)"
          >
            <FileText :size="14" class="dh-timeline-icon" />
            <span class="dh-timeline-title">{{ d.title }}</span>
            <span class="dh-timeline-type">{{ typeLabel(d.type) }}</span>
            <span v-if="d.category" class="dh-timeline-proj">{{ d.category }}</span>
            <span v-if="!d.is_published" class="dh-timeline-draft-tag">Brouillon</span>
            <span v-else class="deadline-badge" :class="deadlineClass(d.deadline)">{{ deadlineLabel(d.deadline) }}</span>
          </li>
        </ul>
      </div>

      <!-- ── Timeline unique des prochaines echeances ──────────────── -->
      <div v-else-if="upcoming.length && focusFilter === 'all'" class="dh-next-section">
        <h4 class="dv-section-title"><Clock :size="14" /> Prochaines échéances</h4>
        <ul class="dh-timeline">
          <li
            v-for="d in upcoming" :key="d.id"
            class="dh-timeline-item"
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
        <div class="dh-section-bar">
          <h4 class="dv-section-title">
            <FolderOpen :size="14" /> Projets
            <span class="dv-section-count">{{ displayedCategories.length }}<span v-if="displayedCategories.length !== teacherCategories.length">/{{ teacherCategories.length }}</span></span>
          </h4>
          <button
            v-if="focusFilter !== 'all' || searchQuery"
            type="button"
            class="dh-filter-chip"
            :title="focusLabel || 'Filtre actif'"
            @click="resetFocus"
          >
            <span v-if="focusLabel">Filtre : {{ focusLabel }}</span>
            <span v-else>Recherche : « {{ searchQuery }} »</span>
            <X :size="11" />
          </button>
        </div>

        <div v-if="!displayedCategories.length" class="dh-empty-filter">
          <p>Aucun projet ne correspond à ce filtre.</p>
          <button class="dh-empty-filter-btn" @click="resetFocus">Réinitialiser</button>
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
/* ── Section "A traiter" : ribbon compact en haut ──────────────────────── */
.dh-todo {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 0 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}
.dh-todo-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding-right: 4px;
}
.dh-todo-ok {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--color-success);
  font-weight: 500;
}
.dh-todo-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  font-family: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast), color var(--t-fast);
}
.dh-todo-item strong { font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.dh-todo-item:hover { background: var(--bg-hover); border-color: var(--border-input); }
.dh-todo-item--warn { color: var(--color-warning); }
.dh-todo-item--warn strong { color: var(--color-warning); }
.dh-todo-item--draft { color: var(--text-muted); }

/* Etat actif : le pill clique reste marque visuellement */
.dh-todo-item.is-active {
  background: var(--bg-hover);
  border-color: currentColor;
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb), .08);
}
.dh-todo-item--warn.is-active {
  background: rgba(var(--color-warning-rgb), .1);
  border-color: var(--color-warning);
}
.dh-todo-item--draft.is-active {
  background: var(--bg-hover);
  border-color: var(--text-secondary);
  color: var(--text-secondary);
}

/* Stat globale (soumis/attendu) */
.dh-todo-stat {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.dh-todo-stat-pct { color: var(--text-secondary); font-weight: 600; }

/* Recherche : pousse a droite grace a margin-left:auto */
.dh-search {
  margin-left: auto;
  position: relative;
  display: flex;
  align-items: center;
}
.dh-search-icon {
  position: absolute;
  left: 8px;
  color: var(--text-muted);
  pointer-events: none;
}
.dh-search-input {
  font-family: inherit;
  font-size: 12px;
  padding: 4px 26px 4px 26px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  width: 180px;
  transition: border-color var(--t-fast), width var(--t-fast);
}
.dh-search-input:focus {
  outline: none;
  border-color: var(--accent);
  width: 220px;
}
.dh-search-kbd {
  position: absolute;
  right: 6px;
  font-family: inherit;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--bg-hover);
  border: 1px solid var(--border);
  color: var(--text-muted);
  pointer-events: none;
}
.dh-search-clear {
  position: absolute;
  right: 4px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.dh-search-clear:hover { background: var(--bg-hover); color: var(--text-primary); }

/* ── Timeline unique des echeances ─────────────────────────────────────── */
.dh-next-section { margin-bottom: 20px; }

.dh-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-elevated);
}
.dh-timeline-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background var(--t-fast);
}
.dh-timeline-item:last-child { border-bottom: none; }
.dh-timeline-item:hover { background: var(--bg-hover); }

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
.dh-timeline-type {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--text-muted);
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--bg-hover);
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
}

/* Brouillon dans la liste des devoirs trouves : visuel aligne avec les cartes
   brouillons (hachure subtile + tag "Brouillon" au lieu de la deadline). */
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
  padding: 2px 7px; border-radius: 3px;
  background: var(--bg-active); color: var(--text-secondary);
  border: 1px dashed var(--border-input);
  flex-shrink: 0;
}

/* ── Section projets ───────────────────────────────────────────────────── */
.dh-section { margin-bottom: 4px; }
.dh-section-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.dv-section-count {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: 8px;
  margin-left: 4px;
}

/* Chip filtre actif : rappel permanent + bouton close */
.dh-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px 3px 10px;
  border-radius: 12px;
  background: rgba(var(--accent-rgb), .1);
  color: var(--accent);
  border: 1px solid rgba(var(--accent-rgb), .3);
  cursor: pointer;
  font-family: inherit;
  transition: background var(--t-fast);
}
.dh-filter-chip:hover { background: rgba(var(--accent-rgb), .18); }

.dh-empty-filter {
  text-align: center;
  padding: 24px 12px;
  border: 1px dashed var(--border-input);
  border-radius: 8px;
  color: var(--text-muted);
}
.dh-empty-filter p { font-size: 13px; margin: 0 0 10px; }
.dh-empty-filter-btn {
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 14px;
  border-radius: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--t-fast);
}
.dh-empty-filter-btn:hover { background: var(--bg-hover); border-color: var(--accent); color: var(--accent); }

/* Grille plus dense par defaut (220px min au lieu de 260px) */
.dv-proj-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.dh-loading { padding: 24px 28px; }

@media (max-width: 600px) {
  .dh-timeline-type, .dh-timeline-proj { display: none; }
  .dh-search { width: 100%; margin-left: 0; }
  .dh-search-input { width: 100%; }
  .dh-search-input:focus { width: 100%; }
}
</style>
