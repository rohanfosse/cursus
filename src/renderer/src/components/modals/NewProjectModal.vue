<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useAppStore }    from '@/stores/app'
  import { useTravauxStore } from '@/stores/travaux'
  import { useToast }       from '@/composables/useToast'
  import { isoForDatetimeLocal } from '@/utils/date'
  import Modal from '@/components/ui/Modal.vue'

  const CUSTOM_PROJECTS_KEY = 'cc_custom_projects'
  const PROJECTS_META_KEY   = (promoId: number) => `cc_projects_${promoId}`

  const EMOJIS = ['💻','⚙️','🗄️','📡','🔌','📊','🌐','🎓','📐','🔧','📝','📚','🧮','🏆','🎯','🖥️','🔬','💬','🧪','🌍']

  export interface ProjectMeta {
    emoji: string
    name: string
    description: string
    startDate: string
    endDate: string
  }

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{
    'update:modelValue': [v: boolean]
    created: [name: string]
  }>()

  const appStore     = useAppStore()
  const travauxStore = useTravauxStore()
  const { showToast } = useToast()

  const selectedEmoji = ref('💻')
  const name          = ref('')
  const description   = ref('')
  const startDate     = ref(isoForDatetimeLocal())
  const endDate       = ref(isoForDatetimeLocal())
  const saving        = ref(false)

  watch(() => props.modelValue, (open) => {
    if (open) {
      selectedEmoji.value = '💻'
      name.value          = ''
      description.value   = ''
      startDate.value     = isoForDatetimeLocal()
      endDate.value       = isoForDatetimeLocal()
    }
  })

  function fullName() {
    return `${selectedEmoji.value} ${name.value.trim()}`
  }

  function save() {
    const n = name.value.trim()
    if (!n) return
    saving.value = true
    try {
      const full = fullName()

      // 1. Enregistrer dans cc_custom_projects (liste des noms)
      const raw = (() => { try { return JSON.parse(localStorage.getItem(CUSTOM_PROJECTS_KEY) ?? '[]') as string[] } catch { return [] } })()
      if (!raw.includes(full)) {
        raw.push(full)
        localStorage.setItem(CUSTOM_PROJECTS_KEY, JSON.stringify(raw))
      }

      // 2. Enregistrer les métadonnées par promo
      const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
      if (promoId) {
        const key  = PROJECTS_META_KEY(promoId)
        const metas: ProjectMeta[] = (() => { try { return JSON.parse(localStorage.getItem(key) ?? '[]') } catch { return [] } })()
        if (!metas.find(m => m.name === full)) {
          metas.push({ emoji: selectedEmoji.value, name: full, description: description.value.trim(), startDate: startDate.value, endDate: endDate.value })
          localStorage.setItem(key, JSON.stringify(metas))
        }
      }

      showToast(`Projet « ${full} » créé.`, 'success')
      emit('created', full)
      emit('update:modelValue', false)
    } finally {
      saving.value = false
    }
  }
</script>

<template>
  <Modal :model-value="modelValue" title="Nouveau projet" max-width="480px" @update:model-value="emit('update:modelValue', $event)">
    <div style="padding:16px;display:flex;flex-direction:column;gap:14px">

      <!-- Emoji picker -->
      <div class="form-group">
        <label class="form-label">Icône</label>
        <div class="emoji-grid">
          <button
            v-for="e in EMOJIS"
            :key="e"
            class="emoji-btn"
            :class="{ selected: selectedEmoji === e }"
            type="button"
            :title="e"
            @click="selectedEmoji = e"
          >{{ e }}</button>
        </div>
      </div>

      <!-- Nom -->
      <div class="form-group">
        <label class="form-label">Nom du projet</label>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="emoji-preview">{{ selectedEmoji }}</span>
          <input
            v-model="name"
            type="text"
            class="form-input"
            placeholder="ex : Développement Web, Algorithmique…"
            style="flex:1"
            autofocus
            required
          />
        </div>
      </div>

      <!-- Description -->
      <div class="form-group">
        <label class="form-label">Description <span style="opacity:.55;font-weight:400">(optionnelle)</span></label>
        <textarea
          v-model="description"
          class="form-input"
          rows="3"
          style="resize:vertical"
          placeholder="Objectifs, compétences visées, informations utiles…"
        />
      </div>

      <!-- Dates -->
      <div style="display:flex;gap:10px">
        <div class="form-group" style="flex:1">
          <label class="form-label">Début</label>
          <input v-model="startDate" type="datetime-local" class="form-input" />
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Fin</label>
          <input v-model="endDate" type="datetime-local" class="form-input" />
        </div>
      </div>

    </div>

    <div class="modal-footer" style="padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;flex-shrink:0">
      <button class="btn-ghost" @click="emit('update:modelValue', false)">Annuler</button>
      <button class="btn-primary" :disabled="!name.trim() || saving" @click="save">
        {{ saving ? 'Enregistrement…' : 'Créer le projet' }}
      </button>
    </div>
  </Modal>
</template>

<style scoped>
.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.emoji-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  border: 1.5px solid transparent;
  border-radius: 6px;
  background: rgba(255,255,255,.04);
  cursor: pointer;
  transition: all .1s;
  line-height: 1;
}
.emoji-btn:hover    { background: var(--bg-hover); border-color: var(--border-input); }
.emoji-btn.selected { border-color: var(--accent); background: rgba(74,144,217,.15); }

.emoji-preview {
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
}
</style>
