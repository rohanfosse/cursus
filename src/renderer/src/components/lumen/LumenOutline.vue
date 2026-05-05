<script setup lang="ts">
/**
 * Plan du chapitre — refonte v2.287.
 *
 * Pack 1 : tree lines modernes via CSS pseudo-elements (vertical guides +
 * curved connectors), numerotation hierarchique automatique, indicateur
 * de progression de lecture, empty state contextualise prof/etudiant,
 * header rafraichi avec compteur.
 *
 * Pack 2 : recherche dans le plan (input filter live), badges annotations
 * (count par section).
 *
 * Pack 3 : mini-map verticale quand replie (rail 36px avec dots cliquables
 * + curseur position de scroll), poignee de redimensionnement (drag pour
 * ajuster 200-400px), mode "reading focus" (grise les sections inactives).
 */
import { computed, ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ListTree, ChevronDown, ChevronRight, Copy, CornerDownRight, Search, Eye, EyeOff, Hash, MessageSquare, X } from 'lucide-vue-next'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'
import { useContextMenu } from '@/composables/useContextMenu'
import { useToast } from '@/composables/useToast'
import type { HeadingEntry } from '@/composables/useChapterOutline'

interface Props {
  headings: HeadingEntry[]
  collapsed?: boolean
  activeHeadingId?: string | null
  /** Set d'ids du heading actif + ses ancetres — pour l'allumage du chemin actif. */
  activePath?: Set<string>
  /** Largeur courante en pixels (deplie). v-model conseille. */
  width?: number
  /** Affiche les numeros 1.1, 1.2 etc. devant les titres. */
  numbered?: boolean
  /** Mode reading focus : grise les sections inactives. */
  readingFocus?: boolean
  /** Pourcentage 0..1 de scroll dans le chapitre — pour la mini-rail repliee. */
  readingProgress?: number
  /** True si l'utilisateur courant peut editer le chapitre (prof). Empty state contextuel. */
  isTeacher?: boolean
  /** Map heading id -> count d'annotations dans cette section. v2.287. */
  annotationCounts?: Map<string, number>
  /** Bornes pour le drag-resize. */
  minWidth?: number
  maxWidth?: number
}

interface Emits {
  (e: 'navigate', id: string): void
  (e: 'toggle'): void
  (e: 'update:width', px: number): void
  (e: 'update:numbered', value: boolean): void
  (e: 'update:readingFocus', value: boolean): void
}

const props = withDefaults(defineProps<Props>(), {
  collapsed: false,
  activeHeadingId: null,
  activePath: () => new Set(),
  width: 240,
  numbered: true,
  readingFocus: false,
  readingProgress: 0,
  isTeacher: false,
  annotationCounts: () => new Map(),
  minWidth: 200,
  maxWidth: 400,
})
const emit = defineEmits<Emits>()

const { showToast } = useToast()

// ── Recherche dans le plan ─────────────────────────────────────────────
// Filter live insensible a la casse + accents. Reset a la fermeture du
// panneau ou a la fin du focus.
const searchOpen = ref(false)
const searchQuery = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const filteredHeadings = computed<HeadingEntry[]>(() => {
  const q = normalize(searchQuery.value.trim())
  if (!q) return props.headings
  return props.headings.filter((h) => normalize(h.text).includes(q))
})

function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) {
    nextTick(() => searchInputRef.value?.focus())
  } else {
    searchQuery.value = ''
  }
}

function closeSearch() {
  searchOpen.value = false
  searchQuery.value = ''
}

// ── Resize drag ─────────────────────────────────────────────────────────
const isResizing = ref(false)
let dragStartX = 0
let dragStartWidth = 0

function onResizeStart(e: PointerEvent) {
  isResizing.value = true
  dragStartX = e.clientX
  dragStartWidth = props.width
  document.addEventListener('pointermove', onResizeMove)
  document.addEventListener('pointerup', onResizeEnd, { once: true })
  document.body.classList.add('lumen-outline-resizing')
}

function onResizeMove(e: PointerEvent) {
  if (!isResizing.value) return
  // Outline est a droite : on diminue la largeur quand on tire vers la droite.
  const delta = dragStartX - e.clientX
  const next = Math.max(props.minWidth, Math.min(props.maxWidth, dragStartWidth + delta))
  emit('update:width', next)
}

function onResizeEnd() {
  isResizing.value = false
  document.removeEventListener('pointermove', onResizeMove)
  document.body.classList.remove('lumen-outline-resizing')
}

onBeforeUnmount(() => {
  document.removeEventListener('pointermove', onResizeMove)
  document.body.classList.remove('lumen-outline-resizing')
})

// ── Context menu sur item ───────────────────────────────────────────────
const { ctx, open: openCtx, close: closeCtx } = useContextMenu<HeadingEntry>()
const ctxItems = computed<ContextMenuItem[]>(() => {
  const h = ctx.value?.target
  if (!h) return []
  return [
    { label: 'Aller a la section', icon: CornerDownRight, action: () => emit('navigate', h.id) },
    { label: 'Copier le titre', icon: Copy, separator: true, action: async () => {
      await navigator.clipboard.writeText(h.text)
      showToast('Titre copie.', 'success')
    } },
    { label: 'Copier l\'ancre', icon: Copy, action: async () => {
      await navigator.clipboard.writeText(`#${h.id}`)
      showToast('Ancre copiee.', 'success')
    } },
  ]
})

// ── Position courante "X / Y" ───────────────────────────────────────────
const activePosition = computed<{ current: number; total: number } | null>(() => {
  const total = props.headings.length
  if (!total) return null
  if (!props.activeHeadingId) return { current: 0, total }
  const idx = props.headings.findIndex((h) => h.id === props.activeHeadingId)
  return { current: idx >= 0 ? idx + 1 : 0, total }
})

// ── Style helpers ───────────────────────────────────────────────────────

function isActive(h: HeadingEntry): boolean {
  return h.id === props.activeHeadingId
}
function isInActivePath(h: HeadingEntry): boolean {
  return props.activePath.has(h.id)
}
function annotationCount(h: HeadingEntry): number {
  return props.annotationCounts.get(h.id) ?? 0
}

// ── Mini-map (mode replie) ──────────────────────────────────────────────
// Quand collapsed=true, on remplace l'icone-only par une rail verticale
// affichant un dot par heading + un curseur de scroll. Click sur un dot
// navigue, hover affiche le titre via title attribute.
function miniMapDotStyle(h: HeadingEntry): Record<string, string> {
  // Position calculee a partir de l'index relatif (0..1) — chaque dot
  // est ainsi proportionnellement reparti sur la hauteur de la rail.
  const total = props.headings.length
  if (total <= 1) return { top: '50%' }
  const ratio = h.index / (total - 1)
  return { top: `calc(${ratio * 100}% )` }
}

const miniMapCursorStyle = computed<Record<string, string>>(() => {
  const ratio = Math.min(1, Math.max(0, props.readingProgress))
  return { top: `${ratio * 100}%` }
})
</script>

<template>
  <aside
    class="lumen-outline"
    :class="{
      'is-collapsed': collapsed,
      'is-resizing': isResizing,
      'is-focus-mode': readingFocus && !collapsed,
    }"
    :style="!collapsed ? { width: width + 'px' } : undefined"
  >
    <!-- Poignee de resize : visible quand deplie, drag horizontal. -->
    <div
      v-if="!collapsed"
      class="lumen-outline-resize"
      role="separator"
      aria-label="Redimensionner le plan"
      :aria-valuenow="width"
      :aria-valuemin="minWidth"
      :aria-valuemax="maxWidth"
      @pointerdown="onResizeStart"
    />

    <!-- HEADER -->
    <div v-if="!collapsed" class="lumen-outline-head">
      <button
        type="button"
        class="lumen-outline-toggle"
        :aria-expanded="!collapsed"
        @click="$emit('toggle')"
      >
        <ChevronDown :size="12" />
        <ListTree :size="13" />
        <span class="lumen-outline-title">Plan</span>
        <span v-if="activePosition" class="lumen-outline-position">
          {{ activePosition.current }} / {{ activePosition.total }}
        </span>
      </button>
      <div class="lumen-outline-actions">
        <button
          type="button"
          class="lumen-outline-action"
          :class="{ active: numbered }"
          :title="numbered ? 'Masquer la numerotation' : 'Afficher la numerotation'"
          aria-label="Numerotation"
          @click="$emit('update:numbered', !numbered)"
        >
          <Hash :size="12" />
        </button>
        <button
          type="button"
          class="lumen-outline-action"
          :class="{ active: readingFocus }"
          :title="readingFocus ? 'Mode lecture concentree desactive' : 'Activer le mode lecture concentree'"
          aria-label="Mode lecture concentree"
          @click="$emit('update:readingFocus', !readingFocus)"
        >
          <component :is="readingFocus ? Eye : EyeOff" :size="12" />
        </button>
        <button
          type="button"
          class="lumen-outline-action"
          :class="{ active: searchOpen }"
          title="Rechercher dans le plan"
          aria-label="Rechercher"
          @click="toggleSearch"
        >
          <Search :size="12" />
        </button>
      </div>
    </div>

    <!-- Bouton seul en mode replie : toggle l'expansion (mini-map cliquable
         pour la nav). -->
    <button
      v-else
      type="button"
      class="lumen-outline-collapsed-toggle"
      :aria-expanded="!collapsed"
      title="Afficher le plan"
      @click="$emit('toggle')"
    >
      <ListTree :size="13" />
    </button>

    <!-- BARRE DE RECHERCHE -->
    <Transition name="lumen-outline-search">
      <div v-if="!collapsed && searchOpen" class="lumen-outline-search">
        <Search :size="12" class="lumen-outline-search-icon" />
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          class="lumen-outline-search-input"
          placeholder="Filtrer les sections…"
          @keydown.escape.prevent="closeSearch"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="lumen-outline-search-clear"
          aria-label="Effacer"
          @click="searchQuery = ''"
        >
          <X :size="11" />
        </button>
      </div>
    </Transition>

    <!-- MODE PLEIN : LISTE AVEC TREE LINES -->
    <nav v-if="!collapsed && filteredHeadings.length > 0" class="lumen-outline-nav">
      <button
        v-for="h in filteredHeadings"
        :key="h.id"
        type="button"
        class="lumen-outline-item"
        :class="{
          'is-active': isActive(h),
          'is-active-ancestor': isInActivePath(h) && !isActive(h),
          [`lumen-outline-item--depth-${Math.min(h.depth, 6)}`]: true,
        }"
        :title="h.text"
        :aria-current="isActive(h) ? 'location' : undefined"
        @click="$emit('navigate', h.id)"
        @contextmenu="openCtx($event, h)"
      >
        <!-- Tree connector — vertical guide + L-shape via pseudo CSS sur
             l'item lui-meme. Le marker dot est rendu en SVG-like via ::after. -->
        <span class="lumen-outline-marker" aria-hidden="true" />

        <span v-if="numbered && h.number" class="lumen-outline-number">{{ h.number }}</span>
        <span class="lumen-outline-text">{{ h.text }}</span>

        <span v-if="annotationCount(h) > 0" class="lumen-outline-badge" :title="`${annotationCount(h)} annotation(s)`">
          <MessageSquare :size="9" />
          {{ annotationCount(h) }}
        </span>
      </button>
    </nav>

    <!-- EMPTY STATE -->
    <div v-else-if="!collapsed && headings.length === 0" class="lumen-outline-empty">
      <ListTree :size="20" class="lumen-outline-empty-icon" />
      <p v-if="isTeacher" class="lumen-outline-empty-text">
        Ajoute des titres <code>## Section</code> dans le markdown pour generer le plan automatiquement.
      </p>
      <p v-else class="lumen-outline-empty-text">
        Ce chapitre n'a pas de plan structure.
      </p>
    </div>
    <p v-else-if="!collapsed && filteredHeadings.length === 0" class="lumen-outline-empty-search">
      Aucun titre ne correspond a "{{ searchQuery }}".
    </p>

    <!-- MODE REPLIE : MINI-MAP RAIL -->
    <div v-if="collapsed && headings.length > 0" class="lumen-outline-minimap" aria-hidden="true">
      <button
        v-for="h in headings"
        :key="h.id"
        type="button"
        class="lumen-outline-minimap-dot"
        :class="{
          'is-active': isActive(h),
          'is-active-ancestor': isInActivePath(h) && !isActive(h),
          [`lumen-outline-minimap-dot--depth-${Math.min(h.depth, 4)}`]: true,
        }"
        :style="miniMapDotStyle(h)"
        :title="h.text"
        @click="$emit('navigate', h.id)"
      />
      <!-- Curseur de progression (suit le scroll global) -->
      <div
        class="lumen-outline-minimap-cursor"
        :style="miniMapCursorStyle"
        aria-hidden="true"
      />
    </div>

    <ContextMenu
      v-if="ctx"
      :x="ctx.x"
      :y="ctx.y"
      :items="ctxItems"
      @close="closeCtx"
    />
  </aside>
</template>

<style scoped>
/* ════════════════════════════════════════════════════════════════════════
   PLAN DU CHAPITRE — refonte v2.287
   Tree lines verticales + curved connectors via CSS pseudo-elements.
   Inspiration : Mintlify / Notion / Tailwind UI nested nav.
   ══════════════════════════════════════════════════════════════════════ */

.lumen-outline {
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  background: var(--bg-sidebar);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  transition: width var(--motion-base) var(--ease-out);
}
.lumen-outline.is-collapsed {
  width: 36px;
  transition: width var(--motion-base) var(--ease-out);
}
.lumen-outline.is-resizing {
  /* Pas de transition pendant le drag — sinon le resize est saccade. */
  transition: none;
}

/* Poignee de resize : zone 4px sur le bord gauche, curseur ew-resize. */
.lumen-outline-resize {
  position: absolute;
  top: 0;
  left: -2px;
  width: 4px;
  height: 100%;
  z-index: 10;
  cursor: ew-resize;
  background: transparent;
  transition: background var(--motion-fast) var(--ease-out);
}
.lumen-outline-resize:hover,
.lumen-outline.is-resizing .lumen-outline-resize {
  background: rgba(var(--accent-rgb), .25);
}

/* HEADER ─────────────────────────────────────────────────────────────── */
.lumen-outline-head {
  display: flex;
  align-items: center;
  min-height: 44px;
  padding: 0 8px 0 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.lumen-outline-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  height: 32px;
  padding: 0 4px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: color var(--motion-fast) var(--ease-out);
}
.lumen-outline-toggle:hover { color: var(--text-primary); }
.lumen-outline-toggle:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.lumen-outline-title {
  font-weight: 700;
  letter-spacing: -0.01em;
}
.lumen-outline-position {
  margin-left: auto;
  padding: 2px 7px;
  font-size: 10.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
}
.lumen-outline-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.lumen-outline-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out);
}
.lumen-outline-action:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.lumen-outline-action.active {
  background: rgba(var(--accent-rgb), .14);
  color: var(--accent);
  border-color: rgba(var(--accent-rgb), .35);
}
.lumen-outline-action:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* Bouton de toggle quand replie */
.lumen-outline-collapsed-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  min-height: 44px;
  border: none;
  border-bottom: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out);
}
.lumen-outline-collapsed-toggle:hover {
  background: var(--bg-hover);
  color: var(--accent);
}

/* RECHERCHE ────────────────────────────────────────────────────────── */
.lumen-outline-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
  flex-shrink: 0;
}
.lumen-outline-search-icon { color: var(--text-muted); flex-shrink: 0; }
.lumen-outline-search-input {
  flex: 1;
  min-width: 0;
  height: 22px;
  padding: 0 4px;
  background: transparent;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: 12px;
  color: var(--text-primary);
}
.lumen-outline-search-input::placeholder { color: var(--text-muted); }
.lumen-outline-search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: transparent;
  border: none;
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
}
.lumen-outline-search-clear:hover { color: var(--text-primary); background: var(--bg-hover); }
.lumen-outline-search-enter-active,
.lumen-outline-search-leave-active {
  transition: opacity var(--motion-fast) var(--ease-out);
}
.lumen-outline-search-enter-from,
.lumen-outline-search-leave-to {
  opacity: 0;
}

/* LISTE + TREE LINES ───────────────────────────────────────────────────
   Construction CSS :
   - Chaque item a une indentation calculee depuis sa profondeur (depth)
   - Le tree-line est rendu via ::before (vertical guide) + ::after (L-shape)
   - L'etat actif allume le marker en accent + le chemin parent en accent muted
   - L'animation de la couleur des lignes au changement d'active = signature moderne
*/
.lumen-outline-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 6px 16px;
}

.lumen-outline-item {
  --depth-px: 0px;
  --tree-x: 12px;        /* Position X de la guideline verticale */
  --marker-x: 12px;      /* Position X du marker (dot) */
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 28px;
  padding: 4px 8px 4px calc(var(--depth-px) + 24px);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              color var(--motion-fast) var(--ease-out),
              opacity var(--motion-fast) var(--ease-out);
}

/* Profondeurs : decale indent + position du marker. La guideline (tree-x)
   reste a une position fixe par profondeur pour que les items du meme
   parent partagent la meme ligne verticale. */
.lumen-outline-item--depth-1 { --depth-px: 0px;  --tree-x: 12px; }
.lumen-outline-item--depth-2 { --depth-px: 14px; --tree-x: 22px; }
.lumen-outline-item--depth-3 { --depth-px: 28px; --tree-x: 36px; }
.lumen-outline-item--depth-4 { --depth-px: 42px; --tree-x: 50px; }
.lumen-outline-item--depth-5 { --depth-px: 56px; --tree-x: 64px; }
.lumen-outline-item--depth-6 { --depth-px: 70px; --tree-x: 78px; }

/* H1 = section principale, pas de tree line (c'est la racine du chapitre) */
.lumen-outline-item--depth-1 {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 6px;
}
.lumen-outline-item--depth-1:first-child { margin-top: 0; }

/* Tree guideline (vertical) — pour les profondeurs >= 2.
   Trace une ligne fine du haut au bas de l'item, qui se connecte aux items
   au-dessus et au-dessous au meme niveau. */
.lumen-outline-item:not(.lumen-outline-item--depth-1)::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: var(--tree-x);
  width: 1px;
  background: var(--border);
  transition: background var(--motion-base) var(--ease-out);
}

/* Marker dot + L connector — combinaison de pseudo + element .marker
   Le marker .lumen-outline-marker est un span dans le template, position
   sur la guideline avec un L-shape qui rejoint le texte. */
.lumen-outline-marker {
  position: absolute;
  top: 50%;
  left: var(--tree-x);
  transform: translate(-50%, -50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bg-sidebar);
  border: 1.5px solid var(--border);
  transition: background var(--motion-base) var(--ease-out),
              border-color var(--motion-base) var(--ease-out),
              transform var(--motion-fast) var(--ease-out),
              box-shadow var(--motion-base) var(--ease-out);
  z-index: 1;
}
/* h1 : pas de marker (deja la racine) */
.lumen-outline-item--depth-1 .lumen-outline-marker {
  display: none;
}

/* L-shape connector entre la guideline du parent et le texte. Rendu via
   ::after de l'item, juste a droite du marker. */
.lumen-outline-item:not(.lumen-outline-item--depth-1)::after {
  content: '';
  position: absolute;
  top: 50%;
  left: var(--tree-x);
  width: 8px;
  height: 1px;
  background: var(--border);
  transition: background var(--motion-base) var(--ease-out);
}

/* HOVER — lignes et marker s'illuminent doucement */
.lumen-outline-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.lumen-outline-item:hover .lumen-outline-marker {
  border-color: var(--accent);
  background: var(--accent-subtle);
  transform: translate(-50%, -50%) scale(1.2);
}

/* CHEMIN ACTIF (ancetres du heading actuellement visible) — lignes en
   accent muted pour montrer la branche jusqu'a la racine. */
.lumen-outline-item.is-active-ancestor {
  color: var(--text-primary);
}
.lumen-outline-item.is-active-ancestor::before,
.lumen-outline-item.is-active-ancestor::after {
  background: rgba(var(--accent-rgb), .35);
}
.lumen-outline-item.is-active-ancestor .lumen-outline-marker {
  border-color: rgba(var(--accent-rgb), .55);
  background: rgba(var(--accent-rgb), .15);
}

/* HEADING ACTIF — marker plein accent + glow + bg subtil + bold. */
.lumen-outline-item.is-active {
  background: rgba(var(--accent-rgb), .10);
  color: var(--accent);
  font-weight: 600;
}
.lumen-outline-item.is-active::before,
.lumen-outline-item.is-active::after {
  background: var(--accent);
}
.lumen-outline-item.is-active .lumen-outline-marker {
  border-color: var(--accent);
  background: var(--accent);
  transform: translate(-50%, -50%) scale(1.4);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .18);
}

/* Numero hierarchique — gris compact, mono pour aligner les chiffres */
.lumen-outline-number {
  flex-shrink: 0;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 10.5px;
  font-weight: 600;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  min-width: 18px;
  letter-spacing: -0.02em;
}
.lumen-outline-item.is-active .lumen-outline-number,
.lumen-outline-item.is-active-ancestor .lumen-outline-number {
  color: var(--accent);
}

.lumen-outline-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Badge annotations sur la section */
.lumen-outline-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 5px;
  background: rgba(var(--accent-rgb), .14);
  color: var(--accent);
  border-radius: 999px;
  font-size: 9.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

/* Mode reading focus — grise toutes les sections sauf l'active path */
.lumen-outline.is-focus-mode .lumen-outline-item:not(.is-active):not(.is-active-ancestor) {
  opacity: 0.4;
}
.lumen-outline.is-focus-mode .lumen-outline-item:not(.is-active):not(.is-active-ancestor):hover {
  opacity: 1;
}

/* EMPTY STATES ──────────────────────────────────────────────────────── */
.lumen-outline-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  gap: 12px;
  flex: 1;
}
.lumen-outline-empty-icon {
  color: var(--text-muted);
  opacity: .5;
}
.lumen-outline-empty-text {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}
.lumen-outline-empty-text code {
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
  font-size: 11px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--accent);
}
.lumen-outline-empty-search {
  margin: 18px 12px;
  padding: 12px;
  background: var(--bg-elevated);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
}

/* MINI-MAP (mode replie) ─────────────────────────────────────────────
   Rail verticale 36px de large avec un dot par heading + un curseur de
   scroll. Inspiration VSCode minimap. */
.lumen-outline-minimap {
  flex: 1;
  position: relative;
  width: 100%;
  padding: 12px 0;
  overflow: hidden;
}
.lumen-outline-minimap-dot {
  position: absolute;
  left: 50%;
  width: 5px;
  height: 5px;
  padding: 0;
  border-radius: 50%;
  background: var(--text-muted);
  border: none;
  opacity: .35;
  transform: translate(-50%, -50%);
  cursor: pointer;
  transition: background var(--motion-fast) var(--ease-out),
              opacity var(--motion-fast) var(--ease-out),
              width var(--motion-fast) var(--ease-out),
              height var(--motion-fast) var(--ease-out);
}
.lumen-outline-minimap-dot:hover {
  opacity: 1;
  width: 8px;
  height: 8px;
  background: var(--text-primary);
}
.lumen-outline-minimap-dot--depth-1 { width: 7px; height: 7px; }
.lumen-outline-minimap-dot--depth-3 { opacity: .25; }
.lumen-outline-minimap-dot--depth-4 { opacity: .2; }
.lumen-outline-minimap-dot.is-active-ancestor {
  background: rgba(var(--accent-rgb), .55);
  opacity: .8;
}
.lumen-outline-minimap-dot.is-active {
  background: var(--accent);
  opacity: 1;
  width: 10px;
  height: 10px;
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb), .25);
}

/* Curseur de scroll (suit la position de lecture, animation fluide) */
.lumen-outline-minimap-cursor {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(to right, transparent, var(--accent), transparent);
  pointer-events: none;
  transform: translateY(-50%);
  transition: top var(--motion-fast) linear;
}

/* Drag global : empeche selection de texte pendant le resize */
:global(body.lumen-outline-resizing) {
  cursor: ew-resize !important;
  user-select: none !important;
}
:global(body.lumen-outline-resizing *) {
  cursor: ew-resize !important;
  user-select: none !important;
}
</style>
