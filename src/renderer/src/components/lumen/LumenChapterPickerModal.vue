<script setup lang="ts">
/**
 * Modal "Lier un chapitre Lumen" — teacher only.
 * Direction inverse de LumenLinkDevoirModal : ici on est sur UN devoir et on
 * choisit UN chapitre parmi tous ceux des repos visibles dans la promo.
 *
 * Source des chapitres : `lumenStore.repos[].manifest.chapters`. Si la liste
 * est vide (modal ouverte avant que LumenView ait boote pour cette promo), on
 * appelle `fetchReposForPromo` au mount.
 *
 * Emits :
 *  - close            : utilisateur ferme
 *  - link(repoId, path) : utilisateur a choisi un chapitre a lier
 */
import { ref, computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { X, Search, FileText, Loader2, FolderGit2 } from 'lucide-vue-next'
import { useLumenStore } from '@/stores/lumen'
import {
  buildPickerEntries,
  filterPickerEntries,
  type PickerEntry,
} from '@/utils/lumenDevoirLinks'

interface Props {
  promoId: number
  alreadyLinkedKeys: Set<string>
}
interface Emits {
  (e: 'close'): void
  (e: 'link', repoId: number, path: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const lumenStore = useLumenStore()
const { repos } = storeToRefs(lumenStore)

const loading = ref(false)
const filter = ref('')

onMounted(async () => {
  if (repos.value.length === 0) {
    loading.value = true
    try {
      await lumenStore.fetchReposForPromo(props.promoId)
    } finally {
      loading.value = false
    }
  }
})

const allEntries = computed<PickerEntry[]>(() =>
  buildPickerEntries(repos.value, props.alreadyLinkedKeys),
)

const filteredEntries = computed<PickerEntry[]>(() =>
  filterPickerEntries(allEntries.value, filter.value),
)

function pick(entry: PickerEntry): void {
  if (entry.alreadyLinked) return
  emit('link', entry.repoId, entry.chapter.path)
}
</script>

<template>
  <div class="lcpm-backdrop" @click.self="emit('close')">
    <div class="lcpm-modal" role="dialog" aria-labelledby="lcpm-title">
      <header class="lcpm-head">
        <h3 id="lcpm-title">
          <FileText :size="16" />
          Lier un chapitre a ce devoir
        </h3>
        <button type="button" class="lcpm-close" @click="emit('close')" aria-label="Fermer">
          <X :size="18" />
        </button>
      </header>

      <div class="lcpm-search">
        <Search :size="14" />
        <input
          v-model="filter"
          type="text"
          placeholder="Filtrer par titre, projet ou chemin..."
          autofocus
        />
      </div>

      <div v-if="loading" class="lcpm-state">
        <Loader2 :size="16" class="spin" /> Chargement des cours...
      </div>
      <p v-else-if="allEntries.length === 0" class="lcpm-state">
        Aucun chapitre Lumen disponible pour cette promo.
      </p>
      <p v-else-if="filteredEntries.length === 0" class="lcpm-state">
        Aucun chapitre ne correspond a votre recherche.
      </p>
      <ul v-else class="lcpm-list">
        <li v-for="entry in filteredEntries" :key="entry.key">
          <button
            type="button"
            class="lcpm-item"
            :class="{ 'is-linked': entry.alreadyLinked }"
            :disabled="entry.alreadyLinked"
            :title="entry.alreadyLinked ? 'Deja lie a ce devoir' : 'Lier ce chapitre'"
            @click="pick(entry)"
          >
            <div class="lcpm-item-main">
              <span class="lcpm-item-title">{{ entry.chapter.title }}</span>
              <span class="lcpm-item-meta">
                <FolderGit2 :size="10" /> {{ entry.repoLabel }}
              </span>
            </div>
            <span class="lcpm-item-action">
              {{ entry.alreadyLinked ? 'Deja lie' : 'Lier' }}
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.lcpm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 110;
  animation: fade-in 150ms ease-out;
}
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

.lcpm-modal {
  background: var(--bg-secondary);
  border-radius: 12px;
  width: min(560px, calc(100% - 32px));
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: slide-up 200ms ease-out;
}
@keyframes slide-up {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.lcpm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.lcpm-head h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}
.lcpm-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  border-radius: 4px;
}
.lcpm-close:hover { color: var(--text-primary); background: var(--bg-hover); }

.lcpm-search {
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
.lcpm-search:focus-within {
  border-color: var(--accent);
  color: var(--text-primary);
}
.lcpm-search input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: 13px;
}

.lcpm-state {
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

.lcpm-list {
  list-style: none;
  margin: 12px 0;
  padding: 0 16px 16px;
  overflow-y: auto;
  flex: 1;
}

.lcpm-item {
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
.lcpm-item:hover:not(:disabled):not(.is-linked) {
  background: var(--bg-hover);
  border-color: var(--accent);
}
.lcpm-item.is-linked {
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-primary));
  border-color: var(--accent);
  cursor: not-allowed;
  opacity: 0.7;
}

.lcpm-item-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.lcpm-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lcpm-item-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
}

.lcpm-item-action {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  padding: 4px 10px;
  background: var(--bg-secondary);
  border-radius: 6px;
  flex-shrink: 0;
  min-width: 56px;
  text-align: center;
}
.is-linked .lcpm-item-action {
  background: var(--accent);
  color: white;
}

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
