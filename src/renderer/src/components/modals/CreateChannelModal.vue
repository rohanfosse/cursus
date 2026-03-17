<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { useAppStore } from '@/stores/app'
  import { useToast }    from '@/composables/useToast'
  import Modal from '@/components/ui/Modal.vue'
  import type { Student } from '@/types'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const appStore = useAppStore()
  const { showToast } = useToast()

  const CATEGORY_EMOJIS = ['💬','💻','⚙️','🗄️','📡','🔌','📊','🌐','🎓','📐','🔧','📝','📚','🧮','🏆','🎯','🖥️','🔬']

  const channelName     = ref('')
  const channelType     = ref<'chat' | 'annonce'>('chat')
  const categoryEmoji   = ref('')
  const categoryText    = ref('')
  const visibility      = ref<'public' | 'private'>('public')
  const members         = ref<number[]>([])
  const students        = ref<Student[]>([])
  const creating        = ref(false)

  watch(() => props.modelValue, async (open) => {
    if (open && appStore.activePromoId) {
      const res = await window.api.getStudents(appStore.activePromoId)
      students.value = res?.ok ? res.data : []
      channelName.value   = ''
      channelType.value   = 'chat'
      categoryEmoji.value = ''
      categoryText.value  = ''
      visibility.value    = 'public'
      members.value       = []
    }
  })

  async function create() {
    if (!channelName.value.trim() || !appStore.activePromoId) return
    creating.value = true
    try {
      const res = await window.api.createChannel({
        name: channelName.value.trim(),
        promoId: appStore.activePromoId,
        type: channelType.value,
        isPrivate: visibility.value === 'private',
        members: visibility.value === 'private' ? members.value : [],
        category: (() => {
          const t = categoryText.value.trim()
          if (!t) return null
          return categoryEmoji.value ? `${categoryEmoji.value} ${t}` : t
        })(),
      })
      if (!res?.ok) { showToast(res?.error ?? 'Erreur lors de la création.'); return }
      showToast('Canal créé.', 'success')
      emit('update:modelValue', false)
    } finally {
      creating.value = false
    }
  }

  function toggleMember(id: number) {
    const idx = members.value.indexOf(id)
    if (idx === -1) members.value.push(id)
    else members.value.splice(idx, 1)
  }
</script>

<template>
  <Modal :model-value="modelValue" title="Créer un canal" @update:model-value="emit('update:modelValue', $event)">
    <div style="padding:16px;display:flex;flex-direction:column;gap:14px">
      <div class="form-group">
        <label class="form-label">Nom du canal</label>
        <input
          id="new-channel-name"
          v-model="channelName"
          type="text"
          class="form-input"
          placeholder="ex : général, tp-réseaux…"
          autofocus
        />
      </div>

      <div class="form-group">
        <label class="form-label">Catégorie <span style="opacity:.55;font-weight:400">(optionnelle)</span></label>
        <!-- Emoji picker -->
        <div class="cc-emoji-grid" style="margin-bottom:6px">
          <button
            v-for="e in CATEGORY_EMOJIS"
            :key="e"
            class="cc-emoji-btn"
            :class="{ selected: categoryEmoji === e }"
            type="button"
            :title="e"
            @click="categoryEmoji = categoryEmoji === e ? '' : e"
          >{{ e }}</button>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span v-if="categoryEmoji" class="cc-emoji-preview">{{ categoryEmoji }}</span>
          <input
            v-model="categoryText"
            type="text"
            class="form-input"
            style="flex:1"
            placeholder="ex : Cours, Projets, Ressources…"
          />
        </div>
        <span style="font-size:11px;color:var(--text-muted);margin-top:3px;display:block">
          Les canaux d'une même catégorie sont regroupés dans la barre latérale.
        </span>
      </div>

      <div class="form-group">
        <label class="form-label">Type</label>
        <div style="display:flex;gap:16px">
          <label class="radio-label">
            <input v-model="channelType" type="radio" value="chat" />
            Chat
          </label>
          <label class="radio-label">
            <input v-model="channelType" type="radio" value="annonce" />
            Annonces (lecture seule pour les étudiants)
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Visibilité</label>
        <div style="display:flex;gap:16px">
          <label class="radio-label">
            <input v-model="visibility" type="radio" value="public" />
            Public
          </label>
          <label class="radio-label">
            <input v-model="visibility" type="radio" value="private" />
            Privé (membres restreints)
          </label>
        </div>
      </div>

      <div v-if="visibility === 'private'" class="form-group">
        <label class="form-label">Membres autorisés</label>
        <div id="channel-members-checkboxes" style="max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:4px">
          <label
            v-for="s in students"
            :key="s.id"
            class="checkbox-label"
            style="display:flex;align-items:center;gap:8px;padding:4px"
          >
            <input
              type="checkbox"
              :checked="members.includes(s.id)"
              @change="toggleMember(s.id)"
            />
            <span>{{ s.name }}</span>
          </label>
        </div>
      </div>
    </div>

    <div class="modal-footer" style="padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
      <button class="btn-ghost" @click="emit('update:modelValue', false)">Annuler</button>
      <button class="btn-primary" :disabled="!channelName.trim() || creating" @click="create">
        {{ creating ? 'Création…' : 'Créer' }}
      </button>
    </div>
  </Modal>
</template>

<style scoped>
.cc-emoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.cc-emoji-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  border: 1.5px solid transparent;
  border-radius: 5px;
  background: rgba(255,255,255,.04);
  cursor: pointer;
  transition: all .1s;
  line-height: 1;
}
.cc-emoji-btn:hover    { background: var(--bg-hover); border-color: var(--border-input); }
.cc-emoji-btn.selected { border-color: var(--accent); background: rgba(74,144,217,.15); }

.cc-emoji-preview {
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
}
</style>
