<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus, Trash2, ChevronDown, ChevronRight, Check, X as XIcon } from 'lucide-vue-next'
import Modal from '@/components/ui/Modal.vue'
import { useAppStore }  from '@/stores/app'
import { useToast }     from '@/composables/useToast'
import { useConfirm }   from '@/composables/useConfirm'
import type { Channel, Promotion } from '@/types'

const props = defineProps<{ modelValue: boolean }>()
const emit  = defineEmits<{ 'update:modelValue': [boolean] }>()

const appStore      = useAppStore()
const { showToast } = useToast()
const { confirm }   = useConfirm()

// ── État ────────────────────────────────────────────────────────────────────
interface Intervenant { id: number; name: string; email: string }

const intervenants   = ref<Intervenant[]>([])
const promotions     = ref<Promotion[]>([])
const promoChannels  = ref<Record<number, Channel[]>>({}) // promoId → channels
const assignments    = ref<Record<number, number[]>>({})  // taId → channelIds
const expandedTaId   = ref<number | null>(null)           // panneau d'affectation ouvert
const loadingAssign  = ref(false)

// ── Formulaire de création ───────────────────────────────────────────────────
const showForm   = ref(false)
const newName    = ref('')
const newEmail   = ref('')
const newPwd     = ref('')
const creating   = ref(false)

// ── Chargement ───────────────────────────────────────────────────────────────
async function load() {
  const [intRes, promRes] = await Promise.all([
    window.api.getIntervenants(),
    window.api.getPromotions(),
  ])
  intervenants.value = intRes?.ok ? intRes.data : []
  promotions.value   = promRes?.ok ? promRes.data : []

  // Charger tous les canaux de chaque promo
  const chMap: Record<number, Channel[]> = {}
  await Promise.all(
    promotions.value.map(async (p) => {
      const r = await window.api.getChannels(p.id)
      chMap[p.id] = r?.ok ? r.data : []
    }),
  )
  promoChannels.value = chMap

  // Charger les assignations existantes
  const asgn: Record<number, number[]> = {}
  await Promise.all(
    intervenants.value.map(async (ta) => {
      const r = await window.api.getTeacherChannels(ta.id)
      asgn[ta.id] = r?.ok ? r.data : []
    }),
  )
  assignments.value = asgn
}

watch(() => props.modelValue, (open) => { if (open) load() })

// ── Création ─────────────────────────────────────────────────────────────────
async function create() {
  if (!newName.value.trim() || !newEmail.value.trim()) {
    showToast('Nom et email requis.', 'error'); return
  }
  creating.value = true
  try {
    const res = await window.api.createIntervenant({
      name:     newName.value.trim(),
      email:    newEmail.value.trim(),
      password: newPwd.value.trim() || 'admin',
    })
    if (!res?.ok) { showToast(res?.error ?? 'Erreur', 'error'); return }
    showToast('Intervenant créé.', 'success')
    newName.value = ''; newEmail.value = ''; newPwd.value = ''
    showForm.value = false
    await load()
  } finally {
    creating.value = false
  }
}

// ── Suppression ──────────────────────────────────────────────────────────────
async function remove(ta: Intervenant) {
  if (!await confirm(`Supprimer l'intervenant « ${ta.name} » ? Cette action est irréversible.`, 'danger', 'Supprimer')) return
  const res = await window.api.deleteIntervenant(ta.id)
  if (!res?.ok) { showToast(res?.error ?? 'Erreur', 'error'); return }
  showToast('Intervenant supprimé.', 'success')
  if (expandedTaId.value === ta.id) expandedTaId.value = null
  await load()
}

// ── Affectation canaux ────────────────────────────────────────────────────────
function toggleExpand(taId: number) {
  expandedTaId.value = expandedTaId.value === taId ? null : taId
}

function toggleChannel(taId: number, channelId: number) {
  const cur = assignments.value[taId] ?? []
  assignments.value[taId] = cur.includes(channelId)
    ? cur.filter((id) => id !== channelId)
    : [...cur, channelId]
}

function isAssigned(taId: number, channelId: number): boolean {
  return (assignments.value[taId] ?? []).includes(channelId)
}

async function saveChannels(taId: number) {
  loadingAssign.value = true
  try {
    const res = await window.api.setTeacherChannels({
      teacherId:  taId,
      channelIds: assignments.value[taId] ?? [],
    })
    if (!res?.ok) { showToast('Erreur lors de la sauvegarde.', 'error'); return }
    showToast('Canaux mis à jour.', 'success')
    expandedTaId.value = null
    // Recharger les canaux du ta courant si c'est lui-même
    if (appStore.currentUser?.type === 'ta' && appStore.currentUser.id === -taId) {
      await appStore.loadTaChannels()
    }
  } finally {
    loadingAssign.value = false
  }
}

// Nb canaux assignés (texte résumé)
function assignedSummary(taId: number): string {
  const ids = assignments.value[taId] ?? []
  if (!ids.length) return 'Tous les canaux (aucune restriction)'
  return `${ids.length} canal${ids.length > 1 ? 'x' : ''} assigné${ids.length > 1 ? 's' : ''}`
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Gestion des intervenants"
    max-width="660px"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- ── Formulaire de création ── -->
    <div class="iv-create-section">
      <button
        class="iv-toggle-form btn-ghost"
        @click="showForm = !showForm"
      >
        <Plus :size="14" />
        Ajouter un intervenant
        <ChevronDown
          :size="13"
          class="iv-chevron"
          :class="{ rotated: showForm }"
        />
      </button>

      <Transition name="iv-slide">
        <div v-if="showForm" class="iv-form">
          <div class="iv-form-row">
            <div class="iv-field">
              <label class="form-label">Nom complet</label>
              <input v-model="newName"  class="form-input" placeholder="Jean Dupont" @keydown.enter="create" />
            </div>
            <div class="iv-field">
              <label class="form-label">Email</label>
              <input v-model="newEmail" class="form-input" type="email" placeholder="j.dupont@cesi.fr" @keydown.enter="create" />
            </div>
            <div class="iv-field iv-field-pwd">
              <label class="form-label">Mot de passe</label>
              <input v-model="newPwd"   class="form-input" type="text" placeholder="admin" @keydown.enter="create" />
            </div>
          </div>
          <div class="iv-form-actions">
            <button class="btn-ghost" @click="showForm = false; newName=''; newEmail=''; newPwd=''">
              Annuler
            </button>
            <button
              class="btn-primary"
              :disabled="!newName.trim() || !newEmail.trim() || creating"
              @click="create"
            >
              {{ creating ? 'Création…' : 'Créer l\'intervenant' }}
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- ── Liste des intervenants ── -->
    <div class="iv-list">
      <div v-if="!intervenants.length" class="iv-empty">
        Aucun intervenant pour l'instant.
      </div>

      <div
        v-for="ta in intervenants"
        :key="ta.id"
        class="iv-card"
      >
        <!-- En-tête intervenant -->
        <div class="iv-card-header">
          <div class="iv-avatar">{{ ta.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }}</div>
          <div class="iv-info">
            <span class="iv-name">{{ ta.name }}</span>
            <span class="iv-email">{{ ta.email }}</span>
          </div>
          <span class="iv-summary">{{ assignedSummary(ta.id) }}</span>
          <div class="iv-actions">
            <button
              class="btn-icon iv-btn-channels"
              :class="{ active: expandedTaId === ta.id }"
              title="Gérer les canaux"
              @click="toggleExpand(ta.id)"
            >
              <ChevronRight
                :size="14"
                class="iv-expand-icon"
                :class="{ rotated: expandedTaId === ta.id }"
              />
              Canaux
            </button>
            <button
              class="btn-icon iv-btn-delete"
              title="Supprimer l'intervenant"
              @click="remove(ta)"
            >
              <Trash2 :size="14" />
            </button>
          </div>
        </div>

        <!-- Panneau d'assignation canaux -->
        <Transition name="iv-expand">
          <div v-if="expandedTaId === ta.id" class="iv-channels-panel">
            <div class="iv-channels-hint">
              Cochez les canaux auxquels cet intervenant a accès.
              Sans sélection, il voit tous les canaux.
            </div>

            <div
              v-for="promo in promotions"
              :key="promo.id"
              class="iv-promo-group"
            >
              <div class="iv-promo-label">{{ promo.name }}</div>
              <div class="iv-channels-grid">
                <label
                  v-for="ch in promoChannels[promo.id] ?? []"
                  :key="ch.id"
                  class="iv-ch-item"
                  :class="{ checked: isAssigned(ta.id, ch.id) }"
                >
                  <input
                    type="checkbox"
                    :checked="isAssigned(ta.id, ch.id)"
                    @change="toggleChannel(ta.id, ch.id)"
                  />
                  <Check v-if="isAssigned(ta.id, ch.id)" :size="10" class="iv-ch-check" />
                  <span class="iv-ch-prefix">{{ ch.type === 'annonce' ? '📢' : '#' }}</span>
                  <span class="iv-ch-name">{{ ch.name }}</span>
                </label>
              </div>
            </div>

            <div class="iv-channels-footer">
              <button
                class="btn-ghost iv-btn-clear"
                @click="assignments[ta.id] = []"
              >
                <XIcon :size="12" /> Tout désélectionner
              </button>
              <button
                class="btn-primary"
                :disabled="loadingAssign"
                @click="saveChannels(ta.id)"
              >
                <Check :size="13" />
                {{ loadingAssign ? 'Sauvegarde…' : 'Sauvegarder' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
/* ── Section création ── */
.iv-create-section {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 16px;
}

.iv-toggle-form {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  border-radius: 0;
  color: var(--accent);
  transition: background .1s;
}
.iv-toggle-form:hover { background: rgba(74,144,217,.07); }

.iv-chevron {
  margin-left: auto;
  transition: transform .18s ease;
}
.iv-chevron.rotated { transform: rotate(180deg); }

.iv-form {
  padding: 12px 14px 14px;
  border-top: 1px solid var(--border);
  background: rgba(255,255,255,.02);
}

.iv-form-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.iv-field {
  flex: 1;
  min-width: 140px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.iv-field-pwd { max-width: 140px; }

.iv-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

/* ── Liste ── */
.iv-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.iv-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  font-style: italic;
}

/* ── Carte intervenant ── */
.iv-card {
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.iv-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
}

.iv-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #7B5EA7;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.iv-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.iv-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}

.iv-email {
  font-size: 11.5px;
  color: var(--text-muted);
}

.iv-summary {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
  font-style: italic;
}

.iv-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.iv-btn-channels {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  padding: 4px 9px;
  border-radius: 6px;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  transition: background .1s, color .1s, border-color .1s;
}
.iv-btn-channels:hover,
.iv-btn-channels.active {
  background: rgba(74,144,217,.1);
  color: var(--accent);
  border-color: rgba(74,144,217,.4);
}

.iv-expand-icon {
  transition: transform .18s ease;
}
.iv-expand-icon.rotated { transform: rotate(90deg); }

.iv-btn-delete {
  color: var(--text-muted);
  padding: 5px;
  border-radius: 6px;
  transition: color .1s, background .1s;
}
.iv-btn-delete:hover { color: var(--color-danger, #e74c3c); background: rgba(231,76,60,.1); }

/* ── Panneau canaux ── */
.iv-channels-panel {
  border-top: 1px solid var(--border);
  padding: 12px 14px;
  background: rgba(255,255,255,.02);
}

.iv-channels-hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 10px;
  font-style: italic;
}

.iv-promo-group {
  margin-bottom: 10px;
}

.iv-promo-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.iv-channels-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.iv-ch-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 9px 4px 7px;
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary);
  background: transparent;
  transition: background .08s, border-color .08s, color .08s;
  user-select: none;
}
.iv-ch-item:hover { background: rgba(255,255,255,.06); }
.iv-ch-item.checked {
  background: rgba(74,144,217,.12);
  border-color: rgba(74,144,217,.4);
  color: var(--text-primary);
}
.iv-ch-item input[type="checkbox"] { display: none; }
.iv-ch-check { color: var(--accent); flex-shrink: 0; }
.iv-ch-prefix { flex-shrink: 0; }
.iv-ch-name { white-space: nowrap; }

.iv-channels-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.iv-btn-clear {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-muted);
}

/* ── Transitions ── */
.iv-slide-enter-active,
.iv-slide-leave-active { transition: opacity .15s ease, transform .15s ease; overflow: hidden; }
.iv-slide-enter-from,
.iv-slide-leave-to     { opacity: 0; transform: translateY(-6px); }

.iv-expand-enter-active { transition: opacity .15s ease; }
.iv-expand-leave-active { transition: opacity .1s ease; }
.iv-expand-enter-from,
.iv-expand-leave-to     { opacity: 0; }
</style>
