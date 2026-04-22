<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { KeyRound, UserX, Mail, Calendar, MessageSquare, FileText, Copy, Shield, Plus, X } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import Avatar from '@/components/ui/Avatar.vue'
import UiRoleBadge from '@/components/ui/UiRoleBadge.vue'
import { useApi } from '@/composables/useApi'
import { useAppStore } from '@/stores/app'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import type { Promotion } from '@/types'
import type { Role } from '@/utils/permissions'
import { avatarColor } from '@/utils/format'
import { relativeTime } from '@/utils/date'

interface Props {
  userId: number
  promos: Promotion[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  updated: []
}>()

const { api } = useApi()
const { confirm } = useConfirm()
const { showToast } = useToast()
const appStore = useAppStore()

type TeacherRole = 'teacher' | 'ta' | 'admin'
const TEACHER_ROLE_OPTIONS: Array<{ value: TeacherRole; hint: string }> = [
  { value: 'admin',   hint: 'Acces complet : securite, maintenance, stats globales.' },
  { value: 'teacher', hint: 'Admin de ses promos : stats, moderation, devoirs.' },
  { value: 'ta',      hint: 'Correction des projets assignes uniquement.' },
]

interface UserDetail {
  id: number
  name: string
  email: string
  type: Role
  avatar_initials: string
  photo_data: string | null
  promo_id: number | null
  promo_name: string | null
  messageCount: number
  lastMessageAt: string | null
  depotCount: number
}

const detail = ref<UserDetail | null>(null)
const loading = ref(false)
const saving = ref(false)
const tempPassword = ref<string | null>(null)

const form = ref({ name: '', email: '', promo_id: null as number | null })
// Convention backend : les teachers / TAs ont un id negatif pour les distinguer
// des students (qui ont un id positif). Voir server/db/models/admin.js.
const isTeacherLike = computed(() => (props.userId < 0) || detail.value?.type === 'teacher' || detail.value?.type === 'ta' || detail.value?.type === 'admin')

// Role & promos (modifiables uniquement pour les teachers/tas/admins par l'admin systeme)
const assignedPromos = ref<Array<{ id: number; name: string; color: string }>>([])
const promoToAdd = ref<number | null>(null)
const savingRole = ref(false)
const savingPromo = ref(false)
const isSelf = computed(() => detail.value?.id === appStore.currentUser?.id)
const canEditRole = computed(() => appStore.isAdmin && isTeacherLike.value && !isSelf.value)
const availablePromos = computed(() => {
  const assigned = new Set(assignedPromos.value.map(p => p.id))
  return props.promos.filter(p => !assigned.has(p.id))
})

async function loadDetail() {
  loading.value = true
  tempPassword.value = null
  const data = await api(() => window.api.adminGetUserDetail(props.userId))
  if (data) {
    detail.value = data
    form.value = { name: data.name, email: data.email, promo_id: data.promo_id }
  }
  loading.value = false
  if (isTeacherLike.value) await loadAssignedPromos()
  else assignedPromos.value = []
}

async function loadAssignedPromos() {
  const data = await api(() => window.api.adminGetTeacherPromos(props.userId))
  assignedPromos.value = data ?? []
}

watch(() => props.userId, loadDetail)
onMounted(loadDetail)

async function changeRole(role: TeacherRole) {
  if (!detail.value || detail.value.type === role) return
  if (!canEditRole.value) return
  const target = TEACHER_ROLE_OPTIONS.find(o => o.value === role)
  const roleLabel = role === 'admin' ? 'Admin' : role === 'teacher' ? 'Enseignant' : 'Intervenant'
  const ok = await confirm({
    message: `Changer le rôle de ${detail.value.name} en "${roleLabel}" ? ${target?.hint ?? ''}`,
    variant: 'warning',
    confirmLabel: 'Changer le rôle',
  })
  if (!ok) return
  savingRole.value = true
  const res = await window.api.adminSetTeacherRole(props.userId, role)
  savingRole.value = false
  if (res?.ok) {
    showToast(`Rôle mis à jour : ${roleLabel}.`, 'success')
    emit('updated')
    await loadDetail()
  } else {
    showToast(res?.error ?? 'Impossible de changer le rôle.', 'error')
  }
}

async function addPromo() {
  if (!promoToAdd.value) return
  savingPromo.value = true
  const res = await window.api.adminAssignPromo(props.userId, promoToAdd.value)
  savingPromo.value = false
  if (res?.ok) {
    showToast('Promo ajoutée.', 'success')
    promoToAdd.value = null
    await loadAssignedPromos()
  } else {
    showToast(res?.error ?? 'Erreur lors de l\'ajout de la promo.', 'error')
  }
}

async function removePromo(promoId: number, promoName: string) {
  const ok = await confirm({
    message: `Retirer l'accès de ${detail.value?.name} à la promo "${promoName}" ?`,
    variant: 'warning',
    confirmLabel: 'Retirer',
  })
  if (!ok) return
  savingPromo.value = true
  const res = await window.api.adminUnassignPromo(props.userId, promoId)
  savingPromo.value = false
  if (res?.ok) {
    showToast('Promo retirée.', 'success')
    await loadAssignedPromos()
  } else {
    showToast(res?.error ?? 'Erreur lors du retrait de la promo.', 'error')
  }
}

const dirty = computed(() => {
  if (!detail.value) return false
  return form.value.name !== detail.value.name
    || form.value.email !== detail.value.email
    || form.value.promo_id !== detail.value.promo_id
})

async function saveUser() {
  if (!dirty.value || !detail.value) return
  saving.value = true
  const payload: Parameters<typeof window.api.adminUpdateUser>[1] = {}
  if (form.value.name !== detail.value.name) payload.name = form.value.name.trim()
  if (form.value.email !== detail.value.email) payload.email = form.value.email.trim()
  if (!isTeacherLike.value && form.value.promo_id !== detail.value.promo_id) payload.promo_id = form.value.promo_id

  const res = await window.api.adminUpdateUser(props.userId, payload)
  saving.value = false
  if (res?.ok) {
    showToast('Utilisateur mis a jour.', 'success')
    emit('updated')
    await loadDetail()
  } else {
    showToast(res?.error ?? 'Erreur lors de la mise a jour.', 'error')
  }
}

async function resetPassword() {
  const ok = await confirm({
    message: `Reinitialiser le mot de passe de ${detail.value?.name} ? Un mot de passe temporaire sera affiche.`,
    variant: 'warning',
    confirmLabel: 'Reinitialiser',
  })
  if (!ok) return

  const res = await window.api.adminResetPassword(props.userId)
  if (res?.ok && res.data?.tempPassword) {
    tempPassword.value = res.data.tempPassword
    showToast('Mot de passe reinitialise. Transmets-le a l\'utilisateur.', 'success')
  } else {
    showToast(res?.error ?? 'Erreur lors de la reinitialisation.', 'error')
  }
}

async function deleteUser() {
  if (!detail.value || detail.value.type === 'teacher') {
    showToast('Impossible de supprimer un Responsable Pedagogique.', 'error')
    return
  }
  const ok = await confirm({
    message: `Supprimer definitivement ${detail.value?.name} ? Les donnees associees (messages, depots) seront retirees.`,
    variant: 'danger',
    confirmLabel: 'Supprimer',
  })
  if (!ok) return

  const res = await window.api.adminDeleteUser(props.userId)
  if (res?.ok) {
    showToast('Utilisateur supprime.', 'success')
    emit('updated')
    emit('close')
  } else {
    showToast(res?.error ?? 'Erreur lors de la suppression.', 'error')
  }
}

async function copyTempPassword() {
  if (!tempPassword.value) return
  try {
    await navigator.clipboard.writeText(tempPassword.value)
    showToast('Mot de passe copie.', 'info')
  } catch {
    showToast('Copie impossible — selectionne le texte manuellement.', 'error')
  }
}

</script>

<template>
  <Modal :model-value="true" :title="detail?.name ?? 'Utilisateur'" max-width="560px" @update:model-value="emit('close')">
    <div v-if="loading" class="adm-det-loading">Chargement...</div>

    <div v-else-if="detail" class="adm-det">
      <div class="adm-det-head">
        <Avatar
          :initials="detail.avatar_initials"
          :photo-data="detail.photo_data"
          :color="avatarColor(detail.name)"
          :size="56"
        />
        <div class="adm-det-head-info">
          <div class="adm-det-name">{{ detail.name }}</div>
          <div class="adm-det-type">
            <UiRoleBadge v-if="detail.type !== 'student'" :role="detail.type" size="xs" />
            <span v-else>Etudiant</span>
            <span v-if="detail.promo_name"> · {{ detail.promo_name }}</span>
          </div>
        </div>
      </div>

      <div class="adm-det-stats">
        <div class="adm-det-stat">
          <MessageSquare :size="14" />
          <span class="adm-det-stat-val">{{ detail.messageCount }}</span>
          <span class="adm-det-stat-lbl">messages</span>
        </div>
        <div class="adm-det-stat">
          <FileText :size="14" />
          <span class="adm-det-stat-val">{{ detail.depotCount }}</span>
          <span class="adm-det-stat-lbl">depots</span>
        </div>
        <div class="adm-det-stat">
          <Calendar :size="14" />
          <span class="adm-det-stat-val">
            {{ detail.lastMessageAt ? relativeTime(detail.lastMessageAt) : 'jamais' }}
          </span>
          <span class="adm-det-stat-lbl">dernier message</span>
        </div>
      </div>

      <div v-if="tempPassword" class="adm-det-temp-pwd" role="status">
        <div class="adm-det-temp-label">Mot de passe temporaire</div>
        <div class="adm-det-temp-value">
          <code>{{ tempPassword }}</code>
          <button class="adm-det-copy" @click="copyTempPassword"><Copy :size="13" /></button>
        </div>
        <div class="adm-det-temp-hint">L'utilisateur devra le changer a sa prochaine connexion.</div>
      </div>

      <div class="adm-det-form">
        <label class="adm-det-field">
          <span>Nom</span>
          <input v-model="form.name" type="text" />
        </label>
        <label class="adm-det-field">
          <span><Mail :size="12" /> Email</span>
          <input v-model="form.email" type="email" />
        </label>
        <label v-if="!isTeacherLike" class="adm-det-field">
          <span>Promo</span>
          <select v-model="form.promo_id">
            <option v-for="p in promos" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
      </div>

      <section v-if="isTeacherLike" class="adm-det-section">
        <div class="adm-det-section-head">
          <Shield :size="14" />
          <h3>Rôle</h3>
          <span v-if="!canEditRole" class="adm-det-section-lock">
            {{ isSelf ? 'Impossible de modifier son propre rôle' : 'Admin système uniquement' }}
          </span>
        </div>
        <div class="adm-det-roles">
          <button
            v-for="opt in TEACHER_ROLE_OPTIONS"
            :key="opt.value"
            class="adm-det-role-card"
            :class="{
              'adm-det-role-card--active': detail.type === opt.value,
              'adm-det-role-card--disabled': !canEditRole,
            }"
            :disabled="!canEditRole || savingRole || detail.type === opt.value"
            :aria-pressed="detail.type === opt.value"
            @click="changeRole(opt.value)"
          >
            <UiRoleBadge :role="opt.value" size="xs" />
            <span class="adm-det-role-hint">{{ opt.hint }}</span>
          </button>
        </div>
      </section>

      <section v-if="isTeacherLike" class="adm-det-section">
        <div class="adm-det-section-head">
          <span class="adm-det-promo-icon">#</span>
          <h3>Promos assignées</h3>
          <span class="adm-det-section-count">{{ assignedPromos.length }}</span>
        </div>

        <ul v-if="assignedPromos.length" class="adm-det-promo-list">
          <li v-for="p in assignedPromos" :key="p.id" class="adm-det-promo-chip" :style="{ borderColor: p.color }">
            <span class="adm-det-promo-dot" :style="{ background: p.color }" aria-hidden="true" />
            <span>{{ p.name }}</span>
            <button
              class="adm-det-promo-remove"
              :aria-label="`Retirer ${p.name}`"
              :title="`Retirer ${p.name}`"
              :disabled="savingPromo"
              @click="removePromo(p.id, p.name)"
            ><X :size="11" /></button>
          </li>
        </ul>
        <p v-else class="adm-det-promo-empty">
          Aucune promo assignée — {{ detail.type === 'ta' ? 'cet intervenant n\'a accès qu\'à ses projets assignés.' : 'cet enseignant n\'est admin d\'aucune promo.' }}
        </p>

        <div v-if="availablePromos.length" class="adm-det-promo-add">
          <select v-model="promoToAdd" aria-label="Ajouter une promo">
            <option :value="null">Ajouter une promo...</option>
            <option v-for="p in availablePromos" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <button
            class="adm-det-btn"
            :disabled="!promoToAdd || savingPromo"
            @click="addPromo"
          >
            <Plus :size="13" /> Ajouter
          </button>
        </div>
      </section>

      <div class="adm-det-actions">
        <button class="adm-det-btn adm-det-btn--ghost" @click="resetPassword">
          <KeyRound :size="13" /> Reset mot de passe
        </button>
        <button
          class="adm-det-btn adm-det-btn--danger"
          :disabled="detail.type === 'teacher'"
          :title="detail.type === 'teacher' ? 'Impossible de supprimer un Responsable Pedagogique' : 'Supprimer cet utilisateur'"
          @click="deleteUser"
        >
          <UserX :size="13" /> Supprimer
        </button>
        <div style="flex:1" />
        <button class="adm-det-btn adm-det-btn--ghost" @click="emit('close')">Fermer</button>
        <button class="adm-det-btn adm-det-btn--primary" :disabled="!dirty || saving" @click="saveUser">
          {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.adm-det-loading {
  padding: 40px;
  text-align: center;
  color: var(--text-muted);
}
.adm-det {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 18px;
}

.adm-det-head {
  display: flex;
  gap: 14px;
  align-items: center;
}
.adm-det-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}
.adm-det-type {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 4px;
}

.adm-det-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.adm-det-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  text-align: center;
}
.adm-det-stat-val {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}
.adm-det-stat-lbl {
  font-size: 11px;
  color: var(--text-muted);
}

.adm-det-temp-pwd {
  padding: 12px;
  border-radius: 10px;
  background: rgba(var(--color-warn-rgb, 245 158 11), 0.12);
  border: 1px solid rgba(var(--color-warn-rgb, 245 158 11), 0.35);
}
.adm-det-temp-label {
  font-size: 11px;
  color: var(--color-warn, #f59e0b);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.adm-det-temp-value {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
}
.adm-det-temp-value code {
  font-family: var(--font-mono, monospace);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  flex: 1;
  background: var(--bg-input);
  padding: 6px 10px;
  border-radius: 6px;
  letter-spacing: 1px;
}
.adm-det-copy {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px;
  color: var(--text-muted);
  cursor: pointer;
}
.adm-det-copy:hover { color: var(--accent); }
.adm-det-temp-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

.adm-det-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.adm-det-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.adm-det-field > span {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: 12px;
  color: var(--text-muted);
}
.adm-det-field input,
.adm-det-field select {
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 13px;
  outline: none;
}
.adm-det-field input:focus,
.adm-det-field select:focus { border-color: var(--accent); }

.adm-det-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}
.adm-det-btn {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-size: 12px;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: background var(--t-fast) var(--ease-out), border-color var(--t-fast) var(--ease-out);
}
.adm-det-btn:hover:not(:disabled) { border-color: var(--accent); }
.adm-det-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.adm-det-btn--primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.adm-det-btn--primary:hover:not(:disabled) { filter: brightness(1.08); }
.adm-det-btn--danger { color: var(--color-danger); }
.adm-det-btn--danger:hover:not(:disabled) { border-color: var(--color-danger); }
.adm-det-btn--ghost { color: var(--text-muted); }

/* ── Sections Role & Promos ── */
.adm-det-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-elevated);
}
.adm-det-section-head {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-primary);
}
.adm-det-section-head h3 {
  font-size: 13px;
  font-weight: 600;
  margin: 0;
}
.adm-det-section-lock {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: auto;
  font-style: italic;
}
.adm-det-section-count {
  font-size: 11px;
  background: var(--bg-active);
  border-radius: 10px;
  padding: 1px 8px;
  color: var(--text-muted);
  margin-left: auto;
}

.adm-det-promo-icon {
  display: inline-flex;
  width: 14px;
  text-align: center;
  font-weight: 700;
  color: var(--accent);
}

.adm-det-roles {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.adm-det-role-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-main);
  cursor: pointer;
  text-align: left;
  transition: border-color var(--t-fast) var(--ease-out), background var(--t-fast) var(--ease-out);
}
.adm-det-role-card:not(.adm-det-role-card--disabled):not(:disabled):hover {
  border-color: var(--accent);
}
.adm-det-role-card--active {
  border-color: rgba(var(--accent-rgb), 0.5);
  background: rgba(var(--accent-rgb), 0.08);
}
.adm-det-role-card--disabled,
.adm-det-role-card:disabled {
  opacity: 0.75;
  cursor: not-allowed;
}
.adm-det-role-hint {
  flex: 1;
  font-size: 11px;
  color: var(--text-muted);
}

.adm-det-promo-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.adm-det-promo-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px 4px 10px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--bg-main);
  font-size: 12px;
  color: var(--text-primary);
}
.adm-det-promo-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.adm-det-promo-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--t-fast) var(--ease-out), color var(--t-fast) var(--ease-out);
}
.adm-det-promo-remove:hover:not(:disabled) {
  background: rgba(var(--color-danger-rgb, 220 38 38), 0.15);
  color: var(--color-danger);
}
.adm-det-promo-remove:disabled { opacity: 0.4; cursor: not-allowed; }

.adm-det-promo-empty {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  font-style: italic;
}

.adm-det-promo-add {
  display: flex;
  gap: 6px;
  align-items: center;
}
.adm-det-promo-add select {
  flex: 1;
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: 8px;
  padding: 7px 10px;
  font-size: 13px;
  outline: none;
}
.adm-det-promo-add select:focus { border-color: var(--accent); }
</style>
