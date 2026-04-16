/**
 * LiveBoard v2 : tableau collaboratif avec post-its, votes, drag & drop,
 * choix de couleur, edition inline, animations, export et mode anonyme.
 */
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import {
  Plus, ThumbsUp, Trash2, StickyNote, Crown, Palette,
  GripVertical, Pencil, Check, X, Download, EyeOff, Eye, Users,
} from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
import { useAppStore } from '@/stores/app'
import type { BoardCard } from '@/types'

const props = defineProps<{
  activityId: number
  isTeacher: boolean
  columns?: string[]
  maxVotes?: number
}>()

const { showToast } = useToast()
const appStore = useAppStore()
const cards = ref<BoardCard[]>([])
const newCardContent = ref('')
const newCardColumn = ref('')
const newCardColor = ref('#fef08a')
const loading = ref(false)
const anonymousMode = ref(false)
const editingCardId = ref<number | null>(null)
const editingContent = ref('')
const dragCardId = ref<number | null>(null)
const dragOverColumn = ref<string | null>(null)
let unsubscribe: (() => void) | null = null

const POST_IT_COLORS = [
  { value: '#fef08a', label: 'Jaune' },
  { value: '#fecaca', label: 'Rouge' },
  { value: '#bfdbfe', label: 'Bleu' },
  { value: '#bbf7d0', label: 'Vert' },
  { value: '#ddd6fe', label: 'Violet' },
  { value: '#fed7aa', label: 'Orange' },
  { value: '#fbcfe8', label: 'Rose' },
  { value: '#e5e7eb', label: 'Gris' },
]
const defaultColumns = ['Idees', 'A approfondir', 'A ecarter']

const columnsList = computed(() => props.columns && props.columns.length > 0 ? props.columns : defaultColumns)

const cardsByColumn = computed(() => {
  const map: Record<string, BoardCard[]> = {}
  for (const col of columnsList.value) map[col] = []
  for (const card of cards.value) {
    const colName = card.column_name || columnsList.value[0]
    if (!map[colName]) map[colName] = []
    map[colName].push(card)
  }
  for (const col of Object.values(map)) {
    col.sort((a, b) => b.votes - a.votes)
  }
  return map
})

const totalVotes = computed(() => cards.value.reduce((s, c) => s + c.votes, 0))
const totalCards = computed(() => cards.value.length)
const uniqueAuthors = computed(() => new Set(cards.value.map(c => c.author_id)).size)

const myVotesUsed = computed(() => cards.value.filter(c => c.voted_by_me).length)
const maxVotesPerPerson = computed(() => props.maxVotes ?? 3)
const canVote = computed(() => myVotesUsed.value < maxVotesPerPerson.value)

const topCardId = computed(() => {
  let best: BoardCard | null = null
  for (const col of Object.values(cardsByColumn.value)) {
    if (col.length > 0 && col[0].votes > 0) {
      if (!best || col[0].votes > best.votes) best = col[0]
    }
  }
  return best?.id ?? null
})

// ── CRUD ────────────────────────────────────────────────────────────────

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
  const res = await window.api.addLiveV2BoardCard(props.activityId, {
    columnName, content, color: newCardColor.value,
  })
  if (res?.ok) {
    newCardContent.value = ''
    newCardColumn.value = ''
  }
}

async function deleteCard(card: BoardCard) {
  await window.api.deleteLiveV2BoardCard(card.id)
}

function isOwnCard(card: BoardCard): boolean {
  return card.author_id === (appStore.currentUser?.id ?? -1)
}

async function voteCard(card: BoardCard) {
  const currentlyVoted = card.voted_by_me ?? false
  if (!currentlyVoted && isOwnCard(card)) return
  if (!currentlyVoted && !canVote.value) return
  await window.api.voteLiveV2BoardCard(card.id, !currentlyVoted)
  card.voted_by_me = !currentlyVoted
  card.votes = Math.max(0, card.votes + (currentlyVoted ? -1 : 1))
}

// ── Edit inline ─────────────────────────────────────────────────────────

function startEdit(card: BoardCard) {
  if (!isOwnCard(card) && !props.isTeacher) return
  editingCardId.value = card.id
  editingContent.value = card.content
  nextTick(() => {
    const el = document.querySelector('.lb-edit-input') as HTMLTextAreaElement
    el?.focus()
  })
}

async function saveEdit(card: BoardCard) {
  const content = editingContent.value.trim()
  if (!content) return
  editingCardId.value = null
  const res = await window.api.updateLiveV2BoardCard(card.id, { content })
  if (res?.ok && res.data) {
    const idx = cards.value.findIndex(c => c.id === card.id)
    if (idx !== -1) cards.value[idx] = { ...cards.value[idx], ...res.data }
  }
}

function cancelEdit() {
  editingCardId.value = null
  editingContent.value = ''
}

// ── Drag & drop ─────────────────────────────────────────────────────────

function onDragStart(card: BoardCard, e?: DragEvent) {
  if (!isOwnCard(card) && !props.isTeacher) return
  dragCardId.value = card.id
  if (e?.dataTransfer) {
    e.dataTransfer.setData('text/plain', String(card.id))
    e.dataTransfer.effectAllowed = 'move'
  }
}

function onDragOverCol(col: string, e: DragEvent) {
  e.preventDefault()
  dragOverColumn.value = col
}

function onDragLeaveCol() {
  dragOverColumn.value = null
}

async function onDropCol(col: string) {
  if (dragCardId.value == null) return
  const card = cards.value.find(c => c.id === dragCardId.value)
  if (card && card.column_name !== col) {
    const oldCol = card.column_name
    // Optimistic update
    const idx = cards.value.findIndex(c => c.id === card.id)
    if (idx !== -1) cards.value[idx] = { ...cards.value[idx], column_name: col }
    // Persist
    const res = await window.api.updateLiveV2BoardCard(card.id, { columnName: col })
    if (!res?.ok) {
      // Revert on failure
      if (idx !== -1) cards.value[idx] = { ...cards.value[idx], column_name: oldCol }
    }
  }
  dragCardId.value = null
  dragOverColumn.value = null
}

function onDragEnd() {
  dragCardId.value = null
  dragOverColumn.value = null
}

// ── Export ───────────────────────────────────────────────────────────────

function exportBoard() {
  const lines: string[] = []
  for (const col of columnsList.value) {
    lines.push(`## ${col}`)
    const colCards = cardsByColumn.value[col] || []
    if (colCards.length === 0) {
      lines.push('_(vide)_\n')
    } else {
      for (const card of colCards) {
        const author = anonymousMode.value ? '' : ` (${card.author_name})`
        lines.push(`- ${card.content}${author} [${card.votes} vote${card.votes > 1 ? 's' : ''}]`)
      }
      lines.push('')
    }
  }
  const text = lines.join('\n')
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `board-${new Date().toISOString().slice(0, 10)}.md`
  a.click()
  URL.revokeObjectURL(url)
  showToast('Tableau exporte en Markdown', 'success')
}

// ── Socket ──────────────────────────────────────────────────────────────

onMounted(() => {
  fetchCards()
  unsubscribe = window.api.onLiveBoardUpdate((data) => {
    if (data.activityId !== props.activityId) return
    if (data.action === 'add' && data.card) {
      const card = data.card as BoardCard
      if (!cards.value.find(c => c.id === card.id)) cards.value.push(card)
    } else if (data.action === 'delete' && data.cardId) {
      cards.value = cards.value.filter(c => c.id !== data.cardId)
    } else if (data.action === 'update' && data.card) {
      const updated = data.card as BoardCard
      const idx = cards.value.findIndex(c => c.id === updated.id)
      if (idx !== -1) cards.value[idx] = { ...cards.value[idx], ...updated }
    } else if (data.action === 'vote' && data.cardId && data.votes !== undefined) {
      const c = cards.value.find(c => c.id === data.cardId)
      if (c) c.votes = data.votes
    }
  })
})

onBeforeUnmount(() => { unsubscribe?.() })
</script>

<template>
  <div class="lb-wrap">
    <!-- Header -->
    <div class="lb-header">
      <StickyNote :size="14" class="lb-icon" />
      <span class="lb-title">Tableau collaboratif</span>
      <span class="lb-stat">{{ totalCards }} post-it{{ totalCards > 1 ? 's' : '' }}</span>
      <span v-if="totalVotes > 0" class="lb-stat lb-stat--accent">{{ totalVotes }} vote{{ totalVotes > 1 ? 's' : '' }}</span>
      <span class="lb-stat"><Users :size="10" /> {{ uniqueAuthors }}</span>
      <div class="lb-header-actions">
        <button v-if="isTeacher" class="lb-hdr-btn" :class="{ active: anonymousMode }" title="Mode anonyme" @click="anonymousMode = !anonymousMode">
          <EyeOff v-if="anonymousMode" :size="13" />
          <Eye v-else :size="13" />
        </button>
        <button class="lb-hdr-btn" title="Exporter en Markdown" @click="exportBoard">
          <Download :size="13" />
        </button>
      </div>
      <span class="lb-my-votes">{{ myVotesUsed }}/{{ maxVotesPerPerson }} votes</span>
    </div>

    <!-- Columns -->
    <div class="lb-columns">
      <div
        v-for="col in columnsList"
        :key="col"
        class="lb-column"
        :class="{ 'lb-column--dragover': dragOverColumn === col }"
        @dragover="onDragOverCol(col, $event)"
        @dragleave="onDragLeaveCol"
        @drop="onDropCol(col)"
      >
        <div class="lb-column-header">
          <span class="lb-column-title">{{ col }}</span>
          <span class="lb-column-count">{{ cardsByColumn[col]?.length || 0 }}</span>
        </div>

        <TransitionGroup name="card-list" tag="div" class="lb-cards">
          <div
            v-for="card in cardsByColumn[col] || []"
            :key="card.id"
            class="lb-card"
            :class="{
              'lb-card--top': topCardId === card.id,
              'lb-card--own': isOwnCard(card),
              'lb-card--dragging': dragCardId === card.id,
            }"
            :style="{ background: card.color }"
            :draggable="isOwnCard(card) || isTeacher"
            @dragstart="onDragStart(card, $event)"
            @dragend="onDragEnd"
          >
            <Crown v-if="topCardId === card.id" :size="12" class="lb-top-badge" />

            <!-- Edit mode -->
            <template v-if="editingCardId === card.id">
              <textarea
                v-model="editingContent"
                class="lb-edit-input"
                rows="2"
                @keydown.enter.prevent="saveEdit(card)"
                @keydown.escape="cancelEdit"
              />
              <div class="lb-edit-actions">
                <button class="lb-edit-save" @click="saveEdit(card)"><Check :size="12" /></button>
                <button class="lb-edit-cancel" @click="cancelEdit"><X :size="12" /></button>
              </div>
            </template>

            <!-- Normal mode -->
            <template v-else>
              <div class="lb-card-content" @dblclick="startEdit(card)">{{ card.content }}</div>
              <div class="lb-card-footer">
                <span class="lb-card-author">{{ anonymousMode ? 'Anonyme' : card.author_name }}</span>
                <div class="lb-card-actions">
                  <button
                    v-if="isOwnCard(card) || isTeacher"
                    class="lb-edit-btn"
                    title="Modifier"
                    @click="startEdit(card)"
                  >
                    <Pencil :size="10" />
                  </button>
                  <button
                    class="lb-vote-btn"
                    :class="{ 'lb-vote-btn--active': card.voted_by_me, 'lb-vote-btn--disabled': !card.voted_by_me && (isOwnCard(card) || !canVote) }"
                    :disabled="!card.voted_by_me && (isOwnCard(card) || !canVote)"
                    :title="isOwnCard(card) ? 'Pas de self-vote' : !canVote && !card.voted_by_me ? 'Votes epuises' : ''"
                    @click="voteCard(card)"
                  >
                    <ThumbsUp :size="11" />
                    <span>{{ card.votes }}</span>
                  </button>
                  <button
                    v-if="isTeacher || isOwnCard(card)"
                    class="lb-delete-btn"
                    title="Supprimer"
                    @click="deleteCard(card)"
                  >
                    <Trash2 :size="11" />
                  </button>
                </div>
              </div>
            </template>
          </div>
        </TransitionGroup>

        <!-- Add form -->
        <div class="lb-add-form">
          <template v-if="newCardColumn === col">
            <textarea
              v-model="newCardContent"
              class="lb-add-input"
              placeholder="Votre idee..."
              rows="2"
              @keydown.enter.prevent="addCard(col)"
              @keydown.escape="newCardContent = ''; newCardColumn = ''"
            />
            <div class="lb-add-row">
              <div class="lb-color-picker">
                <button
                  v-for="c in POST_IT_COLORS"
                  :key="c.value"
                  class="lb-color-dot"
                  :class="{ active: newCardColor === c.value }"
                  :style="{ background: c.value }"
                  :title="c.label"
                  @click="newCardColor = c.value"
                />
              </div>
              <div class="lb-add-actions">
                <button class="lb-add-confirm" @click="addCard(col)">Ajouter</button>
                <button class="lb-add-cancel" @click="newCardContent = ''; newCardColumn = ''">Annuler</button>
              </div>
            </div>
          </template>
          <button v-else class="lb-add-btn" @click="newCardColumn = col">
            <Plus :size="13" /> Ajouter
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lb-wrap { display: flex; flex-direction: column; gap: 12px; }

/* Header */
.lb-header {
  display: flex; align-items: center; gap: 8px; padding: 0 4px; flex-wrap: wrap;
}
.lb-icon { color: #a855f7; }
.lb-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
.lb-stat {
  font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 10px;
  background: var(--bg-active); color: var(--text-muted);
  display: inline-flex; align-items: center; gap: 3px;
}
.lb-stat--accent { background: rgba(74,144,217,.12); color: var(--accent); }
.lb-header-actions { display: flex; gap: 4px; margin-left: auto; }
.lb-hdr-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); cursor: pointer; transition: all .15s;
}
.lb-hdr-btn:hover { color: var(--accent); border-color: var(--accent); }
.lb-hdr-btn.active { color: #a855f7; border-color: #a855f7; background: rgba(168,85,247,.08); }
.lb-my-votes {
  font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums;
}

/* Columns */
.lb-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}
.lb-column {
  display: flex; flex-direction: column;
  background: var(--bg-elevated); border: 2px solid var(--border);
  border-radius: 10px; padding: 10px; min-height: 200px;
  transition: border-color .2s, background .2s;
}
.lb-column--dragover {
  border-color: var(--accent); background: rgba(74,144,217,.04);
}
.lb-column-header {
  display: flex; align-items: center; gap: 6px;
  padding-bottom: 8px; border-bottom: 1px solid var(--border); margin-bottom: 8px;
}
.lb-column-title {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .4px; color: var(--text-secondary); flex: 1;
}
.lb-column-count {
  font-size: 10px; font-weight: 700; padding: 1px 6px;
  border-radius: 8px; background: var(--bg-active); color: var(--text-muted);
}

/* Cards */
.lb-cards { display: flex; flex-direction: column; gap: 6px; flex: 1; min-height: 40px; }
.lb-card {
  position: relative; padding: 10px 12px; border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,.12);
  transition: transform .15s, box-shadow .15s, opacity .15s;
  cursor: grab;
}
.lb-card:hover { transform: translateY(-1px); box-shadow: 0 3px 8px rgba(0,0,0,.2); }
.lb-card--dragging { opacity: .4; transform: rotate(2deg); }
.lb-card--own { border-left: 3px solid var(--accent); }
.lb-card--top { box-shadow: 0 0 0 2px #f59e0b, 0 4px 12px rgba(245,158,11,.2); }
.lb-top-badge {
  position: absolute; top: -6px; right: -6px;
  color: #f59e0b; background: var(--bg-main); border-radius: 50%; padding: 2px;
}
.lb-card-content {
  font-size: 13px; line-height: 1.4; color: #1f2937; font-weight: 500;
  margin-bottom: 6px; white-space: pre-wrap; cursor: text;
}
.lb-card-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding-top: 5px; border-top: 1px solid rgba(0,0,0,.08);
}
.lb-card-author { font-size: 10px; color: rgba(0,0,0,.55); font-weight: 600; }
.lb-card-actions { display: flex; gap: 3px; }

/* Vote */
.lb-vote-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 700; padding: 2px 7px;
  border-radius: 10px; border: 1px solid rgba(0,0,0,.15);
  background: rgba(255,255,255,.6); color: rgba(0,0,0,.75);
  cursor: pointer; font-family: var(--font); transition: all .15s;
}
.lb-vote-btn:hover:not(:disabled) { background: rgba(255,255,255,.9); }
.lb-vote-btn--active { background: var(--accent); color: #fff; border-color: var(--accent); }
.lb-vote-btn--disabled { opacity: .35; cursor: not-allowed; }

/* Edit / Delete */
.lb-edit-btn, .lb-delete-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 5px;
  border: none; background: rgba(0,0,0,.06); color: rgba(0,0,0,.5);
  cursor: pointer; transition: all .15s; opacity: 0;
}
.lb-card:hover .lb-edit-btn, .lb-card:hover .lb-delete-btn { opacity: 1; }
.lb-edit-btn:hover { background: rgba(74,144,217,.2); color: var(--accent); }
.lb-delete-btn:hover { background: rgba(231,76,60,.2); color: #dc2626; }

/* Edit inline */
.lb-edit-input {
  width: 100%; font-family: var(--font); font-size: 13px;
  padding: 6px; border: 2px solid var(--accent); border-radius: 4px;
  background: #fff; color: #1f2937; resize: none; outline: none;
}
.lb-edit-actions { display: flex; gap: 3px; margin-top: 4px; }
.lb-edit-save, .lb-edit-cancel {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 4px; border: none; cursor: pointer;
}
.lb-edit-save { background: var(--accent); color: #fff; }
.lb-edit-cancel { background: rgba(0,0,0,.1); color: rgba(0,0,0,.6); }

/* Add form */
.lb-add-form { margin-top: 8px; }
.lb-add-input {
  width: 100%; font-family: var(--font); font-size: 13px;
  padding: 8px; border: 2px dashed var(--border-input);
  border-radius: 6px; background: var(--bg-input);
  color: var(--text-primary); resize: none; outline: none;
}
.lb-add-input:focus { border-color: var(--accent); border-style: solid; }
.lb-add-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 6px; }
.lb-color-picker { display: flex; gap: 3px; }
.lb-color-dot {
  width: 18px; height: 18px; border-radius: 50%; border: 2px solid transparent;
  cursor: pointer; transition: all .12s;
}
.lb-color-dot:hover { transform: scale(1.15); }
.lb-color-dot.active { border-color: rgba(0,0,0,.4); box-shadow: 0 0 0 2px rgba(0,0,0,.1); }
.lb-add-actions { display: flex; gap: 4px; }
.lb-add-confirm {
  font-size: 11px; font-weight: 600; padding: 5px 12px;
  border: none; border-radius: 6px; background: var(--accent);
  color: #fff; cursor: pointer; font-family: var(--font);
}
.lb-add-cancel {
  font-size: 11px; padding: 5px 8px;
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

/* Animations */
.card-list-enter-active { animation: card-in .3s ease; }
.card-list-leave-active { animation: card-out .2s ease; }
.card-list-move { transition: transform .3s ease; }
@keyframes card-in {
  from { opacity: 0; transform: translateY(-10px) scale(.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes card-out {
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(.9); }
}

@media (max-width: 500px) {
  .lb-columns { grid-template-columns: 1fr; }
  .lb-header { gap: 4px; }
}
</style>
