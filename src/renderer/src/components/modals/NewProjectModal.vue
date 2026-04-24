/**
 * Modale de création de projet - wizard en 2 étapes.
 * Étape 1 : Identité (nom, icône, couleur)
 * Étape 2 : Planification (dates, description, canal auto)
 */
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useAppStore }    from '@/stores/app'
import { useToast }       from '@/composables/useToast'
import { isoForDatetimeLocal } from '@/utils/date'
import { CATEGORY_ICONS } from '@/utils/categoryIcon'
import { PROJECT_COLORS, STORAGE_KEYS } from '@/constants'
import Modal from '@/components/ui/Modal.vue'
import { ChevronRight, ChevronLeft, Check, FolderOpen } from 'lucide-vue-next'

export interface ProjectMeta {
  emoji:       string
  name:        string
  description: string
  startDate:   string
  endDate:     string
  wholeYear?:  boolean
  color?:      string
}

const props = defineProps<{ modelValue: boolean }>()
const emit  = defineEmits<{
  'update:modelValue': [v: boolean]
  created: [name: string]
}>()

const appStore      = useAppStore()
const { showToast } = useToast()

// ── Wizard ──────────────────────────────────────────────────────────────
const step = ref(1)

// ── Step 1 : Identité ───────────────────────────────────────────────────
const name            = ref('')
const selectedIconKey = ref('monitor')
const selectedColor   = ref<string>(PROJECT_COLORS[0])

const selectedIcon = computed(() => CATEGORY_ICONS.find(i => i.key === selectedIconKey.value) ?? null)

// ── Step 2 : Planification ──────────────────────────────────────────────
const description    = ref('')
const wholeYear      = ref(true)
const startDate      = ref(isoForDatetimeLocal())
const endDate        = ref(isoForDatetimeLocal())
const createChannel  = ref(true)
const saving         = ref(false)

// ── Validation ──────────────────────────────────────────────────────────
const canGoStep2 = computed(() => name.value.trim().length > 0)
const canSave    = computed(() => canGoStep2.value && !saving.value)

// ── Reset ───────────────────────────────────────────────────────────────
watch(() => props.modelValue, (open) => {
  if (!open) return
  step.value            = 1
  name.value            = ''
  selectedIconKey.value = 'monitor'
  selectedColor.value   = PROJECT_COLORS[0]
  description.value     = ''
  wholeYear.value       = true
  startDate.value       = isoForDatetimeLocal()
  endDate.value         = isoForDatetimeLocal()
  createChannel.value   = true
  saving.value          = false
})

// ── Save ────────────────────────────────────────────────────────────────
function fullName() {
  return selectedIconKey.value
    ? `${selectedIconKey.value} ${name.value.trim()}`
    : name.value.trim()
}

async function save() {
  if (!canSave.value) return
  saving.value = true
  try {
    const full    = fullName()
    const promoId = appStore.activePromoId ?? appStore.currentUser?.promo_id

    // Persister dans localStorage
    const raw: string[] = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.CUSTOM_PROJECTS) ?? '[]') } catch { return [] } })()
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
          color:       selectedColor.value,
        })
        localStorage.setItem(key, JSON.stringify(metas))
      }

      // Créer le canal principal
      if (createChannel.value) {
        await window.api.createChannel({ promoId, name: name.value.trim(), type: 'chat', isPrivate: false, members: [], category: full })
        showToast(`Projet « ${name.value.trim()} » créé avec son canal.`, 'success')
      } else {
        showToast(`Projet « ${name.value.trim()} » créé.`, 'success')
      }
    } else {
      showToast(`Projet « ${name.value.trim()} » créé.`, 'success')
    }

    emit('created', full)
    emit('update:modelValue', false)
  } catch (e: unknown) {
    showToast(e instanceof Error ? e.message : 'Erreur lors de la creation.', 'error')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal :model-value="modelValue" title="Nouveau projet" max-width="520px" @update:model-value="emit('update:modelValue', $event)">
    <div class="np">

      <!-- Progress -->
      <div class="np-progress">
        <div class="np-step" :class="{ active: step === 1, done: step > 1 }">
          <span class="np-step-num">1</span> Identité
        </div>
        <div class="np-step-line" :class="{ done: step > 1 }" />
        <div class="np-step" :class="{ active: step === 2 }">
          <span class="np-step-num">2</span> Planification
        </div>
      </div>

      <!-- ═══ Étape 1 : Identité ═══ -->
      <div v-if="step === 1" class="np-body">

        <!-- Nom -->
        <div class="np-field">
          <label class="np-label">Nom du projet</label>
          <input
            v-model="name" type="text" class="np-input" required autofocus
            placeholder="ex : Développement Web, Systèmes embarqués…"
            @keydown.enter="canGoStep2 && (step = 2)"
          />
        </div>

        <!-- Couleur -->
        <div class="np-field">
          <label class="np-label">Couleur</label>
          <div class="np-color-grid">
            <button
              v-for="c in PROJECT_COLORS" :key="c" type="button"
              class="np-color-swatch"
              :class="{ active: selectedColor === c }"
              :style="{ background: c }"
              @click="selectedColor = c"
            >
              <Check v-if="selectedColor === c" :size="12" style="color:#fff" />
            </button>
          </div>
        </div>

        <!-- Icône -->
        <div class="np-field">
          <label class="np-label">Icône</label>
          <div class="np-icon-grid">
            <button
              v-for="icon in CATEGORY_ICONS" :key="icon.key" type="button"
              class="np-icon-btn"
              :class="{ active: selectedIconKey === icon.key }"
              :title="icon.label"
              @click="selectedIconKey = icon.key"
            >
              <component :is="icon.component" :size="16" />
            </button>
          </div>
        </div>

        <!-- Preview -->
        <div class="np-preview">
          <div class="np-preview-icon" :style="{ background: selectedColor + '20', color: selectedColor }">
            <component :is="selectedIcon.component" v-if="selectedIcon" :size="20" />
            <FolderOpen v-else :size="20" />
          </div>
          <span class="np-preview-name" :style="{ color: selectedColor }">{{ name.trim() || 'Mon projet' }}</span>
        </div>
      </div>

      <!-- ═══ Étape 2 : Planification ═══ -->
      <div v-else class="np-body">

        <!-- Description -->
        <div class="np-field">
          <label class="np-label">Description <span class="np-hint">(optionnel)</span></label>
          <textarea v-model="description" class="np-input np-textarea" rows="2" placeholder="Objectifs du projet, contexte…" />
        </div>

        <!-- Dates -->
        <div class="np-field">
          <label class="np-toggle">
            <input v-model="wholeYear" type="checkbox" />
            Toute l'année scolaire
          </label>
        </div>
        <div v-if="!wholeYear" class="np-row">
          <div class="np-field np-flex1">
            <label class="np-label">Début</label>
            <input v-model="startDate" type="date" class="np-input" />
          </div>
          <div class="np-field np-flex1">
            <label class="np-label">Fin</label>
            <input v-model="endDate" type="date" class="np-input" />
          </div>
        </div>

        <!-- Canal -->
        <div class="np-field">
          <label class="np-toggle">
            <input v-model="createChannel" type="checkbox" />
            Créer automatiquement un canal de discussion
          </label>
          <p class="np-hint-block">Un canal public sera créé pour les échanges liés à ce projet.</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="np-footer">
        <button v-if="step > 1" class="btn-ghost np-back" @click="step = 1">
          <ChevronLeft :size="14" /> Retour
        </button>
        <div class="np-footer-right">
          <button class="btn-ghost" @click="emit('update:modelValue', false)">Annuler</button>
          <button
            v-if="step === 1"
            class="btn-primary np-next"
            :disabled="!canGoStep2"
            :style="{ background: canGoStep2 ? selectedColor : undefined }"
            @click="step = 2"
          >
            Suivant <ChevronRight :size="14" />
          </button>
          <button
            v-else
            class="btn-primary np-save"
            :disabled="!canSave"
            :style="{ background: canSave ? selectedColor : undefined }"
            @click="save"
          >
            {{ saving ? 'Création…' : 'Créer le projet' }}
          </button>
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.np { display: flex; flex-direction: column; gap: 16px; padding: 16px 20px 0; }

/* ── Progress indicator ──────────────────────────────────────────────── */
.np-progress {
  display: flex; align-items: center; gap: 0; justify-content: center;
}
.np-step {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--text-muted);
  transition: color .2s;
}
.np-step.active { color: var(--text-primary); }
.np-step.done { color: var(--color-success); }
.np-step-num {
  width: 22px; height: 22px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800;
  background: var(--bg-hover); border: 1.5px solid var(--border);
  transition: all .2s;
}
.np-step.active .np-step-num { background: var(--accent); border-color: var(--accent); color: #fff; }
.np-step.done .np-step-num { background: var(--color-success); border-color: var(--color-success); color: #fff; }
.np-step-line {
  width: 40px; height: 2px; margin: 0 10px;
  background: var(--border); border-radius: 1px;
  transition: background .2s;
}
.np-step-line.done { background: var(--color-success); }

/* ── Body ────────────────────────────────────────────────────────────── */
.np-body { display: flex; flex-direction: column; gap: 14px; }
.np-field { display: flex; flex-direction: column; gap: 4px; }
.np-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.np-hint { font-weight: 400; opacity: .6; }
.np-hint-block { font-size: 11px; color: var(--text-muted); margin-top: 2px; line-height: 1.4; }
.np-input {
  padding: 9px 12px; border-radius: 8px; font-size: 13px;
  border: 1px solid var(--border-input); background: var(--bg-input);
  color: var(--text-primary); font-family: var(--font);
  transition: border-color .15s;
}
.np-input:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 3px rgba(74,144,217,.12); }
.np-textarea { resize: vertical; min-height: 50px; }
.np-row { display: flex; gap: 10px; }
.np-flex1 { flex: 1; }
.np-toggle {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--text-secondary); cursor: pointer;
}
.np-toggle input { accent-color: var(--accent); }

/* ── Color picker ────────────────────────────────────────────────────── */
.np-color-grid { display: flex; gap: 8px; flex-wrap: wrap; }
.np-color-swatch {
  width: 28px; height: 28px; border-radius: 50%;
  border: 2px solid transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: transform .15s, border-color .15s;
}
.np-color-swatch:hover { transform: scale(1.15); }
.np-color-swatch.active { border-color: #fff; transform: scale(1.15); }

/* ── Icon picker ─────────────────────────────────────────────────────── */
.np-icon-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 4px;
}
.np-icon-btn {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; border-radius: 8px;
  background: transparent; border: 1.5px solid transparent;
  color: var(--text-muted); cursor: pointer; font-family: var(--font);
  transition: all .12s;
}
.np-icon-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.np-icon-btn.active { border-color: var(--accent); background: rgba(74,144,217,.1); color: var(--accent); }

/* ── Preview ─────────────────────────────────────────────────────────── */
.np-preview {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; border-radius: 10px;
  background: var(--bg-elevated); border: 1px solid var(--border);
}
.np-preview-icon {
  width: 40px; height: 40px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.np-preview-name { font-size: 16px; font-weight: 700; }

/* ── Footer ──────────────────────────────────────────────────────────── */
.np-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 0 4px; border-top: 1px solid var(--border);
}
.np-footer-right { display: flex; gap: 8px; margin-left: auto; }
.np-back { display: flex; align-items: center; gap: 4px; }
.np-next, .np-save {
  display: flex; align-items: center; gap: 4px;
  min-width: 110px; justify-content: center;
  transition: background .15s;
}
</style>
