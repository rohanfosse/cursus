<script setup lang="ts">
  import { ref, watch, computed } from 'vue'
  import { MessageSquare, Megaphone, Globe, Lock } from 'lucide-vue-next'
  import { useAppStore } from '@/stores/app'
  import { useToast }    from '@/composables/useToast'
  import { useApi }      from '@/composables/useApi'
  import { CATEGORY_ICONS, parseCategoryIcon } from '@/utils/categoryIcon'
  import Modal from '@/components/ui/Modal.vue'
  import type { Student } from '@/types'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const appStore = useAppStore()
  const { showToast } = useToast()
  const { api }       = useApi()

  const channelName         = ref('')
  const channelType         = ref<'chat' | 'annonce'>('chat')
  const visibility          = ref<'public' | 'private'>('public')
  const members             = ref<number[]>([])
  const students            = ref<Student[]>([])
  const creating            = ref(false)

  // Catégorie
  const existingCategories  = ref<string[]>([])
  const selectedCategory    = ref<string>('')
  const newCategoryIconKey  = ref('')
  const newCategoryText     = ref('')
  const isCreatingNew       = computed(() => selectedCategory.value === '__new__')

  watch(() => props.modelValue, async (open) => {
    if (!open) return
    if (!appStore.activePromoId) {
      await new Promise(r => setTimeout(r, 200))
      if (!appStore.activePromoId) return
    }

    channelName.value        = ''
    channelType.value        = 'chat'
    visibility.value         = 'public'
    members.value            = []
    newCategoryIconKey.value = ''
    newCategoryText.value    = ''
    selectedCategory.value   = ''
    existingCategories.value = []
    students.value           = []

    try {
      const [stuList, chList] = await Promise.all([
        api<Student[]>(() => window.api.getStudents(appStore.activePromoId!)),
        api<{ category?: string | null }[]>(() => window.api.getChannels(appStore.activePromoId!)),
      ])
      students.value = stuList ?? []

      const cats = [...new Set((chList ?? []).map(c => c.category).filter((c): c is string => !!c))]
      existingCategories.value = cats

      const pending = appStore.pendingChannelCategory
      if (pending) {
        appStore.pendingChannelCategory = null
        selectedCategory.value = cats.includes(pending) ? pending : '__new__'
        if (selectedCategory.value === '__new__') {
          const { label }          = parseCategoryIcon(pending)
          newCategoryIconKey.value = pending.includes(' ') ? pending.split(' ')[0] : ''
          newCategoryText.value    = label || pending
        }
      } else {
        selectedCategory.value = cats.length ? '' : '__new__'
      }
    } catch {
      // Errors are handled by useApi toasts
    }
  })

  async function create() {
    if (!channelName.value.trim()) return
    if (!appStore.activePromoId) {
      showToast('Aucune promotion sélectionnée.', 'error')
      return
    }

    let category: string | null = null
    if (selectedCategory.value && selectedCategory.value !== '__new__') {
      category = selectedCategory.value
    } else if (isCreatingNew.value) {
      const t = newCategoryText.value.trim()
      if (t) category = newCategoryIconKey.value ? `${newCategoryIconKey.value} ${t}` : t
    }

    creating.value = true
    try {
      const result = await api(
        () => window.api.createChannel({
          name:      channelName.value.trim(),
          promoId:   appStore.activePromoId,
          type:      channelType.value,
          isPrivate: visibility.value === 'private',
          members:   visibility.value === 'private' ? [...members.value] : [],
          category,
        }),
        'channel',
      )
      if (result !== null) {
        showToast('Canal créé.', 'success')
        emit('update:modelValue', false)
      }
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
    <div class="cc-form">

      <!-- Nom -->
      <div class="cc-field">
        <label class="cc-label">Nom du canal</label>
        <div class="cc-input-wrap">
          <span class="cc-input-prefix">#</span>
          <input
            id="new-channel-name"
            v-model="channelName"
            type="text"
            class="cc-input"
            placeholder="ex : général, tp-réseaux…"
            autofocus
          />
        </div>
      </div>

      <!-- Type - pills -->
      <div class="cc-field">
        <label class="cc-label">Type</label>
        <div class="cc-pills">
          <button
            class="cc-pill cc-pill-card"
            :class="{ active: channelType === 'chat' }"
            type="button"
            @click="channelType = 'chat'"
          >
            <MessageSquare :size="16" />
            <span class="cc-pill-title">Chat</span>
            <span class="cc-pill-desc">Discussions libres entre membres</span>
          </button>
          <button
            class="cc-pill cc-pill-card"
            :class="{ active: channelType === 'annonce' }"
            type="button"
            @click="channelType = 'annonce'"
          >
            <Megaphone :size="16" />
            <span class="cc-pill-title">Annonces</span>
            <span class="cc-pill-desc">Lecture seule, seul le pilote publie</span>
          </button>
        </div>
      </div>

      <!-- Visibilité - pills -->
      <div class="cc-field">
        <label class="cc-label">Visibilité</label>
        <div class="cc-pills">
          <button
            class="cc-pill"
            :class="{ active: visibility === 'public' }"
            type="button"
            @click="visibility = 'public'"
          >
            <Globe :size="13" />
            Public
            <span class="cc-pill-hint">toute la promo</span>
          </button>
          <button
            class="cc-pill cc-pill-private"
            :class="{ active: visibility === 'private' }"
            type="button"
            @click="visibility = 'private'"
          >
            <Lock :size="13" />
            Privé
            <span class="cc-pill-hint">membres choisis</span>
          </button>
        </div>
      </div>

      <!-- Membres (canal privé) -->
      <Transition name="cc-expand">
        <div v-if="visibility === 'private'" class="cc-field cc-members-field">
          <label class="cc-label">
            Membres autorisés
            <span class="cc-members-count">{{ members.length }} sélectionné{{ members.length > 1 ? 's' : '' }}</span>
          </label>
          <div class="cc-members-list">
            <label
              v-for="s in students"
              :key="s.id"
              class="cc-member-row"
              :class="{ checked: members.includes(s.id) }"
            >
              <input
                type="checkbox"
                :checked="members.includes(s.id)"
                class="cc-checkbox"
                @change="toggleMember(s.id)"
              />
              <div class="cc-member-avatar">{{ s.name.slice(0, 2).toUpperCase() }}</div>
              <span class="cc-member-name">{{ s.name }}</span>
            </label>
          </div>
        </div>
      </Transition>

      <!-- Catégorie -->
      <div class="cc-field">
        <label class="cc-label">Catégorie <span class="cc-label-opt">(optionnelle)</span></label>
        <select v-model="selectedCategory" class="cc-select">
          <option value="">- Aucune catégorie -</option>
          <optgroup v-if="existingCategories.length" label="Catégories existantes">
            <option v-for="cat in existingCategories" :key="cat" :value="cat">
              {{ parseCategoryIcon(cat).label }}
            </option>
          </optgroup>
          <option value="__new__">+ Créer une nouvelle catégorie…</option>
        </select>

        <!-- Nouvelle catégorie -->
        <Transition name="cc-expand">
          <div v-if="isCreatingNew" class="cc-new-cat">
            <div class="cc-icon-grid">
              <button
                v-for="ic in CATEGORY_ICONS"
                :key="ic.key"
                class="cc-icon-btn"
                :class="{ selected: newCategoryIconKey === ic.key }"
                type="button"
                :title="ic.label"
                @click="newCategoryIconKey = newCategoryIconKey === ic.key ? '' : ic.key"
              >
                <component :is="ic.component" :size="14" />
              </button>
            </div>
            <div class="cc-icon-input-row">
              <component
                v-if="newCategoryIconKey"
                :is="CATEGORY_ICONS.find(i => i.key === newCategoryIconKey)!.component"
                :size="15"
                class="cc-icon-preview"
              />
              <input
                v-model="newCategoryText"
                type="text"
                class="cc-input"
                placeholder="Nom de la catégorie…"
              />
            </div>
          </div>
        </Transition>
      </div>

    </div>

    <div class="cc-footer">
      <button class="btn-ghost" @click="emit('update:modelValue', false)">Annuler</button>
      <button class="btn-primary" :disabled="!channelName.trim() || creating" @click="create">
        {{ creating ? 'Création…' : 'Créer le canal' }}
      </button>
    </div>
  </Modal>
</template>

<style scoped>
/* ── Formulaire ── */
.cc-form {
  padding: 20px 20px 8px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cc-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.cc-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}
.cc-label-opt { font-weight: 400; text-transform: none; letter-spacing: 0; opacity: .7; font-size: 10.5px; }

/* Input avec préfixe # */
.cc-input-wrap {
  display: flex;
  align-items: center;
  background: var(--bg-input);
  border: 1.5px solid var(--border-input);
  border-radius: var(--radius-sm);
  transition: border-color .15s;
}
.cc-input-wrap:focus-within { border-color: var(--accent); }
.cc-input-prefix {
  padding: 0 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-muted);
  flex-shrink: 0;
}
.cc-input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-family: var(--font);
  font-size: 13.5px;
  padding: 9px 12px;
}
.cc-input:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }
/* input seul (hors wrap) */
.cc-field > .cc-input,
.cc-icon-input-row .cc-input {
  background: var(--bg-input);
  border: 1.5px solid var(--border-input);
  border-radius: var(--radius-sm);
  transition: border-color .15s;
  padding: 8px 12px;
}
.cc-field > .cc-input:focus,
.cc-icon-input-row .cc-input:focus { border-color: var(--accent); }

/* ── Pills Type / Visibilité ── */
.cc-pills {
  display: flex;
  gap: 8px;
}

.cc-pill {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 12px;
  border: 1.5px solid var(--border-input);
  border-radius: var(--radius);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-family: var(--font);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background .12s, border-color .12s, color .12s;
  flex-direction: column;
  gap: 3px;
}
.cc-pill > svg { flex-shrink: 0; }
.cc-pill:hover {
  background: var(--bg-hover);
  border-color: var(--border);
  color: var(--text-primary);
}
.cc-pill.active {
  border-color: var(--accent);
  background: var(--accent-subtle);
  color: var(--accent-light);
}
.cc-pill-private.active {
  border-color: var(--color-cctl);
  background: rgba(155,135,245,.12);
  color: #b8a8f7;
}
.cc-pill-hint {
  font-size: 10px;
  opacity: .65;
  font-weight: 400;
}

/* ── Membres ── */
.cc-members-count {
  font-size: 10px;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  color: var(--color-cctl);
}
.cc-members-field { overflow: hidden; }
.cc-members-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 160px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 4px;
}
.cc-member-row {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 6px 8px;
  border-radius: 5px;
  cursor: pointer;
  transition: background .1s;
}
.cc-member-row:hover { background: var(--bg-hover); }
.cc-member-row.checked { background: rgba(155,135,245,.08); }

.cc-checkbox { display: none; }
.cc-member-avatar {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--bg-active);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background .1s, color .1s;
}
.cc-member-row.checked .cc-member-avatar {
  background: rgba(155,135,245,.25);
  color: #b8a8f7;
}
.cc-member-name {
  font-size: 13px;
  color: var(--text-secondary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cc-member-row.checked .cc-member-name { color: var(--text-primary); font-weight: 500; }

/* ── Select catégorie ── */
.cc-select {
  width: 100%;
  padding: 9px 12px;
  background: var(--bg-input);
  border: 1.5px solid var(--border-input);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font);
  font-size: 13px;
  cursor: pointer;
  outline: none;
  transition: border-color .15s;
  appearance: auto;
}
.cc-select:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }
.cc-select:focus { border-color: var(--accent); }
.cc-select option, .cc-select optgroup {
  background: var(--bg-modal, #1e2127);
  color: var(--text-primary);
}

/* ── Nouvelle catégorie ── */
.cc-new-cat {
  margin-top: 8px;
  padding: 12px;
  background: rgba(74,144,217,.05);
  border: 1px solid rgba(74,144,217,.15);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cc-icon-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.cc-icon-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid transparent;
  border-radius: 5px;
  background: var(--bg-elevated);
  color: var(--text-muted);
  cursor: pointer;
  transition: all .1s;
}
.cc-icon-btn:hover    { background: var(--bg-hover); border-color: var(--border-input); color: var(--text-primary); }
.cc-icon-btn.selected { border-color: var(--accent); background: rgba(74,144,217,.15); color: var(--accent); }

.cc-icon-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cc-icon-preview { flex-shrink: 0; color: var(--accent); }

/* ── Card pill enhancements ── */
.cc-pill-card { padding: 12px; gap: 4px; }
.cc-pill-title { font-size: 13px; font-weight: 600; }
.cc-pill-desc { font-size: 10px; opacity: .6; font-weight: 400; }

/* ── Sidebar preview ── */
.cc-preview {
  margin: 0 20px; padding: 10px 14px;
  background: var(--bg-elevated); border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
}
.cc-preview-label {
  font-size: 9.5px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .5px; color: var(--text-muted); margin-bottom: 6px; display: block;
}
.cc-preview-item {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px; border-radius: 5px; background: var(--bg-elevated);
}
.cc-preview-prefix { font-size: 12px; color: var(--text-muted); flex-shrink: 0; }
.cc-preview-name { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.cc-preview-lock { color: var(--text-muted); margin-left: auto; }

/* ── Footer ── */
.cc-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* ── Transition expand ── */
.cc-expand-enter-active { transition: max-height .2s ease, opacity .15s ease; max-height: 300px; overflow: hidden; }
.cc-expand-leave-active { transition: max-height .15s ease, opacity .12s ease; overflow: hidden; }
.cc-expand-enter-from, .cc-expand-leave-to { max-height: 0 !important; opacity: 0; }
</style>
