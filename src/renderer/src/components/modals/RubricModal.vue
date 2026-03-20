<script setup lang="ts">
  import { ref, computed, watch } from 'vue'
  import { Plus, Trash2 } from 'lucide-vue-next'
  import { useAppStore }    from '@/stores/app'
  import { useModalsStore } from '@/stores/modals'
  import { useTravauxStore } from '@/stores/travaux'
  import { useToast }        from '@/composables/useToast'
  import Modal from '@/components/ui/Modal.vue'
  import type { Rubric, RubricCriterion, RubricScore } from '@/types'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const appStore     = useAppStore()
  const modals       = useModalsStore()
  const travauxStore = useTravauxStore()
  const { showToast } = useToast()

  // ── Mode ──────────────────────────────────────────────────────────────────
  // rubricDepotId === null → édition de la grille
  // rubricDepotId !== null → notation d'un dépôt
  const isScoring = computed(() => appStore.rubricDepotId !== null)

  // ── Données rubric ────────────────────────────────────────────────────────
  const rubric    = ref<Rubric | null>(null)
  const loading   = ref(false)
  const saving    = ref(false)

  // ── Édition de la grille ──────────────────────────────────────────────────
  interface DraftCriterion {
    _key: number   // clé locale pour v-for
    label:   string
    max_pts: number
    weight:  number
  }

  let _draftKey = 0
  const rubricTitle  = ref("Grille d'évaluation")
  const draftCriteria = ref<DraftCriterion[]>([])

  function addCriterion() {
    draftCriteria.value.push({ _key: ++_draftKey, label: '', max_pts: 4, weight: 1 })
  }

  function removeCriterion(key: number) {
    draftCriteria.value = draftCriteria.value.filter((c) => c._key !== key)
  }

  // ── Scores (mode notation) ────────────────────────────────────────────────
  const scores = ref<Record<number, number>>({})   // criterion_id → points

  const weightedScore = computed(() => {
    if (!rubric.value?.criteria.length) return null
    let num = 0, den = 0
    for (const c of rubric.value.criteria) {
      const pts = scores.value[c.id] ?? 0
      num += pts * c.weight
      den += c.max_pts * c.weight
    }
    if (!den) return null
    return Math.round((num / den) * 100)
  })

  // ── Chargement ────────────────────────────────────────────────────────────
  const loadError = ref(false)

  async function loadRubric() {
    const travailId = appStore.currentTravailId
    if (!travailId) return
    loading.value = true
    loadError.value = false
    try {
      const res = await window.api.getRubric(travailId)
      rubric.value = res?.ok ? res.data : null

      if (!isScoring.value) {
        // Édition : pré-remplir le draft
        rubricTitle.value   = rubric.value?.title ?? "Grille d'évaluation"
        draftCriteria.value = (rubric.value?.criteria ?? []).map((c) => ({
          _key:    ++_draftKey,
          label:   c.label,
          max_pts: c.max_pts,
          weight:  c.weight,
        }))
        if (!draftCriteria.value.length) addCriterion()
      } else {
        // Notation : charger les scores existants
        const depotId = appStore.rubricDepotId!
        const sRes = await window.api.getDepotScores(depotId)
        const existing: RubricScore[] = sRes?.ok ? sRes.data : []
        const map: Record<number, number> = {}
        for (const s of existing) map[s.criterion_id] = s.points
        scores.value = map
      }
    } catch {
      loadError.value = true
      showToast('Impossible de charger la grille d\'évaluation.', 'error')
    } finally {
      loading.value = false
    }
  }

  watch(() => props.modelValue, (open) => {
    if (open) loadRubric()
  })

  // ── Sauvegarder la grille ─────────────────────────────────────────────────
  async function saveRubric() {
    const travailId = appStore.currentTravailId
    if (!travailId) return
    saving.value = true
    try {
      const res = await window.api.upsertRubric({
        travailId,
        title:    rubricTitle.value,
        criteria: draftCriteria.value.map((c, i) => ({
          label:   c.label,
          max_pts: c.max_pts,
          weight:  c.weight,
          position: i,
        })),
      })
      if (res?.ok) {
        showToast('Grille enregistrée', 'success')
        emit('update:modelValue', false)
      } else {
        showToast(res?.error ?? 'Erreur', 'error')
      }
    } finally {
      saving.value = false
    }
  }

  // ── Sauvegarder les scores ────────────────────────────────────────────────
  async function saveScores() {
    const depotId = appStore.rubricDepotId
    if (!depotId || !rubric.value) return
    saving.value = true
    try {
      const payload = {
        depotId,
        scores: rubric.value.criteria.map((c) => ({
          criterion_id: c.id,
          points:       scores.value[c.id] ?? 0,
        })),
      }
      const res = await window.api.setDepotScores(payload)
      if (res?.ok) {
        showToast('Scores enregistrés', 'success')
        emit('update:modelValue', false)
      } else {
        showToast(res?.error ?? 'Erreur', 'error')
      }
    } finally {
      saving.value = false
    }
  }

  // ── Supprimer la grille ───────────────────────────────────────────────────
  async function deleteRubric() {
    const travailId = appStore.currentTravailId
    if (!travailId) return
    await window.api.deleteRubric(travailId)
    showToast('Grille supprimée', 'success')
    emit('update:modelValue', false)
  }

  function close() {
    appStore.rubricDepotId = null
    emit('update:modelValue', false)
  }

  // Nom du dépôt courant (pour le titre du modal de notation)
  const scoringDepotName = computed(() => {
    if (!isScoring.value) return ''
    const d = travauxStore.depots.find((d) => d.id === appStore.rubricDepotId)
    return d?.student_name ?? ''
  })
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="isScoring
      ? `Évaluation — ${scoringDepotName}`
      : `Grille d'évaluation`"
    max-width="560px"
    @update:model-value="close"
  >
    <div v-if="loading" class="rubric-loading">Chargement…</div>
    <div v-else-if="loadError" class="rubric-loading" style="color:var(--color-danger)">Erreur de chargement — vérifiez votre connexion.</div>

    <!-- ── Mode édition grille ── -->
    <template v-else-if="!isScoring">
      <div class="rubric-body">
        <!-- Titre de la grille -->
        <div class="rubric-field">
          <label class="rubric-label">Titre</label>
          <input v-model="rubricTitle" class="form-input" placeholder="Grille d'évaluation" />
        </div>

        <!-- Critères -->
        <div class="rubric-criteria-header">
          <span class="rubric-label">Critères</span>
          <button class="btn-ghost rubric-add-btn" @click="addCriterion">
            <Plus :size="13" /> Ajouter
          </button>
        </div>

        <div class="rubric-criteria-list">
          <div
            v-for="c in draftCriteria"
            :key="c._key"
            class="rubric-criterion-row"
          >
            <!-- grip retiré : réordonnement non implémenté -->
            <input
              v-model="c.label"
              class="form-input rubric-criterion-label"
              placeholder="Intitulé du critère"
            />
            <div class="rubric-criterion-nums">
              <label class="rubric-num-label">Max</label>
              <input
                v-model.number="c.max_pts"
                type="number"
                min="1"
                max="20"
                class="form-input rubric-num-input"
              />
              <label class="rubric-num-label">×</label>
              <input
                v-model.number="c.weight"
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                class="form-input rubric-num-input"
              />
            </div>
            <button class="btn-icon rubric-delete-btn" @click="removeCriterion(c._key)">
              <Trash2 :size="13" />
            </button>
          </div>

          <div v-if="!draftCriteria.length" class="rubric-empty-hint">
            Aucun critère. Cliquez sur « Ajouter » pour commencer.
          </div>
        </div>
      </div>

      <div class="rubric-footer">
        <button
          v-if="rubric"
          class="btn-ghost rubric-delete-rubric"
          @click="deleteRubric"
        >
          Supprimer la grille
        </button>
        <div style="display:flex;gap:8px;margin-left:auto">
          <button class="btn-ghost" @click="close">Annuler</button>
          <button
            class="btn-primary"
            :disabled="saving || !draftCriteria.length || draftCriteria.some(c => !c.label.trim())"
            @click="saveRubric"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </template>

    <!-- ── Mode notation ── -->
    <template v-else>
      <div v-if="!rubric" class="rubric-no-rubric">
        <p>Aucune grille définie pour ce travail.</p>
        <p style="font-size:12px;color:var(--text-muted)">
          Gérez la grille depuis la liste des dépôts.
        </p>
      </div>

      <div v-else class="rubric-body">
        <p class="rubric-scoring-title">{{ rubric.title }}</p>

        <div class="rubric-score-list">
          <div
            v-for="c in rubric.criteria"
            :key="c.id"
            class="rubric-score-row"
          >
            <span class="rubric-score-label">{{ c.label }}</span>
            <span class="rubric-score-weight">×{{ c.weight }}</span>
            <div class="rubric-score-btns">
              <button
                v-for="pt in c.max_pts + 1"
                :key="pt - 1"
                class="rubric-pt-btn"
                :class="{ active: (scores[c.id] ?? 0) === pt - 1 }"
                @click="scores[c.id] = pt - 1"
              >
                {{ pt - 1 }}
              </button>
            </div>
            <span class="rubric-score-max">/ {{ c.max_pts }}</span>
          </div>
        </div>

        <!-- Score global pondéré -->
        <div v-if="weightedScore !== null" class="rubric-total">
          Score pondéré :
          <strong
            :class="{
              'rubric-score-high':   weightedScore >= 75,
              'rubric-score-mid':    weightedScore >= 50 && weightedScore < 75,
              'rubric-score-low':    weightedScore < 50,
            }"
          >
            {{ weightedScore }} %
          </strong>
        </div>
      </div>

      <div class="rubric-footer">
        <div style="margin-left:auto;display:flex;gap:8px">
          <button class="btn-ghost" @click="close">Annuler</button>
          <button
            class="btn-primary"
            :disabled="saving || !rubric"
            @click="saveScores"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style scoped>
.rubric-loading {
  padding: 32px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.rubric-body {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  max-height: 60vh;
}

.rubric-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.rubric-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .5px;
  color: var(--text-muted);
}

.rubric-criteria-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rubric-add-btn {
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
}

.rubric-criteria-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rubric-criterion-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rubric-grip {
  color: var(--text-muted);
  flex-shrink: 0;
  cursor: grab;
  opacity: .5;
}

.rubric-criterion-label {
  flex: 1;
  min-width: 0;
  font-size: 13px;
}

.rubric-criterion-nums {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.rubric-num-label {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.rubric-num-input {
  width: 52px;
  font-size: 13px;
  text-align: center;
  padding: 4px 6px;
}

.rubric-delete-btn {
  flex-shrink: 0;
  color: var(--color-danger);
  opacity: .7;
}
.rubric-delete-btn:hover { opacity: 1; }

.rubric-empty-hint {
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
  padding: 8px 0;
}

/* Mode notation */
.rubric-scoring-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.rubric-score-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rubric-score-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rubric-score-label {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rubric-score-weight {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
  min-width: 28px;
  text-align: right;
}

.rubric-score-btns {
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}

.rubric-pt-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: var(--font);
  color: var(--text-secondary);
  transition: all .1s;
}
.rubric-pt-btn:hover { background: var(--bg-hover); }
.rubric-pt-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.rubric-score-max {
  font-size: 11px;
  color: var(--text-muted);
  min-width: 28px;
  flex-shrink: 0;
}

.rubric-total {
  font-size: 13px;
  color: var(--text-secondary);
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.rubric-total strong { font-size: 16px; font-weight: 800; }
.rubric-score-high { color: var(--color-success); }
.rubric-score-mid  { color: var(--color-warning); }
.rubric-score-low  { color: var(--color-danger); }

.rubric-no-rubric {
  padding: 32px 20px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}

/* Footer */
.rubric-footer {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.rubric-delete-rubric {
  color: var(--color-danger);
  font-size: 12px;
  opacity: .8;
}
.rubric-delete-rubric:hover { opacity: 1; }
</style>
