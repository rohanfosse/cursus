<script setup lang="ts">
/**
 * Modal "Corbeille Lumen" : liste les cours soft-deleted avec action
 * restore et purge definitive. Accessible depuis la toolbar de la liste
 * teacher uniquement. Se charge lazy a l'ouverture.
 */
import { ref, computed, watch } from 'vue'
import { Trash2, RotateCcw, X } from 'lucide-vue-next'
import { useLumenStore } from '@/stores/lumen'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { relativeTime } from '@/utils/date'

interface Props {
  open: boolean
}
const props = defineProps<Props>()
const emit = defineEmits<(e: 'close') => void>()

const lumenStore = useLumenStore()
const { showToast } = useToast()
const { confirm: confirmDialog } = useConfirm()

const loading = ref(false)

// Charge la corbeille a chaque ouverture du modal (pas de cache : le
// contenu change rarement et l'etudiant peut vouloir un etat a jour).
watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    loading.value = true
    try {
      await lumenStore.fetchTrash()
    } finally {
      loading.value = false
    }
  }
})

async function handleRestore(courseId: number, title: string) {
  const ok = await lumenStore.restoreCourse(courseId)
  if (ok) {
    showToast(`Cours restaure : ${title}`, 'success')
  } else {
    showToast('Restauration echouee', 'error')
  }
}

async function handlePurge(courseId: number, title: string) {
  const ok = await confirmDialog(
    `Supprimer definitivement "${title}" ? Cette action est irreversible.`,
    'danger',
    'Supprimer definitivement',
  )
  if (!ok) return
  const success = await lumenStore.purgeCourse(courseId)
  if (success) {
    showToast('Cours supprime definitivement', 'info')
  } else {
    showToast('Suppression echouee', 'error')
  }
}

interface TrashedCourse {
  id: number
  title: string
  summary: string
  deleted_at: string
}

// Tri : plus recent supprime en premier
const sortedTrash = computed<TrashedCourse[]>(() => {
  const items = lumenStore.trashedCourses as unknown as TrashedCourse[]
  return [...items].sort((a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? ''))
})
</script>

<template>
  <Teleport to="body">
    <Transition name="trash-fade">
      <div
        v-if="open"
        class="trash-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trash-title"
        @click.self="emit('close')"
      >
        <div class="trash-modal">
          <header class="trash-head">
            <Trash2 :size="16" />
            <h2 id="trash-title" class="trash-title">Corbeille Lumen</h2>
            <span class="trash-count">{{ sortedTrash.length }}</span>
            <button
              type="button"
              class="trash-close"
              aria-label="Fermer"
              title="Fermer (Esc)"
              @click="emit('close')"
            >
              <X :size="16" />
            </button>
          </header>

          <div class="trash-body">
            <div v-if="loading" class="trash-empty">Chargement…</div>
            <div v-else-if="sortedTrash.length === 0" class="trash-empty">
              <Trash2 :size="28" class="trash-empty-icon" />
              <p>La corbeille est vide.</p>
              <p class="trash-empty-hint">
                Les cours supprimes apparaissent ici pendant 30 jours avant
                suppression definitive.
              </p>
            </div>

            <ul v-else class="trash-list">
              <li
                v-for="course in sortedTrash"
                :key="course.id"
                class="trash-item"
              >
                <div class="trash-item-main">
                  <span class="trash-item-title">{{ course.title || 'Sans titre' }}</span>
                  <span class="trash-item-meta">
                    Supprime {{ relativeTime(course.deleted_at) }}
                    <template v-if="course.summary">
                      · {{ course.summary.slice(0, 60) }}{{ course.summary.length > 60 ? '…' : '' }}
                    </template>
                  </span>
                </div>
                <div class="trash-item-actions">
                  <button
                    type="button"
                    class="trash-btn trash-btn--restore"
                    title="Restaurer ce cours"
                    @click="handleRestore(course.id, course.title)"
                  >
                    <RotateCcw :size="13" />
                    <span>Restaurer</span>
                  </button>
                  <button
                    type="button"
                    class="trash-btn trash-btn--purge"
                    title="Supprimer definitivement"
                    @click="handlePurge(course.id, course.title)"
                  >
                    <Trash2 :size="13" />
                    <span>Purger</span>
                  </button>
                </div>
              </li>
            </ul>
          </div>

          <footer class="trash-foot">
            <span>Les cours restent dans la corbeille 30 jours avant purge automatique.</span>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.trash-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}
.trash-modal {
  background: var(--bg-primary, #14161a);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  max-width: 680px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.trash-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}
.trash-title {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}
.trash-count {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  background: var(--bg-input);
  border-radius: var(--radius-xl);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.trash-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.trash-close:hover { color: var(--text-primary); background: var(--bg-hover); }

.trash-body {
  padding: 14px 18px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.trash-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 20px;
  text-align: center;
  color: var(--text-muted);
}
.trash-empty-icon { opacity: 0.4; }
.trash-empty-hint { font-size: 11px; opacity: 0.7; max-width: 300px; }

.trash-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.trash-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.trash-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.trash-item-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.trash-item-meta {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trash-item-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}
.trash-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  padding: 5px 10px;
  transition: all 120ms ease;
}
.trash-btn--restore:hover {
  background: rgba(63, 183, 111, 0.1);
  border-color: #3fb76f;
  color: #3fb76f;
}
.trash-btn--purge:hover {
  background: rgba(217, 83, 79, 0.1);
  border-color: #d9534f;
  color: #d9534f;
}

.trash-foot {
  padding: 10px 18px;
  border-top: 1px solid var(--border);
  background: var(--bg-elevated);
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
}

.trash-fade-enter-active,
.trash-fade-leave-active { transition: opacity 150ms ease; }
.trash-fade-enter-from,
.trash-fade-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .trash-fade-enter-active,
  .trash-fade-leave-active { transition: none; }
  .trash-overlay { backdrop-filter: none; }
}
</style>
