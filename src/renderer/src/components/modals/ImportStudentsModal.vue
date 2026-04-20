/**
 * Modale d'import d'étudiants - deux modes : saisie directe (textarea) et fichier CSV.
 * La saisie directe permet d'ajouter rapidement des étudiants ligne par ligne.
 */
<script setup lang="ts">
  import { ref, watch, computed } from 'vue'
  import { Upload, UserPlus, FileText, AlertTriangle, CheckCircle2, X } from 'lucide-vue-next'
  import { useToast }      from '@/composables/useToast'
  import { useAppStore }   from '@/stores/app'
  import { computed as vueComputed } from 'vue'
  import Modal from '@/components/ui/Modal.vue'
  import FileDropZone from '@/components/ui/FileDropZone.vue'
  import type { Promotion } from '@/types'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{ 'update:modelValue': [v: boolean] }>()

  const appStore      = useAppStore()
  const { showToast } = useToast()

  // ── État ──────────────────────────────────────────────────────────────
  type Mode = 'textarea' | 'csv'
  const mode         = ref<Mode>('textarea')
  const promotions   = ref<Promotion[]>([])
  const selectedPromo = ref<number | null>(null)
  const loading      = ref(false)
  const result       = ref<{ imported: number; errors: string[] } | null>(null)

  // ── Textarea ──────────────────────────────────────────────────────────
  const textInput = ref('')

  const parsedRows = computed(() => {
    if (!textInput.value.trim()) return []
    const lines = textInput.value.trim().split('\n').filter(l => l.trim())
    return lines.map((line, i) => {
      const sep = line.includes(';') ? ';' : line.includes(',') ? ',' : '\t'
      const parts = line.split(sep).map(p => p.trim().replace(/^"|"$/g, ''))
      // Format : "Prénom Nom ; email@example.com ; motdepasse (optionnel)"
      // Ou juste : "Prénom Nom ; email@example.com"
      // Ou même : "Prénom Nom" (email auto-généré)
      const name  = parts[0] ?? ''
      const email = parts[1] ?? ''
      const password = parts[2] ?? ''
      const valid = name.length > 0 && (email.includes('@') || email === '')
      return { line: i + 1, name, email, password, valid, raw: line }
    })
  })

  const validCount   = computed(() => parsedRows.value.filter(r => r.valid && r.name).length)
  const invalidCount = computed(() => parsedRows.value.filter(r => !r.valid || !r.name).length)

  // ── Reset ─────────────────────────────────────────────────────────────
  watch(() => props.modelValue, async (open) => {
    if (!open) { result.value = null; return }
    const res = await window.api.getPromotions()
    promotions.value  = res?.ok ? res.data : []
    selectedPromo.value = appStore.activePromoId ?? promotions.value[0]?.id ?? null
    result.value = null
    textInput.value = ''
    mode.value = 'textarea'
  })

  // ── Import CSV (fichier) ──────────────────────────────────────────────
  async function doImportCsv(path?: string) {
    if (!selectedPromo.value) return
    loading.value = true
    result.value  = null
    try {
      const res = await window.api.importStudents(selectedPromo.value, path)
      if (!res?.ok) { showToast(res?.error ?? 'Erreur import', 'error'); return }
      result.value = res.data ?? { imported: 0, errors: [] }
      if (result.value.imported > 0) showToast(`${result.value.imported} étudiant(s) importé(s)`, 'success')
    } finally { loading.value = false }
  }

  // FileDropZone gere la drop-zone visuelle + keyboard + status. On recoit
  // juste l'item via l'event.
  const csvDropDisabled = vueComputed(() => !selectedPromo.value || loading.value)
  function onCsvDropped(items: { path: string | null }[]) {
    const item = items[0]
    if (!item?.path) return
    void doImportCsv(item.path)
  }

  // ── Import textarea ───────────────────────────────────────────────────
  async function doImportTextarea() {
    if (!selectedPromo.value || !validCount.value) return
    loading.value = true
    result.value  = null
    try {
      const rows = parsedRows.value
        .filter(r => r.valid && r.name)
        .map(r => ({
          name:     r.name,
          email:    r.email || `${r.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.')}@viacesi.fr`,
          password: r.password || '',
        }))

      const res = await window.api.bulkImportStudents(selectedPromo.value, rows) as { ok: boolean; data?: { imported: number; errors: string[] }; error?: string }

      if (res?.ok) {
        const data = res.data ?? { imported: 0, errors: [] }
        result.value = data
        if (data.imported > 0) {
          showToast(`${data.imported} étudiant(s) ajouté(s)`, 'success')
          textInput.value = ''
        }
      } else {
        showToast(res?.error ?? 'Erreur', 'error')
      }
    } finally { loading.value = false }
  }

  function close() { emit('update:modelValue', false) }
</script>

<template>
  <Modal :model-value="modelValue" title="Ajouter des étudiants" max-width="560px" @update:model-value="close">
    <div class="is-body">

      <!-- Mode toggle -->
      <div class="is-mode-toggle">
        <button class="is-mode-btn" :class="{ active: mode === 'textarea' }" @click="mode = 'textarea'">
          <UserPlus :size="14" /> Saisie directe
        </button>
        <button class="is-mode-btn" :class="{ active: mode === 'csv' }" @click="mode = 'csv'">
          <FileText :size="14" /> Fichier CSV
        </button>
      </div>

      <!-- Promo -->
      <div class="is-field">
        <label class="is-label">Promotion</label>
        <select v-model.number="selectedPromo" class="is-input">
          <option v-for="p in promotions" :key="p.id" :value="p.id">{{ p.name }}</option>
        </select>
      </div>

      <!-- ═══ Mode textarea ═══ -->
      <template v-if="mode === 'textarea'">
        <div class="is-field">
          <label class="is-label">Étudiants <span class="is-hint">(un par ligne)</span></label>
          <textarea
            v-model="textInput"
            class="is-textarea"
            rows="8"
            placeholder="Jean Dupont ; jean.dupont@viacesi.fr
Marie Martin ; marie.martin@viacesi.fr
Pierre Durand

Sans email, il sera généré automatiquement :
prenom.nom@viacesi.fr"
          />
        </div>

        <!-- Preview -->
        <div v-if="parsedRows.length" class="is-preview">
          <div class="is-preview-header">
            <span>{{ validCount }} étudiant{{ validCount > 1 ? 's' : '' }} détecté{{ validCount > 1 ? 's' : '' }}</span>
            <span v-if="invalidCount" class="is-preview-warn">
              <AlertTriangle :size="12" /> {{ invalidCount }} ligne{{ invalidCount > 1 ? 's' : '' }} ignorée{{ invalidCount > 1 ? 's' : '' }}
            </span>
          </div>
          <div class="is-preview-list">
            <div v-for="r in parsedRows.slice(0, 10)" :key="r.line" class="is-preview-row" :class="{ invalid: !r.valid || !r.name }">
              <span class="is-preview-name">{{ r.name || '-' }}</span>
              <span class="is-preview-email">{{ r.email || `${r.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '.')}@viacesi.fr` }}</span>
              <CheckCircle2 v-if="r.valid && r.name" :size="12" class="is-preview-ok" />
              <X v-else :size="12" class="is-preview-ko" />
            </div>
            <div v-if="parsedRows.length > 10" class="is-preview-more">
              + {{ parsedRows.length - 10 }} autres lignes…
            </div>
          </div>
        </div>
      </template>

      <!-- ═══ Mode CSV ═══ -->
      <template v-else>
        <div class="is-format-box">
          <p class="is-format-title">Format CSV attendu</p>
          <pre class="is-format-pre">name;email;password
Jean Dupont;jean@viacesi.fr;monmotdepasse
Marie Martin;marie@viacesi.fr;</pre>
          <p class="is-hint-block">
            Séparateur <code>;</code> ou <code>,</code>.
            Colonne <code>password</code> optionnelle (défaut : mot de passe temporaire).
            Les doublons d'email sont ignorés.
          </p>
        </div>

        <!-- Zone drag-drop CSV (composant unifie) -->
        <FileDropZone
          :allowed-extensions="['csv', 'txt']"
          :disabled="csvDropDisabled"
          label="Glisser un .csv ou cliquer pour choisir"
          drag-over-label="Relacher pour importer"
          processing-label="Import en cours..."
          success-label="Import termine"
          hint="Max 50 Mo · .csv ou .txt"
          require-electron-path
          @drop="onCsvDropped"
          @click="doImportCsv()"
        />
      </template>

      <!-- Résultat -->
      <div v-if="result" class="is-result" :class="{ 'is-result--warn': result.errors.length }">
        <div class="is-result-row">
          <CheckCircle2 :size="14" />
          <span>{{ result.imported }} importé{{ result.imported > 1 ? 's' : '' }}</span>
          <span v-if="result.errors.length" class="is-result-warn">
            · {{ result.errors.length }} ignoré{{ result.errors.length > 1 ? 's' : '' }}
          </span>
        </div>
        <ul v-if="result.errors.length" class="is-errors">
          <li v-for="e in result.errors" :key="e">{{ e }}</li>
        </ul>
      </div>
    </div>

    <!-- Footer -->
    <div class="is-footer">
      <button class="btn-ghost" @click="close">Fermer</button>
      <button
        v-if="mode === 'textarea'"
        class="btn-primary is-submit"
        :disabled="!selectedPromo || !validCount || loading"
        @click="doImportTextarea"
      >
        <UserPlus :size="14" />
        {{ loading ? 'Ajout…' : `Ajouter ${validCount} étudiant${validCount > 1 ? 's' : ''}` }}
      </button>
      <button
        v-else
        class="btn-primary is-submit"
        :disabled="!selectedPromo || loading"
        @click="() => doImportCsv()"
      >
        <Upload :size="14" />
        {{ loading ? 'Import…' : 'Choisir un fichier' }}
      </button>
    </div>
  </Modal>
</template>

<style scoped>
.is-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }

/* Mode toggle */
.is-mode-toggle { display: flex; gap: 0; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
.is-mode-btn {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 8px 12px; font-size: 13px; font-weight: 600;
  background: transparent; color: var(--text-muted); border: none;
  cursor: pointer; font-family: var(--font); transition: all .15s;
}
.is-mode-btn:hover { background: var(--bg-elevated); color: var(--text-primary); }
.is-mode-btn.active { background: var(--accent); color: #fff; }

/* Fields */
.is-field { display: flex; flex-direction: column; gap: 4px; }
.is-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.is-hint { font-weight: 400; opacity: .6; }
.is-hint-block { font-size: 11px; color: var(--text-muted); margin-top: 4px; line-height: 1.4; }
.is-hint-block code { background: var(--bg-hover); border-radius: 3px; padding: 1px 4px; font-size: 11px; }
.is-input {
  padding: 9px 12px; border-radius: 8px; font-size: 13px;
  border: 1px solid var(--border-input); background: var(--bg-input);
  color: var(--text-primary); font-family: var(--font);
}
.is-textarea {
  padding: 10px 12px; border-radius: 8px; font-size: 13px;
  border: 1px solid var(--border-input); background: var(--bg-input);
  color: var(--text-primary); font-family: var(--font);
  resize: vertical; min-height: 140px; line-height: 1.5;
}
.is-textarea:focus, .is-input:focus { border-color: var(--accent); outline: none; box-shadow: 0 0 0 3px rgba(74,144,217,.12); }

/* Preview */
.is-preview {
  border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
}
.is-preview-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; background: var(--bg-elevated);
  font-size: 12px; font-weight: 600; color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
}
.is-preview-warn { color: var(--color-warning); display: flex; align-items: center; gap: 4px; }
.is-preview-list { max-height: 200px; overflow-y: auto; }
.is-preview-row {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; font-size: 12px;
  border-bottom: 1px solid var(--border);
}
.is-preview-row.invalid { opacity: .4; }
.is-preview-name { font-weight: 600; color: var(--text-primary); min-width: 120px; }
.is-preview-email { color: var(--text-muted); flex: 1; }
.is-preview-ok { color: var(--color-success); flex-shrink: 0; }
.is-preview-ko { color: var(--color-danger); flex-shrink: 0; }
.is-preview-more { padding: 6px 12px; font-size: 11px; color: var(--text-muted); font-style: italic; }

/* Format box (CSV) */
.is-format-box {
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 8px; padding: 12px 14px;
}
.is-format-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--text-muted); margin-bottom: 8px; }
.is-format-pre {
  font-family: 'Fira Code', 'Consolas', monospace; font-size: 12px;
  color: var(--text-secondary); background: rgba(0,0,0,.2);
  border-radius: 4px; padding: 8px 10px; margin-bottom: 8px; overflow-x: auto; white-space: pre;
}

/* Result */
.is-result {
  background: rgba(46,204,113,.06); border: 1px solid rgba(46,204,113,.2);
  border-radius: 8px; padding: 10px 14px;
}
.is-result--warn { background: rgba(243,156,18,.06); border-color: rgba(243,156,18,.2); }
.is-result-row { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--color-success); }
.is-result-warn { color: var(--color-warning); font-weight: 500; }
.is-errors { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
.is-errors li { font-size: 11px; color: var(--text-muted); }

/* Footer */
.is-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 12px 20px; border-top: 1px solid var(--border);
}
.is-submit { display: flex; align-items: center; gap: 6px; }
</style>
