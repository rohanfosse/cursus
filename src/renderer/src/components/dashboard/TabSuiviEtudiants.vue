/** TabSuiviEtudiants — Carnet de suivi : notes privees sur les etudiants. */
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Notebook, Plus, Trash2, Pencil, User, Tag, Clock, Search, X } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useApi }      from '@/composables/useApi'
import { useToast }    from '@/composables/useToast'
import { useConfirm }  from '@/composables/useConfirm'
import { relativeTime } from '@/utils/date'

const appStore     = useAppStore()
const { api }      = useApi()
const { showToast } = useToast()
const { confirm }   = useConfirm()

interface TeacherNote {
  id: number; teacher_id: number; student_id: number; promo_id: number
  content: string; tag: string; student_name: string
  created_at: string; updated_at: string
}

interface NoteSummary {
  student_id: number; student_name: string; count: number; last_note_at: string
}

const notes     = ref<TeacherNote[]>([])
const summaries = ref<NoteSummary[]>([])
const loading   = ref(false)
const search    = ref('')
const selectedStudentId = ref<number | null>(null)

// Form
const showForm = ref(false)
const editingId = ref<number | null>(null)
const formContent = ref('')
const formTag = ref('observation')
const formStudentId = ref<number | null>(null)

const promoId = computed(() => appStore.activePromoId ?? 0)

const TAGS = [
  { id: 'progression', label: 'Progression', color: '#22c55e' },
  { id: 'objectif', label: 'Objectif', color: '#4a90d9' },
  { id: 'observation', label: 'Observation', color: '#f59e0b' },
  { id: 'alerte', label: 'Alerte', color: '#ef4444' },
  { id: 'autre', label: 'Autre', color: '#8b8d91' },
]

function tagColor(tag: string) { return TAGS.find(t => t.id === tag)?.color ?? '#8b8d91' }
function tagLabel(tag: string) { return TAGS.find(t => t.id === tag)?.label ?? tag }

async function loadData() {
  if (!promoId.value) return
  loading.value = true
  try {
    const [notesRes, summRes] = await Promise.all([
      api<TeacherNote[]>(() => window.api.getTeacherNotesByPromo(promoId.value) as any),
      api<NoteSummary[]>(() => window.api.getTeacherNotesSummary(promoId.value) as any),
    ])
    notes.value = notesRes ?? []
    summaries.value = summRes ?? []
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(promoId, loadData)

// Filtered
const filteredNotes = computed(() => {
  let list = notes.value
  if (selectedStudentId.value) list = list.filter(n => n.student_id === selectedStudentId.value)
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(n => n.content.toLowerCase().includes(q) || n.student_name.toLowerCase().includes(q))
  }
  return list
})

const students = computed(() => {
  const map = new Map<number, string>()
  for (const n of notes.value) map.set(n.student_id, n.student_name)
  for (const s of summaries.value) map.set(s.student_id, s.student_name)
  return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
})

function openNewNote(studentId?: number) {
  editingId.value = null
  formContent.value = ''
  formTag.value = 'observation'
  formStudentId.value = studentId ?? selectedStudentId.value
  showForm.value = true
}

function openEditNote(note: TeacherNote) {
  editingId.value = note.id
  formContent.value = note.content
  formTag.value = note.tag
  formStudentId.value = note.student_id
  showForm.value = true
}

async function submitForm() {
  if (!formContent.value.trim() || !formStudentId.value) return
  if (editingId.value) {
    await api(() => window.api.updateTeacherNote(editingId.value!, { content: formContent.value, tag: formTag.value }))
    showToast('Note mise a jour.', 'success')
  } else {
    await api(() => window.api.createTeacherNote({
      studentId: formStudentId.value,
      promoId: promoId.value,
      content: formContent.value,
      tag: formTag.value,
    }))
    showToast('Note ajoutee.', 'success')
  }
  showForm.value = false
  await loadData()
}

async function removeNote(id: number) {
  if (!await confirm('Supprimer cette note ?', 'danger', 'Supprimer')) return
  await api(() => window.api.deleteTeacherNote(id))
  showToast('Note supprimee.', 'success')
  await loadData()
}
</script>

<template>
  <div class="ts-tab">
    <div class="ts-header">
      <Notebook :size="18" />
      <h2 class="ts-title">Carnet de suivi</h2>
      <button class="btn-primary ts-add-btn" @click="openNewNote()">
        <Plus :size="14" /> Nouvelle note
      </button>
    </div>

    <!-- Filters -->
    <div class="ts-filters">
      <div class="ts-search">
        <Search :size="13" />
        <input v-model="search" type="text" placeholder="Rechercher..." />
        <button v-if="search" class="ts-clear" @click="search = ''"><X :size="12" /></button>
      </div>
      <select v-model="selectedStudentId" class="ts-select">
        <option :value="null">Tous les etudiants</option>
        <option v-for="s in students" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
    </div>

    <!-- Form -->
    <div v-if="showForm" class="ts-form">
      <div class="ts-form-header">
        <h3>{{ editingId ? 'Modifier la note' : 'Nouvelle note' }}</h3>
        <button class="ts-form-close" @click="showForm = false"><X :size="14" /></button>
      </div>
      <select v-if="!editingId" v-model="formStudentId" class="ts-select">
        <option :value="null" disabled>Choisir un etudiant</option>
        <option v-for="s in students" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
      <div class="ts-tag-row">
        <button v-for="t in TAGS" :key="t.id" class="ts-tag-btn" :class="{ active: formTag === t.id }"
          :style="{ '--tag-color': t.color }" @click="formTag = t.id">
          {{ t.label }}
        </button>
      </div>
      <textarea v-model="formContent" class="ts-textarea" rows="4" placeholder="Votre note..." />
      <div class="ts-form-actions">
        <button class="btn-ghost" @click="showForm = false">Annuler</button>
        <button class="btn-primary" :disabled="!formContent.trim() || !formStudentId" @click="submitForm">
          {{ editingId ? 'Enregistrer' : 'Ajouter' }}
        </button>
      </div>
    </div>

    <!-- Notes list -->
    <div v-if="loading" class="ts-loading">Chargement...</div>
    <div v-else-if="!filteredNotes.length" class="ts-empty">
      <Notebook :size="32" style="opacity:.2" />
      <p>Aucune note pour le moment</p>
    </div>
    <div v-else class="ts-notes-list">
      <div v-for="n in filteredNotes" :key="n.id" class="ts-note-card">
        <div class="ts-note-header">
          <span class="ts-note-tag" :style="{ background: tagColor(n.tag) + '20', color: tagColor(n.tag) }">
            <Tag :size="10" /> {{ tagLabel(n.tag) }}
          </span>
          <div class="ts-note-student">
            <User :size="12" /> {{ n.student_name }}
          </div>
          <span class="ts-note-date"><Clock :size="10" /> {{ relativeTime(n.created_at) }}</span>
        </div>
        <p class="ts-note-content">{{ n.content }}</p>
        <div class="ts-note-actions">
          <button class="ts-action-btn" @click="openEditNote(n)"><Pencil :size="12" /></button>
          <button class="ts-action-btn ts-action-danger" @click="removeNote(n.id)"><Trash2 :size="12" /></button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ts-tab { display: flex; flex-direction: column; gap: 14px; }
.ts-header { display: flex; align-items: center; gap: 10px; }
.ts-title { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0; flex: 1; }
.ts-add-btn { font-size: 12px; padding: 6px 14px; display: inline-flex; align-items: center; gap: 5px; }

.ts-filters { display: flex; gap: 10px; flex-wrap: wrap; }
.ts-search {
  flex: 1; min-width: 180px; display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--bg-elevated);
  color: var(--text-muted);
}
.ts-search input {
  flex: 1; border: none; background: transparent; outline: none;
  color: var(--text-primary); font-size: 13px; font-family: var(--font);
}
.ts-clear { background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; }
.ts-select {
  padding: 6px 10px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--bg-elevated);
  color: var(--text-primary); font-size: 12px; font-family: var(--font);
}
.ts-select option { background: var(--bg-main); }

/* Form */
.ts-form {
  padding: 16px; border-radius: 12px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 10px;
}
.ts-form-header { display: flex; align-items: center; justify-content: space-between; }
.ts-form-header h3 { font-size: 14px; font-weight: 700; color: var(--text-primary); margin: 0; }
.ts-form-close { background: none; border: none; color: var(--text-muted); cursor: pointer; }
.ts-tag-row { display: flex; gap: 6px; flex-wrap: wrap; }
.ts-tag-btn {
  font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-secondary); cursor: pointer; font-family: var(--font);
  transition: all .15s;
}
.ts-tag-btn.active { border-color: var(--tag-color); color: var(--tag-color); background: color-mix(in srgb, var(--tag-color) 10%, transparent); }
.ts-tag-btn:hover { border-color: var(--tag-color); }
.ts-textarea {
  padding: 10px; border-radius: 8px; border: 1px solid var(--border);
  background: var(--bg-main); color: var(--text-primary);
  font-size: 13px; font-family: var(--font); resize: vertical;
}
.ts-form-actions { display: flex; justify-content: flex-end; gap: 8px; }

/* Notes list */
.ts-loading, .ts-empty { text-align: center; color: var(--text-muted); padding: 40px 0; }
.ts-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.ts-notes-list { display: flex; flex-direction: column; gap: 8px; }
.ts-note-card {
  padding: 14px; border-radius: 10px;
  background: var(--bg-elevated); border: 1px solid var(--border);
  transition: border-color .15s;
}
.ts-note-card:hover { border-color: rgba(74,144,217,.2); }
.ts-note-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
.ts-note-tag {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 12px;
}
.ts-note-student { display: flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 600; color: var(--text-primary); }
.ts-note-date { font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 3px; margin-left: auto; }
.ts-note-content { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin: 0; white-space: pre-wrap; }
.ts-note-actions { display: flex; gap: 6px; margin-top: 8px; }
.ts-action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 6px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); cursor: pointer; transition: all .15s;
}
.ts-action-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.ts-action-danger:hover { color: #ef4444; border-color: rgba(239,68,68,.3); }
</style>
