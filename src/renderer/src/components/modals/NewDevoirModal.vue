<script setup lang="ts">
  import { ref, watch, computed } from 'vue'
  import { Users, Plus, X } from 'lucide-vue-next'
  import { useAppStore }     from '@/stores/app'
  import { useTravauxStore } from '@/stores/travaux'
  import { useToast }        from '@/composables/useToast'
  import { avatarColor, initials } from '@/utils/format'
  import { parseCategoryIcon } from '@/utils/categoryIcon'
  import Modal from '@/components/ui/Modal.vue'
  import { isoForDatetimeLocal } from '@/utils/date'
  import type { Student, Group } from '@/types'
  import type { ProjectMeta } from '@/components/modals/NewProjectModal.vue'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const appStore     = useAppStore()
  const travauxStore = useTravauxStore()
  const { showToast } = useToast()

  // ── Types disponibles ──────────────────────────────────────────────────────
  type DevoirType = 'soutenance' | 'livrable' | 'cctl' | 'etude_de_cas' | 'memoire' | 'autre'

  const TYPE_OPTIONS: { value: DevoirType; label: string }[] = [
    { value: 'livrable',    label: 'Livrable' },
    { value: 'soutenance',  label: 'Soutenance' },
    { value: 'cctl',        label: 'CCTL' },
    { value: 'etude_de_cas', label: 'Étude de cas' },
    { value: 'memoire',     label: 'Mémoire' },
    { value: 'autre',       label: 'Autre' },
  ]

  // ── Formulaire ────────────────────────────────────────────────────────────
  const title       = ref('')
  const description = ref('')
  const type        = ref<DevoirType>('livrable')
  const category    = ref('')
  const deadline    = ref(isoForDatetimeLocal())
  const startDate   = ref(isoForDatetimeLocal())
  const isDraft     = ref(false)
  const isGraded    = ref(false)
  const room        = ref('')
  const aavs        = ref('')
  const requiresSubmission = ref(true)
  const assignTo    = ref<'all' | 'group'>('all')
  const channelId   = ref<number | null>(null)
  const channels    = ref<{ id: number; name: string }[]>([])
  const creating    = ref(false)

  // ── Projets disponibles (depuis localStorage) ─────────────────────────────
  const projects = computed((): ProjectMeta[] => {
    if (!appStore.activePromoId) return []
    try {
      const raw = localStorage.getItem(`cc_projects_${appStore.activePromoId}`)
      return raw ? (JSON.parse(raw) as ProjectMeta[]) : []
    } catch { return [] }
  })

  // ── Comportements selon le type ───────────────────────────────────────────
  /** Pour soutenance et cctl : pas de date de début (présence à une date fixe) */
  const isEventType = computed(() => type.value === 'soutenance' || type.value === 'cctl' || type.value === 'etude_de_cas')

  /** Afficher le champ salle pour les événements */
  const showRoomField = computed(() => isEventType.value)

  /** Pour étude de cas : le prof peut activer/désactiver le rendu */
  const showSubmissionToggle = computed(() => type.value === 'etude_de_cas')

  /** Pour livrable et autre : afficher "Ce devoir est noté" */
  const needsGradedToggle = computed(() => type.value === 'livrable' || type.value === 'autre')

  // Quand le type change, ajuster requiresSubmission automatiquement
  watch(type, (t) => {
    if (t === 'soutenance' || t === 'cctl') requiresSubmission.value = false
    else if (t === 'etude_de_cas') requiresSubmission.value = false  // défaut, modifiable
    else requiresSubmission.value = true
  })

  // ── Gestion des groupes ────────────────────────────────────────────────────
  const students        = ref<Student[]>([])
  const groups          = ref<Group[]>([])
  const selectedGroupId = ref<number | null>(null)
  const newGroupName    = ref('')
  const newGroupMembers = ref<number[]>([])
  const creatingGroup   = ref(false)
  const showGroupForm   = ref(false)
  const groupMembers    = ref<Record<number, number[]>>({})

  watch(() => props.modelValue, async (open) => {
    if (open && appStore.activePromoId) {
      const [chRes, stuRes, grpRes] = await Promise.all([
        window.api.getChannels(appStore.activePromoId),
        window.api.getStudents(appStore.activePromoId),
        window.api.getGroups(appStore.activePromoId),
      ])
      channels.value = chRes?.ok ? chRes.data : []
      students.value = stuRes?.ok ? stuRes.data : []
      groups.value   = grpRes?.ok ? grpRes.data : []

      // Pré-sélectionner le projet actif (ou vider)
      category.value = appStore.activeProject ?? ''

      // Pré-sélectionner le canal : priorité canal actif, sinon premier canal du projet
      if (appStore.activeChannelId) {
        channelId.value = appStore.activeChannelId
      } else if (appStore.activeProject) {
        const projChannel = (channels.value as { id: number; name: string; category?: string }[])
          .find(c => c.category?.trim() === appStore.activeProject)
        channelId.value = projChannel?.id ?? null
      } else {
        channelId.value = null
      }

      title.value = description.value = ''
      type.value = 'livrable'
      assignTo.value = 'all'
      isDraft.value  = false
      isGraded.value = false
      room.value     = ''
      aavs.value     = ''
      requiresSubmission.value = true
      deadline.value = startDate.value = isoForDatetimeLocal()
      selectedGroupId.value = null
      showGroupForm.value   = false
      newGroupName.value    = ''
      newGroupMembers.value = []
    }
  })

  async function selectGroup(g: Group) {
    selectedGroupId.value = g.id
    if (!groupMembers.value[g.id]) {
      const res = await window.api.getGroupMembers(g.id)
      groupMembers.value[g.id] = res?.ok ? res.data.map((m: { student_id: number }) => m.student_id) : []
    }
  }

  async function createGroup() {
    if (!newGroupName.value.trim() || !appStore.activePromoId) return
    creatingGroup.value = true
    try {
      const res = await window.api.createGroup({ name: newGroupName.value.trim(), promoId: appStore.activePromoId })
      if (!res?.ok) return
      const newId = res.data.id
      await window.api.setGroupMembers({ groupId: newId, memberIds: newGroupMembers.value })
      groupMembers.value[newId] = [...newGroupMembers.value]

      const grpRes = await window.api.getGroups(appStore.activePromoId)
      groups.value = grpRes?.ok ? grpRes.data : []

      selectedGroupId.value = newId
      showGroupForm.value   = false
      newGroupName.value    = ''
      newGroupMembers.value = []
    } finally {
      creatingGroup.value = false
    }
  }

  function toggleMember(studentId: number) {
    const idx = newGroupMembers.value.indexOf(studentId)
    if (idx >= 0) newGroupMembers.value.splice(idx, 1)
    else newGroupMembers.value.push(studentId)
  }

  async function submit() {
    if (!title.value.trim() || !channelId.value) return
    creating.value = true
    try {
      // Validation : startDate doit être avant deadline
      if (!isEventType.value && startDate.value && startDate.value > deadline.value) {
        showToast('La date de début doit être avant la deadline.', 'error')
        return
      }
      const res = await travauxStore.createTravail({
        title:        title.value.trim(),
        description:  description.value.trim() || null,
        type:         type.value,
        category:     category.value.trim() || null,
        deadline:     deadline.value,
        startDate:    isEventType.value ? null : startDate.value,
        isPublished:  !isDraft.value,
        isGraded:     needsGradedToggle.value ? isGraded.value : null,
        assignedTo:   assignTo.value,
        groupId:      assignTo.value === 'group' ? selectedGroupId.value : null,
        channelId:    channelId.value,
        room:         room.value.trim() || null,
        aavs:         aavs.value.trim() || null,
        requiresSubmission: requiresSubmission.value,
      })
      if (!res) return
      showToast('Devoir créé.', 'success')
      emit('update:modelValue', false)
    } finally {
      creating.value = false
    }
  }
</script>

<template>
  <Modal :model-value="modelValue" title="Nouveau devoir" max-width="620px" @update:model-value="emit('update:modelValue', $event)">
    <form style="padding:16px;display:flex;flex-direction:column;gap:12px" @submit.prevent="submit">

      <!-- Canal -->
      <div class="form-group">
        <label class="form-label">Canal</label>
        <select v-model="channelId" class="form-select" required>
          <option :value="null">Choisir un canal…</option>
          <option v-for="c in channels" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </div>

      <!-- Titre + Type -->
      <div style="display:flex;gap:10px">
        <div class="form-group" style="flex:2">
          <label class="form-label">Titre</label>
          <input v-model="title" type="text" class="form-input" placeholder="Titre du devoir" required />
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Type</label>
          <select v-model="type" class="form-select">
            <option v-for="opt in TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
      </div>

      <!-- Description -->
      <div class="form-group">
        <label class="form-label">Description <span style="opacity:.6">(optionnel)</span></label>
        <textarea v-model="description" class="form-input" rows="3" style="resize:vertical" placeholder="Instructions, objectifs…" />
      </div>

      <!-- Dates -->
      <div style="display:flex;gap:10px">
        <div v-if="!isEventType" class="form-group" style="flex:1">
          <label class="form-label">Date de début</label>
          <input v-model="startDate" type="datetime-local" class="form-input" />
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">{{ isEventType ? 'Date de l\'épreuve' : 'Date limite' }}</label>
          <input v-model="deadline" type="datetime-local" class="form-input" required />
        </div>
      </div>

      <!-- Projet + Assignation -->
      <div style="display:flex;gap:10px">
        <div class="form-group" style="flex:1">
          <label class="form-label">Projet <span style="opacity:.6">(optionnel)</span></label>
          <select v-if="projects.length" v-model="category" class="form-select">
            <option value="">Aucun projet</option>
            <option v-for="p in projects" :key="p.name" :value="p.name">
              {{ parseCategoryIcon(p.name).label || p.name }}
            </option>
          </select>
          <input v-else v-model="category" type="text" class="form-input" placeholder="ex : Bloc 1, Module 3…" />
        </div>
        <div v-if="!isEventType" class="form-group" style="flex:1">
          <label class="form-label">Assigné à</label>
          <div style="display:flex;gap:16px;padding-top:8px">
            <label class="radio-label"><input v-model="assignTo" type="radio" value="all" /> Toute la promo</label>
            <label class="radio-label"><input v-model="assignTo" type="radio" value="group" /> Par groupe</label>
          </div>
        </div>
      </div>

      <!-- Noté toggle (livrable + autre uniquement) -->
      <label v-if="needsGradedToggle" class="checkbox-label" style="display:flex;align-items:center;gap:8px">
        <input v-model="isGraded" type="checkbox" />
        Ce devoir est noté
      </label>

      <!-- Rendu attendu toggle (étude de cas uniquement) -->
      <label v-if="showSubmissionToggle" class="checkbox-label" style="display:flex;align-items:center;gap:8px">
        <input v-model="requiresSubmission" type="checkbox" />
        Rendu attendu (fichier ou lien à déposer)
      </label>

      <!-- Salle (événements : soutenance, CCTL, étude de cas) -->
      <div v-if="showRoomField" class="form-group">
        <label class="form-label">Salle (optionnel)</label>
        <input v-model="room" type="text" class="form-input" placeholder="ex : B204, Amphi A…" />
      </div>

      <!-- AAVs (tous les types) -->
      <div class="form-group">
        <label class="form-label">AAVs — Acquis d'Apprentissage Visés (optionnel)</label>
        <textarea v-model="aavs" class="form-textarea" rows="2" placeholder="ex : AAV1 — Concevoir une architecture&#10;AAV2 — Développer un prototype" />
      </div>

      <!-- ── Constructeur de groupes ──────────────────────────────────── -->
      <div v-if="assignTo === 'group' && !isEventType" class="group-builder">
        <div class="form-label" style="margin-bottom:8px">
          <Users :size="13" style="vertical-align:middle;margin-right:4px" /> Groupes disponibles
        </div>

        <div v-if="groups.length" class="group-list">
          <button
            v-for="g in groups"
            :key="g.id"
            class="group-card"
            :class="{ selected: selectedGroupId === g.id }"
            type="button"
            @click="selectGroup(g)"
          >
            <span class="group-card-name">{{ g.name }}</span>
            <span v-if="groupMembers[g.id]" class="group-card-count">
              {{ groupMembers[g.id].length }} membre{{ groupMembers[g.id].length > 1 ? 's' : '' }}
            </span>
          </button>
        </div>
        <p v-else-if="!showGroupForm" class="group-empty">Aucun groupe créé pour cette promotion.</p>

        <div v-if="showGroupForm" class="group-form">
          <input
            v-model="newGroupName"
            class="form-input"
            placeholder="Nom du groupe…"
            style="font-size:13px"
          />
          <div class="group-members-grid">
            <button
              v-for="s in students"
              :key="s.id"
              class="group-member-btn"
              :class="{ selected: newGroupMembers.includes(s.id) }"
              type="button"
              @click="toggleMember(s.id)"
            >
              <div
                class="avatar"
                :style="{ background: avatarColor(s.name), width:'22px', height:'22px', fontSize:'9px', borderRadius:'4px' }"
              >
                {{ initials(s.name) }}
              </div>
              <span>{{ s.name }}</span>
            </button>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
            <button class="btn-ghost" type="button" style="font-size:12px" @click="showGroupForm = false">
              <X :size="12" /> Annuler
            </button>
            <button
              class="btn-primary"
              type="button"
              style="font-size:12px"
              :disabled="!newGroupName.trim() || creatingGroup"
              @click="createGroup"
            >
              {{ creatingGroup ? 'Création…' : 'Créer le groupe' }}
            </button>
          </div>
        </div>

        <button
          v-if="!showGroupForm"
          class="btn-ghost"
          type="button"
          style="font-size:12px;margin-top:8px"
          @click="showGroupForm = true"
        >
          <Plus :size="12" /> Nouveau groupe
        </button>
      </div>

      <!-- Brouillon -->
      <label class="checkbox-label" style="display:flex;align-items:center;gap:8px">
        <input v-model="isDraft" type="checkbox" />
        Enregistrer comme brouillon (non visible par les étudiants)
      </label>
    </form>

    <div class="modal-footer" style="padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;flex-shrink:0">
      <button class="btn-ghost" @click="emit('update:modelValue', false)">Annuler</button>
      <button class="btn-primary" :disabled="!title.trim() || !channelId || creating" @click="submit">
        {{ creating ? 'Création…' : isDraft ? 'Enregistrer brouillon' : 'Publier' }}
      </button>
    </div>
  </Modal>
</template>

<style scoped>
.group-builder {
  background: rgba(255,255,255,.04);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-empty {
  font-size: 12.5px;
  color: var(--text-muted);
  font-style: italic;
}

.group-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.group-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1.5px solid var(--border-input);
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font);
  cursor: pointer;
  transition: all .12s;
}
.group-card:hover    { border-color: var(--accent); color: var(--text-primary); }
.group-card.selected { border-color: var(--accent); background: rgba(74,144,217,.15); color: var(--accent); }

.group-card-name  { font-size: 13px; font-weight: 600; }
.group-card-count { font-size: 11px; opacity: .7; }

.group-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid var(--border);
  padding-top: 10px;
  margin-top: 2px;
}

.group-members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
}

.group-member-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font);
  font-size: 12.5px;
  cursor: pointer;
  transition: all .1s;
  text-align: left;
}
.group-member-btn:hover   { background: var(--bg-hover); color: var(--text-primary); }
.group-member-btn.selected {
  background: rgba(74,144,217,.15);
  border-color: rgba(74,144,217,.4);
  color: var(--accent);
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}
.radio-label input { accent-color: var(--accent); }

.checkbox-label {
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}
.checkbox-label input { accent-color: var(--accent); }
</style>
