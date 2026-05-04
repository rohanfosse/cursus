<script setup lang="ts">
  import { ref, watch } from 'vue'
  import { X, GraduationCap } from 'lucide-vue-next'
  import { useAppStore }  from '@/stores/app'
  import { useToast }     from '@/composables/useToast'
  import PromoColorPicker from '@/components/ui/PromoColorPicker.vue'
  import { DEFAULT_PROMO_COLOR, getPromoColorFromName } from '@/utils/promoPalette'

  const props = defineProps<{ modelValue: boolean }>()
  const emit  = defineEmits<{
    (e: 'update:modelValue', v: boolean): void
    (e: 'created', promo: { id: number; name: string; color: string }): void
  }>()

  const appStore     = useAppStore()
  const { showToast } = useToast()

  const name    = ref('')
  const color   = ref<string>(DEFAULT_PROMO_COLOR)
  const colorTouched = ref(false)
  const saving  = ref(false)
  const nameEl  = ref<HTMLInputElement | null>(null)

  watch(() => props.modelValue, (open) => {
    if (open) {
      name.value  = ''
      color.value = DEFAULT_PROMO_COLOR
      colorTouched.value = false
      saving.value = false
      setTimeout(() => nameEl.value?.focus(), 60)
    }
  })

  // Auto-suggestion : tant que l'utilisateur n'a pas touché la palette,
  // la couleur suit le nom (déterministe hash-based) — harmonie visuelle.
  watch(name, (n) => {
    if (!colorTouched.value) color.value = getPromoColorFromName(n)
  })

  function onColorChange(v: string): void {
    colorTouched.value = true
    color.value = v
  }

  function close() { emit('update:modelValue', false) }

  async function submit() {
    const n = name.value.trim()
    if (!n) { nameEl.value?.focus(); return }
    saving.value = true
    try {
      const res = await window.api.createPromotion({ name: n, color: color.value })
      if (res?.ok) {
        const newPromo = { id: res.data.id, name: n, color: color.value }
        showToast(`Promotion "${n}" créée avec succès.`, 'success')
        appStore.activePromoId = res.data.id
        emit('created', newPromo)
        close()
      } else {
        showToast('Erreur lors de la création de la promotion.', 'error')
      }
    } finally {
      saving.value = false
    }
  }
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="cp-modal" role="dialog" aria-modal="true" aria-label="Créer une promotion">

          <!-- En-tête -->
          <div class="cp-header">
            <GraduationCap :size="18" class="cp-header-icon" />
            <div>
              <h2 class="cp-title">Nouvelle promotion</h2>
              <p class="cp-sub">Créer un nouvel espace classe</p>
            </div>
            <button class="btn-icon cp-close" @click="close"><X :size="16" /></button>
          </div>

          <!-- Corps -->
          <div class="cp-body">

            <!-- Nom -->
            <div class="cp-field">
              <label class="cp-label">Nom de la promotion</label>
              <input
                ref="nameEl"
                v-model="name"
                class="cp-input"
                type="text"
                placeholder="ex. B3 DevOps 2025"
                maxlength="60"
                @keydown.enter="submit"
                @keydown.escape="close"
              />
            </div>

            <!-- Couleur -->
            <div class="cp-field">
              <label class="cp-label">Couleur d'identification</label>
              <PromoColorPicker :model-value="color" @update:model-value="onColorChange" />

              <!-- Aperçu pill -->
              <div class="cp-preview-wrap">
                <span class="cp-preview-pill" :style="{ background: color }">
                  {{ name.trim() || 'Nom de la promo' }}
                </span>
              </div>
            </div>

          </div>

          <!-- Pied -->
          <div class="cp-footer">
            <button class="btn-ghost" @click="close">Annuler</button>
            <button class="btn-cta" :disabled="!name.trim() || saving" @click="submit">
              <GraduationCap :size="14" />
              {{ saving ? 'Création…' : 'Créer la promotion' }}
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity var(--motion-fast) var(--ease-out); }
.modal-fade-enter-from,  .modal-fade-leave-to      { opacity: 0; }

.cp-modal {
  width: 100%;
  max-width: 420px;
  background: var(--bg-modal);
  border: 1px solid var(--border-input);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 56px rgba(0,0,0,.65);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── En-tête ── */
.cp-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--border);
}
.cp-header-icon { color: var(--accent); flex-shrink: 0; }
.cp-title { font-size: 15px; font-weight: 800; color: var(--text-primary); }
.cp-sub   { font-size: 11.5px; color: var(--text-muted); margin-top: 1px; }
.cp-close { margin-left: auto; color: var(--text-muted); flex-shrink: 0; }
.cp-close:hover { color: var(--text-primary); }

/* ── Corps ── */
.cp-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cp-field { display: flex; flex-direction: column; gap: 8px; }

.cp-label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: .04em;
}

.cp-input {
  width: 100%;
  background: var(--bg-hover);
  border: 1.5px solid var(--border-input);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: var(--font);
  font-size: 14px;
  padding: 9px 12px;
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.cp-input:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }
.cp-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb),.14);
}
.cp-input::placeholder { color: var(--text-muted); }

/* ── Aperçu ── */
.cp-preview-wrap { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.cp-preview-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 12px;
  border-radius: var(--radius-lg);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,.3);
  transition: background .15s;
}

/* ── Pied ── */
.cp-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--border);
}
</style>
