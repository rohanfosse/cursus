<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Eye, EyeOff, ShieldCheck, KeyRound } from 'lucide-vue-next'
import { useAppStore } from '@/stores/app'
import { useToast }    from '@/composables/useToast'
import { useApi }      from '@/composables/useApi'

const props = defineProps<{
  modelValue: boolean
  forced?:    boolean   // true = ne peut pas être fermé sans changer le mdp
}>()
const emit = defineEmits<{
  'update:modelValue': [v: boolean]
  changed: []
}>()

const appStore      = useAppStore()
const { showToast } = useToast()
const { api }       = useApi()

const currentPwd  = ref('')
const newPwd      = ref('')
const confirmPwd  = ref('')
const saving      = ref(false)
const showCurrent = ref(false)
const showNew     = ref(false)
const showConfirm = ref(false)

watch(() => props.modelValue, (open) => {
  if (open) {
    currentPwd.value  = ''
    newPwd.value      = ''
    confirmPwd.value  = ''
    showCurrent.value = false
    showNew.value     = false
    showConfirm.value = false
  }
})

// ── Force de mot de passe ──────────────────────────────────────────────────
const criteria = computed(() => ({
  length:    newPwd.value.length >= 8,
  uppercase: /[A-Z]/.test(newPwd.value),
  number:    /[0-9]/.test(newPwd.value),
  special:   /[^A-Za-z0-9]/.test(newPwd.value),
}))

const score = computed(() => Object.values(criteria.value).filter(Boolean).length)

const strengthInfo = computed(() => {
  if (!newPwd.value) return null
  if (score.value <= 1) return { label: 'Très faible', color: '#e74c3c', width: '20%' }
  if (score.value === 2) return { label: 'Faible',     color: '#e67e22', width: '40%' }
  if (score.value === 3) return { label: 'Moyen',      color: '#f1c40f', width: '65%' }
  if (score.value === 4) return { label: 'Fort',       color: '#27ae60', width: '85%' }
  return                        { label: 'Très fort',  color: '#1abc9c', width: '100%' }
})

const mismatch  = computed(() => confirmPwd.value.length > 0 && newPwd.value !== confirmPwd.value)
const canSubmit = computed(() =>
  currentPwd.value.length > 0 &&
  score.value === 4 &&
  newPwd.value === confirmPwd.value &&
  newPwd.value !== currentPwd.value,
)

// ── Soumission ─────────────────────────────────────────────────────────────
async function save() {
  if (!canSubmit.value || saving.value) return
  const user = appStore.currentUser
  if (!user) return

  const isTeacher = user.type !== 'student'
  const userId    = Math.abs(user.id)

  saving.value = true
  try {
    const result = await api(
      () => window.api.changePassword(userId, isTeacher, currentPwd.value, newPwd.value),
      'password',
    )
    if (result !== null) {
      appStore.clearMustChangePassword()
      showToast('Mot de passe mis à jour avec succès.', 'success')
      emit('changed')
      emit('update:modelValue', false)
    }
  } finally {
    saving.value = false
  }
}

function tryClose() {
  if (props.forced) return
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="cpw-overlay"
        :class="{ forced }"
        @click.self="tryClose"
      >
        <div class="cpw-box" role="dialog" aria-modal="true" aria-label="Changer le mot de passe">
          <!-- En-tête -->
          <div class="cpw-header">
            <div class="cpw-header-icon">
              <KeyRound :size="18" />
            </div>
            <div>
              <h3 class="cpw-title">
                {{ forced ? 'Définissez votre mot de passe' : 'Changer le mot de passe' }}
              </h3>
              <p v-if="forced" class="cpw-subtitle">
                Bienvenue sur Cursus ! Pour sécuriser votre compte, choisissez un mot de passe personnel avant de commencer.
              </p>
            </div>
          </div>

          <!-- Formulaire -->
          <div class="cpw-body">

            <!-- Mot de passe actuel -->
            <div class="form-group">
              <label class="form-label">Mot de passe actuel</label>
              <div class="cpw-input-wrap">
                <input
                  v-model="currentPwd"
                  :type="showCurrent ? 'text' : 'password'"
                  class="form-input cpw-input"
                  placeholder="••••••••"
                  autocomplete="current-password"
                  @keydown.enter="save"
                />
                <button class="cpw-eye" type="button" :aria-label="showCurrent ? 'Masquer le mot de passe actuel' : 'Afficher le mot de passe actuel'" @click="showCurrent = !showCurrent">
                  <EyeOff v-if="showCurrent" :size="15" />
                  <Eye    v-else             :size="15" />
                </button>
              </div>
            </div>

            <!-- Nouveau mot de passe -->
            <div class="form-group">
              <label class="form-label">Nouveau mot de passe</label>
              <div class="cpw-input-wrap">
                <input
                  v-model="newPwd"
                  :type="showNew ? 'text' : 'password'"
                  class="form-input cpw-input"
                  placeholder="••••••••"
                  autocomplete="new-password"
                />
                <button class="cpw-eye" type="button" :aria-label="showNew ? 'Masquer le nouveau mot de passe' : 'Afficher le nouveau mot de passe'" @click="showNew = !showNew">
                  <EyeOff v-if="showNew" :size="15" />
                  <Eye    v-else         :size="15" />
                </button>
              </div>

              <!-- Barre de force -->
              <div v-if="strengthInfo" class="cpw-strength">
                <div class="cpw-strength-bar">
                  <div
                    class="cpw-strength-fill"
                    :style="{ width: strengthInfo.width, background: strengthInfo.color }"
                  />
                </div>
                <span class="cpw-strength-label" :style="{ color: strengthInfo.color }">
                  {{ strengthInfo.label }}
                </span>
              </div>

              <!-- Critères -->
              <div v-if="newPwd" class="cpw-criteria">
                <div class="cpw-criterion" :class="{ ok: criteria.length }">
                  {{ criteria.length ? '✓' : '○' }} 8 caractères minimum
                </div>
                <div class="cpw-criterion" :class="{ ok: criteria.uppercase }">
                  {{ criteria.uppercase ? '✓' : '○' }} Une majuscule
                </div>
                <div class="cpw-criterion" :class="{ ok: criteria.number }">
                  {{ criteria.number ? '✓' : '○' }} Un chiffre
                </div>
                <div class="cpw-criterion" :class="{ ok: criteria.special }">
                  {{ criteria.special ? '✓' : '○' }} Un caractère spécial
                </div>
              </div>
            </div>

            <!-- Confirmation -->
            <div class="form-group">
              <label class="form-label">Confirmer le nouveau mot de passe</label>
              <div class="cpw-input-wrap">
                <input
                  v-model="confirmPwd"
                  :type="showConfirm ? 'text' : 'password'"
                  class="form-input cpw-input"
                  :class="{ 'cpw-error': mismatch }"
                  placeholder="••••••••"
                  autocomplete="new-password"
                  @keydown.enter="save"
                />
                <button class="cpw-eye" type="button" :aria-label="showConfirm ? 'Masquer la confirmation' : 'Afficher la confirmation'" @click="showConfirm = !showConfirm">
                  <EyeOff v-if="showConfirm" :size="15" />
                  <Eye    v-else             :size="15" />
                </button>
              </div>
              <p v-if="mismatch" class="cpw-mismatch">Les mots de passe ne correspondent pas.</p>
            </div>

          </div>

          <!-- Pied -->
          <div class="cpw-footer">
            <button v-if="!forced" class="btn-ghost" @click="tryClose">Annuler</button>
            <button
              class="btn-primary cpw-submit"
              :disabled="!canSubmit || saving"
              @click="save"
            >
              <ShieldCheck v-if="!saving" :size="15" />
              <span>{{ saving ? 'Enregistrement…' : (forced ? 'Définir mon mot de passe' : 'Mettre à jour') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.cpw-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, .55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.cpw-overlay.forced { background: rgba(0, 0, 0, .75); }

.cpw-box {
  width: 100%;
  max-width: 420px;
  background: var(--bg-modal);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, .6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* En-tête */
.cpw-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid var(--border);
}

.cpw-header-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(74, 144, 217, .15);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cpw-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 3px;
}

.cpw-subtitle {
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.5;
}

/* Corps */
.cpw-body {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cpw-input-wrap {
  position: relative;
}

.cpw-input {
  padding-right: 40px !important;
}

.cpw-eye {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  transition: color .1s;
}
.cpw-eye:hover { color: var(--text-secondary); }

.cpw-error { border-color: var(--color-danger, #e74c3c) !important; }
.cpw-mismatch {
  font-size: 11.5px;
  color: var(--color-danger, #e74c3c);
  margin: 4px 0 0;
}

/* Barre de force */
.cpw-strength {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.cpw-strength-bar {
  flex: 1;
  height: 4px;
  background: rgba(255,255,255,.1);
  border-radius: 2px;
  overflow: hidden;
}

.cpw-strength-fill {
  height: 100%;
  border-radius: 2px;
  transition: width .3s ease, background .3s ease;
}

.cpw-strength-label {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
}

/* Critères */
.cpw-criteria {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px 12px;
  margin-top: 8px;
}

.cpw-criterion {
  font-size: 11px;
  color: var(--text-muted);
  transition: color .15s;
}
.cpw-criterion.ok { color: var(--color-success, #27ae60); }

/* Pied */
.cpw-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
}

.cpw-submit {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Transitions */
.modal-enter-active, .modal-leave-active { transition: opacity .15s ease; }
.modal-enter-from, .modal-leave-to       { opacity: 0; }
.modal-enter-active .cpw-box,
.modal-leave-active .cpw-box             { transition: transform .15s ease; }
.modal-enter-from .cpw-box,
.modal-leave-to .cpw-box                 { transform: translateY(-10px) scale(.97); }
</style>
