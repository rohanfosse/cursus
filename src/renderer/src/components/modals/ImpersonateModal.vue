<script setup lang="ts">
  import { ref, watch, computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { Search } from 'lucide-vue-next'
  import Modal from '@/components/ui/Modal.vue'
  import { useAppStore } from '@/stores/app'
  import { avatarColor } from '@/utils/format'
  import type { Student } from '@/types'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const appStore = useAppStore()
  const router   = useRouter()

  const students = ref<Student[]>([])
  const query    = ref('')
  const loading  = ref(false)

  watch(() => props.modelValue, async (open) => {
    if (!open) { query.value = ''; return }
    loading.value = true
    try {
      const res = await window.api.getAllStudents()
      students.value = res?.ok ? res.data : []
    } finally {
      loading.value = false
    }
  })

  const filtered = computed(() => {
    const q = query.value.toLowerCase().trim()
    if (!q) return students.value
    return students.value.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.promo_name ?? '').toLowerCase().includes(q),
    )
  })

  function simulate(student: Student) {
    appStore.startSimulation({
      id: student.id,
      name: student.name,
      avatar_initials: student.avatar_initials ?? student.name.slice(0, 2).toUpperCase(),
      photo_data: student.photo_data,
      type: 'student',
      promo_id: student.promo_id,
      promo_name: student.promo_name,
    })
    emit('update:modelValue', false)
    router.replace('/messages')
  }
</script>

<template>
  <Modal :model-value="modelValue" title="Simuler la vue d'un étudiant" @update:model-value="emit('update:modelValue', $event)">
    <div class="impersonate-body">
      <p class="impersonate-hint">
        Choisissez un étudiant pour voir l'application de son point de vue.
        Un bandeau orange indiquera que vous êtes en mode simulation.
      </p>

      <!-- Recherche -->
      <div class="impersonate-search">
        <Search :size="14" class="impersonate-search-icon" />
        <input
          v-model="query"
          type="text"
          class="form-input impersonate-search-input"
          placeholder="Rechercher un étudiant…"
          aria-label="Rechercher un étudiant"
          autofocus
        />
      </div>

      <!-- Liste -->
      <div v-if="loading" class="impersonate-loading">Chargement…</div>
      <ul v-else class="impersonate-list">
        <li v-if="!filtered.length" class="impersonate-empty">Aucun étudiant trouvé</li>
        <li
          v-for="s in filtered"
          :key="s.id"
          class="impersonate-student"
          role="button"
          tabindex="0"
          :aria-label="`Simuler la vue de ${s.name}`"
          @click="simulate(s)"
          @keydown.enter="simulate(s)"
          @keydown.space.prevent="simulate(s)"
        >
          <div
            class="impersonate-avatar"
            :style="{ background: s.photo_data ? 'transparent' : avatarColor(s.name) }"
          >
            <img v-if="s.photo_data" :src="s.photo_data" :alt="s.name" />
            <span v-else>{{ s.avatar_initials ?? s.name.slice(0, 2).toUpperCase() }}</span>
          </div>
          <div class="impersonate-info">
            <span class="impersonate-name">{{ s.name }}</span>
            <span class="impersonate-promo">{{ s.promo_name ?? s.email }}</span>
          </div>
        </li>
      </ul>
    </div>

    <div class="modal-footer" style="padding:12px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end">
      <button class="btn-ghost" @click="emit('update:modelValue', false)">Annuler</button>
    </div>
  </Modal>
</template>

<style scoped>
.impersonate-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.impersonate-hint {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.5;
}

.impersonate-search {
  position: relative;
}
.impersonate-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}
.impersonate-search-input {
  padding-left: 32px;
}

.impersonate-loading {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  padding: 20px 0;
}

.impersonate-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.impersonate-empty {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  padding: 20px 0;
}

.impersonate-student {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--t-fast);
}
.impersonate-student:hover,
.impersonate-student:focus-visible {
  background: var(--accent-subtle);
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.impersonate-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  overflow: hidden;
}
.impersonate-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.impersonate-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.impersonate-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.impersonate-promo {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
