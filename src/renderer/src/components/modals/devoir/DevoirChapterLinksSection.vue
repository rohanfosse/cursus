<script setup lang="ts">
/**
 * Section "Chapitres Lumen lies" affichee dans le GestionDevoirModal cote
 * teacher. Permet de :
 *  - voir les chapitres deja lies a ce devoir
 *  - en retirer un (unlink)
 *  - en ajouter un via LumenChapterPickerModal
 *
 * Cote etudiant, l'affichage equivalent est porte par LumenDevoirChapterHints
 * (composant separe utilise dans StudentDevoirCard). On garde les deux pour
 * eviter de mutualiser deux contextes UX differents (gestion vs lecture).
 */
import { ref, computed, onMounted, watch } from 'vue'
import { BookOpen, Plus, X, Loader2, ExternalLink } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import LumenChapterPickerModal from '@/components/lumen/LumenChapterPickerModal.vue'
import {
  toDisplayChapter,
  buildLinkedKeys,
  type DisplayChapter,
} from '@/utils/lumenDevoirLinks'
import type { LumenLinkedChapter } from '@/types'

interface Props {
  travailId: number
  promoId: number | null
}

const props = defineProps<Props>()

const router = useRouter()
const { showToast } = useToast()

const linked = ref<LumenLinkedChapter[]>([])
const loading = ref(false)
const removingKey = ref<string | null>(null)
const pickerOpen = ref(false)

const display = computed<DisplayChapter[]>(() => linked.value.map(toDisplayChapter))

const linkedKeys = computed<Set<string>>(() => buildLinkedKeys(display.value))

async function load(): Promise<void> {
  loading.value = true
  try {
    const resp = await window.api.getLumenChaptersForTravail(props.travailId) as {
      ok: boolean
      data?: { chapters: LumenLinkedChapter[] }
    }
    linked.value = resp?.ok && resp.data ? resp.data.chapters : []
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.travailId, load)

async function handleLink(repoId: number, path: string): Promise<void> {
  const resp = await window.api.linkLumenChapterToTravail(props.travailId, repoId, path) as {
    ok: boolean
    error?: string
  }
  if (!resp?.ok) {
    showToast(resp?.error ?? 'Echec de la liaison', 'error')
    return
  }
  showToast('Chapitre lie au devoir', 'success')
  pickerOpen.value = false
  await load()
}

async function handleUnlink(item: DisplayChapter): Promise<void> {
  removingKey.value = item.key
  try {
    const resp = await window.api.unlinkLumenChapterFromTravail(
      props.travailId,
      item.repoId,
      item.path,
    ) as { ok: boolean; error?: string }
    if (!resp?.ok) {
      showToast(resp?.error ?? 'Echec de la deliaison', 'error')
      return
    }
    showToast('Chapitre retire', 'success')
    await load()
  } finally {
    removingKey.value = null
  }
}

function openInLumen(item: DisplayChapter): void {
  router.push({
    name: 'lumen',
    query: { repo: String(item.repoId), chapter: item.path },
  })
}
</script>

<template>
  <section class="dcls">
    <header class="dcls-head">
      <h4>
        <BookOpen :size="13" />
        Chapitres Lumen lies
      </h4>
      <button
        type="button"
        class="dcls-add"
        :disabled="promoId == null"
        :title="promoId == null ? 'Aucune promo active' : 'Lier un chapitre'"
        @click="pickerOpen = true"
      >
        <Plus :size="12" /> Lier un chapitre
      </button>
    </header>

    <div v-if="loading" class="dcls-state">
      <Loader2 :size="14" class="spin" /> Chargement...
    </div>
    <p v-else-if="display.length === 0" class="dcls-empty">
      Aucun chapitre lie. Les etudiants verront un lien direct vers le chapitre depuis ce devoir.
    </p>
    <ul v-else class="dcls-list">
      <li v-for="item in display" :key="item.key">
        <div class="dcls-item">
          <button
            type="button"
            class="dcls-item-main"
            :title="`Ouvrir ${item.title} dans Lumen`"
            @click="openInLumen(item)"
          >
            <span class="dcls-item-title">{{ item.title }}</span>
            <span class="dcls-item-project">
              <ExternalLink :size="10" /> {{ item.projectName }}
            </span>
          </button>
          <button
            type="button"
            class="dcls-item-remove"
            :disabled="removingKey === item.key"
            :title="`Retirer ${item.title}`"
            :aria-label="`Retirer ${item.title}`"
            @click="handleUnlink(item)"
          >
            <Loader2 v-if="removingKey === item.key" :size="12" class="spin" />
            <X v-else :size="12" />
          </button>
        </div>
      </li>
    </ul>

    <LumenChapterPickerModal
      v-if="pickerOpen && promoId != null"
      :promo-id="promoId"
      :already-linked-keys="linkedKeys"
      @close="pickerOpen = false"
      @link="handleLink"
    />
  </section>
</template>

<style scoped>
.dcls {
  padding: 8px 20px 12px;
}
.dcls-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.dcls-head h4 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.dcls-add {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  border: 1px solid var(--border-input);
  cursor: pointer;
  font-family: inherit;
  transition: all var(--t-fast, 150ms) ease;
}
.dcls-add:hover:not(:disabled) {
  background: var(--bg-elevated);
  color: var(--accent);
  border-color: var(--accent);
}
.dcls-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dcls-state,
.dcls-empty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px 0;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.dcls-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.dcls-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.dcls-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background var(--t-fast, 150ms) ease;
}
.dcls-item-main:hover {
  background: var(--bg-hover);
}
.dcls-item-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dcls-item-project {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: var(--text-muted);
}
.dcls-item-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-left: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px 10px;
  transition: all var(--t-fast, 150ms) ease;
  font-family: inherit;
}
.dcls-item-remove:hover:not(:disabled) {
  background: rgba(231, 76, 60, 0.1);
  color: var(--color-danger);
}
.dcls-item-remove:disabled {
  cursor: wait;
  opacity: 0.6;
}

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
