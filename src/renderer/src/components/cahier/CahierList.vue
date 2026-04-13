/**
 * Liste des cahiers dans la vue Documents/Canal.
 * Affiche les cahiers existants avec un bouton de creation.
 */
<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { BookOpen, Plus, Trash2, Clock } from 'lucide-vue-next'
import { useCahierStore } from '@/stores/cahier'
import { useAppStore } from '@/stores/app'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { relativeTime } from '@/utils/date'

const cahierStore = useCahierStore()
const appStore = useAppStore()
const { confirm } = useConfirm()
const { showToast } = useToast()

onMounted(() => cahierStore.fetchCahiers())
watch(() => appStore.activeProject, () => cahierStore.fetchCahiers())
watch(() => appStore.activePromoId, () => cahierStore.fetchCahiers())

async function handleCreate() {
  const id = await cahierStore.createCahier()
  if (id) {
    cahierStore.openCahier(id)
    showToast('Cahier cree.', 'success')
  }
}

async function handleDelete(id: number, e: Event) {
  e.stopPropagation()
  if (!await confirm('Supprimer ce cahier ?', 'danger', 'Supprimer')) return
  await cahierStore.deleteCahier(id)
  showToast('Cahier supprime.', 'success')
}
</script>

<template>
  <div class="cahier-section">
    <div class="cahier-section-header">
      <BookOpen :size="14" />
      <span class="cahier-section-title">Cahiers</span>
      <span class="cahier-section-count">{{ cahierStore.cahiers.length }}</span>
      <button class="cahier-add-btn" @click="handleCreate">
        <Plus :size="13" /> Nouveau
      </button>
    </div>

    <div v-if="cahierStore.loading" class="cahier-loading">
      <div v-for="i in 2" :key="i" class="skel skel-line" style="height:40px;border-radius:8px;margin-bottom:6px" />
    </div>

    <div v-else-if="cahierStore.cahiers.length === 0" class="cahier-empty">
      <p>Aucun cahier pour le moment.</p>
      <button class="cahier-empty-btn" @click="handleCreate">
        <Plus :size="13" /> Creer un cahier
      </button>
    </div>

    <div v-else class="cahier-list">
      <div
        v-for="c in cahierStore.cahiers"
        :key="c.id"
        class="cahier-item"
        @click="cahierStore.openCahier(c.id)"
      >
        <BookOpen :size="16" class="cahier-item-icon" />
        <div class="cahier-item-info">
          <span class="cahier-item-title">{{ c.title }}</span>
          <span class="cahier-item-meta">
            <Clock :size="9" /> {{ relativeTime(c.updated_at) }}
            <span v-if="c.author_name" class="cahier-item-author">par {{ c.author_name }}</span>
          </span>
        </div>
        <button
          v-if="appStore.isTeacher"
          class="cahier-item-delete"
          title="Supprimer"
          @click="handleDelete(c.id, $event)"
        >
          <Trash2 :size="12" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cahier-section {
  border: 1px solid var(--border); border-radius: 10px;
  background: var(--bg-sidebar); overflow: hidden;
}

.cahier-section-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 14px; border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,.02);
}
.cahier-section-title { font-size: 13px; font-weight: 700; color: var(--text-primary); flex: 1; }
.cahier-section-count {
  font-size: 10px; font-weight: 700; padding: 1px 6px;
  border-radius: 8px; background: var(--bg-active); color: var(--text-muted);
}
.cahier-add-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; padding: 4px 10px;
  border-radius: 6px; border: 1px dashed var(--border-input);
  background: transparent; color: var(--accent);
  cursor: pointer; font-family: var(--font); transition: all .15s;
}
.cahier-add-btn:hover { background: rgba(74,144,217,.06); border-color: var(--accent); }

.cahier-loading { padding: 10px 14px; }

.cahier-empty {
  padding: 20px 14px; text-align: center;
}
.cahier-empty p { font-size: 12px; color: var(--text-muted); margin-bottom: 10px; }
.cahier-empty-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 12px; font-weight: 600; padding: 6px 14px;
  border-radius: 8px; border: none;
  background: var(--accent); color: #fff;
  cursor: pointer; font-family: var(--font);
}

.cahier-list { display: flex; flex-direction: column; }

.cahier-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background .15s;
}
.cahier-item:last-child { border-bottom: none; }
.cahier-item:hover { background: var(--bg-hover); }

.cahier-item-icon { color: var(--accent); flex-shrink: 0; }

.cahier-item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cahier-item-title {
  font-size: 13px; font-weight: 600; color: var(--text-primary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cahier-item-meta {
  display: flex; align-items: center; gap: 4px;
  font-size: 10px; color: var(--text-muted);
}
.cahier-item-author { opacity: .7; }

.cahier-item-delete {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 6px;
  border: none; background: transparent; color: var(--text-muted);
  cursor: pointer; opacity: 0; transition: all .15s;
}
.cahier-item:hover .cahier-item-delete { opacity: 1; }
.cahier-item-delete:hover { background: rgba(231,76,60,.1); color: var(--color-danger); }
</style>
