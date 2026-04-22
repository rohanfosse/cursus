<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Search, UserX, KeyRound, ArrowRightLeft, RefreshCw, AlertTriangle, CheckSquare, Square } from 'lucide-vue-next'
import Avatar from '@/components/ui/Avatar.vue'
import UiRoleBadge from '@/components/ui/UiRoleBadge.vue'
import AdminUserDetail from '@/components/admin/AdminUserDetail.vue'
import { useApi } from '@/composables/useApi'
import { useConfirm } from '@/composables/useConfirm'
import { useDebounce } from '@/composables/useDebounce'
import { useToast } from '@/composables/useToast'
import type { Promotion } from '@/types'
import type { Role } from '@/utils/permissions'
import { avatarColor } from '@/utils/format'

interface AdminUser {
  id: number
  name: string
  email: string
  type: Role
  promo_id: number | null
  promo_name: string | null
  promo_color: string | null
  avatar_initials: string
  photo_data: string | null
  must_change_password: number
}

const { api } = useApi()
const { confirm } = useConfirm()
const { showToast } = useToast()

const users = ref<AdminUser[]>([])
const total = ref(0)
const loading = ref(false)
const search = ref('')
const filterType = ref<'' | 'student' | 'teacher' | 'ta'>('')
const filterPromoId = ref<number | null>(null)
const promos = ref<Promotion[]>([])
const selectedIds = ref<Set<number>>(new Set())
const detailUserId = ref<number | null>(null)

// Stale-response guard : evite qu'une vieille requete ecrase une plus recente
let reqId = 0

const debouncedSearch = useDebounce(search, 250)

async function loadPromos() {
  const data = await api(() => window.api.getPromotions())
  promos.value = data ?? []
}

async function loadUsers() {
  loading.value = true
  const myReq = ++reqId
  const res = await api(() => window.api.adminGetUsers({
    search: debouncedSearch.value || undefined,
    type: filterType.value || null,
    promo_id: filterPromoId.value ?? null,
    limit: 200,
  }))
  if (myReq !== reqId) return
  if (res) {
    users.value = res.users as AdminUser[]
    total.value = res.total
  }
  loading.value = false
  selectedIds.value = new Set([...selectedIds.value].filter(id => users.value.some(u => u.id === id)))
}

watch([debouncedSearch, filterType, filterPromoId], loadUsers)

onMounted(async () => {
  await Promise.all([loadPromos(), loadUsers()])
})

function toggleSelect(id: number) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function selectAll() {
  if (selectedIds.value.size === users.value.length) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(users.value.map(u => u.id))
  }
}

const selectedUsers = computed(() => users.value.filter(u => selectedIds.value.has(u.id)))
const canDelete = computed(() => selectedUsers.value.every(u => u.type !== 'teacher'))

/**
 * Execute `task` sur chaque item par paquets de `concurrency` en parallele.
 * Le main Electron serialise deja les IPC : 5 simultanes suffisent pour
 * diviser ~5x le temps total sans noyer la queue IPC.
 */
async function runBatched<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency)
    const results = await Promise.all(chunk.map(task))
    for (let j = 0; j < results.length; j++) out[i + j] = results[j]
  }
  return out
}

async function bulkResetPassword() {
  const picks = selectedUsers.value
  if (!picks.length) return
  const ok = await confirm({
    message: `Reinitialiser le mot de passe de ${picks.length} utilisateur(s) ? Chacun recevra un mot de passe temporaire affiche a l'ecran.`,
    variant: 'warning',
    confirmLabel: 'Reinitialiser',
  })
  if (!ok) return

  const responses = await runBatched(picks, 5, u => window.api.adminResetPassword(u.id))
  const results: Array<{ name: string; pwd: string }> = []
  let errors = 0
  responses.forEach((res, i) => {
    if (res?.ok && res.data?.tempPassword) results.push({ name: picks[i].name, pwd: res.data.tempPassword })
    else errors++
  })
  if (results.length) {
    const preview = results.slice(0, 3).map(r => `${r.name}: ${r.pwd}`).join(' · ')
    showToast(`${results.length} mot(s) de passe reinitialise(s). ${preview}${results.length > 3 ? '...' : ''}`, 'success')
  }
  if (errors) showToast(`${errors} erreur(s) sur la reinitialisation`, 'error')
  selectedIds.value = new Set()
}

async function bulkDelete() {
  const picks = selectedUsers.value
  if (!picks.length) return
  if (!canDelete.value) {
    showToast('Impossible de supprimer un Responsable Pedagogique (teacher).', 'error')
    return
  }
  const ok = await confirm({
    message: `Supprimer ${picks.length} utilisateur(s) ? Leurs donnees seront retirees (messages, depots, sessions).`,
    variant: 'danger',
    confirmLabel: 'Supprimer',
  })
  if (!ok) return

  const responses = await runBatched(picks, 5, u => window.api.adminDeleteUser(u.id))
  const done = responses.filter(r => r?.ok).length
  const errors = responses.length - done
  showToast(`${done} utilisateur(s) supprime(s)${errors ? ` (${errors} erreur(s))` : ''}`, errors ? 'error' : 'success')
  selectedIds.value = new Set()
  await loadUsers()
}

const bulkPromoTarget = ref<number | null>(null)

async function bulkChangePromo() {
  const picks = selectedUsers.value.filter(u => u.type === 'student')
  if (!picks.length) { showToast('Seuls les etudiants peuvent changer de promo.', 'info'); return }
  if (!bulkPromoTarget.value) { showToast('Choisis une promo cible.', 'info'); return }
  const target = promos.value.find(p => p.id === bulkPromoTarget.value)
  const ok = await confirm({
    message: `Deplacer ${picks.length} etudiant(s) vers la promo ${target?.name ?? '#' + bulkPromoTarget.value} ?`,
    variant: 'warning',
    confirmLabel: 'Deplacer',
  })
  if (!ok) return

  const responses = await runBatched(picks, 5, u => window.api.adminUpdateUser(u.id, { promo_id: bulkPromoTarget.value }))
  const done = responses.filter(r => r?.ok).length
  const errors = responses.length - done
  showToast(`${done} etudiant(s) deplace(s)${errors ? ` (${errors} erreur(s))` : ''}`, errors ? 'error' : 'success')
  selectedIds.value = new Set()
  bulkPromoTarget.value = null
  await loadUsers()
}

</script>

<template>
  <div class="adm-users">
    <div class="adm-toolbar">
      <div class="adm-search">
        <Search :size="14" />
        <input
          v-model="search"
          type="search"
          placeholder="Rechercher par nom ou email..."
          aria-label="Rechercher un utilisateur"
        />
      </div>
      <select v-model="filterType" aria-label="Filtrer par type">
        <option value="">Tous les types</option>
        <option value="student">Etudiants</option>
        <option value="teacher">Enseignants</option>
        <option value="ta">Intervenants</option>
      </select>
      <select v-model="filterPromoId" aria-label="Filtrer par promo">
        <option :value="null">Toutes les promos</option>
        <option v-for="p in promos" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
      <button class="adm-refresh" :disabled="loading" title="Rafraichir" @click="loadUsers">
        <RefreshCw :size="14" :class="{ 'is-spinning': loading }" />
      </button>
    </div>

    <div v-if="selectedIds.size > 0" class="adm-bulk-bar" role="region" aria-label="Actions groupees">
      <span class="adm-bulk-count">
        <CheckSquare :size="14" />
        {{ selectedIds.size }} selectionne(s)
      </span>
      <div class="adm-bulk-actions">
        <button class="adm-bulk-btn" title="Reinitialiser les mots de passe" @click="bulkResetPassword">
          <KeyRound :size="13" /> Reset mots de passe
        </button>
        <div class="adm-bulk-group">
          <select v-model="bulkPromoTarget" aria-label="Promo cible">
            <option :value="null">Changer de promo...</option>
            <option v-for="p in promos" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <button class="adm-bulk-btn" :disabled="!bulkPromoTarget" @click="bulkChangePromo">
            <ArrowRightLeft :size="13" /> Deplacer
          </button>
        </div>
        <button
          class="adm-bulk-btn adm-bulk-btn--danger"
          :disabled="!canDelete"
          :title="canDelete ? 'Supprimer' : 'Impossible : un Responsable Pedagogique est selectionne'"
          @click="bulkDelete"
        >
          <UserX :size="13" /> Supprimer
        </button>
        <button class="adm-bulk-btn adm-bulk-btn--ghost" @click="selectedIds = new Set()">
          Annuler selection
        </button>
      </div>
    </div>

    <div v-if="!canDelete && selectedIds.size > 0" class="adm-warn">
      <AlertTriangle :size="13" />
      La selection contient un Responsable Pedagogique : suppression desactivee.
    </div>

    <div class="adm-table-wrap">
      <table class="adm-table">
        <thead>
          <tr>
            <th style="width:32px">
              <button class="adm-check" :aria-label="selectedIds.size === users.length ? 'Tout deselectionner' : 'Tout selectionner'" @click="selectAll">
                <component :is="selectedIds.size === users.length && users.length > 0 ? CheckSquare : Square" :size="14" />
              </button>
            </th>
            <th>Utilisateur</th>
            <th>Type</th>
            <th>Promo</th>
            <th>Email</th>
            <th style="width:80px">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && !users.length">
            <td colspan="6" class="adm-empty">Chargement...</td>
          </tr>
          <tr v-else-if="!users.length">
            <td colspan="6" class="adm-empty">Aucun utilisateur trouve.</td>
          </tr>
          <tr
            v-for="u in users"
            v-else
            :key="u.id"
            :class="{ 'adm-row--selected': selectedIds.has(u.id) }"
            @click="detailUserId = u.id"
          >
            <td @click.stop>
              <button class="adm-check" :aria-label="selectedIds.has(u.id) ? 'Deselectionner' : 'Selectionner'" @click="toggleSelect(u.id)">
                <component :is="selectedIds.has(u.id) ? CheckSquare : Square" :size="14" />
              </button>
            </td>
            <td>
              <div class="adm-user-cell">
                <Avatar :initials="u.avatar_initials" :photo-data="u.photo_data" :color="avatarColor(u.name)" :size="28" />
                <span class="adm-user-name">{{ u.name }}</span>
                <span v-if="u.must_change_password" class="adm-pwd-flag" title="Doit changer son mot de passe">!</span>
              </div>
            </td>
            <td>
              <UiRoleBadge v-if="u.type !== 'student'" :role="u.type" size="xs" />
              <span v-else class="adm-role-student">Etudiant</span>
            </td>
            <td>
              <span v-if="u.promo_name" class="adm-promo-chip" :style="{ borderColor: u.promo_color ?? 'var(--border)' }">
                {{ u.promo_name }}
              </span>
              <span v-else class="adm-muted">-</span>
            </td>
            <td class="adm-email">{{ u.email || '-' }}</td>
            <td @click.stop>
              <button class="adm-open-btn" title="Voir le detail" @click="detailUserId = u.id">
                Detail
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="adm-footer">
      <span>{{ users.length }} / {{ total }} utilisateur(s)</span>
    </div>

    <AdminUserDetail
      v-if="detailUserId !== null"
      :user-id="detailUserId"
      :promos="promos"
      @close="detailUserId = null"
      @updated="loadUsers"
    />
  </div>
</template>

<style scoped>
.adm-users {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.adm-toolbar {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
  align-items: center;
}

.adm-search {
  position: relative;
  flex: 1 1 240px;
  min-width: 240px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px 12px;
  color: var(--text-muted);
}
.adm-search input {
  border: none;
  background: transparent;
  color: var(--text-primary);
  font: inherit;
  width: 100%;
  outline: none;
}
.adm-search:focus-within {
  border-color: var(--accent);
}

.adm-toolbar select {
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: 10px;
  padding: 6px 12px;
  font-size: 13px;
  outline: none;
  cursor: pointer;
}
.adm-toolbar select:focus { border-color: var(--accent); }

.adm-refresh {
  background: var(--bg-input);
  border: 1px solid var(--border);
  color: var(--text-muted);
  border-radius: 10px;
  padding: 7px 10px;
  cursor: pointer;
}
.adm-refresh:hover:not(:disabled) { color: var(--text-primary); }
.is-spinning { animation: adm-spin 1s linear infinite; }
@keyframes adm-spin { to { transform: rotate(360deg); } }

.adm-bulk-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-sm);
  padding: 10px 14px;
  border: 1px solid rgba(var(--accent-rgb), 0.3);
  background: rgba(var(--accent-rgb), 0.08);
  border-radius: 12px;
}
.adm-bulk-count {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}
.adm-bulk-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
.adm-bulk-group {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.adm-bulk-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 6px 10px;
  background: var(--bg-main);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color var(--t-fast) var(--ease-out);
}
.adm-bulk-btn:hover:not(:disabled) { border-color: var(--accent); }
.adm-bulk-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.adm-bulk-btn--danger { color: var(--color-danger); }
.adm-bulk-btn--danger:hover:not(:disabled) { border-color: var(--color-danger); }
.adm-bulk-btn--ghost { background: transparent; color: var(--text-muted); }

.adm-warn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--color-warn, var(--text-muted));
  font-size: 12px;
}

.adm-table-wrap {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-elevated);
}
.adm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.adm-table th {
  text-align: left;
  padding: 10px 14px;
  background: var(--bg-active);
  color: var(--text-muted);
  font-weight: 600;
  font-size: 12px;
  border-bottom: 1px solid var(--border);
}
.adm-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
}
.adm-table tbody tr {
  cursor: pointer;
  transition: background var(--t-fast) var(--ease-out);
}
.adm-table tbody tr:hover { background: var(--bg-active); }
.adm-row--selected { background: rgba(var(--accent-rgb), 0.08) !important; }

.adm-empty {
  text-align: center;
  padding: 32px !important;
  color: var(--text-muted);
}

.adm-check {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: inline-flex;
}
.adm-check:hover { color: var(--accent); }

.adm-user-cell {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.adm-user-name { font-weight: 500; }
.adm-pwd-flag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(var(--color-warn-rgb, 245 158 11), 0.18);
  color: var(--color-warn, #f59e0b);
  font-size: 11px;
  font-weight: 700;
}

.adm-role-student {
  display: inline-block;
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.adm-promo-chip {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 14px;
  border: 1px solid var(--border);
  color: var(--text-primary);
}

.adm-email {
  color: var(--text-muted);
  font-size: 12px;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.adm-muted { color: var(--text-muted); }

.adm-open-btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
.adm-open-btn:hover { border-color: var(--accent); }

.adm-footer {
  font-size: 12px;
  color: var(--text-muted);
  text-align: right;
  padding: 0 4px;
}
</style>
