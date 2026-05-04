/**
 * Vue rendus enseignant : rendus groupés par devoir, notation inline avec note et feedback.
 */
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Users, ChevronRight, Link2, FileText, Award, X, Download, Clock, Filter } from 'lucide-vue-next'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useTravauxStore } from '@/stores/travaux'
import { avatarColor, initials } from '@/utils/format'
import { typeLabel } from '@/utils/devoir'
import type { Devoir, GanttRow } from '@/types'

const props = defineProps<{
  rendusByDevoir: { devoir: Partial<GanttRow>; rendus: any[] }[]
  // composable: useTeacherGrading
  editingDepotId: number | null
  pendingNoteValue: string
  pendingFeedbackValue: string
  savingGrade: boolean
  canSave: boolean
  startEditGrade: (depotId: number, currentNote: string | null, currentFeedback: string | null) => void
  cancelEditGrade: () => void
  saveGrade: (depotId: number) => void
  openDevoir: (id: number) => void
}>()

/** Local filter for rendus, persist between sessions */
const LS_LOCAL_FILTER = 'devoirs_rendus_local_filter'
type LocalFilter = 'all' | 'ungraded' | 'graded' | 'late'
const storedFilter = (() => {
  try {
    const v = localStorage.getItem(LS_LOCAL_FILTER)
    return (['all', 'ungraded', 'graded', 'late'] as const).includes(v as LocalFilter) ? (v as LocalFilter) : 'all'
  } catch { return 'all' as const }
})()
const localFilter = ref<LocalFilter>(storedFilter)
watch(localFilter, (v) => { try { localStorage.setItem(LS_LOCAL_FILTER, v) } catch { /* noop */ } })

/** Filtered rendus based on local filter */
const displayedRendus = computed(() => {
  if (localFilter.value === 'all') return props.rendusByDevoir
  return props.rendusByDevoir.map(group => {
    const filtered = group.rendus.filter(r => {
      if (localFilter.value === 'ungraded') return !r.note
      if (localFilter.value === 'graded') return !!r.note
      if (localFilter.value === 'late') return isLate(r, group)
      return true
    })
    return { ...group, rendus: filtered }
  }).filter(g => g.rendus.length > 0)
})

/** Track which feedbacks are expanded */
const expandedFeedbacks = ref<Set<number>>(new Set())

function toggleFeedback(id: number) {
  if (expandedFeedbacks.value.has(id)) expandedFeedbacks.value.delete(id)
  else expandedFeedbacks.value.add(id)
}

/** Submission rate for a group */
function submissionPct(group: { devoir: Partial<GanttRow>; rendus: any[] }): number {
  const total = group.devoir.students_total ?? 0
  if (total <= 0) return 0
  return Math.round((group.rendus.length / total) * 100)
}

defineEmits<{
  (e: 'update:pendingNoteValue', v: string): void
  (e: 'update:pendingFeedbackValue', v: string): void
}>()

const travauxStore = useTravauxStore()

/** Grade distribution across all visible rendus */
const gradeDistribution = computed(() => {
  const dist: Record<string, number> = {}
  let ungraded = 0
  for (const group of props.rendusByDevoir) {
    for (const r of group.rendus) {
      if (r.note) {
        const key = r.note.toString().toUpperCase().trim()
        dist[key] = (dist[key] ?? 0) + 1
      } else {
        ungraded++
      }
    }
  }
  return { dist, ungraded, total: Object.values(dist).reduce((s, n) => s + n, 0) + ungraded }
})

/** Total rendus count */
const totalRendus = computed(() =>
  props.rendusByDevoir.reduce((s, g) => s + g.rendus.length, 0),
)

/** Export all rendus as CSV */
function exportCSV() {
  const rows: string[][] = [['Devoir', 'Type', 'Étudiant', 'Fichier/Lien', 'Date de dépôt', 'Note', 'Feedback']]
  for (const group of props.rendusByDevoir) {
    const title = (group.devoir as any).title ?? `Devoir #${group.devoir.id}`
    const type = (group.devoir as any).type ?? ''
    for (const r of group.rendus) {
      rows.push([
        title,
        type,
        r.student_name ?? '',
        r.content ?? '',
        r.submitted_at ?? '',
        r.note ?? '',
        (r.feedback ?? '').replace(/\n/g, ' '),
      ])
    }
  }
  const csv = rows.map(row => row.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rendus-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** Check if a rendu was submitted late */
function isLate(r: any, group: { devoir: Partial<GanttRow> }): boolean {
  if (!r.submitted_at || !group.devoir.deadline) return false
  return new Date(r.submitted_at).getTime() > new Date(group.devoir.deadline).getTime()
}

/** Label humain du filtre (pour empty state) */
function filterLabel(f: LocalFilter): string {
  switch (f) {
    case 'ungraded': return 'Non notés'
    case 'graded':   return 'Notés'
    case 'late':     return 'En retard'
    default:         return 'Tous'
  }
}
</script>

<template>
  <div v-if="travauxStore.loading" class="devoirs-list">
    <div v-for="i in 3" :key="i" class="skel-card">
      <div class="skel skel-line skel-w50" style="height:16px" />
      <div class="skel skel-line skel-w30" style="height:12px;margin-top:8px" />
    </div>
  </div>

  <EmptyState
    v-else-if="rendusByDevoir.length === 0"
    :icon="Users"
    title="Aucun rendu pour cette promotion"
    subtitle="Les rendus des etudiants apparaitront ici."
  />

  <div v-else class="devoirs-list">
    <!-- Toolbar: filter pills + export + grade distribution -->
    <div class="rendus-toolbar">
      <div class="rendus-toolbar-left">
        <span class="rendus-total-label">{{ totalRendus }} rendu{{ totalRendus > 1 ? 's' : '' }}</span>
        <div class="rendus-filter-pills">
          <button class="rendus-pill" :class="{ active: localFilter === 'all' }" @click="localFilter = 'all'">Tous</button>
          <button class="rendus-pill" :class="{ active: localFilter === 'ungraded' }" @click="localFilter = 'ungraded'">Non notés</button>
          <button class="rendus-pill" :class="{ active: localFilter === 'graded' }" @click="localFilter = 'graded'">Notés</button>
          <button class="rendus-pill" :class="{ active: localFilter === 'late' }" @click="localFilter = 'late'">En retard</button>
        </div>
        <div v-if="gradeDistribution.total > 0" class="grade-dist">
          <span
            v-for="(count, grade) in gradeDistribution.dist"
            :key="grade"
            class="grade-dist-chip"
            :class="`grade-dist--${(grade as string).charAt(0).toLowerCase()}`"
          >
            {{ grade }}: {{ count }}
          </span>
          <span v-if="gradeDistribution.ungraded > 0" class="grade-dist-chip grade-dist--none">
            Non noté: {{ gradeDistribution.ungraded }}
          </span>
        </div>
      </div>
      <button class="btn-ghost rendus-export-btn" @click="exportCSV">
        <Download :size="13" /> Exporter CSV
      </button>
    </div>

    <!-- Empty state quand un filtre est actif mais ne retourne aucun rendu -->
    <div v-if="displayedRendus.length === 0 && localFilter !== 'all'" class="rendus-empty-filter">
      <Filter :size="22" class="rendus-empty-filter-icon" />
      <p class="rendus-empty-filter-title">Aucun rendu ne correspond au filtre « {{ filterLabel(localFilter) }} »</p>
      <p class="rendus-empty-filter-hint">Essayez un autre filtre ou réinitialisez pour voir tous les rendus.</p>
      <button class="rendus-empty-filter-btn" @click="localFilter = 'all'">
        <X :size="11" /> Voir tous les rendus
      </button>
    </div>

    <div
      v-for="group in displayedRendus"
      :key="group.devoir.id"
      class="rendus-group"
    >
      <div class="rendus-group-header">
        <div class="rendus-group-header-left">
          <span
            v-if="(group.devoir as Devoir).type"
            class="devoir-type-badge"
            :class="`type-${(group.devoir as Devoir).type}`"
          >
            {{ typeLabel((group.devoir as Devoir).type) }}
          </span>
          <span class="rendus-group-title">
            {{ (group.devoir as Devoir).title ?? `Devoir #${group.devoir.id}` }}
          </span>
          <span class="rendus-count-badge">
            {{ group.rendus.length }} rendu{{ group.rendus.length > 1 ? 's' : '' }}
            <template v-if="group.devoir.students_total">
              / {{ group.devoir.students_total }} attendu{{ group.devoir.students_total > 1 ? 's' : '' }}
            </template>
          </span>
          <div v-if="group.devoir.students_total" class="rendus-progress-mini">
            <div class="rendus-progress-mini-fill" :style="{ width: submissionPct(group) + '%' }" />
            <span class="rendus-progress-mini-label">{{ submissionPct(group) }}%</span>
          </div>
        </div>
        <div class="rendus-group-header-right">
          <span v-if="group.rendus.filter(r => r.note).length" class="rendus-graded-count">
            {{ group.rendus.filter(r => r.note).length }} noté{{ group.rendus.filter(r => r.note).length > 1 ? 's' : '' }}
          </span>
          <span v-if="group.rendus.some(r => isLate(r, group))" class="rendus-late-count">
            {{ group.rendus.filter(r => isLate(r, group)).length }} retard{{ group.rendus.filter(r => isLate(r, group)).length > 1 ? 's' : '' }}
          </span>
          <button class="btn-ghost btn-ouvrir" @click="openDevoir(group.devoir.id!)">
            Ouvrir <ChevronRight :size="13" />
          </button>
        </div>
      </div>

      <div class="rendus-list">
        <div v-for="r in group.rendus" :key="r.id" class="rendu-row">
          <div class="rendu-avatar" :style="{ background: avatarColor(r.student_name) }">
            {{ initials(r.student_name) }}
          </div>
          <div class="rendu-info">
            <span class="rendu-student">{{ r.student_name }}</span>
            <span class="rendu-file">
              <Link2 v-if="r.type === 'link'" :size="10" />
              <FileText v-else :size="10" />
              {{ r.type === 'file' ? (r.file_name ?? r.content) : r.content }}
            </span>
          </div>
          <div class="rendu-right">
            <!-- Late indicator -->
            <span v-if="isLate(r, group)" class="rendu-late-badge" title="Dépôt en retard">
              <Clock :size="9" /> Retard
            </span>
            <!-- Notation inline -->
            <template v-if="editingDepotId === r.id">
              <div class="grade-inline-form">
                <input
                  :value="pendingNoteValue"
                  class="form-input grade-input"
                  :class="{ 'grade-input--invalid': !canSave }"
                  placeholder="A–F ou numérique"
                  style="width:90px;font-size:12px;padding:4px 8px"
                  @input="$emit('update:pendingNoteValue', ($event.target as HTMLInputElement).value)"
                  @keydown.enter="canSave && saveGrade(r.id)"
                  @keydown.escape="cancelEditGrade"
                />
                <span v-if="!canSave" class="grade-hint">Format : A–F ou numérique</span>
                <textarea
                  :value="pendingFeedbackValue"
                  class="form-input grade-textarea"
                  placeholder="Commentaire…"
                  rows="2"
                  style="font-size:11px;padding:4px 8px;resize:none"
                  @input="$emit('update:pendingFeedbackValue', ($event.target as HTMLTextAreaElement).value)"
                  @keydown.escape="cancelEditGrade"
                />
                <div class="grade-inline-actions">
                  <button class="btn-ghost" style="font-size:11px;padding:3px 8px" @click="cancelEditGrade">
                    <X :size="11" />
                  </button>
                  <button
                    class="btn-cta"
                    style="font-size:11px;padding:3px 10px"
                    :disabled="savingGrade || !canSave"
                    @click="saveGrade(r.id)"
                  >
                    {{ savingGrade ? '…' : 'OK' }}
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <span
                v-if="r.note"
                class="note-badge note-badge-clickable"
                :title="'Modifier la note'"
                @click="startEditGrade(r.id, r.note, r.feedback)"
              >
                <Award :size="11" /> {{ r.note }}
              </span>
              <span
                v-else
                class="rendu-no-note rendu-no-note-clickable"
                :title="'Ajouter une note'"
                @click="startEditGrade(r.id, null, null)"
              >
                Non noté
              </span>
              <p
                v-if="r.feedback"
                class="rendu-feedback"
                :class="{ 'rendu-feedback--expanded': expandedFeedbacks.has(r.id) }"
                @click="toggleFeedback(r.id)"
              >{{ r.feedback }}</p>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Toolbar ─────────────────────────────────────────────────────────────── */
.rendus-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  max-width: 780px; margin: 0 auto 10px; padding: 0 4px; gap: 10px;
}
.rendus-toolbar-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }
.rendus-total-label { font-size: 13px; font-weight: 700; color: var(--text-primary); white-space: nowrap; }
.rendus-export-btn {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11px; padding: 5px 10px; flex-shrink: 0;
  border: 1px solid var(--border); border-radius: var(--radius-sm);
}
.rendus-export-btn:hover { background: var(--bg-hover); border-color: var(--accent); color: var(--accent); }
.rendus-filter-pills { display: flex; gap: 4px; }
.rendus-pill {
  font-size: 10px; font-weight: 600; padding: 3px 10px;
  border-radius: var(--radius); border: 1px solid var(--border);
  background: transparent; color: var(--text-muted);
  cursor: pointer; font-family: var(--font);
  transition: all .15s;
}
.rendus-pill:hover { background: var(--bg-hover); color: var(--text-primary); }
.rendus-pill.active { background: var(--accent); color: #fff; border-color: var(--accent); }

/* Empty state filtre : distinct du empty state "aucun rendu du tout" */
.rendus-empty-filter {
  max-width: 780px;
  margin: 0 auto;
  padding: 36px 20px;
  text-align: center;
  border: 1px dashed var(--border-input);
  border-radius: var(--radius);
  background: var(--bg-elevated);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.rendus-empty-filter-icon { color: var(--text-muted); opacity: .5; margin-bottom: 4px; }
.rendus-empty-filter-title {
  font-size: 13px; font-weight: 700; color: var(--text-primary); margin: 0;
}
.rendus-empty-filter-hint {
  font-size: 12px; color: var(--text-muted); margin: 0;
}
.rendus-empty-filter-btn {
  display: inline-flex; align-items: center; gap: 4px;
  margin-top: 6px;
  font-family: inherit; font-size: 12px; font-weight: 600;
  padding: 5px 12px; border-radius: var(--radius-sm);
  background: var(--bg-hover);
  border: 1px solid var(--border);
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--t-fast), border-color var(--t-fast);
}
.rendus-empty-filter-btn:hover { background: var(--bg-active); border-color: var(--accent); color: var(--accent); }

/* ── Grade distribution ──────────────────────────────────────────────────── */
.grade-dist { display: flex; gap: 4px; flex-wrap: wrap; }
.grade-dist-chip {
  font-size: 10px; font-weight: 700; padding: 1px 6px;
  border-radius: var(--radius-sm); white-space: nowrap;
}
.grade-dist--a { background: rgba(var(--color-success-rgb),.15); color: var(--color-success); }
.grade-dist--b { background: rgba(var(--accent-rgb),.15); color: var(--accent); }
.grade-dist--c { background: rgba(var(--color-warning-rgb),.15); color: var(--color-warning); }
.grade-dist--d { background: rgba(var(--color-danger-rgb),.15); color: var(--color-danger); }
.grade-dist--none { background: var(--bg-active); color: var(--text-muted); }

/* ── Late badge ──────────────────────────────────────────────────────────── */
.rendu-late-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 9px; font-weight: 700; padding: 1px 6px;
  border-radius: var(--radius-sm); white-space: nowrap;
  background: rgba(var(--color-danger-rgb),.12); color: var(--color-danger);
}

/* ── Liste commune ────────────────────────────────────────────────────────── */
.devoirs-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 780px;
  margin: 0 auto;
}

/* ── Rendus groupés ──────────────────────────────────────────────────────── */
.rendus-group {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  max-width: 780px;
  margin: 0 auto;
  width: 100%;
}

.rendus-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid var(--border);
}

.rendus-group-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.rendus-group-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rendus-count-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 20px;
  background: rgba(var(--accent-rgb), 0.2);
  color: var(--accent);
}

.rendus-group-header-right {
  display: flex; align-items: center; gap: 6px; flex-shrink: 0;
}
.rendus-graded-count {
  font-size: 10px; font-weight: 600; padding: 2px 6px;
  border-radius: var(--radius-sm); background: rgba(var(--color-success-rgb),.12); color: var(--color-success);
}
.rendus-late-count {
  font-size: 10px; font-weight: 600; padding: 2px 6px;
  border-radius: var(--radius-sm); background: rgba(var(--color-danger-rgb),.12); color: var(--color-danger);
}
.btn-ouvrir {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 5px 10px;
}

.rendus-list {
  padding: 8px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rendu-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.03);
  transition: background var(--t-fast);
}
.rendu-row:hover { background: rgba(255, 255, 255, 0.06); }

.rendu-avatar {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
}

.rendu-info { flex: 1; min-width: 0; }

.rendu-student {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.rendu-file {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.rendu-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
  min-width: 90px;
}

.note-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 20px;
  background: rgba(var(--accent-rgb), 0.15);
  color: var(--accent-light);
}

.note-badge-clickable,
.rendu-no-note-clickable {
  cursor: pointer;
  transition: opacity .15s;
}
.note-badge-clickable:hover   { opacity: .75; }
.rendu-no-note-clickable:hover { opacity: .75; text-decoration: underline; }

.rendu-no-note {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.rendu-feedback {
  font-size: 11px;
  color: var(--text-secondary);
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-style: italic;
  cursor: pointer;
  transition: all var(--t-fast);
}
.rendu-feedback:hover { opacity: .8; }
.rendu-feedback--expanded {
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
}

/* ── Mini progress bar ────────────────────────────────────────────────────── */
.rendus-progress-mini {
  display: flex; align-items: center; gap: 5px; margin-left: 4px;
}
.rendus-progress-mini .rendus-progress-mini-fill {
  width: 50px; height: 4px; border-radius: 2px;
  background: var(--color-success); transition: width .3s;
}
.rendus-progress-mini {
  position: relative; width: 50px; height: 4px;
  border-radius: 2px; background: var(--bg-active); overflow: visible;
}
.rendus-progress-mini-fill {
  height: 100%; border-radius: 2px; background: var(--color-success); transition: width .3s;
}
.rendus-progress-mini-label {
  position: absolute; right: -30px; top: -4px;
  font-size: 9px; color: var(--text-muted); white-space: nowrap;
}

/* ── Grade validation ────────────────────────────────────────────────────── */
.grade-input--invalid { border-color: var(--color-error) !important; }
.grade-hint {
  font-size: 9px; color: var(--color-error); margin-top: -2px;
}

/* ── Notation inline ─────────────────────────────────────────────────────── */
.grade-inline-form {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 160px;
}

.grade-inline-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
}

/* ── Badges de type ──────────────────────────────────────────────────────── */
.devoir-type-badge {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border-radius: var(--radius-xs);
}

.type-livrable     { background: rgba(var(--accent-rgb),.2);   color: var(--accent); }
.type-soutenance   { background: rgba(var(--color-warning-rgb),.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: var(--color-cctl); }
.type-etude_de_cas { background: rgba(var(--color-success-rgb),.2);    color: var(--color-success); }
.type-memoire      { background: rgba(var(--color-danger-rgb),.2);    color: var(--color-danger); }
.type-autre        { background: rgba(127,140,141,.2);  color: var(--color-autre); }

/* ── Shared ──────────────────────────────────────────────────────────────── */
.skel-card {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.empty-state-custom {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 60px 20px; text-align: center;
}
.empty-icon { color: var(--text-muted); opacity: 0.35; margin-bottom: 16px; }
.empty-state-custom h3 { font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px; }
.empty-state-custom p { font-size: 13px; color: var(--text-muted); max-width: 320px; line-height: 1.5; }
</style>
