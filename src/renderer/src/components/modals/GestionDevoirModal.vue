<script setup lang="ts">
  import { computed, watch } from 'vue'
  import { Users, Clock, CheckCircle2, XCircle, Copy, CalendarPlus } from 'lucide-vue-next'
  import { useTravauxStore } from '@/stores/travaux'
  import { useAppStore }     from '@/stores/app'
  import { useModalsStore }  from '@/stores/modals'
  import { useToast }        from '@/composables/useToast'
  import { deadlineClass, deadlineLabel, formatDate } from '@/utils/date'
  import { avatarColor, initials, formatGrade, gradeClass } from '@/utils/format'
  import Modal from '@/components/ui/Modal.vue'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const travauxStore = useTravauxStore()
  const appStore     = useAppStore()
  const modals       = useModalsStore()
  const { showToast } = useToast()

  watch(() => props.modelValue, async (open) => {
    if (open && appStore.currentTravailId) {
      await travauxStore.openTravail(appStore.currentTravailId)
    }
  })

  // ── Extension rapide de deadline ──────────────────────────────────────────
  async function extendDeadline(days: number) {
    if (!travail.value) return
    const current = new Date(travail.value.deadline)
    current.setDate(current.getDate() + days)
    const newDeadline = current.toISOString()
    // Appel API pour mettre à jour la deadline
    try {
      const res = await window.api.createTravail({
        ...travail.value,
        deadline: newDeadline,
        id: travail.value.id,
        _update: true, // flag pour update au lieu de create
      } as any)
      if (res?.ok) {
        showToast(`Deadline prolongée de ${days} jour${days > 1 ? 's' : ''}.`, 'success')
        await travauxStore.openTravail(travail.value.id)
      }
    } catch {
      showToast('Erreur lors de la mise à jour.', 'error')
    }
  }

  // ── Duplication ──────────────────────────────────────────────────────────
  function duplicateDevoir() {
    if (!travail.value) return
    // Stocker les données pour pré-remplir NewDevoirModal
    appStore.duplicateDevoirData = {
      title: travail.value.title + ' (copie)',
      type: travail.value.type,
      category: travail.value.category,
      description: travail.value.description,
      channelId: (travail.value as any).channel_id,
    }
    emit('update:modelValue', false)
    modals.newDevoir = true
  }

  const travail = computed(() => travauxStore.currentDevoir)
  const depots  = computed(() => travauxStore.depots)

  const submittedDepots = computed(() => depots.value.filter((d) => d.submitted_at))
  const notedDepots     = computed(() => depots.value.filter((d) => d.note != null))
  const totalCount      = computed(() => depots.value.length)
  const submitPct       = computed(() =>
    totalCount.value ? Math.round((submittedDepots.value.length / totalCount.value) * 100) : 0,
  )

  function openDepots() {
    emit('update:modelValue', false)
    modals.depots = true
  }
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="travail?.title ?? 'Détail du devoir'"
    max-width="680px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="!travail" class="gd-loading">
      <div class="skel skel-line skel-w50" style="height:16px;margin-bottom:10px" />
      <div class="skel skel-line skel-w90" style="height:12px;margin-bottom:8px" />
      <div class="skel skel-line skel-w70" style="height:12px" />
    </div>

    <template v-else>
      <!-- ── Méta-données ────────────────────────────────────────────────── -->
      <div class="gd-meta">
        <div class="gd-meta-badges">
          <span class="travail-type-badge" :class="`type-${travail.type}`">{{ travail.type }}</span>
          <span v-if="travail.category" class="tag-badge">{{ travail.category }}</span>
          <span
            class="deadline-badge"
            :class="deadlineClass(travail.deadline)"
          >
            <Clock :size="10" style="vertical-align:middle;margin-right:3px" />
            {{ deadlineLabel(travail.deadline) }}
          </span>
        </div>
        <div class="gd-meta-info">
          <span class="gd-info-item">
            <strong>Échéance :</strong> {{ formatDate(travail.deadline) }}
            <span class="gd-extend-btns">
              <button class="gd-extend-btn" title="+1 jour" @click="extendDeadline(1)">+1j</button>
              <button class="gd-extend-btn" title="+3 jours" @click="extendDeadline(3)">+3j</button>
              <button class="gd-extend-btn" title="+1 semaine" @click="extendDeadline(7)">+1sem</button>
            </span>
          </span>
          <span v-if="travail.start_date" class="gd-info-item">
            <strong>Début :</strong> {{ formatDate(travail.start_date) }}
          </span>
          <span v-if="travail.channel_name" class="gd-info-item">
            <strong>Canal :</strong> # {{ travail.channel_name }}
          </span>
          <span class="gd-info-item">
            <strong>Assigné à :</strong>
            {{ travail.assigned_to === 'group' ? `Groupe ${travail.group_name ?? ''}` : 'Tous les étudiants' }}
          </span>
        </div>
        <p v-if="travail.description" class="gd-description">{{ travail.description }}</p>
      </div>

      <!-- ── Barre de progression ────────────────────────────────────────── -->
      <div class="gd-progress-block">
        <div class="gd-progress-header">
          <span class="gd-progress-title">Rendus</span>
          <span class="gd-progress-counts">
            <strong>{{ submittedDepots.length }}</strong> déposé{{ submittedDepots.length > 1 ? 's' : '' }}
            · <strong>{{ notedDepots.length }}</strong> noté{{ notedDepots.length > 1 ? 's' : '' }}
            sur {{ totalCount }}
          </span>
        </div>
        <div class="linear-progress">
          <div class="linear-progress-fill" :style="{ width: submitPct + '%' }" />
        </div>
      </div>

      <!-- ── Deux colonnes : Rendus / En attente ───────────────────────── -->
      <div class="gd-columns">
        <!-- Colonne Rendus -->
        <div class="gd-column">
          <div class="gd-column-header">
            <CheckCircle2 :size="14" style="color:var(--color-success)" />
            Rendus ({{ submittedDepots.length }})
          </div>
          <div class="gd-column-body">
            <div
              v-for="d in submittedDepots"
              :key="d.id"
              class="gd-student-row"
            >
              <div
                class="avatar"
                :style="{ background: avatarColor(d.student_name), width:'26px', height:'26px', fontSize:'9px', borderRadius:'5px' }"
              >
                {{ initials(d.student_name) }}
              </div>
              <span class="gd-student-name">{{ d.student_name }}</span>
              <span
                v-if="d.note"
                class="gd-grade"
                :class="gradeClass(d.note)"
              >{{ formatGrade(d.note) }}</span>
              <span v-else class="gd-no-grade">—</span>
            </div>
            <div v-if="submittedDepots.length === 0" class="gd-empty">
              Aucun rendu pour l'instant.
            </div>
          </div>
        </div>

        <!-- Colonne En attente -->
        <div class="gd-column">
          <div class="gd-column-header">
            <XCircle :size="14" style="color:var(--color-danger)" />
            En attente ({{ totalCount - submittedDepots.length }})
          </div>
          <div class="gd-column-body">
            <!-- Les dépôts sans submitted_at ou sans fichier sont "en attente" -->
            <div
              v-for="d in depots.filter(d => !d.submitted_at)"
              :key="d.id"
              class="gd-student-row pending"
            >
              <div
                class="avatar"
                :style="{ background: avatarColor(d.student_name), width:'26px', height:'26px', fontSize:'9px', borderRadius:'5px', opacity: '.5' }"
              >
                {{ initials(d.student_name) }}
              </div>
              <span class="gd-student-name" style="opacity:.6">{{ d.student_name }}</span>
            </div>
            <div
              v-if="totalCount === submittedDepots.length"
              class="gd-empty"
              style="color:var(--color-success)"
            >
              Tout le monde a rendu ! 🎉
            </div>
          </div>
        </div>
      </div>

      <!-- ── Pied ───────────────────────────────────────────────────────── -->
      <div class="gd-footer">
        <button class="btn-ghost" style="font-size:13px" @click="emit('update:modelValue', false)">
          Fermer
        </button>
        <button class="btn-ghost" style="font-size:13px" @click="duplicateDevoir">
          <Copy :size="13" /> Dupliquer
        </button>
        <button class="btn-primary" style="font-size:13px" @click="openDepots">
          <Users :size="14" /> Voir tous les dépôts
        </button>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.gd-loading { padding: 24px 20px; }
.gd-extend-btns { display: inline-flex; gap: 3px; margin-left: 6px; }
.gd-extend-btn {
  font-size: 10px; font-weight: 600; padding: 1px 5px; border-radius: 4px;
  background: rgba(255,255,255,.06); color: var(--accent); border: 1px solid var(--border-input);
  cursor: pointer; font-family: var(--font); transition: background var(--t-fast);
}
.gd-extend-btn:hover { background: rgba(255,255,255,.12); }

.gd-meta {
  padding: 16px 20px 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.gd-meta-badges {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.gd-meta-info {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.gd-info-item {
  font-size: 13px;
  color: var(--text-secondary);
}
.gd-info-item strong { color: var(--text-primary); }

.gd-description {
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.55;
  padding: 8px 12px;
  background: rgba(255,255,255,.04);
  border-radius: 6px;
  border-left: 3px solid var(--border-input);
}

/* Progression */
.gd-progress-block {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gd-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.gd-progress-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
}

.gd-progress-counts {
  font-size: 12.5px;
  color: var(--text-secondary);
}
.gd-progress-counts strong { color: var(--text-primary); }

/* Colonnes */
.gd-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  padding: 14px 20px;
  min-height: 160px;
  max-height: 38vh;
  overflow: hidden;
}

.gd-column {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
}
.gd-column:first-child { padding-right: 12px; border-right: 1px solid var(--border); }
.gd-column:last-child  { padding-left: 12px; }

.gd-column-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin-bottom: 4px;
}

.gd-column-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  flex: 1;
}

.gd-student-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  transition: background .1s;
}
.gd-student-row:hover { background: rgba(255,255,255,.04); }

.gd-student-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gd-grade {
  font-size: 13px;
  font-weight: 800;
  width: 22px;
  text-align: center;
  flex-shrink: 0;
}
.gd-grade.grade-a  { color: var(--color-success); }
.gd-grade.grade-b  { color: #27ae60; }
.gd-grade.grade-c  { color: var(--color-warning); }
.gd-grade.grade-d  { color: var(--color-danger); }

.gd-no-grade {
  font-size: 13px;
  color: var(--text-muted);
  width: 22px;
  text-align: center;
  flex-shrink: 0;
}

.gd-empty {
  font-size: 12.5px;
  color: var(--text-muted);
  font-style: italic;
  padding: 8px 0;
}

/* Badges */
.travail-type-badge {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .5px;
  padding: 2px 7px;
  border-radius: 4px;
}
.type-livrable     { background: rgba(74,144,217,.2);   color: var(--accent); }
.type-soutenance   { background: rgba(243,156,18,.2);   color: var(--color-warning); }
.type-cctl         { background: rgba(123,104,238,.2);  color: #9b87f5; }
.type-etude_de_cas { background: rgba(39,174,96,.2);    color: var(--color-success); }
.type-memoire      { background: rgba(231,76,60,.2);    color: #e74c3c; }
.type-autre        { background: rgba(127,140,141,.2);  color: #95a5a6; }

/* Pied */
.gd-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
</style>
