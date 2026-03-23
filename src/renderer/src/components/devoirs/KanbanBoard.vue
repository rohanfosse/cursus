/** KanbanBoard — tableau de suivi de tâches par groupe (4 colonnes fixes). */
<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { Plus, Trash2, GripVertical, AlertCircle } from 'lucide-vue-next'
  import { VueDraggable } from 'vue-draggable-plus'
  import { useKanbanStore } from '@/stores/kanban'
  import type { KanbanCard } from '@/types'

  const props = defineProps<{
    travailId: number
    groupId:   number
    readOnly?: boolean
  }>()

  const kanban = useKanbanStore()

  const COLUMNS: { key: KanbanCard['status']; label: string; color: string }[] = [
    { key: 'todo',    label: 'À faire',  color: '#64748b' },
    { key: 'doing',   label: 'En cours', color: '#3b82f6' },
    { key: 'blocked', label: 'Bloqué',   color: '#ef4444' },
    { key: 'done',    label: 'Terminé',  color: '#22c55e' },
  ]

  const newCardTitle = ref<Record<string, string>>({
    todo: '', doing: '', blocked: '', done: '',
  })
  const addingIn  = ref<string | null>(null)

  const byStatus = computed(() => {
    const map: Record<string, KanbanCard[]> = { todo: [], doing: [], blocked: [], done: [] }
    for (const c of kanban.cards) {
      if (map[c.status]) map[c.status].push(c)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.position - b.position)
    }
    return map
  })

  onMounted(() => kanban.fetchCards(props.travailId, props.groupId))

  // ── Drag & drop ──────────────────────────────────────────────────────────
  function onEnd(evt: { item: HTMLElement; from: HTMLElement; to: HTMLElement; newIndex: number }) {
    const cardId = Number(evt.item.dataset.id)
    const newStatus = evt.to.dataset.status as KanbanCard['status']
    kanban.moveCard(cardId, newStatus, evt.newIndex)
  }

  // ── Add card ─────────────────────────────────────────────────────────────
  async function addCard(status: KanbanCard['status']) {
    const title = newCardTitle.value[status]?.trim()
    if (!title) return
    await kanban.createCard(props.travailId, props.groupId, { title })
    newCardTitle.value[status] = ''
    addingIn.value = null
  }

  function cancelAdd() {
    addingIn.value = null
  }
</script>

<template>
  <div class="kb-board">
    <div
      v-for="col in COLUMNS"
      :key="col.key"
      class="kb-column"
    >
      <!-- Column header -->
      <div class="kb-col-header" :style="{ borderTopColor: col.color }">
        <span class="kb-col-title">{{ col.label }}</span>
        <span class="kb-col-count">{{ byStatus[col.key]?.length ?? 0 }}</span>
      </div>

      <!-- Cards drop zone -->
      <VueDraggable
        v-if="!readOnly"
        v-model="byStatus[col.key]"
        :data-status="col.key"
        group="kanban"
        item-key="id"
        animation="150"
        ghost-class="kb-ghost"
        class="kb-cards"
        @end="onEnd"
      >
        <div
          v-for="card in byStatus[col.key]"
          :key="card.id"
          :data-id="card.id"
          class="kb-card"
        >
          <GripVertical :size="12" class="kb-grip" />
          <span class="kb-card-title">{{ card.title }}</span>
          <p v-if="card.description" class="kb-card-desc">{{ card.description }}</p>
          <button class="kb-card-del" @click="kanban.deleteCard(card.id)">
            <Trash2 :size="12" />
          </button>
        </div>
      </VueDraggable>

      <!-- Read-only card list (prof) -->
      <div v-else class="kb-cards">
        <div v-for="card in byStatus[col.key]" :key="card.id" class="kb-card kb-card-readonly">
          <span class="kb-card-title">{{ card.title }}</span>
          <p v-if="card.description" class="kb-card-desc">{{ card.description }}</p>
          <span v-if="card.created_by" class="kb-card-author">{{ card.created_by }}</span>
        </div>
        <div v-if="byStatus[col.key].length === 0" class="kb-empty">
          <AlertCircle :size="14" /> Aucune carte
        </div>
      </div>

      <!-- Add card form (students only) -->
      <template v-if="!readOnly">
        <div v-if="addingIn === col.key" class="kb-add-form">
          <input
            v-model="newCardTitle[col.key]"
            type="text"
            class="kb-add-input"
            placeholder="Titre de la tâche..."
            autofocus
            @keydown.enter="addCard(col.key)"
            @keydown.escape="cancelAdd"
          />
          <div class="kb-add-actions">
            <button class="kb-btn-add" @click="addCard(col.key)">Ajouter</button>
            <button class="kb-btn-cancel" @click="cancelAdd">Annuler</button>
          </div>
        </div>
        <button v-else class="kb-add-btn" @click="addingIn = col.key">
          <Plus :size="13" /> Ajouter
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.kb-board {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  min-height: 300px;
}
@media (max-width: 900px) {
  .kb-board { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 560px) {
  .kb-board { grid-template-columns: 1fr; }
}

.kb-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 200px;
}

.kb-col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 8px;
  border-top: 3px solid;
  border-radius: 8px 8px 0 0;
  background: var(--bg-elevated, #1e1f21);
}
.kb-col-title {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--text-primary, #fff);
}
.kb-col-count {
  font-size: 11px; font-weight: 700;
  background: rgba(255,255,255,.08);
  padding: 1px 6px; border-radius: 10px;
  color: var(--text-muted, #888);
}

.kb-cards {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
  min-height: 60px;
}

.kb-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 34px 10px 30px;
  background: var(--bg-elevated, #1e1f21);
  border: 1px solid var(--border, rgba(255,255,255,.08));
  border-radius: 8px;
  cursor: grab;
  transition: border-color .15s, box-shadow .15s;
}
.kb-card:hover { border-color: rgba(255,255,255,.18); box-shadow: 0 2px 8px rgba(0,0,0,.2); }
.kb-card.kb-ghost { opacity: .4; border-style: dashed; }
.kb-card-readonly { cursor: default; padding: 10px 12px; }
.kb-grip {
  position: absolute; left: 10px; top: 50%; transform: translateY(-50%);
  color: var(--text-muted, #888); flex-shrink: 0;
}
.kb-card-title {
  font-size: 13px; font-weight: 500; color: var(--text-primary, #fff);
  word-break: break-word;
}
.kb-card-desc {
  font-size: 11px; color: var(--text-muted, #888);
  margin: 0; word-break: break-word;
}
.kb-card-author {
  font-size: 10px; color: var(--text-muted, #888); font-style: italic;
}
.kb-card-del {
  position: absolute; right: 8px; top: 8px;
  background: transparent; border: none; cursor: pointer;
  color: var(--text-muted, #888);
  opacity: 0; transition: opacity .15s, color .15s;
  padding: 2px;
}
.kb-card:hover .kb-card-del { opacity: 1; }
.kb-card-del:hover { color: #ef4444; }

.kb-empty {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--text-muted, #888);
  padding: 12px; justify-content: center;
  border: 1px dashed rgba(255,255,255,.08);
  border-radius: 8px;
}

/* ── Add form ── */
.kb-add-form {
  display: flex; flex-direction: column; gap: 8px;
}
.kb-add-input {
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,.12);
  background: var(--bg-elevated, #1e1f21);
  color: var(--text-primary, #fff);
  font-size: 13px; font-family: var(--font, inherit);
  outline: none; box-sizing: border-box;
  transition: border-color .15s;
}
.kb-add-input:focus { border-color: #3b82f6; }
.kb-add-actions { display: flex; gap: 6px; }
.kb-btn-add {
  flex: 1; padding: 6px 10px; border-radius: 6px; border: none;
  background: #3b82f6; color: #fff;
  font-size: 12px; font-weight: 600; cursor: pointer;
  font-family: var(--font, inherit); transition: background .15s;
}
.kb-btn-add:hover { background: #60a5fa; }
.kb-btn-cancel {
  padding: 6px 10px; border-radius: 6px;
  border: 1px solid var(--border, rgba(255,255,255,.08));
  background: transparent; color: var(--text-secondary, #aaa);
  font-size: 12px; font-weight: 600; cursor: pointer;
  font-family: var(--font, inherit);
}

.kb-add-btn {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 12px; border-radius: 6px;
  border: 1px dashed rgba(255,255,255,.1);
  background: transparent; color: var(--text-muted, #888);
  font-size: 12px; font-weight: 600; cursor: pointer;
  font-family: var(--font, inherit); transition: all .15s;
  align-self: flex-start;
}
.kb-add-btn:hover { border-color: #3b82f6; color: #3b82f6; }
</style>
