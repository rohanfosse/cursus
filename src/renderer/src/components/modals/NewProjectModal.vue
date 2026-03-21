<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useAppStore }   from '@/stores/app'
import { useToast }      from '@/composables/useToast'
import { useApi }        from '@/composables/useApi'
import { isoForDatetimeLocal } from '@/utils/date'
import { CATEGORY_ICONS }      from '@/utils/categoryIcon'
import { avatarColor, initials } from '@/utils/format'
import Modal from '@/components/ui/Modal.vue'
import { Plus, Minus, Shuffle, X, Info, Users, Lock, Hash } from 'lucide-vue-next'
import { STORAGE_KEYS } from '@/constants'

export interface ProjectMeta {
  emoji:       string
  name:        string
  description: string
  startDate:   string
  endDate:     string
  wholeYear?:  boolean
}

interface Group {
  id:        number
  name:      string
  memberIds: number[]
}

interface Student {
  id:               number
  name:             string
  avatar_initials?: string | null
}

const props = defineProps<{ modelValue: boolean }>()
const emit  = defineEmits<{
  'update:modelValue': [v: boolean]
  created: [name: string]
}>()

const appStore      = useAppStore()
const { showToast } = useToast()
const { api }       = useApi()

// ── Tabs ──────────────────────────────────────────────────────────────────
const activeTab = ref<'infos' | 'groupes'>('infos')

// ── Infos ─────────────────────────────────────────────────────────────────
const selectedIconKey = ref('monitor')
const name            = ref('')
const description     = ref('')
const wholeYear       = ref(false)
const startDate       = ref(isoForDatetimeLocal())
const endDate         = ref(isoForDatetimeLocal())

// ── Groupes ───────────────────────────────────────────────────────────────
const enableGroups        = ref(false)
const createChannelsAuto  = ref(true)
let   nextGroupId         = 1
const groups              = ref<Group[]>([])
const students            = ref<Student[]>([])
const studentsLoading     = ref(false)
const saving              = ref(false)

// ── Computed ──────────────────────────────────────────────────────────────
const assignedIds = computed(() => new Set(groups.value.flatMap(g => g.memberIds)))
const unassigned  = computed(() => students.value.filter(s => !assignedIds.value.has(s.id)))

const selectedIcon = computed(() => CATEGORY_ICONS.find(i => i.key === selectedIconKey.value) ?? null)

// ── Reset à l'ouverture ───────────────────────────────────────────────────
watch(() => props.modelValue, (open) => {
  if (!open) return
  activeTab.value       = 'infos'
  selectedIconKey.value = 'monitor'
  name.value            = ''
  description.value     = ''
  wholeYear.value       = false
  startDate.value       = isoForDatetimeLocal()
  endDate.value         = isoForDatetimeLocal()
  enableGroups.value    = false
  createChannelsAuto.value = true
  groups.value          = []
  students.value        = []
  nextGroupId           = 1
})

watch(enableGroups, (on) => {
  if (!on) return
  if (groups.value.length === 0) { addGroup(); addGroup() }
  loadStudents()
})

// ── Utilitaires ───────────────────────────────────────────────────────────
function fullName() {
  return selectedIconKey.value
    ? `${selectedIconKey.value} ${name.value.trim()}`
    : name.value.trim()
}

function studentById(id: number) {
  return students.value.find(s => s.id === id)
}

function addGroup() {
  groups.value.push({ id: nextGroupId++, name: `Groupe ${groups.value.length + 1}`, memberIds: [] })
}

function removeGroup(gid: number) {
  groups.value = groups.value.filter(g => g.id !== gid)
}

function addMember(gid: number, sid: number) {
  const g = groups.value.find(g => g.id === gid)
  if (g && !g.memberIds.includes(sid)) g.memberIds.push(sid)
}

function removeMember(gid: number, sid: number) {
  const g = groups.value.find(g => g.id === gid)
  if (g) g.memberIds = g.memberIds.filter(id => id !== sid)
}

function distributeRandom() {
  for (const g of groups.value) g.memberIds = []
  const shuffled = [...students.value].sort(() => Math.random() - .5)
  shuffled.forEach((s, i) => { groups.value[i % groups.value.length].memberIds.push(s.id) })
}

async function loadStudents() {
  const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id
  if (!promoId || studentsLoading.value || students.value.length) return
  studentsLoading.value = true
  try {
    students.value = await api<Student[]>(() => window.api.getStudents(promoId)) ?? []
  } finally {
    studentsLoading.value = false
  }
}

// ── Sauvegarde ────────────────────────────────────────────────────────────
async function save() {
  const n = name.value.trim()
  if (!n) return
  saving.value = true
  try {
    const full    = fullName()
    const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id

    // 1. Persister dans localStorage
    const raw = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_PROJECTS) ?? '[]') as string[] } catch { return [] } })()
    if (!raw.includes(full)) { raw.push(full); localStorage.setItem(STORAGE_KEYS.CUSTOM_PROJECTS, JSON.stringify(raw)) }

    if (promoId) {
      const key   = STORAGE_KEYS.projectsMeta(promoId)
      const metas: ProjectMeta[] = (() => { try { return JSON.parse(localStorage.getItem(key) ?? '[]') } catch { return [] } })()
      if (!metas.find(m => m.name === full)) {
        metas.push({
          emoji:       selectedIconKey.value,
          name:        full,
          description: description.value.trim(),
          startDate:   wholeYear.value ? '' : startDate.value,
          endDate:     wholeYear.value ? '' : endDate.value,
          wholeYear:   wholeYear.value,
        })
        localStorage.setItem(key, JSON.stringify(metas))
      }
    }

    // 2. Création des canaux si demandé
    if (enableGroups.value && createChannelsAuto.value && promoId) {
      // Canal principal du projet (public)
      await window.api.createChannel({ promoId, name: n, type: 'chat', isPrivate: false, members: [], category: full })
      // Canaux privés par groupe
      for (const g of groups.value) {
        if (g.memberIds.length > 0) {
          await window.api.createChannel({
            promoId,
            name:      g.name,
            type:      'chat',
            isPrivate: true,
            members:   [...g.memberIds],
            category:  full,
          })
        }
      }
      const nChannels = groups.value.filter(g => g.memberIds.length > 0).length + 1
      showToast(`Projet « ${full} » créé · ${nChannels} canaux générés.`, 'success')
    } else {
      showToast(`Projet « ${full} » créé.`, 'success')
    }

    emit('created', full)
    emit('update:modelValue', false)
  } catch (e: any) {
    showToast(e?.message ?? 'Erreur lors de la création.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal :model-value="modelValue" max-width="660px" @update:model-value="emit('update:modelValue', $event)">
    <!-- ── En-tête avec tabs ── -->
    <div class="np-header">
      <div class="np-header-title">
        <component v-if="selectedIcon" :is="selectedIcon.component" :size="16" class="np-header-icon" />
        <span>{{ name.trim() || 'Nouveau projet' }}</span>
      </div>
      <div class="np-tabs" role="tablist">
        <button
          class="np-tab"
          :class="{ active: activeTab === 'infos' }"
          role="tab"
          :aria-selected="activeTab === 'infos'"
          @click="activeTab = 'infos'"
        >Infos</button>
        <button
          class="np-tab"
          :class="{ active: activeTab === 'groupes' }"
          role="tab"
          :aria-selected="activeTab === 'groupes'"
          @click="activeTab = 'groupes'; enableGroups && loadStudents()"
        >
          Groupes
          <span v-if="enableGroups" class="np-tab-badge">{{ groups.length }}</span>
        </button>
      </div>
      <button class="np-close" aria-label="Fermer" @click="emit('update:modelValue', false)">
        <X :size="15" />
      </button>
    </div>

    <!-- ── Corps scrollable ── -->
    <div class="np-body">

      <!-- ══ TAB : INFOS ══ -->
      <template v-if="activeTab === 'infos'">

        <!-- Icône -->
        <div class="form-group">
          <label class="form-label">Icône du projet</label>
          <div class="np-icon-grid">
            <button
              v-for="ic in CATEGORY_ICONS"
              :key="ic.key"
              class="np-icon-btn"
              :class="{ selected: selectedIconKey === ic.key }"
              type="button"
              :title="ic.label"
              @click="selectedIconKey = ic.key"
            >
              <component :is="ic.component" :size="15" />
            </button>
          </div>
        </div>

        <!-- Nom -->
        <div class="form-group">
          <label class="form-label">Nom du projet <span class="np-required">*</span></label>
          <div class="np-name-row">
            <div class="np-name-icon-wrap">
              <component v-if="selectedIcon" :is="selectedIcon.component" :size="16" class="np-name-icon" />
            </div>
            <input
              v-model="name"
              type="text"
              class="form-input"
              placeholder="ex : Développement Web, Algorithmique…"
              autofocus
            />
          </div>
        </div>

        <!-- Description -->
        <div class="form-group">
          <label class="form-label">Description <span class="np-optional">optionnelle</span></label>
          <textarea
            v-model="description"
            class="form-input"
            rows="3"
            style="resize:vertical"
            placeholder="Objectifs, compétences visées…"
          />
        </div>

        <!-- Durée -->
        <div class="form-group">
          <label class="form-label">Durée</label>

          <!-- Toggle toute l'année -->
          <label class="np-toggle-row">
            <div class="np-toggle" :class="{ on: wholeYear }" @click="wholeYear = !wholeYear">
              <div class="np-toggle-thumb" />
            </div>
            <span class="np-toggle-label">Ce projet dure toute l'année scolaire</span>
          </label>

          <!-- Dates (si pas toute l'année) -->
          <Transition name="np-collapse">
            <div v-if="!wholeYear" class="np-dates-row">
              <div class="form-group" style="flex:1;margin:0">
                <label class="form-label" style="font-size:11px">Début</label>
                <input v-model="startDate" type="datetime-local" class="form-input" />
              </div>
              <div class="np-date-sep">→</div>
              <div class="form-group" style="flex:1;margin:0">
                <label class="form-label" style="font-size:11px">Fin</label>
                <input v-model="endDate" type="datetime-local" class="form-input" />
              </div>
            </div>
          </Transition>
          <p v-if="wholeYear" class="np-whole-year-hint">
            Le projet ne sera pas filtré par date et restera visible toute l'année.
          </p>
        </div>

      </template>

      <!-- ══ TAB : GROUPES ══ -->
      <template v-else>

        <!-- Toggle principal -->
        <div class="np-section-card" :class="{ active: enableGroups }">
          <div class="np-section-card-header" @click="enableGroups = !enableGroups">
            <div class="np-toggle" :class="{ on: enableGroups }">
              <div class="np-toggle-thumb" />
            </div>
            <div>
              <div class="np-section-card-title"><Users :size="14" /> Créer des groupes</div>
              <div class="np-section-card-sub">Divisez la promotion en groupes de travail</div>
            </div>
          </div>
        </div>

        <!-- Contenu groupes -->
        <Transition name="np-collapse">
          <div v-if="enableGroups" class="np-groups-content">

            <!-- Barre d'outils groupes -->
            <div class="np-groups-toolbar">
              <span class="np-groups-count-label">Groupes</span>
              <div class="np-groups-counter">
                <button class="np-counter-btn" :disabled="groups.length <= 1" @click="removeGroup(groups[groups.length - 1].id)">
                  <Minus :size="12" />
                </button>
                <span class="np-counter-val">{{ groups.length }}</span>
                <button class="np-counter-btn" @click="addGroup">
                  <Plus :size="12" />
                </button>
              </div>
              <button
                class="np-shuffle-btn"
                :disabled="students.length === 0"
                title="Répartir les étudiants aléatoirement"
                @click="distributeRandom"
              >
                <Shuffle :size="13" />
                Répartir aléatoirement
              </button>
            </div>

            <!-- Grille des groupes -->
            <div v-if="studentsLoading" class="np-loading">Chargement des étudiants…</div>

            <div class="np-groups-grid">
              <div v-for="g in groups" :key="g.id" class="np-group-card">
                <!-- En-tête du groupe -->
                <div class="np-group-header">
                  <Lock :size="11" class="np-group-lock" />
                  <input
                    v-model="g.name"
                    class="np-group-name-input"
                    placeholder="Nom du groupe"
                  />
                  <button class="np-group-remove" title="Supprimer ce groupe" @click="removeGroup(g.id)">
                    <X :size="11" />
                  </button>
                </div>

                <!-- Membres du groupe -->
                <div class="np-group-members">
                  <div v-if="g.memberIds.length === 0" class="np-group-empty">
                    Aucun membre
                  </div>
                  <div v-else class="np-member-chips">
                    <div v-for="sid in g.memberIds" :key="sid" class="np-member-chip">
                      <div
                        class="np-chip-avatar"
                        :style="{ background: avatarColor(studentById(sid)?.name ?? '') }"
                      >
                        {{ initials(studentById(sid)?.name ?? '?') }}
                      </div>
                      <span>{{ studentById(sid)?.name ?? '?' }}</span>
                      <button class="np-chip-remove" @click="removeMember(g.id, sid)">
                        <X :size="9" />
                      </button>
                    </div>
                  </div>

                  <!-- Sélecteur d'ajout -->
                  <select
                    v-if="unassigned.length > 0"
                    class="np-add-select"
                    @change="e => { addMember(g.id, +(e.target as HTMLSelectElement).value); (e.target as HTMLSelectElement).value = '' }"
                  >
                    <option value="">+ Ajouter un étudiant…</option>
                    <option v-for="s in unassigned" :key="s.id" :value="s.id">{{ s.name }}</option>
                  </select>
                </div>

                <!-- Compteur -->
                <div class="np-group-footer">
                  <span>{{ g.memberIds.length }} membre{{ g.memberIds.length !== 1 ? 's' : '' }}</span>
                </div>
              </div>
            </div>

            <!-- Pool étudiants non assignés -->
            <div v-if="unassigned.length > 0" class="np-pool">
              <div class="np-pool-title">Non assignés ({{ unassigned.length }})</div>
              <div class="np-pool-chips">
                <div v-for="s in unassigned" :key="s.id" class="np-pool-chip">
                  <div class="np-chip-avatar" :style="{ background: avatarColor(s.name) }">
                    {{ initials(s.name) }}
                  </div>
                  <span>{{ s.name }}</span>
                </div>
              </div>
            </div>
            <div v-else-if="students.length > 0" class="np-pool-done">
              ✓ Tous les étudiants sont assignés
            </div>

            <!-- Option création canaux -->
            <div class="np-channels-option">
              <label class="np-toggle-row" style="gap:10px">
                <div class="np-toggle" :class="{ on: createChannelsAuto }" @click="createChannelsAuto = !createChannelsAuto">
                  <div class="np-toggle-thumb" />
                </div>
                <div>
                  <div class="np-option-title">Créer les canaux automatiquement</div>
                  <div class="np-option-sub">
                    Crée une catégorie <strong>{{ name.trim() || '…' }}</strong>,
                    un canal général <Hash :size="11" /> <strong>{{ name.trim() || '…' }}</strong>
                    et {{ groups.length }} canal{{ groups.length !== 1 ? 'x' : '' }} privé{{ groups.length !== 1 ? 's' : '' }}
                    <Lock :size="11" />
                  </div>
                </div>
              </label>
            </div>

          </div>
        </Transition>

        <!-- Info quand groupes désactivés -->
        <div v-if="!enableGroups" class="np-groups-off-hint">
          <Info :size="14" />
          <span>Vous pouvez créer des groupes et canaux maintenant, ou les ajouter plus tard depuis la sidebar.</span>
        </div>

      </template>
    </div>

    <!-- ── Pied de page ── -->
    <div class="np-footer">
      <button class="btn-ghost" @click="emit('update:modelValue', false)">Annuler</button>
      <div class="np-footer-right">
        <button
          v-if="activeTab === 'infos'"
          class="btn-ghost"
          :disabled="!name.trim()"
          @click="activeTab = 'groupes'; enableGroups && loadStudents()"
        >
          Configurer les groupes →
        </button>
        <button
          class="btn-primary"
          :disabled="!name.trim() || saving"
          @click="save"
        >
          <span v-if="saving">Création…</span>
          <span v-else-if="enableGroups && createChannelsAuto">
            Créer le projet &amp; les canaux
          </span>
          <span v-else>Créer le projet</span>
        </button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
/* ── En-tête ── */
.np-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px 0;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.np-header-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.np-header-icon { color: var(--accent); flex-shrink: 0; }

.np-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  transition: color .1s, background .1s;
  margin-bottom: 4px;
}
.np-close:hover { color: var(--text-primary); background: rgba(255,255,255,.07); }

/* Tabs */
.np-tabs {
  display: flex;
  gap: 2px;
  align-items: flex-end;
}

.np-tab {
  padding: 7px 14px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: color .12s, border-color .12s;
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: -1px;
}
.np-tab:hover { color: var(--text-secondary); }
.np-tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

.np-tab-badge {
  background: var(--accent);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  border-radius: 8px;
  padding: 0 5px;
  min-width: 16px;
  text-align: center;
}

/* ── Corps ── */
.np-body {
  flex: 1;
  padding: 18px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 68vh;
}

/* ── Champ requis / optionnel ── */
.np-required { color: var(--color-danger, #e74c3c); }
.np-optional { font-size: 11px; font-weight: 400; opacity: .55; }

/* ── Icônes ── */
.np-icon-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.np-icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid transparent;
  border-radius: 6px;
  background: rgba(255,255,255,.04);
  color: var(--text-muted);
  cursor: pointer;
  transition: all .1s;
}
.np-icon-btn:hover    { background: var(--bg-hover); border-color: var(--border-input); color: var(--text-secondary); }
.np-icon-btn.selected { border-color: var(--accent); background: rgba(74,144,217,.15); color: var(--accent); }

/* ── Ligne nom ── */
.np-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.np-name-icon-wrap {
  width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.np-name-icon { color: var(--accent); }

/* ── Toggle switch ── */
.np-toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}
.np-toggle-label { font-size: 13px; color: var(--text-secondary); }

.np-toggle {
  width: 32px;
  height: 18px;
  border-radius: 9px;
  background: rgba(255,255,255,.12);
  position: relative;
  flex-shrink: 0;
  transition: background .18s;
  cursor: pointer;
}
.np-toggle.on { background: var(--accent); }
.np-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  transition: transform .18s;
  box-shadow: 0 1px 3px rgba(0,0,0,.3);
}
.np-toggle.on .np-toggle-thumb { transform: translateX(14px); }

/* ── Dates ── */
.np-dates-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.np-date-sep { color: var(--text-muted); font-size: 14px; flex-shrink: 0; }

.np-whole-year-hint {
  margin: 6px 0 0;
  font-size: 11.5px;
  color: var(--text-muted);
  font-style: italic;
}

/* ── Section card (toggle groupes) ── */
.np-section-card {
  border: 1.5px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color .15s;
}
.np-section-card.active { border-color: rgba(74,144,217,.4); }

.np-section-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
  user-select: none;
  transition: background .1s;
}
.np-section-card-header:hover { background: rgba(255,255,255,.03); }

.np-section-card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
}
.np-section-card-sub {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* ── Contenu groupes ── */
.np-groups-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}

/* Toolbar */
.np-groups-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.np-groups-count-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .04em;
}

.np-groups-counter {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1px solid var(--border-input);
  border-radius: 7px;
  overflow: hidden;
}
.np-counter-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background .1s;
}
.np-counter-btn:hover:not(:disabled) { background: rgba(255,255,255,.08); }
.np-counter-btn:disabled { opacity: .35; cursor: not-allowed; }
.np-counter-val {
  min-width: 28px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  border-left: 1px solid var(--border-input);
  border-right: 1px solid var(--border-input);
}

.np-shuffle-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border: 1px solid var(--border-input);
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-family: var(--font);
  cursor: pointer;
  transition: background .1s, border-color .1s, color .1s;
}
.np-shuffle-btn:hover:not(:disabled) {
  background: rgba(155,135,245,.1);
  border-color: rgba(155,135,245,.4);
  color: #9B87F5;
}
.np-shuffle-btn:disabled { opacity: .4; cursor: not-allowed; }

/* Grille groupes */
.np-groups-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.np-group-card {
  background: rgba(255,255,255,.035);
  border: 1px solid var(--border);
  border-radius: 9px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.np-group-header {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 8px 7px 10px;
  border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,.025);
}

.np-group-lock { color: var(--text-muted); flex-shrink: 0; opacity: .6; }

.np-group-name-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font);
  min-width: 0;
}
.np-group-name-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.np-group-remove {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  display: flex;
  transition: color .1s, background .1s;
}
.np-group-remove:hover { color: var(--color-danger); background: rgba(231,76,60,.1); }

/* Membres */
.np-group-members {
  padding: 8px 10px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.np-group-empty {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
  padding: 6px 0;
}

.np-member-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.np-member-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px 2px 3px;
  background: rgba(74,144,217,.1);
  border: 1px solid rgba(74,144,217,.2);
  border-radius: 5px;
  font-size: 11px;
  color: var(--text-secondary);
}

.np-chip-avatar {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}

.np-chip-remove {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 1px;
  border-radius: 3px;
  display: flex;
  transition: color .1s;
}
.np-chip-remove:hover { color: var(--color-danger); }

.np-add-select {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 11.5px;
  font-family: var(--font);
  padding: 4px 6px;
  cursor: pointer;
  outline: none;
}
.np-add-select:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }
.np-add-select:focus { border-color: var(--accent); color: var(--text-primary); }

/* Pied de groupe */
.np-group-footer {
  padding: 4px 10px 6px;
  font-size: 10px;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
  text-align: right;
}

/* Pool non assignés */
.np-loading {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  text-align: center;
  padding: 12px;
}

.np-pool {
  background: rgba(255,255,255,.025);
  border: 1px dashed var(--border-input);
  border-radius: 8px;
  padding: 10px 12px;
}

.np-pool-title {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--text-muted);
  margin-bottom: 7px;
}

.np-pool-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.np-pool-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px 3px 4px;
  background: rgba(255,255,255,.05);
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 12px;
  color: var(--text-secondary);
}

.np-pool-done {
  text-align: center;
  font-size: 12px;
  color: var(--color-success, #27ae60);
  padding: 6px;
}

/* Option création canaux */
.np-channels-option {
  background: rgba(74,144,217,.06);
  border: 1px solid rgba(74,144,217,.18);
  border-radius: 9px;
  padding: 12px 14px;
}

.np-option-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 3px;
}

.np-option-sub {
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
}

/* Hint groupes désactivés */
.np-groups-off-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(255,255,255,.03);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  line-height: 1.5;
}
.np-groups-off-hint svg { flex-shrink: 0; margin-top: 1px; opacity: .6; }

/* ── Pied de page ── */
.np-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  gap: 8px;
}

.np-footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Transitions ── */
.np-collapse-enter-active,
.np-collapse-leave-active {
  transition: max-height .22s ease, opacity .22s ease;
  overflow: hidden;
}
.np-collapse-enter-from,
.np-collapse-leave-to {
  max-height: 0;
  opacity: 0;
}
.np-collapse-enter-to,
.np-collapse-leave-from {
  max-height: 1000px;
  opacity: 1;
}
</style>
