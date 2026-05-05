<script setup lang="ts">
/**
 * Panneau d'annotations pour les chapitres Lumen — composant purement
 * presentationnel depuis v2.285. L'etat des annotations est detenu par le
 * parent (useLumenAnnotations), passe ici via props/emits pour rester
 * synchrone avec le menu contextuel du body markdown.
 */
import { ref, computed } from 'vue'
import { MessageSquare, Trash2, X, Copy, Pencil, Star, Wrench } from 'lucide-vue-next'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'
import { useContextMenu } from '@/composables/useContextMenu'
import { useToast } from '@/composables/useToast'
import type { Annotation } from '@/composables/useLumenAnnotations'

interface Props {
  annotations: Annotation[]
}
interface Emits {
  (e: 'remove', id: string): void
  (e: 'update', id: string, comment: string): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const panelOpen = ref(false)

const { showToast } = useToast()
const { ctx, open: openCtx, close: closeCtx } = useContextMenu<Annotation>()

function editAnnotation(a: Annotation) {
  const next = window.prompt('Modifier le commentaire', a.comment)
  if (next === null) return
  emit('update', a.id, next)
  showToast('Annotation modifiee.', 'success')
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const ctxItems = computed<ContextMenuItem[]>(() => {
  const a = ctx.value?.target
  if (!a) return []
  const items: ContextMenuItem[] = [
    { label: 'Copier le passage', icon: Copy, action: async () => {
      await navigator.clipboard.writeText(a.text)
      showToast('Passage copie.', 'success')
    } },
  ]
  if (a.comment) {
    items.push({ label: 'Copier le commentaire', icon: Copy, action: async () => {
      await navigator.clipboard.writeText(a.comment)
      showToast('Commentaire copie.', 'success')
    } })
  }
  items.push({
    label: a.comment ? 'Modifier le commentaire' : 'Ajouter un commentaire',
    icon: Pencil,
    separator: true,
    action: () => editAnnotation(a),
  })
  items.push({ label: 'Supprimer', icon: Trash2, danger: true, action: () => emit('remove', a.id) })
  return items
})
</script>

<template>
  <div class="lumen-annot">
    <button
      type="button"
      class="lumen-annot-toggle"
      :class="{ active: panelOpen }"
      :title="panelOpen ? 'Fermer les annotations' : 'Annotations'"
      @click="panelOpen = !panelOpen"
    >
      <MessageSquare :size="14" />
      <span v-if="annotations.length" class="lumen-annot-badge">{{ annotations.length }}</span>
    </button>

    <Transition name="annot-slide">
      <div v-if="panelOpen" class="lumen-annot-panel">
        <header class="lumen-annot-head">
          <h3>Annotations</h3>
          <button type="button" class="lumen-annot-close" @click="panelOpen = false">
            <X :size="14" />
          </button>
        </header>

        <p class="lumen-annot-hint">
          Selectionne du texte dans le chapitre puis clic droit pour annoter.
        </p>

        <ul v-if="annotations.length" class="lumen-annot-list">
          <li
            v-for="a in annotations"
            :key="a.id"
            class="lumen-annot-item"
            :class="{
              'is-important': a.priority === 'important',
              'is-correction': a.kind === 'correction',
            }"
            @contextmenu="openCtx($event, a)"
          >
            <!-- Badge type d'annotation : Important / Correction (sinon rien) -->
            <div v-if="a.priority === 'important' || a.kind === 'correction'" class="lumen-annot-item-badge">
              <template v-if="a.kind === 'correction'">
                <Wrench :size="10" /> Correction
              </template>
              <template v-else>
                <Star :size="10" /> Important
              </template>
            </div>

            <div class="lumen-annot-item-text">"{{ a.text.slice(0, 80) }}{{ a.text.length > 80 ? '...' : '' }}"</div>

            <div v-if="a.suggestion" class="lumen-annot-item-suggestion">
              <span class="lumen-annot-item-suggestion-arrow">→</span>
              "{{ a.suggestion.slice(0, 80) }}{{ a.suggestion.length > 80 ? '...' : '' }}"
            </div>

            <div v-if="a.comment" class="lumen-annot-item-comment">{{ a.comment }}</div>

            <div class="lumen-annot-item-meta">
              <span>{{ formatDate(a.createdAt) }}</span>
              <button
                type="button"
                class="lumen-annot-delete"
                title="Supprimer"
                @click="emit('remove', a.id)"
              >
                <Trash2 :size="11" />
              </button>
            </div>
          </li>
        </ul>
        <p v-else class="lumen-annot-empty">Aucune annotation pour ce chapitre.</p>
      </div>
    </Transition>

    <ContextMenu
      v-if="ctx"
      :x="ctx.x"
      :y="ctx.y"
      :items="ctxItems"
      @close="closeCtx"
    />
  </div>
</template>

<style scoped>
.lumen-annot {
  position: relative;
}

.lumen-annot-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
}
.lumen-annot-toggle:hover { background: var(--bg-hover); color: var(--text-primary); }
.lumen-annot-toggle.active { color: var(--accent); border-color: var(--accent); }

.lumen-annot-badge {
  background: var(--accent);
  color: white;
  font-size: 9px;
  font-weight: 700;
  min-width: 14px;
  height: 14px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 3px;
}

.lumen-annot-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 320px;
  max-height: 420px;
  background: var(--bg-main);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--elevation-3, 0 4px 16px rgba(0, 0, 0, 0.25));
  z-index: 50;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.lumen-annot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}
.lumen-annot-head h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}
.lumen-annot-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
}
.lumen-annot-close:hover { color: var(--text-primary); }

.lumen-annot-hint {
  padding: 12px 14px;
  font-size: 11px;
  color: var(--text-muted);
  margin: 0;
  border-bottom: 1px solid var(--border);
}

.lumen-annot-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}
.lumen-annot-item {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  border-left: 3px solid transparent;
  transition: background var(--motion-fast) var(--ease-out);
}
.lumen-annot-item:last-child { border-bottom: none; }
.lumen-annot-item.is-important {
  border-left-color: var(--color-warning);
  background: rgba(var(--color-warning-rgb), .04);
}
.lumen-annot-item.is-correction {
  border-left-color: var(--color-warning);
  background: rgba(var(--color-warning-rgb), .06);
}
.lumen-annot-item-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 9.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--color-warning);
  padding: 2px 6px;
  background: rgba(var(--color-warning-rgb), .14);
  border-radius: 3px;
  margin-bottom: 5px;
}
.lumen-annot-item-text {
  font-size: 11px;
  color: var(--accent);
  font-style: italic;
  margin-bottom: 4px;
  line-height: 1.4;
}
.lumen-annot-item.is-correction .lumen-annot-item-text {
  color: var(--color-warning);
  text-decoration: line-through;
  text-decoration-color: rgba(var(--color-warning-rgb), .5);
}
.lumen-annot-item-suggestion {
  font-size: 12px;
  color: var(--color-success);
  line-height: 1.4;
  margin-bottom: 4px;
  font-weight: 500;
  font-style: italic;
}
.lumen-annot-item-suggestion-arrow {
  color: var(--text-muted);
  margin-right: 4px;
  font-style: normal;
  font-weight: 400;
}
.lumen-annot-item-comment {
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1.4;
  margin-bottom: 4px;
}
.lumen-annot-item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-muted);
}
.lumen-annot-delete {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
}
.lumen-annot-delete:hover { color: var(--danger); }

.lumen-annot-empty {
  padding: 16px 14px;
  font-size: 11px;
  color: var(--text-muted);
  margin: 0;
  text-align: center;
}

.annot-slide-enter-active,
.annot-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.annot-slide-enter-from,
.annot-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
