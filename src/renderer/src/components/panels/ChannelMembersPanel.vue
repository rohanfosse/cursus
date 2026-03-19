<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  import { X, Users, Lock, Globe, UserPlus, UserMinus, Search, Check } from 'lucide-vue-next'
  import { useAppStore } from '@/stores/app'
  import { useToast }    from '@/composables/useToast'

  const emit = defineEmits<{ (e: 'close'): void }>()

  const appStore      = useAppStore()
  const { showToast } = useToast()

  interface Student { id: number; name: string; email: string; photo?: string | null }
  interface ChannelData {
    id: number; name: string; is_private: number; members: string | null
  }

  const channel      = ref<ChannelData | null>(null)
  const allStudents  = ref<Student[]>([])
  const loading      = ref(true)
  const saving       = ref(false)
  const searchQuery  = ref('')

  // IDs des membres du canal courant
  const memberIds = computed<number[]>(() => {
    if (!channel.value?.is_private) return allStudents.value.map(s => s.id)
    try { return JSON.parse(channel.value.members ?? '[]') } catch { return [] }
  })

  const memberObjects = computed(() =>
    allStudents.value.filter(s => memberIds.value.includes(s.id)),
  )

  const nonMemberObjects = computed(() => {
    const q = searchQuery.value.toLowerCase()
    return allStudents.value
      .filter(s => !memberIds.value.includes(s.id))
      .filter(s => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
  })

  async function load() {
    loading.value = true
    try {
      const [chRes, studRes] = await Promise.all([
        window.api.getChannels(appStore.activePromoId!),
        window.api.getStudents(appStore.activePromoId!),
      ])
      if (chRes?.ok) {
        channel.value = (chRes.data as unknown as ChannelData[]).find(c => c.id === appStore.activeChannelId) ?? null
      }
      if (studRes?.ok) allStudents.value = studRes.data as Student[]
    } finally {
      loading.value = false
    }
  }

  async function addMember(studentId: number) {
    if (!channel.value?.is_private) return
    const newIds = [...memberIds.value, studentId]
    saving.value = true
    try {
      await window.api.updateChannelMembers({ channelId: channel.value.id, members: newIds })
      channel.value = { ...channel.value, members: JSON.stringify(newIds) }
      showToast('Membre ajouté.', 'success')
    } finally { saving.value = false }
  }

  async function removeMember(studentId: number) {
    if (!channel.value?.is_private) return
    const newIds = memberIds.value.filter(id => id !== studentId)
    saving.value = true
    try {
      await window.api.updateChannelMembers({ channelId: channel.value.id, members: newIds })
      channel.value = { ...channel.value, members: JSON.stringify(newIds) }
      showToast('Membre retiré.', 'success')
    } finally { saving.value = false }
  }

  function initials(name: string) {
    return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
  }

  watch(() => appStore.activeChannelId, load)
  onMounted(load)
</script>

<template>
  <aside class="ch-panel">
    <!-- Header -->
    <div class="ch-panel-header">
      <Users :size="15" class="ch-panel-hicon" />
      <span class="ch-panel-title">Membres</span>
      <button class="btn-icon ch-panel-close" aria-label="Fermer le panneau membres" @click="emit('close')"><X :size="15" /></button>
    </div>

    <div v-if="loading" class="ch-panel-body ch-loading">
      <div v-for="i in 5" :key="i" class="skel ch-skel-row" />
    </div>

    <div v-else class="ch-panel-body">

      <!-- Badge public / privé -->
      <div class="ch-privacy-badge" :class="channel?.is_private ? 'badge-private' : 'badge-public'">
        <Lock v-if="channel?.is_private" :size="12" />
        <Globe v-else :size="12" />
        <span>{{ channel?.is_private ? 'Canal privé' : 'Canal public — ouvert à toute la promo' }}</span>
      </div>

      <!-- Liste des membres -->
      <div class="ch-section-label">
        {{ channel?.is_private ? memberObjects.length + ' membre' + (memberObjects.length > 1 ? 's' : '') : 'Tous les étudiants' }}
      </div>

      <ul class="ch-member-list">
        <li v-for="s in memberObjects" :key="s.id" class="ch-member-row">
          <div class="ch-avatar" :style="s.photo ? { backgroundImage: `url(${s.photo})`, backgroundSize: 'cover' } : {}">
            <span v-if="!s.photo">{{ initials(s.name) }}</span>
          </div>
          <div class="ch-member-info">
            <span class="ch-member-name">{{ s.name }}</span>
            <span class="ch-member-email">{{ s.email }}</span>
          </div>
          <button
            v-if="appStore.isTeacher && channel?.is_private"
            class="btn-icon ch-remove-btn"
            :disabled="saving"
            title="Retirer du canal"
            @click="removeMember(s.id)"
          >
            <UserMinus :size="13" />
          </button>
        </li>
      </ul>

      <!-- Ajouter un membre (prof + canal privé) -->
      <template v-if="appStore.isTeacher && channel?.is_private">
        <div class="ch-section-label ch-add-label">
          <UserPlus :size="12" /> Ajouter un membre
        </div>

        <div class="ch-search-wrap">
          <Search :size="13" class="ch-search-icon" />
          <input
            v-model="searchQuery"
            class="ch-search-input"
            type="text"
            placeholder="Rechercher un étudiant…"
            aria-label="Rechercher un membre"
          />
        </div>

        <ul v-if="nonMemberObjects.length" class="ch-member-list ch-add-list">
          <li v-for="s in nonMemberObjects" :key="s.id" class="ch-member-row ch-non-member">
            <div class="ch-avatar ch-avatar-muted">
              <span>{{ initials(s.name) }}</span>
            </div>
            <div class="ch-member-info">
              <span class="ch-member-name">{{ s.name }}</span>
              <span class="ch-member-email">{{ s.email }}</span>
            </div>
            <button
              class="btn-icon ch-add-btn"
              :disabled="saving"
              title="Ajouter au canal"
              @click="addMember(s.id)"
            >
              <UserPlus :size="13" />
            </button>
          </li>
        </ul>
        <p v-else class="ch-empty-note">
          {{ searchQuery ? 'Aucun résultat' : 'Tous les étudiants sont déjà membres.' }}
        </p>
      </template>

    </div>
  </aside>
</template>

<style scoped>
.ch-panel {
  width: 260px;
  min-width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--border);
  background: var(--bg-sidebar);
  overflow: hidden;
}

/* ── Header ── */
.ch-panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  height: var(--header-height, 52px);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.ch-panel-hicon { color: var(--accent); flex-shrink: 0; }
.ch-panel-title {
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}
.ch-panel-close { color: var(--text-muted); margin-left: auto; }
.ch-panel-close:hover { color: var(--text-primary); }

/* ── Body ── */
.ch-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 0 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ch-loading { padding: 16px; gap: 10px; }
.ch-skel-row { height: 40px; border-radius: 8px; }

/* ── Badge privacy ── */
.ch-privacy-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 4px 12px 8px;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 600;
}
.badge-private {
  background: rgba(155,135,245,.1);
  color: #9b87f5;
  border: 1px solid rgba(155,135,245,.2);
}
.badge-public {
  background: rgba(39,174,96,.08);
  color: var(--color-success);
  border: 1px solid rgba(39,174,96,.15);
}

/* ── Section label ── */
.ch-section-label {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px 4px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--text-muted);
}
.ch-add-label { margin-top: 10px; color: var(--accent); }

/* ── Member list ── */
.ch-member-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 0 6px;
}

.ch-member-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background .1s;
}
.ch-member-row:hover { background: rgba(255,255,255,.05); }

.ch-avatar {
  width: 30px;
  height: 30px;
  min-width: 30px;
  border-radius: 8px;
  background: var(--accent-subtle);
  color: var(--accent-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background-size: cover;
  background-position: center;
  overflow: hidden;
}
.ch-avatar-muted {
  background: rgba(255,255,255,.06);
  color: var(--text-muted);
}

.ch-member-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.ch-member-name  { font-size: 12.5px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-member-email { font-size: 10.5px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.ch-remove-btn { color: var(--text-muted); padding: 3px; opacity: 0; transition: opacity .1s, color .1s; }
.ch-member-row:hover .ch-remove-btn { opacity: 1; }
.ch-remove-btn:hover { color: var(--color-danger) !important; }

.ch-add-btn { color: var(--text-muted); padding: 3px; opacity: 0; transition: opacity .1s, color .1s; }
.ch-member-row:hover .ch-add-btn { opacity: 1; }
.ch-add-btn:hover { color: var(--color-success) !important; }

/* ── Recherche ── */
.ch-search-wrap {
  position: relative;
  margin: 4px 12px 6px;
}
.ch-search-icon {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}
.ch-search-input {
  width: 100%;
  padding: 6px 8px 6px 28px;
  background: rgba(255,255,255,.05);
  border: 1px solid var(--border-input);
  border-radius: 6px;
  color: var(--text-primary);
  font-family: var(--font);
  font-size: 12px;
  outline: none;
  transition: border-color .15s;
}
.ch-search-input:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }
.ch-search-input:focus { border-color: var(--accent); }
.ch-search-input::placeholder { color: var(--text-muted); }

.ch-non-member .ch-member-name { color: var(--text-secondary); }
.ch-empty-note {
  font-size: 11.5px;
  color: var(--text-muted);
  text-align: center;
  padding: 12px 16px;
}
</style>
