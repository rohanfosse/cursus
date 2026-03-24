/** TeacherTodoWidget — Todolist privee du professeur (localStorage). */
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { CheckSquare, Plus, X, ChevronDown, ChevronRight, Trash2, RotateCcw } from 'lucide-vue-next'

interface TodoItem {
  id: string
  text: string
  done: boolean
}

interface TodoList {
  id: string
  name: string
  items: TodoItem[]
  enabled: boolean
  collapsed: boolean
}

const STORAGE_KEY = 'cc_teacher_todos'

const DEFAULT_LISTS: TodoList[] = [
  { id: 'corrections', name: 'Corrections a faire', items: [], enabled: true, collapsed: false },
  { id: 'preparation', name: 'Preparation de cours', items: [], enabled: false, collapsed: false },
  { id: 'reunions', name: 'Reunions et RDV', items: [], enabled: false, collapsed: false },
  { id: 'admin', name: 'Taches administratives', items: [], enabled: false, collapsed: false },
  { id: 'suivi', name: 'Suivi etudiants', items: [], enabled: false, collapsed: false },
  { id: 'perso', name: 'Notes personnelles', items: [], enabled: false, collapsed: false },
]

function loadLists(): TodoList[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as TodoList[]
      // Merge with defaults (add new default lists not yet in saved)
      for (const def of DEFAULT_LISTS) {
        if (!saved.find(s => s.id === def.id)) saved.push(def)
      }
      return saved
    }
  } catch {}
  return DEFAULT_LISTS.map(l => ({ ...l }))
}

function saveLists(lists: TodoList[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lists))
}

const lists = ref<TodoList[]>(loadLists())
const newItemText = ref<Record<string, string>>({})
const showSettings = ref(false)

watch(lists, saveLists, { deep: true })

const enabledLists = computed(() => lists.value.filter(l => l.enabled))

function addItem(listId: string) {
  const text = newItemText.value[listId]?.trim()
  if (!text) return
  const list = lists.value.find(l => l.id === listId)
  if (!list) return
  list.items.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, done: false })
  newItemText.value[listId] = ''
}

function removeItem(listId: string, itemId: string) {
  const list = lists.value.find(l => l.id === listId)
  if (!list) return
  list.items = list.items.filter(i => i.id !== itemId)
}

function toggleList(listId: string) {
  const list = lists.value.find(l => l.id === listId)
  if (list) list.collapsed = !list.collapsed
}

function doneCount(list: TodoList) {
  return list.items.filter(i => i.done).length
}

function clearDone(listId: string) {
  const list = lists.value.find(l => l.id === listId)
  if (list) list.items = list.items.filter(i => !i.done)
}
</script>

<template>
  <div class="ttw">
    <div class="ttw-header">
      <CheckSquare :size="16" />
      <h3 class="ttw-title">Mes taches</h3>
      <button class="ttw-settings-btn" :title="showSettings ? 'Fermer' : 'Gerer les listes'" @click="showSettings = !showSettings">
        <RotateCcw v-if="showSettings" :size="13" />
        <Plus v-else :size="13" />
      </button>
    </div>

    <!-- Settings: enable/disable lists -->
    <div v-if="showSettings" class="ttw-settings">
      <div v-for="l in lists" :key="l.id" class="ttw-setting-row">
        <label class="ttw-setting-check">
          <input type="checkbox" v-model="l.enabled" />
          <span>{{ l.name }}</span>
        </label>
      </div>
    </div>

    <!-- Lists -->
    <div v-for="l in enabledLists" :key="l.id" class="ttw-list">
      <div class="ttw-list-header" @click="toggleList(l.id)">
        <component :is="l.collapsed ? ChevronRight : ChevronDown" :size="12" />
        <span class="ttw-list-name">{{ l.name }}</span>
        <span class="ttw-list-count">{{ doneCount(l) }}/{{ l.items.length }}</span>
        <button v-if="doneCount(l) > 0" class="ttw-clear-btn" title="Supprimer les taches terminees" @click.stop="clearDone(l.id)">
          <Trash2 :size="10" />
        </button>
      </div>

      <div v-if="!l.collapsed" class="ttw-list-body">
        <div v-for="item in l.items" :key="item.id" class="ttw-item" :class="{ done: item.done }">
          <label class="ttw-check">
            <input type="checkbox" v-model="item.done" />
            <span class="ttw-check-mark" />
          </label>
          <span class="ttw-item-text">{{ item.text }}</span>
          <button class="ttw-item-remove" @click="removeItem(l.id, item.id)"><X :size="10" /></button>
        </div>

        <div class="ttw-add-row">
          <input
            v-model="newItemText[l.id]"
            type="text"
            class="ttw-add-input"
            placeholder="Ajouter une tache..."
            @keydown.enter="addItem(l.id)"
          />
          <button class="ttw-add-btn" :disabled="!newItemText[l.id]?.trim()" @click="addItem(l.id)">
            <Plus :size="12" />
          </button>
        </div>
      </div>
    </div>

    <p v-if="!enabledLists.length" class="ttw-empty">
      Cliquez sur <Plus :size="11" style="vertical-align:middle" /> pour activer des listes
    </p>
  </div>
</template>

<style scoped>
.ttw { display: flex; flex-direction: column; gap: 10px; }
.ttw-header { display: flex; align-items: center; gap: 8px; color: var(--text-primary); }
.ttw-title { font-size: 15px; font-weight: 700; margin: 0; flex: 1; }
.ttw-settings-btn {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 6px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); cursor: pointer; transition: all .15s;
}
.ttw-settings-btn:hover { background: var(--bg-hover); color: var(--accent); }

/* Settings */
.ttw-settings {
  padding: 10px; border-radius: 8px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 6px;
}
.ttw-setting-row { display: flex; align-items: center; }
.ttw-setting-check {
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: var(--text-secondary); cursor: pointer;
}
.ttw-setting-check input { accent-color: var(--accent); cursor: pointer; }

/* List */
.ttw-list {
  border-radius: 10px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  overflow: hidden;
}
.ttw-list-header {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 12px; cursor: pointer;
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  transition: background .15s;
}
.ttw-list-header:hover { background: var(--bg-hover); }
.ttw-list-name { flex: 1; }
.ttw-list-count {
  font-size: 10px; font-weight: 700; color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}
.ttw-clear-btn {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; border-radius: 4px;
  border: none; background: transparent; color: var(--text-muted);
  cursor: pointer; transition: all .15s;
}
.ttw-clear-btn:hover { background: rgba(239,68,68,.1); color: #ef4444; }

/* List body */
.ttw-list-body { padding: 4px 10px 10px; }

/* Item */
.ttw-item {
  display: flex; align-items: center; gap: 8px;
  padding: 4px 0; font-size: 12px; color: var(--text-primary);
}
.ttw-item.done { opacity: .5; }
.ttw-item.done .ttw-item-text { text-decoration: line-through; }
.ttw-check { display: flex; cursor: pointer; }
.ttw-check input { accent-color: var(--accent); cursor: pointer; }
.ttw-item-text { flex: 1; line-height: 1.4; }
.ttw-item-remove {
  display: flex; align-items: center; justify-content: center;
  width: 18px; height: 18px; border-radius: 4px;
  border: none; background: transparent; color: var(--text-muted);
  cursor: pointer; opacity: 0; transition: all .15s;
}
.ttw-item:hover .ttw-item-remove { opacity: 1; }
.ttw-item-remove:hover { background: rgba(239,68,68,.1); color: #ef4444; }

/* Add row */
.ttw-add-row {
  display: flex; gap: 4px; margin-top: 6px;
}
.ttw-add-input {
  flex: 1; padding: 5px 8px; border-radius: 6px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-primary); font-size: 11px; font-family: var(--font);
  outline: none; transition: border-color .15s;
}
.ttw-add-input:focus { border-color: var(--accent); }
.ttw-add-input::placeholder { color: var(--text-muted); }
.ttw-add-btn {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 6px;
  border: none; background: var(--accent); color: #fff;
  cursor: pointer; transition: background .15s;
}
.ttw-add-btn:hover:not(:disabled) { background: var(--accent-hover, #3a7fc7); }
.ttw-add-btn:disabled { opacity: .3; cursor: default; }

.ttw-empty {
  text-align: center; font-size: 12px; color: var(--text-muted);
  padding: 16px 0; font-style: italic;
}
</style>
