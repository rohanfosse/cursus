<script setup lang="ts">
/**
 * Panneau d'annotations pour les chapitres Lumen.
 * Les etudiants peuvent surligner du texte et ajouter des commentaires.
 * Stockage localStorage en v1 (migration backend prevue pour la collab).
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { MessageSquare, Trash2, Plus, X, Copy, Pencil } from 'lucide-vue-next'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu.vue'
import { useContextMenu } from '@/composables/useContextMenu'
import { useToast } from '@/composables/useToast'

interface Annotation {
  id: string
  text: string
  comment: string
  createdAt: string
}

interface Props {
  repoId: number
  chapterPath: string
}

const props = defineProps<Props>()

const annotations = ref<Annotation[]>([])
const panelOpen = ref(false)
const newComment = ref('')
const selectedText = ref('')

const storageKey = computed(() => `lumen-annotations-${props.repoId}-${props.chapterPath}`)

function load() {
  try {
    const raw = localStorage.getItem(storageKey.value)
    annotations.value = raw ? JSON.parse(raw) : []
  } catch {
    annotations.value = []
  }
}

function save() {
  try {
    localStorage.setItem(storageKey.value, JSON.stringify(annotations.value))
  } catch { /* quota exceeded — annotations non persistees */ }
}

function addAnnotation() {
  if (!selectedText.value.trim()) return
  const annotation: Annotation = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: selectedText.value.trim(),
    comment: newComment.value.trim(),
    createdAt: new Date().toISOString(),
  }
  annotations.value = [...annotations.value, annotation]
  save()
  selectedText.value = ''
  newComment.value = ''
}

function removeAnnotation(id: string) {
  annotations.value = annotations.value.filter((a) => a.id !== id)
  save()
}

function onDocumentMouseUp() {
  if (!panelOpen.value) return
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return
  const text = sel.toString().trim()
  if (text.length > 0 && text.length < 500) {
    selectedText.value = text
  }
}

watch(() => [props.repoId, props.chapterPath], () => { load() })
onMounted(() => {
  load()
  document.addEventListener('mouseup', onDocumentMouseUp)
})
onBeforeUnmount(() => {
  document.removeEventListener('mouseup', onDocumentMouseUp)
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const { showToast } = useToast()
const { ctx, open: openCtx, close: closeCtx } = useContextMenu<Annotation>()
function editAnnotation(a: Annotation) {
  const next = window.prompt('Modifier le commentaire', a.comment)
  if (next === null) return
  annotations.value = annotations.value.map(x => x.id === a.id ? { ...x, comment: next.trim() } : x)
  save()
  showToast('Annotation modifiée.', 'success')
}
const ctxItems = computed<ContextMenuItem[]>(() => {
  const a = ctx.value?.target
  if (!a) return []
  const items: ContextMenuItem[] = [
    { label: 'Copier le passage', icon: Copy, action: async () => {
      await navigator.clipboard.writeText(a.text)
      showToast('Passage copié.', 'success')
    } },
  ]
  if (a.comment) {
    items.push({ label: 'Copier le commentaire', icon: Copy, action: async () => {
      await navigator.clipboard.writeText(a.comment)
      showToast('Commentaire copié.', 'success')
    } })
  }
  items.push({ label: a.comment ? 'Modifier le commentaire' : 'Ajouter un commentaire', icon: Pencil, separator: true, action: () => editAnnotation(a) })
  items.push({ label: 'Supprimer', icon: Trash2, danger: true, action: () => removeAnnotation(a.id) })
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

        <!-- Ajout rapide : montre la selection courante -->
        <div v-if="selectedText" class="lumen-annot-add">
          <div class="lumen-annot-selection">"{{ selectedText.slice(0, 100) }}{{ selectedText.length > 100 ? '...' : '' }}"</div>
          <textarea
            v-model="newComment"
            class="lumen-annot-comment-input"
            placeholder="Ajouter un commentaire (optionnel)..."
            rows="2"
          />
          <div class="lumen-annot-add-actions">
            <button type="button" class="lumen-annot-btn ghost" @click="selectedText = ''">Annuler</button>
            <button type="button" class="lumen-annot-btn primary" @click="addAnnotation">
              <Plus :size="12" /> Annoter
            </button>
          </div>
        </div>
        <p v-else class="lumen-annot-hint">Selectionne du texte dans le chapitre pour annoter.</p>

        <!-- Liste des annotations -->
        <ul v-if="annotations.length" class="lumen-annot-list">
          <li v-for="a in annotations" :key="a.id" class="lumen-annot-item" @contextmenu="openCtx($event, a)">
            <div class="lumen-annot-item-text">"{{ a.text.slice(0, 80) }}{{ a.text.length > 80 ? '...' : '' }}"</div>
            <div v-if="a.comment" class="lumen-annot-item-comment">{{ a.comment }}</div>
            <div class="lumen-annot-item-meta">
              <span>{{ formatDate(a.createdAt) }}</span>
              <button type="button" class="lumen-annot-delete" title="Supprimer" @click="removeAnnotation(a.id)">
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
  border-radius: 10px;
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
  border-radius: 8px;
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

.lumen-annot-add {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}
.lumen-annot-selection {
  font-size: 11px;
  color: var(--accent);
  font-style: italic;
  margin-bottom: 8px;
  line-height: 1.4;
}
.lumen-annot-comment-input {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--text-primary);
  font-family: inherit;
  resize: vertical;
  outline: none;
}
.lumen-annot-comment-input:focus { border-color: var(--accent); }
.lumen-annot-add-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}

.lumen-annot-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.lumen-annot-btn.primary {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}
.lumen-annot-btn.ghost {
  background: transparent;
  border-color: transparent;
}

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
}
.lumen-annot-item:last-child { border-bottom: none; }
.lumen-annot-item-text {
  font-size: 11px;
  color: var(--accent);
  font-style: italic;
  margin-bottom: 4px;
  line-height: 1.4;
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

/* Transition */
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
