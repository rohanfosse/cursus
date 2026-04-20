/** TabSuiviEtudiants — Carnet de suivi : notes privees du prof, organisees par étudiant et catégorie. */
<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  Notebook, Plus, Trash2, Pencil, Tag, Clock, Search, X,
  Users, User, Lock, BookOpen, ChevronRight,
} from 'lucide-vue-next'
import { useAppStore }  from '@/stores/app'
import { useApi }       from '@/composables/useApi'
import { useToast }     from '@/composables/useToast'
import { useConfirm }   from '@/composables/useConfirm'
import { relativeTime } from '@/utils/date'
import { safeGetJSON, safeSetJSON } from '@/utils/safeStorage'
import { useSlashFocusSearch } from '@/composables/useSlashFocusSearch'
import { useDebounce } from '@/composables/useDebounce'

const appStore      = useAppStore()
const { api }       = useApi()
const { showToast } = useToast()
const { confirm }   = useConfirm()

// ── Types ────────────────────────────────────────────────────────────────────
interface TeacherNote {
  id: number; teacher_id: number; student_id: number; promo_id: number
  content: string; tag: string; category: string; student_name: string
  created_at: string; updated_at: string
}
interface StudentItem {
  id: number; name: string; email: string; promo_id: number
}
interface NoteSummary {
  student_id: number; student_name: string; count: number; last_note_at: string
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'generale',         label: 'Général',         icon: BookOpen },
  { id: 'tripartite',       label: 'Tripartite',       icon: Users },
  { id: 'suivi_individuel', label: 'Suivi Individuel', icon: User },
  { id: 'personnelle',      label: 'Personnelle',      icon: Lock },
]

const TAGS = [
  { id: 'progression', label: 'Progression', color: '#22c55e' },
  { id: 'objectif',    label: 'Objectif',    color: '#4a90d9' },
  { id: 'observation', label: 'Observation', color: '#f59e0b' },
  { id: 'alerte',      label: 'Alerte',      color: '#ef4444' },
  { id: 'autre',       label: 'Autre',       color: '#8b8d91' },
]

const AVATAR_COLORS = ['#4a90d9','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#f97316']

// ── State ─────────────────────────────────────────────────────────────────────
const allStudents      = ref<StudentItem[]>([])
const notes            = ref<TeacherNote[]>([])
const summaries        = ref<NoteSummary[]>([])
const loading          = ref(false)
const SEARCH_KEY       = 'cc_teacher_suivi_search'
const search           = ref<string>(safeGetJSON<string>(SEARCH_KEY, ''))
const debouncedSearch  = useDebounce(search, 400)
watch(debouncedSearch, v => safeSetJSON(SEARCH_KEY, v))
useSlashFocusSearch('.ts-search-input')
const selectedStudent  = ref<StudentItem | null>(null)
const activeCategory   = ref('generale')

const showForm    = ref(false)
const editingNote = ref<TeacherNote | null>(null)
const formContent = ref('')
const formTag     = ref('observation')
const formCategory = ref('generale')

const promoId = computed(() => appStore.activePromoId ?? 0)

// ── Helpers ───────────────────────────────────────────────────────────────────
function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}
function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
function tagColor(tag: string) { return TAGS.find(t => t.id === tag)?.color ?? '#8b8d91' }
function tagLabel(tag: string) { return TAGS.find(t => t.id === tag)?.label ?? tag }

// ── Data loading ──────────────────────────────────────────────────────────────
async function loadData() {
  if (!promoId.value) return
  loading.value = true
  try {
    const [studentsRes, notesRes, summRes] = await Promise.all([
      api<StudentItem[]>(() => window.api.getStudents(promoId.value)),
      api<TeacherNote[]>(() => window.api.getTeacherNotesByPromo(promoId.value)),
      api<NoteSummary[]>(() => window.api.getTeacherNotesSummary(promoId.value)),
    ])
    allStudents.value = studentsRes ?? []
    notes.value       = notesRes    ?? []
    summaries.value   = summRes     ?? []
    if (!selectedStudent.value && allStudents.value.length) {
      selectedStudent.value = allStudents.value[0]
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(promoId, () => {
  selectedStudent.value = null
  showForm.value = false
  loadData()
})

// ── Computed ──────────────────────────────────────────────────────────────────
const studentList = computed(() => {
  const q = search.value.toLowerCase()
  return allStudents.value
    .map(s => {
      const summary = summaries.value.find(x => x.student_id === s.id)
      return {
        ...s,
        noteCount:  summary?.count ?? 0,
        lastNoteAt: summary?.last_note_at ?? null,
        initials:   initials(s.name),
        color:      avatarColor(s.name),
      }
    })
    .filter(s => !q || s.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
})

const selectedStudentNotes = computed(() => {
  if (!selectedStudent.value) return []
  return notes.value
    .filter(n => n.student_id === selectedStudent.value!.id && n.category === activeCategory.value)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
})

const categoryCounts = computed(() => {
  if (!selectedStudent.value) return {} as Record<string, number>
  const counts: Record<string, number> = {}
  for (const cat of CATEGORIES) {
    counts[cat.id] = notes.value.filter(
      n => n.student_id === selectedStudent.value!.id && n.category === cat.id
    ).length
  }
  return counts
})

const totalNotes = computed(() => {
  if (!selectedStudent.value) return 0
  return notes.value.filter(n => n.student_id === selectedStudent.value!.id).length
})

// ── Form ──────────────────────────────────────────────────────────────────────
function openNewNote() {
  editingNote.value  = null
  formContent.value  = ''
  formTag.value      = 'observation'
  formCategory.value = activeCategory.value
  showForm.value     = true
}

function openEditNote(note: TeacherNote) {
  editingNote.value  = note
  formContent.value  = note.content
  formTag.value      = note.tag
  formCategory.value = note.category
  showForm.value     = true
}

function cancelForm() {
  showForm.value = false
  editingNote.value = null
}

async function submitForm() {
  if (!formContent.value.trim() || !selectedStudent.value) return
  if (editingNote.value) {
    await api(() => window.api.updateTeacherNote(editingNote.value!.id, {
      content: formContent.value, tag: formTag.value, category: formCategory.value,
    }))
    showToast('Note mise à jour.', 'success')
  } else {
    await api(() => window.api.createTeacherNote({
      studentId: selectedStudent.value!.id,
      promoId:   promoId.value,
      content:   formContent.value,
      tag:       formTag.value,
      category:  formCategory.value,
    }))
    showToast('Note ajoutée.', 'success')
  }
  showForm.value = false
  editingNote.value = null
  await loadData()
}

async function removeNote(id: number) {
  if (!await confirm('Supprimer cette note ?', 'danger', 'Supprimer')) return
  await api(() => window.api.deleteTeacherNote(id))
  showToast('Note supprimée.', 'success')
  await loadData()
}

function selectStudent(s: typeof studentList.value[number]) {
  selectedStudent.value = { id: s.id, name: s.name, email: s.email, promo_id: s.promo_id }
  showForm.value = false
  editingNote.value = null
}
</script>

<template>
  <div class="ts-layout">

    <!-- ── Panneau gauche ── -->
    <div class="ts-left">
      <div class="ts-left-header">
        <Notebook :size="14" />
        <span>Carnet de suivi</span>
      </div>

      <div class="ts-search-wrap">
        <Search :size="12" class="ts-search-icon" />
        <input v-model="search" type="text" placeholder="Rechercher..." class="ts-search-input" />
        <button v-if="search" class="ts-search-clear" @click="search = ''">
          <X :size="11" />
        </button>
      </div>

      <div v-if="loading && !allStudents.length" class="ts-left-loading">
        Chargement…
      </div>
      <div v-else-if="!studentList.length" class="ts-left-empty">
        Aucun étudiant
      </div>
      <div v-else class="ts-student-list">
        <button
          v-for="s in studentList"
          :key="s.id"
          class="ts-student-card"
          :class="{ active: selectedStudent?.id === s.id }"
          @click="selectStudent(s)"
        >
          <div class="ts-avatar" :style="{ background: s.color }">{{ s.initials }}</div>
          <div class="ts-student-info">
            <span class="ts-student-name">{{ s.name }}</span>
            <span class="ts-student-meta">
              {{ s.lastNoteAt ? relativeTime(s.lastNoteAt) : 'Aucune note' }}
            </span>
          </div>
          <span v-if="s.noteCount > 0" class="ts-note-badge">{{ s.noteCount }}</span>
          <ChevronRight v-if="selectedStudent?.id === s.id" :size="12" class="ts-card-chevron" />
        </button>
      </div>
    </div>

    <!-- ── Panneau droit ── -->
    <div class="ts-right">

      <!-- Aucun étudiant sélectionné -->
      <div v-if="!selectedStudent" class="ts-no-selection">
        <Notebook :size="38" />
        <p>Sélectionnez un étudiant</p>
        <span>pour accéder à son carnet de suivi</span>
      </div>

      <template v-else>
        <!-- Header étudiant -->
        <div class="ts-right-header">
          <div class="ts-header-avatar" :style="{ background: avatarColor(selectedStudent.name) }">
            {{ initials(selectedStudent.name) }}
          </div>
          <div class="ts-header-info">
            <h2 class="ts-right-name">{{ selectedStudent.name }}</h2>
            <span class="ts-header-meta">
              {{ totalNotes }} note{{ totalNotes !== 1 ? 's' : '' }}
            </span>
          </div>
          <button class="btn-primary ts-add-btn" @click="openNewNote()">
            <Plus :size="13" /> Nouvelle note
          </button>
        </div>

        <!-- Tabs catégories -->
        <div class="ts-cat-tabs">
          <button
            v-for="cat in CATEGORIES"
            :key="cat.id"
            class="ts-cat-tab"
            :class="{ active: activeCategory === cat.id }"
            @click="activeCategory = cat.id; showForm = false; editingNote = null"
          >
            <component :is="cat.icon" :size="12" />
            {{ cat.label }}
            <span v-if="categoryCounts[cat.id]" class="ts-cat-count">
              {{ categoryCounts[cat.id] }}
            </span>
          </button>
        </div>

        <!-- Formulaire inline -->
        <div v-if="showForm" class="ts-form">
          <div class="ts-form-header">
            <span class="ts-form-title">
              {{ editingNote ? 'Modifier la note' : 'Nouvelle note' }}
            </span>
            <button class="ts-form-close" @click="cancelForm()"><X :size="13" /></button>
          </div>

          <!-- Sélecteur de catégorie (création uniquement) -->
          <div v-if="!editingNote" class="ts-cat-select-row">
            <button
              v-for="cat in CATEGORIES"
              :key="cat.id"
              class="ts-cat-pill"
              :class="{ active: formCategory === cat.id }"
              @click="formCategory = cat.id"
            >
              <component :is="cat.icon" :size="11" />
              {{ cat.label }}
            </button>
          </div>

          <!-- Sélecteur de tag -->
          <div class="ts-tag-row">
            <button
              v-for="t in TAGS"
              :key="t.id"
              class="ts-tag-btn"
              :class="{ active: formTag === t.id }"
              :style="{ '--tag-color': t.color }"
              @click="formTag = t.id"
            >
              {{ t.label }}
            </button>
          </div>

          <textarea
            v-model="formContent"
            class="ts-textarea"
            rows="4"
            placeholder="Votre note…"
            autofocus
          />

          <div class="ts-form-actions">
            <button class="btn-ghost" @click="cancelForm()">Annuler</button>
            <button
              class="btn-primary"
              :disabled="!formContent.trim()"
              @click="submitForm()"
            >
              {{ editingNote ? 'Enregistrer' : 'Ajouter' }}
            </button>
          </div>
        </div>

        <!-- Liste des notes -->
        <div v-if="loading" class="ts-loading">Chargement…</div>

        <div v-else-if="!selectedStudentNotes.length && !showForm" class="ts-empty-cat">
          <component :is="CATEGORIES.find(c => c.id === activeCategory)?.icon ?? Notebook" :size="30" />
          <p>Aucune note dans cette catégorie</p>
          <button class="btn-primary ts-empty-cta" @click="openNewNote()">
            <Plus :size="12" /> Première note
          </button>
        </div>

        <div v-else class="ts-notes-list">
          <div v-for="n in selectedStudentNotes" :key="n.id" class="ts-note-card">
            <div class="ts-note-meta">
              <span
                class="ts-note-tag"
                :style="{ background: tagColor(n.tag) + '22', color: tagColor(n.tag) }"
              >
                <Tag :size="9" /> {{ tagLabel(n.tag) }}
              </span>
              <span class="ts-note-date"><Clock :size="9" /> {{ relativeTime(n.created_at) }}</span>
              <div class="ts-note-actions">
                <button class="ts-action-btn" title="Modifier" @click="openEditNote(n)">
                  <Pencil :size="11" />
                </button>
                <button class="ts-action-btn ts-action-danger" title="Supprimer" @click="removeNote(n.id)">
                  <Trash2 :size="11" />
                </button>
              </div>
            </div>
            <p class="ts-note-content">{{ n.content }}</p>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ── Layout ── */
.ts-layout {
  display: flex;
  min-height: 520px;
  max-height: calc(100vh - 280px);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  background: var(--bg-elevated);
}

/* ── Panneau gauche ── */
.ts-left {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  overflow: hidden;
}
.ts-left-header {
  display: flex; align-items: center; gap: 7px;
  padding: 14px 14px 10px;
  font-size: 11.5px; font-weight: 700;
  text-transform: uppercase; letter-spacing: .06em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.ts-search-wrap {
  display: flex; align-items: center; gap: 6px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.ts-search-icon { color: var(--text-muted); flex-shrink: 0; }
.ts-search-input {
  flex: 1; border: none; background: transparent; outline: none;
  font-size: 12.5px; font-family: var(--font); color: var(--text-primary);
}
.ts-search-clear {
  background: none; border: none; color: var(--text-muted); cursor: pointer;
  display: flex; align-items: center;
}
.ts-left-loading, .ts-left-empty {
  padding: 24px 14px; text-align: center;
  font-size: 12px; color: var(--text-muted);
}
.ts-student-list { flex: 1; overflow-y: auto; }

.ts-student-card {
  display: flex; align-items: center; gap: 9px;
  width: 100%; padding: 9px 12px;
  border: none; background: transparent; text-align: left;
  cursor: pointer; transition: background .1s;
  border-left: 2px solid transparent;
}
.ts-student-card:hover { background: var(--bg-hover); }
.ts-student-card.active {
  background: rgba(var(--accent-rgb),.08);
  border-left-color: var(--accent);
}

.ts-avatar {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #fff;
}
.ts-student-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.ts-student-name {
  font-size: 12.5px; font-weight: 600; color: var(--text-primary);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ts-student-meta { font-size: 10.5px; color: var(--text-muted); }
.ts-note-badge {
  font-size: 10px; font-weight: 700;
  background: rgba(var(--accent-rgb),.15); color: var(--accent);
  border-radius: 10px; padding: 1px 7px; flex-shrink: 0;
}
.ts-card-chevron { color: var(--accent); flex-shrink: 0; }

/* ── Panneau droit ── */
.ts-right {
  flex: 1; display: flex; flex-direction: column;
  overflow: hidden; min-width: 0;
}

.ts-no-selection {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 8px;
  color: var(--text-muted);
}
.ts-no-selection p { font-size: 15px; font-weight: 600; color: var(--text-secondary); margin: 0; }
.ts-no-selection span { font-size: 12px; }

.ts-right-header {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 20px 14px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.ts-header-avatar {
  width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; color: #fff;
}
.ts-header-info { flex: 1; min-width: 0; }
.ts-right-name {
  font-size: 16px; font-weight: 700; color: var(--text-primary);
  margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ts-header-meta { font-size: 11px; color: var(--text-muted); }
.ts-add-btn {
  font-size: 12px; padding: 6px 12px;
  display: inline-flex; align-items: center; gap: 5px;
  flex-shrink: 0;
}

/* ── Tabs catégories ── */
.ts-cat-tabs {
  display: flex; gap: 2px;
  padding: 10px 16px 0;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0; flex-wrap: wrap;
}
.ts-cat-tab {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 12px 8px;
  border: none; background: transparent;
  font-size: 12.5px; font-weight: 600; font-family: var(--font);
  color: var(--text-secondary); cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: color .15s, border-color .15s;
}
.ts-cat-tab:hover { color: var(--text-primary); }
.ts-cat-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
.ts-cat-count {
  font-size: 10px; font-weight: 700;
  background: rgba(var(--accent-rgb),.15); color: var(--accent);
  border-radius: 10px; padding: 1px 6px;
}

/* ── Formulaire ── */
.ts-form {
  margin: 14px 20px 0;
  padding: 14px; border-radius: 10px;
  background: var(--bg-primary); border: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 10px;
  flex-shrink: 0;
}
.ts-form-header { display: flex; align-items: center; justify-content: space-between; }
.ts-form-title { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.ts-form-close { background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; }

.ts-cat-select-row { display: flex; gap: 5px; flex-wrap: wrap; }
.ts-cat-pill {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-secondary); cursor: pointer; font-family: var(--font);
  transition: all .12s;
}
.ts-cat-pill.active {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(var(--accent-rgb),.1);
}
.ts-tag-row { display: flex; gap: 5px; flex-wrap: wrap; }
.ts-tag-btn {
  font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-secondary); cursor: pointer; font-family: var(--font);
  transition: all .12s;
}
.ts-tag-btn.active {
  border-color: var(--tag-color);
  color: var(--tag-color);
  background: color-mix(in srgb, var(--tag-color) 10%, transparent);
}
.ts-textarea {
  padding: 9px 10px; border-radius: 7px; border: 1px solid var(--border);
  background: var(--bg-elevated); color: var(--text-primary);
  font-size: 13px; font-family: var(--font); resize: vertical; outline: none;
  transition: border-color .15s;
}
.ts-textarea:focus { border-color: var(--accent); }
.ts-form-actions { display: flex; justify-content: flex-end; gap: 8px; }

/* ── Liste notes ── */
.ts-loading { padding: 30px; text-align: center; color: var(--text-muted); font-size: 13px; }
.ts-empty-cat {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 10px;
  color: var(--text-muted); padding: 40px;
}
.ts-empty-cat p { font-size: 14px; color: var(--text-secondary); margin: 0; }
.ts-empty-cta {
  font-size: 12px; padding: 6px 14px;
  display: inline-flex; align-items: center; gap: 5px;
}

.ts-notes-list {
  flex: 1; overflow-y: auto;
  display: flex; flex-direction: column; gap: 8px;
  padding: 14px 20px 20px;
}
.ts-note-card {
  padding: 12px 14px; border-radius: 9px;
  background: var(--bg-primary); border: 1px solid var(--border);
  transition: border-color .15s;
}
.ts-note-card:hover { border-color: rgba(var(--accent-rgb),.25); }
.ts-note-meta {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 7px; flex-wrap: wrap;
}
.ts-note-tag {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 10px;
}
.ts-note-date {
  display: flex; align-items: center; gap: 3px;
  font-size: 10.5px; color: var(--text-muted); margin-left: auto;
}
.ts-note-actions {
  display: flex; gap: 3px; margin-left: 6px;
  opacity: 0; transition: opacity .15s;
}
.ts-note-card:hover .ts-note-actions { opacity: 1; }
.ts-action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 5px;
  border: 1px solid var(--border); background: transparent;
  color: var(--text-muted); cursor: pointer; transition: all .12s;
}
.ts-action-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.ts-action-danger:hover { color: #ef4444; border-color: rgba(239,68,68,.3); }
.ts-note-content {
  font-size: 13px; color: var(--text-secondary);
  line-height: 1.55; margin: 0; white-space: pre-wrap;
}
</style>
