<script setup lang="ts">
/**
 * Plan du chapitre (sommaire navigable).
 *
 * v2.48 : recoit les headings deja extraits du DOM rendu par LumenChapterViewer
 * (apres injectHeadingIds et deduplication via slugifyHeading). Emet l'id
 * cliquable, le parent se charge du scroll. C'est plus robuste que parser
 * le markdown brut ici — on utilise les memes slugs que le rendu.
 */
import { computed } from 'vue'
import { ListTree, ChevronDown, ChevronRight, Copy, CornerDownRight } from 'lucide-vue-next'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'
import { useContextMenu } from '@/composables/useContextMenu'
import { useToast } from '@/composables/useToast'

interface HeadingEntry {
  id: string
  text: string
  level: number
}

interface Props {
  headings: HeadingEntry[]
  collapsed?: boolean
  /** Id du heading actuellement visible (scroll-spy, v2.77) */
  activeHeadingId?: string | null
}
interface Emits {
  (e: 'navigate', id: string): void
  (e: 'toggle'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const { showToast } = useToast()
const { ctx, open: openCtx, close: closeCtx } = useContextMenu<HeadingEntry>()
const ctxItems = computed<ContextMenuItem[]>(() => {
  const h = ctx.value?.target
  if (!h) return []
  return [
    { label: 'Aller à la section', icon: CornerDownRight, action: () => emit('navigate', h.id) },
    { label: 'Copier le titre', icon: Copy, separator: true, action: async () => {
      await navigator.clipboard.writeText(h.text)
      showToast('Titre copié.', 'success')
    } },
    { label: 'Copier l\'ancre', icon: Copy, action: async () => {
      await navigator.clipboard.writeText(`#${h.id}`)
      showToast('Ancre copiée.', 'success')
    } },
  ]
})
</script>

<template>
  <aside class="lumen-outline" :class="{ 'is-collapsed': collapsed }">
    <button
      type="button"
      class="lumen-outline-head"
      :aria-expanded="!collapsed"
      @click="$emit('toggle')"
    >
      <component :is="collapsed ? ChevronRight : ChevronDown" :size="12" />
      <ListTree :size="13" />
      <span>Plan</span>
      <span v-if="headings.length" class="lumen-outline-count">{{ headings.length }}</span>
    </button>
    <nav v-if="!collapsed && headings.length > 0" class="lumen-outline-nav">
      <button
        v-for="h in headings"
        :key="h.id"
        class="lumen-outline-item"
        :class="[
          `lumen-outline-item--h${h.level}`,
          { 'is-active': h.id === activeHeadingId },
        ]"
        :title="h.text"
        @click="$emit('navigate', h.id)"
        @contextmenu="openCtx($event, h)"
      >
        {{ h.text }}
      </button>
    </nav>
    <p v-else-if="!collapsed" class="lumen-outline-empty">
      Ajoute des titres (## Titre) pour générer le plan.
    </p>
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
.lumen-outline {
  width: 220px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
  background: var(--bg-sidebar);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width var(--t-fast) ease;
}
.lumen-outline.is-collapsed { width: 36px; }

.lumen-outline-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border: none;
  background: transparent;
  border-bottom: 1px solid var(--border);
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-muted);
  cursor: pointer;
  text-align: left;
  width: 100%;
  font-family: inherit;
}
.lumen-outline-head:hover { color: var(--text-primary); }
.is-collapsed .lumen-outline-head { padding: 10px 8px; }
.is-collapsed .lumen-outline-head span { display: none; }

.lumen-outline-count {
  margin-left: auto;
  font-size: 9px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  padding: 0 5px;
  border-radius: 8px;
  font-variant-numeric: tabular-nums;
}

.lumen-outline-nav {
  flex: 1;
  overflow-y: auto;
  padding: 6px 0;
}

.lumen-outline-item {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 12px;
  border-left: 2px solid transparent;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  transition: all var(--t-fast) ease;
}
.lumen-outline-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-left-color: var(--accent);
}
.lumen-outline-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
/* Scroll spy (v2.77) : heading actuellement visible dans le viewport */
.lumen-outline-item.is-active {
  background: rgba(var(--accent-rgb), .08);
  color: var(--accent);
  border-left-color: var(--accent);
  font-weight: 700;
}

.lumen-outline-item--h1 { font-weight: 700; color: var(--text-primary); padding-left: 12px; }
.lumen-outline-item--h2 { padding-left: 18px; }
.lumen-outline-item--h3 { padding-left: 28px; font-size: 11.5px; }
.lumen-outline-item--h4 { padding-left: 36px; font-size: 11.5px; }
.lumen-outline-item--h5 { padding-left: 44px; font-size: 11px; color: var(--text-muted); }
.lumen-outline-item--h6 { padding-left: 52px; font-size: 11px; color: var(--text-muted); }

.lumen-outline-empty {
  padding: 18px 12px;
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.5;
}
</style>
