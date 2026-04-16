/**
 * LiveBoard : tableau collaboratif avec post-its et votes.
 * Chaque utilisateur peut ajouter des post-its, voter.
 * Broadcast temps reel via socket live:board-update.
 */
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { Plus, ThumbsUp, Trash2, StickyNote } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import type { BoardCard } from '@/types'

const props = defineProps<{
  activityId: number
  isTeacher: boolean
  columns?: string[]
}>()

const { showToast } = useToast()
const cards = ref<BoardCard[]>([])
const newCardContent = ref('')
const newCardColumn = ref('')
const loading = ref(false)
let unsubscribe: (() => void) | null = null

const POST_IT_COLORS = ['#fef08a', '#fecaca', '#bfdbfe', '#bbf7d0', '#ddd6fe', '#fed7aa']
const defaultColumns = ['Idees', 'A approfondir', 'A ecarter']

const columnsList = computed(() => props.columns && props.columns.length > 0 ? props.columns : defaultColumns)

const cardsByColumn = computed(() => {
  const map: Record<string, BoardCard[]> = {}
  for (const col of columnsList.value) map[col] = []
  for (const card of cards.value) {
    if (!map[card.column_name]) map[card.column_name] = []
    map[card.column_name].push(card)
  }
  return map
})

async function fetchCards() {
  loading.value = true
  try {
    const res = await window.api.getLiveV2BoardCards(props.activityId)
    if (res?.ok && res.data) cards.value = res.data
  } finally {
    loading.value = false
  }
}

async function addCard(columnName: string) {
  const content = newCardContent.value.trim()
  if (!content) return
  const color = POST_IT_COLORS[Math.floor(Math.random() * POST_IT_COLORS.length)]
  const res = await window.api.addLiveV2BoardCard(props.activityId, {
    columnName, content, color,
  })
  if (res?.ok) {
    newCardContent.value = ''
    newCardColumn.value = ''
    showToast('Post-it ajoute', 'success')
  }
}

async function deleteCard(card: BoardCard) {
  if (!confirm('Supprimer ce post-it ?')) return
  await window.api.deleteLiveV2BoardCard(card.id)
}

async function voteCard(card: BoardCard) {
  const currentlyVoted = card.voted_by_me ?? false
  await window.api.voteLiveV2BoardCard(card.id, !currentlyVoted)
  // Optimistic update
  card.voted_by_me = !currentlyVoted
  card.votes = Math.max(0, card.votes + (currentlyVoted ? -1 : 1))
}

onMounted(() => {
  fetchCards()
  unsubscribe = window.api.onLiveBoardUpdate((data) => {
    if (data.activityId !== props.activityId) return
    if (data.action === 'add' && data.card) {
      const card = data.card as BoardCard
      // Avoid duplicates
      if (!cards.value.find(c => c.id === card.id)) cards.value.push(card)
    } else if (data.action === 'delete' && data.cardId) {
      cards.value = cards.value.filter(c => c.id !== data.cardId)
    } else if (data.action === 'vote' && data.cardId && data.votes !== undefined) {
      const c = cards.value.find(c => c.id === data.cardId)
      if (c) c.votes = data.votes
    }
  })
})

onBeforeUnmount(() => {
  unsubscribe?.()
})
</script>

<template>
  <div class="lb-wrap">
    <div class="lb-header">
      <StickyNote :size="14" class="lb-icon" />
      <span class="lb-title">Tableau collaboratif</span>
      <span class="lb-count">{{ cards.length }} post-it{{ cards.length > 1 ? 's' : '' }}</span>
    </div>

    <div class="lb-columns">
      <div v-for="col in columnsList" :key="col" class="lb-column">
        <div class="lb-column-header">
          <span class="lb-column-title">{{ col }}</span>
          <span class="lb-column-count">{{ cardsByColumn[col]?.length || 0 }}</span>
        </div>

        <div class="lb-cards">
          <div
            v-for="card in cardsByColumn[col] || []"
            :key="card.id"
            class="lb-card"
            :style="{ background: card.color }"
          >
            <div class="lb-card-content">{{ card.content }}</div>
            <div class="lb-card-footer">
              <span class="lb-card-author">{{ card.author_name }}</span>
              <div class="lb-card-actions">
                <button
                  class="lb-vote-btn"
                  :class="{ 'lb-vote-btn--active': card.voted_by_me }"
                  @click="voteCard(card)"
                >
                  <ThumbsUp :size="11" />
                  <span>{{ card.votes }}</span>
                </button>
                <button
                  v-if="isTeacher"
                  class="lb-delete-btn"
                  title="Supprimer"
                  @click="deleteCard(card)"
                >
                  <Trash2 :size="11" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Form d'ajout -->
        <div class="lb-add-form">
          <textarea
            v-if="newCardColumn === col"
            v-model="newCardContent"
            class="lb-add-input"
            placeholder="Votre idee..."
            rows="2"
            @keydown.enter.prevent="addCard(col)"
            @blur="!newCardContent ? newCardColumn = '' : undefined"
            @keydown.escape="newCardContent = ''; newCardColumn = ''"
          />
          <div v-if="newCardColumn === col" class="lb-add-actions">
            <button class="lb-add-confirm" @click="addCard(col)">
              Ajouter
            </button>
            <button class="lb-add-cancel" @click="newCardContent = ''; newCardColumn = ''">
              Annuler
            </button>
          </div>
          <button
            v-else
            class="lb-add-btn"
            @click="newCardColumn = col"
          >
            <Plus :size="13" /> Ajouter un post-it
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lb-wrap { display: flex; flex-direction: column; gap: 12px; }
.lb-header {
  display: flex; align-items: center; gap: 8px;
  padding: 0 4px;
}
.lb-icon { color: #a855f7; }
.lb-title { font-size: 14px; font-weight: 700; color: var(--text-primary); flex: 1; }
.lb-count { font-size: 11px; color: var(--text-muted); }

.lb-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}
.lb-column {
  display: flex; flex-direction: column;
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 10px; padding: 10px; min-height: 200px;
}
.lb-column-header {
  display: flex; align-items: center; gap: 6px;
  padding-bottom: 8px; border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
.lb-column-title {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .4px; color: var(--text-secondary); flex: 1;
}
.lb-column-count {
  font-size: 10px; font-weight: 700; padding: 1px 6px;
  border-radius: 8px; background: var(--bg-active); color: var(--text-muted);
}

.lb-cards { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.lb-card {
  padding: 10px 12px; border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,.12);
  transition: transform .15s, box-shadow .15s;
}
.lb-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(0,0,0,.2);
}
.lb-card-content {
  font-size: 13px; line-height: 1.4;
  color: #1f2937; font-weight: 500;
  margin-bottom: 6px; white-space: pre-wrap;
}
.lb-card-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: 5px; border-top: 1px solid rgba(0,0,0,.08);
}
.lb-card-author {
  font-size: 10px; color: rgba(0,0,0,.55); font-weight: 600;
}
.lb-card-actions { display: flex; gap: 4px; }

.lb-vote-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 700; padding: 2px 7px;
  border-radius: 10px; border: 1px solid rgba(0,0,0,.15);
  background: rgba(255,255,255,.6); color: rgba(0,0,0,.75);
  cursor: pointer; font-family: var(--font); transition: all .15s;
}
.lb-vote-btn:hover { background: rgba(255,255,255,.9); }
.lb-vote-btn--active {
  background: var(--accent); color: #fff; border-color: var(--accent);
}
.lb-delete-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 6px;
  border: none; background: rgba(0,0,0,.08);
  color: rgba(0,0,0,.6); cursor: pointer; transition: all .15s;
}
.lb-delete-btn:hover { background: rgba(231,76,60,.2); color: #dc2626; }

.lb-add-form { margin-top: 8px; }
.lb-add-input {
  width: 100%; font-family: var(--font); font-size: 13px;
  padding: 8px; border: 2px dashed var(--border-input);
  border-radius: 6px; background: var(--bg-input);
  color: var(--text-primary); resize: vertical; outline: none;
}
.lb-add-input:focus { border-color: var(--accent); border-style: solid; }
.lb-add-actions { display: flex; gap: 4px; margin-top: 4px; }
.lb-add-confirm {
  flex: 1; font-size: 11px; font-weight: 600; padding: 5px 10px;
  border: none; border-radius: 6px; background: var(--accent);
  color: #fff; cursor: pointer; font-family: var(--font);
}
.lb-add-cancel {
  font-size: 11px; padding: 5px 10px;
  border: 1px solid var(--border); border-radius: 6px;
  background: transparent; color: var(--text-muted);
  cursor: pointer; font-family: var(--font);
}
.lb-add-btn {
  display: flex; align-items: center; justify-content: center; gap: 5px;
  width: 100%; font-size: 11px; padding: 6px;
  border: 1px dashed var(--border-input); border-radius: 6px;
  background: transparent; color: var(--text-muted);
  cursor: pointer; font-family: var(--font); transition: all .15s;
}
.lb-add-btn:hover { border-color: var(--accent); color: var(--accent); background: rgba(74,144,217,.05); }
</style>
