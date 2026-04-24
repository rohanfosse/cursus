<script setup lang="ts">
/**
 * Modal "Lier ce chapitre a un devoir" — teacher only.
 * Affiche les devoirs publies de la promo avec filtre recherche,
 * checkbox pour lier/delier directement dans la liste.
 *
 * Props : repoId, chapterPath, chapterTitle, promoId
 * Events : close, changed (quand une liaison a ete modifiee pour que
 *   le parent puisse rafraichir sa liste des devoirs lies).
 */
import { ref, computed, onMounted } from 'vue'
import { X, Search, FileText, Loader2, Calendar } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { relativeTime } from '@/utils/date'
import type { GanttRow, LumenLinkedTravail } from '@/types'

interface Props {
  repoId: number
  chapterPath: string
  chapterTitle: string
  promoId: number
}
interface Emits {
  (e: 'close'): void
  (e: 'changed'): void
}
const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { showToast } = useToast()

const allTravaux = ref<GanttRow[]>([])
const linkedIds = ref<Set<number>>(new Set())
const loading = ref(true)
const filter = ref('')
const togglingId = ref<number | null>(null)

onMounted(async () => {
  loading.value = true
  try {
    // Charge tous les devoirs de la promo (via GanttRow qui est la vue
    // teacher complete des travaux) + les devoirs deja lies au chapitre.
    const [allResp, linkedResp] = await Promise.all([
      window.api.getGanttData(props.promoId) as Promise<{ ok: boolean; data?: GanttRow[] }>,
      window.api.getLumenTravauxForChapter(props.repoId, props.chapterPath) as Promise<{ ok: boolean; data?: { travaux: LumenLinkedTravail[] } }>,
    ])
    if (allResp?.ok && allResp.data) allTravaux.value = allResp.data
    if (linkedResp?.ok && linkedResp.data) {
      linkedIds.value = new Set(linkedResp.data.travaux.map((t) => t.id))
    }
  } finally {
    loading.value = false
  }
})

const filteredTravaux = computed(() => {
  const q = filter.value.trim().toLowerCase()
  // Affiche les publies en priorite, puis les brouillons dans la meme liste
  // (le teacher peut vouloir lier un chapitre a un devoir encore en prepa).
  const visible = [...allTravaux.value].sort((a, b) => (b.published ?? 0) - (a.published ?? 0))
  if (!q) return visible
  return visible.filter((t) =>
    t.title.toLowerCase().includes(q) || (t.category ?? '').toLowerCase().includes(q),
  )
})

async function toggleLink(travail: GanttRow) {
  togglingId.value = travail.id
  const wasLinked = linkedIds.value.has(travail.id)
  try {
    if (wasLinked) {
      const resp = await window.api.unlinkLumenChapterFromTravail(travail.id, props.repoId, props.chapterPath) as { ok: boolean; error?: string }
      if (!resp?.ok) {
        showToast(resp?.error ?? 'Echec de la deliaison', 'error')
        return
      }
      linkedIds.value.delete(travail.id)
    } else {
      const resp = await window.api.linkLumenChapterToTravail(travail.id, props.repoId, props.chapterPath) as { ok: boolean; error?: string }
      if (!resp?.ok) {
        showToast(resp?.error ?? 'Echec de la liaison', 'error')
        return
      }
      linkedIds.value.add(travail.id)
    }
    linkedIds.value = new Set(linkedIds.value)
    emit('changed')
  } finally {
    togglingId.value = null
  }
}
</script>

<template>
  <div class="lldm-backdrop" @click.self="emit('close')">
    <div class="lldm-modal" role="dialog" aria-labelledby="lldm-title">
      <header class="lldm-head">
        <h3 id="lldm-title">
          <FileText :size="16" />
          Lier <span class="lldm-chapter">{{ chapterTitle }}</span> a des devoirs
        </h3>
        <button type="button" class="lldm-close" aria-label="Fermer" @click="emit('close')">
          <X :size="18" />
        </button>
      </header>

      <div class="lldm-search">
        <Search :size="14" />
        <input
          v-model="filter"
          type="text"
          placeholder="Filtrer les devoirs..."
          autofocus
        />
      </div>

      <div v-if="loading" class="lldm-state">
        <Loader2 :size="16" class="spin" /> Chargement...
      </div>
      <p v-else-if="filteredTravaux.length === 0" class="lldm-state">
        Aucun devoir publie dans cette promo.
      </p>
      <ul v-else class="lldm-list">
        <li v-for="t in filteredTravaux" :key="t.id">
          <button
            type="button"
            class="lldm-item"
            :class="{ 'is-linked': linkedIds.has(t.id), 'is-loading': togglingId === t.id }"
            :disabled="togglingId === t.id"
            @click="toggleLink(t)"
          >
            <div class="lldm-item-main">
              <span class="lldm-item-title">{{ t.title }}</span>
              <div class="lldm-item-meta">
                <span v-if="t.category" class="lldm-item-cat">{{ t.category }}</span>
                <span v-if="t.deadline" class="lldm-item-deadline">
                  <Calendar :size="10" /> {{ relativeTime(t.deadline) }}
                </span>
              </div>
            </div>
            <span class="lldm-item-action">
              <Loader2 v-if="togglingId === t.id" :size="14" class="spin" />
              <template v-else-if="linkedIds.has(t.id)">Lie ✓</template>
              <template v-else>Lier</template>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.lldm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fade-in var(--motion-fast) var(--ease-out);
}
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

.lldm-modal {
  background: var(--bg-secondary);
  border-radius: 12px;
  width: min(560px, calc(100% - 32px));
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: slide-up var(--motion-base) var(--ease-out);
}
@keyframes slide-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.lldm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.lldm-head h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}
.lldm-chapter { color: var(--accent); }
.lldm-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  border-radius: 4px;
}
.lldm-close:hover { color: var(--text-primary); background: var(--bg-hover); }

.lldm-search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  margin: 12px 16px 0;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-muted);
}
.lldm-search:focus-within {
  border-color: var(--accent);
  color: var(--text-primary);
}
.lldm-search input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
}

.lldm-state {
  padding: 24px 20px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
}

.lldm-list {
  list-style: none;
  margin: 12px 0;
  padding: 0 16px 16px;
  overflow-y: auto;
  flex: 1;
}

.lldm-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 6px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: all var(--t-fast, 150ms) ease;
}
.lldm-item:hover:not(:disabled):not(.is-linked) {
  background: var(--bg-hover);
  border-color: var(--accent);
}
.lldm-item.is-linked {
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-primary));
  border-color: var(--accent);
}
.lldm-item.is-loading {
  opacity: 0.6;
  cursor: wait;
}

.lldm-item-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.lldm-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lldm-item-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
}
.lldm-item-cat {
  background: var(--bg-secondary);
  padding: 1px 6px;
  border-radius: 8px;
}
.lldm-item-deadline {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.lldm-item-action {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  padding: 4px 10px;
  background: var(--bg-secondary);
  border-radius: 6px;
  flex-shrink: 0;
  min-width: 48px;
  text-align: center;
}
.is-linked .lldm-item-action {
  background: var(--accent);
  color: white;
}

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
