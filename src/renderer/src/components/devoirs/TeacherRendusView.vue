/**
 * Vue rendus enseignant : rendus groupés par devoir, notation inline avec note et feedback.
 */
<script setup lang="ts">
import { Users, ChevronRight, Link2, FileText, Award, X } from 'lucide-vue-next'
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
  startEditGrade: (depotId: number, currentNote: string | null, currentFeedback: string | null) => void
  cancelEditGrade: () => void
  saveGrade: (depotId: number) => void
  openDevoir: (id: number) => void
}>()

defineEmits<{
  (e: 'update:pendingNoteValue', v: string): void
  (e: 'update:pendingFeedbackValue', v: string): void
}>()

const travauxStore = useTravauxStore()
</script>

<template>
  <div v-if="travauxStore.loading" class="devoirs-list">
    <div v-for="i in 3" :key="i" class="skel-card">
      <div class="skel skel-line skel-w50" style="height:16px" />
      <div class="skel skel-line skel-w30" style="height:12px;margin-top:8px" />
    </div>
  </div>

  <div v-else-if="rendusByDevoir.length === 0" class="empty-state-custom">
    <Users :size="48" class="empty-icon" />
    <h3>Aucun rendu pour cette promotion</h3>
    <p>Les rendus des étudiants apparaîtront ici.</p>
  </div>

  <div v-else class="devoirs-list">
    <div
      v-for="group in rendusByDevoir"
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
        </div>
        <button class="btn-ghost btn-ouvrir" @click="openDevoir(group.devoir.id!)">
          Ouvrir <ChevronRight :size="13" />
        </button>
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
            <!-- Notation inline -->
            <template v-if="editingDepotId === r.id">
              <div class="grade-inline-form">
                <input
                  :value="pendingNoteValue"
                  class="form-input grade-input"
                  placeholder="A–F ou /20"
                  style="width:90px;font-size:12px;padding:4px 8px"
                  @input="$emit('update:pendingNoteValue', ($event.target as HTMLInputElement).value)"
                />
                <textarea
                  :value="pendingFeedbackValue"
                  class="form-input grade-textarea"
                  placeholder="Commentaire…"
                  rows="2"
                  style="font-size:11px;padding:4px 8px;resize:none"
                  @input="$emit('update:pendingFeedbackValue', ($event.target as HTMLTextAreaElement).value)"
                />
                <div class="grade-inline-actions">
                  <button class="btn-ghost" style="font-size:11px;padding:3px 8px" @click="cancelEditGrade">
                    <X :size="11" />
                  </button>
                  <button
                    class="btn-primary"
                    style="font-size:11px;padding:3px 10px"
                    :disabled="savingGrade"
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
              <p v-if="r.feedback" class="rendu-feedback">{{ r.feedback }}</p>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  border-radius: 10px;
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
  background: rgba(74, 144, 217, 0.2);
  color: var(--accent);
}

.btn-ouvrir {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 5px 10px;
  margin-left: 12px;
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
  border-radius: 6px;
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
  background: rgba(74, 144, 217, 0.15);
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
  border-radius: 4px;
}

.type-livrable     { background: rgba(74,144,217,.2);   color: var(--accent); }
.type-soutenance   { background: rgba(243,156,18,.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: #9b87f5; }
.type-etude_de_cas { background: rgba(39,174,96,.2);    color: var(--color-success); }
.type-memoire      { background: rgba(231,76,60,.2);    color: #e74c3c; }
.type-autre        { background: rgba(127,140,141,.2);  color: #95a5a6; }

/* ── Shared ──────────────────────────────────────────────────────────────── */
.skel-card {
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: 10px;
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
