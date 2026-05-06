<script setup lang="ts">
  /** NewTravailModal - Création d'un travail (devoir / jalon / projet) */
  import { ref, watch, computed } from 'vue'
  import { Users, Plus, X } from 'lucide-vue-next'
  import { useAppStore }     from '@/stores/app'
  import { useTravauxStore } from '@/stores/travaux'
  import { useToast }        from '@/composables/useToast'
  import { avatarColor, initials } from '@/utils/format'
  import Modal from '@/components/ui/Modal.vue'
  import { parseCategoryIcon } from '@/utils/categoryIcon'
  import { isoForDatetimeLocal } from '@/utils/date'
  import { toRawPayload } from '@/utils/ipcSafe'
  import type { Student, Group } from '@/types'
  import { STORAGE_KEYS } from '@/constants'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const appStore     = useAppStore()
  const travauxStore = useTravauxStore()
  const { showToast } = useToast()

  // ── Formulaire ────────────────────────────────────────────────────────────
  const title       = ref('')
  const description = ref('')
  const type        = ref<'livrable' | 'soutenance' | 'cctl' | 'etude_de_cas' | 'memoire' | 'autre'>('livrable')
  const category    = ref('')
  const deadline    = ref(isoForDatetimeLocal())
  const startDate   = ref(isoForDatetimeLocal())
  const isDraft     = ref(false)
  const assignTo    = ref<'all' | 'group'>('all')
  const dbProjects    = ref<string[]>([])
  const allProjects   = computed(() => {
    const custom = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_PROJECTS) ?? '[]') as string[] } catch { return [] } })()
    const set = new Set([...dbProjects.value, ...custom])
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'))
  })
  const creating    = ref(false)

  // ── Gestion des groupes ────────────────────────────────────────────────────
  const students        = ref<Student[]>([])
  const groups          = ref<Group[]>([])
  const selectedGroupId = ref<number | null>(null)
  const newGroupName    = ref('')
  const newGroupMembers = ref<number[]>([])
  const creatingGroup   = ref(false)
  const showGroupForm   = ref(false)
  const groupMembers    = ref<Record<number, number[]>>({}) // groupId → studentIds

  watch(() => props.modelValue, async (open) => {
    if (open && appStore.activePromoId) {
      const [stuRes, grpRes, projRes] = await Promise.all([
        window.api.getStudents(appStore.activePromoId),
        window.api.getGroups(appStore.activePromoId),
        window.api.getTravailCategories(appStore.activePromoId),
      ])
      students.value   = stuRes?.ok ? stuRes.data : []
      groups.value     = grpRes?.ok ? grpRes.data : []
      dbProjects.value = projRes?.ok ? projRes.data : []

      title.value = description.value = ''
      // Pré-remplir avec le projet actif depuis la sidebar
      category.value = appStore.activeProject ?? ''
      type.value = 'livrable'
      assignTo.value = 'all'
      isDraft.value  = false
      deadline.value = startDate.value = isoForDatetimeLocal()
      selectedGroupId.value = null
      showGroupForm.value   = false
      newGroupName.value    = ''
      newGroupMembers.value = []
    }
  })

  // Charger les membres d'un groupe à la sélection
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
      await window.api.setGroupMembers(toRawPayload({ groupId: newId, memberIds: newGroupMembers.value }))
      groupMembers.value[newId] = [...newGroupMembers.value]

      // Rafraîchir la liste des groupes
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

  // Soutenance et CCTL sont des événements ponctuels - pas de date de début
  const isEvent = computed(() => type.value === 'soutenance' || type.value === 'cctl')

  async function submit() {
    if (!title.value.trim()) return
    creating.value = true
    try {
      const res = await travauxStore.createTravail({
        title:        title.value.trim(),
        description:  description.value.trim() || null,
        type:         type.value,
        category:     category.value.trim() || null,
        deadline:     deadline.value,
        startDate:    isEvent.value ? null : startDate.value,
        isPublished:  !isDraft.value,
        assignedTo:   assignTo.value,
        groupId:      assignTo.value === 'group' ? selectedGroupId.value : null,
        promoId:      appStore.activePromoId,
      })
      if (!res) return
      showToast('Travail créé.', 'success')
      emit('update:modelValue', false)
    } finally {
      creating.value = false
    }
  }
</script>

<template>
  <Modal :model-value="modelValue" title="Nouveau travail" max-width="620px" @update:model-value="emit('update:modelValue', $event)">
    <form style="padding:16px;display:flex;flex-direction:column;gap:12px" @submit.prevent="submit">

      <!-- Projet (champ principal) + Type -->
      <div style="display:flex;gap:10px">
        <div class="form-group" style="flex:2">
          <label class="form-label">Projet</label>
          <select v-model="category" class="form-select">
            <option value="">- Aucun projet -</option>
            <option v-for="p in allProjects" :key="p" :value="p">
              {{ parseCategoryIcon(p).label }}
            </option>
          </select>
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Type</label>
          <select v-model="type" class="form-select">
            <option value="livrable">Livrable</option>
            <option value="soutenance">Soutenance</option>
            <option value="cctl">CCTL</option>
            <option value="etude_de_cas">Étude de cas</option>
            <option value="memoire">Mémoire</option>
            <option value="autre">Autre</option>
          </select>
        </div>
      </div>

      <!-- Titre -->
      <div class="form-group">
        <label class="form-label">Titre</label>
        <input v-model="title" type="text" class="form-input" placeholder="Titre du travail" required />
      </div>

      <!-- Description -->
      <div class="form-group">
        <label class="form-label">Description <span style="opacity:.6">(optionnel)</span></label>
        <textarea v-model="description" class="form-input" rows="3" style="resize:vertical" placeholder="Instructions, objectifs…" />
      </div>

      <!-- Dates -->
      <div style="display:flex;gap:10px">
        <div v-if="!isEvent" class="form-group" style="flex:1">
          <label class="form-label">Date de début</label>
          <input v-model="startDate" type="datetime-local" class="form-input" />
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">{{ isEvent ? 'Date de l\'événement' : 'Date limite' }}</label>
          <input v-model="deadline" type="datetime-local" class="form-input" required />
        </div>
      </div>

      <!-- Assignation -->
      <div v-if="!isEvent" class="form-group">
        <label class="form-label">Assigné à</label>
        <div style="display:flex;gap:16px;padding-top:6px">
          <label class="radio-label"><input v-model="assignTo" type="radio" value="all" /> Toute la promo</label>
          <label class="radio-label"><input v-model="assignTo" type="radio" value="group" /> Par groupe</label>
        </div>
      </div>

      <!-- ── Constructeur de groupes ──────────────────────────────────── -->
      <div v-if="assignTo === 'group' && !isEvent" class="group-builder">
        <div class="form-label" style="margin-bottom:8px">
          <Users :size="13" style="vertical-align:middle;margin-right:4px" /> Groupes disponibles
        </div>

        <!-- Liste des groupes existants -->
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

        <!-- Formulaire de création de groupe -->
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
              class="btn-cta"
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
      <button class="btn-cta" :disabled="!title.trim() || creating" @click="submit">
        {{ creating ? 'Création…' : isDraft ? 'Enregistrer brouillon' : 'Publier' }}
      </button>
    </div>
  </Modal>
</template>

<style scoped>
.group-builder {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
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
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-family: var(--font);
  cursor: pointer;
  transition: all .12s;
}
.group-card:hover    { border-color: var(--accent); color: var(--text-primary); }
.group-card.selected { border-color: var(--accent); background: rgba(var(--accent-rgb),.15); color: var(--accent); }

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
  border-radius: var(--radius-sm);
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
  background: rgba(var(--accent-rgb),.15);
  border-color: rgba(var(--accent-rgb),.4);
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
